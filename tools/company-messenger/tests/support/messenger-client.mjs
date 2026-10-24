// Loads the messenger browser client for vm-based contract tests. The page
// runs the client modules first (index.html) and app.js reads their
// namespaces from window; tests install the same namespaces into the vm
// window instead of rewriting app.js. Only the final boot() call is left out
// so each test drives the client itself.
import { readFileSync } from 'node:fs';
import { SynkMessengerState } from '../../public/messenger-state.js';
import { SynkMessengerSession } from '../../public/messenger-session.js';
import { SynkMessengerShell } from '../../public/messenger-shell.js';
import { SynkMessengerTasks } from '../../public/messenger-task-model.js';

const appFile = new URL('../../public/app.js', import.meta.url);
export const appSource = readFileSync(appFile, 'utf8').replace(/\bboot\(\);\s*$/, '');
export const clientModules = Object.freeze({ SynkMessengerState, SynkMessengerSession, SynkMessengerShell, SynkMessengerTasks });

export function installMessengerModules(context) {
  const target = context.window || (context.window = {});
  Object.assign(target, clientModules);
  return context;
}
