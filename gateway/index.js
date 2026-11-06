import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { allowedOrigins, env, supabase, devMode } from './src/config.js';
import meRoutes from './src/routes/me.js';
import studyRoutes from './src/routes/study.js';
import paymentRoutes from './src/routes/payments.js';
import adminRoutes from './src/routes/admin.js';

if (!supabase && !devMode) {
  console.error('FATAL: SUPABASE_URL / SUPABASE_SECRET_KEY λείπουν. Για τοπική δοκιμή χωρίς Supabase όρισε ρητά DEV_MODE=1.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);               // Railway proxy → σωστό IP για rate limiting
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' });
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true }));

// Το webhook της Viva καλείται server-to-server (χωρίς Origin) — το CORS δεν το επηρεάζει.
app.use(cors({
  origin(origin, cb) { cb(null, !origin || allowedOrigins.includes(origin)); },
  allowedHeaders: ['Authorization', 'Content-Type'],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
}));

app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
app.use('/api', meRoutes, studyRoutes, paymentRoutes, adminRoutes);

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'payload_too_large' });
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

const port = env.PORT || 8080;
app.listen(port, () => console.log(`LearnerDesk gateway listening on :${port}${devMode && !supabase ? ' (DEV MODE)' : ''}`));

// Keep-alive: το free tier του Supabase παγώνει μετά από 7 μέρες αδράνειας. Ένα ελάφρυ query κάθε 24 ώρες το αποτρέπει.
if (supabase) {
  const ping = () => supabase.from('subscriptions').select('user_id', { head: true, count: 'estimated' })
    .then(({ error }) => { if (error) console.error('keep-alive failed:', error.message); })
    .catch(e => console.error('keep-alive failed:', e.message));
  ping();
  setInterval(ping, 24 * 60 * 60 * 1000).unref();
}
