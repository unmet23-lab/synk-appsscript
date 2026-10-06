import { readFile } from 'node:fs/promises';
import { readConfig } from './src/core.mjs';
import { isOAuthReturnNavigation } from './oauth-return.mjs';

const files = new Map([
  ...['core.mjs', 'product-account.mjs', 'document-sync.mjs', 'personal-data.mjs', 'personal-media.mjs', 'account-notebook.mjs', 'account-notebook.css'].map(name => [`/synk-account/src/${name}`, new URL(`./src/${name}`, import.meta.url)]),
  ['/path-vr/model.mjs', new URL('../path-vr/model.mjs', import.meta.url)],
  ['/conversation-rehearsal/domain.mjs', new URL('../conversation-rehearsal/domain.mjs', import.meta.url)],
  ['/family-album/model.mjs', new URL('../family-album/model.mjs', import.meta.url)],
  ...['slab-cream-long.webp', 'slab-coral-long.webp'].map(name => [`/synk-account/assets/${name}`, new URL(`./assets/${name}`, import.meta.url)]),
]);

/** Public SYNK ID configuration and an exact shared module allowlist for local product servers. */
export function sharedAccountServer({ configPath = process.env.SYNK_ACCOUNT_CONFIG || new URL('./config.json', import.meta.url), config } = {}) {
  let publicConfig = { version: 1, clients: {} }, origins = [];
  const ready = (async () => {
    try {
      const raw = config ?? JSON.parse(await readFile(configPath, 'utf8'));
      const checked = readConfig(raw, 'http://127.0.0.1/');
      publicConfig = Object.fromEntries(['version', 'supabaseUrl', 'supabasePublishableKey', 'accountApiUrl', 'portalUrl', 'learningUrl', 'messengerUrl', 'clients', 'authorizationClients'].filter(key => checked[key] !== undefined).map(key => [key, checked[key]]));
      origins = [...new Set([checked.supabaseUrl, checked.accountApiUrl].filter(Boolean).map(url => new URL(url).origin))];
    } catch { /* An absent or invalid config keeps the existing local product usable. */ }
  })();
  return {
    ready,
    configured: resource => !!(publicConfig.supabaseUrl && publicConfig.supabasePublishableKey && publicConfig.clients?.[resource]?.clientId),
    allowsOAuthReturn: (req, url, resource) => isOAuthReturnNavigation(req, url, publicConfig, resource),
    connections: () => `'self'${origins.length ? ` ${origins.join(' ')}` : ''}`,
    async read(pathname) {
      await ready;
      if (pathname === '/api/account-config') return { body: JSON.stringify(publicConfig), type: 'application/json; charset=utf-8' };
      const file = files.get(pathname); if (!file) return null;
      try { return { body: await readFile(file), type: pathname.endsWith('.css') ? 'text/css; charset=utf-8' : pathname.endsWith('.webp') ? 'image/webp' : 'text/javascript; charset=utf-8' }; }
      catch { return null; }
    },
  };
}
