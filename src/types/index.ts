// Core API Types
export interface AgentRequest {
  message: string;
  session_id: string;
}

export interface AgentResponse {
  reply: string;
  session_id: string;
  timestamp: string;
  sources?: string[];
  plugins_used?: string[];
}

// Memory Management Types
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface Session {
  id: string;
  messages: Message[];
  created_at: string;
  last_activity: string;
}

// Plugin Types
export interface PluginResult {
  success: boolean;
  data: any;
  error?: string;
  plugin_name: string;
}

export interface Plugin {
  name: string;
  description: string;
  keywords: string[];
  execute: (query: string) => Promise<PluginResult>;
}

// RAG Types
export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    chunk_index: number;
    total_chunks: number;
  };
  embedding?: number[];
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  similarity: number;
}

// LLM Types
export interface LLMRequest {
  messages: Message[];
  system_prompt?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Error Types
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, status: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}
