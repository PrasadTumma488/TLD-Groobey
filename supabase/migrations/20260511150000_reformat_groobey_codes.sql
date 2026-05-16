with role_map as (
  select
    p.user_id,
    p.created_at,
    coalesce(
      max(case when ur.role in ('main_admin', 'admin') then 'PA' end),
      max(case when ur.role = 'merchant' then 'SO' end),
      max(case when ur.role = 'employee' then 'SM' end)
    ) as role_code
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.user_id
  group by p.user_id, p.created_at
),
prepared as (
  select
    user_id,
    role_code,
    to_char(created_at at time zone 'utc', 'YYMM') as ym
  from role_map
  where role_code is not null
),
ranked as (
  select
    user_id,
    role_code,
    ym,
    row_number() over (
      partition by role_code,
      case when role_code = 'PA' then null else ym end
      order by user_id
    ) as seq_no
  from prepared
)
update public.profiles p
set groobey_code = case
  when r.role_code = 'PA' then 'TLDG-PA-488' || lpad(r.seq_no::text, 3, '0')
  else 'TLDG-' || r.role_code || '-488' || r.ym || lpad(r.seq_no::text, 2, '0')
end
from ranked r
where p.user_id = r.user_id;
