import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from '../server.mjs';

// Existing synthetic narration, never a personal conversation or a paid model call.
const source = new URL('../../korean-rhythm/audio-source/raw/t0q0r.mp3', import.meta.url);
const server = createServer({ port: 0 });
await server.start();
const base = `http://127.0.0.1:${server.address().port}`;
const started = Date.now();
try {
  const response = await fetch(base + '/api/transcribe', {
    method: 'POST', headers: { Origin: base, 'X-SYNK-Care': '1', 'Content-Type': 'audio/mpeg' },
    body: await readFile(source),
  });
  const result = await response.json();
  const normalize = value => String(value).replace(/[\p{Punctuation}\s]/gu, '');
  const expected = '내일은 바빠서 오늘 도서관에 가요. 도서관에는 오늘 가나요?';
  const report = { at: new Date().toISOString(), status: response.status, elapsedMs: Date.now() - started,
    syntheticFixture: 'korean-rhythm/t0q0r', wordsMatch: normalize(result.text) === normalize(expected), ...result };
  await writeFile(new URL('./transcription.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (response.status !== 200 || !report.wordsMatch) process.exitCode = 1;
} finally { await server.stop(); }
