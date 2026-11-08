-- THE HOPE JAMB & WAEC TUTORIAL
-- Run this entire script in Supabase > SQL Editor.
-- It creates student profiles, payment submissions, access policies and a private receipt bucket.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  course text not null default 'JAMB' check (course in ('JAMB','WAEC','Both')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course text not null check (course in ('JAMB','WAEC','Both')),
  amount_kobo integer not null check (amount_kobo = 150000),
  payment_month date not null,
  transfer_reference text not null,
  receipt_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_submissions_student_idx
  on public.payment_submissions(student_id, created_at desc);

-- Create a profile automatically when a student signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, course)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    case
      when new.raw_user_meta_data ->> 'course' in ('JAMB','WAEC','Both')
      then new.raw_user_meta_data ->> 'course'
      else 'JAMB'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.payment_submissions enable row level security;

-- SECURITY DEFINER avoids recursive profile-table RLS checks.
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_admin = true
  );
$$;

grant execute on function public.is_current_user_admin() to authenticated;

-- Students can read only their own profile. Admins can read all profiles.
drop policy if exists "Read own profile or admin" on public.profiles;
create policy "Read own profile or admin" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or (select public.is_current_user_admin()));

-- Students can read their own payment submissions; admins can read all.
drop policy if exists "Read own payments or admin" on public.payment_submissions;
create policy "Read own payments or admin" on public.payment_submissions
for select to authenticated
using (student_id = (select auth.uid()) or (select public.is_current_user_admin()));

-- Students can submit only for themselves and cannot choose a different amount/status.
drop policy if exists "Students submit own payment" on public.payment_submissions;
create policy "Students submit own payment" on public.payment_submissions
for insert to authenticated
with check (
  student_id = (select auth.uid())
  and amount_kobo = 150000
  and status = 'pending'
);

-- Only admins can approve or reject submissions.
drop policy if exists "Admins update payments" on public.payment_submissions;
create policy "Admins update payments" on public.payment_submissions
for update to authenticated
using ((select public.is_current_user_admin()))
with check ((select public.is_current_user_admin()));

-- Private receipt storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880,
  array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880;

drop policy if exists "Students upload own receipts" on storage.objects;
create policy "Students upload own receipts" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Students and admins view receipts" on storage.objects;
create policy "Students and admins view receipts" on storage.objects
for select to authenticated
using (
  bucket_id = 'payment-proofs'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.is_current_user_admin())
  )
);

-- IMPORTANT: after creating your own account, make yourself an admin by running:
-- update public.profiles set is_admin = true where email = 'YOUR_LOGIN_EMAIL';
-- Replace YOUR_LOGIN_EMAIL with the email address you use for your website account.
-- Never expose a Supabase service_role key in app.js or in GitHub.
