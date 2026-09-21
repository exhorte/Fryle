# Intégration Stripe

La base de données PostgreSQL est la **source de vérité** (produits, prix, stock, commandes, paiements,
remboursements). Stripe n'est utilisé que comme rail de paiement : **aucun produit ni prix n'est créé dans Stripe**,
chaque session Checkout reçoit ses lignes en `price_data` calculées côté serveur.

## Flux

```
Navigateur ── { cartId, [{productId, quantity}] } ──▶ Server Action checkoutAction
                                                       │  1. limitation de débit par IP
                                                       │  2. identité = session serveur (jamais le formulaire)
                                                       ▼
                                          services/checkout-service.ts
                                            1. valide (zod) et relit les produits en base
                                            2. calcule sous-total + livraison côté serveur
                                            3. réserve le stock (UPDATE conditionnel atomique)
                                            4. crée Order + OrderItems (prix figés) + Payment
                                            5. crée la Checkout Session Stripe (metadata.orderId)
                                                       │
                                                       ▼
                                   Stripe Checkout (paiement) ── redirection ──▶ /success?session_id=…
                                                       │                         (affiche l'état lu en base)
                                                       ▼
                              POST /api/webhooks/stripe  (signature vérifiée sur le corps brut)
                                            │
                                            ▼
                         services/stripe-webhook-service.ts  (idempotent, transactionnel)
                            Order = PAID · Payment = SUCCEEDED · taxes, e-mail, adresse enregistrés
```

**La page `/success` n'est jamais une preuve de paiement.** Elle lit l'état de la commande en base, mise à jour
uniquement par le webhook signé (ou par la réconciliation). Tant que le webhook n'est pas arrivé, elle affiche
« Confirming your payment… » et se rafraîchit toute seule.

## Fichiers

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | Modèle de données (Product, Order, OrderItem, Payment, Refund, StripeEvent, RateLimit, User/Session/Account) |
| `lib/stripe.ts` | Client Stripe unique (serveur uniquement) |
| `lib/env.ts`, `lib/store-config.ts` | Variables d'environnement validées ; options livraison / taxes |
| `lib/rate-limit.ts` | Limitation de débit en base (fenêtre fixe, atomique) |
| `lib/auth.ts`, `lib/auth-config.ts`, `lib/auth-session.ts` | Connexion OAuth (Better Auth) et lecture de l'utilisateur côté serveur |
| `services/checkout-service.ts` | Validation du panier, réservation du stock, création de commande et de session |
| `services/order-service.ts` | Machine à états des commandes, stock, remboursements |
| `services/stripe-webhook-service.ts` | Routage des événements Stripe, idempotence |
| `services/auto-refund-service.ts` | Remboursement automatique des paiements pour commandes impossibles à honorer |
| `services/reconcile-service.ts` | Rattrapage des webhooks manqués et des checkouts abandonnés |
| `services/order-query-service.ts` | Commandes d'un utilisateur (page « My orders ») |
| `app/checkout/checkout-action.ts` | Server Action appelée par la page panier |
| `app/api/webhooks/stripe/route.ts` | Endpoint webhook |
| `app/api/cron/reconcile-orders/route.ts` | Réconciliation + remboursements automatiques + purge (protégé par `CRON_SECRET`) |
| `app/api/auth/[...all]/route.ts` | Endpoints de connexion Better Auth |

## États

```
Order   PENDING_PAYMENT ─ paiement confirmé ─▶ PAID ─ remboursement total ─▶ REFUNDED
                │ ├─ paiement asynchrone refusé ─▶ PAYMENT_FAILED   (stock restitué)
                │ ├─ session expirée ───────────▶ EXPIRED           (stock restitué)
                │ └─ panier modifié / erreur ───▶ CANCELED          (stock restitué)
Payment PENDING → PROCESSING → SUCCEEDED → PARTIALLY_REFUNDED / REFUNDED   (ou FAILED / CANCELED)
```

Chaque transition est un `UPDATE … WHERE status = <état attendu>` : elle ne se produit qu'une fois, même si
plusieurs événements arrivent en même temps.

**Stock.** Réservé au moment du checkout (déduit de `Product.stock`), conservé au paiement, restitué si la session
expire, échoue ou est annulée. Une réservation dure 31 minutes (durée de la session Stripe).

**Montants.** Tous en entiers d'unité mineure (centimes). `Order.subtotalCents` + `shippingCents` = le total attendu
avant taxes. Au paiement, le webhook vérifie que Stripe a encaissé exactement `sous-total + livraison + taxes`
(devise identique, aucune remise, taxes uniquement si Stripe Tax est activé), puis enregistre le total réel
(`totalCents`), les taxes (`taxCents`), l'e-mail du client et l'adresse d'expédition.

**Paiement tardif.** Si un paiement est confirmé après que la commande a été relâchée :
- le stock est encore disponible → la commande passe `PAID` ;
- le stock a été vendu entre-temps → la commande reste non honorée (`needsReview`, motif `OUT_OF_STOCK`) et le
  paiement est **remboursé automatiquement** (voir ci-dessous) ;
- le montant ou la devise ne correspondent pas → `needsReview`, motif `AMOUNT_MISMATCH`, **vérification manuelle**
  (pas de remboursement automatique). Repérez-les avec `SELECT * FROM "Order" WHERE "needsReview"`.

## Événements webhook

À configurer sur l'endpoint (`/api/webhooks/stripe`) :

| Événement | Effet |
|---|---|
| `checkout.session.completed` | Paiement confirmé (`payment_status = paid`) ; sinon paiement `PROCESSING` |
| `checkout.session.async_payment_succeeded` | Paiement asynchrone confirmé |
| `checkout.session.async_payment_failed` | Commande `PAYMENT_FAILED`, stock restitué |
| `checkout.session.expired` | Commande `EXPIRED`, stock restitué |
| `refund.created`, `refund.updated`, `refund.failed` | Synchronise la table `Refund` et les statuts |

`payment_intent.payment_failed` n'est volontairement pas utilisé : avec Checkout, un échec de carte laisse le client
réessayer dans la même session ; l'issue définitive est `completed` ou `expired`.

**Idempotence.** Chaque événement est inséré dans `StripeEvent` (contrainte `UNIQUE` sur `stripeEventId`) dans la même
transaction que ses effets. Une livraison en double, même simultanée, n'a aucun effet ; si le traitement échoue tout
est annulé, la route répond 500 et Stripe relivre l'événement.

## Remboursements

- **Manuels** : émettez-les depuis le Dashboard Stripe (ou l'API) ; les événements `refund.*` mettent à jour la base
  (partiel ou total, échec ultérieur, événements dans le désordre). Il n'existe volontairement aucun endpoint public de
  remboursement : le projet n'a pas de rôle administrateur pour le protéger.
- **Automatiques** : uniquement pour une commande payée mais devenue impossible à honorer (motif `OUT_OF_STOCK`).
  Remboursement intégral déclenché juste après le webhook, puis rattrapé par la réconciliation si l'appel Stripe a
  échoué. La clé d'idempotence `auto-refund-<orderId>` empêche tout double remboursement. Le webhook `refund.created`
  clôt ensuite le dossier (`needsReview = false`) et la page de succès affiche « Payment refunded ».

## Comptes clients (Google / GitHub)

Connexion OAuth avec [Better Auth](https://www.better-auth.com), sessions en base. **Optionnel** : sans variables
OAuth, le site fonctionne en paiement invité uniquement (aucun bouton « Sign in »).

1. Créez une application OAuth chez Google et/ou GitHub, avec pour URL de rappel
   `{NEXT_PUBLIC_BASE_URL}/api/auth/callback/google` et/ou `…/callback/github`.
2. Renseignez `BETTER_AUTH_SECRET` (32 caractères min., `openssl rand -base64 32`) et les paires
   `GOOGLE_CLIENT_ID/SECRET` et/ou `GITHUB_CLIENT_ID/SECRET` — au build **et** à l'exécution.
3. Le paiement invité reste possible. Un client connecté a son e-mail prérempli chez Stripe, sa commande est
   rattachée à son compte et il la retrouve sur `/orders` (« My orders »).

Sécurité : l'identité vient toujours de la session serveur (jamais d'un champ de formulaire) ; `/orders` redirige les
visiteurs anonymes vers `/login` et n'affiche que les commandes de l'utilisateur connecté ; une commande en cours n'est
jamais réutilisée par un autre utilisateur ; supprimer un compte conserve ses commandes (`userId` mis à null).

## Livraison et taxes (optionnels)

Aucune option n'est active par défaut, pour ne pas casser le checkout d'un compte Stripe non configuré.

- **Livraison** : `SHIPPING_COUNTRIES=CA,US` active la collecte de l'adresse par Stripe et des frais forfaitaires
  (`SHIPPING_FLAT_CENTS`, défaut 999 ; `FREE_SHIPPING_OVER_CENTS` pour offrir la livraison au-delà d'un sous-total).
  Les frais sont calculés côté serveur et exprimés dans la devise de la commande. L'adresse d'expédition confirmée est
  enregistrée sur la commande (`shippingName`, `shippingAddress`).
- **Taxes** : `STRIPE_AUTOMATIC_TAX=true` délègue le calcul à [Stripe Tax](https://docs.stripe.com/tax). Activez-le
  d'abord dans le Dashboard (Paramètres → Tax, avec votre adresse d'origine et vos immatriculations), sinon Stripe
  refuse la création de la session. Les prix sont déclarés hors taxes ; les taxes s'ajoutent au paiement.

## E-mail de confirmation

Le site n'envoie pas d'e-mails lui-même (pas de service d'envoi à configurer). Stripe envoie le **reçu** au client :
Dashboard → Paramètres → Emails des clients (*Customer emails*) → activez « Paiements réussis » (à vérifier en mode
live : les reçus ne sont pas garantis en mode test). L'adresse saisie (ou préremplie pour un client connecté) est
enregistrée sur la commande (`customerEmail`).

## Limitation de débit

La Server Action de checkout est limitée à **15 tentatives par tranche de 10 minutes et par adresse IP**
(compteur en base, l'IP n'est stockée que sous forme de hash). Elle protège contre la réservation de stock sans
paiement. L'adresse est lue dans `x-forwarded-for` : ce n'est fiable que derrière un proxy de confiance (Vercel,
Cloudflare…). Les compteurs périmés sont purgés par la réconciliation.

## Développement local

Prérequis : Node 20+, Docker, [Stripe CLI](https://docs.stripe.com/stripe-cli).

```bash
npm install
cp .env.example .env          # puis renseignez STRIPE_SECRET_KEY (sk_test_…)
npm run db:up                 # PostgreSQL local (port 5433)
npm run db:migrate            # applique les migrations
npm run db:seed               # 4 produits d'exemple
npm run dev
```

Dans un second terminal, relayez les webhooks vers votre machine :

```bash
stripe login
npm run stripe:listen         # affiche un secret « whsec_… » → à mettre dans STRIPE_WEBHOOK_SECRET, puis relancez `npm run dev`
```

Parcours de test : ajoutez un produit au panier → *Proceed to Payment* → carte de test `4242 4242 4242 4242`
(date future, CVC quelconque). Carte refusée : `4000 0000 0000 0002`. Vérifiez ensuite la commande avec
`npm run db:studio`.

**Importer votre catalogue Stripe existant** (une seule fois) : `npm run db:import-stripe` (option `-- --stock 25`).
Les produits déjà en base ne sont jamais modifiés ; les ids `prod_…` sont conservés.

## Tests

```bash
npm run db:up      # les tests utilisent la base « ecommerce_test » du même conteneur
npm test
```

Les tests d'intégration tournent contre un vrai PostgreSQL ; Stripe est simulé, mais la **vérification de signature
des webhooks est réelle** (`stripe.webhooks.constructEvent`). Ils couvrent : validation du panier, prix relus en base,
stock et concurrence (pas de survente), doublons de checkout, signature valide/invalide, événements en double ou
simultanés, échec en cours de traitement, expiration, paiement tardif, remboursements (manuels et automatiques),
réconciliation, livraison, taxes, limitation de débit, rattachement des commandes aux comptes et autorisation.

Non couvert automatiquement : le flux OAuth complet chez Google/GitHub (nécessite de vraies clés) et un paiement
réel chez Stripe (nécessite `sk_test_…`) — à vérifier à la main une fois configurés.

## Production

1. **Base** : PostgreSQL hébergé (Supabase, Neon…). Renseignez `DATABASE_URL` (pooler) et `DIRECT_URL` (connexion
   directe, utilisée par les migrations), puis `npm run db:deploy`.
2. **Clés Stripe** : passez en mode live seulement après avoir testé en mode test ; `STRIPE_SECRET_KEY` (`sk_live_…`)
   dans les secrets de l'hébergeur, jamais dans le dépôt.
3. **Webhook** : Dashboard Stripe → Développeurs → Webhooks → ajouter
   `https://<votre-domaine>/api/webhooks/stripe` avec les événements du tableau ci-dessus ; copiez son *secret de
   signature* dans `STRIPE_WEBHOOK_SECRET`. Ce secret est différent de celui de `stripe listen`.
4. **`NEXT_PUBLIC_BASE_URL`** : l'URL publique HTTPS du site (aussi utilisée par la connexion OAuth).
5. **Réconciliation** : planifiez un appel régulier (ex. toutes les 15 min) à `GET /api/cron/reconcile-orders` avec
   l'en-tête `Authorization: Bearer <CRON_SECRET>` (Vercel Cron l'ajoute automatiquement si `CRON_SECRET` est défini).
   Elle rattrape un webhook perdu, libère le stock des checkouts abandonnés, relance les remboursements
   automatiques échoués et purge les compteurs de limitation de débit.
6. **Images** : les hôtes d'images autorisés sont dans `next.config.ts` (`remotePatterns`, actuellement
   `files.stripe.com`). Ajoutez ceux de vos propres images.
7. **Optionnel** : OAuth (`BETTER_AUTH_SECRET`, clés Google/GitHub), livraison (`SHIPPING_*`), taxes
   (`STRIPE_AUTOMATIC_TAX`), reçus Stripe (Dashboard).

## Limites connues

- **Pas d'e-mails personnalisés** : seul le reçu Stripe est envoyé (voir plus haut). Pas de suivi d'expédition.
- **Livraison forfaitaire uniquement** : pas de tarifs par pays ni par poids.
- **Pas de rôle administrateur** : les commandes se gèrent via le Dashboard Stripe et la base (`npm run db:studio`).
  Les commandes `AMOUNT_MISMATCH` sont à traiter à la main.
- **Pas de mot de passe** : connexion par Google/GitHub uniquement.
