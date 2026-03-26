# Architecture Documentation

## System Overview

This backend implements a production-ready architecture for a collaborative Typst document editing platform, following industry best practices for scalability, performance, and real-time collaboration.

## Architecture Diagram

```
┌─────────────────┐
│   Web Client    │
│  (Frontend UI)  │
└────────┬────────┘
         │
    HTTP │ WS
         │
┌────────▼────────────────────────────────────────┐
│            FastAPI Application                  │
│  ┌──────────────────────────────────────────┐  │
│  │  REST API Endpoints                      │  │
│  │  - /api/v1/auth/*                        │  │
│  │  - /api/v1/projects/*                    │  │
│  │  - /api/v1/projects/{id}/files/*         │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  WebSocket Server (YJS CRDT)             │  │
│  │  - /ws/{document_id}                     │  │
│  └──────────────────────────────────────────┘  │
└────────┬─────────────────┬──────────────┬──────┘
         │                 │              │
         │                 │              │
    ┌────▼─────┐    ┌─────▼──────┐  ┌───▼──────┐
    │PostgreSQL│    │   Redis    │  │  MinIO   │
    │          │    │            │  │ (S3 API) │
    │ - Users  │    │ - Sessions │  │          │
    │ - Projects│   │ - CRDT     │  │ - Assets │
    │ - Files  │    │   State    │  │ - PDFs   │
    │ - Assets │    │ - Queues   │  │ - Builds │
    │   Refs   │    │            │  │          │
    └──────────┘    └────────────┘  └──────────┘
```

## Data Flow

### 1. User Authentication Flow

```
Client → POST /api/v1/auth/register
         ↓
    Validate input
         ↓
    Hash password (bcrypt)
         ↓
    Store in PostgreSQL
         ↓
    Return user object

Client → POST /api/v1/auth/login
         ↓
    Validate credentials
         ↓
    Generate JWT token
         ↓
    Return token
```

### 2. File Storage Flow

```
Text Files (.typ, .txt):
    Client → API → PostgreSQL (files table)
    - Fast read/write
    - Transaction support
    - Version control ready

Binary Assets (images, PDFs):
    Client → API → MinIO/S3
    - Scalable storage
    - CDN-ready
    - Cost-effective
```

### 3. Real-Time Collaboration Flow

```
User A                WebSocket Server           User B
  │                          │                     │
  ├─ Connect ────────────────►                     │
  │  ws://host/ws/doc-123     │                    │
  │                          │◄──── Connect ───────┤
  │                          │   ws://host/ws/doc-123
  │                          │                     │
  ├─ Edit Document ──────────►                     │
  │  (YJS update)             │                    │
  │                          ├──── Broadcast ──────►
  │                          │   (YJS update)      │
  │                          │                     │
  │◄─────── Broadcast ───────┤◄──── Edit ──────────┤
  │                          │                     │
  │                          ▼                     │
  │                    Update Redis                │
  │                    (snapshot every N edits)    │
```

## Storage Strategy

### PostgreSQL (Structured Data)

**Why**: ACID transactions, relationships, complex queries

**Stores**:
- User accounts
- Project metadata
- Text file contents (Typst source)
- Asset metadata (not the files themselves)

**Schema Design**:
```sql
users ─┐
       └─► projects ─┬─► files (content in TEXT column)
                     └─► assets (metadata only)
```

### MinIO/S3 (Object Storage)

**Why**: Infinite scalability, cheap, CDN-ready

**Stores**:
```
projects/{projectId}/
  ├── assets/           (user uploads)
  │   ├── image1.png
  │   ├── figure.pdf
  │   └── data.csv
  └── output/           (compilation results)
      ├── main.pdf
      └── build.log
```

**Access Patterns**:
- Direct uploads via presigned URLs
- Streaming downloads
- Automatic expiration for build artifacts

### Redis (Cache & State)

**Why**: Fast in-memory operations, pub/sub, TTL support

**Uses**:
1. **Session Storage**: Active user sessions
2. **CRDT Snapshots**: Periodic document state saves
3. **Job Queue**: Background compilation tasks
4. **Rate Limiting**: API throttling

**Data Structures**:
```
session:{userId} → user data (TTL: 1 day)
doc:{docId}:state → YJS snapshot (TTL: 1 hour)
queue:compile → pending build jobs
```

## Real-Time Collaboration (YJS)

### Why CRDT (Conflict-free Replicated Data Type)?

Traditional approaches (OT - Operational Transform) require a central server to serialize all operations. CRDTs allow:
- Offline editing
- P2P sync
- No central authority needed
- Automatic conflict resolution

### YJS Implementation

```python
# Server maintains:
1. Active connections per document
2. Latest document state
3. Broadcasts updates to all clients

# Client responsibilities:
1. Send local changes as YJS updates
2. Apply remote updates to local document
3. Handle network interruptions
```

### Persistence Strategy

```
Every N updates OR every T minutes:
  1. Serialize YJS document
  2. Save snapshot to Redis
  3. Optional: Save to PostgreSQL for long-term storage

On client connect:
  1. Load latest snapshot
  2. Send to client
  3. Client applies and continues from there
```

## API Design

### RESTful Principles

- **Resources**: Projects, Files, Assets, Users
- **HTTP Methods**: GET, POST, PUT, DELETE
- **Status Codes**: 200, 201, 400, 401, 403, 404, 500
- **Authentication**: JWT Bearer tokens

### Endpoint Structure

```
/api/v1/
  ├── auth/
  │   ├── register  [POST]
  │   └── login     [POST]
  │
  ├── projects/
  │   ├── /              [GET, POST]
  │   ├── /{id}          [GET, PUT, DELETE]
  │   ├── /{id}/files    [GET, POST]
  │   ├── /{id}/files/{fileId} [GET, PUT, DELETE]
  │   └── /{id}/assets   [GET, POST]
  │
  └── users/
      └── /me            [GET, PUT]
```

## Security

### Authentication

- **Method**: JWT (JSON Web Tokens)
- **Flow**: Login → Token → Include in Authorization header
- **Expiration**: 30 minutes (configurable)
- **Refresh**: Implement refresh tokens for production

### Password Security

- **Algorithm**: bcrypt
- **Rounds**: 12 (default passlib setting)
- **Never** store plain passwords

### Authorization

- **Ownership**: Users can only access their own projects
- **Future**: Add collaborators table for shared projects

### API Security

- **CORS**: Configured whitelist of allowed origins
- **Rate Limiting**: Implement with Redis (TODO)
- **Input Validation**: Pydantic schemas
- **SQL Injection**: Prevented by SQLAlchemy ORM
- **XSS**: FastAPI auto-escaping

## Scalability Considerations

### Horizontal Scaling

**Application Layer**:
- Stateless FastAPI servers
- Load balancer (nginx/Caddy)
- Multiple uvicorn workers

**WebSocket Scaling**:
- Use Redis pub/sub for cross-server communication
- Sticky sessions or consistent hashing

**Database Scaling**:
- Read replicas for heavy read workloads
- Connection pooling (SQLAlchemy)

**Object Storage**:
- MinIO distributed mode or S3 (infinite scale)

### Performance Optimization

1. **Database Indexes**:
   - Primary keys on all ID columns
     - Index on email for login
   - Index on project_id for file lookups

2. **Caching**:
   - Redis for frequent reads
   - CDN for static assets

3. **Async Operations**:
   - All database operations use asyncio
   - Non-blocking WebSocket connections

## Deployment Architecture

### Development

```
Local Machine
  ├── Backend (port 8000)
  ├── PostgreSQL (Docker, port 5432)
  ├── Redis (Docker, port 6379)
  └── MinIO (Docker, ports 9000/9001)
```

### Production

```
Load Balancer (HTTPS)
  │
  ├──► App Server 1 ────┐
  ├──► App Server 2 ────┼──► Managed PostgreSQL (RDS/Cloud SQL)
  └──► App Server N ────┤
                        ├──► Managed Redis (ElastiCache)
                        └──► S3 / MinIO Cluster
```

## Monitoring & Observability

### Metrics to Track

- **Application**: Request latency, error rates, throughput
- **Database**: Connection pool usage, query performance
- **WebSocket**: Active connections, message throughput
- **Storage**: Upload/download speeds, storage usage

### Logging

- **Structured Logging**: JSON format
- **Levels**: DEBUG, INFO, WARNING, ERROR
- **Correlation IDs**: Track requests across services

### Health Checks

```
GET /health
  - Database connection: OK/FAIL
  - Redis connection: OK/FAIL
  - MinIO connection: OK/FAIL
  - Overall status: Healthy/Degraded/Down
```

## Future Enhancements

### 1. Build System

```
Client → Trigger Compile
         ↓
    Add job to Redis queue
         ↓
    Background worker picks up
         ↓
    Run Typst in Docker sandbox
         ↓
    Upload PDF to MinIO
         ↓
    Notify client (WebSocket)
```

### 2. Project Collaboration

```sql
project_collaborators (
    id,
    project_id,
    user_id,
     role  -- 'owner', 'admin', 'writer', 'commentor', 'reader'
)
```

### 3. Version Control

```sql
file_versions (
    id,
    file_id,
    version,
    content,
    created_at,
    created_by
)
```

### 4. Presence Awareness

```javascript
// Broadcast cursor positions
{
  type: 'awareness',
  userId: 123,
  cursor: { line: 10, column: 5 },
  selection: { start: {...}, end: {...} }
}
```

## Technology Choices Rationale

### Why FastAPI?

- Modern async support
- Automatic API documentation
- Type safety with Pydantic
- WebSocket support built-in
- Fast performance

### Why PostgreSQL?

- ACID compliance
- Rich data types (JSONB, arrays)
- Full-text search
- Proven at scale
- Strong community

### Why MinIO?

- S3-compatible API
- Self-hosted option
- Easy migration to AWS S3
- Cost-effective

### Why YJS?

- Battle-tested in production (Notion, Figma use CRDTs)
- Language bindings (Python, JavaScript)
- Efficient binary protocol
- Offline support

### Why Redis?

- Extremely fast
- Versatile (cache, queue, pub/sub)
- TTL support
- Wide adoption

## Conclusion

This architecture provides:
- **Scalability**: Horizontal scaling at all layers
- **Performance**: Async operations, caching, efficient storage
- **Reliability**: ACID transactions, proper error handling
- **Collaboration**: Real-time with CRDT conflict resolution
- **Security**: JWT auth, encrypted passwords, input validation
- **Cost-Efficiency**: Right tool for each job (cheap object storage, etc.)
