# E-Commerce API (Nerdery Challenge)

A production-grade e-commerce API built as a learning exercise demonstrating clean architecture, hybrid REST + GraphQL design, and real-world integrations.

---

## Highlights

- **Hybrid API**: REST (Auth & Stripe Webhooks) + GraphQL code-first (everything else) via Apollo Server 5.
- **Role-Based Access Control**: `MANAGER`, `CLIENT`, and `DELIVERY_PERSON` roles enforced by **CASL**.
- **Stripe Payments**: Payment Intents (cart checkout) and Payment Links (single item) with automated webhook reconciliation.
- **Async Processing**: **BullMQ** + **Redis** for background jobs (low-stock email notifications).
- **N+1 Prevention**: Request-scoped **DataLoaders** batch all `@ResolveField` queries.
- **Data Integrity**: **PostgreSQL** via **Prisma ORM**, Prisma transactions for multi-step writes, and JSON snapshots for immutable order history.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Runtime | Node.js · TypeScript 5.7 |
| Framework | NestJS 11 (Express adapter) |
| API | REST + GraphQL (Apollo Server 5, code-first) |
| ORM | Prisma 7 → PostgreSQL |
| Auth | Passport-JWT · httpOnly refresh cookie · CASL 6 |
| Queue | BullMQ + Redis (`@nestjs/bullmq`) |
| Scheduler | `@nestjs/schedule` (cron) |
| Storage | AWS S3 (presigned URLs) |
| Payments | Stripe (Payment Intents + Payment Links) |
| Email | SendGrid |
| Security | Helmet · `@nestjs/throttler` · class-validator |

---

## Setup & Infrastructure

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Docker](https://www.docker.com/)
- [Stripe CLI](https://docs.stripe.com/stripe-cli) (for local webhook testing)

### 1. Start Infrastructure (Docker)

Start PostgreSQL (port `5434`) and Redis (port `6379`) in the background:

```bash
docker-compose up -d
```

Verify that `ecommerce_db_container` and `ecommerce_redis_container` are running.

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials — see the [Environment Variables](#environment-variables) section below.

### 4. Initialize the Database

```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

All seeded accounts use password: `password123`.

### 5. Start the Development Server

```bash
npm run start:dev
```

The API is available at `http://localhost:3000`.
The GraphQL Playground (Apollo Sandbox) is available at `http://localhost:3000/graphql`.

---

## Stripe Local Webhook Testing

To test Stripe webhooks locally, forward events from the Stripe CLI to the running server:

```bash
stripe listen --forward-to localhost:3000/stripe/webhook
```

Copy the `whsec_...` secret printed by the CLI into your `.env` as `STRIPE_WEBHOOK_SECRET`.

---

## Environment Variables

The application validates all variables at startup via Joi. Missing or invalid values will prevent the server from starting.

| Variable | Description | Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | API server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5434/ecommerce?schema=public` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Secret key for access tokens (min 32 chars) | `super-secret-key-32-chars-long...` |
| `JWT_EXPIRATION` | Access token lifetime | `15m` |
| `REFRESH_TOKEN_EXPIRATION` | Refresh token lifetime | `7d` |
| `RESET_PASSWORD_TOKEN_EXPIRATION` | Password reset token lifetime | `10m` |
| `CORS_ORIGIN` | Allowed CORS origins | `*` |
| `AWS_S3_REGION` | S3 region for product images | `us-east-1` |
| `AWS_S3_BUCKET` | S3 bucket name | `my-ecommerce-bucket` |
| `AWS_ACCESS_KEY_ID` | AWS access key ID | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key | `your-secret-access-key` |
| `SENDGRID_API_KEY` | SendGrid API key | `SG....` |
| `SENDGRID_FROM_EMAIL` | Sender email address | `noreply@example.com` |
| `STRIPE_SECRET_KEY` | Stripe API secret | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `THROTTLE_SHORT_TTL` | Short rate-limit window (ms) | `1000` |
| `THROTTLE_SHORT_LIMIT` | Max requests in short window | `3` |
| `THROTTLE_MEDIUM_TTL` | Medium rate-limit window (ms) | `10000` |
| `THROTTLE_MEDIUM_LIMIT` | Max requests in medium window | `20` |
| `THROTTLE_LONG_TTL` | Long rate-limit window (ms) | `60000` |
| `THROTTLE_LONG_LIMIT` | Max requests in long window | `100` |

---

## API Overview

### REST Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/signup` | Register a new client account |
| `POST` | `/auth/signin` | Sign in and receive tokens |
| `POST` | `/auth/signout` | Sign out (clears refresh cookie) |
| `POST` | `/auth/refresh` | Exchange refresh cookie for a new access token |
| `POST` | `/auth/forgot-password` | Request a password reset link |
| `POST` | `/auth/reset-password` | Reset password using a reset token |
| `POST` | `/stripe/webhook` | Stripe event receiver (signature-verified) |

### GraphQL

All product, order, cart, category, favorites, promo, and upload operations are exposed via GraphQL at `/graphql`. Use the built-in Apollo Sandbox for interactive exploration.

---

## Architecture

The codebase follows modular, clean-architecture principles with a strict separation of concerns.

### Layer Responsibilities

- **Controllers & Resolvers**: Handle incoming requests (REST or GraphQL). Delegate all business logic to services.
- **Services**: Core business rules. Large domains (Orders, Products) are decomposed into multiple single-responsibility services.
- **Repositories (Prisma)**: Data access layer. Multi-step writes use `prisma.$transaction()` for atomicity.
- **DataLoaders**: Request-scoped batchers for all `@ResolveField` queries, preventing N+1 database hits.
- **Guards**: `JwtAuthGuard` (JWT validation) + `AbilitiesGuard` (CASL RBAC). Both transports share a `getRequestFromContext()` utility that bridges HTTP and GraphQL execution contexts.
- **Queues (BullMQ)**: Side-effects (e.g., low-stock email notifications) are dispatched as background jobs to keep request latency low.
- **Global Exception Filter**: Maps all thrown exceptions — including `PrismaClientKnownRequestError` codes — to consistent HTTP or GraphQL error shapes.

### Key Design Decisions

- **Snapshot pattern**: Order items, shipping addresses, and applied promos are captured as JSON at purchase time to preserve immutable history regardless of later data changes.
- **Soft deletes**: Most entities use a `deletedAt` timestamp; queries always filter `{ deletedAt: null }`.
- **Refresh token security**: The token stored in the database is a SHA-256 hash; the raw value only ever lives in the httpOnly cookie.
- **Typed config namespaces**: Config is split via `registerAs()` into `app`, `jwt`, `s3`, and `rate-limit` namespaces, all Joi-validated at startup so the server fails fast on missing variables.

### Order Status Lifecycle

```
PENDING → PAID → PROCESSING → SHIPPED → DELIVERED
                     ↓
               CANCELLED (before SHIPPED) / REFUNDED
```

| Transition | Trigger |
| :--- | :--- |
| `PENDING → PAID` | Stripe webhook (`checkout.session.completed`) |
| `PAID → PROCESSING` | Manager action via `updateOrderStatus` mutation |
| `PROCESSING → SHIPPED` | Manager assigns delivery person via `assignAndShipOrders` mutation |
| `SHIPPED → DELIVERED` | Delivery Person confirms via `markOrderDelivered` mutation |
| `PENDING/PAID/PROCESSING → CANCELLED` | Client cancels their own order (or Manager cancels any order) via `cancelOrder` mutation; also triggered automatically by a Stripe webhook on payment failure or by the cron job for abandoned PENDING orders (> 15 min) |

---

## Development Commands

```bash
npm run start:dev     # Start in watch mode
npm run build         # Compile to dist/
npm run start:prod    # Run compiled output
npm run lint          # ESLint with auto-fix
```

### Database

```bash
npx prisma migrate dev      # Apply migrations and regenerate client
npx prisma migrate deploy   # Apply migrations (production)
npx prisma db seed          # Seed initial data
npx prisma studio           # Open Prisma DB GUI
```

---

## Testing

Tests run against the live Docker infrastructure — start the containers before running any test suite.

```bash
docker-compose up -d

npm run test          # Unit tests
npm run test:cov      # Unit tests with coverage report
npm run test:e2e      # End-to-end tests
```

See [Unit Testing Strategy](./unit_testing_strategy.md) for the conventions and patterns used in this repository.

---

## Contributor Considerations

- **Client-first design**: Model APIs and data shapes around how the frontend consumes them, not how they are stored.
- **SOLID services**: Keep services focused and single-responsibility. Decompose large services rather than accumulating methods.
- **No raw deletes**: Always soft-delete via `deletedAt` unless cascading from a parent entity.
- **Transactions for multi-table writes**: Any operation touching more than one table must use `prisma.$transaction()`.
- **GitFlow**:
  - `main` — production-ready code
  - `develop` — pre-production integration branch
  - `feature/*` — active development branches
