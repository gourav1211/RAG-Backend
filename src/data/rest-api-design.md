# RESTful API Design Best Practices

REST (Representational State Transfer) is an architectural style for designing networked applications. This guide covers best practices for creating RESTful APIs.

## What is REST?

REST is an architectural pattern for creating web services. A RESTful API uses HTTP methods and follows specific conventions for organizing and accessing resources.

## Core Principles

### 1. Resource-Based URLs
URLs should represent resources, not actions:

**Good:**
```
GET /users/123
PUT /users/123
DELETE /users/123
```

**Bad:**
```
GET /getUser?id=123
POST /updateUser
POST /deleteUser
```

### 2. HTTP Methods
Use appropriate HTTP methods for different operations:

- **GET**: Retrieve data (read-only)
- **POST**: Create new resources
- **PUT**: Update entire resources
- **PATCH**: Partial updates
- **DELETE**: Remove resources

### 3. Stateless Communication
Each request should contain all necessary information. The server shouldn't store client context between requests.

## URL Design Patterns

### Resource Collections
```
GET    /users           # Get all users
POST   /users           # Create a new user
GET    /users/123       # Get user with ID 123
PUT    /users/123       # Update user 123 completely
PATCH  /users/123       # Partially update user 123
DELETE /users/123       # Delete user 123
```

### Nested Resources
```
GET    /users/123/posts      # Get posts by user 123
POST   /users/123/posts      # Create post for user 123
GET    /users/123/posts/456  # Get specific post
```

### Query Parameters
Use query parameters for filtering, sorting, and pagination:

```
GET /users?role=admin&status=active
GET /posts?sort=created_at&order=desc
GET /users?page=2&limit=20
```

## HTTP Status Codes

### Success Codes
- **200 OK**: Standard success response
- **201 Created**: Resource successfully created
- **204 No Content**: Successful request with no response body

### Client Error Codes
- **400 Bad Request**: Invalid request format
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Access denied
- **404 Not Found**: Resource doesn't exist
- **409 Conflict**: Resource conflict (e.g., duplicate)

### Server Error Codes
- **500 Internal Server Error**: Generic server error
- **502 Bad Gateway**: Invalid response from upstream server
- **503 Service Unavailable**: Server temporarily unavailable

## Response Format

### JSON Structure
Use consistent JSON response structure:

```json
{
  "data": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "meta": {
    "timestamp": "2023-01-01T00:00:00Z",
    "version": "v1"
  }
}
```

### Error Responses
Provide clear error messages:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email format is invalid"
      }
    ]
  }
}
```

## Authentication and Authorization

### Token-Based Authentication
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### API Keys
```http
X-API-Key: your-api-key-here
```

## Versioning Strategies

### URL Versioning
```
/v1/users
/v2/users
```

### Header Versioning
```http
Accept: application/vnd.api+json;version=1
```

### Query Parameter Versioning
```
/users?version=1
```

## Pagination

### Cursor-based Pagination
```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTIzfQ==",
    "prev_cursor": "eyJpZCI6MTAwfQ==",
    "has_more": true
  }
}
```

### Offset-based Pagination
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "per_page": 20,
    "total_pages": 10,
    "total_count": 200
  }
}
```

## Best Practices Summary

1. **Use nouns, not verbs** in URLs
2. **Be consistent** with naming conventions
3. **Use HTTP status codes** appropriately
4. **Provide clear error messages**
5. **Implement proper authentication**
6. **Version your API** from the start
7. **Document your API** thoroughly
8. **Use HTTPS** in production
9. **Implement rate limiting**
10. **Cache responses** when appropriate

Following these REST API design principles will result in APIs that are intuitive, scalable, and maintainable.
