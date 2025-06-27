#!/usr/bin/env node
/**
 * Enhanced Obsidian MCP Server
 * Provides comprehensive knowledge management capabilities for Obsidian vaults
 *
 * Features:
 * - Complete CRUD operations for notes
 * - Advanced search with full-text and semantic capabilities
 * - Knowledge graph operations (backlinks, forward links, network analysis)
 * - AI-powered content intelligence
 * - Real-time vault watching
 * - Integration with Lepion ecosystem
 */
export declare class EnhancedObsidianMCPServer {
    private server;
    private obsidianClient;
    private enableAdvancedFeatures;
    constructor(vaultPath: string);
    private getAvailableTools;
    private setupHandlers;
    private generateBasicSummary;
    private extractBasicConcepts;
    private suggestBasicConnections;
    private generateMermaidDiagram;
    start(): Promise<void>;
    dispose(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map