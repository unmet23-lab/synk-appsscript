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
let adapter;
try { adapter = await import(new URL('experiences/atlas-lab/model-extraction.mjs', root)); }
finally { hooks.deregister(); }
const artifacts = paths.filter(path => captured.has(path)).map(path => ({ path, sha256: captured.get(path) }));
const runtimeAttested = !preloaded && artifacts.length === paths.length;
const proof = { version: 1, runtimeAttested, startedAt,
  buildId: runtimeAttested ? createHash('sha256').update(JSON.stringify(artifacts)).digest('hex') : null, artifacts };

export const buildComputerModelRequest = adapter.buildComputerModelRequest;
export const parseComputerModelResponse = adapter.parseComputerModelResponse;
export const COMPUTER_MODEL = adapter.COMPUTER_MODEL;
export const computerRuntimeProof = () => JSON.parse(JSON.stringify(proof));
