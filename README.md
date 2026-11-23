# FixMate Server

## Purpose
REST API for FixMate, a repair service booking platform. It handles services, bookings, job status rules, Stripe payments, profiles and admin operations, with JWT and role-based access.

This is the **server** (Express and MongoDB). The frontend is in the client repo.

## Live URL and Repositories
| | |
|---|---|
| Live API | https://fixmate-server-pi.vercel.app |
| Live site | https://fixmate-client-mdriyan143.vercel.app |
| Server repo | https://github.com/mdriyan143/fixmate-server |
| Client repo | https://github.com/mdriyan143/fixmate-client |

## Credentials
Password for all accounts: `Fixmate123`

| Role | Email |
|---|---|
| Admin | admin@fixmate.com |
| Technician | rafiq@fixmate.com |
| Technician | sabbir@fixmate.com |
| Customer | customer@fixmate.com |

## Key Features
- JWT verification (BetterAuth JWKS) with `verifyToken`, `verifyCustomer`, `verifyTechnician`, `verifyAdmin`
- 401 for a missing or bad token, 403 for the wrong role, users only reach their own data
- Public approved services with server-side search, filter, sort and pagination
- Repair requests with duplicate active request protection (code check plus unique index)
- Job status pipeline enforced on the server
- Technician service CRUD and availability switch
- Admin: users and roles, service approval, all bookings, transactions
- Stripe Checkout (amount read from the database), verify route and webhook, no double payments
- Ratings and reviews on paid bookings, status history on every booking
- Helmet, rate limiting, CORS allowlist, JSON error handler
- Seed script with demo data

## Database (4 collections)
| Collection | Purpose |
|---|---|
| users | BetterAuth users with role, phone, area, bio |
| services | Technician services and approval status |
| bookings | Repair requests, status, payment status, review, history |
| payments | Paid Stripe payments (unique per booking and per Stripe session) |

## Job Status Rules
```text
requested -> accepted -> in-progress -> completed -> paid (Stripe)
requested -> rejected   (technician)
requested -> cancelled  (customer)
```
Only the owning technician can change a job. `finalAmount` must be above 0 when completing. Customers can pay only their own booking that is completed and unpaid.

## API Routes
| Method | Endpoint | Access |
|---|---|---|
| GET | /api/services | Public |
| GET | /api/services/:id | Public |
| GET | /api/services/:id/reviews | Public |
| GET | /api/services/mine | Technician |
| POST | /api/services | Technician |
| PATCH | /api/services/:id | Technician (owner) |
| PATCH | /api/services/:id/availability | Technician (owner) |
| DELETE | /api/services/:id | Technician (owner) |
| POST | /api/bookings | Customer |
| GET | /api/bookings/my | Customer |
| PATCH | /api/bookings/:id/cancel | Customer |
| PATCH | /api/bookings/:id/review | Customer |
| GET | /api/bookings/technician | Technician |
| PATCH | /api/bookings/:id/status | Technician |
| POST | /api/payments/create-checkout-session | Customer |
| GET | /api/payments/verify | Customer |
| GET | /api/payments/my | Customer |
| POST | /api/payments/webhook | Stripe |
| GET | /api/admin/users | Admin |
| PATCH | /api/admin/users/:id/role | Admin |
| GET | /api/admin/services | Admin |
| PATCH | /api/admin/services/:id/approval | Admin |
| GET | /api/admin/bookings | Admin |
| GET | /api/admin/payments | Admin |
| PATCH | /api/users/profile | Any logged-in user |

## Stripe Test (test mode)
Test card: `4242 4242 4242 4242`, any future date, any CVC, any ZIP. Declined: `4000 0000 0000 0002`. 3D Secure: `4000 0025 0000 3155`.

**Webhook locally** (Stripe CLI):
```bash
stripe login
stripe listen --forward-to localhost:5000/api/payments/webhook
```
Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET`, restart the server, then pay a booking from the client.

**Webhook on production:**
1. Stripe Dashboard (test mode) > Developers > Webhooks > Add endpoint
2. URL: `https://fixmate-server-pi.vercel.app/api/payments/webhook`
3. Event: `checkout.session.completed`
4. Put the signing secret in `STRIPE_WEBHOOK_SECRET` on Vercel and redeploy

**Check after paying:**
- `payments` has one new document with the Stripe transaction ID
- the booking has `paymentStatus: "paid"`
- paying again or retrying the webhook doesn't create a second payment

**Quick API checks:**
```bash
# booking not completed or already paid -> 400
curl -X POST $API/api/payments/create-checkout-session \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"bookingId":"BOOKING_ID"}'

# no token -> 401
curl -X POST $API/api/payments/create-checkout-session
```

## Tech Stack
| Area | Technology |
|---|---|
| Backend | Node.js, Express 5 |
| Database | MongoDB (Atlas) with the MongoDB Node.js driver |
| Authorization | JWT verification with jose (tokens issued by BetterAuth), role-based middlewares |
| Payment | Stripe Checkout and Webhooks (test mode) |
| Security | Helmet, CORS allowlist, express-rate-limit |
| Hosting | Vercel |

## npm Packages
| Package | Used for |
|---|---|
| express | API server |
| mongodb | Database |
| stripe | Checkout and webhooks |
| jose | JWT verification |
| cors | CORS |
| helmet | Security headers |
| express-rate-limit | Rate limiting |
| dotenv | Env variables |
| nodemon | Dev auto-restart |

## Environment Variables
Create `.env` (never commit it):

```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
DB_NAME=fixmate
CLIENT_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```
Production: `CLIENT_URL` and `AUTH_URL` are the live client URL. `CLIENT_URL` accepts several comma-separated origins for CORS.

## Run Locally
```bash
npm install
npm run dev     # nodemon
npm start       # production
```

## Seed Demo Data
Start the client first (the seed uses BetterAuth), then:
```bash
node seed.js --force
```
`--force` deletes existing services, bookings and payments. It adds 14 approved, 2 pending and 1 rejected service, plus bookings in different statuses.

## Folder Structure
```text
config/       db and stripe setup
middleware/   token and role checks
routes/       services, bookings, jobs, payments, admin, users
utils/        constants, savePayment, urls
index.js      app entry
seed.js       demo data
```