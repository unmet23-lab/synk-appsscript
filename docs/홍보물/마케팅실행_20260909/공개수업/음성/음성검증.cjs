'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const base = __dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(base, name), 'utf8'));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
function pcm(file) {
  const data = fs.readFileSync(path.join(base, file));
  assert.equal(data.toString('ascii', 0, 4), 'RIFF');
  assert.equal(data.toString('ascii', 8, 12), 'WAVE');
  for (let offset = 12; offset + 8 <= data.length;) {
    const kind = data.toString('ascii', offset, offset + 4);
    const length = data.readUInt32LE(offset + 4);
    if (kind === 'data') return data.subarray(offset + 8, Math.min(offset + 8 + length, data.length));
    offset += 8 + length + (length % 2);
  }
  throw new Error(`No PCM data: ${file}`);
}
function metrics(buffer) {
  let peak = 0, squares = 0, fullScaleSamples = 0, quietSamples = 0;
  const count = buffer.length / 2;
  assert.equal(count % 1, 0);
  for (let offset = 0; offset < buffer.length; offset += 2) {
    const sample = buffer.readInt16LE(offset);
    const abs = Math.abs(sample) / 32768;
    peak = Math.max(peak, abs);
    squares += abs * abs;
    if (sample === 32767 || sample === -32768) fullScaleSamples++;
    if (abs <= 0.005) quietSamples++;
  }
  assert.ok(peak > 0.01, 'All-silent or near-silent output');
  return { samples: count, peakDbfs: Number((20 * Math.log10(peak)).toFixed(2)), rmsDbfs: Number((20 * Math.log10(Math.sqrt(squares / count))).toFixed(2)), fullScaleSamples, quietSampleFraction: Number((quietSamples / count).toFixed(4)) };
}
const source = JSON.parse(fs.readFileSync(path.resolve(base, '../../원고/콘텐츠원고.json'), 'utf8'));
const manifests = [
  { group: 'lecture', name: '음성명세.json', expected: source.lectures[0].chapters, prefix: '전사-' },
  { group: 'clinic', name: '클리닉_음성명세.json', expected: source.extras[0].scenes.map((x, i) => ({ ...x, id: String(i + 1).padStart(2, '0') })), prefix: '전사-클리닉' },
];
const records = [];
for (const collection of manifests) {
  const manifest = read(collection.name);
  assert.equal(manifest.chapters.length, collection.expected.length);
  for (const item of manifest.chapters) {
    const expected = collection.expected.find(x => x.id === item.id);
    assert.equal(item.narrationSha256, hash(expected.narration), `${collection.group}/${item.id}: narration drift`);
    const original = pcm(item.originalFile);
    const normalized = pcm(item.wavFile);
    assert.ok(original.equals(normalized), 'PCM changed');
    assert.equal(hash(fs.readFileSync(path.join(base, item.wavFile))), item.normalizedSha256);
    assert.equal(hash(fs.readFileSync(path.join(base, item.file))), item.mp3Sha256);
    const decoded = spawnSync('ffmpeg', ['-v', 'error', '-xerror', '-i', path.join(base, item.wavFile), '-f', 'null', 'NUL'], { encoding: 'utf8', windowsHide: true });
    assert.equal(decoded.status, 0, `${item.wavFile}: ${decoded.stderr}`);
    const measured = metrics(normalized);
    assert.ok(Math.abs(measured.samples / item.sampleRate / item.channels - item.durationSeconds) < 0.001);
    const transcriptName = `${collection.prefix}${item.id}.json`;
    const transcript = read(transcriptName);
    assert.equal(transcript.audioSha256, item.normalizedSha256, `${transcriptName}: stale audio`);
    assert.equal(transcript.expectedNarration, expected.narration, `${transcriptName}: stale narration`);
    const words = transcript.segments.flatMap(x => x.words);
    assert.ok(words.length > 0);
    for (const word of words) {
      assert.ok(word.start >= 0 && word.end >= word.start && word.end <= item.durationSeconds + 0.08, `${transcriptName}: invalid word time`);
    }
    records.push({ group: collection.group, id: item.id, wavFile: item.wavFile, durationSeconds: item.durationSeconds, ...measured, transcript: transcriptName, wordTimestamps: words.length, characterSimilarity: transcript.comparison.characterSimilarity, differences: transcript.comparison.differences });
  }
}
const report = { version: 1, status: 'technical-checks-passed-listening-not-performed', date: '2026-09-09', activeClips: records.length, originalPcmPreserved: true, normalizedDecodeErrors: 0, currentNarrationHashMatches: true, offlineTranscriptionComplete: true, humanListeningVerified: false, timestamps: 'automatic estimates from audio, not manually verified', notes: ['ASR 인식 오류와 실제 발음 오류를 동일시하지 않음', '문자 유사도는 음질·억양·교육 효과 점수가 아님', '현재 활성 파일은 음성명세.json/클리닉_음성명세.json 경로를 사용; 01 r1은 보존된 이전판'], records };
fs.writeFileSync(path.join(base, '음성기술검증.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ status: report.status, clips: records.length, durationSeconds: records.reduce((n, x) => n + x.durationSeconds, 0), maxPeakDbfs: Math.max(...records.map(x => x.peakDbfs)), fullScaleSamples: records.reduce((n, x) => n + x.fullScaleSamples, 0), wordTimestamps: records.reduce((n, x) => n + x.wordTimestamps, 0) }));
