-- Shine Wallet: Amazon Rekognition face profile mapping
-- Run this script in Supabase SQL Editor. Safe for both new and existing tables.
create table if not exists public.student_face_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  provider text not null default 'rekognition',
  provider_face_token text not null,
  consent_status text not null default 'pending',
  consented_by text,
  consent_reference text,
  consented_at timestamptz,
  withdrawn_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  collection_id text not null,
  face_id text
);

-- Add columns missing from older versions of this table.
alter table public.student_face_profiles
  add column if not exists face_id text;

alter table public.student_face_profiles
  add column if not exists collection_id text;

-- Existing rows without a FaceId must be enrolled again from the admin page.
-- Backfill existing rows using the configured collection ID.
-- If AWS_REKOGNITION_COLLECTION_ID differs, replace this value with the actual ID.
update public.student_face_profiles
set collection_id = 'shine-wallet-students'
where collection_id is null;

alter table public.student_face_profiles
  alter column collection_id set not null;

-- Support the new Amazon Rekognition provider while preserving legacy Face++ rows.
alter table public.student_face_profiles
  drop constraint if exists student_face_profiles_provider_check;

alter table public.student_face_profiles
  add constraint student_face_profiles_provider_check
  check (provider in ('facepp', 'rekognition'));

-- Do not enforce uniqueness on student_id alone: the existing schema permits
-- multiple provider tokens per student and preserves legacy Face++ profiles.
-- Remove the single-column index created by an earlier version of this migration.
drop index if exists public.student_face_profiles_student_id_unique;

-- Enforce unique FaceIds while allowing old, not-yet-re-enrolled rows to have NULL.
create unique index if not exists student_face_profiles_face_id_unique
  on public.student_face_profiles (face_id)
  where face_id is not null;

alter table public.student_face_profiles enable row level security;

drop policy if exists "student face profiles admin select" on public.student_face_profiles;
drop policy if exists "student face profiles admin insert" on public.student_face_profiles;
drop policy if exists "student face profiles admin update" on public.student_face_profiles;
drop policy if exists "student face profiles admin delete" on public.student_face_profiles;

create policy "student face profiles admin select"
  on public.student_face_profiles for select to authenticated
  using (public.is_admin());

create policy "student face profiles admin insert"
  on public.student_face_profiles for insert to authenticated
  with check (public.is_admin());

create policy "student face profiles admin update"
  on public.student_face_profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "student face profiles admin delete"
  on public.student_face_profiles for delete to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.student_face_profiles to authenticated;

-- Refresh PostgREST's schema cache so the API recognizes the columns.
notify pgrst, 'reload schema';