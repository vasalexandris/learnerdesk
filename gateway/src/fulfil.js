import { supabase } from './config.js';
import { ITEMS } from './plans.js';

// Ενεργοποιεί πλάνο/credits για μια πληρωμένη παραγγελία. Idempotent: δουλεύει μόνο αν η πληρωμή ήταν 'pending'.
export async function fulfilOrder(orderCode, transactionId) {
  const { data: claimed } = await supabase.from('payments')
    .update({ status: 'paid', transaction_id: transactionId || null, paid_at: new Date().toISOString() })
    .eq('order_code', orderCode).eq('status', 'pending').select('*').maybeSingle();
  if (!claimed) return false;           // άγνωστη ή ήδη επεξεργασμένη

  const item = ITEMS[claimed.item_id];
  if (!item) return false;
  if (item.kind === 'topup') {
    await supabase.from('credit_topups').insert({ user_id: claimed.user_id, amount: item.credits, remaining: item.credits, source: 'payment' });
  } else {
    const { data: cur } = await supabase.from('subscriptions').select('*').eq('user_id', claimed.user_id).maybeSingle();
    // Ανανέωση του ίδιου πλάνου επεκτείνει από τη λήξη· αλλιώς ξεκινά από τώρα.
    const base = cur?.plan === item.plan && cur.current_period_end && new Date(cur.current_period_end) > new Date() ? new Date(cur.current_period_end) : new Date();
    const end = new Date(base);
    if (item.billing === 'annual') end.setUTCFullYear(end.getUTCFullYear() + 1); else end.setUTCMonth(end.getUTCMonth() + 1);
    await supabase.from('subscriptions').upsert({
      user_id: claimed.user_id, plan: item.plan, billing: item.billing, status: 'active', source: 'payment',
      current_period_end: end.toISOString(), updated_at: new Date().toISOString(),
    });
  }
  return true;
}
