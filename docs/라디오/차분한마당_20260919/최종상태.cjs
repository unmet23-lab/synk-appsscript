'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const dir = __dirname;
const root = path.resolve(dir, '..', '..', '..');
const health = execFileSync(process.execPath, [path.join(root, 'tools/라디오방송건강.js')], {
  encoding: 'utf8', timeout: 45000, windowsHide: true,
});
const code = String.raw`
const cp=require('child_process'),fs=require('fs');
const props=name=>Object.fromEntries(cp.execFileSync('systemctl',['show',name,'--property=MainPID,ActiveState,SubState,NRestarts,UnitFileState'],{encoding:'utf8'}).trim().split('\n').map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)];}));
const s=props('radio-live'),rs=props('radio-stream');
const ffmpeg=cp.execFileSync('ps',['-C','ffmpeg','-o','pid,stat,etime,%cpu,%mem,comm','--no-headers'],{encoding:'utf8'}).trim();
const pids=[];const walk=pid=>{try{const xs=cp.execFileSync('pgrep',['-P',String(pid)],{encoding:'utf8'}).trim().split('\n').filter(Boolean);for(const x of xs){pids.push(x);walk(x);}}catch{}};if(s.MainPID&&s.MainPID!=='0')walk(s.MainPID);
const opened=[];for(const pid of pids)try{for(const fd of fs.readdirSync('/proc/'+pid+'/fd'))try{const f=fs.readlinkSync('/proc/'+pid+'/fd/'+fd);if(f==='/opt/synk-radio/무대차례/calm-courtyard-20260919-94a62941c16d.mp4'||f==='/opt/synk-radio/소리/synk-radio-blok11-20260909-gapless.flac')opened.push({pid,file:f});}catch{}}catch{}
const progress=cp.execFileSync('journalctl',['-u','radio-live','-n','12','-o','cat','--no-pager'],{encoding:'utf8'}).split(/\r?\n/).filter(x=>x.includes('층 ')&&x.includes('방송시각')).slice(-4);
process.stdout.write(JSON.stringify({service:s,radioStream:rs,ffmpeg,opened,progress}));`;
const remote = JSON.parse(execFileSync('ssh', [
  '-i', path.join(os.homedir(), '.ssh', 'synk_radio'), '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', 'synk-radio', 'node',
], { input: code, encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024, windowsHide: true }));
const live = health.match(/방송 중 ([A-Za-z0-9_-]+)\s*\|\s*(.*?)\s*\|\s*(private|unlisted|public)\s*\|/);
const stream = health.match(/받는 중\?\s*(\S+)\s*\|\s*건강\s*(\S+)/);
const result = {
  at: new Date().toISOString(),
  broadcast: live ? { videoId: live[1], title: live[2], privacyStatus: live[3] } : null,
  stream: stream ? { status: stream[1], health: stream[2] } : null,
  service: remote.service,
  radioStream: remote.radioStream,
  ffmpeg: remote.ffmpeg,
  opened: remote.opened,
  recentProgress: remote.progress,
};
if (!result.stream || result.stream.status !== 'active' || result.stream.health !== 'good') throw new Error('최종 YouTube 송출 상태가 active/good이 아니다: ' + health);
if (!result.broadcast || result.broadcast.privacyStatus !== 'public') throw new Error('현재 공개 방송 자리를 읽지 못했다: ' + health);
if (remote.service.ActiveState !== 'active' || remote.service.SubState !== 'running') throw new Error('radio-live가 실행 중이 아니다');
fs.writeFileSync(path.join(dir, '최종상태.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(result, null, 2));
