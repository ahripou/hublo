# ROADMAP — Hublo.be (vision long terme)

> **Ce document n'est PAS le scope actif du développement.**
> Le scope actif est dans `CLAUDE.md` (MVP v0.1).
> Ce document est la **vision cible** (v1 complète). On y pioche progressivement après validation du MVP avec des utilisateurs réels.
>
> Règle : ne rien coder d'ici qui ne soit pas déjà dans `CLAUDE.md`.

---

# Hublo.be — Spécifications techniques & fonctionnelles (v1 cible)

> Document de référence pour le développement de la plateforme marketplace de produits locaux.
> À maintenir à jour au fil des sprints.

---

## Vue d'ensemble

Plateforme de vente de produits locaux en mode marketplace, avec un système de points de collecte gérés par des coordinateurs rémunérés à la commission. Les producteurs mettent leurs produits en vente, les clients commandent en ligne et récupèrent leurs commandes à un point de collecte.

**Domaine** : hublo.be  
**Stack** : Next.js 14 + Supabase + Mollie Connect  
**Langue MVP** : français uniquement (structure i18n prête pour nl/en en phase 2)

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend + API | Next.js 14 (App Router, Server Components, Route Handlers) |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions, Cron Jobs) |
| Paiements | Mollie Connect (Bancontact, carte, splits, virements) |
| Emails | Resend |
| Notifications | WhatsApp Business API (compte Meta à créer — délai 2-4 semaines) |
| Hébergement | Vercel (Next.js) + Supabase Cloud région EU (RGPD) |
| Exports | `xlsx` (Excel) + `react-pdf` ou `puppeteer` (PDF) — côté serveur |
| Tests | Vitest (unit + intégration) + Playwright (e2e) |

---

## Principes d'architecture — règles non négociables

1. **Supabase Auth est la source de vérité** — pas de `password_hash` dans les tables métier. `users.id = auth.users.id`.

2. **Montants en centimes entiers** — `int` ou `bigint`. Jamais de `decimal` pour les montants financiers. Conversion en euros uniquement à l'affichage.

3. **Commissions en basis points** — `1250 = 12.50%`. Jamais de `decimal` pour les pourcentages financiers.

4. **Suppression logique uniquement** — jamais de `DELETE` sur les données métier. Utiliser `status`, `archived_at`, `deleted_at`.

5. **RLS activé sur toutes les tables métier** — policies basées sur `auth.uid()` avec conversion explicite vers les profils métier.

6. **Idempotence obligatoire** — pour tous les webhooks de paiement et traitements financiers asynchrones.

7. **Snapshots financiers** — prix, TVA, consignes et commissions dans `order_lines` sont figés au moment de la commande. Ne jamais recalculer depuis les tables source.

8. **Journal immuable** — `credit_transactions` et `events_log` : jamais de `UPDATE`, toujours `INSERT`.

9. **Abstraction couche paiement** — aucun appel direct au SDK Mollie dans le code métier. Tout passe par une interface `PaymentProvider`.

---

## Rôles utilisateurs

| Rôle | Description |
|---|---|
| `super_admin` | Accès total, crée les admins, configure les permissions globales |
| `admin` | Accès délégué selon périmètre défini par le super_admin |
| `coordinateur` | Gère un ou plusieurs points de collecte, rémunéré à la commission |
| `producteur` | Gère son catalogue, responsable légal de ses produits |
| `client` | Commande des produits sur les points de collecte |

> **Responsabilité légale** : la vente se fait directement entre le producteur et le client. La plateforme et le coordinateur sont des facilitateurs techniques. Le producteur est seul responsable de la conformité, qualité et obligations légales/sanitaires de ses produits. À préciser dans les CGU de chaque rôle.

---

## Structure des routes Next.js

```
/                          → vitrine publique (points de collecte, ventes en cours)
/auth/login                → connexion
/auth/register             → inscription client
/client/                   → espace client (protégé)
/coordinateur/             → espace coordinateur (protégé)
/producteur/               → espace producteur (protégé)
/admin/                    → espace admin (protégé)
```

Le middleware Next.js vérifie à chaque requête :
- existence d'une session valide
- rôle applicatif correspondant à la route
- statut du compte (`suspended`, `disabled` → redirection)

---

## Schéma de base de données

### Tables — Authentification & utilisateurs

```sql
-- Table applicative reliée 1:1 à auth.users
users (
  id            uuid PRIMARY KEY,              -- = auth.users.id
  email         text UNIQUE NOT NULL,
  first_name    text,
  last_name     text,
  phone         text,
  role          text NOT NULL,                 -- 'super_admin'|'admin'|'coordinateur'|'producteur'|'client'
  status        text NOT NULL DEFAULT 'active',-- 'active'|'suspended'|'disabled'
  locale        text DEFAULT 'fr',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
)

profiles_client (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid UNIQUE NOT NULL REFERENCES users(id),
  address               text,                  -- optionnel, requis si livraison (phase 2)
  notification_channel  text NOT NULL DEFAULT 'email', -- 'email'|'whatsapp'|'both'
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
)

profiles_producteur (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid UNIQUE NOT NULL REFERENCES users(id),
  company_name            text NOT NULL,
  slug                    text UNIQUE NOT NULL,
  description             text,
  vat_number              text,
  platform_commission_bps int NOT NULL DEFAULT 0,  -- ex: 1250 = 12.50%
  mollie_account_id       text,
  kyc_status              text NOT NULL DEFAULT 'pending', -- 'pending'|'verified'|'rejected'
  status                  text NOT NULL DEFAULT 'active',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
)

profiles_coordinateur (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid UNIQUE NOT NULL REFERENCES users(id),
  display_name            text,
  commission_bps          int NOT NULL DEFAULT 0,      -- fixé par le coordinateur
  commission_max_bps      int NOT NULL DEFAULT 0,      -- plafond fixé par l'admin
  status                  text NOT NULL DEFAULT 'active',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
)

-- Permissions granulaires pour les admins délégués
admin_permissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  code       text NOT NULL,  -- 'manage_users'|'manage_refunds'|'view_finance'|etc.
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
)
```

### Tables — Points de collecte

```sql
collection_points (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_id uuid NOT NULL REFERENCES profiles_coordinateur(id),
  name           text NOT NULL,
  slug           text UNIQUE NOT NULL,
  description    text,
  address        text NOT NULL,
  timezone       text NOT NULL DEFAULT 'Europe/Brussels',
  schedule       jsonb NOT NULL, -- { "day": "saturday", "start": "11:00", "end": "13:00" }
  status         text NOT NULL DEFAULT 'active', -- 'active'|'inactive'|'archived'
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
)

collection_point_producers (
  collection_point_id uuid NOT NULL REFERENCES collection_points(id),
  producer_id         uuid NOT NULL REFERENCES profiles_producteur(id),
  status              text NOT NULL DEFAULT 'active',
  added_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_point_id, producer_id)
)
-- Dès qu'un producteur est ajouté à un point, tous ses produits actifs
-- deviennent visibles pour les clients de ce point.

client_collection_points (
  client_id           uuid NOT NULL REFERENCES profiles_client(id),
  collection_point_id uuid NOT NULL REFERENCES collection_points(id),
  is_default          boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, collection_point_id)
)
```

### Tables — Catalogue produits

```sql
categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  status     text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
)

products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id      uuid NOT NULL REFERENCES profiles_producteur(id),
  category_id      uuid REFERENCES categories(id),
  slug             text UNIQUE NOT NULL,
  name             text NOT NULL,
  description      text NOT NULL,        -- min 50 caractères recommandé (SEO)
  photo_url        text,
  photo_alt        text,                 -- obligatoire pour l'accessibilité et le SEO
  vat_rate         int NOT NULL CHECK (vat_rate IN (0, 6, 21)),
  status           text NOT NULL DEFAULT 'active', -- 'active'|'suspended'|'archived'
  min_colisage     int,                  -- optionnel, décision du producteur
  colisage_hard_stop boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
)

product_variants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       uuid NOT NULL REFERENCES products(id),
  label            text NOT NULL,        -- ex: '250g', '500g', '1kg'
  price_ht_cents   int NOT NULL,
  stock_unlimited  boolean NOT NULL DEFAULT true,
  stock_qty        int,                  -- NULL si illimité
  status           text NOT NULL DEFAULT 'active',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_min CHECK (price_ht_cents >= 10),       -- min 0,10€ HT
  CONSTRAINT price_max CHECK (price_ht_cents <= 999900),   -- max 9 999€ HT
  CONSTRAINT stock_coherence CHECK (
    (stock_unlimited = true  AND stock_qty IS NULL) OR
    (stock_unlimited = false AND stock_qty IS NOT NULL AND stock_qty >= 0)
  )
)

deposits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id),
  label       text NOT NULL,
  amount_cents int NOT NULL CHECK (amount_cents >= 0),
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now()
)
-- TVA consigne = 0% toujours — affichée séparément du prix produit

client_favorites (
  client_id          uuid NOT NULL REFERENCES profiles_client(id),
  product_variant_id uuid NOT NULL REFERENCES product_variants(id),
  added_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, product_variant_id)
)
```

### Tables — Stock

```sql
-- Journal des mouvements de stock (audit + traçabilité)
stock_movements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id  uuid NOT NULL REFERENCES product_variants(id),
  movement_type       text NOT NULL,
  -- 'initial'|'manual_adjustment'|'order_confirmed'|'order_cancelled'|'refund_restock'
  quantity_delta      int NOT NULL,   -- négatif si sortie, positif si retour
  ref_order_id        uuid,
  ref_order_line_id   uuid,
  comment             text,
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
)
```

**Stock disponible (vue temps réel)**
```sql
SELECT
  pv.stock_qty
  - COALESCE(SUM(ol.qty) FILTER (
      WHERE o.status = 'confirmed'
      AND ol.status = 'active'
      AND o.sale_id = :sale_id
    ), 0) AS stock_disponible
FROM product_variants pv
LEFT JOIN order_lines ol ON ol.product_variant_id = pv.id
LEFT JOIN orders o ON o.id = ol.order_id
WHERE pv.id = :variant_id
GROUP BY pv.stock_qty;
```

### Tables — Ventes & commandes

```sql
sales (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_point_id  uuid NOT NULL REFERENCES collection_points(id),
  distribution_date    date NOT NULL,
  distribution_start_at timestamptz,   -- début créneau de collecte
  distribution_end_at   timestamptz,   -- fin créneau de collecte
  closes_at            timestamptz NOT NULL,  -- clôture automatique des commandes
  status               text NOT NULL DEFAULT 'draft',
  -- 'draft'|'open'|'closed'|'distributed'|'validated'|'cancelled'
  validated_at         timestamptz,
  validated_by         uuid REFERENCES users(id),
  cancelled_at         timestamptz,
  cancelled_by         uuid REFERENCES users(id),
  cancellation_message text,           -- message personnalisé envoyé aux clients
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
)

orders (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               uuid NOT NULL REFERENCES profiles_client(id),
  sale_id                 uuid NOT NULL REFERENCES sales(id),
  status                  text NOT NULL DEFAULT 'draft',
  -- 'draft'|'pending_payment'|'confirmed'|'partially_refunded'|'fully_refunded'|'cancelled'|'payment_failed'
  total_ht_cents          int NOT NULL DEFAULT 0,
  total_tva_cents         int NOT NULL DEFAULT 0,
  total_deposit_cents     int NOT NULL DEFAULT 0,
  total_ttc_cents         int NOT NULL DEFAULT 0,
  credit_used_cents       int NOT NULL DEFAULT 0,
  locked_at               timestamptz,  -- verrouillage pendant traitement paiement
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, sale_id)           -- une seule commande active par client par vente
)

order_lines (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                    uuid NOT NULL REFERENCES orders(id),
  product_variant_id          uuid NOT NULL REFERENCES product_variants(id),
  qty                         int NOT NULL CHECK (qty > 0),
  unit_price_ht_cents         int NOT NULL,   -- snapshot
  vat_rate                    int NOT NULL,   -- snapshot
  deposit_cents               int NOT NULL DEFAULT 0, -- snapshot
  platform_commission_bps     int NOT NULL DEFAULT 0, -- snapshot
  coordinator_commission_bps  int NOT NULL DEFAULT 0, -- snapshot
  status                      text NOT NULL DEFAULT 'active',
  -- 'active'|'cancelled'|'refunded_partial'|'refunded_full'
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
)
```

### Tables — Paiements & idempotence

```sql
payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES orders(id),
  provider            text NOT NULL DEFAULT 'mollie', -- 'mollie'|'stripe'
  provider_payment_id text NOT NULL,
  payment_type        text NOT NULL, -- 'initial'|'delta_positive'
  amount_cents        int NOT NULL,
  status              text NOT NULL,
  -- 'created'|'pending'|'paid'|'failed'|'cancelled'|'refunded'
  payload             jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id)
)

-- Idempotence webhook — enregistrer chaque événement avant traitement
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

### Tables — Remboursements, crédits & consignes

```sql
refunds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders(id),
  order_line_id uuid REFERENCES order_lines(id), -- NULL si remboursement commande entière
  encoded_by    uuid NOT NULL REFERENCES users(id),
  reason        text,
  qty_refunded  int,
  amount_cents  int NOT NULL,
  type          text NOT NULL, -- 'partial'|'full'
  created_at    timestamptz NOT NULL DEFAULT now()
)

-- Journal immuable — jamais de UPDATE sur les mouvements financiers
credit_transactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid NOT NULL REFERENCES profiles_client(id),
  type           text NOT NULL,
  -- 'refund'|'deposit_return'|'used'|'delta_refund'|'expiration'
  amount_cents   int NOT NULL,  -- positif = crédit, négatif = débit
  ref_order_id   uuid REFERENCES orders(id),
  ref_refund_id  uuid REFERENCES refunds(id),
  expires_at     timestamptz,   -- NOW() + interval '1 year' à l'insertion
  expired        boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
)

deposit_returns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES profiles_client(id),
  collection_point_id uuid NOT NULL REFERENCES collection_points(id),
  product_id          uuid NOT NULL REFERENCES products(id),
  qty                 int NOT NULL CHECK (qty > 0),
  amount_cents        int NOT NULL,
  encoded_by          uuid NOT NULL REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
)
```

**Calcul du solde crédit**
```sql
SELECT COALESCE(SUM(amount_cents), 0) AS solde_cents
FROM credit_transactions
WHERE client_id = :client_id
  AND expired = false;
```

### Tables — Virements

```sql
payouts (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id           uuid NOT NULL REFERENCES users(id),
  recipient_type              text NOT NULL, -- 'producer'|'coordinator'
  sale_id                     uuid NOT NULL REFERENCES sales(id),
  gross_cents                 int NOT NULL,
  platform_commission_cents   int NOT NULL DEFAULT 0,
  coordinator_commission_cents int NOT NULL DEFAULT 0,
  refund_cents                int NOT NULL DEFAULT 0,
  net_cents                   int NOT NULL,
  provider                    text NOT NULL DEFAULT 'mollie',
  provider_transfer_id        text,
  status                      text NOT NULL DEFAULT 'pending',
  -- 'pending'|'scheduled'|'paid'|'failed'|'cancelled'
  scheduled_at                timestamptz,
  paid_at                     timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
)
```

### Tables — Audit & observabilité

```sql
-- Journal d'événements global — support, audit, debugging
events_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,  -- 'order'|'payment'|'sale'|'refund'|'user'|'payout'
  entity_id   uuid NOT NULL,
  event_type  text NOT NULL,  -- 'order.confirmed'|'sale.cancelled'|'refund.created'|etc.
  payload     jsonb,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
)
```

---

## RLS — Politiques de sécurité

### Helpers SQL — à créer en premier

```sql
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin' AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin') AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION current_client_profile_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM profiles_client WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_producer_profile_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM profiles_producteur WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_coordinator_profile_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM profiles_coordinateur WHERE user_id = auth.uid();
$$;
```

### Exemples de policies

```sql
-- PRODUCTS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_products" ON products
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "producer_own_products" ON products
FOR ALL USING (producer_id = current_producer_profile_id())
WITH CHECK (producer_id = current_producer_profile_id());

CREATE POLICY "public_read_active_products" ON products
FOR SELECT USING (status = 'active');

-- SALES
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_sales" ON sales
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "coordinator_own_sales" ON sales
FOR ALL USING (
  collection_point_id IN (
    SELECT id FROM collection_points
    WHERE coordinator_id = current_coordinator_profile_id()
  )
) WITH CHECK (
  collection_point_id IN (
    SELECT id FROM collection_points
    WHERE coordinator_id = current_coordinator_profile_id()
  )
);

-- ORDERS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_orders" ON orders
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "client_own_orders" ON orders
FOR ALL USING (client_id = current_client_profile_id())
WITH CHECK (client_id = current_client_profile_id());

-- ORDER_LINES
ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_order_lines" ON order_lines
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "client_own_order_lines" ON order_lines
FOR SELECT USING (
  order_id IN (
    SELECT id FROM orders WHERE client_id = current_client_profile_id()
  )
);

CREATE POLICY "producer_relevant_order_lines" ON order_lines
FOR SELECT USING (
  product_variant_id IN (
    SELECT pv.id FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE p.producer_id = current_producer_profile_id()
  )
);
```

> Les Edge Functions serveur utilisent la `service_role` pour les traitements système (webhooks, cron jobs, virements). Jamais exposée côté client.

---

## Calcul du prix client

```
Prix producteur HT (défini sur la variante)
× (1 + platform_commission_bps / 10000)
× (1 + coordinator_commission_bps / 10000)
= Prix HT client

Prix HT client × (1 + vat_rate / 100)
= Prix TTC client

+ Consigne (séparée, TVA 0%)
= Total ligne TTC
```

**Exemple concret**
```
Prix HT producteur    : 1 000 cts (10,00€)
Commission plateforme : 12.50% (1250 bps) → 125 cts
Commission coordinateur : 3.00% (300 bps) → 30 cts
Prix HT client        : 1 155 cts (11,55€)
TVA 6%                : 69 cts
Prix TTC client       : 1 224 cts (12,24€)
Consigne              : 50 cts
Total ligne           : 1 274 cts (12,74€)
```

> Tous les arrondis doivent être définis dans une **fonction centrale unique**, testée unitairement, utilisée partout.

---

## Gestion du stock

```
Règles :
→ Pas de réservation de stock à l'ajout panier
→ Stock validé uniquement au paiement Mollie confirmé
→ Vérification finale avec SELECT FOR UPDATE dans la transaction
→ Si stock épuisé entre panier et paiement :
     ligne affichée "épuisé" dans le panier
     retirée automatiquement au paiement
     message récapitulatif au client avant confirmation
→ Chaque mouvement écrit dans stock_movements (audit)
```

---

## Flux de paiement Mollie

```
1. Client valide panier → création enregistrement payments
2. Redirection vers Mollie (Bancontact, carte)
3. Mollie envoie webhook POST /api/webhooks/mollie
4. Edge Function (transaction atomique) :
   a. Enregistre l'événement dans payment_webhook_events
   b. Vérifie idempotence (déjà traité ? → stop)
   c. Vérifie le paiement auprès de l'API Mollie
   d. Ouvre transaction PostgreSQL
   e. SELECT FOR UPDATE sur les variants concernés
   f. Vérifie le stock une dernière fois
   g. Confirme la commande (status → 'confirmed')
   h. Insère les mouvements de stock
   i. Déduit le crédit utilisé si paiement mixte
   j. Écrit dans events_log
   k. Ferme la transaction
   l. Envoie notifications (email + WhatsApp)
5. Client redirigé vers page de confirmation
```

**Paiement mixte (crédit + carte)**
```
→ Crédit appliqué en premier
→ Solde restant payé par Mollie
→ Si paiement Mollie échoue : aucun débit crédit (tout est transactionnel)
```

---

## Modification de commande avant clôture

```
Conditions :
→ sale.status = 'open'
→ orders.locked_at IS NULL

Ajout de produits :
→ Nouveau paiement Mollie pour le delta positif
→ Nouvelles lignes order_lines
→ Nouvelle ligne payments (type = 'delta_positive')

Suppression de produits :
→ order_lines.status = 'cancelled'
→ Montant crédité (credit_transactions type = 'delta_refund')
→ Pas de remboursement carte (crédit immédiat, évite frais Mollie)

Modification quantité :
→ Traité comme suppression + ajout
```

---

## Cycle de vie d'une vente

```
DRAFT       → créée, pas encore visible aux clients
OPEN        → commandes acceptées
CLOSED      → clôture automatique, plus de commandes
              → bon de préparation envoyé aux producteurs
DISTRIBUTED → distribution en cours / terminée
              → fenêtre 36h pour corrections coordinateur
VALIDATED   → coordinateur valide (min 1h après fin créneau)
              → virements J+5 déclenchés
CANCELLED   → vente annulée (admin ou coordinateur)
              → remboursements intégraux en crédit
              → notifications clients avec message personnalisé
```

---

## Annulation de vente

### Annulation globale
```
Déclencheur : admin ou coordinateur
→ sales.status = 'cancelled'
→ Toutes les orders → 'cancelled'
→ Remboursement intégral en crédit pour chaque client
→ Notification email + WhatsApp avec message personnalisé
→ Aucun payout déclenché
```

### Annulation des produits d'un producteur sur une vente
```
Déclencheur : admin ou coordinateur (ex: producteur absent)
→ order_lines du producteur concerné → 'cancelled'
→ Crédit des montants correspondants pour les clients concernés
→ Notification uniquement aux clients concernés
→ Autres lignes de la vente non affectées
```

---

## Bon de préparation producteur

Envoyé automatiquement par email à la clôture de la vente. Également téléchargeable en PDF et XLS depuis l'espace producteur.

**Vue par produit** (pour la production)
```
Confiture fraise 250g  : 8 unités
Confiture fraise 500g  : 3 unités
Miel toutes fleurs 500g: 12 unités
```

**Vue par client** (pour l'emballage et l'étiquetage)
```
Martin Sophie : 2× Confiture fraise 250g, 1× Miel 500g
Dupont Jean   : 1× Confiture fraise 500g, 2× Miel 500g
```

---

## Remboursements

```
Qui peut encoder :
→ Coordinateur dans les 36h post-distribution
→ Admin / super_admin à tout moment

Granularité : par ligne, partiel ou total

Effet :
→ Crédit immédiat sur le compte client
→ Pas de remboursement carte au MVP
→ Aucune commission sur les lignes remboursées
→ Écriture dans refunds + credit_transactions + events_log
→ Notification client (email + WhatsApp)

Statuts mis à jour :
→ order_lines.status → 'refunded_partial' ou 'refunded_full'
→ orders.status → 'partially_refunded' ou 'fully_refunded'
```

---

## Système de crédit client

```
→ Solde en euros (centimes en base)
→ Calculé dynamiquement : SUM(credit_transactions.amount_cents) WHERE expired = false
→ Utilisable sur tous les points de collecte
→ Paiement total ou partiel d'une commande
→ Pas de dette possible
→ Expiration : 1 an après émission (mentions dans les CGU)
→ Notification client 30 jours avant expiration
→ Journal immuable : jamais de UPDATE
```

**Cron job expiration**
```sql
SELECT cron.schedule('expire-credits', '0 2 * * *', $$
  UPDATE credit_transactions
  SET expired = true
  WHERE expires_at < NOW() AND expired = false;
$$);
```

---

## Consignes

```
→ Définies par le producteur, par produit
→ TVA 0% — affichées séparément du prix produit
→ Montant fixe par produit (ex: 0,20€, 0,50€, 1,00€)
→ Pas de date d'expiration
→ Remboursement : coordinateur encode le retour (produit + quantité)
→ Montant crédité sur le compte client
```

---

## Virements producteurs & coordinateurs

```
Déclenchement : validation de la distribution par le coordinateur
Timing : J+5 après la date de distribution
Condition bloquante : KYC Mollie producteur validé

Calcul producteur :
  ventes brutes confirmées
  - remboursements encodés
  - commission plateforme
  - commission coordinateur
  = net à virer

Calcul coordinateur :
  SUM(commissions coordinateur sur les lignes nettes confirmées)

Notification : email à l'émission et à la réception
```

---

## Gestion des clients — suspension & désactivation

```
Statuts :
  'active'    → commandes autorisées
  'suspended' → commandes bloquées temporairement
  'disabled'  → compte désactivé définitivement

Processus :
→ Coordinateur signale un client problématique via la plateforme
→ Admin / super_admin suspend ou désactive
→ Client notifié par email + WhatsApp

Cas typique : client absent à répétition sans prévenir
```

---

## Notifications automatiques

| Événement | Canal | Destinataire |
|---|---|---|
| Confirmation de commande | Email + WhatsApp (selon préférence) | Client |
| Échec de paiement | Email | Client |
| Produit épuisé retiré du panier | Email | Client |
| Veille de distribution | Email + WhatsApp | Client |
| Remboursement effectué | Email + WhatsApp | Client |
| Crédit expirant dans 30 jours | Email + WhatsApp | Client |
| Bon de préparation | Email | Producteur |
| Rappel validation distribution (J+12h, J+24h, J+36h) | Email + WhatsApp | Coordinateur |
| Virement effectué | Email | Producteur + Coordinateur |
| Annulation de vente | Email + WhatsApp | Clients concernés |

---

## Exports — règle globale

Tout document ou liste généré par la plateforme est exportable en **PDF** et en **XLS**.

| Document | Espace |
|---|---|
| Bon de préparation (par produit + par client) | Producteur |
| Récapitulatif de distribution | Coordinateur |
| Liste des commandes par vente | Coordinateur |
| Relevé financier par distribution | Producteur + Coordinateur |
| Historique des virements | Producteur + Coordinateur |
| Vue comptable globale + TVA ventilée | Admin |
| Historique des commandes | Client |
| Transactions crédit client | Admin + Client |
| Rapport TVA par taux (0%, 6%, 21%) | Admin |

---

## Espace comptabilité

### Vue admin
- Flux entrants / sortants / en attente par période
- TVA collectée ventilée par taux
- Commissions plateforme
- Crédits clients en circulation (passif)
- Consignes en circulation (passif)
- Export comptable complet

### Vue producteur
- Par distribution : ventes brutes, remboursements, commission déduite, net reçu
- Historique des virements
- Export par période

### Vue coordinateur
- Par distribution : total ventes, remboursements encodés, commission gagnée
- Historique des virements
- Export par période

---

## Automatisations (Supabase Cron Jobs)

```sql
-- Clôture automatique des ventes
SELECT cron.schedule('close-sales', '* * * * *', $$
  UPDATE sales SET status = 'closed', updated_at = now()
  WHERE closes_at < now() AND status = 'open';
  -- Déclenche ensuite l'envoi des bons de préparation via Edge Function
$$);

-- Expiration des crédits
SELECT cron.schedule('expire-credits', '0 2 * * *', $$
  UPDATE credit_transactions
  SET expired = true
  WHERE expires_at < now() AND expired = false;
$$);

-- Rappels coordinateur si validation non faite
SELECT cron.schedule('remind-coordinator', '0 * * * *', $$
  -- Envoie rappel si distribution_end_at + 12h/24h/36h dépassé
  -- et status != 'validated' et status != 'cancelled'
$$);

-- Virements J+5
SELECT cron.schedule('trigger-payouts', '0 8 * * *', $$
  -- Déclenche les virements pour les ventes validées il y a 5 jours
$$);
```

---

## Abstraction couche paiement

```typescript
// payment-provider.ts
interface PaymentProvider {
  createPayment(params: PaymentParams): Promise<Payment>
  getPayment(id: string): Promise<Payment>
  createTransfer(params: TransferParams): Promise<Transfer>
  refund(paymentId: string, amount: number): Promise<Refund>
  handleWebhook(payload: unknown): Promise<WebhookEvent>
}

class MollieProvider implements PaymentProvider { ... }
class StripeProvider implements PaymentProvider { ... }

// Jamais d'appel direct au SDK Mollie dans le code métier
// Basculer vers Stripe = PAYMENT_PROVIDER=stripe + implémenter StripeProvider
```

---

## RGPD

```
Responsable de traitement : l'association (entité juridique)

Dans la plateforme :
→ Consentement explicite à l'inscription (checkbox CGU + politique confidentialité)
→ Droit à l'effacement :
     suppression compte → anonymisation données personnelles
     conservation données comptables anonymisées (7 ans — obligation belge)
→ Droit d'accès et portabilité :
     export données personnelles depuis l'espace client (JSON ou CSV)
→ Bannière cookies obligatoire
→ Espace admin : gestion des demandes RGPD
→ Procédure d'anonymisation automatique à la suppression de compte

Durée de conservation :
→ Données clients actifs : durée de la relation
→ Données comptables : 7 ans
→ Données clients supprimés : anonymisées immédiatement
```

---

## Domaine & emails transactionnels

```
Domaine       : hublo.be
Emails        : noreply@hublo.be

Configuration DNS obligatoire avant premier test pilote :
→ SPF   — autoriser Resend à envoyer depuis @hublo.be
→ DKIM  — signature cryptographique des emails sortants
→ DMARC — politique de rejet des emails non signés
Sans ces 3 enregistrements, les emails arrivent en spam.
```

---

## Internationalisation

```
MVP : français uniquement
Phase 2 : néerlandais, anglais (selon point de collecte)
```

**Règle dès le sprint 1** — utiliser `next-intl`, aucun texte hardcodé :

```typescript
// Toujours — même en MVP FR uniquement
import { useTranslations } from 'next-intl';
const t = useTranslations('product');
return <button>{t('add_to_cart')}</button>; // jamais en dur
```

Structure des fichiers :
```
/messages/fr.json   → MVP
/messages/nl.json   → Phase 2
/messages/en.json   → Phase 2
```

Les champs texte produit (`name`, `description`) restent en colonnes simples au MVP. Migration vers `jsonb` multilingue documentée pour la phase 2.

---

## Environnements & déploiement

```
Local       : Next.js dev + Supabase CLI (base locale identique à la prod)
Staging     : Vercel preview + Supabase projet test
Production  : Vercel prod + Supabase prod (région EU)

Workflow GitHub :
→ main     → déploiement automatique production (hublo.be)
→ develop  → déploiement automatique staging
→ PR       → preview URL automatique Vercel

Règles critiques :
→ Clés Mollie sandbox en staging uniquement
→ Clés Mollie production sur main uniquement
→ Variables d'environnement séparées par environnement dans Vercel
→ Tester tous les webhooks en staging avant prod
```

---

## Onboarding MVP — gestion manuelle

```
Au pilote, tout est géré par l'admin :
→ Création comptes producteurs + invitation par email
→ Création comptes coordinateurs + invitation par email
→ Configuration des points de collecte
→ Création des premières ventes

Seule l'inscription client est autonome.

Fonctions admin indispensables au MVP :
→ Inviter producteur / coordinateur (email d'invitation)
→ Reset mot de passe
→ Activer / suspendre / désactiver un compte
→ Modifier n'importe quel profil
→ Suivre le statut KYC Mollie des producteurs
→ Forcer la validation d'une distribution si coordinateur absent
```

---

## Mobile — règles obligatoires

```
Mobile-first : concevoir pour mobile en premier, adapter desktop ensuite.
La majorité des clients commanderont depuis leur téléphone.
```

- CSS mobile-first — breakpoints Tailwind dans l'ordre `sm:` → `md:` → `lg:`
- Zones tactiles minimum 44×44px (boutons, liens, icônes)
- Pas d'interactions hover-only
- Inputs avec `type` correct (`tel`, `email`, `number`) pour le bon clavier mobile
- Pas de tableaux non scrollables — cartes empilées sur mobile
- Sticky footer pour le bouton de paiement et le CTA panier
- Espace coordinateur optimisé pour la saisie sur téléphone pendant la distribution

**Interfaces prioritaires à tester sur mobile :**
- Catalogue + panier client
- Page de paiement (1 tap Bancontact)
- Encodage des corrections coordinateur
- Bon de préparation producteur (lisible sur tablette)

**Performance mobile :**
- Images : format WebP, lazy loading, max 800px width
- Score Lighthouse mobile cible : > 85
- LCP < 2,5s sur 4G

---

## SEO — règles obligatoires

**Pages publiques indexables (Server Components obligatoires)**
```
/
/points-de-collecte
/points-de-collecte/[slug]
/producteurs
/producteurs/[slug]
/produits/[categorie]
/produits/[categorie]/[slug]
```

**Pages privées — non indexées**
```
/client/*  /coordinateur/*  /producteur/*  /admin/*
```

**Règles à respecter :**
- URLs avec slugs lisibles — jamais d'UUID dans les URLs publiques
- Champ `slug` unique sur `products`, `collection_points`, `profiles_producteur`
- `generateMetadata()` Next.js sur chaque page publique
- Structured data JSON-LD `Product` sur les fiches produit
- `app/sitemap.ts` générant `/sitemap.xml` automatiquement
- `robots.txt` bloquant les espaces privés
- Canonical URLs sur toutes les pages
- `alt` text obligatoire sur toutes les images produit
- Description produit : champ obligatoire à la création (min 50 caractères)
- Description producteur et point de collecte : champs texte libres pour le SEO local

---

## Tests — stratégie

**Unitaires (Vitest)**
- Calculs financiers : prix TTC, commissions (basis points), TVA, arrondis
- Solde crédit et expiration
- Calcul virements

**Intégration (Vitest)**
- Flux paiement complet (Mollie sandbox)
- Webhook → idempotence → confirmation → stock → notification
- Remboursement → crédit client
- Validation distribution → virements
- Annulation vente → remboursements globaux

**End-to-end (Playwright)**
- Parcours client : inscription → commande → paiement → confirmation → collecte
- Parcours coordinateur : création vente → distribution → validation
- Parcours producteur : création produit → bon de préparation → virement
- Parcours admin : création utilisateurs → supervision → comptabilité

**Charge**
- 50 clients commandent simultanément le même stock limité
- Test de double webhook Mollie (idempotence)
- Race condition stock

---

## Plan de développement — 6 sprints

### Sprint 1 — Fondations & authentification (2 semaines)
- Setup Next.js 14 + Supabase + Vercel + GitHub
- Schéma base de données complet + migrations
- Intégration Supabase Auth — table `users` reliée à `auth.users`
- Helpers RLS + policies par rôle
- Structure routes par rôle + middleware auth
- Profils utilisateurs (client, producteur, coordinateur)
- Setup `next-intl` (structure i18n prête, FR uniquement)
- SEO de base (metadata, robots.txt, sitemap)

### Sprint 2 — Catalogue & points de collecte (2 semaines)
- Espace producteur : CRUD produits, variantes, TVA, consignes, slugs
- Gestion stock limité / illimité + suspension produit
- Upload photo produit (Supabase Storage, WebP)
- Espace coordinateur : création point de collecte, horaires, slug
- Ajout / retrait producteurs sur un point
- Catégories (gestion admin)
- Pages publiques indexables (catalogue, producteurs, points de collecte)

### Sprint 3 — Ventes, panier & stock (2 semaines)
- Création et gestion des ventes par coordinateur
- Clôture automatique des ventes (cron job)
- Catalogue client : filtres catégories, prix TTC, consignes séparées
- Panier : ajout, modification, suppression, affichage "épuisé"
- Favoris / coups de cœur
- Stock disponible temps réel + `stock_movements`
- Tests de concurrence stock

### Sprint 4 — Paiements & commandes (2 semaines)
- Abstraction `PaymentProvider` + intégration Mollie Connect
- Tables `payments` + `payment_webhook_events`
- Webhook Mollie idempotent + transactionnel (Edge Function)
- Système crédit client + paiement mixte
- Modification commande avant clôture (delta paiement / crédit)
- Dashboard producteur Realtime (Supabase Realtime)
- Notifications email confirmation commande (Resend)

### Sprint 5 — Distribution, remboursements & virements (2 semaines)
- Espace coordinateur : liste commandes, encodage corrections (36h)
- Remboursements partiels et totaux + crédit client automatique
- Validation distribution (règle 1h après fin créneau)
- Annulation vente / producteur + remboursements globaux
- Virements Mollie producteurs + coordinateur (J+5)
- Consignes : encodage retours + crédit client
- Bon de préparation : email auto clôture (vue produit + vue client)
- Notifications : veille distribution, remboursements, rappels coordinateur

### Sprint 6 — Comptabilité, exports & finitions (2 semaines)
- Espaces comptables admin / producteur / coordinateur
- `events_log` + observabilité
- Exports PDF et XLS sur tous les documents
- Suspension / désactivation client
- Panier recommandé + détection produits indisponibles
- Historique commandes client + export données RGPD
- Tests end-to-end complets + tests de charge
- Hardening production + Lighthouse mobile > 85

---

## Points d'attention critiques

1. **Auth Supabase** — `users.id = auth.users.id`. Pas de `password_hash` dans les tables métier. Ne jamais comparer `auth.uid()` directement à un `profile.id` dans les RLS.

2. **RLS en premier** — implémenter toutes les policies avant les premiers écrans. Ne pas laisser pour plus tard. Utiliser les helpers SQL pour éviter les erreurs de comparaison d'IDs.

3. **Basis points** — toutes les commissions en basis points. Fonction de calcul centrale unique, testée, utilisée partout.

4. **Webhook Mollie — idempotence obligatoire** — enregistrer chaque webhook dans `payment_webhook_events` avant tout traitement métier. Si déjà traité → ignorer. Tester extensivement en sandbox.

5. **Race condition stock** — `SELECT FOR UPDATE` dans la transaction de confirmation de paiement. Tests de charge obligatoires avant production.

6. **Snapshots financiers** — prix, TVA, commissions dans `order_lines` sont figés à la commande. Ne jamais recalculer depuis les tables source.

7. **Journal immuable** — `credit_transactions` et `events_log` : toujours `INSERT`, jamais `UPDATE`. Le solde est recalculé dynamiquement.

8. **Montants en centimes** — règle absolue. Conversion en euros uniquement à l'affichage.

9. **KYC Mollie producteurs** — bloquant pour les virements. Prévoir statut `kyc_pending` visible en admin. Accompagner manuellement les premiers producteurs.

10. **WhatsApp Business API** — créer le compte Meta Business immédiatement. Délai de validation 2 à 4 semaines. Fallback email uniquement pendant cette période.

11. **Validation distribution** — bloquée au plus tôt 1h après la fin du créneau. Aucun payout avant cette validation.

12. **RGPD** — Supabase Cloud région EU obligatoire. Anonymisation à la suppression de compte. Conservation comptable 7 ans.

13. **Sauvegardes** — sauvegardes automatiques Supabase Pro + dump SQL hebdomadaire externe. RTO cible 4h.

14. **i18n dès le sprint 1** — `next-intl` installé dès le départ, aucun texte hardcodé. 2h de setup qui évitent 2 semaines de refactoring en phase 2.

15. **SPF / DKIM / DMARC** — configurer les enregistrements DNS email avant le premier test pilote. Sans ça, toutes les notifications arrivent en spam.

---

## Variables d'environnement

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Paiement
PAYMENT_PROVIDER=mollie         # 'mollie' | 'stripe'
MOLLIE_API_KEY=
MOLLIE_WEBHOOK_SECRET=

# Email
RESEND_API_KEY=

# WhatsApp Business
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# App
NEXT_PUBLIC_APP_URL=
NODE_ENV=
```

---

## Positionnement & différenciation

**Concurrents identifiés** : linkedfarm.be, locavor.fr, crowdfarming.com

**Avantages structurels de Hublo :**
- Seule plateforme avec coordinateur rémunéré à la commission (modèle de croissance virale locale)
- Conçue pour le marché belge : Bancontact natif, contexte belge, communautés locales
- Friction zéro : commander en 3 clics, payer en 1 tap, recevoir un WhatsApp la veille
- Vision coopérative à terme : les producteurs actifs peuvent devenir membres

**Stratégie de lancement :**
- Angle MVP : "la plateforme la plus simple pour acheter local en Belgique"
- Moteur de croissance : le coordinateur rémunéré recrute ses producteurs et clients localement
- Vision long terme : évolution vers une coopérative dont les producteurs sont membres

---

*Document fusionné et finalisé — version prête pour Claude Code.*
*Démarrer par le Sprint 1. Toutes les décisions métier importantes sont documentées ici.*
