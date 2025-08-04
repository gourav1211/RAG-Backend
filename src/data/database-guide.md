# Database Management and ORM Guide

This guide covers database management concepts, SQL fundamentals, and Object-Relational Mapping (ORM) patterns for modern web applications.

## Database Types

### Relational Databases (SQL)
Examples: PostgreSQL, MySQL, SQLite, SQL Server

**Characteristics:**
- ACID compliance (Atomicity, Consistency, Isolation, Durability)
- Structured data with predefined schemas
- Strong consistency and data integrity
- SQL query language

### NoSQL Databases
Examples: MongoDB, Redis, DynamoDB, Cassandra

**Characteristics:**
- Flexible schema design
- Horizontal scalability
- Various data models (document, key-value, graph, column-family)
- Eventual consistency models

## SQL Fundamentals

### Basic Queries

#### SELECT Statements
```sql
-- Basic selection
SELECT name, email FROM users;

-- With conditions
SELECT * FROM users WHERE age > 18;

-- Sorting
SELECT * FROM users ORDER BY created_at DESC;

-- Limiting results
SELECT * FROM users LIMIT 10 OFFSET 20;

-- Aggregation
SELECT COUNT(*) as total_users FROM users;
SELECT AVG(age) as average_age FROM users WHERE active = true;
```

#### INSERT, UPDATE, DELETE
```sql
-- Insert single record
INSERT INTO users (name, email, age) 
VALUES ('John Doe', 'john@example.com', 25);

-- Insert multiple records
INSERT INTO users (name, email, age) VALUES 
('Alice Smith', 'alice@example.com', 30),
('Bob Johnson', 'bob@example.com', 28);

-- Update records
UPDATE users 
SET age = 26, last_login = NOW() 
WHERE email = 'john@example.com';

-- Delete records
DELETE FROM users WHERE last_login < '2023-01-01';
```

### Advanced SQL

#### JOINs
```sql
-- INNER JOIN
SELECT u.name, p.title 
FROM users u 
INNER JOIN posts p ON u.id = p.user_id;

-- LEFT JOIN
SELECT u.name, COUNT(p.id) as post_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
GROUP BY u.id, u.name;

-- Multiple JOINs
SELECT u.name, p.title, c.content
FROM users u
INNER JOIN posts p ON u.id = p.user_id
INNER JOIN comments c ON p.id = c.post_id;
```

#### Subqueries
```sql
-- Subquery in WHERE clause
SELECT * FROM users 
WHERE id IN (
  SELECT user_id FROM posts 
  WHERE created_at > '2023-01-01'
);

-- Correlated subquery
SELECT u.name, (
  SELECT COUNT(*) FROM posts p 
  WHERE p.user_id = u.id
) as post_count
FROM users u;
```

## Database Design

### Schema Design Principles

#### Normalization
```sql
-- First Normal Form (1NF): Atomic values
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  email VARCHAR(100) UNIQUE
);

-- Second Normal Form (2NF): No partial dependencies
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  order_date DATE,
  total_amount DECIMAL(10,2)
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER,
  unit_price DECIMAL(10,2)
);
```

#### Indexes
```sql
-- Primary index (automatic)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(100) UNIQUE
);

-- Additional indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at);

-- Composite index
CREATE INDEX idx_posts_user_date ON posts(user_id, created_at);
```

## ORM Patterns

### Sequelize (Node.js)

#### Model Definition
```javascript
const { DataTypes } = require('sequelize');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'first_name'
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'last_name'
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  age: {
    type: DataTypes.INTEGER,
    validate: {
      min: 0,
      max: 120
    }
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true
});
```

#### Associations
```javascript
// One-to-Many
User.hasMany(Post, { foreignKey: 'user_id' });
Post.belongsTo(User, { foreignKey: 'user_id' });

// Many-to-Many
User.belongsToMany(Role, { 
  through: 'UserRoles',
  foreignKey: 'user_id'
});
Role.belongsToMany(User, { 
  through: 'UserRoles',
  foreignKey: 'role_id'
});
```

#### Queries
```javascript
// Basic operations
const user = await User.create({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  age: 25
});

const users = await User.findAll({
  where: {
    age: {
      [Op.gte]: 18
    }
  },
  order: [['createdAt', 'DESC']],
  limit: 10
});

// With associations
const userWithPosts = await User.findByPk(1, {
  include: [
    {
      model: Post,
      include: [Comment]
    }
  ]
});

// Raw queries
const results = await sequelize.query(
  'SELECT * FROM users WHERE age > :age',
  {
    replacements: { age: 18 },
    type: QueryTypes.SELECT
  }
);
```

### Mongoose (MongoDB)

#### Schema Definition
```javascript
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Please enter a valid email'
    }
  },
  age: {
    type: Number,
    min: 0,
    max: 120
  },
  posts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }]
}, {
  timestamps: true
});

// Virtual properties
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Instance methods
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    fullName: this.fullName,
    email: this.email
  };
};

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

const User = mongoose.model('User', userSchema);
```

#### Queries
```javascript
// Create
const user = new User({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  age: 25
});
await user.save();

// Find
const users = await User.find({ age: { $gte: 18 } })
  .sort({ createdAt: -1 })
  .limit(10)
  .populate('posts');

// Update
await User.findByIdAndUpdate(
  userId,
  { $set: { age: 26 } },
  { new: true }
);

// Aggregation
const userStats = await User.aggregate([
  { $match: { age: { $gte: 18 } } },
  { $group: { 
    _id: null, 
    averageAge: { $avg: '$age' },
    totalUsers: { $sum: 1 }
  }}
]);
```

## Database Optimization

### Query Optimization

#### Indexing Strategies
```sql
-- For WHERE clauses
CREATE INDEX idx_users_status ON users(status);

-- For ORDER BY clauses
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- For JOIN operations
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- Covering indexes
CREATE INDEX idx_users_covering ON users(id, email, status);
```

#### Query Analysis
```sql
-- PostgreSQL
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'john@example.com';

-- MySQL
EXPLAIN SELECT * FROM users WHERE email = 'john@example.com';
```

### Connection Pooling

#### Node.js with pg (PostgreSQL)
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
});

async function getUser(id) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  } finally {
    client.release();
  }
}
```

## Migrations and Versioning

### Sequelize Migrations
```javascript
// migrations/20231201000000-create-users.js
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      first_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      last_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('users');
  }
};
```

### Running Migrations
```bash
# Run migrations
npx sequelize-cli db:migrate

# Rollback last migration
npx sequelize-cli db:migrate:undo

# Rollback all migrations
npx sequelize-cli db:migrate:undo:all
```

## Best Practices

### 1. Security
```javascript
// Use parameterized queries
const user = await User.findOne({
  where: {
    email: req.body.email // Safe with Sequelize
  }
});

// Avoid string concatenation
// BAD: const query = `SELECT * FROM users WHERE email = '${email}'`;
// GOOD: Use ORM or parameterized queries
```

### 2. Performance
```javascript
// Use pagination
const users = await User.findAndCountAll({
  limit: parseInt(req.query.limit) || 10,
  offset: parseInt(req.query.offset) || 0
});

// Select only needed fields
const users = await User.findAll({
  attributes: ['id', 'firstName', 'lastName', 'email']
});

// Use database-level calculations
const userStats = await User.findAll({
  attributes: [
    'status',
    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
  ],
  group: ['status']
});
```

### 3. Error Handling
```javascript
async function createUser(userData) {
  const transaction = await sequelize.transaction();
  
  try {
    const user = await User.create(userData, { transaction });
    await Profile.create({ userId: user.id }, { transaction });
    
    await transaction.commit();
    return user;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

Proper database management and ORM usage are crucial for building scalable, maintainable applications. Choose the right database type for your use case and follow these best practices for optimal performance and reliability.
