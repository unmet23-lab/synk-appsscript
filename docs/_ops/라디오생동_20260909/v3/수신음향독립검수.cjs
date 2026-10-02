'use strict';
// 저장 완료된 실제 수신 파일만 읽는다. 별도 수신·서버 조작·사람 청취를 하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
// 인자 생략은 기존 v3 동작. 다른 수신본은 원본·완료 증거·결과 경로를 모두 지정한다.
const args = process.argv.slice(2);
if (args.length !== 0 && args.length !== 3) throw new Error('사용법: node 수신음향독립검수.cjs [원본.mp4 완료증거.json 결과.json]');
const source = args.length ? path.resolve(args[0]) : path.join(__dirname, '유튜브수신_새배경.mp4');
const receipt = args.length ? path.resolve(args[1]) : path.join(__dirname, '유튜브수신_새배경.json');
const output = args.length ? path.resolve(args[2]) : path.join(__dirname, '수신음향독립검수.json');
if ([source, receipt].some(input => input.toLowerCase() === output.toLowerCase())) throw new Error('결과 경로는 입력과 달라야 한다');
if (!fs.existsSync(receipt) || !fs.statSync(source).size) throw new Error('수신 완료 증거가 아직 없다');
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 40 * 1024 * 1024, timeout: 60000 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
  return result;
}
function probe(args) {
  const result = run('ffprobe', ['-v', 'warning', ...args, '-of', 'json', source]);
  return { data: JSON.parse(result.stdout), warnings: result.stderr.trim() };
}
const info = probe(['-select_streams', 'a:0', '-show_entries', 'stream=codec_name,sample_rate,channels,start_time,duration:format=duration']);
if (info.data.streams.length !== 1) throw new Error('음성 스트림 수 오류');
const stream = info.data.streams[0], sampleRate = Number(stream.sample_rate);
const packetProbe = probe(['-select_streams', 'a:0', '-show_packets', '-show_entries', 'packet=pts_time,dts_time,duration_time']);
const frameProbe = probe(['-select_streams', 'a:0', '-show_frames', '-show_entries', 'frame=pts_time,best_effort_timestamp_time,nb_samples']);
function continuity(rows, decoded) {
  let maxGap = 0, maxOverlap = 0, previousEnd, previousDts, totalSamples = 0;
  const events = [], dtsReversals = [];
  rows.forEach((row, index) => {
    const pts = Number(row.pts_time ?? row.best_effort_timestamp_time);
    const duration = decoded ? Number(row.nb_samples) / sampleRate : Number(row.duration_time);
    if (!Number.isFinite(pts) || !Number.isFinite(duration)) throw new Error('해석 불가능한 음성 시간');
    if (previousEnd !== undefined) {
      const difference = pts - previousEnd;
      maxGap = Math.max(maxGap, difference); maxOverlap = Math.max(maxOverlap, -difference);
      if (Math.abs(difference) > 0.0011) events.push({ index, pts, differenceSeconds: difference });
    }
    if (!decoded) {
      const dts = Number(row.dts_time);
      if (previousDts !== undefined && dts <= previousDts) dtsReversals.push({ index, dts, previousDts });
      previousDts = dts;
    }
    totalSamples += decoded ? Number(row.nb_samples) : 0;
    previousEnd = pts + duration;
  });
  return { count: rows.length, firstPtsSeconds: Number(rows[0]?.pts_time ?? rows[0]?.best_effort_timestamp_time), lastPtsSeconds: Number(rows.at(-1)?.pts_time ?? rows.at(-1)?.best_effort_timestamp_time), endSeconds: previousEnd, maxGapSeconds: maxGap, maxOverlapSeconds: maxOverlap, eventsAbove1_1ms: events, ...(decoded ? { totalSamples } : { dtsReversals }) };
}
const packets = continuity(packetProbe.data.packets, false);
const decoded = continuity(frameProbe.data.frames, true);
const silenceRun = run('ffmpeg', ['-hide_banner', '-nostats', '-i', source, '-map', '0:a:0', '-af', 'silencedetect=n=-45dB:d=0.003', '-f', 'null', '-']);
const silenceEvents = silenceRun.stderr.split(/\r?\n/).filter(line => /silence_(start|end|duration):/.test(line));
const decodeWarnings = run('ffmpeg', ['-hide_banner', '-v', 'warning', '-i', source, '-map', '0:a:0', '-f', 'null', '-']).stderr.trim();
const report = {
  observedAt: new Date().toISOString(), sourceFile: source,
  sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'), bytes: fs.statSync(source).size,
  codec: stream.codec_name, sampleRate, channels: stream.channels, durationSeconds: Number(stream.duration ?? info.data.format.duration),
  packets, decoded, probeWarnings: [info.warnings, packetProbe.warnings, frameProbe.warnings].filter(Boolean), decodeWarnings,
  silenceThresholdDb: -45, silenceMinimumSeconds: 0.003, silenceEvents, listeningPerformed: false,
  scope: 'Complete saved YouTube receiver sample only; not a full radio playlist cycle or a perceptual listening test.'
};
report.pass = !packets.eventsAbove1_1ms.length && !packets.dtsReversals.length && !decoded.eventsAbove1_1ms.length && !report.probeWarnings.length && !decodeWarnings && !silenceEvents.length;
report.conclusion = report.pass ? 'No packet/frame timing discontinuity above 1.1ms, non-increasing DTS, decoder warning, or silence of at least 3ms below -45dB was detected in this receiver sample.' : 'Potential discontinuities or warnings detected; inspect report before declaring continuity.';
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
