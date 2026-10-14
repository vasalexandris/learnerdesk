import { Router } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { env, supabase } from '../config.js';
import { requireUser } from '../auth.js';
import { ITEMS } from '../plans.js';
import { createOrder, getTransaction } from '../viva.js';
import { fulfilOrder } from '../fulfil.js';

const r = Router();
const payLimiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, keyGenerator: req => req.user?.id || req.ip });
const hookLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });

r.post('/payments/create-order', requireUser, payLimiter, express.json({ limit: '5kb' }), async (req, res) => {
  const item = ITEMS[req.body?.item_id];
  if (!item) return res.status(400).json({ error: 'unknown_item' });
  try {
    const { orderCode, checkoutUrl } = await createOrder({
      amountCents: item.amount_cents, email: req.user.email, description: `LearnerDesk — ${item.label}`,
      merchantTrns: `${req.user.id}:${req.body.item_id}`, lang: req.body?.lang,
    });
    await supabase.from('payments').insert({ user_id: req.user.id, order_code: orderCode, item_id: req.body.item_id, kind: item.kind, amount_cents: item.amount_cents });
    res.json({ checkoutUrl, orderCode });
  } catch (e) {
    console.error('create-order failed:', e.message);
    res.status(502).json({ error: 'payment_provider_error' });
  }
});

// Viva webhook. GET = verification (επιστρέφει το κλειδί)· POST = event.
r.get('/payments/webhook', hookLimiter, (_req, res) => res.json({ Key: env.VIVA_WEBHOOK_KEY || '' }));

r.post('/payments/webhook', hookLimiter, express.json({ limit: '100kb' }), async (req, res) => {
  if (!env.VIVA_WEBHOOK_KEY || req.query.key !== env.VIVA_WEBHOOK_KEY) return res.status(401).json({ error: 'bad_key' });
  const body = req.body || {};
  const eventId = body.EventData?.TransactionId || body.MessageId;
  if (eventId) {
    const { error } = await supabase.from('payment_events').insert({ viva_event_id: String(eventId), payload: body });
    if (error?.code === '23505') return res.json({ ok: true, duplicate: true });   // ήδη επεξεργασμένο
  } else {
    await supabase.from('payment_events').insert({ payload: body });
  }
  const ev = body.EventData;
  // EventTypeId 1796 = Transaction Payment Created· StatusId 'F' = ολοκληρώθηκε.
  if (body.EventTypeId === 1796 && ev?.StatusId === 'F' && ev.OrderCode) {
    await fulfilOrder(String(ev.OrderCode), String(ev.TransactionId || ''));
  }
  res.json({ ok: true });
});

// Polling fallback: η checkout σελίδα ρωτά για την κατάσταση μιας παραγγελίας.
r.get('/payments/status/:orderCode', requireUser, async (req, res) => {
  const { data: p } = await supabase.from('payments').select('*').eq('order_code', req.params.orderCode).eq('user_id', req.user.id).maybeSingle();
  if (!p) return res.status(404).json({ error: 'not_found' });
  if (p.status === 'pending' && req.query.tx) {
    try {
      const tx = await getTransaction(String(req.query.tx));
      if (tx.statusId === 'F' && String(tx.orderCode) === p.order_code) {
        await fulfilOrder(p.order_code, String(req.query.tx));
        return res.json({ status: 'paid' });
      }
    } catch (e) { console.error('status poll failed:', e.message); }
  }
  res.json({ status: p.status });
});

export default r;
