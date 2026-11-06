import { supabase, adminEmails, devMode } from './config.js';

// Επαληθεύει το Supabase JWT και βάζει req.user.
// Σε Dev Mode (DEV_MODE=1 ΚΑΙ χωρίς Supabase), παρέχει έναν mock χρήστη για άμεση τοπική δοκιμή.
export async function requireUser(req, res, next) {
  if (!supabase && !devMode) return res.status(503).json({ error: 'server_not_configured' });
  if (devMode && !supabase) {
    req.user = { id: 'dev-user-001', email: 'tester@learnerdesk.local' };
    return next();
  }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'unauthorized' });
  req.user = data.user;
  next();
}

export function requireAdmin(req, res, next) {
  if (devMode && !supabase) return next();
  const email = (req.user?.email || '').toLowerCase();
  if (!adminEmails.includes(email)) return res.status(403).json({ error: 'forbidden' });
  next();
}
