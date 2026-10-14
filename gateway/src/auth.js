import { supabase, adminEmails } from './config.js';

// Επαληθεύει το Supabase JWT και βάζει req.user.
export async function requireUser(req, res, next) {
  if (!supabase) return res.status(503).json({ error: 'server_not_configured' });
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'unauthorized' });
  req.user = data.user;
  next();
}

export function requireAdmin(req, res, next) {
  const email = (req.user?.email || '').toLowerCase();
  if (!adminEmails.includes(email)) return res.status(403).json({ error: 'forbidden' });
  next();
}
