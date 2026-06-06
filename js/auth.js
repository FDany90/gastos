/* ============================================================
   Auth: acceso anónimo automático (sin pantalla de login).
   Supabase guarda la sesión en el navegador y renueva el token
   solo, así que la sesión persiste entre recargas.
   "Asegurar cuenta" convierte el usuario anónimo en uno con
   email + contraseña para no perder los datos / poder migrar.
   ============================================================ */
const Auth = (function () {
  let _user = null;

  async function ensureSession() {
    const { data: { session } } = await SB.auth.getSession();
    if (session) { _user = session.user; return _user; }
    const { data, error } = await SB.auth.signInAnonymously();
    if (error) { console.error('Acceso anónimo falló:', error.message); return null; }
    _user = data.user;
    return _user;
  }

  function user() { return _user; }
  function isAnonymous() { return !!(_user && _user.is_anonymous); }

  // Convierte el usuario anónimo en permanente (email + contraseña).
  async function linkEmail(email, password) {
    const { data, error } = await SB.auth.updateUser({ email, password });
    if (error) throw error;
    if (data && data.user) _user = data.user;
    return _user;
  }

  async function signOut() { await SB.auth.signOut(); location.reload(); }

  return { ensureSession, user, isAnonymous, linkEmail, signOut };
})();
window.Auth = Auth;
