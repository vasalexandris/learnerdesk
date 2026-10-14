import { Router } from 'express';
import express from 'express';
import { supabase } from '../config.js';
import { requireUser, requireAdmin } from '../auth.js';
import { PLANS } from '../plans.js';

const r = Router();
r.use('/admin', requireUser, requireAdmin, express.json({ limit: '10kb' }));

r.get('/admin/users', async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 50 });
  if (error) return res.status(500).json({ error: 'auth_error' });
  const ids = data.users.map(u => u.id);
  const { data: subs } = await supabase.from('subscriptions').select('*').in('user_id', ids);
  const byId = Object.fromEntries((subs || []).map(s => [s.user_id, s]));
  res.json({ users: data.users.map(u => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, subscription: byId[u.id] || null })) });
});

// Χειροκίνητο πλάνο (promo) — καταγράφεται με source='admin'.
r.post('/admin/grant-plan', async (req, res) => {
  const { user_id, plan, days = 30 } = req.body || {};
  if (!user_id || !PLANS[plan]) return res.status(400).json({ error: 'bad_request' });
  const end = new Date(Date.now() + Math.min(Math.max(+days || 30, 1), 3660) * 86400_000);
  const { error } = await supabase.from('subscriptions').upsert({ user_id, plan, billing: 'monthly', status: 'active', source: 'admin', current_period_end: end.toISOString(), updated_at: new Date().toISOString() });
  if (error) return res.status(500).json({ error: 'db_error' });
  res.json({ ok: true });
});

r.post('/admin/grant-credits', async (req, res) => {
  const { user_id, credits } = req.body || {};
  const n = parseInt(credits, 10);
  if (!user_id || !(n > 0 && n <= 100000)) return res.status(400).json({ error: 'bad_request' });
  const { error } = await supabase.from('credit_topups').insert({ user_id, amount: n, remaining: n, source: 'admin' });
  if (error) return res.status(500).json({ error: 'db_error' });
  res.json({ ok: true });
});

r.delete('/admin/users/:id', async (req, res) => {
  const { error } = await supabase.auth.admin.deleteUser(req.params.id);
  if (error) return res.status(500).json({ error: 'auth_error' });
  res.json({ ok: true });
});

r.get('/admin/stats', async (_req, res) => {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [{ data: usage }, { data: pays }, { count: activeSubs }] = await Promise.all([
    supabase.from('api_usage').select('kind,credits,cost_usd,ok,created_at').gte('created_at', since).limit(20000),
    supabase.from('payments').select('amount_cents,item_id,paid_at').eq('status', 'paid').gte('paid_at', since).limit(5000),
    supabase.from('subscriptions').select('user_id', { count: 'exact', head: true }).eq('status', 'active').neq('plan', 'free').gt('current_period_end', new Date().toISOString()),
  ]);
  res.json({
    last30d: {
      ai_calls: (usage || []).length,
      ai_failed: (usage || []).filter(u => !u.ok).length,
      credits_spent: (usage || []).reduce((s, u) => s + (u.credits || 0), 0),
      revenue_cents: (pays || []).reduce((s, p) => s + p.amount_cents, 0),
      payments: (pays || []).length,
    },
    active_paid_subscriptions: activeSubs || 0,
  });
});

r.get('/admin/payments', async (_req, res) => {
  const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(100);
  res.json({ payments: data || [] });
});

export default r;
