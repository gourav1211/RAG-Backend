import { Request, Response, NextFunction } from 'express';
import { OpenAIService } from '../services/openai.service';
import { MemoryService } from '../services/memory.service';
import { RAGService } from '../services/rag.service';
import { PluginExecutionService } from '../services/plugin-execution.service';
import { WeatherPlugin } from '../plugins/weather.plugin';
import { MathPlugin } from '../plugins/math.plugin';
import { AgentRequest, AgentResponse, Message, ApiError } from '../types';
import { PluginContext } from '../types/plugin.types';

export class AgentController {
  private openaiService: OpenAIService;
  private memoryService: MemoryService;
  private ragService: RAGService;
  private pluginService: PluginExecutionService;

  constructor() {
    this.openaiService = new OpenAIService();
    this.memoryService = new MemoryService();
    this.ragService = new RAGService();
    this.pluginService = new PluginExecutionService();
    
    // Register plugins
    this.initializePlugins();
  }

  /**
   * Initialize and register all plugins
   */
  private initializePlugins(): void {
    console.log('🔌 Initializing plugin system...');
    
    // Register weather plugin
    const weatherPlugin = new WeatherPlugin();
    this.pluginService.getRegistry().register(weatherPlugin);
    
    // Register math plugin
    const mathPlugin = new MathPlugin();
    this.pluginService.getRegistry().register(mathPlugin);
    
    console.log('✅ Plugin system initialized with weather and math plugins');
  }

  /**
   * Main agent message endpoint
   * POST /agent/message
   */
  handleMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request body
      const validationResult = this.validateRequest(req.body);
      if (!validationResult.isValid) {
        throw new ApiError(
          validationResult.error!,
          400,
          'VALIDATION_ERROR'
        );
      }

      const { message, session_id }: AgentRequest = req.body;

      console.log(`🎯 Processing message for session: ${session_id}`);
      console.log(`📝 User message: ${message.substring(0, 100)}...`);

      // Check if message should use RAG
      const shouldUseRAG = this.shouldUseRAG(message);
      console.log(`🔍 RAG needed: ${shouldUseRAG}`);

      // Check for applicable plugins
      const pluginContext: PluginContext = {
        query: message,
        sessionId: session_id,
        userMessage: message,
        timestamp: new Date().toISOString()
      };

      const pluginResults = await this.pluginService.executeApplicablePlugins(pluginContext);
      console.log(`🔧 Plugin results: ${pluginResults.length} plugins executed`);

      // Add user message to memory
      const userMessage: Message = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };

      this.memoryService.addMessage(session_id, userMessage);

      // Get conversation context
      const conversationHistory = this.memoryService.getConversationContext(session_id, 6);
      const memorySummary = this.memoryService.generateMemorySummary(session_id);

      // Generate system prompt
      const systemPrompt = this.generateSystemPrompt(memorySummary);

      let llmResponse;
      let sources: string[] = [];
      let pluginsUsed: string[] = [];

      // Check if any plugins provided successful results
      const successfulPlugins = pluginResults.filter(result => result.result.success);
      
      if (successfulPlugins.length > 0) {
        // Use plugin results as primary response
        console.log(`🎯 Using plugin results from: ${successfulPlugins.map(p => p.pluginName).join(', ')}`);
        
        const pluginResponses = successfulPlugins
          .map(plugin => plugin.result.formattedResponse || plugin.result.message || 'Plugin executed successfully')
          .join('\n\n');
        
        llmResponse = {
          content: pluginResponses,
          usage: undefined
        };
        
        pluginsUsed = successfulPlugins.map(p => p.pluginName);
        
      } else if (shouldUseRAG) {
        // Use RAG for enhanced response
        console.log(`🔍 Using RAG for enhanced response...`);
        const ragResponse = await this.ragService.generateResponse(message, 3);
        llmResponse = {
          content: ragResponse.response,
          usage: undefined // RAG service doesn't return usage info
        };
        sources = ragResponse.sources;
      } else {
        // Use standard OpenAI response
        console.log(`💬 Using standard AI response...`);
        llmResponse = await this.openaiService.generateResponse({
          messages: conversationHistory,
          system_prompt: systemPrompt,
          max_tokens: 1000,
          temperature: 0.7,
        });
      }

      // Add assistant response to memory
      const assistantMessage: Message = {
        role: 'assistant',
        content: llmResponse.content,
        timestamp: new Date().toISOString(),
      };

      this.memoryService.addMessage(session_id, assistantMessage);

      // Prepare response
      const response: AgentResponse = {
        reply: llmResponse.content,
        session_id: session_id,
        timestamp: new Date().toISOString(),
        sources: sources, // Now populated from RAG when used
        plugins_used: pluginsUsed, // Now populated from plugin execution
      };

      console.log(`✅ Generated response for session ${session_id}`);
      console.log(`📊 Token usage: ${llmResponse.usage?.total_tokens} total tokens`);

      res.status(200).json(response);

    } catch (error) {
      console.error('Agent Controller Error:', error);
      next(error);
    }
  };

  /**
   * Get session information and stats
   * GET /agent/session/:sessionId
   */
  getSessionInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        throw new ApiError(
          'Session ID is required',
          400,
          'MISSING_SESSION_ID'
        );
      }

      const sessionData = this.memoryService.getSession(sessionId);

      if (!sessionData) {
        throw new ApiError(
          'Session not found',
          404,
          'SESSION_NOT_FOUND'
        );
      }

      const stats = this.memoryService.getSessionStats(sessionId);

      res.status(200).json({
        session: sessionData,
        stats: stats,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Session Info Error:', error);
      next(error);
    }
  };

  /**
   * Clear a session
   * DELETE /agent/session/:sessionId
   */
  clearSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        throw new ApiError(
          'Session ID is required',
          400,
          'MISSING_SESSION_ID'
        );
      }

      const cleared = this.memoryService.clearSession(sessionId);

      if (!cleared) {
        throw new ApiError(
          'Session not found',
          404,
          'SESSION_NOT_FOUND'
        );
      }

      res.status(200).json({
        message: 'Session cleared successfully',
        session_id: sessionId,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Clear Session Error:', error);
      next(error);
    }
  };

  /**
   * Health check endpoint
   * GET /agent/health
   */
  healthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Test OpenAI connection
      const openaiHealthy = await this.openaiService.testConnection();
      
      // Get memory service stats
      const allSessions = this.memoryService.getAllSessions();

      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          openai: {
            status: openaiHealthy ? 'healthy' : 'unhealthy',
            last_tested: new Date().toISOString(),
          },
          memory: {
            status: 'healthy',
            active_sessions: allSessions.length,
            sessions: allSessions
          }
        }
      });

    } catch (error) {
      console.error('Health Check Error:', error);
      next(error);
    }
  };

  /**
   * Test endpoint for RAG functionality
   * GET /agent/test
   */
  testRAG = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const systemStatus = await this.ragService.getSystemStatus();
      
      res.status(200).json({
        message: 'RAG test endpoint - system active!',
        timestamp: new Date().toISOString(),
        rag_status: systemStatus.initialized ? 'active and ready' : 'not initialized',
        features: {
          smart_routing: 'Messages are automatically routed to RAG when appropriate',
          keyword_detection: 'Detects technical questions and how-to queries',
          document_search: 'Available via POST /agent/search',
          initialization: 'Use POST /agent/rag/refresh to initialize system'
        },
        stats: {
          documentsLoaded: systemStatus.documentsLoaded,
          initialized: systemStatus.initialized
        }
      });
    } catch (error) {
      console.error('RAG Test Error:', error);
      next(error);
    }
  };

  /**
   * RAG system health check
   * GET /agent/rag/health
   */
  ragHealthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get RAG system status
      const systemStatus = await this.ragService.getSystemStatus();
      
      if (systemStatus.initialized) {
        res.status(200).json({
          status: 'healthy',
          message: 'RAG system is initialized and ready',
          timestamp: new Date().toISOString(),
          features: [
            '✅ Document embedding and storage',
            '✅ Semantic search with Pinecone',
            '✅ Context-aware response generation',
            '✅ Source attribution'
          ],
          stats: {
            documentsLoaded: systemStatus.documentsLoaded,
            pineconeStatus: systemStatus.pineconeStatus.status
          }
        });
      } else {
        res.status(503).json({
          status: 'initializing',
          message: 'RAG system is not yet initialized - run /agent/rag/refresh to initialize',
          timestamp: new Date().toISOString(),
          next_step: 'POST /agent/rag/refresh'
        });
      }
    } catch (error) {
      console.error('RAG Health Check Error:', error);
      res.status(500).json({
        status: 'error',
        message: 'RAG system health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Document search
   * POST /agent/search
   */
  searchDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { query, limit = 5 } = req.body;
      
      if (!query) {
        throw new ApiError(
          'Query parameter is required',
          400,
          'MISSING_QUERY'
        );
      }

      // Use RAG service to search documents
      const searchResults = await this.ragService.searchDocuments(query, limit);
      
      res.status(200).json({
        message: 'Document search completed',
        query: query,
        limit: limit,
        results: searchResults,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Document Search Error:', error);
      next(error);
    }
  };

  /**
   * RAG refresh - Initialize RAG system
   * POST /agent/rag/refresh
   */
  refreshRAGIndex = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      console.log('🔄 Initializing RAG system...');
      
      // Initialize the RAG system
      await this.ragService.initialize();
      
      // Get updated status
      const systemStatus = await this.ragService.getSystemStatus();
      
      res.status(200).json({
        message: 'RAG system initialized successfully',
        timestamp: new Date().toISOString(),
        status: {
          initialized: systemStatus.initialized,
          documentsLoaded: systemStatus.documentsLoaded,
          pinecone: systemStatus.pineconeStatus.status
        }
      });
    } catch (error) {
      console.error('RAG Refresh Error:', error);
      next(error);
    }
  };

  /**
   * Validate request body for agent message
   */
  private validateRequest(body: any): { isValid: boolean; error?: string } {
    if (!body) {
      return { isValid: false, error: 'Request body is required' };
    }

    if (!body.message) {
      return { isValid: false, error: 'Message is required' };
    }

    if (typeof body.message !== 'string') {
      return { isValid: false, error: 'Message must be a string' };
    }

    if (body.message.trim().length === 0) {
      return { isValid: false, error: 'Message cannot be empty' };
    }

    if (body.message.length > 10000) {
      return { isValid: false, error: 'Message is too long (max 10000 characters)' };
    }

    if (!body.session_id) {
      return { isValid: false, error: 'Session ID is required' };
    }

    if (typeof body.session_id !== 'string') {
      return { isValid: false, error: 'Session ID must be a string' };
    }

    if (body.session_id.length > 100) {
      return { isValid: false, error: 'Session ID is too long (max 100 characters)' };
    }

    return { isValid: true };
  }

  /**
   * Generate system prompt for the agent
   */
  private generateSystemPrompt(memorySummary: string): string {
    return `You are an intelligent AI assistant with access to conversation history and specialized tools.

## Your Role
- Provide helpful, accurate, and engaging responses
- Maintain context from previous conversations
- Use tools and plugins when appropriate to enhance your responses
- Be conversational but professional

## Memory Context
${memorySummary}

## Instructions
1. Consider the conversation history when formulating responses
2. If asked about weather, you can use weather data
3. If asked about math calculations, you can compute accurate results
4. Always aim to be helpful and informative
5. If you're unsure about something, say so honestly

Remember to maintain the conversation flow and reference previous context when relevant.`;
  }

  /**
   * Plugin system health check
   * GET /agent/plugins/health
   */
  pluginHealthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const healthStatus = await this.pluginService.healthCheck();
      
      res.status(healthStatus.status === 'healthy' ? 200 : 503).json({
        status: healthStatus.status,
        timestamp: new Date().toISOString(),
        plugins: healthStatus.pluginHealth,
        registry: {
          healthy: healthStatus.registryHealth,
          stats: this.pluginService.getStats()
        }
      });
    } catch (error) {
      console.error('Plugin Health Check Error:', error);
      next(error);
    }
  };

  /**
   * List available plugins
   * GET /agent/plugins
   */
  listPlugins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plugins = this.pluginService.getRegistry().getAllPlugins();
      
      res.status(200).json({
        message: 'Available plugins',
        timestamp: new Date().toISOString(),
        plugins: plugins.map(plugin => ({
          name: plugin.name,
          description: plugin.description,
          version: plugin.version
        })),
        count: plugins.length
      });
    } catch (error) {
      console.error('List Plugins Error:', error);
      next(error);
    }
  };

  /**
   * Test a specific plugin
   * POST /agent/plugins/test
   */
  testPlugin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { plugin_name, test_query } = req.body;
      
      if (!plugin_name || !test_query) {
        throw new ApiError(
          'plugin_name and test_query are required',
          400,
          'MISSING_PARAMETERS'
        );
      }

      const pluginContext: PluginContext = {
        query: test_query,
        sessionId: 'plugin_test',
        userMessage: test_query,
        timestamp: new Date().toISOString()
      };

      const result = await this.pluginService.executePlugin(plugin_name, pluginContext);
      
      res.status(200).json({
        message: `Plugin ${plugin_name} test completed`,
        timestamp: new Date().toISOString(),
        test_query: test_query,
        result: result
      });
    } catch (error) {
      console.error('Plugin Test Error:', error);
      next(error);
    }
  };

  /**
   * Simple test method
   */
  simpleTest(): string {
    return 'test works';
  }

  /**
   * Determine if a message should use RAG based on content
   */
  private shouldUseRAG(message: string): boolean {
    const ragKeywords = [
      'how to', 'explain', 'tutorial', 'guide', 'documentation',
      'example', 'best practice', 'implement', 'create', 'build', 'setup',
      'configure', 'install', 'typescript', 'express', 'nodejs', 'api',
      'database', 'security', 'authentication', 'rest', 'interface',
      'function', 'class', 'method', 'variable', 'import', 'export'
    ];

    // More specific patterns for technical questions
    const ragPatterns = [
      /how\s+(?:to|do|can)\s+\w+/i,
      /what\s+is\s+(?:typescript|express|nodejs|javascript|api|database|interface|function|class)/i,
      /explain\s+\w+/i,
      /create\s+(?:a|an)?\s*(?:typescript|express|nodejs|api|interface|function|class)/i,
      /implement\s+\w+/i
    ];

    const lowerMessage = message.toLowerCase();
    
    // Check for keyword matches
    const hasKeyword = ragKeywords.some(keyword => lowerMessage.includes(keyword));
    
    // Check for pattern matches
    const hasPattern = ragPatterns.some(pattern => pattern.test(message));
    
    return hasKeyword || hasPattern;
  }
}
