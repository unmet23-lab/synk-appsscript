'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm');
const dir=__dirname,sourceDir=path.join(dir,'..','정수리수정');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourcePath=path.join(sourceDir,'after-마스코트.html');
const source=fs.readFileSync(sourcePath,'utf8');
assert.equal(sha(source),'e305734b3a479d6402c7c7c2ad216362586ecb71749cc8740ee8c85455a3146d','현재 라이브 후보 HTML이 바뀌었다');
const before='body[data-radio-scene="13"] #마스코트틀 {left:23.6979166667vw!important;top:28.2407407407vh!important;width:30.2083333333vw!important;right:auto!important;bottom:auto!important;margin-left:0!important;transform-origin:43% 86.5234375%;}';
const after='body[data-radio-scene="13"] #마스코트틀 {left:34.0108235677vw!important;top:28.2407407407vh!important;width:30.2083333333vw!important;right:auto!important;bottom:auto!important;margin-left:0!important;transform-origin:43% 86.5234375%;}';
assert.equal(source.split(before).length,2,'배치 규칙을 하나만 찾아야 한다');
const html=source.replace('/* Selected 13 composition: preserve the approved 1920x1080 layout; no mascot auto-resize. */','/* Selected 13 composition: center the visible mascot silhouette; no mascot auto-resize. */').replace(before,after);
for(const [,code]of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(code);
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'after-마스코트.html'),html);
const sourceManifest=JSON.parse(fs.readFileSync(path.join(sourceDir,'manifest.json'),'utf8'));
const manifest={
  at:new Date().toISOString(),
  sourceHtml:'../정수리수정/after-마스코트.html',
  sourceHtmlSha:sha(source),
  htmlSha:sha(html),
  helperName:sourceManifest.helperName,
  helperSha:sourceManifest.helperSha,
  leafName:sourceManifest.leafName,
  leafSha:sourceManifest.leafSha,
  stageSha:'986177a55b4bb21ae4d82c483f1c66a92e14d2e48d7a441a7ab76bd0f7e98a65',
  audioSha:'c9295db33abc8609bda2cdbc885dfce563b52cb6cc6a9db49f7ec276bf931f45',
  layout:{canvas:[1920,1080],box:{left:653.0078125,top:305,size:580},visibleAlphaBounds:[97,118,987,996],visibleCenterX:960,shiftX:198.0078125},
  preserved:['세로 위치','마스코트 크기','표정 원본과 리듬','13번 배경','11곡 FLAC과 재생목록'],
  scope:'Only the selected scene 13 horizontal mascot position changes. The visible alpha silhouette, including the tail, is centered.'
};
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
