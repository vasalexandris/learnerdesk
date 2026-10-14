-- LearnerDesk: πληρωμές Viva Wallet + raw webhook events (idempotency).
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_code text unique not null,
  item_id text not null,             -- π.χ. pro_monthly | topup_small
  kind text not null,                -- plan | topup
  amount_cents int not null,
  status text not null default 'pending',   -- pending | paid | failed
  transaction_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  viva_event_id text unique,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
drop policy if exists "own payments" on public.payments;
create policy "own payments" on public.payments for select using (auth.uid() = user_id);
