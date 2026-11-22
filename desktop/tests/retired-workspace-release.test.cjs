'use strict';
// 4단계 구현 설계 14.1: 따로 설치하는 Workspace 앱(messenger)을 거둔 뒤의 플랫폼 판. 바탕 설치본에 Workspace 설치 파일이 있어도 싣지 않고,
// 실행 정보의 판 목록에서 Workspace 줄을 모두 뺀다. WORLD 설치 파일은 그대로 옮겨 싣는다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {selectBundledChildren,BUNDLED_CHILDREN}=require('../tools/build-platform-release.cjs');
const {INSTALLABLE_CLIENTS}=require('../src/catalog.cjs');

const pin=(id,version,installer)=>({id,version,mode:'development',platform:'win32',arch:'x64',executableSHA256:'a'.repeat(64),asarSHA256:'b'.repeat(64),...(installer?{installer:{relativePath:id+'.exe',bytes:1,sha256:'c'.repeat(64)}}:{})});
// 0.5.6 설치본의 판 목록과 같은 꼴(WORLD · Workspace 0.4.69에 설치 파일, 그 앞 판은 승인만)
const baseline=()=>[pin('world','0.4.69',true),pin('messenger','0.4.69',true),pin('world','0.4.48'),pin('messenger','0.4.48'),pin('world','0.4.11'),pin('messenger','0.4.11'),pin('world','0.4.1'),pin('world','0.4.0'),pin('messenger','0.4.0'),pin('world','0.4.2')];

test('the platform ships the same children it can install: WORLD only',()=>{
  assert.deepEqual([...BUNDLED_CHILDREN],['world']);assert.deepEqual([...INSTALLABLE_CLIENTS],['world']);
});

test('a baseline that still bundles Workspace ships only the WORLD installer and keeps no Workspace row at all',()=>{
  const input=baseline(),copy=JSON.parse(JSON.stringify(input));
  const {children,releases}=selectBundledChildren(input);
  assert.deepEqual(children.map(row=>[row.id,row.version,row.installer.relativePath]),[['world','0.4.69','world.exe']]);
  assert.equal(releases.some(row=>row.id==='messenger'),false,'no Workspace installer or approval stays in runtime.json');
  assert.deepEqual(releases.map(row=>row.version),['0.4.69','0.4.48','0.4.11','0.4.1','0.4.0','0.4.2'],'every WORLD row stays in order');
  assert.deepEqual(input,copy,'the baseline list is not changed in place');
});

test('a later baseline without Workspace still works; a baseline without WORLD or with an unknown child stops the build',()=>{
  assert.deepEqual(selectBundledChildren([pin('world','0.5.0',true),pin('world','0.4.69')]).children.map(row=>row.version),['0.5.0']);
  for(const bad of [[pin('messenger','0.4.69',true)],[],[pin('world','0.4.69',true),pin('pulse','0.1.0',true)],[pin('world','0.4.69',true),pin('world','0.4.70',true)],undefined])
    assert.throws(()=>selectBundledChildren(bad),/Expected the WORLD child installer|Baseline releases missing/,JSON.stringify(bad));
});

test('the build uses the selection for the copy, the legacy pins and the Mac signing exception',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','tools','build-platform-release.cjs'),'utf8');
  assert.match(source,/\(\{children,releases:runtime\.releases\}=selectBundledChildren\(runtime\.releases\)\);/);
  // 공개 release-input의 additionalLegacyPins에는 Workspace 0.4.0 승인이 남아 있다. 받되 싣지 않는다
  assert.match(source,/assert\(!legacy\.installer&&\[\.\.\.BUNDLED_CHILDREN,\.\.\.RETIRED_CHILDREN\]\.includes\(legacy\.id\)/);
  assert.match(source,/if\(RETIRED_CHILDREN\.includes\(legacy\.id\)\|\|legacy\.platform!==platform\|\|legacy\.arch!==arch\)continue;/);
  assert.match(source,/signIgnore:\['\/Contents\/Resources\/clients\/world\\\\\.dmg\$'\]/);
  assert.doesNotMatch(source,/'messenger'\]\.includes|children\.some\(row=>row\.id==='messenger'\)/);
  assert.match(fs.readFileSync(path.join(__dirname,'..','tools','mac-icon-native-qa.cjs'),'utf8'),/for\(const client of \['platform','world'\]\)\{/);
});
