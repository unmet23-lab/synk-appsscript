'use strict';
/* Gemini TTS(Vertex, 유료 문 명시) — 한 줄씩 굽는다. 사용: node tts.js <jobs.json> <outdir>
 * jobs: [{id, model, voice, style, text}] → <outdir>/<id>.wav (24kHz mono) + <id>.json */
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const 정책 = require('C:/Users/q1212/Documents/SYNK-appsscript/tools/모델정책.js');
const 프로젝트 = 정책.벌텍스프로젝트();
const [jobsFile, outDir] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  for (const job of jobs) {
    const wav = path.join(outDir, `${job.id}.wav`);
    if (fs.existsSync(wav)) { console.log('있음', job.id); continue; }
    const loc = job.model.includes('preview-tts') && job.model.startsWith('gemini-2.5') ? 'us-central1' : 'global';
    const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1/projects/${프로젝트}/locations/${loc}/publishers/google/models/${job.model}:generateContent`;
    const body = { contents: [{ role: 'user', parts: [{ text: `${job.style}:\n${job.text}` }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: job.voice } } } } };
    let ok = false;
    for (let a = 1; a <= 3 && !ok; a++) {
      try {
        const h = await 정책.제미나이헤더('돈');
        const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        const part = j.candidates && j.candidates[0] && (j.candidates[0].content.parts || []).find((p) => p.inlineData);
        if (!r.ok || !part) { console.log('실패', job.id, r.status, (j.error && j.error.message || '').slice(0, 120)); continue; }
        const pcm = path.join(outDir, `${job.id}.pcm`);
        fs.writeFileSync(pcm, Buffer.from(part.inlineData.data, 'base64'));
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcm, wav]);
        fs.unlinkSync(pcm);
        fs.writeFileSync(path.join(outDir, `${job.id}.json`), JSON.stringify({ ...job, location: loc, usage: j.usageMetadata || null, modelVersion: j.modelVersion || null }, null, 1));
        ok = true; console.log('완료', job.id);
      } catch (e) { console.log('오류', job.id, e.message.slice(0, 120)); }
    }
  }
})();
