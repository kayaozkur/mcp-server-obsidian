import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import matter from 'gray-matter';
import Fuse from 'fuse.js';
import chokidar from 'chokidar';
import { logger } from './logger.js';

export interface VaultNote {
  path: string;
  name: string;
  content: string;
  frontmatter: any;
  links: string[];
  backlinks: string[];
  tags: string[];
  lastModified: Date;
  created: Date;
  wordCount: number;
}

export interface SearchResult {
  note: VaultNote;
  score: number;
  matches: readonly any[];
}

export interface LinkAnalysis {
  totalLinks: number;
  brokenLinks: string[];
  orphanedNotes: string[];
  centralNotes: Array<{ note: string; connections: number }>;
  clusters: Array<{ notes: string[]; theme?: string }>;
  mermaidDiagram?: string;
}

export class ObsidianClient {
  private vaultPath: string;
  private allowedDirectories: string[];
  private noteCache: Map<string, VaultNote> = new Map();
  private linkGraph: Map<string, Set<string>> = new Map();
  private backlinksGraph: Map<string, Set<string>> = new Map();
  private watcher?: chokidar.FSWatcher;
  private searchIndex?: Fuse<VaultNote>;

  constructor(vaultPath: string) {
    this.vaultPath = this.expandHome(vaultPath);
    this.allowedDirectories = [this.normalizePath(path.resolve(this.vaultPath))];
    this.initializeWatcher();
  }

  // Security utilities
  private normalizePath(p: string): string {
    return path.normalize(p).toLowerCase();
  }

  private expandHome(filepath: string): string {
    if (filepath.startsWith('~/') || filepath === '~') {
      return path.join(os.homedir(), filepath.slice(1));
    }
    return filepath;
  }

  private async validatePath(requestedPath: string): Promise<string> {
    // Ignore hidden files/directories starting with "."
    const pathParts = requestedPath.split(path.sep);
    if (pathParts.some((part) => part.startsWith('.'))) {
      throw new Error('Access denied - hidden files/directories not allowed');
    }

    const expandedPath = this.expandHome(requestedPath);
    const absolute = path.isAbsolute(expandedPath)
      ? path.resolve(expandedPath)
      : path.resolve(this.vaultPath, expandedPath);

    const normalizedRequested = this.normalizePath(absolute);

    // Check if path is within allowed directories
    const isAllowed = this.allowedDirectories.some((dir) =>
      normalizedRequested.startsWith(dir)
    );
    if (!isAllowed) {
      throw new Error(
        `Access denied - path outside vault: ${absolute} not in ${this.allowedDirectories.join(', ')}`
      );
    }

    return absolute;
  }

  // File watching for real-time updates
  private initializeWatcher(): void {
    this.watcher = chokidar.watch(this.vaultPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher
      .on('add', (filePath) => this.handleFileChange(filePath, 'add'))
      .on('change', (filePath) => this.handleFileChange(filePath, 'change'))
      .on('unlink', (filePath) => this.handleFileChange(filePath, 'delete'));
  }

  private async handleFileChange(filePath: string, event: 'add' | 'change' | 'delete'): Promise<void> {
    if (!filePath.endsWith('.md')) return;

    try {
      const relativePath = path.relative(this.vaultPath, filePath);
      
      switch (event) {
        case 'delete':
          this.removeFromCache(relativePath);
          break;
        case 'add':
        case 'change':
          await this.updateCacheEntry(relativePath);
          break;
      }
      
      // Rebuild search index if cache changes
      this.rebuildSearchIndex();
    } catch (error) {
      logger.warn(`Failed to handle file change: ${filePath}`, error);
    }
  }

  // Markdown parsing and link extraction
  private async parseMarkdown(content: string): Promise<{ links: string[]; ast: any }> {
    const links: string[] = [];
    
    // Simple regex-based link extraction for now
    // Wiki links: [[link]] or [[link|alias]]
    const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
    let match;
    while ((match = wikiLinkRegex.exec(content)) !== null) {
      links.push(match[1]);
    }
    
    // Markdown links: [text](link)
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    while ((match = mdLinkRegex.exec(content)) !== null) {
      if (!match[2].startsWith('http')) {
        links.push(match[2]);
      }
    }
    
    // Image embeds: ![[image]]
    const embedRegex = /!\[\[([^\]]+)\]\]/g;
    while ((match = embedRegex.exec(content)) !== null) {
      links.push(match[1]);
    }

    return { links: [...new Set(links)], ast: null };
  }

  // Extract tags from content and frontmatter
  private extractTags(content: string, frontmatter: any): string[] {
    const tags = new Set<string>();
    
    // Tags from frontmatter
    if (frontmatter.tags) {
      const fmTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];
      fmTags.forEach((tag: string) => tags.add(tag.toString()));
    }
    
    // Inline tags from content
    const inlineTagRegex = /#([a-zA-Z0-9_/-]+)/g;
    let match;
    while ((match = inlineTagRegex.exec(content)) !== null) {
      tags.add(match[1]);
    }
    
    return Array.from(tags);
  }

  // Core vault operations
  async initializeVault(): Promise<void> {
    logger.info(`Initializing vault at: ${this.vaultPath}`);
    
    try {
      const stats = await fs.stat(this.vaultPath);
      if (!stats.isDirectory()) {
        throw new Error(`Vault path is not a directory: ${this.vaultPath}`);
      }
    } catch (error) {
      throw new Error(`Cannot access vault directory: ${this.vaultPath}`);
    }

    await this.scanVault();
    this.buildLinkGraphs();
    this.rebuildSearchIndex();
    
    logger.info(`Vault initialized with ${this.noteCache.size} notes`);
  }

  private async scanVault(): Promise<void> {
    const markdownFiles = await this.findMarkdownFiles(this.vaultPath);
    
    for (const filePath of markdownFiles) {
      try {
        const relativePath = path.relative(this.vaultPath, filePath);
        await this.updateCacheEntry(relativePath);
      } catch (error) {
        logger.warn(`Failed to process file: ${filePath}`, error);
      }
    }
  }

  private async findMarkdownFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.name.startsWith('.')) continue; // Skip hidden files
      
      if (entry.isDirectory()) {
        const subFiles = await this.findMarkdownFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private async updateCacheEntry(relativePath: string): Promise<void> {
    const fullPath = path.join(this.vaultPath, relativePath);
    
    try {
      const stats = await fs.stat(fullPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const { data: frontmatter, content: bodyContent } = matter(content);
      
      const { links } = await this.parseMarkdown(bodyContent);
      const tags = this.extractTags(bodyContent, frontmatter);
      
      const note: VaultNote = {
        path: relativePath,
        name: path.basename(relativePath, '.md'),
        content: bodyContent,
        frontmatter,
        links,
        backlinks: [], // Will be populated by buildLinkGraphs
        tags,
        lastModified: stats.mtime,
        created: stats.birthtime || stats.mtime,
        wordCount: bodyContent.split(/\s+/).length,
      };
      
      this.noteCache.set(relativePath, note);
    } catch (error) {
      logger.error(`Failed to update cache for ${relativePath}:`, error);
    }
  }

  private removeFromCache(relativePath: string): void {
    this.noteCache.delete(relativePath);
    this.linkGraph.delete(relativePath);
    this.backlinksGraph.delete(relativePath);
    
    // Remove from other notes' link references
    for (const [, links] of this.linkGraph.entries()) {
      links.delete(relativePath);
    }
    for (const [, backlinks] of this.backlinksGraph.entries()) {
      backlinks.delete(relativePath);
    }
  }

  private buildLinkGraphs(): void {
    this.linkGraph.clear();
    this.backlinksGraph.clear();
    
    // Initialize empty sets for all notes
    for (const note of this.noteCache.values()) {
      this.linkGraph.set(note.path, new Set());
      this.backlinksGraph.set(note.path, new Set());
    }
    
    // Build forward links and backlinks
    for (const note of this.noteCache.values()) {
      const noteLinks = this.linkGraph.get(note.path)!;
      
      for (const link of note.links) {
        // Try to resolve link to actual note
        const targetNote = this.resolveLink(link);
        if (targetNote) {
          noteLinks.add(targetNote.path);
          
          // Add backlink
          const targetBacklinks = this.backlinksGraph.get(targetNote.path);
          if (targetBacklinks) {
            targetBacklinks.add(note.path);
          }
        }
      }
    }
    
    // Update backlinks in note cache
    for (const note of this.noteCache.values()) {
      const backlinks = this.backlinksGraph.get(note.path);
      if (backlinks) {
        note.backlinks = Array.from(backlinks);
      }
    }
  }

  private resolveLink(link: string): VaultNote | null {
    // Remove file extension if present
    const cleanLink = link.replace(/\.md$/, '');
    
    // Try exact match first
    for (const note of this.noteCache.values()) {
      if (note.name === cleanLink || note.path === cleanLink) {
        return note;
      }
    }
    
    // Try partial match
    for (const note of this.noteCache.values()) {
      if (note.name.toLowerCase().includes(cleanLink.toLowerCase())) {
        return note;
      }
    }
    
    return null;
  }

  private rebuildSearchIndex(): void {
    const notes = Array.from(this.noteCache.values());
    
    this.searchIndex = new Fuse(notes, {
      keys: [
        { name: 'name', weight: 0.3 },
        { name: 'content', weight: 0.4 },
        { name: 'tags', weight: 0.2 },
        { name: 'frontmatter.title', weight: 0.1 },
      ],
      threshold: 0.3,
      includeScore: true,
      includeMatches: true,
    });
  }

  // Public API methods
  async createNote(notePath: string, content: string, frontmatter?: any): Promise<VaultNote> {
    const validPath = await this.validatePath(notePath);
    
    // Ensure .md extension
    if (!validPath.endsWith('.md')) {
      notePath += '.md';
    }
    
    // Create frontmatter if provided
    let fileContent = content;
    if (frontmatter && Object.keys(frontmatter).length > 0) {
      fileContent = matter.stringify(content, frontmatter);
    }
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(validPath));
    
    // Write file
    await fs.writeFile(validPath, fileContent, 'utf-8');
    
    // Update cache
    const relativePath = path.relative(this.vaultPath, validPath);
    await this.updateCacheEntry(relativePath);
    this.buildLinkGraphs();
    this.rebuildSearchIndex();
    
    const note = this.noteCache.get(relativePath);
    if (!note) {
      throw new Error('Failed to create note');
    }
    
    logger.info(`Created note: ${relativePath}`);
    return note;
  }

  async updateNote(notePath: string, content?: string, frontmatter?: any): Promise<VaultNote> {
    const validPath = await this.validatePath(notePath);
    const relativePath = path.relative(this.vaultPath, validPath);
    
    const existingNote = this.noteCache.get(relativePath);
    if (!existingNote) {
      throw new Error(`Note not found: ${relativePath}`);
    }
    
    let newContent = content !== undefined ? content : existingNote.content;
    let newFrontmatter = frontmatter !== undefined ? frontmatter : existingNote.frontmatter;
    
    const fileContent = matter.stringify(newContent, newFrontmatter);
    await fs.writeFile(validPath, fileContent, 'utf-8');
    
    // Update cache
    await this.updateCacheEntry(relativePath);
    this.buildLinkGraphs();
    this.rebuildSearchIndex();
    
    const updatedNote = this.noteCache.get(relativePath)!;
    logger.info(`Updated note: ${relativePath}`);
    return updatedNote;
  }

  async deleteNote(notePath: string): Promise<void> {
    const validPath = await this.validatePath(notePath);
    const relativePath = path.relative(this.vaultPath, validPath);
    
    if (!this.noteCache.has(relativePath)) {
      throw new Error(`Note not found: ${relativePath}`);
    }
    
    await fs.remove(validPath);
    this.removeFromCache(relativePath);
    this.rebuildSearchIndex();
    
    logger.info(`Deleted note: ${relativePath}`);
  }

  async readNote(notePath: string): Promise<VaultNote> {
    const validPath = await this.validatePath(notePath);
    const relativePath = path.relative(this.vaultPath, validPath);
    
    let note = this.noteCache.get(relativePath);
    if (!note) {
      // Try to load if not in cache
      if (await fs.pathExists(validPath)) {
        await this.updateCacheEntry(relativePath);
        note = this.noteCache.get(relativePath);
      }
    }
    
    if (!note) {
      throw new Error(`Note not found: ${relativePath}`);
    }
    
    return note;
  }

  async searchNotes(query: string, options?: {
    includeContent?: boolean;
    tags?: string[];
    limit?: number;
  }): Promise<SearchResult[]> {
    if (!this.searchIndex) {
      this.rebuildSearchIndex();
    }
    
    const searchResults = this.searchIndex!.search(query);
    let results = searchResults.map(result => ({
      note: result.item,
      score: result.score || 0,
      matches: result.matches || [],
    }));
    
    // Filter by tags if specified
    if (options?.tags && options.tags.length > 0) {
      results = results.filter(result => 
        options.tags!.some(tag => result.note.tags.includes(tag))
      );
    }
    
    // Limit results
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }
    
    return results;
  }

  getBacklinks(notePath: string): string[] {
    const note = this.noteCache.get(notePath);
    return note ? note.backlinks : [];
  }

  getForwardLinks(notePath: string): string[] {
    const linkSet = this.linkGraph.get(notePath);
    return linkSet ? Array.from(linkSet) : [];
  }

  analyzeLinkNetwork(): LinkAnalysis {
    const totalLinks = Array.from(this.linkGraph.values())
      .reduce((sum, links) => sum + links.size, 0);
    
    // Find broken links
    const brokenLinks: string[] = [];
    for (const note of this.noteCache.values()) {
      for (const link of note.links) {
        if (!this.resolveLink(link)) {
          brokenLinks.push(`${note.path}: ${link}`);
        }
      }
    }
    
    // Find orphaned notes
    const orphanedNotes: string[] = [];
    for (const note of this.noteCache.values()) {
      const hasBacklinks = this.backlinksGraph.get(note.path)?.size || 0;
      const hasForwardLinks = this.linkGraph.get(note.path)?.size || 0;
      
      if (hasBacklinks === 0 && hasForwardLinks === 0) {
        orphanedNotes.push(note.path);
      }
    }
    
    // Find central notes (most connected)
    const centralNotes = Array.from(this.noteCache.keys())
      .map(notePath => {
        const backlinks = this.backlinksGraph.get(notePath)?.size || 0;
        const forwardLinks = this.linkGraph.get(notePath)?.size || 0;
        return { note: notePath, connections: backlinks + forwardLinks };
      })
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10);
    
    return {
      totalLinks,
      brokenLinks,
      orphanedNotes,
      centralNotes,
      clusters: [], // TODO: Implement clustering algorithm
    };
  }

  getVaultStatistics() {
    const notes = Array.from(this.noteCache.values());
    const totalWords = notes.reduce((sum, note) => sum + note.wordCount, 0);
    const allTags = new Set<string>();
    
    notes.forEach(note => {
      note.tags.forEach(tag => allTags.add(tag));
    });
    
    return {
      totalNotes: notes.length,
      totalWords,
      averageWordsPerNote: Math.round(totalWords / notes.length),
      totalTags: allTags.size,
      mostUsedTags: this.getMostUsedTags(5),
      recentNotes: notes
        .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
        .slice(0, 10)
        .map(note => ({ path: note.path, lastModified: note.lastModified })),
    };
  }

  private getMostUsedTags(limit: number): Array<{ tag: string; count: number }> {
    const tagCounts = new Map<string, number>();
    
    for (const note of this.noteCache.values()) {
      for (const tag of note.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async dispose(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
    }
  }
}
