#!/usr/bin/env node
'use strict';
// 09-09 두 곡 추가. 기존 9곡 방송본의 음량은 유지하고 새 곡만 같은 평균 크기로 맞춘다.
// 곡 사이와 마지막→처음 모두 기존 6초 겹침 원칙을 유지한다. 서비스 재시작은 하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'output/radio-audio-20260909');
const previous = path.join(out, 'previous-blok9.aac');
const result = path.join(out, 'synk-radio-blok11-20260909-air.aac');
const reportPath = path.join(out, 'audio-verification.json');
const oldPlaylistHash = 'a02f329c92a5f4b1dbedecf84366a6c0b33196d209b0e286c7665e36312dc8fd';
const oldAudioHash = '12db68bb1b8f064ac632816ef6a187caea9ff5310806d3929fc1af9612ba8878';
const crossfade = 6;
const sources = [
  path.join(os.homedir(), 'Downloads/오늘 밤 제일 환한 사람.wav'),
  path.join(os.homedir(), "Downloads/The Phantom's Lament.wav"),
];
function run(exe, args, input) {
  const p = spawnSync(exe, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, input, windowsHide: true });
  if (p.status !== 0) throw new Error(`${exe} failed ${p.status}: ${p.error || ''}\n${(p.stderr || '').slice(-2400)}`);
  return p;
}
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ff = args => run('ffmpeg', ['-hide_banner', '-nostats', ...args]);
function probe(f) {
  return JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels,bit_rate', '-of', 'json', f]).stdout);
}
function loudness(f) {
  const log = ff(['-i', f, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']).stderr;
  const data = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
  return { integratedLufs: +data.input_i, truePeakDbtp: +data.input_tp, rangeLu: +data.input_lra };
}
function bandPeak(f) {
  const log = ff(['-i', f, '-af', 'highpass=f=2000,lowpass=f=8000,volumedetect', '-f', 'null', '-']).stderr;
  return { meanDb: +log.match(/mean_volume:\s*(-?[\d.]+)/)[1], peakDb: +log.match(/max_volume:\s*(-?[\d.]+)/)[1] };
}
function prep() {
  fs.mkdirSync(out, { recursive: true });
  if (hash(previous) !== oldAudioHash) throw new Error('Previous live audio hash differs');
  const baseline = { file: previous, sha256: hash(previous), probe: probe(previous), loudness: loudness(previous), highBand: bandPeak(previous) };
  console.log('baseline', baseline.loudness, baseline.highBand);
  const tracks = sources.map((file, i) => {
    const measured = loudness(file);
    // Constant gain preserves dynamics and timbre. Do not apply dynamic compression or EQ.
    const gainDb = +(baseline.loudness.integratedLufs - measured.integratedLufs).toFixed(2);
    const normalized = path.join(out, `new-${i + 1}-level.wav`);
    ff(['-v', 'error', '-y', '-i', file, '-map_metadata', '-1', '-af', `volume=${gainDb}dB`, '-c:a', 'pcm_s24le', '-ar', '44100', '-ac', '2', normalized]);
    const data = { file, sha256: hash(file), duration: +probe(file).format.duration, sourceLoudness: measured, gainDb, normalized, normalizedLoudness: loudness(normalized), highBand: bandPeak(normalized) };
    console.log('new track', path.basename(file), data.duration, gainDb, data.normalizedLoudness, data.highBand);
    return data;
  });
  const chain = path.join(out, 'chain.wav');
  const filter = [
    '[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=N/SR/TB[a0]',
    '[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=N/SR/TB[a1]',
    '[2:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=N/SR/TB[a2]',
    `[a0][a1]acrossfade=d=${crossfade}:c1=tri:c2=tri[x]`,
    `[x][a2]acrossfade=d=${crossfade}:c1=tri:c2=tri[out]`,
  ].join(';');
  ff(['-v', 'error', '-y', '-i', tracks[0].normalized, '-i', tracks[1].normalized, '-i', previous, '-filter_complex', filter, '-map', '[out]', '-map_metadata', '-1', '-c:a', 'pcm_s24le', '-ar', '44100', '-ac', '2', chain]);
  const chainDuration = +probe(chain).format.duration;
  const loop = path.join(out, 'loop-pcm.wav');
  const seam = [
    '[0:a]asplit=3[h][m][t]',
    `[h]atrim=0:${crossfade},asetpts=N/SR/TB[head]`,
    `[m]atrim=${crossfade}:${chainDuration - crossfade},asetpts=N/SR/TB[mid]`,
    `[t]atrim=start=${chainDuration - crossfade},asetpts=N/SR/TB[tail]`,
    `[tail][head]acrossfade=d=${crossfade}:c1=tri:c2=tri[join]`,
    '[mid][join]concat=n=2:v=0:a=1[out]',
  ].join(';');
  ff(['-v', 'error', '-y', '-i', chain, '-filter_complex', seam, '-map', '[out]', '-c:a', 'pcm_s24le', '-ar', '44100', '-ac', '2', loop]);
  // The pre-existing block has already been levelled and peak-limited. Do not loudnorm it again.
  ff(['-v', 'error', '-y', '-i', loop, '-map_metadata', '-1', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2', '-f', 'adts', result]);
  const finalLoudness = loudness(result);
  if (finalLoudness.truePeakDbtp >= 0) throw new Error(`Encoded output clips: ${finalLoudness.truePeakDbtp}`);
  const nullDecode = ff(['-v', 'error', '-i', result, '-f', 'null', '-']);
  if (nullDecode.stderr.trim()) throw new Error(`Decode warnings: ${nullDecode.stderr}`);
  const actualDuration = +probe(loop).format.duration;
  const silenceLog = ff(['-i', result, '-af', 'silencedetect=noise=-50dB:d=0.2', '-f', 'null', '-']).stderr;
  const silences = silenceLog.split(/\r?\n/).filter(line => /silence_start|silence_end/.test(line));
  const report = {
    createdAt: new Date().toISOString(), baseline, tracks,
    order: ['오늘 밤 제일 환한 사람', "The Phantom's Lament", 'existing 9-track radio block'],
    trackCountBefore: 9, trackCountAfter: 11, crossfadeSeconds: crossfade,
    durationSeconds: actualDuration, previousDecodedDurationSeconds: actualDuration - tracks.reduce((sum, t) => sum + t.duration, 0) + 3 * crossfade,
    output: { file: result, sha256: hash(result), bytes: fs.statSync(result).size, probe: probe(result), loudness: finalLoudness, highBand: bandPeak(result), decodeErrors: 0, silences },
    newTrackStartsSeconds: [0, tracks[0].duration - crossfade * 2],
    existingBlockStartsSeconds: tracks.reduce((sum, t) => sum + t.duration, 0) - crossfade * 3,
    notes: ['New tracks use constant gain only; the previous block receives no extra loudness normalization.', 'The first six seconds are crossfaded at the loop seam, as in the existing radio bake.', 'AAC duration from ffprobe is an estimate; durationSeconds is measured from the PCM render.'],
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
function deploy() {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (hash(result) !== report.output.sha256) throw new Error('Output changed after verification');
  const ssh = ['-i', path.join(os.homedir(), '.ssh/synk_radio'), '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15'];
  const remoteHost = 'synk@34.71.111.97';
  const remoteFile = `/opt/synk-radio/소리/${path.basename(result)}`;
  run('scp', [...ssh, result, `${remoteHost}:${remoteFile}.pending`]);
  const payload = { remoteFile, sha256: report.output.sha256, oldAudioHash, oldPlaylistHash };
  const installer = `
    const fs=require('fs'), crypto=require('crypto');
    const p=${JSON.stringify(payload)};
    const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    const playlist='/opt/synk-radio/소리/playlist.txt';
    if(hash(playlist)!==p.oldPlaylistHash) throw Error('Live playlist changed: refusing overwrite');
    if(hash('/opt/synk-radio/소리/synk-radio-blok9-air.aac')!==p.oldAudioHash) throw Error('Previous block changed');
    if(hash(p.remoteFile+'.pending')!==p.sha256) throw Error('Uploaded hash mismatch');
    const backup=playlist+'.before-20260909-blok11';
    fs.copyFileSync(playlist,backup,fs.constants.COPYFILE_EXCL);
    fs.renameSync(p.remoteFile+'.pending',p.remoteFile);
    const body="ffconcat version 1.0\\nfile '"+p.remoteFile.split('/').pop()+"'\\n";
    fs.writeFileSync(playlist+'.pending',body);
    fs.renameSync(playlist+'.pending',playlist);
    console.log(JSON.stringify({remoteFile:p.remoteFile,sha256:hash(p.remoteFile),playlist,backup,playlistContents:fs.readFileSync(playlist,'utf8'),serviceRestarted:false}));
  `;
  const installed = JSON.parse(run('ssh', [...ssh, remoteHost, 'node'], installer).stdout);
  report.deployment = { ...installed, installedAt: new Date().toISOString() };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(installed, null, 2));
}
if (process.argv.includes('--prepare')) prep();
else if (process.argv.includes('--deploy')) deploy();
else console.log('node tools/라디오곡추가_20260909.cjs --prepare | --deploy');
