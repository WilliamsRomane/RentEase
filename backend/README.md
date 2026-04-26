# RentEase Backend

## Setup

1. Copy `.env.example` to `.env`
2. For local SQLite development, keep:
   `DATABASE_DIALECT=sqlite`
   `DATABASE_STORAGE=./database.sqlite`
3. Run `npm install`
4. Run `npm run seed`
5. Run `npm run dev`

## Production Basics

- Use a separate production database from your local development database
- Prefer `DATABASE_DIALECT=mysql` for a live multi-user deployment
- Set `APP_BASE_URL` to your frontend domain
- Set `ALLOWED_ORIGINS` to your frontend domain or a comma-separated list of trusted frontend domains
- Set a strong `JWT_SECRET`
- Use `npm run migrate` during deployment to apply schema changes

## Migrations

- Run pending migrations:
  `npm run migrate`
- Check migration status:
  `npm run migrate:status`
- Seeding now runs migrations first, then inserts demo data

## SQLite Workflow

- Main local database file: `backend/database.sqlite`
- Create a backup before manual edits:
  `npm run backup:sqlite`
- Backups are written to: `backend/backups/`
- Stop the backend server before editing the SQLite file directly in a database tool

## Notes For SQLite

- The app is configured to use safer SQLite startup behavior in development
- Models use SQLite-safe integer types to avoid the previous `UNSIGNED` warnings
- If you restart the backend after schema changes, missing SQLite columns are added automatically where the app expects them

## API endpoints

- `POST /api/auth/register` (name, email, password, role, phone?)
- `POST /api/auth/login`
- `GET /api/tenant/rent`
- `GET /api/tenant/payment-method`
- `PUT /api/tenant/payment-method`
- `POST /api/tenant/confirm-payment`
- `GET /api/tenant/payments`
- `GET /api/tenant/receipt/:paymentId`
- `POST /api/landlord/property`
- `POST /api/landlord/tenant`
- `DELETE /api/landlord/property/:propertyId`
- `DELETE /api/landlord/tenant/:tenantId`
- `GET /api/landlord/properties`
- `GET /api/landlord/tenants`
- `GET /api/landlord/payments`
- `GET /api/landlord/reminders`
- `GET /api/landlord/reports`
- `GET /api/landlord/notifications`
- `POST /api/payments/session`
- `POST /api/payments/webhook`

## Notes

- Use JWT `Authorization: Bearer <token>` on protected endpoints
- Stripe webhook requires raw body for signature validation
