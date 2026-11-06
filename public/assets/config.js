// Δημόσιες ρυθμίσεις frontend (το anon key του Supabase είναι ΔΗΜΟΣΙΟ — τα μυστικά ζουν μόνο στο gateway).
window.LD_CONFIG = {
  API_URL: 'http://localhost:8080',          // Railway gateway URL
  SUPABASE_URL: '',                           // https://xxxx.supabase.co
  SUPABASE_ANON_KEY: '',
  ALLOW_CLIENT_GEMINI: false,                 // true ΜΟΝΟ για demo/τοπικά: επιτρέπει κλήση Gemini απευθείας από τον browser (παρακάμπτει login/credits)
};
