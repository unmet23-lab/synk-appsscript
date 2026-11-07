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
 assert.match(pilot,/requestAnimationFrame\(tick\)/,'자막 넘김은 그림마다 읽는다(timeupdate는 0.25초 늦을 수 있다)');
 assert.match(pilot,/media\.addEventListener\('timeupdate', onTime\); media\.addEventListener\('ended', onTime\)/,'탭을 옮겨 그림 틱이 멈춰도 소리 시각 · 끝 소식으로 넘긴다');
 assert.match(pilot,/const onTime = \(\) => \{ if \(!media\.paused \|\| media\.ended\) show/,'재생 위치가 0으로 돌아가는 불러오기 때의 timeupdate로 첫 화면을 그리지 않는다');
 assert.match(pilot,/unguard = endGuard\(m, s,/,'소리 재생에 끝 소식이 안 와도 잇는 안전 시계');
 assert.match(pilot,/if \(!m\.paused && !m\.ended && at > lastAt \+ 0\.5 && rearms < 4\) \{ lastAt = at; rearms\+\+; arm\(left\(\)\); return; \}/,'안전 시계: 아직 나아가는 재생(느린 망)은 남은 만큼 다시 기다린다');
 assert.match(pilot,/const near = m\.ended \|\| !\(left\(\) > 1\);[\s\S]{0,60}finish\(near\);/,'안전 시계: 멈춘 재생은 끝 근처일 때만 끝난 것으로, 아니면 통째 자막 길로');
 assert.match(pilot,/unguard = endGuard\(v, s,/,'영상 재생에 끝 소식이 안 와도 잇는 안전 시계');
 assert.match(pilot,/if \(go\) v\.removeEventListener\('loadedmetadata', go\)/,'접은 영상의 정보 받음 듣기를 뗀다');
 assert.match(pilot,/if \(settled \|\| gen !== playGen\) return;\r?\n   if \(S\.rec \|\| !live\(s\)\) \{ done\(false\); return; \}/,'늦게 온 정보 받음이 접힌 영상을 틀지 않고, 녹음 중 · 단계가 끝났으면 바로 접는다');
 assert.match(pilot,/const c = current; current = null; if \(c\) c\(\);/,'멈추면 살아 있던 재생을 바로 접는다(듣기를 떼고 약속을 푼다)');
 assert.equal((pilot.match(/if \(current === cancel\) current = null;/g)||[]).length,2,'두 재생 모두 자기가 살아 있는 재생일 때만 비운다');
 assert.equal((pilot.match(/if \(gen === playGen\) (?:setPlaying\(false\)|\{ try \{ v\.pause\(\); \} catch \{\} setPlaying\(false\); \})/g)||[]).length,2,'접힌 재생의 늦은 소식은 지금 소리를 멈추거나 재생 중을 풀지 않는다');
 assert.match(pilot,/function stopSound\(\) \{\r?\n playGen\+\+;/,'멈추면 앞 재생의 안전 시계를 끈다');
 assert.equal((pilot.match(/\(\) => settled \|\| gen !== playGen, done\)/g)||[]).length,2,'두 재생 모두 자기 번호일 때만 안전 시계가 멈춘다');
 assert.match(pilot,/delay: motion === 'pop' \|\| motion === 'cue' \? 150 :/,'넘어가는 화면은 뜻 줄을 첫 어절과 함께 띄운다(읽는 시간을 줄이지 않게)');
 assert.match(fs.readFileSync(new URL('../experiences/drama/pilot/pilot.css',import.meta.url),'utf8'),/@media \(max-width: 340px\) \{[^\n]*\.loop \{ object-position: 50% 22%; \}/,'좁은 폰의 얼굴 자리는 학생 차례 층에만(모드에 걸면 전환 때 사라지는 층이 튄다)');
 assert.match(pilot,/if \(cues\) subs\(item\.text, meaningOf\(item\), 'Taeo', null, meaningLang\(item\)\)/);
 const css=fs.readFileSync(new URL('../experiences/drama/pilot/pilot.css',import.meta.url),'utf8');
 assert.ok(!/bottom:[^;]*42%/.test(css),'자막을 화면 가운데에 묶는 옛 규칙이 돌아왔다');
 assert.match(css,/--dock-gap: max\(14px, env\(safe-area-inset-bottom\)\)/,'자막의 아래 띄움은 판과 같아야 한다');
 assert.match(css,/\.dock \{[^}]*bottom: max\(14px, env\(safe-area-inset-bottom\)\)/,'판의 아래 띄움이 바뀌면 --dock-gap도 바꾼다');
 assert.ok(!/\.stage \{[^}]*height: 74%/.test(css),'영상이 글자 자리까지 내려오는 옛 높이가 돌아왔다');
});
