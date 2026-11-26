// 앞면 「오늘 할 일」 카드의 대사는 구운 녹음만 튼다(2026-11-25 유호님 「응, 둘 다 바꿔」 — 기기 음성을 쓰지 않는다).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SAY} from '../experiences/world-front/says.mjs';
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

test('녹음을 못 받으면 한 줄로 알리고, 그 글은 영어 · 몽골어 표에 있다', async () => {
  const src = fs.readFileSync(new URL('app.mjs', FRONT), 'utf8'), line = '소리를 불러오지 못했어요. 다시 눌러 주세요.';
  const speak = src.slice(src.indexOf('function speakKo('), src.indexOf('\n}\n', src.indexOf('function speakKo(')));
  assert.match(speak, new RegExp(`toast\\(ui\\('${line.replace(/[.]/g, '\\.')}'\\)\\)`), '실패 때 알림');
  assert.match(speak, /dog\(8000\)/, '받다가 멎으면 8초 뒤 끝맺음');
  const {T} = await import('../experiences/world-front/strings.mjs');
  for (const lang of ['en', 'mn']) assert.ok(T[lang][line], `${lang} 번역`);
});

test('앞면은 기기 음성을 쓰지 않는다', () => {
  for (const name of ['app.mjs', 'club.mjs', 'index.html']) assert.doesNotMatch(fs.readFileSync(new URL(name, FRONT), 'utf8'), /speechSynthesis|SpeechSynthesisUtterance/, name);
});
