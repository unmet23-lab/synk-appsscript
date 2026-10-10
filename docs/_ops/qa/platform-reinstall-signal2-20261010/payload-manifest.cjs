'use strict';
// 설치 뒤 대조용 payload 목록(76개)을 실제로 풀어 낸 설치 파일 payload에서 만든다.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),ex=path.join(root,'.tmp/platform-reinstall-signal2-20261010/platform/extracted-payload');
const all=(d,rel='')=>{const r=[];for(const e of fs.readdirSync(path.join(d,rel),{withFileTypes:true})){const f=path.join(rel,e.name);if(e.isDirectory())r.push(...all(d,f));else r.push(f.split(path.sep).join('/'));}return r.sort();};
const files=all(ex).map(p=>{const b=fs.readFileSync(path.join(ex,p));return {path:p,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};});
fs.writeFileSync(path.join(__dirname,'payload-manifest.json'),JSON.stringify({preparedAt:new Date().toISOString(),source:'Extracted NSIS payload of SYNK Platform Preview-0.4.0-win-x64.exe (8c563016…), equal to win-unpacked',files},null,2)+'\n');
console.log(files.length,files.find(f=>f.path==='resources/app.asar').sha256.slice(0,12));
