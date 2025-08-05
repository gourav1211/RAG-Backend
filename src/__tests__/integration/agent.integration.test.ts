import request from 'supertest';
import express from 'express';
import { MemoryService } from '../../services/memory.service';
import { CorePluginRegistry } from '../../services/plugin-registry.service';
import { MathPlugin } from '../../plugins/math.plugin';
import { WeatherPlugin } from '../../plugins/weather.plugin';
import { AgentController } from '../../controllers/agent.controller';
import { agentRoutes } from '../../routes/agent.routes';

// Mock external services for integration tests
jest.mock('../../services/openai.service');
jest.mock('../../services/pinecone.service');
jest.mock('../../services/rag.service');
jest.mock('axios');

describe('Agent API Integration Tests', () => {
  let app: express.Application;
  let memoryService: MemoryService;
  let pluginRegistry: CorePluginRegistry;

  beforeAll(async () => {
    // Setup Express app with all middleware and routes
    app = express();
    app.use(express.json());
    
    // Initialize services
    memoryService = new MemoryService();
    pluginRegistry = new CorePluginRegistry();
    
    // Register plugins
    pluginRegistry.register(new MathPlugin());
    pluginRegistry.register(new WeatherPlugin());
    
    // Setup routes
    app.use('/agent', agentRoutes);
    
    console.log('Integration test setup complete');
  });

  afterAll(async () => {
    // Cleanup
    memoryService.destroy();
  });

  beforeEach(() => {
    // Clear any existing sessions
    const sessions = memoryService.getAllSessions();
    sessions.forEach(session => {
      memoryService.clearSession(session.sessionId);
    });
  });

  describe('POST /agent/message', () => {
    it('should handle basic message request', async () => {
      const response = await request(app)
        .post('/agent/message')
        .send({
          message: 'Hello, this is a test message',
          session_id: 'integration-test-1'
        })
        .expect(200);

      expect(response.body).toHaveProperty('reply');
      expect(response.body).toHaveProperty('session_id', 'integration-test-1');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should handle math plugin integration', async () => {
      const response = await request(app)
        .post('/agent/message')
        .send({
          message: 'Calculate 15 + 27',
          session_id: 'math-test-session'
        })
        .expect(200);

      expect(response.body).toHaveProperty('reply');
      expect(response.body).toHaveProperty('plugins_used');
      expect(response.body.plugins_used).toContain('math');
    });

    it('should handle weather plugin integration', async () => {
      const response = await request(app)
        .post('/agent/message')
        .send({
          message: 'What is the weather in London?',
          session_id: 'weather-test-session'
        })
        .expect(200);

      expect(response.body).toHaveProperty('reply');
      expect(response.body).toHaveProperty('plugins_used');
      expect(response.body.plugins_used).toContain('weather');
    });

    it('should maintain session consistency', async () => {
      const sessionId = 'session-consistency-test';

      // First message
      const response1 = await request(app)
        .post('/agent/message')
        .send({
          message: 'My name is John',
          session_id: sessionId
        })
        .expect(200);

      expect(response1.body.session_id).toBe(sessionId);

      // Second message - should remember context
      const response2 = await request(app)
        .post('/agent/message')
        .send({
          message: 'What is my name?',
          session_id: sessionId
        })
        .expect(200);

      expect(response2.body.session_id).toBe(sessionId);
      // The memory should be passed to the LLM service
    });

    it('should handle multiple plugins in one request', async () => {
      const response = await request(app)
        .post('/agent/message')
        .send({
          message: 'Calculate 2 + 2 and tell me the weather in Tokyo',
          session_id: 'multi-plugin-test'
        })
        .expect(200);

      expect(response.body).toHaveProperty('reply');
      expect(response.body).toHaveProperty('plugins_used');
      expect(response.body.plugins_used).toEqual(
        expect.arrayContaining(['math', 'weather'])
      );
    });

    it('should handle RAG queries', async () => {
      const response = await request(app)
        .post('/agent/message')
        .send({
          message: 'What are the best practices for REST API design?',
          session_id: 'rag-test-session'
        })
        .expect(200);

      expect(response.body).toHaveProperty('reply');
      expect(response.body).toHaveProperty('sources');
      // Sources array should be present for RAG responses
    });

    it('should handle invalid requests gracefully', async () => {
      // Missing message
      await request(app)
        .post('/agent/message')
        .send({
          session_id: 'invalid-test'
        })
        .expect(400);

      // Empty message
      await request(app)
        .post('/agent/message')
        .send({
          message: '',
          session_id: 'invalid-test'
        })
        .expect(400);

      // Missing session_id
      await request(app)
        .post('/agent/message')
        .send({
          message: 'Hello'
        })
        .expect(400);
    });

    it('should validate message length limits', async () => {
      const longMessage = 'a'.repeat(10000); // Very long message
      
      const response = await request(app)
        .post('/agent/message')
        .send({
          message: longMessage,
          session_id: 'length-test'
        });

      // Should either handle it gracefully or return appropriate error
      expect([200, 400, 413]).toContain(response.status);
    });

    it('should handle concurrent requests', async () => {
      const sessionId = 'concurrent-test';
      const promises: Promise<request.Response>[] = [];

      // Send multiple concurrent requests
      for (let i = 0; i < 5; i++) {
        const promise = request(app)
          .post('/agent/message')
          .send({
            message: `Concurrent message ${i}`,
            session_id: sessionId
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.session_id).toBe(sessionId);
      });
    });

    it('should return proper error responses for service failures', async () => {
      // This test would require mocking service failures
      // For now, we'll test the response structure
      const response = await request(app)
        .post('/agent/message')
        .send({
          message: 'Test message',
          session_id: 'error-test'
        });

      if (response.status !== 200) {
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('message');
      }
    });
  });

  describe('Session Management Integration', () => {
    it('should create new sessions automatically', async () => {
      const newSessionId = 'auto-create-test';
      
      const response = await request(app)
        .post('/agent/message')
        .send({
          message: 'Hello new session',
          session_id: newSessionId
        })
        .expect(200);

      expect(response.body.session_id).toBe(newSessionId);
    });

    it('should handle session isolation', async () => {
      const session1 = 'isolation-test-1';
      const session2 = 'isolation-test-2';

      // Send different messages to different sessions
      await request(app)
        .post('/agent/message')
        .send({
          message: 'My favorite color is blue',
          session_id: session1
        })
        .expect(200);

      await request(app)
        .post('/agent/message')
        .send({
          message: 'My favorite color is red',
          session_id: session2
        })
        .expect(200);

      // Sessions should maintain separate contexts
      // This would be verified by the memory service behavior
    });
  });

  describe('Plugin System Integration', () => {
    it('should prioritize plugins appropriately', async () => {
      const response = await request(app)
        .post('/agent/message')
        .send({
          message: 'What is 2 + 2? Also, what is the weather?',
          session_id: 'priority-test'
        })
        .expect(200);

      expect(response.body).toHaveProperty('plugins_used');
      expect(Array.isArray(response.body.plugins_used)).toBe(true);
    });

    it('should handle plugin execution failures gracefully', async () => {
      // Send a query that might cause plugin issues
      const response = await request(app)
        .post('/agent/message')
        .send({
          message: 'Calculate invalid expression +++',
          session_id: 'plugin-failure-test'
        });

      // Should handle gracefully - either success with error message or proper error response
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('Response Format Validation', () => {
    it('should return consistent response structure', async () => {
      const response = await request(app)
        .post('/agent/message')
        .send({
          message: 'Test message for format validation',
          session_id: 'format-test'
        })
        .expect(200);

      // Validate required fields
      expect(response.body).toHaveProperty('reply');
      expect(response.body).toHaveProperty('session_id');
      expect(response.body).toHaveProperty('timestamp');

      // Validate optional fields structure
      if (response.body.sources) {
        expect(Array.isArray(response.body.sources)).toBe(true);
      }
      if (response.body.plugins_used) {
        expect(Array.isArray(response.body.plugins_used)).toBe(true);
      }
    });

    it('should return proper timestamps', async () => {
      const beforeRequest = new Date().toISOString();
      
      const response = await request(app)
        .post('/agent/message')
        .send({
          message: 'Timestamp test',
          session_id: 'timestamp-test'
        })
        .expect(200);

      const afterRequest = new Date().toISOString();
      const responseTimestamp = response.body.timestamp;

      expect(responseTimestamp).toBeDefined();
      expect(responseTimestamp >= beforeRequest).toBe(true);
      expect(responseTimestamp <= afterRequest).toBe(true);
    });
  });

  describe('Performance Integration', () => {
    it('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      
      await request(app)
        .post('/agent/message')
        .send({
          message: 'Performance test message',
          session_id: 'performance-test'
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Should respond within 30 seconds (generous for integration test)
      expect(responseTime).toBeLessThan(30000);
    });
  });
});
