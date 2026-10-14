(() => {
  const { t, esc, api } = LD;
  const $ = id => document.getElementById(id);
  const MAX_BYTES = 12 * 1024 * 1024;

  let me = null, current = null;            // current = { id, title, sections, ... }
  let mode = 'study', openSection = null, answers = {};
  let pdfFile = null, pdfPages = 0, pdfUrl = null;

  const norm = s => String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ================= Νέο σετ =================
  function updateCost() {
    const from = +$('pFrom').value || 1, to = +$('pTo').value || from;
    const pages = Math.max(to - from + 1, 0);
    const cost = $('ocr').checked ? pages : Math.ceil(pages / 2);
    $('costTxt').textContent = pages ? t('st_cost', { n: cost }) : '';
    const tooMany = me && pages > me.plan.max_pages_per_pdf;
    $('genBtn').disabled = !pdfFile || !pages || tooMany || pdfFile.size > MAX_BYTES;
    $('limitTxt').textContent = me ? t('st_pages_max', { n: me.plan.max_pages_per_pdf }) : '';
  }

  async function onFile(file) {
    if (!file || file.type !== 'application/pdf') return;
    $('genMsg').innerHTML = '';
    if (file.size > MAX_BYTES) { $('genMsg').innerHTML = `<div class="msg err">${esc(t('st_large'))}</div>`; pdfFile = null; updateCost(); return; }
    pdfFile = file;
    try {
      const doc = await PDFLib.PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      pdfPages = doc.getPageCount();
    } catch { pdfPages = 1; }
    $('pFrom').value = 1; $('pTo').value = Math.min(pdfPages, me ? me.plan.max_pages_per_pdf : pdfPages);
    $('pFrom').max = $('pTo').max = pdfPages;
    showPdf(file, 1);
    updateCost();
  }

  function showPdf(file, page) {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    pdfUrl = URL.createObjectURL(file);
    $('pdfViewer').src = pdfUrl + '#page=' + (page || 1);
    $('pdfViewer').style.display = 'block';
    $('placeholder').style.display = 'none';
  }

  const toBase64 = file => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1]);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });

  async function generate() {
    $('genBtn').disabled = true;
    $('genMsg').innerHTML = '';
    $('genStatus').innerHTML = `<span class="spin"></span> ${esc(t('st_generating'))}`;
    try {
      const out = await api('/study/generate', { method: 'POST', body: {
        pdf_base64: await toBase64(pdfFile), filename: pdfFile.name,
        page_from: +$('pFrom').value, page_to: +$('pTo').value, ocr: $('ocr').checked,
      } });
      openSet(out, true);
      loadMe(); loadSets();
    } catch (e) {
      $('genMsg').innerHTML = `<div class="msg err">${esc(LD.errText(e))}</div>`;
    } finally {
      $('genStatus').innerHTML = '';
      updateCost();
    }
  }

  async function loadSets() {
    const { sets } = await api('/study/sets');
    $('setList').innerHTML = sets.length ? sets.map(s => `<div class="set-item"><div><strong>${esc(s.title)}</strong><div class="muted">${s.page_from}–${s.page_to} · ${new Date(s.created_at).toLocaleDateString(LD.lang)}</div></div>
      <button class="btn" data-open="${esc(s.id)}">${esc(t('dash_open'))}</button></div>`).join('') : `<p class="muted">${esc(t('dash_none'))}</p>`;
    $('setList').querySelectorAll('[data-open]').forEach(b => b.onclick = async () => openSet(await api('/study/sets/' + b.dataset.open), false));
  }

  async function loadMe() {
    me = await api('/me');
    $('ocr').disabled = !me.plan.ocr;
    if (!me.plan.ocr) $('ocr').checked = false;
    $('ocrLbl').textContent = me.plan.ocr ? t('st_ocr') : t('st_ocr_locked');
    $('audioLbl').title = me.plan.audio ? '' : '🔒 Pro';
    updateCost();
  }

  // ================= Περιβάλλον μελέτης =================
  function openSet(set, justCreated) {
    current = set; answers = {}; mode = 'study'; openSection = set.sections[0]?.id || null;
    $('viewNew').style.display = 'none';
    $('viewSet').style.display = 'flex';
    $('setTitle').textContent = set.title;
    $('footTitle').textContent = '📄 ' + set.title;
    if (!justCreated && !pdfFile) $('placeholderTxt').textContent = t('st_reupload');
    if (pdfFile && set.page_from) showPdf(pdfFile, set.page_from);
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === 'study'));
    $('pdfContainer').classList.remove('pdf-blur');
    history.replaceState(null, '', '/study?set=' + encodeURIComponent(set.id));
    render();
  }

  function setMode(m) {
    mode = m; answers = {};
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    $('pdfContainer').classList.toggle('pdf-blur', m !== 'study');
    render();
  }

  const label = v => (v === 'true' ? t('true_plain') : v === 'false' ? t('false_plain') : v);

  function render() {
    const area = $('content-area');
    area.innerHTML = '';
    const isStudy = mode === 'study';
    current.sections.forEach(sec => {
      const qs = isStudy ? sec.questions.free : sec.questions[mode];
      if (!qs || !qs.length) return;
      const active = openSection === sec.id;
      let rows = '';
      qs.forEach((q, i) => {
        const key = `${sec.id}_${i}`, ua = answers[key];
        rows += `<div class="question-row"><div class="col-exercise">${exerciseHtml(sec, q, i, key, ua, isStudy)}</div>
          <div class="col-answer ${!isStudy && (!ua || ua.loading) ? 'blur-col' : ''}">${answerHtml(q, ua, isStudy)}</div></div>`;
      });
      area.insertAdjacentHTML('beforeend', `<button class="topic-button" data-toggle="${esc(sec.id)}">${esc(sec.title)}</button>
        <div class="content-box ${active ? 'active' : ''}"><div class="row-card"><div class="col-theory ${isStudy ? '' : 'blur-col'}">${sec.theory}</div>
        <div class="col-right-wrapper">${rows}</div></div></div>`);
    });
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise();
  }

  function exerciseHtml(sec, q, i, key, ua, isStudy) {
    if (isStudy) return `<div style="font-weight:600;margin-bottom:12px">${i + 1}. ${esc(q.q)}</div><div class="study-answer"><b>${esc(t('answer_lbl'))}:</b> ${esc(label(q.correctDisplay))}</div>`;
    let h = `<div style="font-weight:600;margin-bottom:14px;color:#c62828">${i + 1}. ${esc(q.q)}</div>`;
    const dis = ua ? 'disabled' : '';
    if (mode === 'tf') {
      [['true', t('true_lbl')], ['false', t('false_lbl')]].forEach(([v, l]) => {
        const cls = ua ? (v === q.ans ? 'ans-correct' : ua.value === v ? 'ans-wrong' : '') : '';
        h += `<label class="opt-label ${cls}"><input type="radio" name="in_${key}" value="${v}" ${ua?.value === v ? 'checked' : ''} ${dis}>${esc(l)}</label>`;
      });
    } else if (mode === 'mcq') {
      q.options.forEach((o, n) => {
        const cls = ua ? (String(n) === q.ans ? 'ans-correct' : ua.value === String(n) ? 'ans-wrong' : '') : '';
        h += `<label class="opt-label ${cls}"><input type="radio" name="in_${key}" value="${n}" ${ua?.value === String(n) ? 'checked' : ''} ${dis}>${esc(o)}</label>`;
      });
    } else if (mode === 'fill') {
      q.pool.forEach((w, n) => {
        const sel = ua ? ua.value === w : (answers['_sel_' + key] === w);
        const cls = ua ? (w === q.ans ? 'ans-correct' : sel ? 'ans-wrong' : '') : (sel ? 'selected' : '');
        h += `<button class="word-chip ${cls}" data-chip="${key}" data-idx="${n}" ${dis}>${esc(w)}</button>`;
      });
    } else if (mode === 'cloze') {
      let s = esc(q.html);
      q.ans.forEach((a, n) => {
        const v = ua ? ua.values[n] || '' : '';
        const cls = ua ? (norm(v) === norm(a) ? 'ans-correct' : 'ans-wrong') : '';
        s = s.replace(`[${n}]`, `<input type="text" class="cloze-in ${cls}" data-cloze="${key}" data-n="${n}" value="${esc(v)}" style="width:${Math.max(a.length, 4) + 2}ch" ${dis} autocomplete="off">`);
      });
      h += `<div style="line-height:2.2;padding:14px;background:#fff;border-radius:8px;border:2px dashed var(--border)">${s}</div>`;
    } else if (mode === 'free') {
      h += ua && !ua.loading
        ? `<div class="${{ correct: 'ans-correct', partial: 'ans-partial', wrong: 'ans-wrong' }[ua.verdict] || 'ans-partial'}" style="padding:12px;border-radius:6px;border:2px solid;font-size:14px">${esc(ua.value)}</div>`
        : `<textarea id="in_${key}" rows="4" placeholder="${esc(t('ph_answer'))}" ${ua?.loading ? 'disabled' : ''}>${esc(ua?.value || '')}</textarea>`;
    }
    if (!ua) h += `<div style="margin-top:14px"><button class="btn-check" data-check="${esc(sec.id)}" data-i="${i}">${esc(t('confirm'))}</button></div>`;
    else if (ua.loading) h += `<div style="margin-top:14px"><span class="spin"></span> <b style="color:#3b82f6;font-size:13px">${esc(t('ai_grading'))}</b></div>`;
    return h;
  }

  function answerHtml(q, ua, isStudy) {
    if (isStudy) return `<div class="muted">—</div><div class="hr"></div><div class="muted">—</div>`;
    if (!ua) return `<div class="muted">—</div>`;
    if (ua.loading) return `<div style="font-weight:600">${esc(label(q.correctDisplay))}</div><div class="hr"></div><div class="muted">…</div>`;
    let correct = esc(label(q.correctDisplay));
    if (mode === 'cloze') {
      let s = esc(q.html);
      q.ans.forEach((a, n) => { s = s.replace(`[${n}]`, `<span style="background:#dcfce7;color:#166534;padding:0 6px;border-radius:4px;font-weight:700;border:1px solid #22c55e">${esc(a)}</span>`); });
      correct = `<div style="line-height:1.9;background:#fff;padding:12px;border-radius:6px;border:1px solid #ddd">${s}</div>`;
    }
    let fb;
    if (mode === 'free') {
      const cls = { correct: 'badge-correct', partial: 'badge-partial', wrong: 'badge-wrong' }[ua.verdict] || 'badge-partial';
      const ic = { correct: '✅', partial: '⚠️', wrong: '❌' }[ua.verdict] || '⚠️';
      fb = `<div class="verdict-badge ${cls}" style="margin-bottom:8px">${ic} ${esc(ua.short)}</div><div style="font-size:14px">${esc(ua.feedback)}</div>`;
    } else {
      const ok = ua.verdict === 'correct';
      fb = `<div class="verdict-badge ${ok ? 'badge-correct' : 'badge-wrong'}" style="margin-bottom:8px">${ok ? '✅' : '❌'} ${esc(ok ? t('v_correct') : t('v_wrong'))}</div><div style="font-size:14px">${esc(ua.feedback)}</div>`;
    }
    return `<div class="lbl">${esc(t('correct_answer'))}</div><div style="font-weight:600">${correct}</div><div class="hr"></div><div class="lbl">${esc(t('evaluation'))}</div>${fb}`;
  }

  async function check(secId, i) {
    const sec = current.sections.find(s => s.id === secId), q = sec.questions[mode][i], key = `${secId}_${i}`;
    if (mode === 'tf' || mode === 'mcq') {
      const sel = document.querySelector(`input[name="in_${key}"]:checked`);
      if (!sel) return alert(t('alert_pick'));
      answers[key] = { verdict: sel.value === q.ans ? 'correct' : 'wrong', value: sel.value, feedback: q.feedback };
    } else if (mode === 'fill') {
      const v = answers['_sel_' + key];
      if (!v) return alert(t('alert_word'));
      answers[key] = { verdict: v === q.ans ? 'correct' : 'wrong', value: v, feedback: q.feedback };
    } else if (mode === 'cloze') {
      const values = q.ans.map((_, n) => (document.querySelector(`[data-cloze="${key}"][data-n="${n}"]`)?.value || '').trim());
      if (values.some(v => !v)) return alert(t('alert_blanks'));
      const ok = q.ans.every((a, n) => norm(values[n]) === norm(a));
      answers[key] = { verdict: ok ? 'correct' : 'wrong', values, feedback: ok ? t('cloze_ok') : t('cloze_bad') };
    } else if (mode === 'free') {
      const v = ($(`in_${key}`)?.value || '').trim();
      if (!v) return alert(t('alert_write'));
      answers[key] = { loading: true, value: v };
      render();
      try {
        const r = await api('/study/grade', { method: 'POST', body: { set_id: current.id, section_id: secId, q_index: i, answer: v } });
        answers[key] = { verdict: r.verdict, short: r.short, feedback: r.explanation, value: v };
      } catch (e) {
        delete answers[key];
        alert(LD.errText(e));
      }
    }
    render();
    api('/me').then(m => { me = m; }).catch(() => {});
  }

  // ================= Events =================
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-toggle],[data-mode],[data-check],[data-chip]');
    if (!el) return;
    if (el.dataset.toggle) { openSection = openSection === el.dataset.toggle ? null : el.dataset.toggle; render(); }
    else if (el.dataset.mode) setMode(el.dataset.mode);
    else if (el.dataset.check) check(el.dataset.check, +el.dataset.i);
    else if (el.dataset.chip) {
      const [secId, idx] = [el.dataset.chip.replace(/_\d+$/, ''), el.dataset.chip.match(/_(\d+)$/)[1]];
      const q = current.sections.find(s => s.id === secId).questions.fill[+idx];
      const w = q.pool[+el.dataset.idx], k = '_sel_' + el.dataset.chip;
      answers[k] = answers[k] === w ? '' : w;
      render();
    }
  });

  function setupAudio() {
    const a = $('audioPlayer'), play = $('playPauseBtn');
    $('audioUpload').addEventListener('change', e => {
      if (!me?.plan.audio) { e.target.value = ''; alert('Audio: Pro'); return; }
      const f = e.target.files[0];
      if (!f || !f.type.startsWith('audio/')) return;
      a.src = URL.createObjectURL(f);
      ['playPauseBtn', 'rewindBtn', 'forwardBtn'].forEach(id => { $(id).style.display = 'inline-block'; });
    });
    play.onclick = () => { if (a.paused) { a.play(); play.textContent = '⏸️'; } else { a.pause(); play.textContent = '▶️'; } };
    $('rewindBtn').onclick = () => { a.currentTime = Math.max(0, a.currentTime - 10); };
    $('forwardBtn').onclick = () => { a.currentTime = Math.min(a.duration || 0, a.currentTime + 10); };
  }

  async function init() {
    await LD.renderHeader('study');
    await LD.requireSession();
    $('pdfFile').onchange = e => onFile(e.target.files[0]);
    $('pdfLoad').onchange = e => { const f = e.target.files[0]; if (f && f.type === 'application/pdf') { pdfFile = f; showPdf(f, current?.page_from || 1); updateCost(); } };
    ['pFrom', 'pTo', 'ocr'].forEach(id => $(id).addEventListener('input', updateCost));
    $('genBtn').onclick = generate;
    $('btnNew').onclick = () => { $('viewSet').style.display = 'none'; $('viewNew').style.display = 'block'; $('pdfContainer').classList.remove('pdf-blur'); history.replaceState(null, '', '/study'); };
    setupAudio();
    await loadMe();
    await loadSets();
    const id = new URLSearchParams(location.search).get('set');
    if (id) { try { openSet(await api('/study/sets/' + encodeURIComponent(id)), false); } catch {} }
  }
  init();
})();
