alter table public.newsletter_subscribers
  alter column language set default 'both';

update public.newsletter_subscribers
set language = 'both'
where status = 'active';

alter table public.newsletter_subscribers
  drop constraint if exists newsletter_subscribers_language_check;

alter table public.newsletter_subscribers
  add constraint newsletter_subscribers_language_check
  check (language in ('en', 'zh', 'fr', 'both'));
