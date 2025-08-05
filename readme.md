# 🚀 AI Agent Server with RAG + Plugin System

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)

A sophisticated AI agent backend system built with TypeScript, featuring Retrieval-Augmented Generation (RAG), plugin execution, and session-based memory management.

## 🌟 Features

- **🧠 LLM-Powered Agent**: OpenAI GPT-4 integration with intelligent response generation
- **📚 RAG System**: Vector-based document retrieval with Pinecone for contextual responses
- **🔌 Plugin Architecture**: Extensible plugin system with weather and math capabilities
- **💾 Session Memory**: Persistent conversation history per session
- **🎯 Smart Routing**: Automatic detection of when to use RAG, plugins, or standard responses
- **🔒 Production Ready**: Security middleware, error handling, and comprehensive logging

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │────│  Express API    │────│  Agent Core     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              │                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Middleware    │────│     Routes      │────│ Plugin System   │
│ • CORS          │    │ • /agent/*      │    │ • Weather       │
│ • Helmet        │    │ • /health       │    │ • Math          │
│ • Body Parser   │    └─────────────────┘    └─────────────────┘
└─────────────────┘                                   │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Memory Service │────│   RAG Service   │────│  OpenAI Service │
│ • Sessions      │    │ • Pinecone      │    │ • GPT-4         │
│ • History       │    │ • Embeddings    │    │ • Completions   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key
- Pinecone API key (optional for RAG)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/gourav1211/RAG-Backend.git
   cd RAG-Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Required
   OPENAI_API_KEY=sk-proj-your-openai-key-here
   
   # Optional (for RAG functionality)
   PINECONE_API_KEY=your-pinecone-key
   PINECONE_ENVIRONMENT=your-environment
   PINECONE_INDEX_NAME=your-index-name
   
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   ```

4. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

The server will start on `http://localhost:3000`

## 📡 API Endpoints

### Core Agent Endpoints

#### Send Message to Agent
```http
POST /agent/message
Content-Type: application/json

{
  "message": "Hello, how can you help me?",
  "session_id": "user-123"
}
```

**Response:**
```json
{
  "reply": "Hello! I'm an AI assistant that can help you with various tasks...",
  "session_id": "user-123",
  "timestamp": "2025-08-05T17:23:09.322Z",
  "sources": ["express-guide.md"],
  "plugins_used": ["weather"]
}
```

#### Get Session Information
```http
GET /agent/session/{sessionId}
```

#### Clear Session
```http
DELETE /agent/session/{sessionId}
```

### System Health

#### Server Health Check
```http
GET /health
```

#### Agent Health Check
```http
GET /agent/health
```

#### RAG System Health
```http
GET /agent/rag/health
```

### Plugin System

#### List Available Plugins
```http
GET /agent/plugins
```

#### Test Specific Plugin
```http
POST /agent/plugins/test
Content-Type: application/json

{
  "plugin_name": "weather",
  "test_query": "What's the weather in New York?"
}
```

### RAG Operations

#### Search Documents
```http
POST /agent/search
Content-Type: application/json

{
  "query": "How to implement Express.js middleware?",
  "limit": 5
}
```

#### Initialize RAG System
```http
POST /agent/rag/refresh
```

## 🧪 Sample API Calls

### Basic Conversation
```bash
curl -X POST "http://localhost:3000/agent/message" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, I need help with TypeScript",
    "session_id": "demo-session-1"
  }'
```

### Weather Query (Plugin)
```bash
curl -X POST "http://localhost:3000/agent/message" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the weather like in London?",
    "session_id": "weather-session"
  }'
```

### Math Query (Plugin)
```bash
curl -X POST "http://localhost:3000/agent/message" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Calculate 25 * 4 + 100",
    "session_id": "math-session"
  }'
```

### Technical Question (RAG)
```bash
curl -X POST "http://localhost:3000/agent/message" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I implement authentication in Express.js?",
    "session_id": "tech-session"
  }'
```

### Document Search
```bash
curl -X POST "http://localhost:3000/agent/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Express.js middleware patterns",
    "limit": 3
  }'
```

## 🎯 Agent Intelligence Flow

### 1. Request Processing
```typescript
POST /agent/message → Validation → Session Management
```

### 2. Intent Detection
```typescript
Message Analysis → {
  shouldUseRAG: boolean,
  applicablePlugins: Plugin[],
  conversationContext: Message[]
}
```

### 3. Multi-Modal Response Generation

**Standard Response**
```
User Message → Memory Context → OpenAI → Response
```

**RAG-Enhanced Response**
```
User Message → Vector Search → Context Retrieval → Enhanced Prompt → OpenAI → Response
```

**Plugin-Powered Response**
```
User Message → Plugin Detection → Plugin Execution → Result Integration → OpenAI → Response
```

**Combined Response** (Most Powerful)
```
User Message → RAG + Plugins → Comprehensive Context → OpenAI → Enhanced Response
```

### 4. Memory Management
- Session-based conversation history
- Automatic memory summarization
- Context window management
- Token optimization

## 🔌 Plugin System

### Available Plugins

#### 1. Weather Plugin
- **Triggers**: Weather-related queries
- **Keywords**: weather, temperature, forecast, climate
- **API**: OpenWeatherMap integration
- **Example**: "What's the weather in Tokyo?"

#### 2. Math Plugin
- **Triggers**: Mathematical expressions
- **Keywords**: calculate, math, solve, equation
- **Features**: Basic arithmetic, complex expressions
- **Example**: "Calculate 15 * 3 + 27"

### Creating Custom Plugins

```typescript
import { Plugin, PluginContext, PluginResult } from '../types/plugin.types';

export class CustomPlugin implements Plugin {
  name = 'custom';
  description = 'Custom functionality';
  version = '1.0.0';
  keywords = ['custom', 'special'];

  async canHandle(context: PluginContext): Promise<boolean> {
    // Implementation logic
    return this.keywords.some(keyword => 
      context.query.toLowerCase().includes(keyword)
    );
  }

  async execute(context: PluginContext): Promise<PluginResult> {
    // Plugin execution logic
    return {
      success: true,
      message: 'Custom plugin executed',
      formattedResponse: 'Custom response'
    };
  }
}
```

## 📚 RAG Implementation

### Document Sources
- `express-guide.md` - Express.js framework documentation
- `nodejs-guide.md` - Node.js development patterns
- `typescript-intro.md` - TypeScript fundamentals
- `rest-api-design.md` - RESTful API best practices
- `security-guide.md` - Security implementation guidelines

### Vector Database (Pinecone)
- **Embeddings**: OpenAI text-embedding-3-small
- **Dimensions**: 1536
- **Similarity**: Cosine similarity
- **Retrieval**: Top-3 relevant chunks per query

### RAG Workflow
1. **Document Processing**: Chunking and embedding
2. **Query Analysis**: Intent detection and embedding
3. **Similarity Search**: Vector-based retrieval
4. **Context Assembly**: Relevant chunks compilation
5. **Response Generation**: Context-aware LLM completion

## 🛠️ Development

### Project Structure
```
src/
├── config/           # Environment configuration
├── controllers/      # Request handlers
├── services/         # Business logic
├── plugins/          # Plugin implementations
├── routes/           # API route definitions
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
├── data/             # Knowledge base documents
└── __tests__/        # Test suites
```

### Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm test             # Run test suite
npm run test:watch   # Watch mode testing
npm run lint         # ESLint checking
```

### Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testPathPattern=agent.integration
npm test -- --testPathPattern=unit
```

## 🚀 Deployment

### Vercel Deployment
The application is configured for Vercel deployment with `vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/server.ts"
    }
  ]
}
```

### Environment Variables
Set these in your deployment platform:
- `OPENAI_API_KEY`
- `PINECONE_API_KEY` (optional)
- `PINECONE_ENVIRONMENT` (optional)
- `PINECONE_INDEX_NAME` (optional)
- `NODE_ENV=production`

## 📊 Performance Features

- **Smart Caching**: Memory and embedding caching
- **Token Optimization**: Context window management
- **Concurrent Processing**: Parallel plugin execution
- **Error Recovery**: Graceful fallback mechanisms
- **Request Throttling**: Built-in rate limiting

## 🔒 Security

- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing
- **Input Validation**: Request sanitization
- **Error Handling**: Secure error responses
- **Environment Variables**: Secure configuration

## 📈 Monitoring

- **Request Logging**: Comprehensive request tracking
- **Health Checks**: Multi-level system monitoring
- **Error Tracking**: Detailed error logging
- **Performance Metrics**: Response time monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Live Deployment**: [Your Vercel URL Here]

**Developer**: Built with ❤️ for the AI Agent Challenge
