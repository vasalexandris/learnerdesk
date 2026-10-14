import { Router } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { PDFDocument } from 'pdf-lib';
import { supabase } from '../config.js';
import { requireUser } from '../auth.js';
import { getPlan, consume, refund, logUsage } from '../credits.js';
import { generateCost, GRADE_COST, MAX_PDF_BYTES } from '../plans.js';
import { generateStudySet, gradeFreeAnswer } from '../gemini.js';
import { normalizeStudySet } from '../normalize.js';

const r = Router();
const aiLimiter = rateLimit({ windowMs: 60_000, limit: 6, standardHeaders: true, legacyHeaders: false, keyGenerator: req => req.user?.id || req.ip });
const gradeLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, keyGenerator: req => req.user?.id || req.ip });
const bigJson = express.json({ limit: '20mb' });

const monthStart = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(); };

// POST /api/study/generate  { pdf_base64, filename, page_from, page_to, ocr }
r.post('/study/generate', requireUser, aiLimiter, bigJson, async (req, res) => {
  const { pdf_base64, filename = 'document.pdf', ocr = false } = req.body || {};
  if (typeof pdf_base64 !== 'string' || !pdf_base64) return res.status(400).json({ error: 'missing_pdf' });
  const bytes = Buffer.from(pdf_base64, 'base64');
  if (bytes.length > MAX_PDF_BYTES) return res.status(413).json({ error: 'pdf_too_large', max_bytes: MAX_PDF_BYTES });
  if (bytes.subarray(0, 5).toString() !== '%PDF-') return res.status(400).json({ error: 'not_a_pdf' });

  const plan = await getPlan(req.user.id);
  if (ocr && !plan.ocr) return res.status(403).json({ error: 'ocr_not_in_plan', plan: plan.key });

  let src;
  try { src = await PDFDocument.load(bytes, { ignoreEncryption: false }); }
  catch { return res.status(400).json({ error: 'unreadable_pdf' }); }
  const total = src.getPageCount();
  const from = Math.min(Math.max(parseInt(req.body.page_from, 10) || 1, 1), total);
  const to = Math.min(Math.max(parseInt(req.body.page_to, 10) || total, from), total);
  const pages = to - from + 1;
  if (pages > plan.max_pages_per_pdf) return res.status(403).json({ error: 'too_many_pages', max_pages: plan.max_pages_per_pdf, plan: plan.key });

  const { count } = await supabase.from('api_usage').select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id).eq('kind', 'generate').eq('ok', true).gte('created_at', monthStart());
  if ((count || 0) >= plan.pdfs_per_month) return res.status(403).json({ error: 'monthly_limit', limit: plan.pdfs_per_month, plan: plan.key });

  const cost = generateCost(pages, !!ocr);
  const paid = await consume(req.user.id, plan, cost);
  if (!paid.ok) return res.status(402).json({ error: 'insufficient_credits', needed: cost, daily_left: paid.receipt.daily_left });

  try {
    // Στέλνουμε στο AI μόνο τις επιλεγμένες σελίδες.
    const out = await PDFDocument.create();
    const idx = Array.from({ length: pages }, (_, i) => from - 1 + i);
    (await out.copyPages(src, idx)).forEach(p => out.addPage(p));
    const sliced = Buffer.from(await out.save()).toString('base64');

    const ai = await generateStudySet({ pdfBase64: sliced, ocr: !!ocr });
    const set = normalizeStudySet(ai.json);
    if (!set.sections.length) throw Object.assign(new Error('empty_result'), { status: 502 });

    const title = set.title || filename.replace(/\.pdf$/i, '');
    const { data, error } = await supabase.from('study_sets').insert({
      user_id: req.user.id, title, source_name: filename, page_from: from, page_to: to, lang: set.lang, data: { sections: set.sections },
    }).select('id').single();
    if (error) throw error;

    await logUsage({ user_id: req.user.id, kind: 'generate', model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', pages, credits: cost, input_tokens: ai.input_tokens, output_tokens: ai.output_tokens, ok: true });
    res.json({ id: data.id, title, lang: set.lang, page_from: from, page_to: to, sections: set.sections, credits_charged: cost });
  } catch (e) {
    await refund(req.user.id, paid.receipt);
    await logUsage({ user_id: req.user.id, kind: 'generate', pages, credits: 0, ok: false });
    console.error('generate failed:', e.message);
    res.status(e.status === 503 ? 503 : 502).json({ error: 'generation_failed' });
  }
});

r.get('/study/sets', requireUser, async (req, res) => {
  const { data, error } = await supabase.from('study_sets').select('id,title,source_name,page_from,page_to,lang,created_at')
    .eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: 'db_error' });
  res.json({ sets: data });
});

r.get('/study/sets/:id', requireUser, async (req, res) => {
  const { data } = await supabase.from('study_sets').select('*').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
  if (!data) return res.status(404).json({ error: 'not_found' });
  res.json({ id: data.id, title: data.title, lang: data.lang, page_from: data.page_from, page_to: data.page_to, sections: data.data.sections });
});

r.delete('/study/sets/:id', requireUser, async (req, res) => {
  await supabase.from('study_sets').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  res.json({ ok: true });
});

// POST /api/study/grade { set_id, section_id, q_index, answer } — η σωστή απάντηση διαβάζεται από τη βάση, όχι από τον client.
r.post('/study/grade', requireUser, gradeLimiter, express.json({ limit: '50kb' }), async (req, res) => {
  const { set_id, section_id, q_index, answer } = req.body || {};
  const student = String(answer || '').trim().slice(0, 4000);
  if (!student) return res.status(400).json({ error: 'empty_answer' });
  const { data } = await supabase.from('study_sets').select('data').eq('id', set_id).eq('user_id', req.user.id).maybeSingle();
  const q = data?.data?.sections?.find(s => s.id === section_id)?.questions?.free?.[q_index];
  if (!q) return res.status(404).json({ error: 'not_found' });

  const plan = await getPlan(req.user.id);
  const paid = await consume(req.user.id, plan, GRADE_COST);
  if (!paid.ok) return res.status(402).json({ error: 'insufficient_credits', needed: GRADE_COST });
  try {
    const ai = await gradeFreeAnswer({ question: q.q, modelAnswer: q.correctDisplay, studentAnswer: student });
    await logUsage({ user_id: req.user.id, kind: 'grade', model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', credits: GRADE_COST, input_tokens: ai.input_tokens, output_tokens: ai.output_tokens, ok: true });
    const verdict = ['correct', 'partial', 'wrong'].includes(ai.json.verdict) ? ai.json.verdict : 'partial';
    res.json({ verdict, short: String(ai.json.short || ''), explanation: String(ai.json.explanation || '') });
  } catch (e) {
    await refund(req.user.id, paid.receipt);
    console.error('grade failed:', e.message);
    res.status(502).json({ error: 'grading_failed' });
  }
});

export default r;
