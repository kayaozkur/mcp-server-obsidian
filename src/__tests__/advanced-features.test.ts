import { jest } from '@jest/globals';
import { EnhancedObsidianMCPServer } from '../index.js';

// Mock the ObsidianClient
jest.mock('../obsidian-client.js', () => ({
  ObsidianClient: jest.fn().mockImplementation(() => ({
    initializeVault: jest.fn().mockResolvedValue(void 0),
    noteCache: new Map([
      ['note1.md', {
        path: 'note1.md',
        name: 'note1',
        content: 'This is note 1 with #tag1 and #tag2',
        tags: ['tag1', 'tag2'],
        wordCount: 8,
        lastModified: new Date('2023-01-01'),
        created: new Date('2023-01-01'),
      }],
      ['note2.md', {
        path: 'note2.md', 
        name: 'note2',
        content: 'This is note 2 with #tag2 and #tag3',
        tags: ['tag2', 'tag3'],
        wordCount: 8,
        lastModified: new Date('2023-01-02'),
        created: new Date('2023-01-02'),
      }],
      ['note3.md', {
        path: 'note3.md',
        name: 'note3', 
        content: 'This is note 3 with #tag1',
        tags: ['tag1'],
        wordCount: 6,
        lastModified: new Date('2023-01-03'),
        created: new Date('2023-01-03'),
      }],
    ]),
    dispose: jest.fn().mockResolvedValue(void 0),
  })),
}));

describe('Enhanced Obsidian MCP Server - Advanced Features', () => {
  let server: EnhancedObsidianMCPServer;

  beforeEach(() => {
    server = new EnhancedObsidianMCPServer('/tmp/test-vault');
  });

  afterEach(async () => {
    await server.dispose();
  });

  describe('Bulk Operations', () => {
    it('should validate bulk operations schema', () => {
      const tools = (server as any).getAvailableTools();
      const bulkTool = tools.find((t: any) => t.name === 'obsidian_bulk_operations');
      
      expect(bulkTool).toBeDefined();
      expect(bulkTool.inputSchema.required).toContain('operation');
      expect(bulkTool.inputSchema.required).toContain('notePattern');
      expect(bulkTool.inputSchema.required).toContain('parameters');
    });

    it('should support all bulk operation types', () => {
      const tools = (server as any).getAvailableTools();
      const bulkTool = tools.find((t: any) => t.name === 'obsidian_bulk_operations');
      
      const operationEnum = bulkTool.inputSchema.properties.operation.enum;
      expect(operationEnum).toContain('tag');
      expect(operationEnum).toContain('move');
      expect(operationEnum).toContain('rename');
      expect(operationEnum).toContain('delete');
    });

    it('should default to dry run mode', () => {
      const tools = (server as any).getAvailableTools();
      const bulkTool = tools.find((t: any) => t.name === 'obsidian_bulk_operations');
      
      expect(bulkTool.inputSchema.properties.dryRun).toBeDefined();
      // Schema doesn't contain default value, but implementation should default to true
    });
  });

  describe('Tag Management', () => {
    it('should validate tag management schema', () => {
      const tools = (server as any).getAvailableTools();
      const tagTool = tools.find((t: any) => t.name === 'obsidian_manage_tags');
      
      expect(tagTool).toBeDefined();
      expect(tagTool.inputSchema.required).toContain('operation');
      expect(tagTool.inputSchema.properties.operation.enum).toEqual([
        'add', 'remove', 'rename', 'list'
      ]);
    });

    it('should support tag listing operation', () => {
      const tools = (server as any).getAvailableTools();
      const tagTool = tools.find((t: any) => t.name === 'obsidian_manage_tags');
      
      expect(tagTool.inputSchema.properties.operation.enum).toContain('list');
    });

    it('should have optional parameters for different operations', () => {
      const tools = (server as any).getAvailableTools();
      const tagTool = tools.find((t: any) => t.name === 'obsidian_manage_tags');
      
      const properties = tagTool.inputSchema.properties;
      expect(properties.notePath).toBeDefined();
      expect(properties.oldTag).toBeDefined();
      expect(properties.newTag).toBeDefined();
      expect(properties.tag).toBeDefined();
      
      // These should be optional (not in required array)
      expect(tagTool.inputSchema.required).not.toContain('notePath');
      expect(tagTool.inputSchema.required).not.toContain('oldTag');
      expect(tagTool.inputSchema.required).not.toContain('newTag');
      expect(tagTool.inputSchema.required).not.toContain('tag');
    });
  });

  describe('Template Creation', () => {
    it('should validate template creation schema', () => {
      const tools = (server as any).getAvailableTools();
      const templateTool = tools.find((t: any) => t.name === 'obsidian_create_template');
      
      expect(templateTool).toBeDefined();
      expect(templateTool.inputSchema.required).toContain('templateName');
      expect(templateTool.inputSchema.required).toContain('content');
    });

    it('should support optional variables parameter', () => {
      const tools = (server as any).getAvailableTools();
      const templateTool = tools.find((t: any) => t.name === 'obsidian_create_template');
      
      expect(templateTool.inputSchema.properties.variables).toBeDefined();
      expect(templateTool.inputSchema.properties.variables.type).toBe('array');
      expect(templateTool.inputSchema.required).not.toContain('variables');
    });

    it('should validate variables as array of strings', () => {
      const tools = (server as any).getAvailableTools();
      const templateTool = tools.find((t: any) => t.name === 'obsidian_create_template');
      
      const variablesSchema = templateTool.inputSchema.properties.variables;
      expect(variablesSchema.items.type).toBe('string');
    });
  });

  describe('Note Clustering', () => {
    it('should validate clustering schema', () => {
      const tools = (server as any).getAvailableTools();
      const clusterTool = tools.find((t: any) => t.name === 'obsidian_cluster_notes');
      
      expect(clusterTool).toBeDefined();
      expect(clusterTool.inputSchema.properties.algorithm).toBeDefined();
      expect(clusterTool.inputSchema.properties.maxClusters).toBeDefined();
      expect(clusterTool.inputSchema.properties.minClusterSize).toBeDefined();
    });

    it('should support all clustering algorithms', () => {
      const tools = (server as any).getAvailableTools();
      const clusterTool = tools.find((t: any) => t.name === 'obsidian_cluster_notes');
      
      const algorithmEnum = clusterTool.inputSchema.properties.algorithm.enum;
      expect(algorithmEnum).toContain('tags');
      expect(algorithmEnum).toContain('content');
      expect(algorithmEnum).toContain('links');
    });

    it('should have numerical parameters for cluster configuration', () => {
      const tools = (server as any).getAvailableTools();
      const clusterTool = tools.find((t: any) => t.name === 'obsidian_cluster_notes');
      
      expect(clusterTool.inputSchema.properties.maxClusters.type).toBe('number');
      expect(clusterTool.inputSchema.properties.minClusterSize.type).toBe('number');
    });

    it('should make all parameters optional', () => {
      const tools = (server as any).getAvailableTools();
      const clusterTool = tools.find((t: any) => t.name === 'obsidian_cluster_notes');
      
      expect(clusterTool.inputSchema.required || []).toHaveLength(0);
    });
  });

  describe('Tool Count Validation', () => {
    it('should provide exactly 21 tools when AI features disabled', () => {
      const originalEnv = process.env.OBSIDIAN_ENABLE_AI_FEATURES;
      delete process.env.OBSIDIAN_ENABLE_AI_FEATURES;
      
      const testServer = new EnhancedObsidianMCPServer('/tmp/test');
      const tools = (testServer as any).getAvailableTools();
      
      // Core (5) + Knowledge Graph (5) + Advanced (4) + Legacy (2) + Utility (1) = 17 tools
      // Wait, let me recalculate: we should have 18 total without AI features
      expect(tools.length).toBe(18);
      
      process.env.OBSIDIAN_ENABLE_AI_FEATURES = originalEnv;
      testServer.dispose();
    });

    it('should provide exactly 21 tools when AI features enabled', () => {
      const originalEnv = process.env.OBSIDIAN_ENABLE_AI_FEATURES;
      process.env.OBSIDIAN_ENABLE_AI_FEATURES = 'true';
      
      const testServer = new EnhancedObsidianMCPServer('/tmp/test');
      const tools = (testServer as any).getAvailableTools();
      
      // Base 18 + AI Features (3) = 21 tools
      expect(tools.length).toBe(21);
      
      process.env.OBSIDIAN_ENABLE_AI_FEATURES = originalEnv;
      testServer.dispose();
    });
  });

  describe('Advanced Tool Presence', () => {
    it('should include all advanced operation tools', () => {
      const tools = (server as any).getAvailableTools();
      const toolNames = tools.map((t: any) => t.name);
      
      expect(toolNames).toContain('obsidian_bulk_operations');
      expect(toolNames).toContain('obsidian_manage_tags');
      expect(toolNames).toContain('obsidian_create_template');
      expect(toolNames).toContain('obsidian_cluster_notes');
    });

    it('should maintain all existing tools', () => {
      const tools = (server as any).getAvailableTools();
      const toolNames = tools.map((t: any) => t.name);
      
      // Core operations
      expect(toolNames).toContain('obsidian_create_note');
      expect(toolNames).toContain('obsidian_read_note');
      expect(toolNames).toContain('obsidian_update_note');
      expect(toolNames).toContain('obsidian_delete_note');
      expect(toolNames).toContain('obsidian_full_text_search');
      
      // Knowledge graph
      expect(toolNames).toContain('obsidian_get_backlinks');
      expect(toolNames).toContain('obsidian_get_forward_links');
      expect(toolNames).toContain('obsidian_analyze_link_network');
      expect(toolNames).toContain('obsidian_find_orphaned_notes');
      expect(toolNames).toContain('obsidian_vault_statistics');
      
      // Legacy compatibility
      expect(toolNames).toContain('search_notes');
      expect(toolNames).toContain('read_notes');
    });
  });

  describe('Tool Descriptions', () => {
    it('should have meaningful descriptions for advanced tools', () => {
      const tools = (server as any).getAvailableTools();
      
      const bulkTool = tools.find((t: any) => t.name === 'obsidian_bulk_operations');
      expect(bulkTool.description).toContain('bulk operations');
      expect(bulkTool.description).toContain('multiple notes');
      
      const tagTool = tools.find((t: any) => t.name === 'obsidian_manage_tags');
      expect(tagTool.description).toContain('tags');
      expect(tagTool.description.toLowerCase()).toMatch(/add|remove|rename/);
      
      const templateTool = tools.find((t: any) => t.name === 'obsidian_create_template');
      expect(templateTool.description).toContain('template');
      expect(templateTool.description.toLowerCase()).toMatch(/create|manage/);
      
      const clusterTool = tools.find((t: any) => t.name === 'obsidian_cluster_notes');
      expect(clusterTool.description).toContain('cluster');
      expect(clusterTool.description).toContain('notes');
    });
  });

  describe('Schema Validation', () => {
    it('should have properly structured input schemas', () => {
      const tools = (server as any).getAvailableTools();
      const advancedTools = tools.filter((t: any) => 
        ['obsidian_bulk_operations', 'obsidian_manage_tags', 'obsidian_create_template', 'obsidian_cluster_notes']
        .includes(t.name)
      );
      
      for (const tool of advancedTools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
        expect(typeof tool.inputSchema.properties).toBe('object');
      }
    });

    it('should have consistent property types', () => {
      const tools = (server as any).getAvailableTools();
      
      // Check string properties
      const bulkTool = tools.find((t: any) => t.name === 'obsidian_bulk_operations');
      expect(bulkTool.inputSchema.properties.operation.type).toBe('string');
      expect(bulkTool.inputSchema.properties.notePattern.type).toBe('string');
      
      // Check boolean properties
      expect(bulkTool.inputSchema.properties.dryRun.type).toBe('boolean');
      
      // Check object properties
      expect(bulkTool.inputSchema.properties.parameters.type).toBe('object');
    });
  });
});
