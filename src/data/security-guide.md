# Web Development Security Guide

Security is a critical aspect of web development. This guide covers essential security practices, common vulnerabilities, and how to protect your applications.

## Common Security Vulnerabilities

### 1. SQL Injection

**Description:** Malicious SQL code injection through user inputs.

**Example of vulnerable code:**
```javascript
// NEVER do this
const query = `SELECT * FROM users WHERE email = '${req.body.email}'`;
db.query(query, callback);
```

**Prevention:**
```javascript
// Use parameterized queries
const query = 'SELECT * FROM users WHERE email = ?';
db.query(query, [req.body.email], callback);

// Or with ORMs
const user = await User.findOne({ where: { email: req.body.email } });
```

### 2. Cross-Site Scripting (XSS)

**Description:** Injection of malicious scripts into web pages.

**Types:**
- **Stored XSS:** Script stored in database
- **Reflected XSS:** Script reflected in response
- **DOM-based XSS:** Client-side script manipulation

**Prevention:**
```javascript
// Input validation
const validator = require('validator');
const sanitizedInput = validator.escape(userInput);

// Content Security Policy
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; script-src 'self' 'unsafe-inline'");
  next();
});

// Use templating engines that auto-escape
// React automatically escapes JSX
const element = <div>{userInput}</div>; // Safe

// HTML sanitization
const DOMPurify = require('dompurify');
const clean = DOMPurify.sanitize(dirty);
```

### 3. Cross-Site Request Forgery (CSRF)

**Description:** Unauthorized commands transmitted from a user that the web application trusts.

**Prevention:**
```javascript
const csrf = require('csurf');

// Enable CSRF protection
app.use(csrf({ cookie: true }));

// Include CSRF token in forms
app.get('/form', (req, res) => {
  res.render('send', { csrfToken: req.csrfToken() });
});

// Frontend: Include token in requests
fetch('/api/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'CSRF-Token': csrfToken
  },
  body: JSON.stringify(data)
});
```

## Authentication and Authorization

### JWT (JSON Web Tokens)

#### Implementation
```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// User registration
async function registerUser(req, res) {
  try {
    const { email, password } = req.body;
    
    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Save user
    const user = await User.create({
      email,
      password: hashedPassword
    });
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// User login
async function loginUser(req, res) {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}
```

#### JWT Best Practices
```javascript
// Use strong secret
process.env.JWT_SECRET = crypto.randomBytes(64).toString('hex');

// Short expiration times
const accessToken = jwt.sign(payload, secret, { expiresIn: '15m' });
const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: '7d' });

// Secure cookie storage
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});
```

### Role-Based Access Control (RBAC)

```javascript
// Define roles and permissions
const roles = {
  admin: ['read', 'write', 'delete', 'manage_users'],
  editor: ['read', 'write'],
  viewer: ['read']
};

// Authorization middleware
function authorize(permission) {
  return (req, res, next) => {
    const userRole = req.user.role;
    const userPermissions = roles[userRole] || [];
    
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions' 
      });
    }
    
    next();
  };
}

// Usage
app.delete('/api/users/:id', 
  authenticateToken, 
  authorize('manage_users'), 
  deleteUser
);
```

## Input Validation and Sanitization

### Express Validator
```javascript
const { body, validationResult } = require('express-validator');

const userValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email'),
  
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  
  body('age')
    .isInt({ min: 0, max: 120 })
    .toInt(),
  
  body('name')
    .trim()
    .escape()
    .isLength({ min: 1, max: 100 })
];

app.post('/api/users', userValidation, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  // Process valid input
  createUser(req.body);
});
```

### Custom Validation
```javascript
function validateInput(input, type) {
  const validators = {
    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    phone: (value) => /^\+?[\d\s-()]+$/.test(value),
    url: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }
  };
  
  return validators[type] ? validators[type](input) : false;
}
```

## Secure Headers

### Helmet.js
```javascript
const helmet = require('helmet');

// Basic security headers
app.use(helmet());

// Custom configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### Manual Header Setting
```javascript
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
});
```

## Rate Limiting

### Express Rate Limit
```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

const redisClient = redis.createClient();

// General rate limiting
const generalLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many authentication attempts, please try again later.'
  }
});

app.use('/api/', generalLimiter);
app.use('/auth/', authLimiter);
```

## Session Security

### Secure Session Configuration
```javascript
const session = require('express-session');
const MongoStore = require('connect-mongo');

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    sameSite: 'strict' // CSRF protection
  }
}));
```

## File Upload Security

### Secure File Upload
```javascript
const multer = require('multer');
const path = require('path');

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generate safe filename
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, name);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Maximum 1 file
  }
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({ 
    message: 'File uploaded successfully',
    filename: req.file.filename 
  });
});
```

## Environment and Configuration Security

### Environment Variables
```javascript
// .env file (never commit to version control)
NODE_ENV=production
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
JWT_SECRET=your-super-secret-jwt-key
API_KEY=your-api-key
ENCRYPTION_KEY=your-encryption-key

// Load and validate environment variables
require('dotenv').config();

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'API_KEY'
];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});
```

### Secrets Management
```javascript
const crypto = require('crypto');

// Generate strong secrets
function generateSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

// Encrypt sensitive data
function encrypt(text, key) {
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}
```

## Security Monitoring

### Logging Security Events
```javascript
const winston = require('winston');

const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'security.log' })
  ]
});

// Log authentication attempts
function logAuthAttempt(email, success, ip) {
  securityLogger.info({
    event: 'auth_attempt',
    email,
    success,
    ip,
    timestamp: new Date().toISOString()
  });
}

// Log suspicious activities
function logSuspiciousActivity(activity, details) {
  securityLogger.warn({
    event: 'suspicious_activity',
    activity,
    details,
    timestamp: new Date().toISOString()
  });
}
```

## Security Testing

### Automated Security Testing
```javascript
// security.test.js
const request = require('supertest');
const app = require('../app');

describe('Security Tests', () => {
  test('should reject SQL injection attempts', async () => {
    const maliciousInput = "'; DROP TABLE users; --";
    
    const response = await request(app)
      .post('/api/users')
      .send({ email: maliciousInput })
      .expect(400);
    
    expect(response.body.errors).toBeDefined();
  });
  
  test('should sanitize XSS attempts', async () => {
    const xssPayload = '<script>alert("xss")</script>';
    
    const response = await request(app)
      .post('/api/comments')
      .send({ content: xssPayload })
      .expect(201);
    
    expect(response.body.content).not.toContain('<script>');
  });
  
  test('should enforce rate limiting', async () => {
    // Make multiple requests rapidly
    const promises = Array(10).fill().map(() => 
      request(app).get('/api/data')
    );
    
    const responses = await Promise.all(promises);
    const rateLimitedResponses = responses.filter(r => r.status === 429);
    
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });
});
```

## Security Checklist

### Development
- [ ] Use HTTPS in production
- [ ] Implement proper authentication
- [ ] Validate and sanitize all inputs
- [ ] Use parameterized queries
- [ ] Implement rate limiting
- [ ] Set security headers
- [ ] Keep dependencies updated
- [ ] Use strong passwords and secrets
- [ ] Implement proper error handling
- [ ] Log security events

### Deployment
- [ ] Use environment variables for secrets
- [ ] Configure firewalls
- [ ] Enable database encryption
- [ ] Set up monitoring and alerting
- [ ] Regular security audits
- [ ] Backup and recovery plans
- [ ] Access control and permissions
- [ ] Network security measures

Security is an ongoing process, not a one-time implementation. Regular security audits, keeping dependencies updated, and staying informed about new vulnerabilities are essential for maintaining a secure application.
