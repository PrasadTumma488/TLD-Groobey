-- Create role and workflow enums
CREATE TYPE public.app_role AS ENUM ('main_admin', 'admin', 'merchant');
CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE public.sale_destination_type AS ENUM ('shop', 'self', 'other');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'half_day');

-- Shared timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Profiles for contact information used by the app
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_contact_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Roles stored separately from profiles/users to avoid privilege escalation
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_main(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'main_admin') OR public.has_role(_user_id, 'admin');
$$;

-- Grocery catalog
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  unit TEXT NOT NULL DEFAULT 'piece',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_price_nonnegative CHECK (price >= 0)
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Shop list for selecting sale destination
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_shops_updated_at
BEFORE UPDATE ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Sale submissions from merchants/admins
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL,
  destination_type public.sale_destination_type NOT NULL DEFAULT 'shop',
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  other_shop_name TEXT,
  notes TEXT,
  status public.verification_status NOT NULL DEFAULT 'pending',
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sales_destination_valid CHECK (
    (destination_type = 'shop' AND shop_id IS NOT NULL AND other_shop_name IS NULL)
    OR (destination_type = 'self' AND shop_id IS NULL AND other_shop_name IS NULL)
    OR (destination_type = 'other' AND shop_id IS NULL)
  )
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Items inside each sale; price is snapshotted so later catalog price changes don't rewrite history
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sale_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT sale_items_unit_price_nonnegative CHECK (unit_price >= 0)
);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Attendance records submitted by each worker and verified by admins
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  notes TEXT,
  verification_status public.verification_status NOT NULL DEFAULT 'pending',
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, work_date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_attendance_updated_at
BEFORE UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies: profiles
CREATE POLICY "Profiles can be viewed by owner or admins"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin_or_main(auth.uid()));

CREATE POLICY "Users can create their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Profiles can be updated by owner or main admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'main_admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'main_admin'));

-- RLS policies: user roles
CREATE POLICY "Users can view their own roles and admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin_or_main(auth.uid()));

CREATE POLICY "Only main admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'main_admin'))
WITH CHECK (public.has_role(auth.uid(), 'main_admin'));

-- RLS policies: products
CREATE POLICY "Authenticated staff can view active products"
ON public.products
FOR SELECT
TO authenticated
USING (is_active = true OR public.is_admin_or_main(auth.uid()));

CREATE POLICY "Only main admins can create products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'main_admin'));

CREATE POLICY "Only main admins can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'main_admin'))
WITH CHECK (public.has_role(auth.uid(), 'main_admin'));

CREATE POLICY "Only main admins can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'main_admin'));

-- RLS policies: shops
CREATE POLICY "Authenticated staff can view active shops"
ON public.shops
FOR SELECT
TO authenticated
USING (is_active = true OR public.is_admin_or_main(auth.uid()));

CREATE POLICY "Admins can manage shops"
ON public.shops
FOR ALL
TO authenticated
USING (public.is_admin_or_main(auth.uid()))
WITH CHECK (public.is_admin_or_main(auth.uid()));

-- RLS policies: sales
CREATE POLICY "Staff can view their own sales and admins can view all sales"
ON public.sales
FOR SELECT
TO authenticated
USING (created_by = auth.uid() OR public.is_admin_or_main(auth.uid()));

CREATE POLICY "Staff can create their own sales"
ON public.sales
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update sales for verification"
ON public.sales
FOR UPDATE
TO authenticated
USING (public.is_admin_or_main(auth.uid()))
WITH CHECK (public.is_admin_or_main(auth.uid()));

CREATE POLICY "Only main admins can delete sales"
ON public.sales
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'main_admin'));

-- RLS policies: sale items
CREATE POLICY "Sale items follow sale visibility"
ON public.sale_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sales
    WHERE sales.id = sale_items.sale_id
      AND (sales.created_by = auth.uid() OR public.is_admin_or_main(auth.uid()))
  )
);

CREATE POLICY "Staff can add items to their own pending sales"
ON public.sale_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales
    WHERE sales.id = sale_items.sale_id
      AND sales.created_by = auth.uid()
      AND sales.status = 'pending'
  )
);

CREATE POLICY "Admins can update sale items"
ON public.sale_items
FOR UPDATE
TO authenticated
USING (public.is_admin_or_main(auth.uid()))
WITH CHECK (public.is_admin_or_main(auth.uid()));

CREATE POLICY "Admins can delete sale items"
ON public.sale_items
FOR DELETE
TO authenticated
USING (public.is_admin_or_main(auth.uid()));

-- RLS policies: attendance
CREATE POLICY "Workers can view own attendance and admins can view all attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (worker_id = auth.uid() OR public.is_admin_or_main(auth.uid()));

CREATE POLICY "Workers can submit their own attendance"
ON public.attendance
FOR INSERT
TO authenticated
WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Admins can verify attendance"
ON public.attendance
FOR UPDATE
TO authenticated
USING (public.is_admin_or_main(auth.uid()))
WITH CHECK (public.is_admin_or_main(auth.uid()));

CREATE POLICY "Only main admins can delete attendance"
ON public.attendance
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'main_admin'));

-- Useful indexes
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_user_roles_user_role ON public.user_roles(user_id, role);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_sales_created_by ON public.sales(created_by);
CREATE INDEX idx_sales_status ON public.sales(status);
CREATE INDEX idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX idx_attendance_worker_date ON public.attendance(worker_id, work_date);