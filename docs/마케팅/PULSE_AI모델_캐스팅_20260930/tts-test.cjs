// Vertex Gemini TTS 한 문장 시험. 사용: node tts-test.cjs <모델> <목소리> <출력.wav> "<지시+대사>" --유료-api
const fs = require('node:fs'), path = require('node:path');
const 정책 = require(path.join(__dirname, '../../../tools/모델정책.js'));
const [, , model, voice, out, text] = process.argv;
(async () => {
  const res = await fetch(정책.제미나이URL('돈', model), {
    method: 'POST', headers: await 정책.제미나이헤더('돈'),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    }),
  });
  const body = await res.text();
  if (!res.ok) { console.error(res.status, body.slice(0, 500)); process.exit(1); }
  const j = JSON.parse(body);
  const part = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
  if (!part) { console.error('no audio', body.slice(0, 300)); process.exit(1); }
  const pcm = Buffer.from(part.inlineData.data, 'base64');
  const rate = Number((part.inlineData.mimeType.match(/rate=(\d+)/) || [])[1] || 24000);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(out, Buffer.concat([h, pcm]));
  console.log(out, part.inlineData.mimeType, (pcm.length / 2 / rate).toFixed(2) + 's', 'tokens', j.usageMetadata?.totalTokenCount);
})();
