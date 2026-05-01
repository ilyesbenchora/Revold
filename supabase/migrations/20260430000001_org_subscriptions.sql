-- 8.2 — Stripe billing pour les abonnements Revold (distinct des subscriptions
-- canoniques clients qui sont, elles, les subscriptions des CLIENTS de Revold).
--
-- Une org Revold = un abonnement à un de nos 3 plans (Starter / Growth / Scale)
-- + un trial 14 jours. Les events Stripe webhook sync ce table.

CREATE TABLE IF NOT EXISTS org_subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Stripe identifiers
  stripe_customer_id       text NOT NULL,
  stripe_subscription_id   text UNIQUE,
  stripe_price_id          text,

  -- Plan applicatif
  plan                     text NOT NULL CHECK (plan IN ('starter', 'growth', 'scale')),
  billing_period           text CHECK (billing_period IN ('monthly', 'yearly')) DEFAULT 'monthly',

  -- Statut sync depuis Stripe
  status                   text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')),
  trial_end                timestamptz,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean NOT NULL DEFAULT false,
  canceled_at              timestamptz,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_subscriptions_org ON org_subscriptions (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status ON org_subscriptions (status);

-- RLS : un user de l'org peut lire son propre abo, jamais ceux des autres orgs.
-- Aucune écriture directe : les writes passent par le webhook Stripe en service-role.
ALTER TABLE org_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their org subscription"
  ON org_subscriptions FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));
