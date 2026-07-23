/**
 * Semantic Indexer for Archon IDE
 * This provides the local codebase-aware context by parsing files and allowing semantic search.
 */

export interface IndexEntry {
  path: string;
  content: string;
  type: 'file' | 'function' | 'class';
  name: string;
}

export class SemanticIndexer {
  private index: Map<string, IndexEntry> = new Map();

  /**
   * Add a file or specific code block to the index
   */
  public addEntry(entry: IndexEntry) {
    this.index.set(`${entry.path}#${entry.name}`, entry);
  }

  /**
   * Search the index for a query
   * In a real implementation, this would use a local vector database or BM25 search.
   * For now, this acts as a placeholder naive text search.
   */
  public search(query: string, limit: number = 5): IndexEntry[] {
    const results: IndexEntry[] = [];
    const lowerQuery = query.toLowerCase();

    for (const entry of this.index.values()) {
      if (
        entry.name.toLowerCase().includes(lowerQuery) || 
        entry.path.toLowerCase().includes(lowerQuery) ||
        entry.content.toLowerCase().includes(lowerQuery)
      ) {
        results.push(entry);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Resolve an @File or @Tag query to its actual content to append to the LLM prompt.
   */
  public resolveContext(tags: string[]): string {
    let resolved = '';
    for (const tag of tags) {
      const match = this.search(tag, 1)[0];
      if (match) {
        resolved += `\n--- Context: ${match.path} (${match.name}) ---\n${match.content}\n`;
      }
    }
    return resolved;
  }
}

export const globalIndexer = new SemanticIndexer();
