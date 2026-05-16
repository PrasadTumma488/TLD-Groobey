DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM (
      'pending',
      'confirmed',
      'packed',
      'out_for_delivery',
      'delivered',
      'cancelled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.customer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  delivery_address TEXT,
  order_items TEXT NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  required_date DATE,
  notes TEXT,
  status public.order_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_orders_total_nonnegative CHECK (total_amount >= 0)
);

ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_customer_orders_updated_at ON public.customer_orders;
CREATE TRIGGER update_customer_orders_updated_at
BEFORE UPDATE ON public.customer_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Order takers view own orders and admins view all" ON public.customer_orders;
CREATE POLICY "Order takers view own orders and admins view all"
ON public.customer_orders
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR private.is_admin_or_main(auth.uid())
);

DROP POLICY IF EXISTS "Order takers create own orders" ON public.customer_orders;
CREATE POLICY "Order takers create own orders"
ON public.customer_orders
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    private.has_role(auth.uid(), 'order_taker')
    OR private.is_admin_or_main(auth.uid())
  )
);

DROP POLICY IF EXISTS "Order takers update own orders and admins update all" ON public.customer_orders;
CREATE POLICY "Order takers update own orders and admins update all"
ON public.customer_orders
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR private.is_admin_or_main(auth.uid())
)
WITH CHECK (
  created_by = auth.uid()
  OR private.is_admin_or_main(auth.uid())
);

DROP POLICY IF EXISTS "Only admins delete orders" ON public.customer_orders;
CREATE POLICY "Only admins delete orders"
ON public.customer_orders
FOR DELETE
TO authenticated
USING (private.is_admin_or_main(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_customer_orders_created_by ON public.customer_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON public.customer_orders(status);
CREATE INDEX IF NOT EXISTS idx_customer_orders_created_at ON public.customer_orders(created_at DESC);
