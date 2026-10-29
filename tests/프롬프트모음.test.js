'use strict';
// synk.im/prompts(10-22) — 항목 검사, 페이지 그리기, 편 게시 결과에서 영상·글 주소 읽기를 본다.
// 실제 프롬프트.json도 검사를 통과해야 한다(빌드가 같은 검사로 멈춘다). 네트워크·브라우저는 부르지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const page = require('../docs/마케팅/맞춤도구/prompts/page.js');

const REPO = path.resolve(__dirname, '..');
const DATA = path.join(REPO, 'docs', '마케팅', '맞춤도구', 'prompts', '프롬프트.json');

const item = (over = {}) => ({
  id: 'still-time', 편: '편', 날짜: '2026-10-24', 영상제목: '42초 쇼츠, 재 보니 24초가 멈춰 있었어요', 제목: '내 쇼츠, 몇 초가 멈춰 있는지 재기', 설명: '42초 중 24초가 멈춰 있었어요.',
  블록: [{ 종류: '프롬프트', '넣는 곳': '코딩 AI — 영상 파일을 여는 것', 본문: '【내 영상 파일】을 재 줘. 0.5초 칸마다.' }],
  빈칸: { '내 영상 파일': '잴 영상 파일 이름' }, 확인: '10월 22일 돌려 보니 같은 숫자가 나왔어요.', ...over,
});

test('지금 프롬프트.json이 검사를 통과하고 id가 영구 주소 꼴이다', () => {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  assert.deepEqual(page.checkPrompts(data, { repo: REPO }), []);
  for (const it of data.항목) assert.match(it.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test('빈칸·확인·종류·id를 본다', () => {
  assert.deepEqual(page.checkPrompts({ 항목: [item()] }), []);
  const bad = page.checkPrompts({ 항목: [
    item({ 확인: '' }),
    item({ id: 'still-time', 빈칸: {} }),
    item({ id: 'Bad_ID', 블록: [{ 종류: '요약', '넣는 곳': '어디든', 본문: '그냥 해 줘' }] }),
  ] });
  assert.ok(bad.some((p) => /항목 1.*확인/.test(p)), '돌려 본 결과가 없으면 막는다');
  assert.ok(bad.some((p) => /항목 2.*id가 겹친다/.test(p)));
  assert.ok(bad.some((p) => /항목 2.*【내 영상 파일】의 설명/.test(p)), '본문의 빈칸은 설명이 있어야 한다');
  assert.ok(bad.some((p) => /항목 3.*영문 소문자/.test(p)));
  assert.ok(bad.some((p) => /항목 3.*종류는/.test(p)));
  assert.ok(bad.some((p) => /항목 3.*【내 영상 파일】을 쓰는 본문이 없다/.test(p)), '쓰지 않는 빈칸 설명도 짚는다');
  assert.deepEqual(page.checkPrompts({ 항목: [] }), ['「항목」이 비었다']);
});

test('기본값 빈칸 【이름=기본값】 — 화면엔 기본값, 블록마다 기본값이 다르면 막는다', () => {
  const it = item({ 블록: [{ 종류: '프롬프트', '넣는 곳': '코딩 AI', 본문: '【재는 간격(초)=60】초 뒤에 다시 재 줘' }], 빈칸: { '재는 간격(초)': '두 번 재는 사이' } });
  assert.deepEqual(page.checkPrompts({ 항목: [it] }), []);
  assert.deepEqual(page.blanksOf('【재는 간격(초)=60】와 【내 파일】'), [{ name: '재는 간격(초)', value: '60' }, { name: '내 파일', value: '' }]);
  const html = page.renderPage({ 항목: [it] }, { now: Date.parse('2026-10-24T09:00+09:00') });
  assert.match(html, /<mark class="blank default" data-blank="재는 간격\(초\)" data-default="60">60<\/mark>초 뒤에/);
  assert.match(html, /비워 두면 「60」/);
  const clash = item({ 블록: [
    { 종류: '프롬프트', '넣는 곳': '코딩 AI', 본문: '【재는 간격(초)=60】' },
    { 종류: '명령', '넣는 곳': '터미널', 본문: 'sleep 【재는 간격(초)=30】' },
  ], 빈칸: { '재는 간격(초)': '두 번 재는 사이' } });
  assert.ok(page.checkPrompts({ 항목: [clash] }).some((p) => /기본값이 블록마다 다르다/.test(p)));
});

test('AI·제작 도구 이름과 내부 번호는 막고, 프롬프트 본문의 「이번 달」은 둔다', () => {
  const named = page.checkPrompts({ 항목: [item({ 설명: 'ChatGPT에 넣으면 돼요', 블록: [{ 종류: '프롬프트', '넣는 곳': 'Claude Code', 본문: 'Remotion으로 【내 영상 파일】을 만들어 줘' }] })] });
  assert.ok(named.some((p) => /설명.*AI 도구 이름/.test(p)));
  assert.ok(named.some((p) => /넣는 곳.*AI 도구 이름/.test(p)));
  assert.ok(named.some((p) => /본문.*만든 도구 이름/.test(p)));
  assert.ok(page.checkPrompts({ 항목: [item({ 설명: '오늘 v6 판에서 찾았어요' })] }).some((p) => /상대 날짜|내부/.test(p)));
  assert.ok(page.checkPrompts({ 항목: [item({ 확인: 'gpt로 돌려 봤어요' })] }).some((p) => /AI 이름 「gpt」/.test(p)), '맨 gpt도 막는다');
  assert.ok(page.checkPrompts({ 항목: [item({ 블록: [{ 종류: '프롬프트', '넣는 곳': '코딩 AI', 본문: '【내 영상 파일】', 덤: 1 }] })] }).some((p) => /모르는 칸 「덤」/.test(p)));
  assert.deepEqual(page.checkPrompts({ 항목: [item({ 블록: [{ 종류: '프롬프트', '넣는 곳': '코딩 AI', 본문: '이번 달 남은 분과 【내 영상 파일】을 봐 줘' }] })] }), []);
});

test('그린 페이지 — 항목 id 앵커, 빈칸 표시, 복사 단추, 체크리스트, 날짜 내림차순, 글자 탈출', () => {
  const html = page.renderPage({ 항목: [
    item(),
    item({ id: 'later-later', 날짜: '2026-10-27' }),
    item({ id: 'later-one', 날짜: '2026-10-25', 제목: '<b>꺾쇠</b> & 따옴표"', 블록: [
      { 종류: '체크리스트', '넣는 곳': '직접 — 작업 관리자', 본문: '열어요\n「세부 정보」로 가요' },
      { 종류: '명령', '넣는 곳': '직접 — 터미널', 본문: 'ffmpeg -i 【내 영상 파일】 -f null -', 메모: 'diff.txt를 봐요.' },
    ] }),
  ] }, { links: { 'still-time': [{ href: 'https://youtube.com/shorts/x', label: '유튜브 쇼츠' }] }, now: Date.parse('2026-10-24T09:00+09:00') });
  assert.match(html, /<article class="item" id="still-time" data-date="2026-10-24"/);
  assert.ok(html.indexOf('id="still-time"') < html.indexOf('id="later-later"'), '지금 항목이 먼저, 곧 나올 영상은 뒤에');
  assert.ok(html.indexOf('id="later-one"') < html.indexOf('id="later-later"'), '곧 나올 영상은 가까운 날부터');
  assert.match(html, /id="later-one"[^]*?<span class="tag soon">곧 나올 영상<\/span>/, '빌드 날보다 뒤인 항목은 곧 나올 영상');
  assert.match(html, /id="still-time"[^]*?<span class="tag soon" hidden>/);
  assert.match(html, /<p class="video">영상 「42초 쇼츠, 재 보니 24초가 멈춰 있었어요」<\/p>/);
  assert.match(html, /<mark class="blank" data-blank="내 영상 파일" data-default="">【내 영상 파일】<\/mark>/);
  assert.match(html, /<button class="copy" type="button" data-for="still-time-1"/);
  assert.match(html, /<pre class="text cmd" id="later-one-2"/);
  assert.match(html, /<ol class="steps"><li>열어요<\/li><li>「세부 정보」로 가요<\/li><\/ol>/);
  assert.doesNotMatch(html, /data-for="later-one-1"/, '체크리스트는 복사 단추가 없다');
  assert.match(html, /&lt;b&gt;꺾쇠&lt;\/b&gt; &amp; 따옴표&quot;/);
  assert.doesNotMatch(html, /<b>꺾쇠<\/b>/);
  assert.match(html, /<a href="https:\/\/youtube\.com\/shorts\/x" target="_blank" rel="noopener">유튜브 쇼츠<\/a>/);
  assert.match(html, /영상 10월 25일 공개 · <a href="https:\/\/www\.youtube\.com\/@yuhobuilds"/, '주소가 없으면 공개일과 채널');
  assert.match(html, /href="https:\/\/synk\.im\/"/);
  assert.match(html, /href="\/builds\/"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/synk\.im\/prompts\/">/);
});

test('도구(선택) — 같은 문제를 코딩 없이 푸는 맞춤 프로그램을 설명 아래 「코딩 없이 쓰려면」으로 잇는다(10-30)', () => {
  const tool = { 주소: '/builds/voice-check/', 글: '파일만 넣으면 바로 재 줘요.' };
  assert.deepEqual(page.checkPrompts({ 항목: [item({ 도구: tool })] }), []);
  const bad = page.checkPrompts({ 항목: [item({ 도구: { 주소: 'https://example.com/', 글: '', 색: '파랑' } })] });
  assert.ok(bad.some((p) => /도구: 주소는/.test(p)), '맞춤 프로그램 주소만');
  assert.ok(bad.some((p) => /도구: 「글」이 없다/.test(p)));
  assert.ok(bad.some((p) => /도구: 모르는 칸 「색」/.test(p)));
  const html = page.renderPage({ 항목: [item({ 도구: tool }), item({ id: 'no-tool' })] }, { links: {}, now: Date.parse('2026-10-24T09:00+09:00') });
  assert.match(html, /id="still-time"[^]*?<a class="tool" href="\/builds\/voice-check\/"><b>코딩 없이 쓰려면<\/b><span>파일만 넣으면 바로 재 줘요\.<\/span>/);
  assert.equal((html.match(/class="tool"/g) || []).length, 1, '도구가 없는 항목에는 그리지 않는다');
});

test('게시결과.json — 게시됨은 그대로, 예약됨이면서 시각이 지난 것은 열어 볼 후보, 인스타 예약은 빼고, 날짜·영상 제목은 준비.json에서', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '프롬프트모음-'));
  try {
    const dir = path.join(root, 'docs', '마케팅', '편', '게시');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '게시결과.json'), JSON.stringify({ 판: [
      { 계정: 'shift-tistory', 상태: '예약됨', 시각: '2026-10-22T21:50+09:00', 주소: 'https://yuhobuilds.tistory.com/6' },
      { 계정: 'yuhobuilds-youtube', 상태: '게시됨', 시각: '2026-10-24T21:00+09:00', 주소: 'https://youtube.com/shorts/abc' },
      { 계정: 'yuhobuilds-instagram', 상태: '예약 풀림', 시각: '2026-10-21T21:00+09:00', 주소: 'https://www.instagram.com/reel/x/' },
    ] }));
    const before = page.linksOf(root, '편', Date.parse('2026-10-22T21:00+09:00'));
    assert.deepEqual(before.map((l) => l.label), ['유튜브 쇼츠'], '예약 시각 전의 블로그 글은 아직 비공개');
    const after = page.linksOf(root, '편', Date.parse('2026-10-22T22:00+09:00'));
    assert.deepEqual(after.map((l) => [l.label, !!l.check]), [['유튜브 쇼츠', false], ['블로그 글', true]], '예약 시각이 지난 판은 빌드가 열어 보는 후보');
    assert.deepEqual(page.linksOf(root, '없는편'), [], '게시결과가 없으면 빈 목록');
    fs.writeFileSync(path.join(dir, '준비.json'), JSON.stringify({ 슬롯: '2026-10-24', 제목: '42초 쇼츠, 재 보니 24초가 멈춰 있었어요 — 재는 법과 고치는 셋' }));
    assert.deepEqual(page.episodeOf(root, '편'), { 날짜: '2026-10-24', 제목: '42초 쇼츠, 재 보니 24초가 멈춰 있었어요' });
    const raw = { 항목: [{ ...item(), 날짜: undefined, 영상제목: undefined }] };
    delete raw.항목[0].날짜; delete raw.항목[0].영상제목;
    assert.deepEqual(page.checkPrompts(raw, { repo: root }), []);
    assert.ok(page.checkPrompts({ 항목: [{ ...raw.항목[0], 편: '없는편' }] }, { repo: root }).some((p) => /슬롯/.test(p)), '슬롯을 못 읽으면 멈춘다');
    assert.ok(page.checkPrompts({ 항목: [{ ...raw.항목[0], 날짜: '2026-10-24' }] }, { repo: root }).some((p) => /모르는 칸 「날짜」/.test(p)), '날짜는 항목에 적지 않는다');
    assert.equal(page.withEpisodes(raw, root).항목[0].날짜, '2026-10-24');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Fable 10-22 — 블로그 글만 공개됐으면 영상 공개일·채널을 두고 블로그는 뒤에, 같은 계정 여러 줄은 게시됨 줄이 이긴다', () => {
  const html = page.renderPage({ 항목: [item()] }, { links: { 'still-time': [{ href: 'https://yuhobuilds.tistory.com/6', label: '블로그 글' }] }, now: Date.parse('2026-10-23T09:00+09:00') });
  assert.match(html, /<p class="src">영상 10월 24일 공개 · <a href="https:\/\/www\.youtube\.com\/@yuhobuilds"[^]*?인스타 @yuhobuilds<\/a> · <a href="https:\/\/yuhobuilds\.tistory\.com\/6"[^>]*>블로그 글<\/a><\/p>/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '프롬프트모음-여러줄-'));
  try {
    const dir = path.join(root, 'docs', '마케팅', '편', '게시');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '게시결과.json'), JSON.stringify({ 판: [
      { 계정: 'shift-tistory', 상태: '예약 풀림', 시각: '2026-10-21T21:22+09:00', 주소: 'https://yuhobuilds.tistory.com/4' },
      { 계정: 'shift-tistory', 상태: '게시됨', 시각: '2026-10-22T21:50+09:00', 주소: 'https://yuhobuilds.tistory.com/4' },
    ] }));
    assert.deepEqual(page.linksOf(root, '편').map((l) => [l.label, !!l.check]), [['블로그 글', false]]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Fable 10-22 — 날짜가 지난 「곧 나올 영상」을 올리면 목차도 같은 순서(날짜 내림차순)가 된다', () => {
  const vm = require('node:vm');
  const html = page.renderPage({ 항목: [
    item({ id: 'd22', 날짜: '2026-10-22' }), item({ id: 'd23', 날짜: '2026-10-23' }),
    item({ id: 'd24', 날짜: '2026-10-24' }), item({ id: 'd25', 날짜: '2026-10-25' }),
  ] }, { now: Date.parse('2026-10-22T09:00+09:00') });
  // 아주 작은 가짜 DOM — 스크립트가 쓰는 것만(querySelector(All)·insertBefore·appendChild·hidden·getAttribute).
  const el = (tag, attrs = {}) => ({ tag, attrs, children: [], parentNode: null, hidden: false, id: attrs.id || '',
    getAttribute(k) { return this.attrs[k]; }, appendChild(c) { return this.insertBefore(c, null); },
    insertBefore(c, ref) { if (c.parentNode) c.parentNode.children.splice(c.parentNode.children.indexOf(c), 1); const i = ref ? this.children.indexOf(ref) : -1; this.children.splice(i < 0 ? this.children.length : i, 0, c); c.parentNode = this; return c; } });
  const ids = [...html.matchAll(/<article class="item" id="([^"]+)" data-date="([^"]+)"/g)].map((m) => [m[1], m[2]]);
  const tocIds = [...html.matchAll(/<li data-date="([^"]+)"><a href="#([^"]+)"/g)].map((m) => [m[2], m[1]]);
  const items = el('div'), later = el('section'), toc = el('ol');
  const arts = {};
  for (const [id, date] of ids) { const a = el('article', { id, 'data-date': date }); a.soon = el('span'); arts[id] = a; (date > '2026-10-22' ? later : items).appendChild(a); }
  const lis = {};
  for (const [id, date] of tocIds) { const li = el('li', { 'data-date': date }); li.link = el('a'); li.link.parentNode = li; li.link.soonD = el('span'); lis[id] = li; toc.appendChild(li); }
  const kids = (n, sel) => n.children.filter((c) => c.tag === sel);
  items.querySelectorAll = () => kids(items, 'article'); items.querySelector = () => kids(items, 'article')[0] || null;
  later.querySelectorAll = () => kids(later, 'article'); later.querySelector = (s) => (s === '.item' ? kids(later, 'article')[0] || null : null);
  toc.querySelectorAll = () => kids(toc, 'li');
  toc.querySelector = (s) => { const id = s.match(/#([^"]+)"/)[1]; const li = lis[id]; return li ? Object.assign(li.link, { querySelector: () => li.link.soonD }) : null; };
  for (const a of Object.values(arts)) a.querySelector = () => a.soon;
  const document = { getElementById: () => ({ textContent: '' }), querySelector: (s) => ({ '.items': items, '.later': later, '.toc ol': toc }[s] || null), querySelectorAll: () => [] };
  const script = html.match(/<script>\n\(function\(\)\{[^]*?<\/script>/)[0].slice(8, -9);
  vm.runInNewContext(script, { document, location: { hash: '' }, Date: class extends Date { static now() { return Date.parse('2026-10-24T12:00+09:00'); } }, navigator: {}, window: {}, setTimeout, getSelection: () => ({}) });
  assert.deepEqual(kids(items, 'article').map((a) => a.id), ['d24', 'd23', 'd22']);
  assert.deepEqual(kids(later, 'article').map((a) => a.id), ['d25']);
  assert.deepEqual(kids(toc, 'li').map((li) => Object.keys(lis).find((k) => lis[k] === li)), ['d24', 'd23', 'd22', 'd25'], '목차가 목록과 같은 순서');
});
