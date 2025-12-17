# SaaS Skeleton

A production-ready SaaS application skeleton built with Fastify, TypeScript, Prisma, and PostgreSQL. This project provides a solid foundation for building multi-tenant SaaS applications with authentication, authorization, and organization management.

## 🚀 Features

- **Authentication System**
  - User registration and login
  - JWT-based access tokens
  - Refresh token rotation with secure HttpOnly cookies
  - Password hashing with bcrypt
  - Token revocation support

- **Multi-Tenant Architecture**
  - Organization (Org) management
  - Role-based access control (RBAC)
  - Permission system
  - User memberships across organizations

- **Modern Tech Stack**
  - Fastify for high-performance API
  - TypeScript for type safety
  - Prisma ORM with PostgreSQL adapter
  - Redis for caching and job queues
  - Docker Compose for local development

- **Security Best Practices**
  - HttpOnly cookies for refresh tokens
  - JWT token expiration
  - Password hashing
  - Token rotation on refresh
  - Audit logging support

## 📋 Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Fastify 5.x
- **Database**: PostgreSQL 16
- **ORM**: Prisma 7.x
- **Cache/Queue**: Redis 7
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt

## 🏗️ Architecture

```
saas-skeleton/
├── apps/
│   └── api/                    # Main API application
│       ├── src/
│       │   ├── modules/        # Feature modules
│       │   │   ├── auth/       # Authentication routes & services
│       │   │   └── me/         # User profile endpoints
│       │   ├── plugins/        # Fastify plugins
│       │   │   ├── prisma.ts   # Database plugin
│       │   │   ├── redis.ts    # Redis plugin
│       │   │   └── authGuard.ts # JWT authentication guard
│       │   ├── common/         # Shared utilities
│       │   └── server.ts       # Application entry point
│       └── prisma/
│           ├── schema.prisma   # Database schema
│           └── migrations/     # Database migrations
└── infra/
    └── docker-compose.yml      # Local development services
```

## 🗄️ Database Schema

### Core Models

- **User**: User accounts with email and password hash
- **Org**: Organizations (tenants) in the system
- **Membership**: User-organization-role relationships
- **Role**: Roles within organizations
- **Permission**: Granular permissions
- **RolePermission**: Role-permission mappings
- **RefreshToken**: Refresh token storage with rotation support
- **AuditLog**: Audit trail for user actions
- **Job**: Background job tracking

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd saas-skeleton
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd apps/api
   npm install
   ```

3. **Start infrastructure services**
   ```bash
   docker-compose -f infra/docker-compose.yml up -d
   ```

4. **Set up environment variables**
   Create a `.env` file in `apps/api/`:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app"
   REDIS_URL="redis://localhost:6379"
   JWT_SECRET="your-secret-key-change-in-production"
   PORT=3001
   NODE_ENV=development
   REFRESH_TOKEN_TTL_DAYS=7
   ```

5. **Run database migrations**
   ```bash
   cd apps/api
   npx prisma migrate dev
   ```

6. **Seed the database**
   ```bash
   npm run seed
   ```
   This creates a test user:
   - Email: `a@a.com`
   - Password: `123456`

7. **Start the development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3001`

## 📡 API Endpoints

### Authentication

#### `POST /auth/login`
Login and receive access token. Refresh token is set as HttpOnly cookie.

**Request:**
```json
{
  "email": "a@a.com",
  "password": "123456"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Cookies:** `refresh_token` (HttpOnly, 7 days)

#### `POST /auth/refresh`
Refresh access token using refresh token from cookie.

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Cookies:** New `refresh_token` (rotated)

#### `POST /auth/logout`
Logout and revoke refresh token.

**Response:**
```json
{
  "ok": true
}
```

### User Profile

#### `GET /me`
Get current user information. Requires authentication.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "id": "user-uuid",
  "email": "user@example.com"
}
```

### Health Check

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "ok": true
}
```

## 🔐 Authentication Flow

1. **Login**
   - User provides email and password
   - Server validates credentials
   - Creates JWT access token (short-lived)
   - Creates refresh token (random string, not JWT)
   - Stores refresh token hash in database
   - Sets refresh token as HttpOnly cookie
   - Returns access token in response body

2. **Accessing Protected Routes**
   - Client includes access token in `Authorization: Bearer <token>` header
   - Server validates JWT token
   - If valid, request proceeds

3. **Refreshing Tokens**
   - Client sends refresh token from cookie
   - Server validates token (exists, not revoked, not expired)
   - **Token Rotation**: Deletes old refresh token, creates new one
   - Issues new access token
   - Sets new refresh token cookie
   - Returns new access token

4. **Logout**
   - Server revokes refresh token in database
   - Clears refresh token cookie

## 🔧 Development

### Available Scripts

```bash
# Development (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run database migrations
npx prisma migrate dev

# Seed database
npm run seed

# Prisma Studio (database GUI)
npx prisma studio
```

### Project Structure

- **Modules**: Feature-based organization (`auth`, `me`)
- **Plugins**: Reusable Fastify plugins (Prisma, Redis, Auth Guard)
- **Common**: Shared utilities and error classes
- **Prisma**: Database schema and migrations

### Key Design Decisions

1. **Fastify Plugin Encapsulation**: Prisma plugin uses `fastify-plugin` to break encapsulation, making it available across all route modules.

2. **Refresh Token Rotation**: On each refresh, the old token is deleted and a new one is created for enhanced security.

3. **HttpOnly Cookies**: Refresh tokens are stored in HttpOnly cookies to prevent XSS attacks.

4. **Token Hashing**: Refresh tokens are hashed before storage in the database.

## 🐳 Docker Services

The `docker-compose.yml` provides:
- **PostgreSQL 16**: Main database
- **Redis 7**: Cache and job queue

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Secret for JWT signing | `dev-secret` |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh token expiration | `7` |

## 🔒 Security Considerations

- ✅ Passwords are hashed with bcrypt
- ✅ Refresh tokens stored as HttpOnly cookies
- ✅ JWT tokens have expiration
- ✅ Refresh token rotation on use
- ✅ Token revocation support
- ⚠️ Change `JWT_SECRET` in production
- ⚠️ Use HTTPS in production
- ⚠️ Set `secure: true` for cookies in production

## 📚 Next Steps

- [ ] Add user registration endpoint
- [ ] Implement organization CRUD operations
- [ ] Add role and permission management
- [ ] Implement audit logging
- [ ] Add rate limiting
- [ ] Add request validation with Zod
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Add unit and integration tests
- [ ] Add CI/CD pipeline

## 🤝 Contributing

This is a skeleton project. Feel free to fork and customize for your needs.

## 📄 License

ISC
