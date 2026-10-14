import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { esc, keepDots, poster, secHead, level, dayLabel, cycleTheme, initTheme, THEME_KEY } from './signal.mjs';
import { MEMBER_SIGNAL_FILES } from './serve.mjs';

test('사람이 쓴 글은 이스케이프하고 「·」 덩어리는 한 줄로 묶는다', () => {
  assert.equal(esc('<b>"a"&\'</b>'), '&lt;b&gt;&quot;a&quot;&amp;&#39;&lt;/b&gt;');
  assert.equal(keepDots('메시지·근거·행동을 정해요'), '<span class="nw">메시지·근거·행동을</span> 정해요');
  assert.equal(keepDots('<script>·x'), '<span class="nw">&lt;script&gt;·x</span>');
});

test('포스터는 큰 한글 길이로 크기를 정하고 그림 주소·설명을 이스케이프한다', () => {
  const html = poster({ word: '리허설', art: './a".webp', alt: '<말풍선>', label: '01 / X', chip: '무료' });
  assert.match(html, /data-word="리허설" data-len="3"/);
  assert.match(html, /src="\.\/a&quot;\.webp"/);
  assert.match(html, /alt="&lt;말풍선&gt;"/);
  assert.match(poster({ word: '2026' }), /data-len="4"/);
  assert.match(secHead(2, '<제목>'), /<span class="n" aria-hidden="true">02<\/span><h2>&lt;제목&gt;<\/h2>/);
});

test('기운 다섯 칸은 0~5로 자르고 읽을 글을 붙인다', () => {
  assert.equal((level(9).match(/class="on"/g) || []).length, 5);
  assert.equal((level(-2).match(/class="on"/g) || []).length, 0);
  assert.match(level(3, '총운 3칸'), /aria-label="총운 3칸"/);
});

test('날짜 표기는 한국 날짜 기준이고 올해가 아니면 연도를 붙인다', () => {
  assert.equal(dayLabel('2026-10-14', { today: '2026-10-14' }), '10월 14일 (수)');
  assert.equal(dayLabel('2025-01-01', { today: '2026-10-14', weekday: false }), '2025년 1월 1일');
  assert.equal(dayLabel('잘못된 날'), '');
});

test('테마는 웹 플랫폼과 같은 키를 쓰고, 저장소가 막혀도 밤으로 연다', () => {
  const store = new Map(), storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const root = { dataset: {} };
  assert.equal(initTheme(root, storage), 'night');
  assert.equal(cycleTheme(root, storage), 'day');
  assert.equal(store.get(THEME_KEY), 'day');
  assert.equal(cycleTheme(root, storage), 'system');
  assert.equal(cycleTheme(root, storage), 'night');
  assert.equal(initTheme({ dataset: {} }, { getItem() { throw new Error('blocked'); } }), 'night');
});

test('로컬 서버 허용 목록에 있는 파일만 내주고, CSS가 가리키는 파일은 모두 그 안에 있다', async () => {
  for (const name of MEMBER_SIGNAL_FILES) await readFile(new URL(name, import.meta.url));
  const css = await readFile(new URL('./signal.css', import.meta.url), 'utf8');
  for (const [, value] of css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) {
    assert.ok(value.startsWith('./assets/'), value);
    assert.ok(MEMBER_SIGNAL_FILES.includes(value.slice(2)), value);
  }
  assert.doesNotMatch(css, /url\(\s*['"]?(?:https?:|data:)/, '외부·인라인 그림을 쓰지 않는다(CSP img-src self)');
});
