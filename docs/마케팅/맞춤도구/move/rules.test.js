// 실행: node --test "docs/마케팅/맞춤도구/move/rules.test.js"
// 추천기준.md §6의 약속과 제작절차.md의 검사를 지킨다.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('./content.js');
const R = require('./rules.js');
const V = require('./view.js');
const { checkContent, checkTipIds } = require('../core/content-check.js');

const HOWS = ['ssd', 'cloud', 'direct', 'unsure'];
const USES = ['ai', 'code', 'creative', 'media', 'work', 'game', 'docs'];
const OLDS = ['sell', 'keep2w', 'keep'];
const ALL = [];
for (const how of HOWS) for (let m = 1; m < 1 << USES.length; m += 1) for (const old of OLDS) ALL.push({ how, uses: USES.filter((_, i) => m & (1 << i)), old });

// 영상의 세 사람(기획 · 「같은 PDF → 서로 다른 결과」)
const GA = { how: 'cloud', uses: ['ai', 'code'], old: 'keep2w' };
const NA = { how: 'ssd', uses: ['creative', 'media'], old: 'sell' };
const DA = { how: 'unsure', uses: ['docs'], old: 'keep' };
const texts = rec => [rec.headline.title, rec.headline.hl, rec.headline.sub, rec.prompt, ...rec.cards.flatMap(c => [c.k, c.v, c.s]), ...rec.warns.map(w => w.t), ...['must', 'skip', 'redo', 'verify'].flatMap(k => rec[k].flatMap(x => [x.t, x.d]))].join('\n');
const view = rec => V.result({ rec, answers: rec.answers, layout: 'guided', plan: null, tipsOn: true, checks: {}, feedbackGiven: null, content: C, rules: R });

test('제작 절차: 탐색노트·추천기준이 있고 질문·팁 은행이 검사를 통과한다', () => {
  for (const doc of ['탐색노트.md', '추천기준.md']) assert.ok(fs.existsSync(path.join(__dirname, doc)), `${doc} 없음`);
  assert.deepEqual(checkContent(C), []);
  assert.equal(C.steps.length, 3, '질문은 정확히 셋(10-17 「더 짧게」)');
  assert.deepEqual(C.steps.map(s => s.options.map(o => o.id)), [HOWS, USES, OLDS]);
  assert.match(C.intro.lead + C.intro.meta.join(' '), /Windows에서 Windows로|Windows → Windows/);
});

test(`모든 조합(${ALL.length}개)에서 네 칸이 비지 않고, 글에 빈 값이 없고, 고른 팁·항목이 은행에 있다`, () => {
  for (const a of ALL) {
    const rec = R.compute(a);
    for (const k of ['must', 'skip', 'redo', 'verify']) assert.ok(rec[k].length >= 3, `${k} ${JSON.stringify(a)}`);
    assert.doesNotMatch(texts(rec), /undefined|NaN|\{when\}|\{where\}|null/, JSON.stringify(a));
    assert.deepEqual(checkTipIds(rec.tips, C), []);
    for (const k of ['must', 'skip', 'redo', 'verify']) for (const x of rec[k]) assert.ok(C.SOURCES[x.src], `${x.id} 출처 ${x.src}`);
    for (const k of ['must', 'skip', 'redo', 'verify']) assert.equal(new Set(rec[k].map(x => x.id)).size, rec[k].length, `${k} 중복`);
  }
});

test('OneDrive 확인·시계·대조는 질문 없이 모든 결과에 있다', () => {
  assert.equal(C.onedrive.steps.length, 4);
  assert.match(C.onedrive.steps.map(s => s.d).join(' '), /빨간 동그라미/);
  for (const a of ALL) {
    const rec = R.compute(a);
    assert.match(rec.prompt, /OneDrive로 백업되고 있다면, 저장 공간이 차서 백업이 멈췄는지 먼저 확인/);
    assert.equal(rec.redo[0].id, 'r-clock');
    assert.match(rec.redo[0].t, /시계부터 맞추기/);
    assert.match(rec.prompt, /날짜·시간·표준 시간대가 맞는지 확인한 뒤에 파일을 넣어/);
    assert.equal(rec.verify[0].id, 'v-compare');
    assert.match(rec.prompt, /옛 컴퓨터와 대조해서 알려 줘/);
    assert.ok(rec.tips.includes('onedrive-full') && rec.tips.includes('clock-first') && rec.tips.includes('verify-compare'));
  }
  const out = view(R.compute(DA));
  assert.ok(out.html.includes('먼저 확인 · OneDrive가 멈췄는지'));
  assert.match(out.texts.all, /\[00 먼저 확인/);
});

test('요청문 첫 지시는 ① 목록이고 「어떤 규칙으로도 빼지 마」, 공동인증서는 모두의 ①에', () => {
  for (const a of ALL) {
    const rec = R.compute(a);
    const first = rec.prompt.indexOf('[1. 절대 두고 가면 안 되는 것');
    assert.ok(first > 0 && first < rec.prompt.indexOf('[2. OneDrive 확인]'));
    assert.match(rec.prompt, /「이미 백업돼 있다」고 보여도 어떤 규칙으로도 빼지 마/);
    // 「두고 간 것 목록」은 이사 뒤에 생기는 산출물이라 [1]의 「어디에 있는지 찾아 줘」 대상에서 뺀다(10-17 Fable 검수) — [3]·[지킬 것]이 남기게 한다
    for (const x of rec.must) {
      if (x.id.startsWith('m-left')) assert.ok(!rec.prompt.includes(`- ${x.t}`), x.t);
      else assert.ok(rec.prompt.includes(`- ${x.t}`), x.t);
    }
    assert.match(rec.prompt, /암호를 건 압축으로만 옮기고/);
    assert.ok(rec.must.some(x => x.id === 'm-cert'));
    assert.match(rec.prompt, /옛 컴퓨터에서는 아무것도 지우지 마/);
  }
});

test('코딩 도구면 ssh 키·push 안 한 코드·환경 변수 합치기, 아니면 그런 말이 없다', () => {
  const code = R.compute({ how: 'ssd', uses: ['code'], old: 'keep' });
  assert.deepEqual(code.must.slice(0, 3).map(x => x.id), ['m-ssh', 'm-git', 'm-env']);
  assert.ok(code.redo.some(x => x.id === 'r-env') && code.redo.some(x => x.id === 'r-ssh-perm'));
  assert.match(code.prompt, /환경 변수는 옛 값으로 덮지 말고 새 컴퓨터 값과 합쳐/);
  assert.ok(['must-code', 'ssh-perm', 'env-merge', 'login-apps'].every(t => code.tips.includes(t)));
  const docs = R.compute({ how: 'ssd', uses: ['docs', 'media'], old: 'keep' });
  assert.doesNotMatch(docs.prompt + texts(docs), /ssh|환경 변수|push/);
  assert.ok(!docs.tips.includes('ssh-perm'));
});

test('옛 컴퓨터: 판매는 초기화가 맨 마지막·대조 전 금지, 2주는 목록과 2주, 계속 쓰면 서로 지우지 않게', () => {
  const sell = R.compute({ how: 'cloud', uses: ['docs'], old: 'sell' });
  assert.equal(sell.redo.at(-1).id, 'r-reset-sell');
  assert.match(sell.redo.at(-1).d, /데이터 정리/);
  assert.match(sell.prompt, /5번 대조가 끝나기 전에는 초기화하라고 하지 마/);
  assert.ok(sell.must.some(x => x.id === 'm-left-sell') && sell.verify.some(x => x.id === 'v-sell'));
  const w2 = R.compute({ how: 'cloud', uses: ['docs'], old: 'keep2w' });
  assert.ok(w2.must.some(x => x.id === 'm-left-2w') && w2.skip.some(x => x.id === 's-unsure-2w'));
  assert.match(w2.prompt, /2주 보관해/);
  const keep = R.compute({ how: 'cloud', uses: ['docs'], old: 'keep' });
  assert.equal(keep.redo.at(-1).id, 'r-keep-sync');
  assert.match(keep.prompt, /한쪽에서 정리한 파일이 다른 쪽에서 지워지지 않게/);
  assert.ok(!keep.must.some(x => /m-left/.test(x.id)));
  assert.ok(sell.tips.includes('old-sell') && w2.tips.includes('old-keep2w') && keep.tips.includes('old-keep'));
});

test('옮기는 방법마다: SSD FAT32·이어 복사, 클라우드 15GB·5GB·이어 받기, 직접 연결 공유 끄기·기능 내려감, 아직 모름 크기 재기', () => {
  const base = { uses: ['docs'], old: 'keep2w' };
  const ssd = R.compute({ ...base, how: 'ssd' });
  assert.match(ssd.prompt, /FAT32면 4GB/);
  assert.match(ssd.prompt, /robocopy \/z/);
  assert.match(ssd.prompt, /\/mir, \/purge\)은 쓰지 마/);
  const cloud = R.compute({ ...base, how: 'cloud' });
  assert.match(cloud.prompt, /구글 15GB, Microsoft 5GB/);
  assert.match(cloud.prompt, /이어 받게/);
  assert.equal(cloud.skip[0].id, 's-big-reget');
  assert.ok(cloud.redo.some(x => x.id === 'r-cloud-clean'));
  const direct = R.compute({ ...base, how: 'direct' });
  assert.ok(direct.redo.some(x => x.id === 'r-share-off'));
  assert.match(direct.warns.map(w => w.t).join(' '), /더 이상 사용할 수 없다/);
  const unsure = R.compute({ ...base, how: 'unsure' });
  assert.match(unsure.prompt, /옮길 크기를 먼저 재고/);
  assert.match(unsure.warns[0].t, /크기부터 재요/);
  assert.equal(new Set([ssd, cloud, direct, unsure].map(r => r.art)).size, 4, '머리 그림이 방법마다 다르다');
});

test('영상의 세 사람은 제목·①~④ 첫 줄·머리 그림이 서로 다르고, 같은 결과에 이름만 바꾼 것이 아니다', () => {
  const [ga, na, da] = [GA, NA, DA].map(a => R.compute(a));
  for (const key of ['title', 'hl']) assert.equal(new Set([ga, na, da].map(r => r.headline[key])).size, 3, key);
  for (const k of ['must', 'skip', 'redo', 'verify']) assert.equal(new Set([ga, na, da].map(r => r[k][0].t)).size, 3, `${k} 첫 줄`);
  assert.equal(new Set([ga, na, da].map(r => r.art)).size, 3);
  // 항목 집합이 절반 넘게 달라야 한다(공통 항목은 있어도 된다)
  const ids = r => new Set(['must', 'skip', 'redo', 'verify'].flatMap(k => r[k].map(x => x.id)));
  const jac = (a, b) => { const A = ids(a), B = ids(b); const inter = [...A].filter(x => B.has(x)).length; return inter / new Set([...A, ...B]).size; };
  for (const [a, b] of [[ga, na], [ga, da], [na, da]]) assert.ok(jac(a, b) < 0.5, `겹침 ${jac(a, b).toFixed(2)}`);
  assert.equal(ga.headline.hl, '키와 안 올린 코드부터');
  assert.equal(na.headline.hl, '프로젝트와 원본부터');
  assert.equal(da.headline.hl, '인증서와 받아 둔 서류부터');
});

test('사이트 글에 AI 도구 이름·계정 이름·키 값이 없다', () => {
  const names = /Claude|클로드|ChatGPT|챗GPT|Gemini|제미나이|\bGPT|Codex|Copilot|코파일럿|Perplexity|Suno|Higgsfield|힉스필드|Nano Banana|AI 생성/i;
  const visible = JSON.stringify({ intro: C.intro, steps: C.steps, ITEMS: C.ITEMS, TIPS: C.TIPS, onedrive: C.onedrive, story: C.story, SOURCES: C.SOURCES });
  assert.doesNotMatch(visible, names);
  for (const a of [GA, NA, DA, { how: 'direct', uses: USES, old: 'sell' }]) {
    const out = view(R.compute(a));
    assert.doesNotMatch(out.html + out.texts.all, names);
  }
  for (const f of ['content.js', 'rules.js', 'view.js', 'index.html']) assert.doesNotMatch(fs.readFileSync(path.join(__dirname, f), 'utf8'), /q1212|q121235|unmet23|synk\.yuh|outlook\.com|gmail\.com|id_ed25519|BEGIN [A-Z ]*PRIVATE KEY/);
});

test('영상 속 실제 이사 숫자는 기획.md 사실 대조 표와 같다', () => {
  const s = C.story.rows.map(r => `${r.k} ${r.v}`).join(' | ');
  for (const fact of ['160GB', '96만', '5GB', '11GB', '2만 7천', '107GB', '2주', '16시간', '18만', '39', '하루 반', '핵심이 옛 노트북의 마지막 상태와 같다']) assert.ok(s.includes(fact), fact);
  assert.match(C.story.note, /사람이 했어요/);
  const out = view(R.compute(GA));
  assert.ok(out.html.includes('영상 속 실제 이사'));
});

test('결과 화면: 네 칸 머리·요청문 복사·그림 파일이 있고, 결과 전체 글에 네 칸이 다 실린다', () => {
  const rec = R.compute(GA);
  const out = view(rec);
  for (const h of ['① 절대 두고 가면 안 되는 것', '② 두고 와도 되는 것', '③ 옮긴 뒤 다시 할 것', '④ 끝났는지 확인하는 법', 'AI한테 이사를 맡길 때 붙여 넣을 요청문']) assert.ok(out.html.includes(h), h);
  assert.equal(out.texts.prompt, rec.prompt);
  for (const k of ['must', 'skip', 'redo', 'verify']) for (const x of rec[k]) assert.ok(out.texts.all.includes(x.t), x.t);
  for (const [file] of Object.values(V.ART)) assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', file)), file);
  // 체크는 이 기기에 남는다(core/wizard.js의 data-check)
  assert.ok((out.html.match(/data-check="/g) || []).length === rec.must.length + rec.redo.length + rec.verify.length);
});

test('sanitize는 모르는 값을 버리고, 빈 답도 끝까지 계산된다', () => {
  assert.deepEqual(R.sanitize({ how: 'x', uses: ['code', 'evil'], old: 'keep' }), { uses: ['code'], old: 'keep' });
  assert.deepEqual(R.sanitize({ uses: [] }), {});
  const rec = R.compute({});
  assert.equal(rec.f.how, 'unsure');
  assert.ok(rec.must.length && rec.prompt.length > 200);
});
