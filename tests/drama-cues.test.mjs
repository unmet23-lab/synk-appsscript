// 1화 자막 규칙(결정 2026-11-05 · docs/디자인/드라마_장면/README.md)이 대사 표에서 지켜지는지 잰다. 화면 쪽은 experiences/drama/qa/자막시험.mjs가 실제 브라우저로 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import PILOT,{SUB_CUES} from '../experiences/drama/pilot/content.mjs';

const lesson=JSON.parse(fs.readFileSync(new URL('../experiences/drama/pilot/world-lesson.json',import.meta.url),'utf8')).lesson;
// 넷플릭스 한국어 자막의 셈: 한글 1, 라틴 · 숫자 · 공백 · 문장부호 0.5. 한 줄 16, 두 줄까지.
const unit=s=>[...s].reduce((n,c)=>n+(/[\s.,?!…'"·«»A-Za-z0-9]/.test(c)?0.5:1),0);
const MAX_UNITS=32,MIN_SECONDS=1.2,MIN_SHOWN=1.5,MAX_LATIN_PER_SECOND=20;
const rowsOf=c=>c.text.split('\n');
const actors=PILOT.scene.filter(x=>x.type==='actor');

test('선배 대사는 모두 화면으로 나뉘어 있고 글은 본디 대사 그대로다',()=>{
 assert.equal(actors.length,4);
 for(const a of actors){
  assert.ok(a.cues?.length>=2,`${a.id}: 화면이 나뉘지 않았다 — 시각을 잰 소리 파일(${SUB_CUES[a.id]?.media})이 바뀌었으면 시각표를 다시 잰다`);
  assert.equal(a.cues.map(c=>c.text.replace(/\n/g,' ')).join(' '),a.text,a.id);
  assert.equal(a.cues[0].at,0,a.id);
 }
});

test('한 화면에 한국어 두 줄까지, 줄마다 한 줄 안에 들어간다',()=>{
 for(const a of actors)for(const c of a.cues){
  assert.ok(unit(c.text.replace(/\n/g,' '))<=MAX_UNITS,`${a.id}: 두 줄을 넘는다 — ${c.text}`);
  assert.ok(rowsOf(c).length<=2,`${a.id}: 세 줄 이상 — ${c.text}`);
  for(const row of rowsOf(c))if(rowsOf(c).length>1)assert.ok(unit(row)<=16,`${a.id}: 묶은 화면의 한 줄이 넘친다 — ${row}`);
 }
});

test('화면은 읽을 만큼 떠 있다: 짧으면 옆 문장과 묶고, 뜻은 초당 20자 안에서 읽힌다',()=>{
 for(const a of actors){
  const {cues,end}=SUB_CUES[a.id];
  cues.forEach((c,i)=>{
   const to=cues[i+1]?.at??end,shown=Math.max(to-c.at,MIN_SHOWN);   // 마지막 화면은 소리가 끝나도 1.5초를 채운다(pilot.mjs CUE_MIN_MS)
   assert.ok(to>c.at,`${a.id}: 시각이 차례가 아니다`);
   if(cues[i+1])assert.ok(to-c.at>=MIN_SHOWN,`${a.id}: ${(to-c.at).toFixed(2)}초 — 1.5초가 안 되면 옆 문장과 묶는다: ${c.text}`);
   else assert.ok(to-c.at>=MIN_SECONDS,`${a.id}: 마지막 화면의 소리가 너무 짧다 — ${c.text}`);
   for(const key of ['meaning','meaningMn']){
    assert.ok(c[key],`${a.id}: ${key} 없음`);
    const rate=c[key].length/shown;
    assert.ok(rate<=MAX_LATIN_PER_SECOND,`${a.id}: ${key} 초당 ${rate.toFixed(1)}자 — ${c[key]}`);
   }
  });
 }
});

test('화면용 강의에도 같은 시각표가 실린다(시각을 잰 파일과 짝이 맞을 때만)',()=>{
 for(const item of lesson.scene.filter(x=>x.type==='actor')){
  assert.deepEqual(item.cues,SUB_CUES[item.id].cues,item.id);
  assert.ok(String(item.video||item.audio).endsWith(`/${SUB_CUES[item.id].media}`),item.id);
 }
});

test('시범판은 나눈 화면을 소리 시각으로 따라가고, 소리가 안 나면 대사를 통째로 보인다',()=>{
 const pilot=fs.readFileSync(new URL('../experiences/drama/pilot/pilot.mjs',import.meta.url),'utf8');
 assert.match(pilot,/followCues\(item\.cues,\s*item\.video \? ui\.reply : ui\.voice,\s*start\)/);
 assert.match(pilot,/const CUE_MIN_MS = 1500/);
 assert.match(pilot,/if \(cues\) subs\(item\.text, meaningOf\(item\), 'Taeo', null, meaningLang\(item\)\)/);
 const css=fs.readFileSync(new URL('../experiences/drama/pilot/pilot.css',import.meta.url),'utf8');
 assert.ok(!/bottom:[^;]*42%/.test(css),'자막을 화면 가운데에 묶는 옛 규칙이 돌아왔다');
 assert.ok(!/\.stage \{[^}]*height: 74%/.test(css),'영상이 글자 자리까지 내려오는 옛 높이가 돌아왔다');
});
