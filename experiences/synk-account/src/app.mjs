import { createClient } from '@supabase/supabase-js';
import { readConfig } from './core.mjs';
import { mountPortal } from './portal.mjs';
import { publicLoginSettings } from './google-auth.mjs';
async function start() {
  let raw;
  try { const response = await fetch('./config.json', { cache: 'no-store' });if (response.ok) raw = await response.json(); } catch { /* A missing public config is a visible setup state. */ }
  const config = readConfig(raw || { version: 1 }, location.href);
  const loginSettings = config.configured ? publicLoginSettings(config) : { google: false, phone: false };
  const sdk = config.configured ? createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } }) : null;
  await mountPortal({ config, sdk, loginSettings });
}
start().catch(error => { const notice = document.getElementById('notice');notice.textContent = error.message;notice.classList.add('error');document.getElementById('setup').hidden = false; });
