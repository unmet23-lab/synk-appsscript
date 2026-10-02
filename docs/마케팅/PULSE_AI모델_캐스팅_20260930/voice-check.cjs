// 목소리 파일 점검: 받아쓰기(무료 Gemini 글 열쇠) + 평균 음높이(Hz). 사용: node voice-check.cjs a.wav [b.wav ...]
const fs = require('node:fs'), path = require('node:path');
const 정책 = require(path.join(__dirname, '../../../tools/모델정책.js'));
function pitch(file) {
  const b = fs.readFileSync(file), rate = b.readUInt32LE(24), n = (b.length - 44) / 2, x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = b.readInt16LE(44 + i * 2) / 32768;
  const win = Math.floor(rate * 0.04), hop = Math.floor(rate * 0.02), f0s = [];
  for (let s = 0; s + win < n; s += hop) {
    let e = 0; for (let i = 0; i < win; i++) e += x[s + i] ** 2;
    if (e / win < 0.002) continue;
    let best = 0, lag0 = 0;
    for (let lag = Math.floor(rate / 400); lag <= Math.floor(rate / 70); lag++) {
      let c = 0, a = 0, d = 0;
      for (let i = 0; i < win - lag; i++) { c += x[s + i] * x[s + i + lag]; a += x[s + i] ** 2; d += x[s + i + lag] ** 2; }
      const r = c / Math.sqrt(a * d + 1e-9);
      if (r > best) { best = r; lag0 = lag; }
    }
    if (best > 0.6) f0s.push(rate / lag0);
  }
  f0s.sort((p, q) => p - q);
  return f0s.length ? Math.round(f0s[Math.floor(f0s.length / 2)]) : null;
}
(async () => {
  for (const f of process.argv.slice(2).filter((a) => !a.startsWith('--'))) {
    let res, j; const 문 = process.argv.includes('--유료-api') ? '돈' : '글';
    for (const mdl of (문 === '돈' ? ['gemini-2.5-flash', 'gemini-2.5-flash'] : ['gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-3-flash', 'gemini-3.8-flash'])) { res = await fetch(정책.제미나이URL(문, mdl), {
      method: 'POST', headers: await 정책.제미나이헤더(문),
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: '이 음성에서 들리는 말을 한국어로 그대로 받아써. 받아쓴 문장만 출력해.' }, { inline_data: { mime_type: 'audio/wav', data: fs.readFileSync(f).toString('base64') } }] }] }),
    });
    j = await res.json(); if (res.ok) break; await new Promise((r) => setTimeout(r, 4000)); }
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim() || JSON.stringify(j).slice(0, 200);
    console.log(`${path.basename(f)} | 음높이 중앙값 ${pitch(f)}Hz | ${text}`);
  }
})();
