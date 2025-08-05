import { Router } from 'express';
import { AgentController } from '../controllers/agent.controller';

export class AgentRoutes {
  public router: Router;
  private agentController: AgentController;

  constructor() {
    this.router = Router();
    this.agentController = new AgentController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Main agent endpoint
    this.router.post('/message', this.agentController.handleMessage);

    // Session management endpoints
    this.router.get('/session/:sessionId', this.agentController.getSessionInfo);
    this.router.delete('/session/:sessionId', this.agentController.clearSession);

    // Agent health check
    this.router.get('/health', this.agentController.healthCheck);

    // Test endpoint
    this.router.get('/test', this.agentController.testRAG);

    // RAG-specific endpoints
    this.router.get('/rag/health', this.agentController.ragHealthCheck);
    this.router.post('/search', this.agentController.searchDocuments);
    this.router.post('/rag/refresh', this.agentController.refreshRAGIndex);

    // Plugin-specific endpoints
    this.router.get('/plugins/health', this.agentController.pluginHealthCheck);
    this.router.get('/plugins', this.agentController.listPlugins);
    this.router.post('/plugins/test', this.agentController.testPlugin);

    // Prompt engineering endpoints
    this.router.post('/prompt/test', this.agentController.testPromptSystem);
    this.router.post('/prompt/optimize', this.agentController.testPromptOptimization);
  }
}

// Export router instance
export const agentRoutes = new AgentRoutes().router;
