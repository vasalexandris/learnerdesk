// Μοναδική πηγή αλήθειας για πλάνα, τιμές και κόστος σε credits.
// Τα νούμερα είναι αρχικές προτάσεις — άλλαξέ τα εδώ και αλλάζουν παντού (και στο /pricing).
export const PLANS = {
  free:    { name: 'Free',    credits_per_day: 15,  max_pages_per_pdf: 20,  pdfs_per_month: 2,   ocr: false, audio: false },
  student: { name: 'Student', credits_per_day: 80,  max_pages_per_pdf: 60,  pdfs_per_month: 30,  ocr: true,  audio: false },
  pro:     { name: 'Pro',     credits_per_day: 400, max_pages_per_pdf: 200, pdfs_per_month: 300, ocr: true,  audio: true  },
};

// Αγορές (Viva). Ποσά σε λεπτά του ευρώ.
export const ITEMS = {
  student_monthly: { kind: 'plan', plan: 'student', billing: 'monthly', amount_cents: 490,   label: 'Student (μήνας)' },
  student_annual:  { kind: 'plan', plan: 'student', billing: 'annual',  amount_cents: 4900,  label: 'Student (έτος)' },
  pro_monthly:     { kind: 'plan', plan: 'pro',     billing: 'monthly', amount_cents: 1290,  label: 'Pro (μήνας)' },
  pro_annual:      { kind: 'plan', plan: 'pro',     billing: 'annual',  amount_cents: 12900, label: 'Pro (έτος)' },
  topup_small:     { kind: 'topup', credits: 150,   amount_cents: 290,  label: '150 credits' },
  topup_large:     { kind: 'topup', credits: 600,   amount_cents: 890,  label: '600 credits' },
};

// Κόστος σε credits. Ψηφιακό PDF: 1 credit ανά 2 σελίδες. Σκαναρισμένο (OCR): 1 ανά σελίδα. Αξιολόγηση ελεύθερης απάντησης: 1.
export function generateCost(pages, ocr) {
  return ocr ? pages : Math.ceil(pages / 2);
}
export const GRADE_COST = 1;
export const MAX_PDF_BYTES = 12 * 1024 * 1024;
