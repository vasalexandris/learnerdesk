import sanitizeHtml from 'sanitize-html';

const ALLOWED = {
  allowedTags: ['h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  allowedAttributes: {},
};
const clean = s => sanitizeHtml(String(s ?? ''), ALLOWED);
const text = s => sanitizeHtml(String(s ?? ''), { allowedTags: [], allowedAttributes: {} });
const arr = v => (Array.isArray(v) ? v : []);

// Μετατρέπει την έξοδο του AI στο σχήμα που καταναλώνει το frontend (ίδιο με το πρότυπο AEPP).
// Όλο το κείμενο ερωτήσεων είναι plain text (escape γίνεται στον client)· μόνο το theory είναι sanitized HTML.
export function normalizeStudySet(raw) {
  const sections = arr(raw?.sections).map((s, i) => {
    const tf = arr(s.tf).filter(x => x?.q && typeof x.answer === 'boolean').map(x => ({
      q: text(x.q), ans: x.answer ? 'true' : 'false', correctDisplay: x.answer ? 'true' : 'false', feedback: text(x.feedback),
    }));
    const mcq = arr(s.mcq).filter(x => x?.q && arr(x.options).length >= 2 && x.answer_index >= 0 && x.answer_index < x.options.length).map(x => ({
      q: text(x.q), options: x.options.map(text), ans: String(x.answer_index), correctDisplay: text(x.options[x.answer_index]), feedback: text(x.feedback),
    }));
    const fill = arr(s.fill).filter(x => x?.q && x.answer && arr(x.pool).length >= 2).map(x => {
      const pool = x.pool.map(text);
      if (!pool.includes(text(x.answer))) pool.push(text(x.answer));
      return { q: text(x.q), pool, ans: text(x.answer), correctDisplay: text(x.answer), feedback: text(x.feedback) };
    });
    const cloze = arr(s.cloze).filter(x => x?.text && arr(x.answers).length).map(x => ({
      q: text(x.q), html: text(x.text), ans: x.answers.map(text),
    }));
    const free = arr(s.free).filter(x => x?.q && x.model_answer).map(x => ({ q: text(x.q), correctDisplay: text(x.model_answer) }));
    return { id: `sec${i + 1}`, title: text(s.title) || `Ενότητα ${i + 1}`, theory: clean(s.theory), questions: { tf, mcq, fill, cloze, free } };
  }).filter(s => s.theory || s.questions.tf.length || s.questions.mcq.length);
  return { title: text(raw?.title), lang: text(raw?.lang), sections };
}
