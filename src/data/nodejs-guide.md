# Node.js Development Guide

Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine. This guide covers essential concepts and best practices for Node.js development.

## What is Node.js?

Node.js allows developers to run JavaScript on the server side, enabling full-stack JavaScript development. It's built on an event-driven, non-blocking I/O model that makes it lightweight and efficient.

## Core Concepts

### Event Loop
Node.js operates on a single-threaded event loop that handles asynchronous operations efficiently:

```javascript
console.log('Start');

setTimeout(() => {
  console.log('Timeout callback');
}, 0);

setImmediate(() => {
  console.log('Immediate callback');
});

console.log('End');

// Output: Start, End, Immediate callback, Timeout callback
```

### Modules System

#### CommonJS (Legacy)
```javascript
// math.js
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

module.exports = { add, subtract };

// app.js
const { add, subtract } = require('./math');
console.log(add(5, 3)); // 8
```

#### ES Modules (Modern)
```javascript
// math.js
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

// app.js
import { add, subtract } from './math.js';
console.log(add(5, 3)); // 8
```

## Package Management with npm

### package.json
```json
{
  "name": "my-app",
  "version": "1.0.0",
  "description": "A sample Node.js application",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "nodemon": "^2.0.20",
    "jest": "^29.3.1"
  }
}
```

### Installing Dependencies
```bash
# Install production dependencies
npm install express mongoose

# Install development dependencies
npm install --save-dev nodemon jest

# Install globally
npm install -g nodemon

# Install from package.json
npm install
```

## File System Operations

### Synchronous vs Asynchronous
```javascript
const fs = require('fs');

// Synchronous (blocking)
try {
  const data = fs.readFileSync('file.txt', 'utf8');
  console.log(data);
} catch (err) {
  console.error(err);
}

// Asynchronous with callbacks
fs.readFile('file.txt', 'utf8', (err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(data);
});

// Asynchronous with promises
const fsPromises = require('fs').promises;

async function readFileAsync() {
  try {
    const data = await fsPromises.readFile('file.txt', 'utf8');
    console.log(data);
  } catch (err) {
    console.error(err);
  }
}
```

## Working with Streams

### Readable Streams
```javascript
const fs = require('fs');

const readableStream = fs.createReadStream('large-file.txt');

readableStream.on('data', (chunk) => {
  console.log(`Received ${chunk.length} bytes`);
});

readableStream.on('end', () => {
  console.log('File reading complete');
});

readableStream.on('error', (err) => {
  console.error('Error reading file:', err);
});
```

### Writable Streams
```javascript
const fs = require('fs');

const writableStream = fs.createWriteStream('output.txt');

writableStream.write('Hello ');
writableStream.write('World!\n');
writableStream.end();

writableStream.on('finish', () => {
  console.log('Writing complete');
});
```

## HTTP Server

### Basic HTTP Server
```javascript
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World!');
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Express.js Framework
```javascript
const express = require('express');
const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello World!' });
});

app.post('/users', (req, res) => {
  const { name, email } = req.body;
  // Process user creation
  res.status(201).json({ id: 1, name, email });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Environment Variables

### Using dotenv
```javascript
// Install: npm install dotenv
require('dotenv').config();

const port = process.env.PORT || 3000;
const dbUrl = process.env.DATABASE_URL || 'localhost:27017';
const apiKey = process.env.API_KEY;

console.log(`Server will run on port ${port}`);
```

### .env file
```env
PORT=3000
DATABASE_URL=mongodb://localhost:27017/myapp
API_KEY=your-secret-api-key
NODE_ENV=development
```

## Error Handling

### Try-Catch with Async/Await
```javascript
async function fetchUserData(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const userData = await response.json();
    return userData;
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
}
```

### Global Error Handling
```javascript
// Uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Express error middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});
```

## Best Practices

### 1. Project Structure
```
my-app/
├── src/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   └── utils/
├── tests/
├── public/
├── .env
├── .gitignore
├── package.json
└── README.md
```

### 2. Security
```javascript
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Security headers
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Input validation
const { body, validationResult } = require('express-validator');

app.post('/users',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Process valid input
  }
);
```

### 3. Performance
```javascript
// Enable gzip compression
const compression = require('compression');
app.use(compression());

// Database connection pooling
const mongoose = require('mongoose');
mongoose.connect(process.env.DATABASE_URL, {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
});

// Caching
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes TTL

app.get('/api/data', async (req, res) => {
  const cacheKey = 'api-data';
  const cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    return res.json(cachedData);
  }
  
  const data = await fetchDataFromDatabase();
  cache.set(cacheKey, data);
  res.json(data);
});
```

## Testing

### Unit Testing with Jest
```javascript
// math.test.js
const { add, subtract } = require('./math');

describe('Math functions', () => {
  test('adds 1 + 2 to equal 3', () => {
    expect(add(1, 2)).toBe(3);
  });

  test('subtracts 5 - 3 to equal 2', () => {
    expect(subtract(5, 3)).toBe(2);
  });
});
```

### Integration Testing
```javascript
const request = require('supertest');
const app = require('./app');

describe('GET /api/users', () => {
  test('should return users list', async () => {
    const response = await request(app)
      .get('/api/users')
      .expect(200);
    
    expect(Array.isArray(response.body)).toBe(true);
  });
});
```

Node.js provides a powerful platform for building scalable server-side applications. Following these practices will help you create robust, maintainable, and efficient Node.js applications.
