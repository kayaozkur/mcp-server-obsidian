import { jest } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { ObsidianClient } from '../obsidian-client.js';

// Mock fs-extra
jest.mock('fs-extra');
jest.mock('chokidar');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ObsidianClient', () => {
  let client: ObsidianClient;
  let tempDir: string;

  beforeEach(() => {
    tempDir = '/tmp/test-vault';
    client = new ObsidianClient(tempDir);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await client.dispose();
  });

  describe('constructor', () => {
    it('should initialize with vault path', () => {
      expect(client).toBeInstanceOf(ObsidianClient);
    });

    it('should expand home directory', () => {
      const homeClient = new ObsidianClient('~/test-vault');
      expect(homeClient).toBeInstanceOf(ObsidianClient);
    });
  });

  describe('initializeVault', () => {
    it('should initialize vault successfully', async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
      } as any);
      mockFs.readdir.mockResolvedValue([]);

      await expect(client.initializeVault()).resolves.not.toThrow();
    });

    it('should throw error if vault path is not a directory', async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => false,
      } as any);

      await expect(client.initializeVault()).rejects.toThrow('Vault path is not a directory');
    });

    it('should throw error if vault path does not exist', async () => {
      mockFs.stat.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(client.initializeVault()).rejects.toThrow('Cannot access vault directory');
    });
  });

  describe('createNote', () => {
    beforeEach(async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
      } as any);
      mockFs.readdir.mockResolvedValue([]);
      await client.initializeVault();
    });

    it('should create a note successfully', async () => {
      const notePath = 'test-note.md';
      const content = '# Test Note\n\nContent here';
      const frontmatter = { title: 'Test Note', tags: ['test'] };

      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        birthtime: new Date(),
      } as any);
      mockFs.readFile.mockResolvedValue('---\ntitle: Test Note\ntags: [test]\n---\n# Test Note\n\nContent here');

      const result = await client.createNote(notePath, content, frontmatter);

      expect(result.path).toBe(notePath);
      expect(result.name).toBe('test-note');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should add .md extension if missing', async () => {
      const notePath = 'test-note';
      const content = 'Content';

      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        birthtime: new Date(),
      } as any);
      mockFs.readFile.mockResolvedValue('Content');

      await client.createNote(notePath, content);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-note.md'),
        'Content',
        'utf-8'
      );
    });
  });

  describe('searchNotes', () => {
    beforeEach(async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
      } as any);
      mockFs.readdir.mockResolvedValue([]);
      await client.initializeVault();
    });

    it('should search notes by query', async () => {
      const results = await client.searchNotes('test query');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should filter by tags', async () => {
      const results = await client.searchNotes('test', { tags: ['test-tag'] });
      expect(Array.isArray(results)).toBe(true);
    });

    it('should limit results', async () => {
      const results = await client.searchNotes('test', { limit: 5 });
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getVaultStatistics', () => {
    beforeEach(async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
      } as any);
      mockFs.readdir.mockResolvedValue([]);
      await client.initializeVault();
    });

    it('should return vault statistics', () => {
      const stats = client.getVaultStatistics();
      
      expect(stats).toHaveProperty('totalNotes');
      expect(stats).toHaveProperty('totalWords');
      expect(stats).toHaveProperty('totalTags');
      expect(stats).toHaveProperty('mostUsedTags');
      expect(stats).toHaveProperty('recentNotes');
      expect(typeof stats.totalNotes).toBe('number');
    });
  });

  describe('analyzeLinkNetwork', () => {
    beforeEach(async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
      } as any);
      mockFs.readdir.mockResolvedValue([]);
      await client.initializeVault();
    });

    it('should analyze link network', () => {
      const analysis = client.analyzeLinkNetwork();
      
      expect(analysis).toHaveProperty('totalLinks');
      expect(analysis).toHaveProperty('brokenLinks');
      expect(analysis).toHaveProperty('orphanedNotes');
      expect(analysis).toHaveProperty('centralNotes');
      expect(analysis).toHaveProperty('clusters');
      expect(typeof analysis.totalLinks).toBe('number');
      expect(Array.isArray(analysis.brokenLinks)).toBe(true);
    });
  });

  describe('deleteNote', () => {
    beforeEach(async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
      } as any);
      mockFs.readdir.mockResolvedValue([]);
      await client.initializeVault();
    });

    it('should delete note successfully', async () => {
      // First create a note in the cache
      const notePath = 'test-note.md';
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        birthtime: new Date(),
      } as any);
      mockFs.readFile.mockResolvedValue('Test content');

      await client.createNote(notePath, 'Test content');

      // Now delete it
      mockFs.remove.mockResolvedValue();
      
      await expect(client.deleteNote(notePath)).resolves.not.toThrow();
      expect(mockFs.remove).toHaveBeenCalled();
    });

    it('should throw error if note does not exist', async () => {
      const notePath = 'non-existent.md';
      
      await expect(client.deleteNote(notePath)).rejects.toThrow('Note not found');
    });
  });

  describe('security', () => {
    it('should reject paths outside vault', async () => {
      const maliciousPath = '../../../etc/passwd';
      
      await expect(client.createNote(maliciousPath, 'content')).rejects.toThrow('Access denied');
    });

    it('should reject hidden files', async () => {
      const hiddenPath = '.hidden-file.md';
      
      await expect(client.createNote(hiddenPath, 'content')).rejects.toThrow('Access denied');
    });
  });
});
