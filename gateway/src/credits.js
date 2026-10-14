import { supabase } from './config.js';
import { PLANS } from './plans.js';

export async function getPlan(userId) {
  const { data } = await supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
  const active = data && data.status === 'active' && (!data.current_period_end || new Date(data.current_period_end) > new Date());
  const key = active && PLANS[data.plan] ? data.plan : 'free';
  return { key, ...PLANS[key], billing: active ? data.billing : null, period_end: active ? data.current_period_end : null };
}

export async function getCredits(userId, plan) {
  const day = new Date().toISOString().slice(0, 10);
  const [{ data: usage }, { data: topups }] = await Promise.all([
    supabase.from('daily_credit_usage').select('used').eq('user_id', userId).eq('day', day).maybeSingle(),
    supabase.from('credit_topups').select('remaining').eq('user_id', userId).gt('remaining', 0),
  ]);
  const used = usage?.used || 0;
  const topup = (topups || []).reduce((s, r) => s + r.remaining, 0);
  return { daily_limit: plan.credits_per_day, daily_used: used, daily_left: Math.max(plan.credits_per_day - used, 0), topup };
}

// Αφαιρεί credits ατομικά. Επιστρέφει { ok, receipt } — receipt για πιθανή επιστροφή.
export async function consume(userId, plan, amount) {
  const { data, error } = await supabase.rpc('consume_credits', { p_user: userId, p_amount: amount, p_daily_limit: plan.credits_per_day });
  if (error) throw error;
  return { ok: data.ok, receipt: data };
}

export async function refund(userId, receipt) {
  if (!receipt?.ok) return;
  await supabase.rpc('refund_credits', { p_user: userId, p_from_daily: receipt.from_daily || 0, p_from_topup: receipt.from_topup || 0 });
}

export async function logUsage(row) {
  try { await supabase.from('api_usage').insert(row); } catch { /* το logging δεν πρέπει να σπάει το αίτημα */ }
}
