import { PineconeService, SearchResult } from './pinecone.service';
import { DocumentLoaderService } from './document-loader.service';
import { OpenAIService } from './openai.service';
import { PromptService } from './prompt.service';

export interface RAGContext {
  relevantDocuments: SearchResult[];
  query: string;
  contextualPrompt: string;
}

export interface RAGResponse {
  response: string;
  context: RAGContext;
  sources: string[];
}

export class RAGService {
  private pineconeService: PineconeService;
  private documentLoader: DocumentLoaderService;
  private openaiService: OpenAIService;
  private promptService: PromptService;
  private isInitialized: boolean = false;

  constructor() {
    this.pineconeService = new PineconeService();
    this.documentLoader = new DocumentLoaderService();
    this.openaiService = new OpenAIService();
    this.promptService = new PromptService();
  }

  /**
   * Initialize the RAG system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('RAG system already initialized');
      return;
    }

    try {
      console.log('Initializing RAG system...');
      
      // Initialize Pinecone index
      await this.pineconeService.initializeIndex();
      
      // Check if we need to load documents
      const stats = await this.pineconeService.getIndexStats();
      
      if (!stats.totalVectorCount || stats.totalVectorCount === 0) {
        console.log('No documents found in index, loading documents...');
        await this.loadDocuments();
      } else {
        console.log(`Found ${stats.totalVectorCount} vectors in index`);
      }
      
      this.isInitialized = true;
      console.log('RAG system initialized successfully');
    } catch (error) {
      console.error('Error initializing RAG system:', error);
      throw error;
    }
  }

  /**
   * Load all documents into the vector database
   */
  async loadDocuments(): Promise<void> {
    try {
      console.log('Loading documents from data directory...');
      
      const documents = await this.documentLoader.loadAllDocuments();
      
      if (documents.length === 0) {
        console.warn('No documents found to load');
        return;
      }
      
      console.log(`Loaded ${documents.length} documents, storing in Pinecone...`);
      
      // Convert to format expected by Pinecone service
      const documentsForPinecone = documents.map(doc => ({
        content: doc.content,
        source: doc.source,
        title: doc.title
      }));
      
      await this.pineconeService.storeDocuments(documentsForPinecone);
      
      console.log('All documents stored successfully');
    } catch (error) {
      console.error('Error loading documents:', error);
      throw error;
    }
  }

  /**
   * Generate a response using RAG (Retrieval-Augmented Generation)
   */
  async generateResponse(query: string, topK: number = 3): Promise<RAGResponse> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Search for relevant documents
      console.log(`Searching for relevant context for query: "${query}"`);
      const relevantDocuments = await this.pineconeService.searchSimilar(query, topK);
      
      // Create context from retrieved documents
      const context = this.createContext(relevantDocuments, query);
      
      // Generate response using OpenAI with context
      const response = await this.generateContextualResponse(context);
      
      // Extract sources
      const sources = this.extractSources(relevantDocuments);
      
      return {
        response,
        context,
        sources
      };
    } catch (error) {
      console.error('Error generating RAG response:', error);
      throw error;
    }
  }

  /**
   * Create contextual prompt from retrieved documents
   */
  private createContext(documents: SearchResult[], query: string): RAGContext {
    const contextDocuments = documents.filter(doc => doc.score > 0.7); // Filter by relevance score
    
    let contextText = '';
    
    if (contextDocuments.length > 0) {
      contextText = contextDocuments
        .map((doc, index) => {
          return `[Source ${index + 1}: ${doc.metadata.title || doc.metadata.source}]\n${doc.content}\n`;
        })
        .join('\n---\n\n');
    }

    const contextualPrompt = this.buildPrompt(query, contextText);

    return {
      relevantDocuments: contextDocuments,
      query,
      contextualPrompt
    };
  }

  /**
   * Build the prompt for OpenAI with context
   */
  private buildPrompt(query: string, context: string): string {
    // Use the new PromptService for enhanced RAG prompts
    return this.promptService.generateRAGPrompt(query, context);
  }

  /**
   * Generate response using OpenAI with contextual prompt
   */
  private async generateContextualResponse(context: RAGContext): Promise<string> {
    try {
      const response = await this.openaiService.generateResponse({
        messages: [
          {
            role: 'user',
            content: context.contextualPrompt,
            timestamp: new Date().toISOString()
          }
        ]
      });

      return response.content;
    } catch (error) {
      console.error('Error generating contextual response:', error);
      throw error;
    }
  }

  /**
   * Extract unique sources from search results
   */
  private extractSources(documents: SearchResult[]): string[] {
    const sources = new Set<string>();
    
    documents.forEach(doc => {
      if (doc.metadata.source) {
        sources.add(doc.metadata.source);
      }
    });
    
    return Array.from(sources);
  }

  /**
   * Search only (without generating response)
   */
  async searchDocuments(query: string, topK: number = 5): Promise<SearchResult[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      return await this.pineconeService.searchSimilar(query, topK);
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }

  /**
   * Get system status and statistics
   */
  async getSystemStatus(): Promise<{
    initialized: boolean;
    documentsLoaded: number;
    pineconeStatus: any;
    documentStats: any;
  }> {
    try {
      const pineconeStatus = await this.pineconeService.healthCheck();
      
      let documentStats = null;
      try {
        documentStats = await this.documentLoader.getDocumentStats();
      } catch (error) {
        console.warn('Could not get document stats:', error);
      }

      return {
        initialized: this.isInitialized,
        documentsLoaded: pineconeStatus.details.vectorCount || 0,
        pineconeStatus,
        documentStats
      };
    } catch (error) {
      console.error('Error getting system status:', error);
      throw error;
    }
  }

  /**
   * Refresh the document index (reload all documents)
   */
  async refreshDocuments(): Promise<void> {
    try {
      console.log('Refreshing document index...');
      
      // Clear existing index
      await this.pineconeService.clearIndex();
      
      // Reload all documents
      await this.loadDocuments();
      
      console.log('Document index refreshed successfully');
    } catch (error) {
      console.error('Error refreshing documents:', error);
      throw error;
    }
  }

  /**
   * Add a new document to the index
   */
  async addDocument(content: string, source: string, title?: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      await this.pineconeService.storeDocuments([{
        content,
        source,
        title
      }]);

      console.log(`Document "${source}" added successfully`);
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  /**
   * Health check for the entire RAG system
   */
  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const openaiHealth = await this.openaiService.testConnection();
      const pineconeHealth = await this.pineconeService.healthCheck();
      
      const isHealthy = openaiHealth === true && 
                       pineconeHealth.status === 'healthy';
      
      return {
        status: isHealthy ? 'healthy' : 'degraded',
        details: {
          initialized: this.isInitialized,
          openai: {
            status: openaiHealth ? 'connected' : 'disconnected'
          },
          pinecone: pineconeHealth,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}
