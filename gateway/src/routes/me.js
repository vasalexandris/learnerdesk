import { Router } from 'express';
import { requireUser } from '../auth.js';
import { getPlan, getCredits } from '../credits.js';
import { adminEmails } from '../config.js';
import { PLANS, ITEMS, generateCost } from '../plans.js';

const r = Router();

// Δημόσιο: πλάνα και τιμές για τη σελίδα pricing.
r.get('/plans', (_req, res) => res.json({ plans: PLANS, items: ITEMS }));

r.get('/me', requireUser, async (req, res) => {
  const plan = await getPlan(req.user.id);
  const credits = await getCredits(req.user.id, plan);
  res.json({
    email: req.user.email,
    plan: { key: plan.key, name: plan.name, billing: plan.billing, period_end: plan.period_end, max_pages_per_pdf: plan.max_pages_per_pdf, pdfs_per_month: plan.pdfs_per_month, ocr: plan.ocr, audio: plan.audio },
    credits,
    is_admin: adminEmails.includes((req.user.email || '').toLowerCase()),
  });
});

r.get('/estimate', (req, res) => {
  const pages = Math.max(parseInt(req.query.pages, 10) || 0, 0);
  res.json({ credits: generateCost(pages, req.query.ocr === '1') });
});

export default r;
