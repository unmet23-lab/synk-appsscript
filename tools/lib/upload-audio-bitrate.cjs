'use strict';
const { execFile, spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { createInterface } = require('node:readline');
const { promisify } = require('node:util');
const execute = promisify(execFile);
const ENCODING_TARGET_BPS = 384000;
const minimumBps = channels => Number(channels) === 1 ? 128000 : 320000;
const streamBps = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const hasInspectionHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);

function uploadBitrateProblem(tracks) {
  if (!Array.isArray(tracks) || !tracks.length) return '오디오 트랙이 없어 게시용 비트레이트를 확인할 수 없습니다.';
  for (const [i, entry] of tracks.entries()) {
    const track = entry || {};
    const floor = minimumBps(track.channels);
    if (streamBps(track.actualBps) >= floor) continue;
    const name = Number(track.channels) === 1 ? '모노' : '스테레오·다채널';
    const rate = streamBps(track.actualBps) === null ? '측정 불가' : track.actualBps / 1000 + 'kbps';
    return `오디오 ${i + 1} 실측 ${rate}. 게시 통과 기준은 ${name} ${floor / 1000}kbps 이상이며, 기본 인코딩 목표는 ${ENCODING_TARGET_BPS / 1000}kbps입니다.`;
  }
  return null;
}

// 스트림 평균이 없는 컨테이너는 그 오디오 트랙의 압축 패킷만 센다. 프라이밍도 같은 시간 구간에 포함한다.
async function measureStreamBitrate(file, ffprobe, metadataRate, index = 0) {
  const known = streamBps(metadataRate);
  if (known !== null) return { actualBps: known, measurement: 'stream' };
  const probe = spawn(ffprobe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-select_streams', 'a:' + index, '-show_packets',
    '-show_entries', 'packet=pts_time,duration_time,size', '-of', 'csv=p=0', file],
  { windowsHide: true, timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] });
  let bytes = 0, start = Infinity, end = -Infinity, valid = true;
  probe.stderr.on('data', () => { valid = false; });
  const read = async () => {
    for await (const line of createInterface({ input: probe.stdout, crlfDelay: Infinity })) {
      if (!line.trim()) continue;
      const [pts, duration, size] = line.split(',', 3).map(v => v.trim() ? Number(v) : NaN);
      if (!Number.isFinite(pts) || !Number.isFinite(duration) || duration <= 0 || !Number.isSafeInteger(size) || size <= 0) { valid = false; continue; }
      bytes += size;
      start = Math.min(start, pts);
      end = Math.max(end, pts + duration);
    }
  };
  const [[code]] = await Promise.all([once(probe, 'close'), read()]);
  const actualBps = code === 0 && valid && end > start ? Math.floor(bytes * 8 / (end - start)) : null;
  return { actualBps, measurement: actualBps === null ? null : 'packets' };
}

async function measureTracks(file, ffprobe, streams) {
  const tracks = [];
  for (const [i, stream] of streams.entries()) {
    tracks.push({ channels: Number(stream.channels) || null, ...await measureStreamBitrate(file, ffprobe, stream.bit_rate, i) });
  }
  return tracks;
}

async function probeUploadTracks(file) {
  const ffprobe = process.env.SYNK_FFPROBE_EXE || 'ffprobe';
  const { stdout, stderr } = await execute(ffprobe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-select_streams', 'a',
    '-show_entries', 'stream=channels,bit_rate', '-of', 'json', file], { windowsHide: true, timeout: 180000 });
  if (stderr.trim()) throw Error('FFprobe가 오디오 스트림을 읽지 못했습니다.');
  return measureTracks(file, ffprobe, JSON.parse(stdout).streams);
}

// 두 동기 호출자(예약 계획·큐)가 패킷을 직접 메모리에 모으지 않고 같은 측정을 재사용한다.
function probeUploadProblemSync(file) {
  const probe = spawnSync(process.execPath, [__filename, file], { encoding: 'utf8', windowsHide: true, timeout: 185000 });
  if (probe.status === 0) {
    try { return uploadBitrateProblem(JSON.parse(probe.stdout)); } catch { /* 불완전한 측정은 예약을 막는다. */ }
  }
  return '게시용 오디오 비트레이트를 측정할 수 없다 — 다시 검사';
}

module.exports = { ENCODING_TARGET_BPS, minimumBps, streamBps, hasInspectionHash, uploadBitrateProblem, measureStreamBitrate, measureTracks, probeUploadTracks, probeUploadProblemSync };

// 동기 API인 예약 계획에서도 동일한 패킷 측정을 사용한다.
if (require.main === module) probeUploadTracks(process.argv[2]).then(tracks => console.log(JSON.stringify(tracks))).catch(error => {
  console.error(error.message); process.exitCode = 1;
});
