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
    centralNotes: Array<{
        note: string;
        connections: number;
    }>;
    clusters: Array<{
        notes: string[];
        theme?: string;
    }>;
    mermaidDiagram?: string;
}
export declare class ObsidianClient {
    private vaultPath;
    private allowedDirectories;
    private noteCache;
    private linkGraph;
    private backlinksGraph;
    private watcher?;
    private searchIndex?;
    constructor(vaultPath: string);
    private normalizePath;
    private expandHome;
    private validatePath;
    private initializeWatcher;
    private handleFileChange;
    private parseMarkdown;
    private extractTags;
    initializeVault(): Promise<void>;
    private scanVault;
    private findMarkdownFiles;
    private updateCacheEntry;
    private removeFromCache;
    private buildLinkGraphs;
    private resolveLink;
    private rebuildSearchIndex;
    createNote(notePath: string, content: string, frontmatter?: any): Promise<VaultNote>;
    updateNote(notePath: string, content?: string, frontmatter?: any): Promise<VaultNote>;
    deleteNote(notePath: string): Promise<void>;
    readNote(notePath: string): Promise<VaultNote>;
    searchNotes(query: string, options?: {
        includeContent?: boolean;
        tags?: string[];
        limit?: number;
    }): Promise<SearchResult[]>;
    getBacklinks(notePath: string): string[];
    getForwardLinks(notePath: string): string[];
    analyzeLinkNetwork(): LinkAnalysis;
    getVaultStatistics(): {
        totalNotes: number;
        totalWords: number;
        averageWordsPerNote: number;
        totalTags: number;
        mostUsedTags: {
            tag: string;
            count: number;
        }[];
        recentNotes: {
            path: string;
            lastModified: Date;
        }[];
    };
    private getMostUsedTags;
    dispose(): Promise<void>;
}
//# sourceMappingURL=obsidian-client.d.ts.map