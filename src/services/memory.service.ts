import { Session, Message, ApiError } from '../types';

export class MemoryService {
  private sessions: Map<string, Session>;
  private readonly maxSessionAge: number; // in milliseconds
  private readonly maxMessagesPerSession: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.sessions = new Map();
    this.maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
    this.maxMessagesPerSession = 50; // Keep last 50 messages

    // Start cleanup interval (runs every hour)
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);

    console.log('🧠 Memory Service initialized');
  }

  /**
   * Get or create a session
   */
  getSession(sessionId: string): Session {
    const existingSession = this.sessions.get(sessionId);
    
    if (existingSession) {
      // Update last activity
      existingSession.last_activity = new Date().toISOString();
      return existingSession;
    }

    // Create new session
    const newSession: Session = {
      id: sessionId,
      messages: [],
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
    };

    this.sessions.set(sessionId, newSession);
    console.log(`📝 Created new session: ${sessionId}`);
    
    return newSession;
  }

  /**
   * Add a message to a session
   */
  addMessage(sessionId: string, message: Message): void {
    const session = this.getSession(sessionId);
    
    // Add timestamp if not provided
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }

    session.messages.push(message);
    session.last_activity = new Date().toISOString();

    // Trim messages if exceeding limit
    if (session.messages.length > this.maxMessagesPerSession) {
      const messagesToRemove = session.messages.length - this.maxMessagesPerSession;
      session.messages.splice(0, messagesToRemove);
      console.log(`🗑️ Trimmed ${messagesToRemove} old messages from session ${sessionId}`);
    }

    console.log(`💬 Added message to session ${sessionId}. Total messages: ${session.messages.length}`);
  }

  /**
   * Get recent messages from a session
   */
  getRecentMessages(sessionId: string, limit: number = 10): Message[] {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      console.log(`⚠️ Session ${sessionId} not found`);
      return [];
    }

    // Return last N messages
    const messages = session.messages.slice(-limit);
    console.log(`📖 Retrieved ${messages.length} recent messages from session ${sessionId}`);
    
    return messages;
  }

  /**
   * Get conversation context for LLM (formatted)
   */
  getConversationContext(sessionId: string, includeLastN: number = 6): Message[] {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.messages.length === 0) {
      return [];
    }

    // Get last N messages for context
    const recentMessages = session.messages.slice(-includeLastN);
    
    console.log(`🧠 Retrieved conversation context for session ${sessionId}: ${recentMessages.length} messages`);
    
    return recentMessages;
  }

  /**
   * Generate memory summary for system prompt
   */
  generateMemorySummary(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.messages.length === 0) {
      return "No previous conversation history.";
    }

    const messageCount = session.messages.length;
    const lastMessage = session.messages[session.messages.length - 1];
    
    // Get last 2 user messages for context
    const userMessages = session.messages
      .filter(msg => msg.role === 'user')
      .slice(-2);

    let summary = `Session Info: ${messageCount} total messages. `;
    
    if (userMessages.length > 0) {
      summary += "Recent topics: ";
      summary += userMessages
        .map(msg => `"${msg.content.substring(0, 100)}..."`)
        .join(", ");
    }

    summary += ` Last activity: ${this.formatTimeAgo(lastMessage.timestamp)}`;

    return summary;
  }

  /**
   * Clear a session
   */
  clearSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      console.log(`🗑️ Cleared session: ${sessionId}`);
    }
    return deleted;
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): {
    messageCount: number;
    userMessages: number;
    assistantMessages: number;
    sessionAge: string;
    lastActivity: string;
  } | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    const userMessages = session.messages.filter(msg => msg.role === 'user').length;
    const assistantMessages = session.messages.filter(msg => msg.role === 'assistant').length;

    return {
      messageCount: session.messages.length,
      userMessages,
      assistantMessages,
      sessionAge: this.formatTimeAgo(session.created_at),
      lastActivity: this.formatTimeAgo(session.last_activity),
    };
  }

  /**
   * Get all active sessions (for debugging)
   */
  getAllSessions(): { sessionId: string; messageCount: number; lastActivity: string }[] {
    return Array.from(this.sessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      messageCount: session.messages.length,
      lastActivity: session.last_activity,
    }));
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    this.sessions.forEach((session, sessionId) => {
      const lastActivityTime = new Date(session.last_activity).getTime();
      const ageInMs = now - lastActivityTime;

      if (ageInMs > this.maxSessionAge) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  /**
   * Format time ago helper
   */
  private formatTimeAgo(timestamp: string): string {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diffInMs = now - time;

    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays > 0) {
      return `${diffInDays}d ago`;
    } else if (diffInHours > 0) {
      return `${diffInHours}h ago`;
    } else if (diffInMinutes > 0) {
      return `${diffInMinutes}m ago`;
    } else {
      return 'just now';
    }
  }

  /**
   * Cleanup resources when shutting down
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
    console.log('🧠 Memory Service destroyed');
  }
}
