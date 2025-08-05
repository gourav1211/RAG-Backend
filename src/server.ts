// Load environment variables first
import './config/env';

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApiError } from './types';
import { agentRoutes } from './routes/agent.routes';

class Server {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000', 10);
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS middleware
    this.app.use(cors());

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
      });
    });

    // Agent routes
    this.app.use('/agent', agentRoutes);

    // API routes placeholder
    this.app.use('/api', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'API endpoint not found',
        message: 'This endpoint is not yet implemented'
      });
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.status(200).json({
        message: 'AI Agent Server is running',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          agent_message: '/agent/message (POST)',
          agent_session: '/agent/session/:sessionId (GET, DELETE)',
          agent_health: '/agent/health (GET)'
        }
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Route not found',
        message: `The route ${req.originalUrl} does not exist`
      });
    });

    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Global error handler:', error);

      if (error instanceof ApiError) {
        return res.status(error.status).json({
          error: error.message,
          code: error.code,
          details: error.details
        });
      }

      // Default error response
      return res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });
  }

  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`🚀 AI Agent Server is running on port ${this.port}`);
      console.log(`🏥 Health check: http://localhost:${this.port}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  }

  public getApp(): Application {
    return this.app;
  }
}

// Start the server
if (require.main === module) {
  const server = new Server();
  server.start();
}

export default Server;
