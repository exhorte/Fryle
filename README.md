# Fryle

Boutique d'appareils électroniques (iPhone, Mac, Apple Watch, AirPods, casques, accessoires) : [Next.js](https://nextjs.org) (App Router), React 19, Tailwind v4, shadcn/ui,
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
npm run db:seed          # catalogue de démonstration Fryle (22 produits)
npm run dev              # http://localhost:3000
```

Pour tester les paiements en local, lancez aussi `npm run stripe:listen` (Stripe CLI) et copiez le secret `whsec_…`
affiché dans `STRIPE_WEBHOOK_SECRET`.

## Design et contenu

- Interface en français, composants [shadcn/ui](https://ui.shadcn.com) (`components/ui`), icônes [Lucide](https://lucide.dev),
  polices Inter et Outfit. Thème et couleurs : `app/globals.css`.
- Identité et engagements affichés (retours, garantie) : `lib/site-config.ts` — **à adapter à vos conditions réelles**.
  La mention de livraison est calculée à partir de la configuration `SHIPPING_*`.
- Catégories : `lib/catalog.ts`. Produits : table `Product` (catégorie, marque, prix barré, mise en avant, points forts).
- Visuels : illustrations SVG originales dans `public/products`. Remplacez-les par vos propres photos en modifiant
  `imageUrl` (fichier dans `public/` ou URL autorisée dans `next.config.ts`).
- Le catalogue de démonstration (`prisma/seed.ts`) contient des prix et caractéristiques d'exemple à vérifier.

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
