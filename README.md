# My Ecommerce

Boutique en ligne : [Next.js](https://nextjs.org) (App Router), React 19, Tailwind v4, shadcn/ui,
PostgreSQL + Prisma, paiements par [Stripe Checkout](https://docs.stripe.com/payments/checkout).

Le catalogue, le stock et les commandes vivent dans la base de données ; Stripe ne gère que le paiement.
Paiement invité ou avec compte (connexion Google / GitHub optionnelle), livraison et taxes optionnelles.
Voir **[docs/stripe.md](docs/stripe.md)** pour l'architecture, les webhooks, les tests et la mise en production.

## Démarrage

```bash
npm install
cp .env.example .env     # renseignez STRIPE_SECRET_KEY (clé secrète sk_test_…)
npm run db:up            # PostgreSQL local via Docker
npm run db:migrate
npm run db:seed          # produits d'exemple
npm run dev              # http://localhost:3000
```

Pour tester les paiements en local, lancez aussi `npm run stripe:listen` (Stripe CLI) et copiez le secret `whsec_…`
affiché dans `STRIPE_WEBHOOK_SECRET`.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Serveur Next.js |
| `npm test` | Tests d'intégration (nécessite `npm run db:up`) |
| `npm run lint` | ESLint |
| `npm run db:up` / `db:down` | Démarre / arrête PostgreSQL local |
| `npm run db:migrate` / `db:deploy` | Migrations (dev / production) |
| `npm run db:seed` | Produits d'exemple |
| `npm run db:import-stripe` | Importe un catalogue Stripe existant (une fois) |
| `npm run db:studio` | Explorer la base |
| `npm run stripe:listen` | Relaie les webhooks Stripe vers `localhost:3000` |
