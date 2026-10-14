-- LearnerDesk: καταγραφή κάθε κλήσης AI (κόστος/analytics).
create table if not exists public.api_usage (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null,                -- generate | grade
  model text,
  pages int,
  credits int not null default 0,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10,6),
  ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists api_usage_created_idx on public.api_usage (created_at desc);
alter table public.api_usage enable row level security;   -- χωρίς policies: μόνο service role
