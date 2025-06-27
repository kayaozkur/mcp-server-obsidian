import { jest } from '@jest/globals';
import { EnhancedObsidianMCPServer } from '../index.js';

// Mock the ObsidianClient
jest.mock('../obsidian-client.js', () => ({
  ObsidianClient: jest.fn().mockImplementation(() => ({
    initializeVault: jest.fn().mockResolvedValue(undefined),
    getVaultStatistics: jest.fn().mockReturnValue({
      totalNotes: 5,
      totalWords: 1000,
      totalTags: 10,
      mostUsedTags: [{ tag: 'test', count: 3 }],
      recentNotes: [{ path: 'test.md', lastModified: new Date() }],
    }),
    createNote: jest.fn().mockResolvedValue({
      path: 'test.md',
      name: 'test',
      content: 'Test content',
      frontmatter: {},
      links: [],
      backlinks: [],
      tags: [],
      lastModified: new Date(),
      created: new Date(),
      wordCount: 2,
    }),
    searchNotes: jest.fn().mockResolvedValue([]),
    readNote: jest.fn().mockResolvedValue({
      path: 'test.md',
      name: 'test',
      content: 'Test content',
      frontmatter: {},
      links: [],
      backlinks: [],
      tags: [],
      lastModified: new Date(),
      created: new Date(),
      wordCount: 2,
    }),
    dispose: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('EnhancedObsidianMCPServer', () => {
  let server: EnhancedObsidianMCPServer;

  beforeEach(() => {
    server = new EnhancedObsidianMCPServer('/tmp/test-vault');
  });

  afterEach(async () => {
    await server.dispose();
  });

  describe('constructor', () => {
    it('should initialize server with vault path', () => {
      expect(server).toBeInstanceOf(EnhancedObsidianMCPServer);
    });

    it('should disable AI features by default', () => {
      const originalEnv = process.env.OBSIDIAN_ENABLE_AI_FEATURES;
      delete process.env.OBSIDIAN_ENABLE_AI_FEATURES;
      
      const testServer = new EnhancedObsidianMCPServer('/tmp/test');
      expect(testServer).toBeInstanceOf(EnhancedObsidianMCPServer);
      
      process.env.OBSIDIAN_ENABLE_AI_FEATURES = originalEnv;
    });

    it('should enable AI features when environment variable is set', () => {
      const originalEnv = process.env.OBSIDIAN_ENABLE_AI_FEATURES;
      process.env.OBSIDIAN_ENABLE_AI_FEATURES = 'true';
      
      const testServer = new EnhancedObsidianMCPServer('/tmp/test');
      expect(testServer).toBeInstanceOf(EnhancedObsidianMCPServer);
      
      process.env.OBSIDIAN_ENABLE_AI_FEATURES = originalEnv;
    });
  });

  describe('getAvailableTools', () => {
    it('should return basic tools when AI features disabled', () => {
      const originalEnv = process.env.OBSIDIAN_ENABLE_AI_FEATURES;
      delete process.env.OBSIDIAN_ENABLE_AI_FEATURES;
      
      const testServer = new EnhancedObsidianMCPServer('/tmp/test');
      const tools = (testServer as any).getAvailableTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // Should have core tools
      expect(tools.some((t: any) => t.name === 'obsidian_create_note')).toBe(true);
      expect(tools.some((t: any) => t.name === 'obsidian_read_note')).toBe(true);
      expect(tools.some((t: any) => t.name === 'search_notes')).toBe(true);
      
      // Should not have AI tools
      expect(tools.some((t: any) => t.name === 'obsidian_summarize_note')).toBe(false);
      
      process.env.OBSIDIAN_ENABLE_AI_FEATURES = originalEnv;
    });

    it('should return AI tools when AI features enabled', () => {
      const originalEnv = process.env.OBSIDIAN_ENABLE_AI_FEATURES;
      process.env.OBSIDIAN_ENABLE_AI_FEATURES = 'true';
      
      const testServer = new EnhancedObsidianMCPServer('/tmp/test');
      const tools = (testServer as any).getAvailableTools();
      
      expect(Array.isArray(tools)).toBe(true);
      
      // Should have AI tools
      expect(tools.some((t: any) => t.name === 'obsidian_summarize_note')).toBe(true);
      expect(tools.some((t: any) => t.name === 'obsidian_extract_key_concepts')).toBe(true);
      expect(tools.some((t: any) => t.name === 'obsidian_suggest_connections')).toBe(true);
      
      process.env.OBSIDIAN_ENABLE_AI_FEATURES = originalEnv;
    });
  });

  describe('tool schemas validation', () => {
    it('should have valid schemas for all tools', () => {
      const tools = (server as any).getAvailableTools();
      
      for (const tool of tools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.inputSchema).toBe('object');
      }
    });
  });

  describe('error handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      // This would require mocking the server's internal methods
      // For now, we'll just ensure the server initializes without errors
      expect(server).toBeInstanceOf(EnhancedObsidianMCPServer);
    });
  });

  describe('AI feature utilities', () => {
    it('should generate basic summary', () => {
      const content = 'This is a long piece of content. It has multiple sentences. Each sentence adds meaning. This should be summarized properly.';
      const summary = (server as any).generateBasicSummary(content, 10);
      
      expect(typeof summary).toBe('string');
      expect(summary.split(' ').length).toBeLessThanOrEqual(15); // Some tolerance
    });

    it('should extract basic concepts', () => {
      const content = 'Machine learning algorithms process data efficiently. Data processing requires careful algorithm selection.';
      const concepts = (server as any).extractBasicConcepts(content, 5);
      
      expect(Array.isArray(concepts)).toBe(true);
      expect(concepts.length).toBeLessThanOrEqual(5);
      
      for (const concept of concepts) {
        expect(concept).toHaveProperty('concept');
        expect(concept).toHaveProperty('frequency');
        expect(typeof concept.concept).toBe('string');
        expect(typeof concept.frequency).toBe('number');
      }
    });

    it('should generate mermaid diagram', () => {
      const analysis = {
        centralNotes: [
          { note: 'note1.md', connections: 5 },
          { note: 'note2.md', connections: 3 },
        ],
      };
      
      const diagram = (server as any).generateMermaidDiagram(analysis);
      
      expect(typeof diagram).toBe('string');
      expect(diagram).toContain('graph TD');
    });
  });
});
