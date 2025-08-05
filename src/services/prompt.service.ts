import { Message } from '../types';
import { PluginExecutionResult } from '../types/plugin.types';

export interface PromptContext {
  memorySummary: string;
  ragContext?: string;
  ragSources?: string[];
  pluginResults?: PluginExecutionResult[];
  conversationHistory: Message[];
  userQuery: string;
  sessionId: string;
  timestamp: string;
}

export interface SystemPromptConfig {
  includeMemory: boolean;
  includeRAG: boolean;
  includePlugins: boolean;
  maxContextTokens: number;
  temperature: number;
}

export class PromptService {
  private readonly baseSystemPrompt: string;
  private readonly maxTokensEstimate = 4000; // Conservative estimate for context window

  constructor() {
    this.baseSystemPrompt = this.createBaseSystemPrompt();
    console.log('📝 Prompt Service initialized');
  }

  /**
   * Generate comprehensive system prompt with all context
   */
  generateSystemPrompt(context: PromptContext, config: SystemPromptConfig = this.getDefaultConfig()): string {
    const sections: string[] = [];

    // 1. Base system instructions
    sections.push(this.baseSystemPrompt);

    // 2. Memory integration
    if (config.includeMemory && context.memorySummary) {
      sections.push(this.createMemorySection(context.memorySummary));
    }

    // 3. RAG context injection
    if (config.includeRAG && context.ragContext) {
      sections.push(this.createRAGSection(context.ragContext, context.ragSources));
    }

    // 4. Plugin results integration
    if (config.includePlugins && context.pluginResults && context.pluginResults.length > 0) {
      sections.push(this.createPluginSection(context.pluginResults));
    }

    // 5. Conversation context
    sections.push(this.createConversationSection(context.conversationHistory));

    // 6. Current query context
    sections.push(this.createQuerySection(context.userQuery, context.sessionId, context.timestamp));

    // Join all sections
    const fullPrompt = sections.join('\n\n---\n\n');

    // Ensure we don't exceed token limits
    return this.truncateIfNeeded(fullPrompt, config.maxContextTokens);
  }

  /**
   * Generate optimized prompt for RAG scenarios
   */
  generateRAGPrompt(query: string, context: string, sources?: string[]): string {
    return `You are an expert AI assistant with access to a comprehensive knowledge base. Your role is to provide accurate, detailed, and contextually relevant answers using the provided information.

## Instructions:
1. **Primary Source**: Use the provided context as your primary information source
2. **Accuracy**: Ensure all information is factually correct and up-to-date
3. **Citations**: Always reference the source documents when using information from the context
4. **Completeness**: Provide comprehensive answers that fully address the user's question
5. **Clarity**: Structure your response clearly with proper formatting when helpful

## Available Context:
${context}

${sources && sources.length > 0 ? `\n## Sources:
${sources.map((source, idx) => `${idx + 1}. ${source}`).join('\n')}` : ''}

## User Question:
${query}

## Response:
Provide a comprehensive answer using the context above. If the context doesn't contain sufficient information, clearly state what's missing and provide what you can from the available information.`;
  }

  /**
   * Generate memory-focused prompt for conversation continuity
   */
  generateMemoryPrompt(memorySummary: string, recentMessages: Message[]): string {
    const recentContext = recentMessages
      .slice(-4) // Last 4 messages for immediate context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    return `You are an intelligent conversational AI with perfect memory recall. You maintain context across the entire conversation and can reference previous topics naturally.

## Conversation Memory:
${memorySummary}

## Recent Context:
${recentContext}

## Instructions:
- Maintain conversation continuity by referencing previous topics when relevant
- Use the memory summary to understand the broader conversation context
- Be natural and conversational while demonstrating your memory of past interactions
- If asked about something discussed earlier, reference it specifically`;
  }

  /**
   * Generate plugin-integrated prompt
   */
  generatePluginPrompt(pluginResults: PluginExecutionResult[], userQuery: string): string {
    const pluginSummary = pluginResults
      .filter(result => result.result.success)
      .map(result => `**${result.pluginName}**: ${result.result.formattedResponse || result.result.message}`)
      .join('\n\n');

    return `You are an AI assistant with access to specialized tools and real-time data. You have just executed relevant plugins to gather information for the user's request.

## Tool Results:
${pluginSummary}

## User Query:
${userQuery}

## Instructions:
1. Use the tool results as authoritative information for your response
2. Present the information in a clear, user-friendly format
3. If multiple tools provided information, synthesize it into a coherent response
4. Acknowledge the source of real-time or computed data when relevant
5. If tool results are insufficient, clearly explain what information is available

Provide a comprehensive response using the tool results above.`;
  }

  /**
   * Create base system instructions
   */
  private createBaseSystemPrompt(): string {
    return `# AI Assistant System Instructions

You are Claude, an advanced AI assistant created by Anthropic. You are intelligent, helpful, harmless, and honest. You have access to conversation memory, a knowledge base, and specialized tools to provide the best possible assistance.

## Core Principles:
1. **Helpfulness**: Always strive to be as helpful as possible within ethical bounds
2. **Accuracy**: Provide accurate information and acknowledge when you're uncertain
3. **Clarity**: Communicate clearly and adapt your style to the user's needs
4. **Context Awareness**: Use all available context (memory, documents, tools) to enhance responses
5. **Ethical Behavior**: Refuse harmful requests and maintain appropriate boundaries

## Capabilities:
- **Memory**: Access to conversation history and session context
- **Knowledge Base**: Retrieval from curated technical documentation
- **Tools**: Weather data, mathematical calculations, and other specialized functions
- **Reasoning**: Complex problem-solving and analytical thinking

## Response Guidelines:
- Be conversational but professional
- Use formatting (lists, headers, code blocks) when it improves clarity
- Provide specific, actionable information when possible
- Ask clarifying questions when the request is ambiguous
- Reference sources and previous context when relevant`;
  }

  /**
   * Create memory integration section
   */
  private createMemorySection(memorySummary: string): string {
    return `## Conversation Memory
${memorySummary}

Use this context to maintain conversation continuity and reference previous topics when relevant.`;
  }

  /**
   * Create RAG context section
   */
  private createRAGSection(ragContext: string, sources?: string[]): string {
    let section = `## Knowledge Base Context
The following information has been retrieved from the knowledge base and is relevant to the current query:

${ragContext}`;

    if (sources && sources.length > 0) {
      section += `\n\n### Sources:
${sources.map((source, idx) => `${idx + 1}. ${source}`).join('\n')}

When using information from this context, cite the relevant source documents.`;
    }

    return section;
  }

  /**
   * Create plugin results section
   */
  private createPluginSection(pluginResults: PluginExecutionResult[]): string {
    const successfulResults = pluginResults.filter(result => result.result.success);
    
    if (successfulResults.length === 0) {
      return `## Tool Results
No successful tool executions for this query.`;
    }

    const resultsText = successfulResults
      .map(result => `### ${result.pluginName}
${result.result.formattedResponse || result.result.message}`)
      .join('\n\n');

    return `## Tool Results
The following tools have been executed to gather information for this request:

${resultsText}

Use these results as authoritative data in your response.`;
  }

  /**
   * Create conversation context section
   */
  private createConversationSection(conversationHistory: Message[]): string {
    if (conversationHistory.length === 0) {
      return `## Conversation Context
This is the start of a new conversation.`;
    }

    const recentMessages = conversationHistory
      .slice(-6) // Last 6 messages for immediate context
      .map(msg => `**${msg.role}**: ${msg.content}`)
      .join('\n\n');

    return `## Recent Conversation
${recentMessages}`;
  }

  /**
   * Create current query section
   */
  private createQuerySection(userQuery: string, sessionId: string, timestamp: string): string {
    return `## Current Request
**Session**: ${sessionId}
**Time**: ${timestamp}
**Query**: ${userQuery}

Respond to this query using all available context above.`;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): SystemPromptConfig {
    return {
      includeMemory: true,
      includeRAG: true,
      includePlugins: true,
      maxContextTokens: 3500,
      temperature: 0.7
    };
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate prompt if it exceeds token limits
   */
  private truncateIfNeeded(prompt: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens(prompt);
    
    if (estimatedTokens <= maxTokens) {
      return prompt;
    }

    console.log(`⚠️ Prompt too long (${estimatedTokens} tokens), truncating to ${maxTokens} tokens`);
    
    // Simple truncation strategy: keep beginning and end, truncate middle
    const maxChars = maxTokens * 4; // Rough conversion back to characters
    const keepStart = Math.floor(maxChars * 0.6); // Keep 60% from start
    const keepEnd = Math.floor(maxChars * 0.3);   // Keep 30% from end
    
    if (prompt.length <= keepStart + keepEnd) {
      return prompt;
    }

    const start = prompt.substring(0, keepStart);
    const end = prompt.substring(prompt.length - keepEnd);
    
    return `${start}\n\n... [Content truncated for length] ...\n\n${end}`;
  }

  /**
   * Generate context window management summary
   */
  getContextStats(prompt: string): {
    estimatedTokens: number;
    characterCount: number;
    sections: number;
    truncated: boolean;
  } {
    const estimatedTokens = this.estimateTokens(prompt);
    const sections = prompt.split('---').length;
    const truncated = prompt.includes('[Content truncated for length]');

    return {
      estimatedTokens,
      characterCount: prompt.length,
      sections,
      truncated
    };
  }

  /**
   * Advanced prompt optimization for different scenarios
   */
  optimizePromptForScenario(
    context: PromptContext, 
    scenario: 'conversation' | 'rag' | 'plugin' | 'memory',
    maxTokens: number = 3500
  ): string {
    switch (scenario) {
      case 'conversation':
        return this.generateMemoryPrompt(context.memorySummary, context.conversationHistory);
      
      case 'rag':
        if (context.ragContext) {
          return this.generateRAGPrompt(context.userQuery, context.ragContext, context.ragSources);
        }
        break;
      
      case 'plugin':
        if (context.pluginResults && context.pluginResults.length > 0) {
          return this.generatePluginPrompt(context.pluginResults, context.userQuery);
        }
        break;
      
      case 'memory':
        return this.generateMemoryPrompt(context.memorySummary, context.conversationHistory);
    }
    
    // Fallback to comprehensive prompt
    return this.generateSystemPrompt(context, { 
      includeMemory: true, 
      includeRAG: true, 
      includePlugins: true, 
      maxContextTokens: maxTokens,
      temperature: 0.7 
    });
  }

  /**
   * Memory summarization for long conversations
   */
  summarizeMemoryForPrompt(messages: Message[], maxSummaryLength: number = 500): string {
    if (messages.length === 0) {
      return "No conversation history available.";
    }

    // Get key conversation points
    const userMessages = messages.filter(msg => msg.role === 'user');
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');
    
    // Extract topics from recent user messages
    const recentTopics = userMessages
      .slice(-5) // Last 5 user messages
      .map(msg => {
        // Extract key topics (simple keyword extraction)
        const keywords = msg.content
          .toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 3 && !['what', 'how', 'why', 'when', 'where', 'can', 'could', 'would', 'should'].includes(word))
          .slice(0, 3); // Top 3 keywords per message
        return keywords.join(', ');
      })
      .filter(topics => topics.length > 0);

    let summary = `Conversation includes ${messages.length} total messages (${userMessages.length} user, ${assistantMessages.length} assistant). `;
    
    if (recentTopics.length > 0) {
      summary += `Recent topics discussed: ${recentTopics.slice(-3).join('; ')}. `;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      summary += `Last message was from ${lastMessage.role}. `;
    }

    // Truncate if too long
    if (summary.length > maxSummaryLength) {
      summary = summary.substring(0, maxSummaryLength - 3) + '...';
    }

    return summary;
  }

  /**
   * Context window management with intelligent truncation
   */
  manageContextWindow(
    basePrompt: string,
    additionalContext: string[],
    maxTokens: number = 3500
  ): { prompt: string; truncated: boolean; removedSections: number } {
    let currentPrompt = basePrompt;
    let removedSections = 0;
    
    // Add context sections one by one until we hit the limit
    for (const context of additionalContext) {
      const testPrompt = currentPrompt + '\n\n---\n\n' + context;
      
      if (this.estimateTokens(testPrompt) <= maxTokens) {
        currentPrompt = testPrompt;
      } else {
        removedSections = additionalContext.length - additionalContext.indexOf(context);
        break;
      }
    }

    const truncated = removedSections > 0;
    
    return {
      prompt: currentPrompt,
      truncated,
      removedSections
    };
  }

  /**
   * Calculate effective prompt performance metrics
   */
  calculatePromptMetrics(prompt: string): {
    tokenEfficiency: number; // tokens per character
    contextDensity: number;   // information sections per token
    readabilityScore: number; // simple readability metric
  } {
    const tokens = this.estimateTokens(prompt);
    const characters = prompt.length;
    const sections = prompt.split('---').length;
    
    // Simple metrics
    const tokenEfficiency = tokens / characters;
    const contextDensity = sections / tokens * 1000; // normalized per 1000 tokens
    
    // Simple readability score (lower is more readable)
    const sentences = prompt.split(/[.!?]+/).length;
    const words = prompt.split(/\s+/).length;
    const avgWordsPerSentence = words / sentences;
    const readabilityScore = Math.min(avgWordsPerSentence / 20, 1); // normalized 0-1
    
    return {
      tokenEfficiency: Math.round(tokenEfficiency * 1000) / 1000,
      contextDensity: Math.round(contextDensity * 100) / 100,
      readabilityScore: Math.round(readabilityScore * 100) / 100
    };
  }
}
