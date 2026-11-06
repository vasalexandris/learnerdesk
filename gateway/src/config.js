import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

export const env = process.env;
export const adminEmails = (env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
export const allowedOrigins = (env.FRONTEND_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

// Dev Mode (mock χρήστης, χωρίς credits) ενεργοποιείται ΜΟΝΟ ρητά με DEV_MODE=1 — ποτέ αυτόματα.
export const devMode = env.DEV_MODE === '1';

export const supabase = env.SUPABASE_URL && env.SUPABASE_SECRET_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
  : null;
