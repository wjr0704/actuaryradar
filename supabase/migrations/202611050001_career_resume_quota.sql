create table if not exists public.career_resume_usage (
  request_key text not null,
  request_date date not null default (now() at time zone 'utc')::date,
  request_count integer not null default 1 check (request_count > 0),
  last_requested_at timestamptz not null default now(),
  primary key (request_key, request_date)
);

alter table public.career_resume_usage enable row level security;

drop policy if exists "Service role manages career resume usage" on public.career_resume_usage;
create policy "Service role manages career resume usage"
  on public.career_resume_usage
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.consume_career_resume_quota(
  p_request_key text,
  p_limit integer default 3
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  if p_request_key is null or length(p_request_key) < 32 or p_limit < 1 then
    return false;
  end if;

  insert into public.career_resume_usage (request_key, request_date, request_count, last_requested_at)
  values (p_request_key, (now() at time zone 'utc')::date, 1, now())
  on conflict (request_key, request_date)
  do update set
    request_count = public.career_resume_usage.request_count + 1,
    last_requested_at = now()
  returning request_count into next_count;

  delete from public.career_resume_usage
  where request_date < ((now() at time zone 'utc')::date - 31);

  return next_count <= p_limit;
end;
$$;

revoke all on function public.consume_career_resume_quota(text, integer) from public;
revoke all on function public.consume_career_resume_quota(text, integer) from anon;
revoke all on function public.consume_career_resume_quota(text, integer) from authenticated;
grant execute on function public.consume_career_resume_quota(text, integer) to service_role;
