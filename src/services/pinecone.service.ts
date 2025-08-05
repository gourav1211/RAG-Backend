import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIService } from './openai.service';

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    chunkIndex: number;
    totalChunks: number;
    title?: string;
  };
}

export interface SearchResult {
  content: string;
  score: number;
  metadata: any;
}

export class PineconeService {
  private pinecone: Pinecone;
  private indexName: string;
  private openaiService: OpenAIService;

  constructor() {
    this.indexName = process.env.PINECONE_INDEX_NAME || 'ragbackend';
    this.openaiService = new OpenAIService();
    
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }

  /**
   * Initialize Pinecone index if it doesn't exist
   */
  async initializeIndex(): Promise<void> {
    try {
      const indexList = await this.pinecone.listIndexes();
      const indexExists = indexList.indexes?.some(index => index.name === this.indexName);

      if (!indexExists) {
        console.log(`Creating Pinecone index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: 1536, // OpenAI embedding dimension
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });

        // Wait for index to be ready
        console.log('Waiting for index to be ready...');
        await this.waitForIndexReady();
      } else {
        console.log(`Pinecone index '${this.indexName}' already exists`);
      }
    } catch (error) {
      console.error('Error initializing Pinecone index:', error);
      throw error;
    }
  }

  /**
   * Wait for Pinecone index to be ready
   */
  private async waitForIndexReady(): Promise<void> {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const indexStats = await this.pinecone.index(this.indexName).describeIndexStats();
        if (indexStats) {
          console.log('Index is ready!');
          return;
        }
      } catch (error) {
        console.log(`Waiting for index... (attempt ${attempts + 1}/${maxAttempts})`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('Index did not become ready within expected time');
  }

  /**
   * Chunk text into smaller pieces for embedding
   */
  private chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let currentPosition = 0;

    while (currentPosition < text.length) {
      const endPosition = Math.min(currentPosition + maxChunkSize, text.length);
      let chunk = text.substring(currentPosition, endPosition);

      // Try to break at sentence boundaries
      if (endPosition < text.length) {
        const lastSentenceEnd = Math.max(
          chunk.lastIndexOf('. '),
          chunk.lastIndexOf('! '),
          chunk.lastIndexOf('? ')
        );

        if (lastSentenceEnd > chunk.length * 0.5) {
          chunk = chunk.substring(0, lastSentenceEnd + 1);
        }
      }

      chunks.push(chunk.trim());

      // Move position forward, accounting for overlap
      if (endPosition >= text.length) break;
      
      currentPosition = endPosition - overlap;
      if (currentPosition <= chunks[chunks.length - 1].length - overlap) {
        currentPosition = endPosition;
      }
    }

    return chunks.filter(chunk => chunk.length > 50); // Filter out very small chunks
  }

  /**
   * Store document chunks in Pinecone
   */
  async storeDocuments(documents: { content: string; source: string; title?: string }[]): Promise<void> {
    try {
      console.log(`🚀 Starting to store ${documents.length} documents in Pinecone...`);
      const index = this.pinecone.index(this.indexName);
      const vectors: any[] = [];

      for (const doc of documents) {
        const chunks = this.chunkText(doc.content);
        console.log(`📄 Processing ${chunks.length} chunks for ${doc.source}`);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          
          // Generate embedding for chunk
          const embedding = await this.openaiService.generateEmbedding(chunk);
          
          const vectorId = `${doc.source}_chunk_${i}`;
          
          vectors.push({
            id: vectorId,
            values: embedding,
            metadata: {
              content: chunk,
              source: doc.source,
              title: doc.title || doc.source,
              chunkIndex: i,
              totalChunks: chunks.length,
              length: chunk.length
            }
          });

          // Batch upsert every 100 vectors to avoid memory issues
          if (vectors.length >= 100) {
            await index.upsert(vectors);
            console.log(`✅ Upserted batch of ${vectors.length} vectors`);
            vectors.length = 0; // Clear array
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      // Upsert remaining vectors
      if (vectors.length > 0) {
        await index.upsert(vectors);
        console.log(`✅ Upserted final batch of ${vectors.length} vectors`);
      }

      console.log('🎉 All documents stored successfully in Pinecone');
    } catch (error) {
      console.error('❌ Error storing documents in Pinecone:', error);
      throw error;
    }
  }

  /**
   * Search for similar content using vector similarity
   */
  async searchSimilar(query: string, topK: number = 3): Promise<SearchResult[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.openaiService.generateEmbedding(query);
      
      const index = this.pinecone.index(this.indexName);
      
      // Perform similarity search
      const searchResponse = await index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        includeValues: false
      });

      // Transform results
      const results: SearchResult[] = searchResponse.matches?.map(match => ({
        content: match.metadata?.content as string || '',
        score: match.score || 0,
        metadata: {
          source: match.metadata?.source,
          title: match.metadata?.title,
          chunkIndex: match.metadata?.chunkIndex,
          totalChunks: match.metadata?.totalChunks
        }
      })) || [];

      console.log(`Found ${results.length} similar documents for query: "${query}"`);
      return results;
    } catch (error) {
      console.error('Error searching in Pinecone:', error);
      throw error;
    }
  }

  /**
   * Delete all vectors from index (useful for testing)
   */
  async clearIndex(): Promise<void> {
    try {
      const index = this.pinecone.index(this.indexName);
      await index.deleteAll();
      console.log('Index cleared successfully');
    } catch (error) {
      console.error('Error clearing index:', error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<any> {
    try {
      const index = this.pinecone.index(this.indexName);
      const stats = await index.describeIndexStats();
      return stats;
    } catch (error) {
      console.error('Error getting index stats:', error);
      throw error;
    }
  }

  /**
   * Health check for Pinecone connection
   */
  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const indexList = await this.pinecone.listIndexes();
      const stats = await this.getIndexStats();
      
      return {
        status: 'healthy',
        details: {
          indexExists: indexList.indexes?.some(index => index.name === this.indexName),
          indexName: this.indexName,
          vectorCount: stats?.totalVectorCount || 0,
          indexStats: stats
        }
      };
    } catch (error) {
      return {
        status: 'error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          indexName: this.indexName
        }
      };
    }
  }
}
