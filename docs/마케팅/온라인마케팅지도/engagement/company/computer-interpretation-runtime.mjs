// Observe the exact source bytes Node loads for this product's existing adapter.
// This is build provenance, not a model runner: imports and execution stay with
// Node's official loader, and the hook neither transforms nor replaces code.
import { registerHooks, createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../../../', import.meta.url);
const paths = [
  'experiences/atlas-lab/model-extraction.mjs', 'experiences/atlas-lab/interpretation.mjs',
  'docs/마케팅/맞춤도구/computer/content.js', 'atlas/interpretation.js', 'atlas/domain.js',
].sort();
const wanted = new Map(paths.map(path => [new URL(path, root).href, path]));
const captured = new Map(), require = createRequire(import.meta.url);
// A CommonJS export cached before this observer may be older than current disk
// bytes. Never certify that cache using a fresh filesystem read.
const preloaded = paths.some(path => require.cache[fileURLToPath(new URL(path, root))]);
const startedAt = new Date().toISOString();
const hooks = registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context), path = wanted.get(url);
    if (path && result.source != null) {
      const bytes = typeof result.source === 'string' ? Buffer.from(result.source, 'utf8') : Buffer.from(result.source);
      captured.set(path, createHash('sha256').update(bytes).digest('hex'));
    }
    return result;
  },
});
// This optional administrator feature must never stop the company host itself.
// A missing or broken adapter source leaves the dashboard and messenger running:
// the feature reports itself unavailable and no build is certified.
let adapter = null, unavailable = null;
try { adapter = await import(new URL('experiences/atlas-lab/model-extraction.mjs', root)); }
// Keep an error class only. A loader message can quote local paths or source text.
catch (cause) { unavailable = typeof cause?.code === 'string' && /^[A-Z_]{1,60}$/.test(cause.code) ? cause.code : 'ADAPTER_LOAD_FAILED'; }
finally { hooks.deregister(); }
const complete = adapter !== null && ['buildComputerModelRequest', 'parseComputerModelResponse'].every(name => typeof adapter[name] === 'function')
  && typeof adapter.COMPUTER_MODEL === 'string';
if (adapter !== null && !complete) { adapter = null; unavailable = 'ADAPTER_INCOMPLETE'; }
const artifacts = paths.filter(path => captured.has(path)).map(path => ({ path, sha256: captured.get(path) }));
const runtimeAttested = adapter !== null && !preloaded && artifacts.length === paths.length;
const proof = { version: 1, runtimeAttested, startedAt,
  buildId: runtimeAttested ? createHash('sha256').update(JSON.stringify(artifacts)).digest('hex') : null, artifacts };

export const buildComputerModelRequest = adapter?.buildComputerModelRequest ?? null;
export const parseComputerModelResponse = adapter?.parseComputerModelResponse ?? null;
export const COMPUTER_MODEL = adapter?.COMPUTER_MODEL ?? null;
export const computerAdapterStatus = () => ({ available: adapter !== null, reason: unavailable });
export const computerRuntimeProof = () => JSON.parse(JSON.stringify(proof));
