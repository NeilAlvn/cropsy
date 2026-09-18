-- 0006 — launch-notify list (website newsletter form)
--
-- The list lives here rather than in a mail vendor: it is ours, it costs no
-- extra credential, and the only key that can read it is the service key the
-- API already holds. Nobody but the API touches this table — no policies are
-- granted, so RLS denies anon and authenticated outright.
--
-- A row appears the moment someone asks to subscribe, unconfirmed. It only
-- counts as a subscriber once `confirmed_at` is set by the link in the mail
-- (double opt-in), and `requested_at` throttles re-sends so the form cannot be
-- used to mail a stranger over and over.
create table if not exists public.subscribers (
  email           text primary key,
  locale          text not null default 'nl' check (locale in ('nl', 'en')),
  source          text not null default 'website',
  requested_at    timestamptz not null default now(),
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz
);
alter table public.subscribers enable row level security;
revoke all on public.subscribers from anon, authenticated;

-- Who actually gets the launch mail: confirmed, still subscribed.
create index if not exists subscribers_sendable
  on public.subscribers (confirmed_at)
  where confirmed_at is not null and unsubscribed_at is null;
