-- Delivery staff: run in Supabase SQL Editor after the Auth user exists.
-- Replace PASTE_USER_UUID with the user's id from Authentication -> Users.

insert into public.user_roles (user_id, role)
values ('PASTE_USER_UUID'::uuid, 'employee'::public.app_role)
on conflict (user_id, role) do nothing;

-- Known delivery email (auto-assigned on sign-in when SUPABASE_SERVICE_ROLE_KEY is set):
-- mktailor3177@gmail.com
