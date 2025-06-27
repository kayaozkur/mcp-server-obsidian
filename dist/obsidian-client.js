"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObsidianClient = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const gray_matter_1 = __importDefault(require("gray-matter"));
const fuse_js_1 = __importDefault(require("fuse.js"));
const chokidar_1 = __importDefault(require("chokidar"));
const logger_js_1 = require("./logger.js");
class ObsidianClient {
    vaultPath;
    allowedDirectories;
    noteCache = new Map();
    linkGraph = new Map();
    backlinksGraph = new Map();
    watcher;
    searchIndex;
    constructor(vaultPath) {
        this.vaultPath = this.expandHome(vaultPath);
        this.allowedDirectories = [this.normalizePath(path.resolve(this.vaultPath))];
        this.initializeWatcher();
    }
    // Security utilities
    normalizePath(p) {
        return path.normalize(p).toLowerCase();
    }
    expandHome(filepath) {
        if (filepath.startsWith('~/') || filepath === '~') {
            return path.join(os.homedir(), filepath.slice(1));
        }
        return filepath;
    }
    async validatePath(requestedPath) {
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
        const isAllowed = this.allowedDirectories.some((dir) => normalizedRequested.startsWith(dir));
        if (!isAllowed) {
            throw new Error(`Access denied - path outside vault: ${absolute} not in ${this.allowedDirectories.join(', ')}`);
        }
        return absolute;
    }
    // File watching for real-time updates
    initializeWatcher() {
        this.watcher = chokidar_1.default.watch(this.vaultPath, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true,
        });
        this.watcher
            .on('add', (filePath) => this.handleFileChange(filePath, 'add'))
            .on('change', (filePath) => this.handleFileChange(filePath, 'change'))
            .on('unlink', (filePath) => this.handleFileChange(filePath, 'delete'));
    }
    async handleFileChange(filePath, event) {
        if (!filePath.endsWith('.md'))
            return;
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
        }
        catch (error) {
            logger_js_1.logger.warn(`Failed to handle file change: ${filePath}`, error);
        }
    }
    // Markdown parsing and link extraction
    async parseMarkdown(content) {
        const links = [];
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
    extractTags(content, frontmatter) {
        const tags = new Set();
        // Tags from frontmatter
        if (frontmatter.tags) {
            const fmTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];
            fmTags.forEach((tag) => tags.add(tag.toString()));
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
    async initializeVault() {
        logger_js_1.logger.info(`Initializing vault at: ${this.vaultPath}`);
        try {
            const stats = await fs.stat(this.vaultPath);
            if (!stats.isDirectory()) {
                throw new Error(`Vault path is not a directory: ${this.vaultPath}`);
            }
        }
        catch (error) {
            throw new Error(`Cannot access vault directory: ${this.vaultPath}`);
        }
        await this.scanVault();
        this.buildLinkGraphs();
        this.rebuildSearchIndex();
        logger_js_1.logger.info(`Vault initialized with ${this.noteCache.size} notes`);
    }
    async scanVault() {
        const markdownFiles = await this.findMarkdownFiles(this.vaultPath);
        for (const filePath of markdownFiles) {
            try {
                const relativePath = path.relative(this.vaultPath, filePath);
                await this.updateCacheEntry(relativePath);
            }
            catch (error) {
                logger_js_1.logger.warn(`Failed to process file: ${filePath}`, error);
            }
        }
    }
    async findMarkdownFiles(dir) {
        const files = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.name.startsWith('.'))
                continue; // Skip hidden files
            if (entry.isDirectory()) {
                const subFiles = await this.findMarkdownFiles(fullPath);
                files.push(...subFiles);
            }
            else if (entry.isFile() && entry.name.endsWith('.md')) {
                files.push(fullPath);
            }
        }
        return files;
    }
    async updateCacheEntry(relativePath) {
        const fullPath = path.join(this.vaultPath, relativePath);
        try {
            const stats = await fs.stat(fullPath);
            const content = await fs.readFile(fullPath, 'utf-8');
            const { data: frontmatter, content: bodyContent } = (0, gray_matter_1.default)(content);
            const { links } = await this.parseMarkdown(bodyContent);
            const tags = this.extractTags(bodyContent, frontmatter);
            const note = {
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
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to update cache for ${relativePath}:`, error);
        }
    }
    removeFromCache(relativePath) {
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
    buildLinkGraphs() {
        this.linkGraph.clear();
        this.backlinksGraph.clear();
        // Initialize empty sets for all notes
        for (const note of this.noteCache.values()) {
            this.linkGraph.set(note.path, new Set());
            this.backlinksGraph.set(note.path, new Set());
        }
        // Build forward links and backlinks
        for (const note of this.noteCache.values()) {
            const noteLinks = this.linkGraph.get(note.path);
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
    resolveLink(link) {
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
    rebuildSearchIndex() {
        const notes = Array.from(this.noteCache.values());
        this.searchIndex = new fuse_js_1.default(notes, {
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
    async createNote(notePath, content, frontmatter) {
        const validPath = await this.validatePath(notePath);
        // Ensure .md extension
        if (!validPath.endsWith('.md')) {
            notePath += '.md';
        }
        // Create frontmatter if provided
        let fileContent = content;
        if (frontmatter && Object.keys(frontmatter).length > 0) {
            fileContent = gray_matter_1.default.stringify(content, frontmatter);
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
        logger_js_1.logger.info(`Created note: ${relativePath}`);
        return note;
    }
    async updateNote(notePath, content, frontmatter) {
        const validPath = await this.validatePath(notePath);
        const relativePath = path.relative(this.vaultPath, validPath);
        const existingNote = this.noteCache.get(relativePath);
        if (!existingNote) {
            throw new Error(`Note not found: ${relativePath}`);
        }
        let newContent = content !== undefined ? content : existingNote.content;
        let newFrontmatter = frontmatter !== undefined ? frontmatter : existingNote.frontmatter;
        const fileContent = gray_matter_1.default.stringify(newContent, newFrontmatter);
        await fs.writeFile(validPath, fileContent, 'utf-8');
        // Update cache
        await this.updateCacheEntry(relativePath);
        this.buildLinkGraphs();
        this.rebuildSearchIndex();
        const updatedNote = this.noteCache.get(relativePath);
        logger_js_1.logger.info(`Updated note: ${relativePath}`);
        return updatedNote;
    }
    async deleteNote(notePath) {
        const validPath = await this.validatePath(notePath);
        const relativePath = path.relative(this.vaultPath, validPath);
        if (!this.noteCache.has(relativePath)) {
            throw new Error(`Note not found: ${relativePath}`);
        }
        await fs.remove(validPath);
        this.removeFromCache(relativePath);
        this.rebuildSearchIndex();
        logger_js_1.logger.info(`Deleted note: ${relativePath}`);
    }
    async readNote(notePath) {
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
    async searchNotes(query, options) {
        if (!this.searchIndex) {
            this.rebuildSearchIndex();
        }
        const searchResults = this.searchIndex.search(query);
        let results = searchResults.map(result => ({
            note: result.item,
            score: result.score || 0,
            matches: result.matches || [],
        }));
        // Filter by tags if specified
        if (options?.tags && options.tags.length > 0) {
            results = results.filter(result => options.tags.some(tag => result.note.tags.includes(tag)));
        }
        // Limit results
        if (options?.limit) {
            results = results.slice(0, options.limit);
        }
        return results;
    }
    getBacklinks(notePath) {
        const note = this.noteCache.get(notePath);
        return note ? note.backlinks : [];
    }
    getForwardLinks(notePath) {
        const linkSet = this.linkGraph.get(notePath);
        return linkSet ? Array.from(linkSet) : [];
    }
    analyzeLinkNetwork() {
        const totalLinks = Array.from(this.linkGraph.values())
            .reduce((sum, links) => sum + links.size, 0);
        // Find broken links
        const brokenLinks = [];
        for (const note of this.noteCache.values()) {
            for (const link of note.links) {
                if (!this.resolveLink(link)) {
                    brokenLinks.push(`${note.path}: ${link}`);
                }
            }
        }
        // Find orphaned notes
        const orphanedNotes = [];
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
        const allTags = new Set();
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
    getMostUsedTags(limit) {
        const tagCounts = new Map();
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
    async dispose() {
        if (this.watcher) {
            await this.watcher.close();
        }
    }
}
exports.ObsidianClient = ObsidianClient;
//# sourceMappingURL=obsidian-client.js.map