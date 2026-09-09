'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const base = __dirname;
function call(args) {
  const r = spawnSync('higgsfield', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, windowsHide: true });
  if (r.status !== 0) throw new Error(`Official transcription command failed: ${r.stderr.slice(-500)}`);
  return JSON.parse(r.stdout);
}
function save(name, obj) { fs.writeFileSync(path.join(base, name), JSON.stringify(obj, null, 2) + '\n', 'utf8'); }
async function main() {
  const name = '샘플전사-작업.json';
  let result;
  if (fs.existsSync(path.join(base, name))) {
    const old = JSON.parse(fs.readFileSync(path.join(base, name), 'utf8'));
    result = call(['generate', 'get', old.jobId, '--json']);
  } else {
    result = call(['generate', 'create', 'speech2text', '--audio-references', path.join(base, 'sample-kevin.mp3'), '--wait', '--json']);
  }
  const job = Array.isArray(result) ? result[0] : result;
  save(name, { jobId: job.id || job.job_id, status: job.status, topLevelKeys: Object.keys(job), generatedInput: 'sample-kevin.mp3', humanListening: false });
  if (!job.result_url) { console.log(JSON.stringify({ keys: Object.keys(job), result: job.result || job.output || null })); return; }
  const response = await fetch(job.result_url);
  if (!response.ok) throw new Error(`Transcript download failed ${response.status}`);
  const text = await response.text();
  let transcript;
  try { transcript = JSON.parse(text); } catch { transcript = { text }; }
  save('샘플전사.json', { version: 1, jobId: job.id || job.job_id, model: 'speech2text', input: 'sample-kevin.mp3', method: 'ASR automatic transcript, not human listening', transcript });
  console.log(JSON.stringify(transcript));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
