-- LearnerDesk: συνδρομές χρηστών. Η απουσία γραμμής = free plan.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',            -- free | student | pro
  billing text not null default 'monthly',      -- monthly | annual
  status text not null default 'active',        -- active | canceled | expired
  source text not null default 'payment',       -- payment | admin
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
-- Ο χρήστης διαβάζει μόνο τη δική του γραμμή· οι εγγραφές γίνονται από το gateway (service role).
drop policy if exists "own subscription" on public.subscriptions;
create policy "own subscription" on public.subscriptions for select using (auth.uid() = user_id);
