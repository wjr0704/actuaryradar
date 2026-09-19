create extension if not exists pgcrypto;

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'unsubscribed')),
  language text not null default 'en',
  preferred_topics text[] null,
  confirmation_token text null,
  unsubscribe_token text unique not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz null,
  unsubscribed_at timestamptz null
);

create table if not exists public.newsletter_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.newsletter_subscribers(id) on delete cascade,
  digest_date date not null,
  sent_at timestamptz not null default now(),
  provider_message_id text null,
  status text not null default 'sent',
  error_message text null,
  created_at timestamptz not null default now(),
  unique (subscriber_id, digest_date)
);

create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status);

create index if not exists newsletter_deliveries_digest_date_idx
  on public.newsletter_deliveries (digest_date);

alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_deliveries enable row level security;

drop policy if exists "Service role manages newsletter subscribers" on public.newsletter_subscribers;
create policy "Service role manages newsletter subscribers"
  on public.newsletter_subscribers
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages newsletter deliveries" on public.newsletter_deliveries;
create policy "Service role manages newsletter deliveries"
  on public.newsletter_deliveries
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
