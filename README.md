# Fryle

Electronics store (iPhone, Mac, Apple Watch, AirPods, headphones, accessories): [Next.js](https://nextjs.org) (App Router), React 19, Tailwind v4, shadcn/ui,
PostgreSQL + Prisma, payments through [Stripe Checkout](https://docs.stripe.com/payments/checkout).

The catalog, stock and orders live in the database; Stripe only handles the payment.
Guest checkout or checkout with an account (optional Google / GitHub sign-in), optional shipping and taxes.
See **[docs/stripe.md](docs/stripe.md)** (in French) for the architecture, webhooks, tests and going to production.

## Getting started

```bash
npm install
cp .env.example .env     # set STRIPE_SECRET_KEY (secret key sk_test_…)
npm run db:up            # local PostgreSQL via Docker
npm run db:migrate
npm run db:seed          # Fryle demo catalog (22 products)
npm run dev              # http://localhost:3000
```

To test payments locally, also run `npm run stripe:listen` (Stripe CLI) and copy the `whsec_…` secret it prints
into `STRIPE_WEBHOOK_SECRET`.

## Design and content

- The interface is in French, built with [shadcn/ui](https://ui.shadcn.com) components (`components/ui`), [Lucide](https://lucide.dev) icons,
  and the Inter and Outfit fonts. Theme and colors: `app/globals.css`.
- Displayed identity and commitments (returns, warranty): `lib/site-config.ts` — **adapt them to your real terms**.
  The delivery notice is computed from the `SHIPPING_*` configuration.
- Categories: `lib/catalog.ts`. Products: `Product` table (category, brand, strike-through price, featured flag, highlights).
- Visuals: original SVG illustrations in `public/products`. Replace them with your own photos by changing
  `imageUrl` (a file in `public/` or a URL allowed in `next.config.ts`).
- The demo catalog (`prisma/seed.ts`) contains sample prices and specifications that should be checked.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js server |
| `npm test` | Integration tests (requires `npm run db:up`) |
| `npm run lint` | ESLint |
| `npm run db:up` / `db:down` | Start / stop local PostgreSQL |
| `npm run db:migrate` / `db:deploy` | Migrations (development / production) |
| `npm run db:seed` | Sample products |
| `npm run db:import-stripe` | Import an existing Stripe catalog (one-off) |
| `npm run db:studio` | Browse the database |
| `npm run stripe:listen` | Forward Stripe webhooks to `localhost:3000` |
