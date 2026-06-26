alter table public.profiles
  alter column profile_status set default 'incomplete';

alter table public.profiles
  drop constraint if exists profiles_profile_status_check;

update public.profiles
set profile_status = case
  when profile_status = 'pending_email_verification' and coalesce(phone_verified, false) = true then 'active'
  when profile_status = 'pending_email_verification' then 'phone_unverified'
  else profile_status
end
where profile_status = 'pending_email_verification';

alter table public.profiles
  add constraint profiles_profile_status_check
  check (profile_status in ('incomplete', 'phone_unverified', 'active', 'blocked', 'withdrawn'));

drop index if exists idx_profiles_phone;
create unique index if not exists idx_profiles_phone_unique
  on public.profiles (phone)
  where phone is not null;
