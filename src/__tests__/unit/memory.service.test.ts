import { MemoryService } from '../../services/memory.service';
import { Message } from '../../types';

describe('MemoryService', () => {
  let memoryService: MemoryService;
  const sessionId = 'test-session-123';

  beforeEach(() => {
    memoryService = new MemoryService();
  });

  afterEach(() => {
    // Clean up sessions
    memoryService.clearSession(sessionId);
  });

  afterAll(() => {
    // Cleanup service
    memoryService.destroy();
  });

  describe('addMessage', () => {
    it('should add a message to a new session', () => {
      const message: Message = {
        role: 'user',
        content: 'Hello world',
        timestamp: new Date().toISOString()
      };

      memoryService.addMessage(sessionId, message);
      const recentMessages = memoryService.getRecentMessages(sessionId, 10);

      expect(recentMessages).toHaveLength(1);
      expect(recentMessages[0]).toEqual(message);
    });

    it('should add multiple messages to the same session', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString() },
        { role: 'user', content: 'How are you?', timestamp: new Date().toISOString() }
      ];

      messages.forEach(msg => memoryService.addMessage(sessionId, msg));
      const recentMessages = memoryService.getRecentMessages(sessionId, 10);

      expect(recentMessages).toHaveLength(3);
      expect(recentMessages).toEqual(messages);
    });

    it('should maintain separate histories for different sessions', () => {
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-2';
      
      const message1: Message = { role: 'user', content: 'Message for session 1', timestamp: new Date().toISOString() };
      const message2: Message = { role: 'user', content: 'Message for session 2', timestamp: new Date().toISOString() };

      memoryService.addMessage(sessionId1, message1);
      memoryService.addMessage(sessionId2, message2);

      expect(memoryService.getRecentMessages(sessionId1, 10)).toEqual([message1]);
      expect(memoryService.getRecentMessages(sessionId2, 10)).toEqual([message2]);

      // Cleanup
      memoryService.clearSession(sessionId1);
      memoryService.clearSession(sessionId2);
    });

    it('should add timestamp if not provided', () => {
      const messageWithoutTimestamp: Message = {
        role: 'user',
        content: 'Message without timestamp',
        timestamp: '' // Will be overwritten by the service
      };

      memoryService.addMessage(sessionId, messageWithoutTimestamp);
      const recentMessages = memoryService.getRecentMessages(sessionId, 1);

      expect(recentMessages[0].timestamp).toBeDefined();
      expect(typeof recentMessages[0].timestamp).toBe('string');
      expect(recentMessages[0].timestamp).not.toBe('');
    });
  });

  describe('getRecentMessages', () => {
    it('should return empty array for non-existent session', () => {
      const messages = memoryService.getRecentMessages('non-existent-session', 5);
      expect(messages).toEqual([]);
    });

    it('should return limited number of recent messages', () => {
      const messages: Message[] = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        timestamp: new Date().toISOString()
      }));

      messages.forEach(msg => memoryService.addMessage(sessionId, msg));
      const recentMessages = memoryService.getRecentMessages(sessionId, 3);

      expect(recentMessages).toHaveLength(3);
      expect(recentMessages).toEqual(messages.slice(-3));
    });

    it('should return all messages if limit exceeds history length', () => {
      const message: Message = {
        role: 'user',
        content: 'Only message',
        timestamp: new Date().toISOString()
      };

      memoryService.addMessage(sessionId, message);
      const recentMessages = memoryService.getRecentMessages(sessionId, 10);

      expect(recentMessages).toHaveLength(1);
      expect(recentMessages).toEqual([message]);
    });
  });

  describe('getConversationContext', () => {
    it('should return recent messages for context', () => {
      const messages: Message[] = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        timestamp: new Date().toISOString()
      }));

      messages.forEach(msg => memoryService.addMessage(sessionId, msg));
      const context = memoryService.getConversationContext(sessionId, 4);

      expect(context).toHaveLength(4);
      expect(context).toEqual(messages.slice(-4));
    });

    it('should return empty array for non-existent session', () => {
      const context = memoryService.getConversationContext('non-existent', 5);
      expect(context).toEqual([]);
    });
  });

  describe('generateMemorySummary', () => {
    it('should generate summary for session with messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello, I have a question about TypeScript', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Sure, I can help with TypeScript questions', timestamp: new Date().toISOString() },
        { role: 'user', content: 'How do I define interfaces?', timestamp: new Date().toISOString() }
      ];

      messages.forEach(msg => memoryService.addMessage(sessionId, msg));
      const summary = memoryService.generateMemorySummary(sessionId);

      expect(summary).toBeDefined();
      expect(typeof summary).toBe('string');
      expect(summary).toContain('3 total messages');
      expect(summary).toContain('Recent topics');
    });

    it('should return default message for empty session', () => {
      const summary = memoryService.generateMemorySummary('non-existent');
      expect(summary).toBe('No previous conversation history.');
    });
  });

  describe('clearSession', () => {
    it('should remove session and return true', () => {
      const message: Message = {
        role: 'user',
        content: 'This will be cleared',
        timestamp: new Date().toISOString()
      };

      memoryService.addMessage(sessionId, message);
      expect(memoryService.getRecentMessages(sessionId, 10)).toHaveLength(1);

      const result = memoryService.clearSession(sessionId);
      expect(result).toBe(true);
      expect(memoryService.getRecentMessages(sessionId, 10)).toEqual([]);
    });

    it('should return false for non-existent session', () => {
      const result = memoryService.clearSession('non-existent');
      expect(result).toBe(false);
    });

    it('should not affect other sessions when clearing one', () => {
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-2';
      
      memoryService.addMessage(sessionId1, { role: 'user', content: 'Keep me', timestamp: new Date().toISOString() });
      memoryService.addMessage(sessionId2, { role: 'user', content: 'Delete me', timestamp: new Date().toISOString() });

      memoryService.clearSession(sessionId2);

      expect(memoryService.getRecentMessages(sessionId1, 10)).toHaveLength(1);
      expect(memoryService.getRecentMessages(sessionId2, 10)).toEqual([]);

      // Cleanup
      memoryService.clearSession(sessionId1);
    });
  });

  describe('getSessionStats', () => {
    it('should return correct statistics for session', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Hi!', timestamp: new Date().toISOString() },
        { role: 'user', content: 'How are you?', timestamp: new Date().toISOString() }
      ];

      messages.forEach(msg => memoryService.addMessage(sessionId, msg));
      const stats = memoryService.getSessionStats(sessionId);

      expect(stats).not.toBeNull();
      expect(stats!.messageCount).toBe(3);
      expect(stats!.userMessages).toBe(2);
      expect(stats!.assistantMessages).toBe(1);
      expect(stats!.sessionAge).toBeDefined();
      expect(stats!.lastActivity).toBeDefined();
    });

    it('should return null for non-existent session', () => {
      const stats = memoryService.getSessionStats('non-existent');
      expect(stats).toBeNull();
    });
  });

  describe('getAllSessions', () => {
    it('should return list of active sessions', () => {
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-2';
      
      memoryService.addMessage(sessionId1, { role: 'user', content: 'Message 1', timestamp: new Date().toISOString() });
      memoryService.addMessage(sessionId2, { role: 'user', content: 'Message 2', timestamp: new Date().toISOString() });

      const sessions = memoryService.getAllSessions();
      
      expect(sessions.length).toBeGreaterThanOrEqual(2);
      expect(sessions.some(s => s.sessionId === sessionId1)).toBe(true);
      expect(sessions.some(s => s.sessionId === sessionId2)).toBe(true);

      // Cleanup
      memoryService.clearSession(sessionId1);
      memoryService.clearSession(sessionId2);
    });

    it('should return empty array when no sessions exist', () => {
      const newMemoryService = new MemoryService();
      const sessions = newMemoryService.getAllSessions();
      
      expect(sessions).toEqual([]);
      
      newMemoryService.destroy();
    });
  });
});
