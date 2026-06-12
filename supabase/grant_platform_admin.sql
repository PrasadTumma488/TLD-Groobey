-- Full platform owners (identical rights for both emails):
--   thiru.build@gmail.com
--   tummadurgaprasad520@gmail.com
--
-- Run in Supabase Dashboard -> SQL Editor. Replace UUID from Authentication -> Users.

insert into public.user_roles (user_id, role)
values ('PASTE_YOUR_USER_UUID'::uuid, 'main_admin'::public.app_role)
on conflict (user_id, role) do nothing;
