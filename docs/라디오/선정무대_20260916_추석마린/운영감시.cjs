'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const dir = __dirname;
const root = path.resolve(dir, '..', '..', '..');
const durationMinutes = Number(process.argv[2] || 9);
if (!Number.isFinite(durationMinutes) || durationMinutes < 2 || durationMinutes > 20) throw new Error('감시 시간은 2~20분');
const healthScript = path.join(root, 'tools/라디오방송건강.js');
const sshArgs = ['-i', path.join(os.homedir(), '.ssh', 'synk_radio'), '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=20', 'synk@34.71.111.97', 'node'];
const remoteCode = String.raw`
const cp=require('child_process'),fs=require('fs'),crypto=require('crypto');
const props=n=>Object.fromEntries(cp.execFileSync('systemctl',['show',n,'--property=MainPID,ActiveState,SubState,NRestarts,UnitFileState'],{encoding:'utf8'}).trim().split('\n').map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)];}));
const s=props('radio-live'),rs=props('radio-stream'),pids=[];const walk=pid=>{try{for(const x of cp.execFileSync('pgrep',['-P',String(pid)],{encoding:'utf8'}).trim().split('\n').filter(Boolean)){pids.push(x);walk(x);}}catch{}};if(s.MainPID&&s.MainPID!=='0')walk(s.MainPID);
const opened=[];for(const id of pids)try{for(const fd of fs.readdirSync('/proc/'+id+'/fd'))try{const f=fs.readlinkSync('/proc/'+id+'/fd/'+fd);if(f==='/opt/synk-radio/소리/synk-radio-blok11-20260909-gapless.flac'||f==='/opt/synk-radio/무대차례/chuseok-natural-20260909-v2.mp4')opened.push({pid:id,file:f});}catch{}}catch{}
const ffmpeg=cp.execFileSync('ps',['-C','ffmpeg','-o','pid,stat,etime,%cpu,comm','--no-headers'],{encoding:'utf8'}).trim();
const config=JSON.parse(fs.readFileSync('/opt/synk-radio/송출/조율.json','utf8'));
const progress=cp.execFileSync('journalctl',['-u','radio-live','-n','10','-o','cat','--no-pager'],{encoding:'utf8'}).split(/\r?\n/).filter(x=>x.includes('층 ')&&x.includes('방송시각')).slice(-2);
process.stdout.write(JSON.stringify({service:s,radioStream:rs,opened,ffmpeg,config,progress}));`;

function parseHealth(text) {
  const s = text.match(/받는 중\?\s*(\S+)\s*\|\s*건강\s*(\S+)/);
  const b = text.match(/방송 중 ([A-Za-z0-9_-]+)\s*\|\s*(.*?)\s*\|\s*(private|unlisted|public)\s*\|/);
  return { stream: s ? { status: s[1], health: s[2] } : null, broadcast: b ? { videoId: b[1], title: b[2], privacyStatus: b[3] } : null };
}

const result = { started: new Date().toISOString(), durationMinutes, expectedVideoId: 'eH0owfx9gCw', samples: [], passed: false };
const save = () => fs.writeFileSync(path.join(dir, '운영감시.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const end = Date.now() + durationMinutes * 60 * 1000;
  let restartsAtStart = null;
  let missedStartupGrace = false;
  while (Date.now() < end) {
    const sampleAt = Date.now();
    try {
      const healthText = execFileSync(process.execPath, [healthScript], { encoding: 'utf8', timeout: 45000, windowsHide: true });
      const health = parseHealth(healthText);
      const remote = JSON.parse(execFileSync('ssh', sshArgs, { input: remoteCode, encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024, windowsHide: true }));
      const sample = { at: new Date().toISOString(), ...health, ...remote };
      if (restartsAtStart === null && remote.service.ActiveState === 'active') restartsAtStart = Number(remote.service.NRestarts);
      const hasAudio = remote.opened.some(x => x.file.endsWith('synk-radio-blok11-20260909-gapless.flac'));
      const hasVideo = remote.opened.some(x => x.file.endsWith('chuseok-natural-20260909-v2.mp4'));
      sample.validConfig = remote.config.프레임 === 12 && remote.config.뜨기 === 4 && remote.config.소리목록 === '/opt/synk-radio/소리/playlist.txt' && remote.config.무대목록 === '/opt/synk-radio/무대차례/목록.txt';
      sample.running = remote.service.ActiveState === 'active' && remote.service.SubState === 'running' && hasAudio && hasVideo;
      sample.outputGood = health.stream?.status === 'active' && health.stream?.health === 'good' && health.broadcast?.videoId === result.expectedVideoId && health.broadcast?.privacyStatus === 'public';
      sample.noNewRestart = restartsAtStart !== null && Number(remote.service.NRestarts) === restartsAtStart;
      if (result.samples.length === 0 && !sample.outputGood) sample.startupGrace = true;
      else if (!sample.outputGood) missedStartupGrace = true;
      sample.clean = sample.running && sample.validConfig && sample.noNewRestart && (sample.outputGood || sample.startupGrace);
      result.samples.push(sample);
      if (!sample.clean) result.issues = true;
      console.log(JSON.stringify({ sample: result.samples.length, at: sample.at, stream: sample.stream, service: remote.service.ActiveState + '/' + remote.service.SubState, restarts: remote.service.NRestarts, ffmpeg: remote.ffmpeg, clean: sample.clean }));
    } catch (e) {
      result.samples.push({ at: new Date().toISOString(), error: e.message });
      result.issues = true;
      missedStartupGrace = true;
      console.log(JSON.stringify({ sample: result.samples.length, error: e.message }));
    }
    save();
    const wait = Math.min(60000 - (Date.now() - sampleAt), end - Date.now());
    if (wait > 0) await delay(wait);
  }
  result.finished = new Date().toISOString();
  result.baselineRestarts = restartsAtStart;
  result.passed = !result.issues && !missedStartupGrace && result.samples.length >= durationMinutes - 1;
  save();
  console.log(JSON.stringify({ passed: result.passed, started: result.started, finished: result.finished, sampleCount: result.samples.length, baselineRestarts: result.baselineRestarts, issues: result.issues || false }));
  if (!result.passed) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
