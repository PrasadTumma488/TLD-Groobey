-- When admin assigns a delivery boy (or other staff) by email before they sign up,
-- the role is stored here and applied on customer registration or next sign-in.

create table if not exists public.staff_email_assignments (
  email text primary key,
  role public.app_role not null,
  display_name text,
  assigned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint staff_email_assignments_staff_role check (
    role in ('employee'::public.app_role, 'order_taker'::public.app_role, 'merchant'::public.app_role)
  )
);

comment on table public.staff_email_assignments is
  'Pending staff roles keyed by email; merged when the user creates a customer account.';

alter table public.staff_email_assignments enable row level security;

-- No public policies: service role / platform admin APIs only.
