# Express.js Complete Guide

Express.js is a minimal and flexible Node.js web application framework that provides a robust set of features for web and mobile applications.

## What is Express.js?

Express.js is built on top of Node.js and provides:
- Robust routing
- Focus on high performance
- Super-high test coverage
- HTTP helpers (redirection, caching, etc)
- View system supporting 14+ template engines

## Installation and Setup

```bash
npm install express
npm install --save-dev @types/express  # For TypeScript
```

### Basic Server Setup

```javascript
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
```

## Core Concepts

### Middleware
Middleware functions are functions that have access to the request object, response object, and the next middleware function.

```javascript
// Application-level middleware
app.use((req, res, next) => {
  console.log('Time:', Date.now());
  next();
});

// Built-in middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
```

### Routing
Express provides a powerful routing mechanism:

```javascript
// GET route
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

// POST route
app.post('/users', (req, res) => {
  const user = req.body;
  // Save user logic
  res.status(201).json(user);
});

// Route parameters
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.json({ id: userId });
});
```

### Error Handling
Express has built-in error handling:

```javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});
```

## Advanced Features

### Router Module
Create modular route handlers:

```javascript
const router = express.Router();

router.get('/profile', (req, res) => {
  res.send('User profile');
});

app.use('/user', router);
```

### Static Files
Serve static files:

```javascript
app.use(express.static('public'));
app.use('/static', express.static('assets'));
```

### Template Engines
Express supports various template engines:

```javascript
app.set('view engine', 'ejs');
app.set('views', './views');

app.get('/profile', (req, res) => {
  res.render('profile', { user: userData });
});
```

## Best Practices

1. **Use Environment Variables**: Store configuration in environment variables
2. **Implement Proper Error Handling**: Always handle errors gracefully
3. **Use Middleware Wisely**: Keep middleware functions small and focused
4. **Secure Your App**: Use helmet.js and other security middleware
5. **Structure Your Code**: Organize routes and middleware properly

## Security Considerations

- Use HTTPS in production
- Validate and sanitize user input
- Implement rate limiting
- Use security headers with helmet.js
- Keep dependencies updated

## Performance Tips

- Use compression middleware
- Implement caching strategies
- Use clustering for CPU-intensive tasks
- Monitor and profile your application
- Optimize database queries

Express.js provides a solid foundation for building web applications and APIs with Node.js, offering flexibility while maintaining simplicity.
