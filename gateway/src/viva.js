import { env } from './config.js';

const HOSTS = {
  demo:       { accounts: 'https://demo-accounts.vivapayments.com', api: 'https://demo-api.vivapayments.com', checkout: 'https://demo.vivapayments.com' },
  production: { accounts: 'https://accounts.vivapayments.com',      api: 'https://api.vivapayments.com',      checkout: 'https://www.vivapayments.com' },
};
const hosts = () => HOSTS[env.VIVA_ENV === 'production' ? 'production' : 'demo'];

let cached = { token: null, exp: 0 };

async function getToken() {
  if (cached.token && Date.now() < cached.exp - 30_000) return cached.token;
  const basic = Buffer.from(`${env.VIVA_CLIENT_ID}:${env.VIVA_CLIENT_SECRET}`).toString('base64');
  const r = await fetch(`${hosts().accounts}/connect/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw new Error(`viva_token_${r.status}`);
  const j = await r.json();
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

export async function createOrder({ amountCents, email, description, merchantTrns, lang }) {
  const r = await fetch(`${hosts().api}/checkout/v2/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amountCents,
      customerTrns: description,
      customer: { email, requestLang: lang === 'en' ? 'en-GB' : 'el-GR' },
      sourceCode: env.VIVA_SOURCE_CODE,
      merchantTrns,
    }),
  });
  if (!r.ok) throw new Error(`viva_order_${r.status}`);
  const { orderCode } = await r.json();
  return { orderCode: String(orderCode), checkoutUrl: `${hosts().checkout}/web/checkout?ref=${orderCode}` };
}

// Fallback όταν χαθεί το webhook: ρωτάμε τη Viva για το transaction.
export async function getTransaction(transactionId) {
  const r = await fetch(`${hosts().api}/checkout/v2/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${await getToken()}` },
  });
  if (!r.ok) throw new Error(`viva_tx_${r.status}`);
  return r.json();
}
