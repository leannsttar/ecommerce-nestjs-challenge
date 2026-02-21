# E-Commerce API (Nerdery Challenge)

A robust, production-ready E-Commerce API built with NestJS, GraphQL, REST, and PostgreSQL. Features role-based access control, integrated Stripe payments, inventory management with queue-based email notifications, and dynamic promo code functionality.

## 🚀 Tech Stack

- **Framework:** NestJS (Node.js)
- **Language:** TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **API Interfaces:** GraphQL & REST
- **Authentication:** JWT (Access & Refresh tokens)
- **Authorization:** CASL (Role-Based Access Control)
- **Payments:** Stripe (Payment Links, Intents, Webhooks)
- **Queue/Background Jobs:** BullMQ with Redis
- **File Storage:** AWS S3
- **Email:** SendGrid

## ✨ Key Features

- **Hybrid API:** Uses REST for Authentication & Webhooks, and GraphQL for Product & Order management.
- **Role-Based Access:** Distinct capabilities for `MANAGER`, `CLIENT`, and `DELIVERY_PERSON`.
- **Advanced Pagination & Filtering:** Optimize data fetching with standard pagination limits/offsets and complex filters.
- **N+1 Query Prevention:** fully integrated GraphQL DataLoaders.
- **Inventory & Checkout:** Real-time stock validation, automated Stripe refunds on out-of-stock, and dynamic Promo Codes application.
- **Asynchronous Notifications:** BullMQ worker triggers automated emails when variants hit low stock levels (3 remaining).

---

## 🛠 Project Setup & Installation

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [PostgreSQL](https://www.postgresql.org/)
- [Redis](https://redis.io/) (for BullMQ queues)
- [Stripe CLI](https://docs.stripe.com/stripe-cli) (for local webhook testing)

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the `.env.example` file to create your own configuration:

```bash
cp .env.example .env
```

Ensure all variables are filled out. **The app will fail to start if variables are missing** (validated via Joi).

### 4. Infrastructure Setup (Docker)

The project requires PostgreSQL for the database and Redis for the background queues. You can easily start both using the provided Docker Compose file:

```bash
docker-compose up -d
```

This will spin up both containers in the background.

### 5. Database Initialization

Generate the Prisma client and run the migrations to create the tables:

```bash
npx prisma generate
npx prisma migrate dev
```

### 6. Seeding Users

Since there is no default registration for admin accounts, you must seed the database with initial users (1 Manager, 3 Clients, 2 Delivery Persons) to log in and interact with the application:

```bash
npm run seed-users
```

_(All seeded users have the password: `password123`)_

---

## 🏃‍♂️ Running the Application

### Development Mode

```bash
npm run start:dev
```

### Testing Stripe Webhooks Locally

Open a new terminal and forward Stripe events to your local API:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

_Note the webhook secret output by this command and place it into your `.env` as `STRIPE_WEBHOOK_SECRET`._

---

## 🏗 Architecture Overview

The codebase strictly adheres to modular, clean architecture principles:

- `src/modules/*`: Domain-specific modules (Products, Orders, Stripes, Auth).
- `src/common/*`: Cross-cutting concerns like global exception filters, CASL factories, and rate limiting decorators.
- **Data Loaders**: Avoids N+1 problems in GraphQL relations (e.g., retrieving variants for products).
- **Validation Pipes**: Ensures robust input validation using `class-validator` across all endpoints and resolvers.
