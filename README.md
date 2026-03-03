# 🛒 E-Commerce API (Nerdery Challenge)

✨ **Highlights**

- **Hybrid API**: Integrates **REST** (Auth & Webhooks) with **GraphQL** (Product & Order Management) to deliver optimal performance.
- **Robust Access Control**: Distinct capabilities for `MANAGER`, `CLIENT`, and `DELIVERY_PERSON` using **CASL** (Role-Based Access Control).
- **Stripe Payments Integration**: Supports both Payment Links (single item) and Payment Intents (cart-based) with automated webhook reconciliation.
- **Asynchronous Processing**: **BullMQ** & **Redis** power background jobs, including automated email notifications for low-stock items.
- **Data Integrity**: **PostgreSQL** via **Prisma ORM**, strict input validation, and DataLoader integration to prevent N+1 query problems.

---

## � Setup & Infrastructure

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Docker](https://www.docker.com/)
- [Stripe CLI](https://docs.stripe.com/stripe-cli) (for local testing)

### Docker Workflow

We use Docker to easily spin up our data and caching layers locally.

1. Run the following command to start PostgreSQL (port `5434`) and Redis (port `6379`) in the background:

```bash
docker-compose up -d
```

2. Verify that the `ecommerce_db_container` and `ecommerce_redis_container` containers are running.

### Application Setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file (see variables below):

```bash
cp .env.example .env
```

3. Initialize the database and run the migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

4. Seed the initial users (Manager, Clients, Delivery Persons):

```bash
npx prisma db seed
```

_(All seeded accounts use password: `password123`)_

---

## 🔑 Environment Variables

The application strictly validates environment variables on startup. The `.env` file configures the Docker infrastructure and cloud services.

| Variable                          | Description                               | Example Value                                                           |
| :-------------------------------- | :---------------------------------------- | :---------------------------------------------------------------------- |
| `NODE_ENV`                        | Environment mode (development/production) | `development`                                                           |
| `PORT`                            | API server port                           | `3000`                                                                  |
| `DATABASE_URL`                    | PostgreSQL connection string (Docker)     | `postgresql://postgres:postgres@localhost:5434/ecommerce?schema=public` |
| `REDIS_URL`                       | Redis connection string (Docker)          | `redis://localhost:6379`                                                |
| `JWT_SECRET`                      | Secret key for Access Tokens              | `super-secret-key-32-chars-long...`                                     |
| `JWT_EXPIRATION`                  | Access token expiration time              | `15m`                                                                   |
| `REFRESH_TOKEN_EXPIRATION`        | Refresh token expiration time             | `7d`                                                                    |
| `RESET_PASSWORD_TOKEN_EXPIRATION` | Expiration for password reset tokens      | `10m`                                                                   |
| `CORS_ORIGIN`                     | Allowed CORS origins                      | `*`                                                                     |
| `AWS_S3_REGION`                   | S3 region for product images              | `your-region`                                                           |
| `AWS_S3_BUCKET`                   | S3 bucket for product images              | `my-ecommerce-bucket`                                                   |
| `AWS_ACCESS_KEY_ID`               | AWS access key                            | `your-access-key-id`                                                    |
| `AWS_SECRET_ACCESS_KEY`           | AWS secret access key                     | `your-secret-access-key`                                                |
| `SENDGRID_API_KEY`                | SendGrid Email API key                    | `SG....`                                                                |
| `SENDGRID_FROM_EMAIL`             | Sender email address                      | `your-email@example.com`                                                |
| `STRIPE_SECRET_KEY`               | Stripe API Secret                         | `sk_test_...`                                                           |
| `STRIPE_WEBHOOK_SECRET`           | Stripe Webhook Signature key              | `whsec_...`                                                             |
| `THROTTLE_SHORT_TTL`              | Short rate limit burst window (ms)        | `1000`                                                                  |
| `THROTTLE_SHORT_LIMIT`            | Short rate limit max requests             | `3`                                                                     |

---

## 🏗️ Architecture & Technical Detail

The codebase adheres strictly to modular, clean architecture principles.

### System Architecture

- **Controllers & Resolvers**: Handle incoming REST routes (Auth, Webhooks) and GraphQL queries/mutations. They delegate business logic to services.
- **Services**: Contain the core business rules. They interact with data repositories, caching layers, and external providers (Stripe, AWS).
- **Repositories (Prisma ORM)**: The data access layer. Services query the PostgreSQL database via the Prisma Client.
- **Caching & Queues**: **Redis** is utilized by **BullMQ** to offload heavy tasks (e.g., low-stock email notifications) from the main event loop, ensuring fast API responses.

### 📦 Order Lifecycle Logic

Orders follow a strict state machine, enforced by CASL permissions and specific mutators.

`PENDING` ➔ `PAID` ➔ `PROCESSING` ➔ `SHIPPED` ➔ `DELIVERED`
_(Orders can transition to `CANCELLED` prior to shipping)._

**Key State Transitions:**

- **`PENDING` ➔ `PAID`**: Triggered asynchronously via Stripe Webhook when a checkout session completes.
- **`PAID` ➔ `PROCESSING`**: Manager verifies and prepares the order.
- **`PROCESSING` ➔ `SHIPPED`**: Triggered via the `assignAndShipOrders` mutation. The Manager assigns an order to a specific Delivery Person, which immediately advances the status to `SHIPPED`.
- **`SHIPPED` ➔ `DELIVERED`**: The assigned Delivery Person finalizes the delivery.

---

## 🛠️ Development Workflow

- **AI Collaborator**: We actively use **Antigravity** as our AI software engineering collaborator for maintaining codebase standards, refactoring code, and improving documentation.
- **GitFlow**:
  - `main`: Production-ready code.
  - `develop`: Pre-production integration branch.
  - `feature/*`: Active development branches for new capabilities.

---

## 🤝 Contributor Considerations

- **Client-First Design**: Build APIs, features, and data structures based on how they will be consumed by the frontend—not how they are stored.
- **Refactoring Priorities**: Follow SOLID principles. Keep services focused and maintain modular boundaries.
- **Running Tests**: Tests are configured to run against the Docker infrastructure. Spin up the containers first with `docker-compose up -d`.
  - Unit Tests: `npm run test`
  - Coverage: `npm run test:cov`
  - E2E Tests: `npm run test:e2e`

---

## 📚 Additional Resources

- **[Unit Testing Strategy](./unit_testing_strategy.md)**: Comprehensive guidelines for writing scalable tests in this repository.
