# CLAUDE.md — Hublo.be (MVP v0.1)

> Source de vérité unique pour le développement de la **v0.1**.
> Vision long terme dans `ROADMAP.md` — **ne rien coder depuis ROADMAP** tant que ce n'est pas remonté ici.

---

## Contexte

Hublo.be est une plateforme marketplace de **produits locaux** belge. Le fondateur migre dans les 60 jours **30 clients et 15 producteurs** depuis La Ruche Qui Dit Oui (service fermé). Il opère déjà **1 point de collecte**, encaisse sur le compte de l'association (qui facture le client) et reverse **HT** aux producteurs chaque mois.

**Objectif v0.1** : remplacer LRQDO avec un outil plus simple et plus flexible, en 4 semaines de dev, bascule utilisateurs à 60 jours. Préparer la base pour ouvrir 5-6 points dans les 6 mois.

**Hors scope v0.1** : tout ce qui ne sert pas directement à faire tourner 1 point de collecte avec 15 producteurs et 30 clients (voir section "Hors scope" plus bas).

---

## Règles de travail

1. **Toujours lire ce fichier avant de coder.** Si quelque chose n'est pas dedans, demander plutôt qu'inventer.
2. **Ne PAS coder depuis `ROADMAP.md`.** C'est une archive long terme, pas un cahier des charges.
3. **Poser des questions** dès qu'une décision métier est ambiguë, plutôt que deviner.
4. **Respecter les règles d'architecture non négociables** (section dédiée).
5. **Tests unitaires obligatoires** sur les calculs financiers (prix TTC, commissions, reversements). Tests d'intégration sur webhook Mollie (idempotence + race condition stock). Pas de tests e2e Playwright au MVP.
6. **Mobile-first.** La majorité des clients commandent depuis leur téléphone.
7. **FR hardcodé au MVP** (pas de `next-intl`). La migration vers l'i18n est documentée pour plus tard.
8. **Jamais d'UUID dans les URLs publiques** — toujours des slugs.

---

## Rôles utilisateurs

| Rôle | Description |
|---|---|
| `admin` | Le fondateur. Accès total : producteurs, produits, points de collecte, ventes, paramètres, exports. |
| `client` | Inscription libre. Commande, panier, historique perso. |

Le rôle `coordinator` est **prévu en schéma** (colonne `coordinator_user_id` sur `collection_points`) mais **aucune UI au MVP**. On l'activera quand le fondateur recrutera son 2e coordinateur (~J+60).

---

## Stack

| Couche | Techno |
|---|---|
| Frontend + API | Next.js 14 (App Router, Server Components, Route Handlers), TypeScript |
| Styling | Tailwind CSS |
| Backend | Supabase (Postgres, Auth, Storage, Cron Jobs) |
| Paiements | **Mollie standard** (Bancontact + carte) — **pas** Mollie Connect |
| Emails | Resend |
| Hébergement | Vercel + Supabase Cloud région EU (RGPD) |
| Tests | Vitest (unit + intégration) |

---

## Règles d'architecture non négociables

1. **Supabase Auth = source de vérité.** `users.id = auth.users.id`. Pas de `password_hash` dans les tables métier. Ne jamais comparer `auth.uid()` à un `profile.id` (on n'a pas de profils séparés au MVP, mais la règle reste : comparer à `users.id`).
2. **Montants en centimes entiers** (`int`). Jamais de `decimal`. Conversion en euros uniquement à l'affichage.
3. **Commissions en basis points** (`int`). `3500 = 35%`.
4. **Suppression logique uniquement.** Pas de `DELETE` sur données métier. Utiliser `status` / `archived_at`.
5. **Idempotence obligatoire** sur le webhook Mollie. Enregistrer chaque événement dans `payment_webhook_events` **avant** tout traitement métier.
6. **Snapshots financiers figés** dans `order_lines` (prix HT, TVA, commissions). Ne jamais recalculer depuis les tables source.
7. **Abstraction `PaymentProvider`.** Aucun appel direct au SDK Mollie dans le code métier.
8. **Fonction centrale unique de calcul prix / commission / TVA**, testée unitairement, utilisée partout.
9. **RLS activé sur toutes les tables métier.** Règles simples au MVP : client voit ses commandes/lignes/paniers ; admin voit tout ; lecture publique sur `products`/`producers`/`collection_points`/`sales` actifs.
10. **Mobile-first.** Zones tactiles ≥ 44×44px, pas de hover-only, sticky CTA panier/paiement.
11. **Pas d'UUID dans les URLs publiques.** Slugs uniques sur `products`, `producers`, `collection_points`.

---

## Schéma de base de données (v0.1)

### Authentification & paramètres

```sql
users (
  id         uuid PRIMARY KEY,              -- = auth.users.id
  email      text UNIQUE NOT NULL,
  first_name text,
  last_name  text,
  phone      text,
  role       text NOT NULL,                 -- 'admin' | 'client'
  status     text NOT NULL DEFAULT 'active',-- 'active' | 'suspended' | 'disabled'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
)
-- Graine : ('platform_commission_bps', '3500')
```

### Producteurs & points de collecte

```sql
producers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  description text,
  vat_number  text,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
)

collection_points (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        text NOT NULL,
  slug                        text UNIQUE NOT NULL,
  address                     text NOT NULL,
  schedule                    jsonb,          -- { "day": "saturday", "start": "11:00", "end": "13:00" }
  coordinator_user_id         uuid REFERENCES users(id),   -- NULL au MVP (= admin par défaut)
  coordinator_commission_bps  int NOT NULL DEFAULT 0,      -- 0 au MVP, activé quand un vrai coordinator arrive
  status                      text NOT NULL DEFAULT 'active',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
)
```

### Catalogue produits

```sql
products (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id          uuid NOT NULL REFERENCES producers(id),
  collection_point_id  uuid REFERENCES collection_points(id),   -- rattachement simple au MVP
  name                 text NOT NULL,
  slug                 text UNIQUE NOT NULL,
  description          text NOT NULL,
  photo_url            text,
  photo_alt            text,                                    -- obligatoire pour a11y/SEO
  price_ht_cents       int NOT NULL CHECK (price_ht_cents BETWEEN 10 AND 999900),
  vat_rate             int NOT NULL CHECK (vat_rate IN (0, 6, 21)),
  stock_unlimited      boolean NOT NULL DEFAULT true,
  stock_qty            int,                                     -- NULL si illimité
  status               text NOT NULL DEFAULT 'active',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_coherence CHECK (
    (stock_unlimited = true  AND stock_qty IS NULL) OR
    (stock_unlimited = false AND stock_qty IS NOT NULL AND stock_qty >= 0)
  )
)
```

**Pas de variantes au MVP.** 1 produit = 1 prix. Si un producteur veut 250g et 500g, il crée 2 produits.

### Ventes & commandes

```sql
sales (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_point_id   uuid NOT NULL REFERENCES collection_points(id),
  distribution_date     date NOT NULL,
  distribution_start_at timestamptz,
  distribution_end_at   timestamptz,
  closes_at             timestamptz NOT NULL,   -- clôture automatique (ex: jeudi 23:59 pour distribution samedi)
  status                text NOT NULL DEFAULT 'draft',
  -- 'draft' | 'open' | 'closed' | 'distributed' | 'cancelled'
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
)

orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id   uuid NOT NULL REFERENCES users(id),
  sale_id          uuid NOT NULL REFERENCES sales(id),
  status           text NOT NULL DEFAULT 'draft',
  -- 'draft' | 'pending_payment' | 'confirmed' | 'cancelled' | 'payment_failed'
  total_ht_cents   int NOT NULL DEFAULT 0,
  total_tva_cents  int NOT NULL DEFAULT 0,
  total_ttc_cents  int NOT NULL DEFAULT 0,
  locked_at        timestamptz,           -- verrouillé pendant le paiement
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_user_id, sale_id)
)

order_lines (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                    uuid NOT NULL REFERENCES orders(id),
  product_id                  uuid NOT NULL REFERENCES products(id),
  producer_id                 uuid NOT NULL REFERENCES producers(id),  -- snapshot pour vue reversement
  qty                         int NOT NULL CHECK (qty > 0),
  unit_price_ht_cents         int NOT NULL,   -- snapshot
  vat_rate                    int NOT NULL,   -- snapshot
  platform_commission_bps     int NOT NULL,   -- snapshot
  coordinator_commission_bps  int NOT NULL DEFAULT 0,   -- snapshot
  status                      text NOT NULL DEFAULT 'active',
  created_at                  timestamptz NOT NULL DEFAULT now()
)

cart_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id  uuid NOT NULL REFERENCES users(id),
  sale_id         uuid NOT NULL REFERENCES sales(id),
  product_id      uuid NOT NULL REFERENCES products(id),
  qty             int NOT NULL CHECK (qty > 0),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_user_id, product_id)
)
-- Panier persistant en DB (résiste à la fermeture du navigateur mobile)
-- Pas de réservation de stock à l'ajout panier — seule la confirmation de paiement décrémente le stock
```

### Paiements & idempotence

```sql
payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES orders(id),
  provider            text NOT NULL DEFAULT 'mollie',
  provider_payment_id text NOT NULL,
  amount_cents        int NOT NULL,
  status              text NOT NULL,   -- 'created' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'
  payload             jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id)
)

payment_webhook_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            text NOT NULL,
  provider_event_id   text,
  provider_payment_id text NOT NULL,
  payload             jsonb NOT NULL,
  processed           boolean NOT NULL DEFAULT false,
  processed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id, provider_event_id)
)
```

---

## Calcul financier (fonction centrale unique, testée)

```
prix_ht_producteur  (= products.price_ht_cents, saisi par l'admin)
  × (1 + platform_commission_bps / 10000)
  × (1 + coordinator_commission_bps / 10000)       // = 1 au MVP tant que coord = 0
  = prix_ht_client

prix_ht_client × (1 + vat_rate / 100) = prix_ttc_client
```

**Exemple** (commission plateforme 35%, coord 0%, TVA 6%) :

```
Prix HT producteur    :  740 cts (7,40 €)
× 1,35 (plateforme)   :  999 cts (9,99 €)   → prix HT client
× 1,06 (TVA 6%)       : 1 059 cts (10,59 €) → prix TTC client
```

**Reversements** (depuis snapshots `order_lines`) :

- **Reversement producteur** = `Σ (qty × unit_price_ht_cents)` des lignes `status='active'`.
- **Commission coordinateur à payer** = `Σ (qty × unit_price_ht_cents × coordinator_commission_bps / 10000)`.
- **Commission plateforme conservée** = `total_ttc − total_tva − producteur − coordinateur`.

**Règle d'arrondi** : arrondi à l'entier le plus proche (half-up), uniquement à l'étape finale de chaque ligne. Documenté et testé dans une fonction unique.

---

## Features DANS v0.1

### Public (SSR, indexable)

- `/` : page d'accueil, vente(s) en cours
- `/points-de-collecte/[slug]` : fiche point de collecte + catalogue
- `/produits/[slug]` : fiche produit (metadata SEO + alt obligatoire)
- `/producteurs/[slug]` : fiche producteur + ses produits

### Auth

- `/auth/register` : inscription client (email + mot de passe)
- `/auth/login`
- **Pas d'import des 30 clients LRQDO.** Ils créent eux-mêmes leur compte via `/auth/register` (communication externe par email informant de la bascule).

### Client (`/client/*` protégé)

- Catalogue + panier (persistant DB) sur la vente ouverte
- Modifications panier libres tant que `sales.status = 'open'`
- Checkout → Mollie → retour sur page de confirmation
- Historique des commandes perso

### Admin (`/admin/*` protégé)

- CRUD producteurs
- CRUD produits (prix HT, TVA, photo upload WebP, stock)
- CRUD points de collecte
- CRUD ventes (créer/ouvrir/clôturer manuellement/annuler, `closes_at` configurable)
- Paramètres globaux : `platform_commission_bps`
- **Liste des commandes par vente**
- **Bon de préparation HTML imprimable** (vue par produit + vue par client)
- **Vue "à reverser par producteur"** pour une période (lecture depuis `order_lines` confirmés)
- **Export CSV des ventes pour Odoo** (période paramétrable, colonnes : date, client, producteur, produit, qty, HT, TVA, TTC)
- Gestion users (suspendre/réactiver)

### Paiement

- Intégration Mollie **standard** via interface `PaymentProvider`
- `POST /api/webhooks/mollie` idempotent :
  1. `INSERT` dans `payment_webhook_events` (UNIQUE bloque les doublons)
  2. Si déjà `processed = true` → 200 et stop
  3. Vérifier le paiement auprès de l'API Mollie
  4. Transaction PG atomique : `SELECT FOR UPDATE` sur les `products` concernés, vérif stock, `orders.status = 'confirmed'`, décrément `stock_qty`, update `payments.status`, `payment_webhook_events.processed = true`
  5. Hors transaction : email confirmation via Resend

### Automatisations (Supabase Cron)

- `close-sales` toutes les 5 min : `UPDATE sales SET status='closed' WHERE closes_at < now() AND status='open'`
- Sur passage `open → closed` : déclencher envoi du bon de préparation par email au(x) producteur(s) concerné(s)

---

## Hors scope v0.1 (à faire plus tard — voir `ROADMAP.md`)

Liste **exhaustive** de ce qu'on ne code PAS au MVP :

- Mollie **Connect**, KYC producteurs, splits, virements auto (`payouts`)
- WhatsApp Business API
- Système de **crédit client** + expiration + cron
- **Consignes** et retours de consignes
- **Remboursements dans l'app** (le fondateur gère à la main via Mollie dashboard + virement)
- Modification de commande **après paiement** (le client annule et refait)
- Paiement **mixte** crédit + carte
- **Variantes** produit multiples, **catégories**, **favoris**
- **Choix** de plusieurs points de collecte par client (au MVP : 1 seul point)
- `stock_movements` détaillé (décrément simple suffit)
- `events_log` systématique
- `admin_permissions` granulaires
- **i18n `next-intl`** (FR hardcodé — migration documentée, estimée ~1 jour quand on ouvrira en NL)
- **Exports PDF/XLS** (HTML imprimable + CSV couvrent les besoins réels)
- **Supabase Realtime**
- Tests **e2e Playwright** et tests de charge
- Espace comptabilité complet (seulement l'export CSV au MVP)
- Suspension client pilotée par un coordinateur (admin direct suffit)

Si un besoin remonte pendant le MVP et qu'il est listé ici, **demander** avant d'ajouter — ce n'est pas une évidence.

---

## Plan de développement v0.1 — 4 semaines

- [ ] **Semaine 1 — Fondations**
  - Setup Next.js 14 + TypeScript + Tailwind + Vercel + GitHub CI
  - Projet Supabase (région EU) + CLI local
  - Migrations schéma complet ci-dessus + RLS policies
  - Supabase Auth (email/password) + middleware Next.js (session + rôle)
  - Page d'accueil publique minimale
  - Seed initial (`platform_commission_bps = 3500`)

- [ ] **Semaine 2 — Admin & catalogue public**
  - Admin CRUD : producteurs, produits (photo WebP via Supabase Storage), points de collecte, ventes
  - Paramètres globaux (commission plateforme)
  - Pages publiques indexables : home, points de collecte, producteurs, produits (slugs, metadata)

- [ ] **Semaine 3 — Panier & paiement**
  - `cart_items` + UI panier mobile-first (sticky CTA)
  - Interface `PaymentProvider` + impl `MollieProvider`
  - Route `POST /api/webhooks/mollie` idempotent
  - Fonction centrale de calcul prix/commission/TVA + tests unitaires Vitest
  - Test d'intégration : double webhook + race condition stock
  - Emails Resend (confirmation commande, bon de préparation)

- [ ] **Semaine 4 — Distribution & polish**
  - Bon de préparation HTML (par produit + par client)
  - Vue "à reverser par producteur"
  - Export CSV Odoo
  - Cron Supabase `close-sales` + envoi auto bon de préparation
  - Historique commandes client + vue admin commandes par vente
  - DNS (SPF/DKIM/DMARC pour `hublo.be` → Resend)
  - Déploiement prod, Mollie live, QA sur mobile réel, invitation des 30 clients

**Mettre à jour cette checklist au fil des sprints.**

---

## Variables d'environnement

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Paiement
PAYMENT_PROVIDER=mollie
MOLLIE_API_KEY=
MOLLIE_WEBHOOK_SECRET=

# Email
RESEND_API_KEY=
RESEND_FROM=noreply@hublo.be

# App
NEXT_PUBLIC_APP_URL=
NODE_ENV=
```

---

## Environnements & déploiement

- **Local** : Next.js dev + Supabase CLI
- **Staging** : Vercel preview + projet Supabase de test + Mollie sandbox
- **Production** : Vercel prod + Supabase prod (EU) + Mollie live

**Règle** : clés Mollie **sandbox** en staging uniquement, clés **live** sur `main` uniquement. Tester le webhook en staging avant chaque passage en prod.

---

## Points d'attention critiques pour le MVP

1. **Idempotence webhook Mollie** — `UNIQUE (provider, provider_payment_id, provider_event_id)` + vérif `processed` avant traitement. Tester avec deux webhooks simultanés.
2. **Race condition stock** — `SELECT FOR UPDATE` dans la transaction de confirmation. Tester avec 2 commandes concurrentes sur le dernier stock.
3. **Snapshots financiers** — `order_lines` fige prix HT + TVA + commission à la commande. Si l'admin modifie le prix ou la commission après, **les commandes existantes ne bougent pas**.
4. **Montants en centimes partout.** Pas de `decimal`. Tests unitaires sur la fonction de calcul centrale.
5. **Mobile-first** — valider le parcours panier/paiement sur un vrai téléphone (pas juste DevTools) avant la bascule.
6. **DNS SPF/DKIM/DMARC** avant le premier envoi d'emails en prod, sinon les emails tombent en spam.
7. **Sauvegarde Supabase** activée avant la prod.

---

## Décisions verrouillées

- **Annulation de vente** : admin uniquement. Remboursement via **Mollie refund API** (pas de crédit client au MVP).
- **Inscription des clients existants LRQDO** : **pas d'import**. Ils créent leur compte eux-mêmes sur `/auth/register`. Communication externe par email.
- **Panier avant connexion** : stocké en `localStorage` tant que l'utilisateur n'est pas connecté, migré vers `cart_items` (DB) au login ou register.

## Questions ouvertes (non bloquantes)

- **CGU / politique de confidentialité** : placeholder au MVP, rédaction avant bascule.
