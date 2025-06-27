# Enhanced MCP Obsidian Server

A comprehensive Model Context Protocol (MCP) server for Obsidian vault management with advanced knowledge graph operations and AI-powered features.

## Features

### Core Operations
- **CRUD Operations**: Full create, read, update, delete support for notes
- **Frontmatter Support**: Complete YAML frontmatter processing
- **Template System**: Note creation with templates
- **Real-time Monitoring**: Automatic vault updates via file watching

### Knowledge Graph
- **Link Analysis**: Bidirectional link tracking (backlinks & forward links)
- **Network Analysis**: Comprehensive vault network insights
- **Orphaned Notes**: Detect isolated notes
- **Broken Links**: Identify and report broken references
- **Central Nodes**: Find most connected notes

### Advanced Search
- **Full-text Search**: Content-based search with fuzzy matching
- **Tag Filtering**: Search by specific tags
- **Date Range Filtering**: Time-based note filtering
- **Result Limiting**: Configurable result counts

### Intelligence Features (Optional)
- **Content Summarization**: AI-powered note summaries
- **Concept Extraction**: Key topic identification
- **Connection Suggestions**: Smart link recommendations
- **Vault Analytics**: Comprehensive statistics

## Installation

### Via NPX (Recommended)
```bash
npx @lepion/mcp-server-obsidian-enhanced /path/to/vault
```

### Via MCP Configuration
Add to your MCP settings:
```json
{
  "mcpServers": {
    "obsidian-enhanced": {
      "command": "npx",
      "args": ["-y", "@lepion/mcp-server-obsidian-enhanced", "/path/to/vault"],
      "env": {
        "OBSIDIAN_ENABLE_AI_FEATURES": "false"
      }
    }
  }
}
```

## Configuration

### Environment Variables
- `OBSIDIAN_ENABLE_AI_FEATURES`: Enable AI-powered features (default: false)
- `LOG_LEVEL`: Logging level (default: info)

## Tools

### Core Tools
- `obsidian_create_note`: Create new notes with frontmatter
- `obsidian_read_note`: Read note with full metadata
- `obsidian_update_note`: Update existing notes (replace/append/prepend)
- `obsidian_delete_note`: Delete notes (with confirmation)
- `obsidian_full_text_search`: Advanced search with filtering

### Knowledge Graph Tools
- `obsidian_get_backlinks`: Get incoming links to a note
- `obsidian_get_forward_links`: Get outgoing links from a note
- `obsidian_analyze_link_network`: Comprehensive network analysis
- `obsidian_find_orphaned_notes`: Find isolated notes
- `obsidian_vault_statistics`: Get vault analytics

### Legacy Compatibility
- `search_notes`: Compatible with smithery-ai/mcp-obsidian
- `read_notes`: Bulk note reading

### AI-Powered Tools (when enabled)
- `obsidian_summarize_note`: Generate note summaries
- `obsidian_extract_key_concepts`: Extract key topics
- `obsidian_suggest_connections`: Smart connection suggestions

## Security

- Path validation ensures access only within specified vault
- Hidden file/directory protection
- No access to system files outside vault boundaries

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev /path/to/vault

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## License

MIT License - see LICENSE file for details.
