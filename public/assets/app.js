// Κοινός κώδικας: i18n, Supabase auth, API helper, header.
(function () {
  const CFG = window.LD_CONFIG;
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

  // ---- i18n ----
  let lang = store.get('ld_lang') || ((navigator.language || 'el').startsWith('en') ? 'en' : 'el');
  const t = (key, vars) => {
    let s = (window.LD_I18N[lang] && window.LD_I18N[lang][key]) || window.LD_I18N.el[key] || key;
    if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
    return s;
  };
  function applyI18n(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.documentElement.lang = lang;
  }
  function setLang(l) { lang = l; store.set('ld_lang', l); location.reload(); }

  // ---- Supabase ----
  const sb = CFG.SUPABASE_URL && window.supabase ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
  async function getSession() { if (!sb) return null; const { data } = await sb.auth.getSession(); return data.session; }
  async function requireSession() {
    const s = await getSession();
    if (!s) { location.href = '/auth?next=' + encodeURIComponent(location.pathname); throw new Error('no_session'); }
    return s;
  }

  // ---- API ----
  async function api(path, { method = 'GET', body } = {}) {
    const s = await getSession();
    const headers = {};
    if (s) headers.Authorization = 'Bearer ' + s.access_token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetch(CFG.API_URL + '/api' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
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
    if (s) { try { isAdmin = (await api('/me')).is_admin; } catch {} }
    const link = (href, key) => `<a href="${href}" class="${active === key ? 'active' : ''}" data-i18n="nav_${key}"></a>`;
    host.innerHTML = `<header class="site-header"><a class="brand" href="/">🎓 LearnerDesk</a><nav>
      ${link('/study', 'study')}${link('/dashboard', 'dashboard')}${link('/pricing', 'pricing')}${isAdmin ? link('/admin', 'admin') : ''}
      ${s ? '<a href="#" id="logout" data-i18n="nav_logout"></a>' : link('/auth', 'login')}
      <button id="lang-btn" class="lang-btn">${t('lang_switch')}</button></nav></header>`;
    document.getElementById('lang-btn').onclick = () => setLang(lang === 'el' ? 'en' : 'el');
    const lo = document.getElementById('logout');
    if (lo) lo.onclick = async e => { e.preventDefault(); await sb.auth.signOut(); location.href = '/'; };
    applyI18n(host);
  }

  window.LD = { t, applyI18n, setLang, sb, getSession, requireSession, api, errText, esc, renderHeader, store, get lang() { return lang; } };
  document.addEventListener('DOMContentLoaded', () => applyI18n());
})();
