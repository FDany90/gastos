/* Crea el cliente de Supabase (global window.SB) a partir de config.js */
(function () {
  if (!window.supabase || !window.supabase.createClient) {
    console.error('No se cargó la librería supabase-js (revisá el <script> del CDN).');
    return;
  }
  if (!window.SUPABASE_URL || window.SUPABASE_URL.includes('TU-') ||
      !window.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY.includes('TU-')) {
    console.warn('⚠️ Configurá js/config.js con tu Project URL y anon key de Supabase.');
  }
  window.SB = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
})();
