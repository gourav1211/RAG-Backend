import fs from 'fs/promises';
import path from 'path';

export interface Document {
  content: string;
  source: string;
  title?: string;
  metadata?: Record<string, any>;
}

export class DocumentLoaderService {
  private dataDirectory: string;

  constructor(dataDirectory?: string) {
    // Use absolute path to src/data from project root
    const projectRoot = path.resolve(__dirname, '../../');
    this.dataDirectory = dataDirectory || path.join(projectRoot, 'src/data');
  }

  /**
   * Load all markdown files from the data directory
   */
  async loadAllDocuments(): Promise<Document[]> {
    try {
      const files = await fs.readdir(this.dataDirectory);
      const markdownFiles = files.filter(file => file.endsWith('.md'));
      
      console.log(`Found ${markdownFiles.length} markdown files to process`);
      
      const documents: Document[] = [];
      
      for (const file of markdownFiles) {
        const document = await this.loadDocument(file);
        if (document) {
          documents.push(document);
        }
      }
      
      return documents;
    } catch (error) {
      console.error('Error loading documents:', error);
      throw error;
    }
  }

  /**
   * Load a specific document by filename
   */
  async loadDocument(filename: string): Promise<Document | null> {
    try {
      const filePath = path.join(this.dataDirectory, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      
      if (!content.trim()) {
        console.warn(`Document ${filename} is empty, skipping`);
        return null;
      }

      // Extract title from the first h1 header or filename
      const title = this.extractTitle(content) || this.filenameToTitle(filename);
      
      return {
        content: this.preprocessContent(content),
        source: filename,
        title,
        metadata: {
          filename,
          filePath,
          size: content.length,
          loadedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`Error loading document ${filename}:`, error);
      return null;
    }
  }

  /**
   * Extract title from markdown content (first h1 header)
   */
  private extractTitle(content: string): string | null {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : null;
  }

  /**
   * Convert filename to a readable title
   */
  private filenameToTitle(filename: string): string {
    return filename
      .replace(/\.md$/, '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Preprocess content to clean it up for embedding
   */
  private preprocessContent(content: string): string {
    // Remove excessive whitespace and normalize line breaks
    let processed = content
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple line breaks
      .trim();

    // Remove markdown formatting that might not be useful for semantic search
    processed = processed
      .replace(/```[\s\S]*?```/g, (match) => {
        // Keep code blocks but clean them up
        return match.replace(/```(\w+)?\n/, '').replace(/```$/, '');
      })
      .replace(/`([^`]+)`/g, '$1') // Remove inline code backticks
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold formatting
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic formatting
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to just text
      .replace(/#{1,6}\s+/g, '') // Remove header markers
      .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
      .replace(/^\s*>\s+/gm, '') // Remove blockquote markers
      .trim();

    return processed;
  }

  /**
   * Validate document content
   */
  private validateDocument(document: Document): boolean {
    if (!document.content || document.content.trim().length < 100) {
      console.warn(`Document ${document.source} is too short, skipping`);
      return false;
    }

    if (document.content.length > 50000) {
      console.warn(`Document ${document.source} is very large (${document.content.length} chars)`);
    }

    return true;
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(): Promise<{
    totalDocuments: number;
    totalSize: number;
    averageSize: number;
    documents: Array<{ filename: string; size: number; title?: string }>;
  }> {
    try {
      const documents = await this.loadAllDocuments();
      const validDocuments = documents.filter(doc => this.validateDocument(doc));
      
      const totalSize = validDocuments.reduce((sum, doc) => sum + doc.content.length, 0);
      const averageSize = validDocuments.length > 0 ? Math.round(totalSize / validDocuments.length) : 0;
      
      return {
        totalDocuments: validDocuments.length,
        totalSize,
        averageSize,
        documents: validDocuments.map(doc => ({
          filename: doc.source,
          size: doc.content.length,
          title: doc.title
        }))
      };
    } catch (error) {
      console.error('Error getting document stats:', error);
      throw error;
    }
  }

  /**
   * Search for documents by keyword (basic text search)
   */
  async searchDocuments(keyword: string): Promise<Document[]> {
    try {
      const documents = await this.loadAllDocuments();
      const searchTerm = keyword.toLowerCase();
      
      return documents.filter(doc => 
        doc.content.toLowerCase().includes(searchTerm) ||
        doc.title?.toLowerCase().includes(searchTerm) ||
        doc.source.toLowerCase().includes(searchTerm)
      );
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }

  /**
   * Load documents with filtering options
   */
  async loadFilteredDocuments(options: {
    minSize?: number;
    maxSize?: number;
    includePatterns?: string[];
    excludePatterns?: string[];
  }): Promise<Document[]> {
    try {
      const allDocuments = await this.loadAllDocuments();
      
      return allDocuments.filter(doc => {
        // Size filtering
        if (options.minSize && doc.content.length < options.minSize) return false;
        if (options.maxSize && doc.content.length > options.maxSize) return false;
        
        // Include pattern filtering
        if (options.includePatterns && options.includePatterns.length > 0) {
          const matches = options.includePatterns.some(pattern => 
            doc.source.includes(pattern) || doc.title?.includes(pattern)
          );
          if (!matches) return false;
        }
        
        // Exclude pattern filtering
        if (options.excludePatterns && options.excludePatterns.length > 0) {
          const matches = options.excludePatterns.some(pattern => 
            doc.source.includes(pattern) || doc.title?.includes(pattern)
          );
          if (matches) return false;
        }
        
        return true;
      });
    } catch (error) {
      console.error('Error loading filtered documents:', error);
      throw error;
    }
  }
}
