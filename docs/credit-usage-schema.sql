-- LearnerDesk: ημερήσια credits (reset ανά UTC ημέρα) + εφάπαξ top-ups (FIFO).
create table if not exists public.daily_credit_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  used int not null default 0,
  primary key (user_id, day)
);
create table if not exists public.credit_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null,
  remaining int not null,
  source text not null default 'payment',       -- payment | admin
  created_at timestamptz not null default now()
);
create index if not exists credit_topups_user_idx on public.credit_topups (user_id, created_at) where remaining > 0;
alter table public.daily_credit_usage enable row level security;
alter table public.credit_topups enable row level security;
drop policy if exists "own daily usage" on public.daily_credit_usage;
create policy "own daily usage" on public.daily_credit_usage for select using (auth.uid() = user_id);
drop policy if exists "own topups" on public.credit_topups;
create policy "own topups" on public.credit_topups for select using (auth.uid() = user_id);

-- Ατομική κατανάλωση: πρώτα τα ημερήσια credits, μετά τα top-ups (παλαιότερο πρώτα).
create or replace function public.consume_credits(p_user uuid, p_amount int, p_daily_limit int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_used int; v_daily_left int; v_from_daily int; v_rem int; v_take int; r record;
begin
  insert into daily_credit_usage(user_id, day, used) values (p_user, v_day, 0) on conflict do nothing;
  select used into v_used from daily_credit_usage where user_id = p_user and day = v_day for update;
  v_daily_left := greatest(p_daily_limit - v_used, 0);
  v_from_daily := least(v_daily_left, p_amount);
  v_rem := p_amount - v_from_daily;
  if v_rem > 0 then
    if (select coalesce(sum(remaining), 0) from credit_topups where user_id = p_user and remaining > 0) < v_rem then
      return jsonb_build_object('ok', false, 'daily_left', v_daily_left);
    end if;
    for r in select id, remaining from credit_topups where user_id = p_user and remaining > 0 order by created_at for update loop
      exit when v_rem <= 0;
      v_take := least(r.remaining, v_rem);
      update credit_topups set remaining = remaining - v_take where id = r.id;
      v_rem := v_rem - v_take;
    end loop;
  end if;
  update daily_credit_usage set used = used + v_from_daily where user_id = p_user and day = v_day;
  return jsonb_build_object('ok', true, 'from_daily', v_from_daily, 'from_topup', p_amount - v_from_daily);
end $$;

-- Επιστροφή credits όταν αποτύχει η κλήση AI (επιστρέφει πρώτα στα top-ups που χρησιμοποιήθηκαν δεν παρακολουθείται· απλή επιστροφή στο ημερήσιο μέρος).
create or replace function public.refund_credits(p_user uuid, p_from_daily int, p_from_topup int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update daily_credit_usage set used = greatest(used - p_from_daily, 0)
    where user_id = p_user and day = (now() at time zone 'utc')::date;
  if p_from_topup > 0 then
    insert into credit_topups(user_id, amount, remaining, source) values (p_user, p_from_topup, p_from_topup, 'refund');
  end if;
end $$;
revoke all on function public.consume_credits(uuid, int, int) from public, anon, authenticated;
revoke all on function public.refund_credits(uuid, int, int) from public, anon, authenticated;
