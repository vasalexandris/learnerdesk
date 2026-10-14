-- LearnerDesk: σετ μελέτης που παράγει το AI από ένα PDF. Το ίδιο το PDF ΔΕΝ αποθηκεύεται.
create table if not exists public.study_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_name text,
  page_from int, page_to int,
  lang text,
  data jsonb not null,               -- { sections: [{ id, title, theory, questions: { tf, mcq, fill, cloze, free } }] }
  created_at timestamptz not null default now()
);
create index if not exists study_sets_user_idx on public.study_sets (user_id, created_at desc);
alter table public.study_sets enable row level security;
drop policy if exists "own sets" on public.study_sets;
create policy "own sets" on public.study_sets for select using (auth.uid() = user_id);
