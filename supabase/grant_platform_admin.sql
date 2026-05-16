-- IMPORTANT: Saving this file in your repo does NOT update your database.
-- You must open Supabase Dashboard (same project as SUPABASE_URL in .env) → SQL → New query,
-- paste the INSERT below (with your real UUID), then click Run.

-- 1) Dashboard → Authentication → Users → your account → copy "User UID".
-- 2) Replace PASTE_YOUR_USER_UUID below.
-- 3) Run this in SQL Editor. Then sign out of the app and sign in again.

insert into public.user_roles (user_id, role)
values ('PASTE_YOUR_USER_UUID'::uuid, 'main_admin'::public.app_role)
on conflict (user_id, role) do nothing;

-- Verify (optional): should return one row with role main_admin.
-- select user_id, role from public.user_roles where user_id = 'PASTE_YOUR_USER_UUID'::uuid;
