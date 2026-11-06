// Κοινός κώδικας: i18n, Supabase auth, API helper, header.
(function () {
  const CFG = window.LD_CONFIG;
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

  // ---- i18n ----
  const SUPPORTED_LANGS = ['el', 'en', 'it', 'es', 'de', 'fr'];
  let lang = store.get('ld_lang') || ((navigator.language || 'el').slice(0, 2).toLowerCase());
  if (!SUPPORTED_LANGS.includes(lang)) lang = 'el';

  const t = (key, vars) => {
    let s = (window.LD_I18N[lang] && window.LD_I18N[lang][key]) || (window.LD_I18N.el && window.LD_I18N.el[key]) || key;
    if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
    return s;
  };
  function applyI18n(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.documentElement.lang = lang;
  }
  function setLang(l) { lang = l; store.set('ld_lang', l); location.reload(); }

  // ---- Path / Route Helper for GitHub Pages & Localhost ----
  function pageUrl(page) {
    const p = location.pathname.toLowerCase();
    const isGh = p.includes('/learnerdesk');
    const inPublic = p.includes('/public');
    if (isGh) {
      if (page === 'home') return inPublic ? '../index.html' : './index.html';
      return inPublic ? `./${page}.html` : `./public/${page}.html`;
    }
    if (page === 'home') return '/';
    return `/${page}.html`;
  }

  // ---- Supabase / Dev Mode Auth ----
  const hasSupabaseConfig = !!(CFG && CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  const sb = hasSupabaseConfig && window.supabase ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

  async function getSession() {
    if (!sb) {
      return { access_token: 'dev-token', user: { id: 'dev-user-001', email: 'tester@learnerdesk.local' } };
    }
    const { data } = await sb.auth.getSession();
    return data.session;
  }

  async function requireSession() {
    const s = await getSession();
    if (!s) { location.href = pageUrl('auth') + '?next=' + encodeURIComponent(location.pathname); throw new Error('no_session'); }
    return s;
  }

  // ---- API ----
  async function api(path, { method = 'GET', body } = {}) {
    const s = await getSession();
    const headers = {};
    if (s?.access_token) headers.Authorization = 'Bearer ' + s.access_token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const apiUrl = (CFG && CFG.API_URL) || 'http://localhost:8080';
    const r = await fetch(apiUrl + '/api' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || 'error'), { status: r.status, data });
    return data;
  }
  const errText = e => t('err_' + (e && e.message)) !== 'err_' + (e && e.message) ? t('err_' + e.message) : t('err_generic');

  // ---- escape ----
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- Header ----
  async function renderHeader(active) {
    const host = document.getElementById('site-header');
    if (!host) return;
    const s = await getSession();
    let isAdmin = false;
    if (s && CFG && CFG.API_URL) { try { isAdmin = (await api('/me')).is_admin; } catch {} }
    const link = (page, key) => `<a href="${pageUrl(page)}" class="${active === key ? 'active' : ''}" data-i18n="nav_${key}"></a>`;
    
    const langs = [
      { code: 'el', label: '🇬🇷 Ελληνικά' },
      { code: 'en', label: '🇬🇧 English' },
      { code: 'it', label: '🇮🇹 Italiano' },
      { code: 'es', label: '🇪🇸 Español' },
      { code: 'de', label: '🇩🇪 Deutsch' },
      { code: 'fr', label: '🇫🇷 Français' }
    ];
    const langOpts = langs.map(l => `<option value="${l.code}" ${lang === l.code ? 'selected' : ''}>${l.label}</option>`).join('');

    host.innerHTML = `<header class="site-header"><a class="brand" href="${pageUrl('home')}">🎓 LearnerDesk</a><nav>
      ${link('demo', 'demo')}${link('study', 'study')}${link('dashboard', 'dashboard')}${link('pricing', 'pricing')}${isAdmin ? link('admin', 'admin') : ''}
      ${sb ? (s ? '<a href="#" id="logout" data-i18n="nav_logout"></a>' : `<a href="${pageUrl('auth')}" data-i18n="nav_login"></a>`) : '<span style="font-size:12px;opacity:0.8;padding:2px 8px;background:rgba(255,255,255,0.2);border-radius:4px;">Dev / Demo</span>'}
      <select id="lang-select" class="lang-select">${langOpts}</select></nav></header>`;
    
    document.getElementById('lang-select').onchange = e => setLang(e.target.value);
    const lo = document.getElementById('logout');
    if (lo && sb) lo.onclick = async e => { e.preventDefault(); await sb.auth.signOut(); location.href = pageUrl('home'); };
    applyI18n(host);
  }

  window.LD = { t, applyI18n, setLang, sb, getSession, requireSession, api, errText, esc, renderHeader, pageUrl, store, get lang() { return lang; } };
  document.addEventListener('DOMContentLoaded', () => applyI18n());
})();
