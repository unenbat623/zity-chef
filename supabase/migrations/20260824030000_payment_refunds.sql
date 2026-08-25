-- ════════════════════════════════════════════════════════════════════════════
-- Refunds for cancelled orders
--
-- Cancelling an order raised a credit note in Odoo, so the books balanced —
-- but nothing ever moved money back to the customer, and nothing recorded that
-- it still had to. Two things were missing:
--
--   1. The gateway payment could not be identified. `payment/check` returns the
--      QPay payment id and we threw it away, keeping only "was it paid?". A
--      refund call needs that id, so no refund was possible after the fact.
--   2. An order did not record which invoice paid for it. `invoiceId` arrived
--      on the create request, was consumed to prove payment, and was dropped —
--      so from a cancelled order there was no way back to the payment at all.
--
-- Both are recorded from now on. Refund state lives on payment_intents rather
-- than in its own table: an order is paid by exactly one invoice and is
-- refunded in full or not at all, so one row per payment keeps the "refund at
-- most once" rule a single conditional UPDATE.
-- ════════════════════════════════════════════════════════════════════════════

-- ── The gateway payment behind an invoice, and what became of its refund ──────
ALTER TABLE public.payment_intents
  -- QPay's own payment id, captured when the payment is verified. Null for
  -- invoices settled in simulated mode, and for anything paid before this
  -- migration — those can only be refunded by hand.
  ADD COLUMN IF NOT EXISTS qpay_payment_id TEXT,
  -- NULL      = no refund attempted (the normal state of a live order)
  -- pending   = attempt in flight
  -- refunded  = the gateway confirmed the money went back
  -- manual    = we cannot do it automatically; a human must move the money
  -- failed    = the gateway rejected or errored; retryable
  ADD COLUMN IF NOT EXISTS refund_status TEXT
    CHECK (refund_status IN ('pending', 'refunded', 'manual', 'failed')),
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS refund_ref TEXT,
  ADD COLUMN IF NOT EXISTS refund_error TEXT,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refund_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Everything an operator has to chase: refunds that did not complete on their
-- own. Partial index — the overwhelming majority of rows are never refunded.
CREATE INDEX IF NOT EXISTS idx_payment_intents_refund_outstanding
  ON public.payment_intents(refund_status, refund_attempted_at)
  WHERE refund_status IN ('pending', 'manual', 'failed');

-- ── The invoice that paid for an order ───────────────────────────────────────
-- Without this a cancelled order cannot be traced back to its payment.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_invoice_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_payment_invoice_id
  ON public.orders(payment_invoice_id)
  WHERE payment_invoice_id IS NOT NULL;

-- payment_intents stays service-role only; the new columns inherit that. The
-- REVOKE is repeated because ADD COLUMN grants nothing, but a schema-wide
-- default grant added later would otherwise reach these columns.
REVOKE ALL ON public.payment_intents FROM anon, authenticated;
