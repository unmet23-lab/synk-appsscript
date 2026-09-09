#!/usr/bin/env node
'use strict';

// 공식 Higgsfield CLI. 기존 보유 크레딧으로만 실행하며 결제·구독·복제 음성을 만들지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const base = __dirname;
const voice = { provider: 'Higgsfield', model: 'qwen_audio_tts', preset: 'Kevin', voiceId: 'f1373f24-3b96-433f-9a68-e595810ef608', voiceType: 'preset', language: 'ko', synthetic: true, userVoiceImitation: false };
const sampleText = '안녕하세요. 오늘은 내 일이 누구에게 무엇을 남기는지, 소개 문장 하나로 정리해보겠습니다. 먼저 화면의 예시를 보세요. 가상의 1인 편집자 사례입니다.';
const instruction = '차분하고 명확한 한국어 온라인 수업 안내로 읽습니다. 과장된 광고 말투나 배경음 없이, 문장 사이에 자연스러운 호흡을 둡니다. 주어진 원고만 읽고 설명을 추가하지 않습니다.';
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const json = (name) => JSON.parse(fs.readFileSync(path.join(base, name), 'utf8'));
const save = (name, value) => fs.writeFileSync(path.join(base, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${cmd} failed (exit ${result.status}): ${result.stderr.slice(-800)}`);
  return result.stdout;
}
function urls(value, prefix = '') {
  if (typeof value === 'string') return /^https:\/\//.test(value) ? [{ key: prefix, url: value }] : [];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, v]) => urls(v, `${prefix}.${key}`));
}
function probe(file) {
  const data = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', file]));
  const audio = data.streams[0];
  return { durationSeconds: Number(data.format.duration), sampleRate: Number(audio.sample_rate), channels: audio.channels, codec: audio.codec_name };
}
function pcmBytes(file) {
  const data = fs.readFileSync(file);
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Expected RIFF WAVE');
  let offset = 12;
  while (offset + 8 <= data.length) {
    const kind = data.toString('ascii', offset, offset + 4);
    const length = data.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (kind === 'data') return data.subarray(start, Math.min(start + length, data.length));
    offset = start + length + (length % 2);
  }
  throw new Error('WAV data chunk not found');
}
function normalize(record, stem) {
  const sourceFile = `${stem}.source.wav`;
  const wavFile = `${stem}.wav`;
  const mp3File = `${stem}.mp3`;
  // 서비스의 길이 미정 WAV 헤더를 보존하고, 같은 PCM에 정상 헤더를 붙인다.
  if (!fs.existsSync(path.join(base, sourceFile))) fs.renameSync(path.join(base, wavFile), path.join(base, sourceFile));
  run('ffmpeg', ['-y', '-v', 'error', '-i', path.join(base, sourceFile), '-codec:a', 'pcm_s16le', path.join(base, wavFile)]);
  if (!pcmBytes(path.join(base, sourceFile)).equals(pcmBytes(path.join(base, wavFile)))) throw new Error(`${stem}: PCM changed during container normalization`);
  run('ffmpeg', ['-v', 'error', '-xerror', '-i', path.join(base, wavFile), '-f', 'null', 'NUL']);
  run('ffmpeg', ['-y', '-v', 'error', '-i', path.join(base, wavFile), '-codec:a', 'libmp3lame', '-q:a', '2', path.join(base, mp3File)]);
  const canonical = probe(path.join(base, wavFile));
  const converted = probe(path.join(base, mp3File));
  return { ...record, file: mp3File, wavFile, originalFile: sourceFile, durationSeconds: canonical.durationSeconds, sampleRate: canonical.sampleRate, channels: canonical.channels, originalCodec: canonical.codec, mp3DurationSeconds: converted.durationSeconds, originalSha256: hash(fs.readFileSync(path.join(base, sourceFile))), normalizedSha256: hash(fs.readFileSync(path.join(base, wavFile))), mp3Sha256: hash(fs.readFileSync(path.join(base, mp3File))), pcmPreserved: true, normalizedDecodeVerified: true, containerNote: 'Provider streaming-size WAV retained as .source.wav; canonical .wav has proper header and byte-identical PCM.' };
}
async function create(id, narration) {
  const stem = id === 'sample' ? 'sample-kevin' : id.startsWith('clinic-') ? id : `chapter-${id}`;
  const jobFile = `${stem}-job.json`;
  const wavFile = `${stem}.wav`;
  const mp3File = `${stem}.mp3`;
  const narrationSha256 = hash(narration);
  if (fs.existsSync(path.join(base, jobFile))) {
    const previous = json(jobFile);
    if (previous.narrationSha256 !== narrationSha256) throw new Error(`${stem}: narration changed; explicit revision name is required`);
    if (previous.status === 'completed' && fs.existsSync(path.join(base, wavFile)) && fs.existsSync(path.join(base, mp3File))) {
      if (previous.pcmPreserved) return previous;
      const normalized = normalize(previous, stem);
      save(jobFile, normalized);
      return normalized;
    }
  }
  let response;
  if (fs.existsSync(path.join(base, jobFile)) && json(jobFile).jobId) {
    response = JSON.parse(run('higgsfield', ['generate', 'get', json(jobFile).jobId, '--json']));
  } else {
    const result = run('higgsfield', ['generate', 'create', 'qwen_audio_tts', '--prompt', narration, '--voice-id', voice.voiceId, '--voice-type', 'preset', '--language', 'ko', '--format', 'wav', '--sample-rate', '24000', '--instruction', instruction, '--wait', '--wait-timeout', '10m', '--json']);
    response = JSON.parse(result);
  }
  const job = Array.isArray(response) ? response[0] : response;
  const jobId = job.id || job.job_id;
  save(jobFile, { id, jobId, status: job.status, voice, narration, narrationSha256, instruction, responseTopLevelKeys: Object.keys(job) });
  const candidates = urls(job).filter((x) => /\.(wav|mp3)(\?|$)/i.test(x.url));
  const selected = candidates.find((x) => /\.wav(\?|$)/i.test(x.url)) || candidates[0];
  if (!selected) throw new Error(`${stem}: no audio URL found; saved job id and keys for read-only inspection`);
  const fetched = await fetch(selected.url);
  if (!fetched.ok) throw new Error(`${stem}: media download HTTP ${fetched.status}`);
  const data = Buffer.from(await fetched.arrayBuffer());
  fs.writeFileSync(path.join(base, wavFile), data);
  const original = probe(path.join(base, wavFile));
  if (!original.codec.startsWith('pcm_')) throw new Error(`${stem}: requested WAV is not PCM; inspect before conversion`);
  run('ffmpeg', ['-y', '-v', 'error', '-i', path.join(base, wavFile), '-codec:a', 'libmp3lame', '-q:a', '2', path.join(base, mp3File)]);
  const converted = probe(path.join(base, mp3File));
  const record = { id, jobId, status: 'completed', voice, narration, narrationSha256, instruction, file: mp3File, originalFile: wavFile, durationSeconds: original.durationSeconds, sampleRate: original.sampleRate, channels: original.channels, originalCodec: original.codec, mp3DurationSeconds: converted.durationSeconds, originalSha256: hash(data), mp3Sha256: hash(fs.readFileSync(path.join(base, mp3File))), audioSourceField: selected.key, generatedMediaHost: new URL(selected.url).hostname, humanListeningVerified: false };
  const normalized = normalize(record, stem);
  save(jobFile, normalized);
  return normalized;
}
async function main() {
  if (process.argv.includes('--sample')) {
    const result = await create('sample', sampleText);
    save('샘플명세.json', { version: 1, voice, ...result });
    console.log(JSON.stringify({ id: result.id, status: result.status, file: result.file, durationSeconds: result.durationSeconds }));
    return;
  }
  if (process.argv.includes('--revision-01')) {
    const sourcePath = path.resolve(base, '../../원고/콘텐츠원고.json');
    const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const chapter = source.lectures[0].chapters.find((x) => x.id === '01');
    if (!chapter.narration.startsWith('싱크 시프트의 공개 실습입니다.')) throw new Error('Approved phonetic revision missing');
    const result = await create('01-r2', chapter.narration);
    const manifest = json('음성명세.json');
    const index = manifest.chapters.findIndex((x) => x.id === '01');
    manifest.chapters[index] = { ...result, id: '01', audioId: '01-r2', title: chapter.title, pauseForPracticeSec: chapter.pauseForPracticeSec || 0, revisionReason: 'Approved spoken brand rendering SYNK SHIFT → 싱크 시프트; visual brand unchanged.' };
    manifest.sourceSha256 = hash(fs.readFileSync(sourcePath));
    manifest.totalNarrationSeconds = manifest.chapters.reduce((n, x) => n + x.durationSeconds, 0);
    save('음성명세.json', manifest);
    console.log(JSON.stringify({ id: '01', revision: 'r2', wavFile: result.wavFile, durationSeconds: result.durationSeconds, totalNarrationSeconds: manifest.totalNarrationSeconds }));
    return;
  }
  if (process.argv.includes('--chapters') || process.argv.includes('--clinic')) {
    if (!fs.existsSync(path.join(base, '샘플명세.json'))) throw new Error('Sample manifest required');
    const clinic = process.argv.includes('--clinic');
    const sourcePath = path.resolve(base, '../../원고/콘텐츠원고.json');
    const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const sourceItem = clinic ? source.extras[0] : source.lectures[0];
    const chapters = clinic ? sourceItem.scenes.map((x, i) => ({ ...x, id: String(i + 1).padStart(2, '0') })) : sourceItem.chapters;
    if (chapters.length !== (clinic ? 5 : 18)) throw new Error('Approved segment count changed');
    const manifestFile = clinic ? '클리닉_음성명세.json' : '음성명세.json';
    const manifest = { version: 1, voice, lectureId: sourceItem.id, sourceFile: '../../원고/콘텐츠원고.json', sourceSha256: hash(fs.readFileSync(sourcePath)), status: 'generating', humanListeningVerified: false, asrVerified: false, chapters: [] };
    save(manifestFile, manifest);
    for (const chapter of chapters) {
      const result = await create(clinic ? `clinic-${chapter.id}` : chapter.id, chapter.narration);
      manifest.chapters.push({ ...result, id: chapter.id, audioId: result.id, title: chapter.title, pauseForPracticeSec: chapter.pauseForPracticeSec || 0 });
      save(manifestFile, manifest);
      console.log(JSON.stringify({ chapter: chapter.id, durationSeconds: result.durationSeconds, file: result.wavFile, complete: manifest.chapters.length, total: chapters.length }));
    }
    manifest.status = 'generated-technical-qa-complete-listening-pending';
    manifest.totalNarrationSeconds = manifest.chapters.reduce((n, x) => n + x.durationSeconds, 0);
    manifest.totalPracticePauseSeconds = manifest.chapters.reduce((n, x) => n + x.pauseForPracticeSec, 0);
    save(manifestFile, manifest);
    console.log(JSON.stringify({ status: manifest.status, totalNarrationSeconds: manifest.totalNarrationSeconds, totalPracticePauseSeconds: manifest.totalPracticePauseSeconds }));
    return;
  }
  throw new Error('Use --sample first. Chapter production is enabled after sample inspection.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
