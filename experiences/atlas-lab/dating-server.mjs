// Product host behind an explicit HTTPS proxy, or the existing local preview.
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import Domain from '../../atlas/domain.js';
import Ask from '../../atlas/ask.js';
import Personalization from '../../atlas/personalization.js';
import { readConfig } from '../synk-account/src/core.mjs';
import { createServer } from '../learning-hub/server.mjs';
import { createDiscoveryAdapter } from './discovery.mjs';
import { createAppointmentsAdapter } from './appointments.mjs';
import { createDatingStore } from './dating-store.mjs';
import { createDatingService, DATING_DEMO_ROLES } from './dating-service.mjs';
import { readDatingRuntimeConfig, inspectDatingRuntimeConfig, loadDatingAdultAdapter, readDatingRuntimeArguments, datingRuntimeError, assertDatingRestoreCommand, datingRestoreEnvironment } from './dating-runtime.mjs';
import { createDatingTransport } from './dating-transport.mjs';
import { createDatingShutdown, installDatingShutdownSignals } from './dating-shutdown.mjs';
import { inspectDatingRestore, consumeDatingRestoreAdmission, assertDatingCopyComplete } from './dating-restore.mjs';

export function createDatingServer({ mode = 'demo', databasePath, accountConfig = { version: 1 }, verify, operatorIds = [], clock, lifecycle, adultVerification, transport, authAdmission, shutdownGraceMs, restore, restoreAdmission } = {}) {
  if (!['demo', 'account'].includes(mode)) throw new TypeError('Choose demo or account explicitly.');
  const access = createDatingTransport({ ...transport, mode });
  const shutdown = createDatingShutdown({ graceMs: shutdownGraceMs });
  const config = readConfig(accountConfig, 'http://127.0.0.1/atlas-lab/dating.html');
  if (mode === 'account' && !verify && (!config.configured || !config.clients.platform.clientId || !config.clients.platform.redirectUri)) throw new TypeError('A registered SYNK public OAuth client is required for account mode.');
  if (access.publicOrigin && (!config.configured || !config.clients.platform.clientId
    || new URL(config.clients.platform.redirectUri).href !== access.publicOrigin + '/atlas-lab/dating.html')) throw new TypeError('The public origin and registered callback must match.');
  const publicConfig = mode === 'account' ? { version: 1, supabaseUrl: config.supabaseUrl, supabasePublishableKey: config.supabasePublishableKey,
    accountApiUrl: config.accountApiUrl, portalUrl: config.portalUrl, clients: { platform: config.clients.platform } } : { version: 1 };
  if (restore !== undefined || restoreAdmission !== undefined) {
    if (mode !== 'account' || !databasePath) throw Object.assign(new Error('Restore admission needs an explicit account database.'), { code: 'dating-runtime-restore-config' });
    consumeDatingRestoreAdmission(restoreAdmission, { databasePath, expectedEnvironment: datingRestoreEnvironment(accountConfig) });
  }
  const storagePath = databasePath || path.join(os.homedir(), '.synk', 'atlas-dating', `${mode}.sqlite`);
  assertDatingCopyComplete(storagePath);
  const store = createDatingStore({ path: storagePath, mode });
  try {
    const service = createDatingService({ store, mode, accountConfig: publicConfig, verify, operatorIds, clock, lifecycle, adultVerification, transport, authAdmission,
      discoveryFactory: options => createDiscoveryAdapter({ Domain, Ask, Personalization, ...options }), appointmentsAdapter: createAppointmentsAdapter({ ...(clock ? { clock } : {}) }) });
    const requestGuard = (req, res) => {
      try {
        if (access.publicOrigin) {
          const pathname = new URL(req.url, access.publicOrigin).pathname;
          access.assertRequest(req, { serverToServer: pathname === '/api/atlas-dating/lifecycle', publicResource: !pathname.startsWith('/api/') });
        }
        return shutdown.allowRequest(req, res);
      } catch {
        res.writeHead(403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify({ ok: false, error: { code: 'request-origin-rejected' } })); return false;
      }
    };
    const server = createServer({ datingOnly: true, requestGuard, datingService: service, datingConfig: { accountConfig: publicConfig, mode,
      demoEnabled: mode === 'demo', ...(mode === 'demo' ? { demoRoles: DATING_DEMO_ROLES } : {}) } });
    shutdown.attach(server);
    Object.defineProperty(server, 'shutdownDating', { value: () => shutdown.stop() });
    server.on('close', () => store.close()); return server;
  } catch (error) { store.close(); throw error; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = readDatingRuntimeArguments(process.argv.slice(2));
    const config = await readDatingRuntimeConfig();
    assertDatingRestoreCommand(config, command);
    let restored;
    if (command.checkRestore || command.resumeAfterRestore) {
      try { restored = inspectDatingRestore({ databasePath: config.databasePath, ...config.restore, expectedEnvironment: datingRestoreEnvironment(config.accountConfig) }); }
      catch (error) { throw Object.assign(new Error('Restore admission rejected.'), { code: 'dating-runtime-restore-rejected',
        reason: /^(restore|central|product|terminal|known)-[a-z0-9-]+$/.test(error?.code) ? error.code : 'restore-inspection-failed' }); }
    }
    if (command.checkOnly) console.log(JSON.stringify(inspectDatingRuntimeConfig(config)));
    else if (command.checkRestore) console.log(JSON.stringify(restored.summary));
    else {
      const adultVerification = await loadDatingAdultAdapter(config.adultAdapterPath);
      let server;
      try { server = createDatingServer({ ...config, adultVerification, restoreAdmission: restored?.admission }); }
      catch (error) {
        if (restored) throw Object.assign(new Error('Restore admission rejected.'), { code: 'dating-runtime-restore-rejected',
          reason: /^(restore|central|product|terminal|known)-[a-z0-9-]+$/.test(error?.code) ? error.code : 'restore-start-failed' });
        throw error;
      }
      try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.port, config.host, resolve); }); }
      catch (error) { server.close(); throw error; }
      installDatingShutdownSignals(server);
      console.log(`SYNK 나다운 만남 (${config.mode}): ${config.transport?.publicOrigin || `http://${config.host}:${server.address().port}`}/atlas-lab/dating.html`);
    }
  } catch (error) { console.error(JSON.stringify({ ok: false, error: { ...datingRuntimeError(error),
    ...(error?.code === 'dating-runtime-restore-rejected' && error.reason ? { reason: error.reason } : {}) } })); process.exitCode = 1; }
}
