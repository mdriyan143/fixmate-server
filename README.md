# FixMate — Server

FixMate is a full-stack, role-based device and home-appliance repair booking platform. This repository contains the **Node.js / Express REST API** and MongoDB data operations used by the FixMate Next.js client.

The API supports three roles: Customer, Technician, and Admin. It manages repair services, bookings, job status transitions, Stripe payments, user profiles, and administrator operations.

## Live API

- **API base URL:** `https://YOUR-BACKEND-DOMAIN`
- **Health check:** `https://YOUR-BACKEND-DOMAIN/`

> Replace the example URL above with your deployed backend URL before submission.

## Tech Stack

- Node.js (ES modules)
- Express 5
- MongoDB Node.js driver
- BetterAuth-issued JWT verification with `jose`
- Stripe Checkout and Webhooks
- CORS
- Helmet
- express-rate-limit
- dotenv
- nodemon (development)

## Core Features

- MongoDB connection and collection access.
- Public listing of approved and available services.
- Server-side service search, category/service-mode filtering, sorting, and pagination.
- Role-based API authorization with `verifyToken`, `verifyCustomer`, `verifyTechnician`, and `verifyAdmin`.
- Customer repair requests, duplicate-active-request prevention, and request cancellation.
- Technician-owned service CRUD and availability management.
- Technician-only booking access and server-enforced job status transitions.
- Admin user/role management, service approval, booking monitoring, and transaction listing.
- Stripe Checkout for completed and unpaid bookings.
- Payment verification and Stripe webhook handling.
- Idempotent payment persistence to prevent the same booking payment from being recorded twice.
- Customer ratings and reviews for paid bookings.
- Profile updates.
- Seed script for demo users, services, and bookings.

## Database Collections

The application uses these four application collections:

| Collection | Purpose |
|---|---|
| `users` | BetterAuth user records with role and profile fields |
| `services` | Technician repair service listings and approval state |
| `bookings` | Customer repair requests, job status, payment status, ratings, and timeline |
| `payments` | Successful Stripe payment records |

BetterAuth also creates and manages its own authentication-related collections (such as sessions, accounts, and verifications).

## Authentication and Access Control

The API verifies JWTs issued by BetterAuth using the BetterAuth JWKS endpoint. The user's role is read from MongoDB for authorization.

- Missing or invalid token: `401 Unauthorized`
- Valid token with an incorrect role: `403 Forbidden`
- Customers can access only their own bookings and payments.
- Technicians can access and update only bookings and services they own.
- Admin endpoints require the Admin role.
- Public service browsing and service details do not require authentication.

## Job Status Workflow

Allowed job transitions are enforced by the server:

```text
requested ── Technician ──> accepted
    │                         │
    ├── Technician ──> rejected
    └── Customer ────> cancelled
                              │
                         in-progress
                              │
                          completed
                              │
                   Customer pays with Stripe
                              │
                            paid
```

A technician must own the booking to update its status. A final amount greater than zero is required when marking a job completed. Customers can cancel only their own requested bookings. Payment is permitted only for a booking owned by the logged-in customer when it is completed and unpaid.

## API Routes

All routes are prefixed with `/api`, except the root health check and Stripe webhook path noted below.

| Method | Endpoint | Access / Purpose |
|---|---|---|
| GET | `/api/services` | Public service search, filters, sort, pagination |
| GET | `/api/services/:id` | Public approved service details |
| GET | `/api/services/mine` | Technician's own services |
| POST | `/api/services` | Technician creates a service |
| PATCH | `/api/services/:id` | Technician updates own service; approval resets to pending |
| PATCH | `/api/services/:id/availability` | Technician toggles own service availability |
| DELETE | `/api/services/:id` | Technician deletes own service |
| POST | `/api/bookings` | Customer creates a repair request |
| GET | `/api/bookings/my` | Customer views own bookings |
| PATCH | `/api/bookings/:id/cancel` | Customer cancels own requested booking |
| PATCH | `/api/bookings/:id/review` | Customer reviews own paid booking |
| GET | `/api/bookings/technician` | Technician views own incoming bookings |
| PATCH | `/api/bookings/:id/status` | Technician advances an owned job |
| POST | `/api/payments/create-checkout-session` | Customer creates a Stripe Checkout session |
| GET | `/api/payments/verify?session_id=...` | Customer verifies completed payment |
| GET | `/api/payments/my` | Customer views own payment history |
| GET | `/api/admin/users` | Admin lists users |
| PATCH | `/api/admin/users/:id/role` | Admin changes another user's role |
| GET | `/api/admin/services` | Admin lists services |
| PATCH | `/api/admin/services/:id/approval` | Admin approves/rejects a service |
| GET | `/api/admin/bookings` | Admin lists bookings |
| GET | `/api/admin/payments` | Admin lists transactions |
| PATCH | `/api/users/profile` | Authenticated user updates own profile |
| POST | `/api/payments/webhook` | Stripe webhook endpoint |

## Environment Variables

Create a `.env` file in the root of this server project. Do not commit it.

```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
DB_NAME=fixmate

# Comma-separated frontend origins allowed by CORS.
CLIENT_URL=http://localhost:3000

# BetterAuth base URL used to retrieve and verify JWT signing keys.
AUTH_URL=http://localhost:3000

# Stripe test-mode credentials
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
```

For production:
- Set `CLIENT_URL` to the deployed frontend origin (or comma-separated allowed origins).
- Set `AUTH_URL` to the deployed BetterAuth frontend origin.
- Use the correct MongoDB connection string and database name.
- Configure the Stripe webhook endpoint as `https://YOUR-BACKEND-DOMAIN/api/payments/webhook` in the Stripe Dashboard (test mode), then set its signing secret as `STRIPE_WEBHOOK_SECRET`.
- Keep all secrets in the hosting provider's environment configuration.

## Installation and Run

**Requirements:** Node.js (LTS recommended), npm, MongoDB, and the FixMate client configured with BetterAuth.

```bash
# Install dependencies
npm install

# Start development server with automatic restart
npm run dev

# Or start normally
npm start
```

The API runs at [http://localhost:5000](http://localhost:5000) by default.

## Seed Demo Data

The `seed.js` script creates demo users through the BetterAuth API, assigns their roles, and inserts sample services, bookings, and a payment.

1. Start the client so BetterAuth is available at `AUTH_URL`.
2. Configure the server `.env` file and make sure both applications use the same MongoDB database.
3. Run:

```bash
node seed.js --force
```

**Warning:** `--force` is required because the script deletes existing `services`, `bookings`, and `payments` records before inserting the demo data. Use it only with a development/demo database.

Demo accounts created by the seed script:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@fixmate.com` | `Fixmate123` |
| Technician | `rafiq@fixmate.com` | `Fixmate123` |
| Technician | `sabbir@fixmate.com` | `Fixmate123` |
| Customer | `customer@fixmate.com` | `Fixmate123` |

The script seeds 14 approved services, 2 pending services, 1 rejected service, and sample bookings in different states.

## NPM Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `nodemon index.js` | Development server with auto-restart |
| `npm start` | `node index.js` | Production server |
| `npm test` | Placeholder | No automated test suite is configured yet |

## Related Repository

The Next.js frontend is maintained in the [FixMate Client repository](YOUR-CLIENT-GITHUB-REPOSITORY-URL).

## Project Structure

```text
config/       MongoDB and Stripe configuration
middleware/   JWT verification and role authorization
routes/       Service, booking, job, payment, user, and admin endpoints
utils/        Constants, payment persistence, and URL helpers
index.js      Express application and route registration
seed.js       Demo account and sample data seeder
```

## Security Notes

- Never commit `.env` or expose Stripe, MongoDB, or webhook secrets.
- The API uses the database booking amount when creating Checkout sessions; it does not trust an amount supplied by the client.
- Payment records are saved idempotently so a success-page verification and webhook retry do not create duplicate payments.
- Use Stripe test mode for assignment evaluation.
