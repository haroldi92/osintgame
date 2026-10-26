'use strict';
window.BB = (() => {
  let client;
  const config = window.BLACKBOX_CONFIG || {};
  function getClient() {
    if (!config.url || !config.publishableKey) throw new Error('Die Online-Verbindung ist noch nicht eingerichtet. Bitte die Spielleitung kontaktieren.');
    if (!client) client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { storage: window.sessionStorage, storageKey: location.pathname.endsWith('/admin.html')?'blackbox-admin-auth':'blackbox-online-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: location.pathname.endsWith('/admin.html') }
    });
    return client;
  }
  async function ensurePlayer() {
    const c = getClient();
    const {data, error} = await c.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      const result = await c.auth.signInAnonymously();
      if (result.error) throw new Error('Team-Anmeldung nicht möglich. Bitte Internetverbindung prüfen oder Spielleitung kontaktieren.');
    }
  }
  async function rpc(name, args = {}) {
    const {data, error} = await getClient().rpc(name, args);
    if (error) { const failure = new Error(error.message || 'Serveranfrage fehlgeschlagen.'); failure.definitive = /^P\d{4}$|^22|^23|^42/.test(error.code || ''); throw failure; }
    return data;
  }
  function id() { return crypto.randomUUID(); }
  return { getClient, ensurePlayer, rpc, id };
})();
