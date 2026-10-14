# LearnerDesk

Ανεβάζεις ένα PDF μαθήματος → το AI (Gemini, με OCR) το διαβάζει και φτιάχνει περιβάλλον μελέτης:
θεωρία δίπλα στο PDF + Σωστό/Λάθος, Πολλαπλής, Σύνθεση, Κενά και Ελεύθερη απάντηση με αξιολόγηση AI.
UI στα Ελληνικά και Αγγλικά.

## Αρχιτεκτονική
`public/` (Vercel, στατικό) → `gateway/` (Railway, Express) → Supabase (Auth + Postgres) · Viva Wallet (πληρωμές)

- Πλάνα/τιμές/κόστος credits: **`gateway/src/plans.js`** (μοναδική πηγή· το /pricing τα διαβάζει από το API).
- Free / Student / Pro: όριο σελίδων ανά PDF, PDF/μήνα, credits/ημέρα, OCR, audio. Extra credits (top-ups) FIFO μετά τα ημερήσια.
- Κόστος: ψηφιακό PDF 1 credit/2 σελίδες · OCR 1 credit/σελίδα · αξιολόγηση ελεύθερης απάντησης 1 credit. Αποτυχία AI ⇒ επιστροφή credits.
- Το PDF **δεν αποθηκεύεται**: στέλνονται στο AI μόνο οι επιλεγμένες σελίδες· αποθηκεύεται το παραγόμενο σετ.
- Η σωστή απάντηση των ελεύθερων ερωτήσεων διαβάζεται server-side κατά την αξιολόγηση.

## Στήσιμο
1. **Supabase**: τρέξε με τη σειρά τα `docs/*.sql` (subscriptions, credit-usage, api-usage, study-sets, payments).
2. **Railway** (root `gateway/`): όρισε env από `gateway/.env.example`. `FRONTEND_ORIGINS` = το Vercel domain.
3. **Vercel** (root `public/`): συμπλήρωσε `public/assets/config.js` (`API_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` — δημόσια).
4. **Viva**: Webhook URL `https://<railway>/api/payments/webhook?key=<VIVA_WEBHOOK_KEY>`· Success URL του payment source `https://<vercel>/checkout`. Ξεκίνα με `VIVA_ENV=demo`.
5. Supabase Auth → URL Configuration: πρόσθεσε το Vercel domain στα Redirect URLs.

## Τοπικά
```
cd gateway && cp .env.example .env && npm install && npm start     # http://localhost:8080
cd public && npx serve -l 3000                                        # http://localhost:3000
```
