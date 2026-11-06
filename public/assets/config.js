// Δημόσιες ρυθμίσεις frontend (το anon key του Supabase είναι ΔΗΜΟΣΙΟ — τα μυστικά ζουν μόνο στο gateway).
window.LD_CONFIG = {
  API_URL: 'https://gateway-production-6007.up.railway.app',   // Railway gateway
  SUPABASE_URL: 'https://fpwdkvozeuewlvuexslg.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwd2Rrdm96ZXVld2x2dWV4c2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NjUwNTEsImV4cCI6MjEwOTU0MTA1MX0.gUr6dOrxd4qbwKVfnKEwX5Zs89Pf6BOTEa23Gl2DQzk',
  ALLOW_CLIENT_GEMINI: false,                 // true ΜΟΝΟ για demo/τοπικά: Gemini απευθείας από τον browser (παρακάμπτει login/credits)
};
