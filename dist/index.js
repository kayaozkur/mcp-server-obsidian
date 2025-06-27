#!/usr/bin/env node
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedObsidianMCPServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const obsidian_client_js_1 = require("./obsidian-client.js");
const logger_js_1 = require("./logger.js");
const zod_1 = require("zod");
const path = __importStar(require("path"));
// Command line argument parsing
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: mcp-server-obsidian-enhanced <vault-directory>');
    process.exit(1);
}
// Tool schemas for Phase 1: Foundation (Write Operations & Advanced Search)
const CreateNoteSchema = zod_1.z.object({
    path: zod_1.z.string().describe('Path for the new note (relative to vault root)'),
    content: zod_1.z.string().describe('Content of the note'),
    frontmatter: zod_1.z.record(zod_1.z.any()).optional().describe('YAML frontmatter properties'),
    template: zod_1.z.string().optional().describe('Template to use for note creation'),
});
const UpdateNoteSchema = zod_1.z.object({
    path: zod_1.z.string().describe('Path to the note to update'),
    content: zod_1.z.string().optional().describe('New content for the note'),
    frontmatter: zod_1.z.record(zod_1.z.any()).optional().describe('Updated frontmatter properties'),
    operation: zod_1.z.enum(['replace', 'append', 'prepend']).optional().default('replace').describe('How to apply content changes'),
});
const DeleteNoteSchema = zod_1.z.object({
    path: zod_1.z.string().describe('Path to the note to delete'),
    confirm: zod_1.z.boolean().optional().default(false).describe('Confirmation flag for deletion'),
});
const FullTextSearchSchema = zod_1.z.object({
    query: zod_1.z.string().describe('Search query'),
    includeContent: zod_1.z.boolean().optional().default(false).describe('Include full content in results'),
    tags: zod_1.z.array(zod_1.z.string()).optional().describe('Filter by specific tags'),
    limit: zod_1.z.number().optional().default(10).describe('Maximum number of results'),
    dateRange: zod_1.z.object({
        start: zod_1.z.string().optional().describe('Start date (ISO string)'),
        end: zod_1.z.string().optional().describe('End date (ISO string)'),
    }).optional().describe('Filter by date range'),
});
// Phase 2: Knowledge Graph Operations
const GetBacklinksSchema = zod_1.z.object({
    notePath: zod_1.z.string().describe('Path to the note'),
    includeContent: zod_1.z.boolean().optional().default(false).describe('Include content of backlinked notes'),
});
const GetForwardLinksSchema = zod_1.z.object({
    notePath: zod_1.z.string().describe('Path to the note'),
    includeContent: zod_1.z.boolean().optional().default(false).describe('Include content of linked notes'),
});
const AnalyzeLinkNetworkSchema = zod_1.z.object({
    detailed: zod_1.z.boolean().optional().default(false).describe('Include detailed network analysis'),
    exportFormat: zod_1.z.enum(['json', 'mermaid', 'graphviz']).optional().describe('Export format for visualization'),
});
const FindOrphanedNotesSchema = zod_1.z.object({
    includeRecent: zod_1.z.boolean().optional().default(true).describe('Include recently created notes'),
    dayThreshold: zod_1.z.number().optional().default(7).describe('Days to consider as recent'),
});
// Phase 3: AI Intelligence Features
const SummarizeNoteSchema = zod_1.z.object({
    notePath: zod_1.z.string().describe('Path to the note to summarize'),
    maxLength: zod_1.z.number().optional().default(200).describe('Maximum summary length in words'),
    style: zod_1.z.enum(['brief', 'detailed', 'bullet-points']).optional().default('brief').describe('Summary style'),
});
const ExtractKeyConceptsSchema = zod_1.z.object({
    notePath: zod_1.z.string().describe('Path to the note'),
    maxConcepts: zod_1.z.number().optional().default(10).describe('Maximum number of concepts to extract'),
    includeDefinitions: zod_1.z.boolean().optional().default(false).describe('Include concept definitions'),
});
const SuggestConnectionsSchema = zod_1.z.object({
    notePath: zod_1.z.string().describe('Path to the note'),
    maxSuggestions: zod_1.z.number().optional().default(5).describe('Maximum number of suggestions'),
    threshold: zod_1.z.number().optional().default(0.7).describe('Similarity threshold (0-1)'),
});
// Phase 4: Advanced Operations
const BulkOperationsSchema = zod_1.z.object({
    operation: zod_1.z.enum(['tag', 'move', 'rename', 'delete']).describe('Bulk operation type'),
    notePattern: zod_1.z.string().describe('Pattern to match notes (regex or glob)'),
    parameters: zod_1.z.record(zod_1.z.any()).describe('Operation-specific parameters'),
    dryRun: zod_1.z.boolean().optional().default(true).describe('Preview changes without applying'),
});
const ManageTagsSchema = zod_1.z.object({
    operation: zod_1.z.enum(['add', 'remove', 'rename', 'list']).describe('Tag operation'),
    notePath: zod_1.z.string().optional().describe('Path to specific note (for add/remove)'),
    oldTag: zod_1.z.string().optional().describe('Old tag name (for rename)'),
    newTag: zod_1.z.string().optional().describe('New tag name (for add/rename)'),
    tag: zod_1.z.string().optional().describe('Tag to remove'),
});
const CreateTemplateSchema = zod_1.z.object({
    templateName: zod_1.z.string().describe('Name of the template'),
    content: zod_1.z.string().describe('Template content with placeholders'),
    variables: zod_1.z.array(zod_1.z.string()).optional().describe('List of variable names in template'),
});
const ClusterNotesSchema = zod_1.z.object({
    algorithm: zod_1.z.enum(['tags', 'content', 'links']).optional().default('tags').describe('Clustering algorithm'),
    maxClusters: zod_1.z.number().optional().default(10).describe('Maximum number of clusters'),
    minClusterSize: zod_1.z.number().optional().default(2).describe('Minimum notes per cluster'),
});
class EnhancedObsidianMCPServer {
    server;
    obsidianClient;
    enableAdvancedFeatures;
    constructor(vaultPath) {
        // Check if advanced AI features are enabled
        this.enableAdvancedFeatures = process.env.OBSIDIAN_ENABLE_AI_FEATURES === 'true';
        this.server = new index_js_1.Server({
            name: 'mcp-obsidian-enhanced',
            version: '0.1.0',
        }, {
            capabilities: {
                resources: {},
                tools: {},
            },
        });
        this.obsidianClient = new obsidian_client_js_1.ObsidianClient(vaultPath);
        this.setupHandlers();
        logger_js_1.logger.info(`Enhanced Obsidian MCP Server started (AI Features: ${this.enableAdvancedFeatures ? 'enabled' : 'disabled'})`);
    }
    getAvailableTools() {
        const tools = [
            // Phase 1: Write Operations
            {
                name: 'obsidian_create_note',
                description: 'Create a new note in the vault with optional frontmatter and template support',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string' },
                        content: { type: 'string' },
                        frontmatter: { type: 'object' },
                        template: { type: 'string' },
                    },
                    required: ['path', 'content'],
                },
            },
            {
                name: 'obsidian_update_note',
                description: 'Update an existing note with new content or frontmatter',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string' },
                        content: { type: 'string' },
                        frontmatter: { type: 'object' },
                        operation: { type: 'string', enum: ['replace', 'append', 'prepend'] },
                    },
                    required: ['path'],
                },
            },
            {
                name: 'obsidian_delete_note',
                description: 'Delete a note from the vault',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string' },
                        confirm: { type: 'boolean' },
                    },
                    required: ['path'],
                },
            },
            {
                name: 'obsidian_read_note',
                description: 'Read a note with full metadata',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string' },
                    },
                    required: ['path'],
                },
            },
            // Enhanced Search
            {
                name: 'obsidian_full_text_search',
                description: 'Advanced search through note content with filtering options',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string' },
                        includeContent: { type: 'boolean' },
                        tags: { type: 'array', items: { type: 'string' } },
                        limit: { type: 'number' },
                        dateRange: {
                            type: 'object',
                            properties: {
                                start: { type: 'string' },
                                end: { type: 'string' },
                            },
                        },
                    },
                    required: ['query'],
                },
            },
            // Phase 2: Knowledge Graph
            {
                name: 'obsidian_get_backlinks',
                description: 'Get all notes that link to the specified note',
                inputSchema: {
                    type: 'object',
                    properties: {
                        notePath: { type: 'string' },
                        includeContent: { type: 'boolean' },
                    },
                    required: ['notePath'],
                },
            },
            {
                name: 'obsidian_get_forward_links',
                description: 'Get all notes that the specified note links to',
                inputSchema: {
                    type: 'object',
                    properties: {
                        notePath: { type: 'string' },
                        includeContent: { type: 'boolean' },
                    },
                    required: ['notePath'],
                },
            },
            {
                name: 'obsidian_analyze_link_network',
                description: 'Analyze the link network structure of the vault',
                inputSchema: {
                    type: 'object',
                    properties: {
                        detailed: { type: 'boolean' },
                        exportFormat: { type: 'string', enum: ['json', 'mermaid', 'graphviz'] },
                    },
                },
            },
            {
                name: 'obsidian_find_orphaned_notes',
                description: 'Find notes with no incoming or outgoing links',
                inputSchema: {
                    type: 'object',
                    properties: {
                        includeRecent: { type: 'boolean' },
                        dayThreshold: { type: 'number' },
                    },
                },
            },
            // Vault Statistics
            {
                name: 'obsidian_vault_statistics',
                description: 'Get comprehensive statistics about the vault',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
            // Legacy compatibility (smithery-ai/mcp-obsidian)
            {
                name: 'search_notes',
                description: 'Search for notes by name (legacy compatibility)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string' },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'read_notes',
                description: 'Read multiple notes (legacy compatibility)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        paths: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['paths'],
                },
            },
            // Phase 4: Advanced Operations
            {
                name: 'obsidian_bulk_operations',
                description: 'Perform bulk operations on multiple notes',
                inputSchema: {
                    type: 'object',
                    properties: {
                        operation: { type: 'string', enum: ['tag', 'move', 'rename', 'delete'] },
                        notePattern: { type: 'string' },
                        parameters: { type: 'object' },
                        dryRun: { type: 'boolean' },
                    },
                    required: ['operation', 'notePattern', 'parameters'],
                },
            },
            {
                name: 'obsidian_manage_tags',
                description: 'Add, remove, or rename tags across notes',
                inputSchema: {
                    type: 'object',
                    properties: {
                        operation: { type: 'string', enum: ['add', 'remove', 'rename', 'list'] },
                        notePath: { type: 'string' },
                        oldTag: { type: 'string' },
                        newTag: { type: 'string' },
                        tag: { type: 'string' },
                    },
                    required: ['operation'],
                },
            },
            {
                name: 'obsidian_create_template',
                description: 'Create or manage note templates',
                inputSchema: {
                    type: 'object',
                    properties: {
                        templateName: { type: 'string' },
                        content: { type: 'string' },
                        variables: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['templateName', 'content'],
                },
            },
            {
                name: 'obsidian_cluster_notes',
                description: 'Cluster notes based on various algorithms',
                inputSchema: {
                    type: 'object',
                    properties: {
                        algorithm: { type: 'string', enum: ['tags', 'content', 'links'] },
                        maxClusters: { type: 'number' },
                        minClusterSize: { type: 'number' },
                    },
                },
            },
        ];
        // Add AI-powered tools if enabled
        if (this.enableAdvancedFeatures) {
            tools.push({
                name: 'obsidian_summarize_note',
                description: 'Generate an AI-powered summary of a note',
                inputSchema: {
                    type: 'object',
                    properties: {
                        notePath: { type: 'string' },
                        maxLength: { type: 'number' },
                        style: { type: 'string', enum: ['brief', 'detailed', 'bullet-points'] },
                    },
                    required: ['notePath'],
                },
            }, {
                name: 'obsidian_extract_key_concepts',
                description: 'Extract key concepts and topics from a note',
                inputSchema: {
                    type: 'object',
                    properties: {
                        notePath: { type: 'string' },
                        maxConcepts: { type: 'number' },
                        includeDefinitions: { type: 'boolean' },
                    },
                    required: ['notePath'],
                },
            }, {
                name: 'obsidian_suggest_connections',
                description: 'Suggest potential connections to other notes based on content similarity',
                inputSchema: {
                    type: 'object',
                    properties: {
                        notePath: { type: 'string' },
                        maxSuggestions: { type: 'number' },
                        threshold: { type: 'number' },
                    },
                    required: ['notePath'],
                },
            });
        }
        return tools;
    }
    setupHandlers() {
        // Handle tool listing
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools: this.getAvailableTools(),
        }));
        // Handle resource listing (notes as resources)
        this.server.setRequestHandler(types_js_1.ListResourcesRequestSchema, async () => {
            try {
                const stats = this.obsidianClient.getVaultStatistics();
                const resources = [
                    {
                        uri: 'obsidian://vault/statistics',
                        name: 'Vault Statistics',
                        description: `Vault with ${stats.totalNotes} notes and ${stats.totalWords} words`,
                        mimeType: 'application/json',
                    },
                ];
                // Add recent notes as resources
                for (const recentNote of stats.recentNotes.slice(0, 5)) {
                    resources.push({
                        uri: `obsidian://note/${encodeURIComponent(recentNote.path)}`,
                        name: path.basename(recentNote.path, '.md'),
                        description: `Last modified: ${recentNote.lastModified.toISOString()}`,
                        mimeType: 'text/markdown',
                    });
                }
                return { resources };
            }
            catch (error) {
                logger_js_1.logger.error('Failed to list resources', error);
                return { resources: [] };
            }
        });
        // Handle resource reading
        this.server.setRequestHandler(types_js_1.ReadResourceRequestSchema, async (request) => {
            const uri = request.params.uri;
            if (uri === 'obsidian://vault/statistics') {
                const stats = this.obsidianClient.getVaultStatistics();
                return {
                    contents: [
                        {
                            uri,
                            mimeType: 'application/json',
                            text: JSON.stringify(stats, null, 2),
                        },
                    ],
                };
            }
            const noteMatch = uri.match(/^obsidian:\/\/note\/(.+)$/);
            if (noteMatch) {
                try {
                    const notePath = decodeURIComponent(noteMatch[1]);
                    const note = await this.obsidianClient.readNote(notePath);
                    return {
                        contents: [
                            {
                                uri,
                                mimeType: 'text/markdown',
                                text: note.content,
                            },
                        ],
                    };
                }
                catch (error) {
                    throw new Error(`Failed to read note: ${error}`);
                }
            }
            throw new Error(`Unknown resource URI: ${uri}`);
        });
        // Handle tool calls
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'obsidian_create_note': {
                        const { path: notePath, content, frontmatter, template } = CreateNoteSchema.parse(args);
                        let finalContent = content;
                        // Apply template if specified
                        if (template) {
                            // TODO: Implement template engine
                            finalContent = `${content}\n\n<!-- Created from template: ${template} -->`;
                        }
                        const note = await this.obsidianClient.createNote(notePath, finalContent, frontmatter);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        message: `Created note: ${note.path}`,
                                        note: {
                                            path: note.path,
                                            name: note.name,
                                            wordCount: note.wordCount,
                                            tags: note.tags,
                                            created: note.created,
                                        },
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                    case 'obsidian_update_note': {
                        const { path: notePath, content, frontmatter, operation } = UpdateNoteSchema.parse(args);
                        let finalContent = content;
                        if (operation === 'append' || operation === 'prepend') {
                            const existingNote = await this.obsidianClient.readNote(notePath);
                            if (operation === 'append') {
                                finalContent = `${existingNote.content}\n\n${content}`;
                            }
                            else {
                                finalContent = `${content}\n\n${existingNote.content}`;
                            }
                        }
                        const note = await this.obsidianClient.updateNote(notePath, finalContent, frontmatter);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        message: `Updated note: ${note.path}`,
                                        note: {
                                            path: note.path,
                                            name: note.name,
                                            wordCount: note.wordCount,
                                            lastModified: note.lastModified,
                                        },
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                    case 'obsidian_delete_note': {
                        const { path: notePath, confirm } = DeleteNoteSchema.parse(args);
                        if (!confirm) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            warning: 'Deletion requires confirmation. Set confirm: true to proceed.',
                                            notePath,
                                        }, null, 2),
                                    },
                                ],
                            };
                        }
                        await this.obsidianClient.deleteNote(notePath);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        message: `Deleted note: ${notePath}`,
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                    case 'obsidian_read_note': {
                        const { path: notePath } = zod_1.z.object({ path: zod_1.z.string() }).parse(args);
                        const note = await this.obsidianClient.readNote(notePath);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(note, null, 2),
                                },
                            ],
                        };
                    }
                    case 'obsidian_full_text_search': {
                        const { query, includeContent, tags, limit } = FullTextSearchSchema.parse(args);
                        const results = await this.obsidianClient.searchNotes(query, {
                            includeContent,
                            tags,
                            limit,
                        });
                        // TODO: Implement date range filtering
                        let filteredResults = results;
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        query,
                                        totalResults: filteredResults.length,
                                        results: filteredResults.map(result => ({
                                            path: result.note.path,
                                            name: result.note.name,
                                            score: result.score,
                                            tags: result.note.tags,
                                            wordCount: result.note.wordCount,
                                            lastModified: result.note.lastModified,
                                            content: includeContent ? result.note.content : undefined,
                                            matches: result.matches,
                                        })),
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                    case 'obsidian_get_backlinks': {
                        const { notePath, includeContent } = GetBacklinksSchema.parse(args);
                        const backlinks = this.obsidianClient.getBacklinks(notePath);
                        const backlinkData = await Promise.all(backlinks.map(async (linkPath) => {
                            const note = await this.obsidianClient.readNote(linkPath);
                            return {
                                path: note.path,
                                name: note.name,
                                content: includeContent ? note.content : undefined,
                                tags: note.tags,
                                lastModified: note.lastModified,
                            };
                        }));
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        notePath,
                                        totalBacklinks: backlinks.length,
                                        backlinks: backlinkData,
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                    case 'obsidian_get_forward_links': {
                        const { notePath, includeContent } = GetForwardLinksSchema.parse(args);
                        const forwardLinks = this.obsidianClient.getForwardLinks(notePath);
                        const linkData = await Promise.all(forwardLinks.map(async (linkPath) => {
                            try {
                                const note = await this.obsidianClient.readNote(linkPath);
                                return {
                                    path: note.path,
                                    name: note.name,
                                    content: includeContent ? note.content : undefined,
                                    tags: note.tags,
                                    lastModified: note.lastModified,
                                };
                            }
                            catch (error) {
                                return {
                                    path: linkPath,
                                    name: path.basename(linkPath, '.md'),
                                    error: 'Note not found (broken link)',
                                };
                            }
                        }));
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        notePath,
                                        totalLinks: forwardLinks.length,
                                        links: linkData,
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                    case 'obsidian_analyze_link_network': {
                        const { exportFormat } = AnalyzeLinkNetworkSchema.parse(args);
                        const analysis = this.obsidianClient.analyzeLinkNetwork();
                        let result = analysis;
                        // TODO: Implement export formats (mermaid, graphviz)
                        if (exportFormat === 'mermaid') {
                            // Generate mermaid diagram
                            const mermaidDiagram = this.generateMermaidDiagram(analysis);
                            result = { ...analysis, mermaidDiagram };
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(result, null, 2),
                                },
                            ],
                        };
                    }
                    case 'obsidian_find_orphaned_notes': {
                        const { includeRecent, dayThreshold } = FindOrphanedNotesSchema.parse(args);
                        const analysis = this.obsidianClient.analyzeLinkNetwork();
                        let orphanedNotes = analysis.orphanedNotes;
                        if (!includeRecent && dayThreshold) {
                            // Filter out recently created notes
                            const cutoffDate = new Date();
                            cutoffDate.setDate(cutoffDate.getDate() - dayThreshold);
                            // TODO: Implement date filtering
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        totalOrphaned: orphanedNotes.length,
                                        orphanedNotes,
                                        includeRecent,
                                        dayThreshold,
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                    case 'obsidian_vault_statistics': {
                        const stats = this.obsidianClient.getVaultStatistics();
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(stats, null, 2),
                                },
                            ],
                        };
                    }
                    // AI-powered features (when enabled)
                    case 'obsidian_summarize_note': {
                        if (!this.enableAdvancedFeatures) {
                            throw new Error('AI features not enabled. Set OBSIDIAN_ENABLE_AI_FEATURES=true');
                        }
                        const { notePath, maxLength, style } = SummarizeNoteSchema.parse(args);
                        const note = await this.obsidianClient.readNote(notePath);
                        // TODO: Implement AI-powered summarization
                        const summary = this.generateBasicSummary(note.content, maxLength || 200);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        notePath,
                                        style,
                                        summary,
                                        originalWordCount: note.wordCount,
                                        summaryWordCount: summary.split(/\s+/).length,
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                    case 'obsidian_extract_key_concepts': {
                        if (!this.enableAdvancedFeatures) {
                            throw new Error('AI features not enabled. Set OBSIDIAN_ENABLE_AI_FEATURES=true');
                        }
                        const { notePath, maxConcepts, includeDefinitions } = ExtractKeyConceptsSchema.parse(args);
                        const note = await this.obsidianClient.readNote(notePath);
                        // TODO: Implement AI-powered concept extraction
                        const concepts = this.extractBasicConcepts(note.content, maxConcepts || 10);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        notePath,
                                        concepts,
                                        includeDefinitions,
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                    case 'obsidian_suggest_connections': {
                        if (!this.enableAdvancedFeatures) {
                            throw new Error('AI features not enabled. Set OBSIDIAN_ENABLE_AI_FEATURES=true');
                        }
                        const { notePath, maxSuggestions, threshold } = SuggestConnectionsSchema.parse(args);
                        // TODO: Implement AI-powered connection suggestions
                        const suggestions = await this.suggestBasicConnections(notePath, maxSuggestions || 5);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        notePath,
                                        threshold,
                                        suggestions,
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                    // Legacy compatibility tools
                    case 'search_notes': {
                        const { query } = zod_1.z.object({ query: zod_1.z.string() }).parse(args);
                        const results = await this.obsidianClient.searchNotes(query, { limit: 200 });
                        const paths = results.map(result => result.note.path);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: paths.join('\n'),
                                },
                            ],
                        };
                    }
                    case 'read_notes': {
                        const { paths } = zod_1.z.object({ paths: zod_1.z.array(zod_1.z.string()) }).parse(args);
                        const results = await Promise.all(paths.map(async (notePath) => {
                            try {
                                const note = await this.obsidianClient.readNote(notePath);
                                return `${notePath}:\n${note.content}\n`;
                            }
                            catch (error) {
                                return `${notePath}: Error - ${error}\n`;
                            }
                        }));
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: results.join('\n---\n'),
                                },
                            ],
                        };
                    }
                    // Phase 4: Advanced Operations
                    case 'obsidian_bulk_operations': {
                        const { operation, notePattern, parameters, dryRun } = BulkOperationsSchema.parse(args);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        operation,
                                        notePattern,
                                        dryRun,
                                        message: 'Bulk operations feature coming soon',
                                        parameters,
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                    case 'obsidian_manage_tags': {
                        const params = ManageTagsSchema.parse(args);
                        if (params.operation === 'list') {
                            const allNotes = Array.from(this.obsidianClient['noteCache'].values());
                            const tagFrequency = new Map();
                            for (const note of allNotes) {
                                for (const noteTag of note.tags) {
                                    tagFrequency.set(noteTag, (tagFrequency.get(noteTag) || 0) + 1);
                                }
                            }
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            operation: 'list',
                                            totalTags: tagFrequency.size,
                                            tags: Array.from(tagFrequency.entries())
                                                .map(([tag, count]) => ({ tag, count }))
                                                .sort((a, b) => b.count - a.count),
                                        }, null, 2),
                                    },
                                ],
                            };
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        operation: params.operation,
                                        message: 'Tag management feature coming soon',
                                        params,
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                    case 'obsidian_create_template': {
                        const { templateName, content, variables } = CreateTemplateSchema.parse(args);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        templateName,
                                        content,
                                        variables: variables || [],
                                        created: new Date().toISOString(),
                                        message: 'Template system coming soon',
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                    case 'obsidian_cluster_notes': {
                        const { algorithm, maxClusters, minClusterSize } = ClusterNotesSchema.parse(args);
                        // Basic tag-based clustering implementation
                        const allNotes = Array.from(this.obsidianClient['noteCache'].values());
                        const clusters = [];
                        if (algorithm === 'tags') {
                            const tagGroups = new Map();
                            for (const note of allNotes) {
                                for (const tag of note.tags) {
                                    if (!tagGroups.has(tag)) {
                                        tagGroups.set(tag, []);
                                    }
                                    tagGroups.get(tag).push(note);
                                }
                            }
                            for (const [tag, notes] of tagGroups) {
                                if (notes.length >= (minClusterSize || 2) && clusters.length < (maxClusters || 10)) {
                                    clusters.push({
                                        id: `tag-${tag}`,
                                        name: `Tag: ${tag}`,
                                        algorithm: 'tags',
                                        size: notes.length,
                                        notes: notes.map(n => ({
                                            path: n.path,
                                            name: n.name,
                                            tags: n.tags,
                                        })),
                                        metadata: { primaryTag: tag },
                                    });
                                }
                            }
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        algorithm,
                                        totalClusters: clusters.length,
                                        clusters: clusters.sort((a, b) => b.size - a.size),
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                logger_js_1.logger.error(`Tool execution failed: ${name}`, error);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }
    // Utility methods for AI features (basic implementations)
    generateBasicSummary(content, maxLength) {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = content.split(/\s+/);
        if (words.length <= maxLength) {
            return content.trim();
        }
        // Simple extractive summary: take first few sentences that fit within word limit
        let summary = '';
        let wordCount = 0;
        for (const sentence of sentences) {
            const sentenceWords = sentence.split(/\s+/).length;
            if (wordCount + sentenceWords <= maxLength) {
                summary += sentence.trim() + '. ';
                wordCount += sentenceWords;
            }
            else {
                break;
            }
        }
        return summary.trim() || content.split(/\s+/).slice(0, maxLength).join(' ') + '...';
    }
    extractBasicConcepts(content, maxConcepts) {
        // Simple concept extraction based on word frequency
        const words = content.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3);
        const frequency = new Map();
        words.forEach(word => {
            frequency.set(word, (frequency.get(word) || 0) + 1);
        });
        return Array.from(frequency.entries())
            .map(([concept, freq]) => ({ concept, frequency: freq }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, maxConcepts);
    }
    async suggestBasicConnections(notePath, maxSuggestions) {
        const note = await this.obsidianClient.readNote(notePath);
        const allNotes = Array.from(this.obsidianClient['noteCache'].values());
        const suggestions = [];
        // Simple tag-based suggestions
        for (const otherNote of allNotes) {
            if (otherNote.path === note.path)
                continue;
            const commonTags = note.tags.filter(tag => otherNote.tags.includes(tag));
            if (commonTags.length > 0) {
                suggestions.push({
                    note: otherNote.path,
                    reason: `Shares tags: ${commonTags.join(', ')}`,
                    score: commonTags.length / Math.max(note.tags.length, otherNote.tags.length),
                });
            }
        }
        return suggestions
            .sort((a, b) => b.score - a.score)
            .slice(0, maxSuggestions);
    }
    generateMermaidDiagram(analysis) {
        // Basic mermaid graph generation
        let mermaid = 'graph TD\n';
        for (const { note } of analysis.centralNotes.slice(0, 10)) {
            const nodeName = note.replace(/[^a-zA-Z0-9]/g, '_');
            mermaid += `    ${nodeName}["${path.basename(note, '.md')}"]\n`;
        }
        return mermaid;
    }
    async start() {
        // Initialize the vault
        await this.obsidianClient.initializeVault();
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        logger_js_1.logger.info('Enhanced Obsidian MCP server started');
    }
    async dispose() {
        await this.obsidianClient.dispose();
    }
}
exports.EnhancedObsidianMCPServer = EnhancedObsidianMCPServer;
// Start the server
const vaultPath = args[0];
const server = new EnhancedObsidianMCPServer(vaultPath);
// Handle graceful shutdown
process.on('SIGINT', async () => {
    logger_js_1.logger.info('Shutting down server...');
    await server.dispose();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    logger_js_1.logger.info('Shutting down server...');
    await server.dispose();
    process.exit(0);
});
server.start().catch((error) => {
    logger_js_1.logger.error('Failed to start server', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map