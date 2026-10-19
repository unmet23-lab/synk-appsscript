'use strict';
/* 라디오 오버레이 층들이 «같은 낱말»을 쓰나 — 어긋나면 방송에서만 드러나는 자리다 (2026-09-06).
 *
 * ■ 무엇을 지키나
 *   무대 층(`무대.html`)과 마스코트 층(`마스코트.html`)은 서로를 모른다. 봇이 결(곡 장르)을
 *   한 번 던지면 각자 제 몫을 집는다. 그래서 «결 이름»이 두 파일에서 갈리면, 그 결에서만
 *   한쪽만 바뀐다 — 방송 중에만 보이는 무늬다.
 *   한 판정에 자 하나(one-ruler-per-judgment): 결 이름의 정본은 «무대 그림 파일 표»다.
 *
 * ■ 2026-10-19 — 세 친구가 무대 그림 안에 산다
 *   10-14 마스코트 규칙(정본은 생김새 참고로만, 장면과 한 장으로 굽는다)대로 결마다 무대를 세 친구와
 *   장면째 구웠고, 얼굴(까몽 깜빡임·눈웃음, 마린 렌즈)만 같은 자리의 조각으로 바뀐다. 마스코트 층은 기본으로 비어 있다.
 *   그래서 여기서 「무대 표의 조각 자리 = 판.json = 실제 그림 크기」와 「마스코트 층이 누끼를 다시 얹지 않음」을 잰다.
 *
 * ■ 왜 파일 글자를 읽나
 *   층들은 브라우저 문서라 Node 모듈을 못 부른다(README 「보는 법」이 `file://` 통로를 쓴다).
 *   그래서 상수를 공유할 데가 없고, 대신 여기서 «세 곳이 같은가»를 잰다.
 *
 * 돈 0원 · 네트워크 0.
 */
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { CI에없는로컬자료 } = require('./_git밖.js');

const 루트 = path.join(__dirname, '..');
const 무대글 = fs.readFileSync(path.join(루트, 'bots/오버레이/무대.html'), 'utf8');
const 마스코트글 = fs.readFileSync(path.join(루트, 'bots/오버레이/마스코트.html'), 'utf8');
/* vm 이 만든 배열은 다른 실행 영역의 것이라 deepStrictEqual 이 원형까지 견줘 갈린다 — JSON 으로 한 번 풀어 이 영역 값으로 담는다. */
const 표읽기 = (글, 이름) => JSON.parse(JSON.stringify(vm.runInNewContext('(' + 글.match(new RegExp('const ' + 이름 + ' = (\\{[\\s\\S]*?\\n\\});'))[1] + ')')));
const 무대파일표 = 표읽기(무대글, '무대파일표');
const 장면조각 = 표읽기(무대글, '장면조각');

/** `const 결들 = ['가', '나', ...];` 에서 낱말만 뽑는다. */
function 무대가아는결() {
  const m = 무대글.match(/const\s+결들\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, '무대.html 에 `결들` 목록이 없다 — 결 이름의 정본 자리다');
  return m[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
}

/** `const 장르차림 = { 가: {...}, 나: {...} };` 에서 열쇠만 뽑는다. */
function 마스코트가아는결() {
  const m = 마스코트글.match(/const\s+장르차림\s*=\s*\{([\s\S]*?)\n\};/);
  assert.ok(m, '마스코트.html 에 `장르차림` 표가 없다');
  return [...m[1].matchAll(/^\s{2}([^\s:]+)\s*:/gm)].map((x) => x[1]);
}

/** WebP 머리에서 가로·세로를 읽는다(VP8 · VP8L · VP8X) — 그림을 풀지 않는다. */
function webp크기(파일) {
  const b = fs.readFileSync(파일);
  assert.strictEqual(b.toString('ascii', 0, 4) + b.toString('ascii', 8, 12), 'RIFFWEBP', `WebP 가 아니다: ${파일}`);
  const 조각 = b.toString('ascii', 12, 16);
  if (조각 === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (조각 === 'VP8L') { const 비트 = b.readUInt32LE(21); return [(비트 & 0x3FFF) + 1, ((비트 >>> 14) & 0x3FFF) + 1]; }
  if (조각 === 'VP8 ') return [b.readUInt16LE(26) & 0x3FFF, b.readUInt16LE(28) & 0x3FFF];
  throw new Error(`모르는 WebP 꼴 ${조각}: ${파일}`);
}

test('결 이름이 무대 층과 마스코트 층에서 같다', () => {
  const 무대 = 무대가아는결().slice().sort();
  const 마스코트 = 마스코트가아는결().slice().sort();
  assert.deepStrictEqual(마스코트, 무대,
    '결 이름이 두 층에서 갈렸다 — 그 결에서 한쪽만 바뀐다(방송 중에만 보인다)');
});

test('결마다 무대 그림이 실제로 있다', () => {
  for (const 결 of 무대가아는결()) {
    assert.ok(Object.hasOwn(무대파일표, 결), `명시적 무대 경로가 없다: ${결}`);
    const p = path.resolve(루트, 'bots/오버레이', 무대파일표[결]);
    assert.ok(fs.existsSync(p), `보존한 무대 그림이 없다: ${p}`);
  }
});

test('결은 누끼 DJ 도 옷 조각도 세우지 않는다 — 세 친구는 장면 안이다', () => {
  const 표 = 마스코트글.match(/const\s+장르차림\s*=\s*\{([\s\S]*?)\n\};/)[1];
  const 줄들 = [...표.matchAll(/^\s{2}([^\s:]+)\s*:\s*\{\s*DJ:\s*([^,]+?)\s*,\s*옷:\s*\[([^\]]*)\]/gm)];
  assert.strictEqual(줄들.length, 무대가아는결().length, '장르차림 줄을 결 수만큼 못 읽었다 — 이 자가 헛돌고 있다');
  for (const [, 결, DJ, 옷글] of 줄들) {
    assert.strictEqual(DJ, 'null', `${결}: 결이 누끼 DJ 를 세운다 — 세 친구는 무대 장면 안에 구워져 있다`);
    assert.strictEqual(옷글.trim(), '', `${결}: 장면 위에 옷 조각을 다시 얹고 있다`);
  }
});

test('세 친구는 결마다 장면째 구운 무대 안에 있고 얼굴 조각만 같은 자리에서 바뀐다', (t) => {
  /* 마스코트 층은 지운 까몽 누끼를 읽지 않고, 기본으로 아무도 세우지 않는다(10-19). 주석의 이력 설명은 빼고 잰다. */
  const 마스코트코드 = 주석걷기(마스코트글);
  for (const 옛길 of ['라디오차림/까몽/_후보', 'Loom_자산/라디오DJ', '라디오가장자리']) {
    assert.ok(!마스코트코드.includes(옛길), `마스코트.html 이 걷은 까몽 누끼 길을 다시 읽는다: ${옛길}`);
  }
  assert.ok(!/^\s{2}까몽\s*:/m.test(마스코트글.match(/const\s+컷표\s*=\s*\{([\s\S]*?)\n\};/)[1]), '컷표에 까몽 누끼가 다시 들어왔다');
  assert.match(마스코트글, /let 현재DJ = 명시선택 \? 인자\.get\('DJ'\) : null;/, '기본 마스코트 층이 비어 있지 않다');

  /* 무대 층은 고정 카메라다 — 판을 숨 쉬게 하거나 화면 전체 색 빛을 얹으면 세 친구까지 커졌다 작아지고 얼굴색이 흔들린다. */
  assert.ok(!/animation:\s*숨\b/.test(무대글), '무대 판이 다시 숨 쉰다 — 장면 안의 세 친구까지 움직인다(09-06 「멀미」)');
  assert.ok(!/id="일렁[12]"/.test(무대글), '화면 전체 색 빛 겹(일렁)이 다시 얹혔다');
  assert.match(무대글, /<script src="라디오표정리듬\.js"><\/script>/);
  assert.ok(무대글.indexOf('<script src="라디오표정리듬.js">') < 무대글.indexOf('<script>'), '표정 시계를 본문 스크립트보다 먼저 싣는다');

  for (const 결 of 무대가아는결()) {
    const 폴더 = path.join(루트, 'docs/Loom_자산/라디오장면', 결);
    assert.strictEqual(path.resolve(루트, 'bots/오버레이', 무대파일표[결]), path.join(폴더, '장면.webp'), `${결}: 무대가 장면째 구운 그림을 가리키지 않는다`);
    const 판 = JSON.parse(fs.readFileSync(path.join(폴더, '판.json'), 'utf8'));
    assert.strictEqual(판.결, 결);
    const [W, H] = webp크기(path.join(폴더, 판.장면.파일));
    assert.deepStrictEqual([W, H], 판.장면.크기, `${결}: 장면 그림 크기가 판.json 과 다르다`);
    assert.ok(Math.abs(W / H - 16 / 9) < 0.005, `${결}: 장면이 16:9 가 아니다 — 조각 자리가 화면에서 어긋난다`);

    assert.deepStrictEqual(Object.keys(장면조각[결]).sort(), ['까몽눈감음', '까몽눈웃음', '마린렌즈'], `${결}: 얼굴 조각 셋이 아니다`);
    assert.deepStrictEqual(Object.keys(판.조각).sort(), Object.keys(장면조각[결]).sort(), `${결}: 무대 표와 판.json 의 조각이 다르다`);
    for (const [이름, 조각] of Object.entries(장면조각[결])) {
      const 원 = 판.조각[이름];
      assert.strictEqual(조각.파일, 원.파일, `${결} ${이름}: 파일 이름이 판.json 과 다르다`);
      assert.deepStrictEqual(조각.자리, 원.자리, `${결} ${이름}: 무대 표의 자리가 판.json 과 다르다 — 조각을 다시 만들면 표도 고친다`);
      const [x, y, w, h] = 원.자리px;
      assert.deepStrictEqual(webp크기(path.join(폴더, 원.파일)), [w, h], `${결} ${이름}: 조각 그림 크기가 자리와 다르다`);
      assert.ok(x >= 0 && y >= 0 && x + w <= W && y + h <= H, `${결} ${이름}: 조각이 장면 밖으로 나간다`);
      const 몫 = [x / W * 100, y / H * 100, w / W * 100, h / H * 100];
      몫.forEach((v, i) => assert.ok(Math.abs(v - 원.자리[i]) < 0.002, `${결} ${이름}: % 자리가 픽셀 자리와 다르다`));
    }

    /* 굽기 원본 PNG 는 git 밖이다(원본 창고 SYNK-appsscript 묶음). 있으면 판.json 이 적은 그 원본인지 잰다. */
    for (const [원본, 해시] of [[판.장면.원본, 판.장면.원본sha256], ...Object.values(판.조각).filter((c) => c.원본).map((c) => [c.원본, c.원본sha256])]) {
      const 없음 = CI에없는로컬자료(원본, '장면 굽기 원본 PNG 는 git 밖');
      if (없음) { t.diagnostic(없음); continue; }
      assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(path.join(루트, 원본))).digest('hex'), 해시, `${결}: 굽기 원본이 판.json 에 적힌 것과 다르다: ${원본}`);
    }
  }
});

/** 주석을 걷는다 — 함정을 «설명한 문장»이 함정으로 잡히면 안 된다(이 자가 첫 판에 그랬다). */
function 주석걷기(글) {
  return 글.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((줄) => 줄.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');
}

test('사건 문은 «변수에 잡아 둔다» — 안 잡으면 브라우저가 치운다', () => {
  for (const [이름, 날글] of [['무대.html', 무대글], ['마스코트.html', 마스코트글],
    ['전광판.html', fs.readFileSync(path.join(루트, 'bots/오버레이/전광판.html'), 'utf8')]]) {
    const 글 = 주석걷기(날글);
    /* 🔴 09-06 실측 — `new BroadcastChannel(...).onmessage = ...` 만 쓰면 그 문을 가리키는 것이
       아무 데도 없어 청소 대상이 된다. 그러면 봇이 보내도 조용히 아무 일도 안 난다. */
    assert.ok(!/new BroadcastChannel\([^)]*\)\s*\.\s*onmessage/.test(글),
      `${이름}: 문을 만들자마자 버렸다 — 변수에 담아 두어야 한다`);
    assert.ok(/^\s*(let|var)\s+\S+\s*=\s*null;[\s\S]{0,400}new BroadcastChannel/m.test(글),
      `${이름}: 문 손잡이를 바깥 변수에 잡아 두지 않았다`);
  }
});
