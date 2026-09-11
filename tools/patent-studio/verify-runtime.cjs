'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { createLocalTranscriber } = require('./local-transcriber.cjs');
async function run() {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '.runtime/studio.json'), 'utf8'));
  const samplePath = path.join(config.directory, 'samples');
  const manifest = JSON.parse(fs.readFileSync(path.join(samplePath, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
  const t = createLocalTranscriber();
  const results = [];
  try {
    await t.warmup();
    for (const name of ['original.wav', 'unexpected.wav']) {
      const bytes = fs.readFileSync(path.join(samplePath, name));
      const sha = crypto.createHash('sha256').update(bytes).digest('hex');
      if (manifest.files.find(f => f.file === name)?.sha256 !== sha) throw new Error('합성 샘플 지문 불일치');
      const result = await t.transcribe({ bytes, mimeType: 'audio/wav' });
      if (!result.text || result.raw.networkAttempts !== 0) throw new Error('로컬 전사 확인 실패');
      results.push({ name, sha256: sha, text: result.text, elapsedMs: result.raw.response.elapsedMs, networkAttempts: result.raw.networkAttempts,
        model: result.model, runtime: result.raw.runtime, request: result.raw.request });
    }
  } finally { await t.close(); }
  const report = { checkedAt: new Date().toISOString(), actualLocalInference: true, source: 'self-authored Windows SAPI fixtures', results };
  fs.mkdirSync(path.join(__dirname, 'qa-output'), {recursive:true});
  fs.writeFileSync(path.join(__dirname, 'qa-output/offline-runtime.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checkedAt: report.checkedAt, results: results.map(r => ({name:r.name,text:r.text,elapsedMs:r.elapsedMs,networkAttempts:r.networkAttempts})) }, null, 2));
}
run().catch(e => { console.error(e.code || e.message); process.exitCode = 1; });
