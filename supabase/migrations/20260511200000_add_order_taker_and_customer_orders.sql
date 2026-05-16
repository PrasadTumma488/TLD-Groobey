-- Enum value must commit before any policy/function references it (PG 55P04).
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'order_taker';
