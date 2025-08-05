import OpenAI from 'openai';
import { LLMRequest, LLMResponse, Message, ApiError } from '../types';

export class OpenAIService {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    console.log('🔑 OpenAI API Key check:', apiKey ? `Found (${apiKey.substring(0, 10)}...)` : 'NOT FOUND');
    
    if (!apiKey) {
      throw new ApiError(
        'OpenAI API key is required',
        500,
        'MISSING_OPENAI_KEY'
      );
    }

    this.client = new OpenAI({
      apiKey: apiKey,
    });
    
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  /**
   * Generate chat completion using OpenAI
   */
  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    try {
      const { messages, system_prompt, max_tokens = 1000, temperature = 0.7 } = request;

      // Convert our message format to OpenAI format
      const openaiMessages = this.convertMessagesToOpenAI(messages, system_prompt);

      console.log(`🤖 Making OpenAI request with ${openaiMessages.length} messages`);

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: openaiMessages,
        max_tokens,
        temperature,
        stream: false,
      });

      const content = completion.choices[0]?.message?.content;
      
      if (!content) {
        throw new ApiError(
          'No response generated from OpenAI',
          500,
          'EMPTY_OPENAI_RESPONSE'
        );
      }

      return {
        content: content.trim(),
        usage: {
          prompt_tokens: completion.usage?.prompt_tokens || 0,
          completion_tokens: completion.usage?.completion_tokens || 0,
          total_tokens: completion.usage?.total_tokens || 0,
        },
      };

    } catch (error) {
      console.error('OpenAI Service Error:', error);

      if (error instanceof ApiError) {
        throw error;
      }

      // Handle OpenAI-specific errors
      if (error instanceof OpenAI.APIError) {
        throw new ApiError(
          `OpenAI API Error: ${error.message}`,
          error.status || 500,
          'OPENAI_API_ERROR',
          { type: error.type, code: error.code }
        );
      }

      throw new ApiError(
        'Failed to generate response from OpenAI',
        500,
        'OPENAI_SERVICE_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Generate embeddings for text using OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      console.log(`🔍 Generating embedding for text (${text.length} chars)`);

      const response = await this.client.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      const embedding = response.data[0]?.embedding;
      
      if (!embedding) {
        throw new ApiError(
          'No embedding generated from OpenAI',
          500,
          'EMPTY_EMBEDDING_RESPONSE'
        );
      }

      return embedding;

    } catch (error) {
      console.error('OpenAI Embedding Error:', error);

      if (error instanceof OpenAI.APIError) {
        throw new ApiError(
          `OpenAI Embedding API Error: ${error.message}`,
          error.status || 500,
          'OPENAI_EMBEDDING_ERROR',
          { type: error.type, code: error.code }
        );
      }

      throw new ApiError(
        'Failed to generate embedding from OpenAI',
        500,
        'EMBEDDING_SERVICE_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Convert our internal message format to OpenAI's format
   */
  private convertMessagesToOpenAI(
    messages: Message[], 
    systemPrompt?: string
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add system prompt if provided
    if (systemPrompt) {
      openaiMessages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // Convert messages
    for (const message of messages) {
      if (message.role === 'system' && !systemPrompt) {
        // Only add system messages if no separate system prompt was provided
        openaiMessages.push({
          role: 'system',
          content: message.content,
        });
      } else if (message.role === 'user') {
        openaiMessages.push({
          role: 'user',
          content: message.content,
        });
      } else if (message.role === 'assistant') {
        openaiMessages.push({
          role: 'assistant',
          content: message.content,
        });
      }
    }

    return openaiMessages;
  }

  /**
   * Test the OpenAI connection
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 Testing OpenAI connection...');
      
      const response = await this.generateResponse({
        messages: [{
          role: 'user',
          content: 'Hello, this is a connection test. Please respond with "OK".',
          timestamp: new Date().toISOString(),
        }],
        max_tokens: 10,
        temperature: 0,
      });

      console.log('✅ OpenAI connection test successful');
      return response.content.toLowerCase().includes('ok');

    } catch (error) {
      console.error('❌ OpenAI connection test failed:', error);
      return false;
    }
  }
}
