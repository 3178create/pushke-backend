# Pushke Backend

A real Node/Express + Prisma backend for the Pushke family tzedakah app —
authentication, family/friend groups, weekly pledges, curated + custom
organizations, payouts, and a per-person annual tax PDF export.

This was written outside a sandboxed environment with no package registry
access, so **it hasn't been run yet** — you'll need to `npm install` locally
before it will boot. The code is complete and internally consistent, but treat
first-run debugging as expected, the way you would with any freshly scaffolded
project.

## Setup

```bash
npm install
cp .env.example .env        # then fill in JWT_SECRET at minimum
npx prisma migrate dev --name init
npm run prisma:seed         # loads the curated Israel-support orgs
npm run dev
```

The server starts on `http://localhost:3000` (or `$PORT`).

## What's real vs. stubbed

**Real and working once you `npm install`:**
- Auth (signup/login) with bcrypt + JWT
- Group creation, family/friend invites, accept-invite flow
- Pledge tracking (pledge-and-charge model, per the feature spec)
- Curated organization list (see `prisma/seed.js` — verified EINs as of writing)
- Payout splitting logic across multiple orgs by percentage
- Per-person tax summary, both as JSON and as a generated PDF (`pdfkit`)
- Hebcal integration for real candle-lighting/Havdalah times (`src/lib/hebcal.js`)

**Intentionally stubbed — replace before going live:**
- `src/lib/donationProcessor.js` — `chargeCard()` and `sendToOrg()` currently
  simulate success. Wire these to a real processor (Every.org, Pledge, Chariot,
  or Stripe + your own KYC layer) before any real money moves. Do this before
  anything else — everything downstream (payouts, tax receipts) depends on it
  being real.
- Invite emails are created in the database but no email is actually sent —
  add a provider (Postmark, SendGrid, Resend) in `groups.js`'s invite route.
- Venmo/Cash App/Zelle are UI-only in the prototype; there's no backend
  representation of them yet since (per the spec) they can only be deep-links
  for the payer to confirm manually, not something this backend charges
  directly.
- Apple StoreKit subscription verification isn't implemented — the
  `Subscription` model has a `storeKitTxId` field ready for when you add
  server-side receipt validation.

## API overview

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/signup` | — | Create account |
| POST | `/api/auth/login` | — | Log in |
| POST | `/api/groups` | ✓ | Create a family group |
| POST | `/api/groups/:id/invite` | ✓ (admin) | Invite a family member or friend |
| POST | `/api/groups/:id/invite/accept` | ✓ | Accept a pending invite |
| GET | `/api/groups/:id/members` | ✓ | List members |
| POST | `/api/groups/:id/pledges` | ✓ | Add a pledge to the box |
| GET | `/api/groups/:id/pledges` | ✓ | Current box balance + breakdown |
| GET | `/api/orgs?q=` | ✓ | List curated + matching custom orgs |
| POST | `/api/groups/:id/payouts` | ✓ | Send the box, split across orgs |
| GET | `/api/groups/:id/tax-summary/:year` | ✓ | Per-person JSON summary |
| GET | `/api/groups/:id/tax-summary/:year/pdf` | ✓ | Per-person PDF download |

## Database

Defaults to SQLite for zero-setup local dev. For production, edit
`prisma/schema.prisma`'s `datasource` block to `provider = "postgresql"` and
point `DATABASE_URL` at a real Postgres instance (Supabase, Neon, RDS, Railway
all work fine with Prisma).

## Next steps, roughly in order

1. Wire `donationProcessor.js` to a real processor and test a $1 real donation end-to-end
2. Add email delivery for invites
3. Add Apple StoreKit server-side receipt validation for the Plus subscription
4. Move from SQLite to Postgres before any real users onboard
5. Add rate limiting and request validation (e.g. `zod`) on all POST bodies
