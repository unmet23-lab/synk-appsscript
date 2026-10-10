import { createClient } from '@supabase/supabase-js';
import { readConfig } from './core.mjs';
import { mountPortal } from './portal.mjs';
async function start() {
  let raw;
  try { const response = await fetch('./config.json', { cache: 'no-store' });if (response.ok) raw = await response.json(); } catch { /* A missing public config is a visible setup state. */ }
  const config = readConfig(raw || { version: 1 }, location.href);
  const sdk = config.configured ? createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } }) : null;
  await mountPortal({ config, sdk });
}
start().catch(error => { const notice = document.getElementById('notice');notice.textContent = error.message;notice.classList.add('error');document.getElementById('setup').hidden = false; });
