// 앞면 「오늘 할 일」 카드의 대사는 구운 녹음만 튼다(2026-11-25 유호님 「응, 둘 다 바꿔」 — 기기 음성을 쓰지 않는다).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SAY} from '../experiences/world-front/says.mjs';
import {makeSayPlayer, WAIT_MS} from '../experiences/world-front/say-player.mjs';
import {itemOf} from '../experiences/synk-world-app/world-front-entry.mjs';
import {LESSONS} from '../experiences/synk-world-app/life-content.mjs';

const FRONT = new URL('../experiences/world-front/', import.meta.url);
const files = fs.readdirSync(new URL('assets/say/', FRONT)).sort();

test('카드에 뜨는 대사는 모두 녹음이 있다', () => {
  const shown = new Set();
  for (const lesson of LESSONS) for (const s of itemOf({id: lesson.id, lessonId: lesson.id, route: 'lesson', label: lesson.title}).says || []) shown.add(s);
  assert.ok(shown.size >= 20, '대사를 모으지 못함');
  assert.deepEqual([...shown].filter(s => !Object.hasOwn(SAY, s)), [], '녹음이 없는 대사');
  assert.deepEqual(Object.keys(SAY).filter(s => !shown.has(s)), [], '이제 뜨지 않는 대사');
});

test('표와 녹음 파일이 한 벌이다', () => {
  assert.deepEqual(files, Object.values(SAY).map(id => `${id}.mp3`).sort());
  assert.equal(new Set(Object.values(SAY)).size, Object.keys(SAY).length);
  for (const name of files) {
    const bytes = fs.readFileSync(new URL(`assets/say/${name}`, FRONT));
    assert.ok(bytes.length > 4000 && bytes.length < 80000, `${name} ${bytes.length}바이트`);
    assert.equal(bytes[0], 0xff, `${name}: 소리 앞에 태그가 있다`);
  }
});

test('혼자 여는 판(가짜 host)의 말은 실제 다리와 같은 레슨 원고다', () => {
  const src = fs.readFileSync(new URL('dev-host.mjs', FRONT), 'utf8');
  const rows = [...src.matchAll(/^\s*'([^']+)': \{[^\n]*?says: (\w+|\(\)) => \[([^\]]*)\]/gm)];
  assert.ok(rows.length >= 5, '가짜 host의 레슨 말을 찾지 못함');
  for (const [, title, arg, list] of rows) {
    assert.equal(arg, '()', `${title}: 말을 학생 정보로 짓지 않는다`);
    const lesson = LESSONS.find(l => l.title === title);
    assert.ok(lesson, `${title}: 레슨 원고에 없는 이름`);
    const says = [...list.matchAll(/'([^']*)'/g)].map(m => m[1]);
    assert.deepEqual(says, itemOf({id: lesson.id, lessonId: lesson.id, route: 'lesson', label: lesson.title}).says, title);
  }
});

// 대사 듣기 재생기를 가짜 Audio와 가짜 시계로 돌린다(검수 front-fix3-20261127 Fable P2 — 글자 대조만으로는 onplaying · clearTimeout을 지워도 통과했다).
function rig() {
  let t = 0, seq = 0; const q = [];
  const setT = (fn, ms) => { const id = ++seq; q.push({id, at: t + ms, fn}); return id; };
  const clearT = id => { const i = q.findIndex(x => x.id === id); if (i >= 0) q.splice(i, 1); };
  const run = ms => { const until = t + ms; for (;;) { q.sort((x, y) => x.at - y.at || x.id - y.id); if (!q.length || q[0].at > until) break; const x = q.shift(); t = x.at; x.fn(); } t = until; };
  const els = [];
  class FakeAudio {
    constructor() { this.src = ''; this.paused = true; this.ended = false; this.duration = NaN; this.currentTime = 0; this.pauses = 0; this.reject = false; els.push(this); }
    play() { this.paused = false; this.ended = false; return this.reject ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve(); }
    pause() { this.pauses++; if (this.paused) return; this.paused = true; setT(() => this.onpause?.(), 0); }   // 브라우저처럼 pause 사건은 늦게 온다
    fire(n) { this['on' + n]?.(); }
    start(duration) { this.duration = duration; this.currentTime = 0; this.fire('playing'); }
    finish() { this.currentTime = this.duration; this.ended = true; this.paused = true; this.fire('pause'); this.fire('ended'); }   // 끝까지 들으면 pause 다음 ended
  }
  const ends = [];
  const p = makeSayPlayer({newAudio: () => new FakeAudio(), setT, clearT});
  const play = (src, tag = src) => p.play(src, how => ends.push(`${tag}:${how}`));
  return {p, play, run, els, ends, el: () => els[0]};
}
const tick = () => new Promise(r => setImmediate(r));

test('대사 듣기 — 끝까지 들으면 한 번만 done이고, 뒤늦은 개는 짖지 않는다', async () => {
  const r = rig(); r.play('a.mp3'); r.run(300); r.el().start(1.5); r.run(1500); r.el().finish(); r.run(60000); await tick();
  assert.deepEqual(r.ends, ['a.mp3:done']);
  assert.equal(r.els.length, 1, 'Audio 하나를 돌려 쓴다');
});

test('대사 듣기 — 못 받으면(404) 바로 fail 한 번, 받기 전에 멎으면 8초째에 fail', async () => {
  const r = rig(); r.play('a.mp3'); r.el().fire('error'); r.run(60000); await tick();
  assert.deepEqual(r.ends, ['a.mp3:fail']);
  const s = rig(); s.play('b.mp3'); s.run(WAIT_MS - 1);
  assert.deepEqual(s.ends, [], '8초 전에는 끊지 않는다');
  s.run(1); assert.deepEqual(s.ends, ['b.mp3:fail']);
  assert.ok(s.el().pauses >= 1, '못 받은 소리는 멈춘다');
});

test('대사 듣기 — 느린 망에서 늦게 시작해도 끊지 않고, 재생 중 멎으면 남은 길이 + 8초째에 fail', async () => {
  const r = rig(); r.play('a.mp3'); r.run(6000); r.el().start(2); r.run(3000);
  assert.deepEqual(r.ends, [], '시작하면 남은 길이 + 8초로 다시 잰다');
  r.el().finish(); assert.deepEqual(r.ends, ['a.mp3:done']);
  const s = rig(); s.play('b.mp3'); s.el().start(2); s.run(2000 + WAIT_MS - 1);
  assert.deepEqual(s.ends, []);
  s.run(1); assert.deepEqual(s.ends, ['b.mp3:fail']);
});

test('대사 듣기 — 다른 말을 누르면 앞 말은 알리지 않고 앞 타이머 · 늦은 pause가 새 말을 끊지 않는다', async () => {
  const r = rig(); r.play('a.mp3'); r.el().start(3); r.run(500);
  r.play('b.mp3'); r.run(0); r.el().start(1); r.run(20000); await tick();
  assert.deepEqual(r.ends, ['b.mp3:fail'], '새 말은 멎으면 제 개로만 끝난다');
  const s = rig(); s.play('a.mp3'); s.el().start(3); s.play('b.mp3'); s.run(10); s.el().start(1); s.run(900); s.el().finish(); s.run(60000);
  assert.deepEqual(s.ends, ['b.mp3:done']);
});

test('대사 듣기 — 재생 중 기기가 멈추면(전화 · 이어폰 뺌) 알림 없이 stopped, 멈춤은 조용하다', async () => {
  const r = rig(); r.play('a.mp3'); r.el().start(3); r.run(1000); r.el().paused = true; r.el().fire('pause'); r.run(60000);
  assert.deepEqual(r.ends, ['a.mp3:stopped']);
  const s = rig(); s.play('a.mp3'); s.el().start(3); s.p.stop(); s.run(60000); await tick();
  assert.deepEqual(s.ends, [], 'stop은 알리지 않는다');
});

test('대사 듣기 — 재생이 막히면(play 거부) fail', async () => {
  const r = rig(); r.play('x', 'warm'); r.el().fire('error'); r.el().reject = true; r.play('a.mp3'); await tick(); r.run(60000);
  assert.deepEqual(r.ends, ['warm:fail', 'a.mp3:fail']);
});

test('앞면 speakKo는 fail에만 알리고, 그 글은 영어 · 몽골어 표에 있다', async () => {
  const src = fs.readFileSync(new URL('app.mjs', FRONT), 'utf8'), line = '소리를 불러오지 못했어요. 다시 눌러 주세요.';
  const speak = src.slice(src.indexOf('function speakKo('), src.indexOf('\n}\n', src.indexOf('function speakKo(')));
  assert.ok(speak.includes('SAYER.play('), 'say-player로 튼다');
  assert.ok(speak.includes(`if (how === 'fail') toast(ui('${line}'));`), 'fail일 때만 알림');
  const {T} = await import('../experiences/world-front/strings.mjs');
  for (const lang of ['en', 'mn']) assert.ok(T[lang][line], `${lang} 번역`);
});

test('앞면은 기기 음성을 쓰지 않는다', () => {
  for (const name of ['app.mjs', 'club.mjs', 'say-player.mjs', 'index.html']) assert.doesNotMatch(fs.readFileSync(new URL(name, FRONT), 'utf8'), /speechSynthesis|SpeechSynthesisUtterance/, name);
});
