'use strict';
const fs = require('fs'); const path = require('path');
const 정책 = require('C:/Users/q1212/Documents/SYNK-appsscript/tools/모델정책.js');
const 프로젝트 = 정책.벌텍스프로젝트();
const prompts = {
  b: 'Instrumental only, no vocals, no singing. Playful, cozy background music for a cute Korean-language learning short with a needle-felt mascot: bright marimba melody, soft pizzicato strings, gentle ukulele, light claps, bouncy and cheerful but not busy, major key, around 110 BPM, loopable, clean sparse mix with room for a narrator.',
  c: 'Instrumental only, no vocals, no singing. Light lo-fi kawaii background loop for a language-learning Reel: glockenspiel and soft electric piano motif, mellow plucked bass, soft brushed beat, warm and happy, relaxed 100 BPM, gentle and uncluttered so a voice-over stays clear.',
};
(async () => {
  for (const [k, prompt] of Object.entries(prompts)) {
    const h = await 정책.제미나이헤더('돈');
    const r = await fetch(`https://aiplatform.googleapis.com/v1/projects/${프로젝트}/locations/global/publishers/google/models/lyria-3-clip-preview:generateContent`, { method: 'POST', headers: h, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['AUDIO', 'TEXT'] } }) });
    const j = await r.json().catch(() => ({}));
    const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    const a = parts.find((p) => p.inlineData); const t = parts.filter((p) => p.text).map((p) => p.text).join(' ');
    if (r.ok && a) { const f = path.join(__dirname, 'bgm', `lyria3_${k}.mp3`); fs.writeFileSync(f, Buffer.from(a.inlineData.data, 'base64')); console.log('OK', k, a.inlineData.mimeType, 'text:', t.slice(0, 160)); }
    else console.log('fail', k, r.status, (j.error && j.error.message || '').slice(0, 160));
  }
})();
