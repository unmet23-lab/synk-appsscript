#!/usr/bin/env node
'use strict';
// 방송과 같은 concat + stream_loop + AAC stream-copy의 타임스탬프를 세 바퀴 확인한다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const folder = path.join(root, 'output/radio-audio-20260909/recheck');
const input = path.join(folder, '../synk-radio-blok11-20260909-air.aac');
const run = (exe, args) => {
  const p = spawnSync(exe, args, { encoding: 'utf8', maxBuffer: 192 * 1024 * 1024, windowsHide: true });
  if (p.status !== 0) throw Error(`${exe} exit=${p.status}\n${p.stderr?.slice(-2400)}`);
  return p;
};
if (process.argv.includes('--remote')) {
  const remote = `
    const {spawnSync}=require('child_process');
    const p=spawnSync('nice',['-n','19','ffmpeg','-hide_banner','-nostats','-v','warning','-f','concat','-safe','0','-stream_loop','2','-i','/opt/synk-radio/소리/playlist.txt','-map','0:a','-c:a','copy','-f','framemd5','-'],{encoding:'utf8',maxBuffer:64*1024*1024});
    if(p.status!==0) throw Error(p.stderr);
    const tb=p.stdout.match(/#tb 0:\\s*(\\d+)\\/(\\d+)/);
    const scale=Number(tb[1])/Number(tb[2]);
    const rows=p.stdout.split(/\\r?\\n/).filter(x=>/^0,/.test(x)).map(x=>x.split(',').slice(1,4).map(Number));
    const gaps=[];
    let maxGap=-Infinity;
    for(let i=1;i<rows.length;i++){const gap=(rows[i][0]-rows[i-1][0]-rows[i-1][2])*scale;maxGap=Math.max(maxGap,gap);if(Math.abs(gap)>0.01)gaps.push({index:i,before:rows[i-1].map(x=>x*scale),after:rows[i].map(x=>x*scale),gapSeconds:gap});}
    console.log(JSON.stringify({packetCount:rows.length,timebase:tb[1]+'/'+tb[2],first:rows[0].map(x=>x*scale),last:rows.at(-1).map(x=>x*scale),maxGapSeconds:maxGap,gaps,stderr:p.stderr}));
  `;
  const p = spawnSync('ssh', ['-i', path.join(require('os').homedir(), '.ssh/synk_radio'), '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'synk@34.71.111.97', 'node'], { input: remote, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, windowsHide: true });
  if (p.status !== 0) throw Error(p.stderr);
  const report = JSON.parse(p.stdout);
  fs.writeFileSync(path.join(folder, 'server-ffmpeg5-copy-3cycles-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}
function packetInfo(file) {
  const data = run('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_packets', '-show_entries', 'packet=pts_time,dts_time,duration_time', '-of', 'csv=p=0', file]).stdout;
  const rows = data.split(/\r?\n/).filter(x => x && /^[\d-]/.test(x)).map(x => x.split(',').slice(0, 3).map(Number));
  const discontinuities = [];
  let maxGap = -Infinity;
  for (let i = 1; i < rows.length; i++) {
    const delta = rows[i][0] - rows[i - 1][0];
    const gap = delta - rows[i - 1][2];
    if (gap > maxGap) maxGap = gap;
    if (Math.abs(gap) > 0.01) discontinuities.push({ index: i, before: rows[i - 1], after: rows[i], gapSeconds: gap });
  }
  return { packetCount: rows.length, first: rows[0], last: rows.at(-1), endTime: rows.at(-1)[0] + rows.at(-1)[2], maxGapSeconds: maxGap, discontinuities };
}
function frameInfo(file) {
  const data = run('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_frames', '-show_entries', 'frame=pts_time,best_effort_timestamp_time,nb_samples', '-of', 'csv=p=0', file]);
  const rows = data.stdout.split(/\r?\n/).filter(x => x && /^[\d-]/.test(x)).map(x => x.split(',').slice(0, 3).map(Number));
  const discontinuities = [];
  let maxGap = -Infinity;
  let totalSamples = 0;
  for (let i = 0; i < rows.length; i++) {
    totalSamples += rows[i][2];
    if (i === 0) continue;
    const gap = rows[i][0] - rows[i - 1][0] - rows[i - 1][2] / 44100;
    maxGap = Math.max(maxGap, gap);
    if (Math.abs(gap) > 0.01) discontinuities.push({ index: i, gapSeconds: gap });
  }
  return { frameCount: rows.length, totalSamples, first: rows[0], last: rows.at(-1), maxGapSeconds: maxGap, discontinuities, decodeWarnings: data.stderr };
}
const name = process.argv[2] || 'original';
const playlist = path.join(folder, name + '.ffconcat');
const continuous = process.argv.includes('--continuous');
const mode = continuous ? '-continuous' : '';
const output = path.join(folder, name + mode + '-3cycles.flv');
const codecArgs = continuous ? ['-af', 'asetpts=N/SR/TB', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2'] : ['-c:a', 'copy'];
const commandArgs = ['-hide_banner', '-nostats', '-loglevel', 'warning', '-y', '-f', 'concat', '-safe', '0', '-stream_loop', '2', '-i', playlist, '-map', '0:a', ...codecArgs, '-f', 'flv', output];
const result = process.argv.includes('--analyze') ? {stderr:'Existing completed render analyzed; see commandArgs for render recipe.'} : run('ffmpeg', commandArgs);
const sourceFile = name === 'original' ? input : path.join(folder, name + (name === 'gapless' ? '.flac' : '.m4a'));
const source = packetInfo(sourceFile);
const repeated = packetInfo(output);
const silenceCheck = run('ffmpeg', ['-hide_banner', '-nostats', '-i', output, '-af', 'silencedetect=noise=-45dB:d=0.005', '-f', 'null', '-']).stderr;
const report = {
  at: new Date().toISOString(), name, input, inputSha256: crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),
  sourceFile, sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex'), commandArgs,
  realtimeThrottleOmitted: 'No -re so three full cycles finish quickly; -re only paces demuxed timestamps.',
  stderr: result.stderr, source, repeated, decoded: frameInfo(output), continuous,
  silenceEvents: silenceCheck.split(/\r?\n/).filter(x => /silence_start|silence_end/.test(x)),
};
fs.writeFileSync(path.join(folder, name + mode + '-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
