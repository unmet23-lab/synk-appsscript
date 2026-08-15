/* Loom L2b 패치 라이브러리 회귀 — `tools/펠트패치.py`.
 *
 * 무엇을 지키나(F472 가 이 파일을 세웠다):
 *   토큰 `울패치.원점` 은 이름과 달리 «중심»이다. 라벨대로 왼위 원점으로 읽으면 마스코트의
 *   검은 구슬 눈이 타일에 들어오는데, **아무 테스트도 안 깨진다** — 그 토큰을 프로그램으로 읽는
 *   소비자가 여태 0이었기 때문이다. 그래서 여기서 ①해석을 못박고 ②더러운 패치를 거부하는지 본다.
 *
 * 탐지력은 «픽스처»가 진다(가드 맹점 ② — 버그가 아직 있을 것을 요구하는 회귀 금지):
 *   중심과 원점이 «다른 답»을 내도록 일부러 만든 그림을 깔고, 도구가 어느 쪽을 집는지 본다.
 *   실저장소(진짜 정본 사진)에는 거짓양성만 검사한다 — 잘 자르는지만 보고, 값은 안 박는다.
 *
 * 파이썬·Pillow·numpy 가 없는 CI 에서는 fail 이 아니라 **skip** 으로 드러낸다(F296).
 */
'use strict';
const { test, skip } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 도구 = path.join(루트, 'tools', '펠트패치.py');

function 파이썬() {
  for (const c of ['python', 'python3', 'py']) {
    const r = spawnSync(c, ['-c', 'import PIL, numpy'], { encoding: 'utf8' });
    if (r.status === 0) return c;
  }
  return null;
}
const PY = 파이썬();

function 돌리기(args, env = {}) {
  return spawnSync(PY, [도구, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', ...env },
  });
}

/** 중심과 원점이 서로 «다른 답»을 내는 그림을 만든다.
 *  전체는 채도 높은 양모색, 그러나 왼위 원점 해석이 덮는 사각형 안에만 검은 구슬을 심는다.
 *  → 중심으로 읽으면 깨끗(통과), 원점으로 읽으면 더러움(거부). 두 해석이 갈린다. */
function 픽스처(dir, { 중심 = [510, 320], 한변 = 144, 눈 = true, 키 = '중심' } = {}) {
  const 사진 = path.join(dir, 'photo.png');
  const 토큰 = path.join(dir, 'token.json');
  const py = `
import json, os
from PIL import Image
W = H = 1024
im = Image.new('RGB', (W, H), (250, 125, 107))   # 채도 높은 코랄 양모 바닥
px = im.load()
# 결 흉내 + «구워진 조명 경사». 경사가 없으면 생짜 크롭을 이어붙여도 이음매가 안 생겨서
# (실측: 경사 없는 격자는 이음매비 0.9) 「거울이 무엇을 벌어주나」를 못 재게 된다.
# 실물 정본 사진은 조명이 구워져 있어 생짜 크롭의 이음매비가 3.76 이었다 — 그 성질을 흉내낸다.
for y in range(H):
    for x in range(W):
        d = ((x * 7 + y * 13) % 7) - 3        # 가는 결(실물 양모처럼 이웃 차가 작다)
        k = 0.58 + 0.84 * (x / W)             # 구워진 조명(크롭을 가로질러 ~12% 기울기)
        r, g, b = px[x, y]
        px[x, y] = tuple(max(0, min(255, int((c + d * s) * k)))
                         for c, s in ((r, 1), (g, 2), (b, 2)))
if ${눈 ? 'True' : 'False'}:
    # 검은 구슬 — «왼위 원점» 해석이 덮는 칸 안쪽에만 둔다(중심 해석 칸에는 안 닿게)
    cx, cy = ${중심[0]} + ${한변} // 2 + 20, ${중심[1]} + ${한변} // 2 + 20
    for y in range(cy - 30, cy + 30):
        for x in range(cx - 30, cx + 30):
            if (x - cx) ** 2 + (y - cy) ** 2 <= 900:
                px[x, y] = (8, 8, 10)
im.save(r'${사진.replace(/\\/g, '\\\\')}')
json.dump({'재질': {'펠트': {
    '정본사진': {'평상복': 'photo.png', '특별': 'photo.png'},
    '울패치': {'${키}': [${중심[0]}, ${중심[1]}], '한변px': ${한변}},
}}, '색': {'마스코트': {'램프': [{'이름': 'Cherry Core', 'hex': '#FB7A87'}]}}},
    open(r'${토큰.replace(/\\/g, '\\\\')}', 'w', encoding='utf-8'))
`;
  const r = spawnSync(PY, ['-c', py], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  assert.strictEqual(r.status, 0, `픽스처 생성 실패: ${r.stderr}`);
  return { 사진, 토큰 };
}

function 임시() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'felt-'));
}

if (!PY) {
  skip('파이썬+Pillow+numpy 가 없다 — 탐지 불가를 통과로 위장하지 않는다(F296·F207)');
} else {
  test('① 토큰 좌표를 «중심»으로 읽는다 — 원점으로 읽으면 눈알이 섞인다(F472)', () => {
    const dir = 임시();
    const { 토큰 } = 픽스처(dir, { 눈: true });
    const r = 돌리기(['절단'], { SYNK_FELT_TOKEN: 토큰, SYNK_FELT_ROOT: dir, SYNK_FELT_LIB: path.join(dir, 'lib') });
    assert.strictEqual(r.status, 0,
      `중심 해석이면 깨끗해서 통과해야 한다 — 죽었다면 원점으로 읽고 있다:\n${r.stdout}\n${r.stderr}`);
    assert.match(r.stdout, /«중심»/, '어느 해석을 쓰는지 출력에 밝혀야 한다(다음 사람이 또 속는다)');
    // 중심 크롭은 눈알을 안 물었어야 한다
    assert.match(r.stdout, /저채도[^\n]*0\.00%/, `중심 크롭에 저채도가 섞였다:\n${r.stdout}`);
  });

  test('② 더러운 패치는 «거부»한다 — 오염된 타일이 라이브러리 정본이 되지 않게', () => {
    const dir = 임시();
    // 눈알을 중심 칸 한복판에 둔다 = 어떻게 읽어도 더러운 그림
    const { 토큰 } = 픽스처(dir, { 눈: false });
    const 더럽히기 = spawnSync(PY, ['-c', `
from PIL import Image
im = Image.open(r'${path.join(dir, 'photo.png').replace(/\\/g, '\\\\')}')
px = im.load()
for y in range(320 - 40, 320 + 40):
    for x in range(510 - 40, 510 + 40):
        px[x, y] = (8, 8, 10)
im.save(r'${path.join(dir, 'photo.png').replace(/\\/g, '\\\\')}')
`], { encoding: 'utf8' });
    assert.strictEqual(더럽히기.status, 0, 더럽히기.stderr);
    const r = 돌리기(['절단'], { SYNK_FELT_TOKEN: 토큰, SYNK_FELT_ROOT: dir, SYNK_FELT_LIB: path.join(dir, 'lib') });
    assert.notStrictEqual(r.status, 0, `더러운 패치를 통과시켰다 — 자기검사가 안 돈다:\n${r.stdout}`);
    assert.match(r.stdout + r.stderr, /양모가 아니다|F472/,
      '거부 사유가 「무엇을 어떻게 고치나」를 말해야 한다(따를 수 없는 처방은 우회를 낳는다 · F103)');
  });

  /* ②는 «검은» 오염만 막는다 — 변이로 저채도 문을 껐더니 ②가 그대로 통과했다(암부 문이 대신 잡았다).
   * 실물에서 가장 흔한 오염은 검정이 아니라 **크림 손스티치**다: 채도는 0 인데 밝아서 암부 문에 안 걸린다.
   * 그래서 「저채도 문」을 따로 못박는다 — 두 문이 각각 자기 몫을 지는지 보이게. */
  test('②-b 밝은 저채도 오염(크림 스티치)도 거부한다 — 암부 문이 대신 잡아주지 않는 자리', () => {
    const dir = 임시();
    const { 토큰 } = 픽스처(dir, { 눈: false });
    const 사진 = path.join(dir, 'photo.png').replace(/\\/g, '\\\\');
    const 스티치 = spawnSync(PY, ['-c', `
from PIL import Image
im = Image.open(r'${사진}')
px = im.load()
for y in range(320 - 40, 320 + 40):
    for x in range(510 - 40, 510 + 40):
        px[x, y] = (238, 233, 224)   # 크림 — L* ~92(밝다) · C* ~4(무채) → 암부 문에는 안 걸린다
im.save(r'${사진}')
`], { encoding: 'utf8' });
    assert.strictEqual(스티치.status, 0, 스티치.stderr);
    const r = 돌리기(['절단'], { SYNK_FELT_TOKEN: 토큰, SYNK_FELT_ROOT: dir, SYNK_FELT_LIB: path.join(dir, 'lib') });
    assert.notStrictEqual(r.status, 0, `크림 스티치가 섞인 패치를 통과시켰다:\n${r.stdout}`);
    assert.match(r.stdout + r.stderr, /저채도/,
      `막긴 막았는데 «저채도» 사유가 아니다 — 저채도 문이 안 도는 것일 수 있다:\n${r.stdout}`);
  });

  /* 그리고 암부 문도 자기 몫이 따로 있다(변이로 껐더니 ②가 통과했다 — 검은 구슬은 «무채»라
   * 저채도 문이 대신 잡아준다). 암부만 잡는 자리 = **진한 접힘 그림자**: 채도는 살아 있는데 어둡다.
   * 그런 자리로 타일을 뜨면 이어붙일 때 어두운 얼룩이 주기적으로 찍힌다. */
  test('②-c 어둡지만 «채도 있는» 접힘 그림자도 거부한다 — 저채도 문이 못 잡는 자리', () => {
    const dir = 임시();
    const { 토큰 } = 픽스처(dir, { 눈: false });
    const 사진 = path.join(dir, 'photo.png').replace(/\\/g, '\\\\');
    const 그림자 = spawnSync(PY, ['-c', `
from PIL import Image
im = Image.open(r'${사진}')
px = im.load()
for y in range(320 - 40, 320 + 40):
    for x in range(510 - 40, 510 + 40):
        px[x, y] = (74, 8, 3)    # 진한 접힘 그림자 — 어둡지만(L*<20) 채도는 살아 있다(C*>14)
im.save(r'${사진}')
`], { encoding: 'utf8' });
    assert.strictEqual(그림자.status, 0, 그림자.stderr);
    const r = 돌리기(['절단'], { SYNK_FELT_TOKEN: 토큰, SYNK_FELT_ROOT: dir, SYNK_FELT_LIB: path.join(dir, 'lib') });
    assert.notStrictEqual(r.status, 0, `진한 그림자가 섞인 패치를 통과시켰다:\n${r.stdout}`);
    assert.match(r.stdout + r.stderr, /암부/,
      `막긴 막았는데 «암부» 사유가 아니다 — 암부 문이 안 도는 것일 수 있다:\n${r.stdout}`);
  });

  test('③ 거울 타일은 이음매가 0 이고 결을 안 깎는다 — 기본값이 그래서 거울이다', () => {
    const dir = 임시();
    const { 토큰 } = 픽스처(dir, { 눈: true });
    const r = 돌리기(['절단'], { SYNK_FELT_TOKEN: 토큰, SYNK_FELT_ROOT: dir, SYNK_FELT_LIB: path.join(dir, 'lib') });
    assert.strictEqual(r.status, 0, r.stderr);
    const 읽기 = (앞) => {
      const 줄 = r.stdout.split('\n').find((l) => l.trim().startsWith(앞));
      assert.ok(줄, `${앞} 줄이 없다:\n${r.stdout}`);
      const m = 줄.match(/([\d.]+)%\s+([\d.]+)/);
      assert.ok(m, `${앞} 줄을 못 읽었다: ${줄}`);
      return { 보존: Number(m[1]), 이음매: Number(m[2]) };
    };
    const 거울 = 읽기('거울');
    const 원본 = 읽기('원본');
    const 엇갈림 = 읽기('엇갈림');
    // 거울의 값어치 = 이음매를 «공짜로» 없앤다. 격자 픽스처라 0.4%p 는 흔들린다(실물 양모는 100.0%).
    assert.ok(거울.보존 >= 99.0, `거울이 결을 깎았다 — ${거울.보존}%`);
    assert.ok(거울.이음매 < 0.001, `거울에 이음매가 생겼다 — ${거울.이음매}`);
    // 그리고 «왜 기본값이 거울인가» 를 못박는다 — 엇갈림은 같은 이음매를 결로 산다.
    assert.ok(원본.이음매 > 1.3, `원본에 이음매가 안 보인다 — 픽스처가 결을 안 냈다(${원본.이음매})`);
    assert.ok(엇갈림.보존 < 거울.보존,
      `엇갈림이 결을 안 깎았다면 기본값 판단이 바뀐다 — 엇갈림 ${엇갈림.보존}% vs 거울 ${거울.보존}%`);
  });

  test('④ 그 사진에 안 맞는 좌표는 «조용히 자르지» 않고 죽는다(F472 갈래 ㉡)', () => {
    const dir = 임시();
    // 사진 밖으로 나가는 중심 — 크롭이 잘리면 크기가 달라진 채로 통과할 수 있다
    const { 토큰 } = 픽스처(dir, { 중심: [1010, 1010], 눈: false });
    const r = 돌리기(['절단'], { SYNK_FELT_TOKEN: 토큰, SYNK_FELT_ROOT: dir, SYNK_FELT_LIB: path.join(dir, 'lib') });
    assert.notStrictEqual(r.status, 0, `사진 밖 크롭을 통과시켰다:\n${r.stdout}`);
    assert.match(r.stdout + r.stderr, /사진 밖/, '왜 죽었는지 말해야 한다');
  });

  /* F472 를 «되살아날 수 없게» 만든 자리. 옛 키를 조용히 받아주면 라벨이 다시 갈리는 날
   * 이 도구가 눈알 섞인 타일을 「통과」의 얼굴로 낸다 — 그래서 받아주지 않고 이름을 시킨다. */
  test('④-b 옛 키 「원점」은 조용히 안 받는다 — 고칠 이름을 대며 죽는다', () => {
    const dir = 임시();
    const { 토큰 } = 픽스처(dir, { 눈: false, 키: '원점' });
    const r = 돌리기(['절단'], { SYNK_FELT_TOKEN: 토큰, SYNK_FELT_ROOT: dir, SYNK_FELT_LIB: path.join(dir, 'lib') });
    assert.notStrictEqual(r.status, 0, `옛 키를 그대로 받아줬다 — F472 가 되살아날 자리:\n${r.stdout}`);
    assert.match(r.stdout + r.stderr, /"원점" → "중심"/,
      '차단 사유가 시키는 그대로 고치면 통과해야 한다 — 따를 수 없는 처방은 우회를 낳는다(F103)');
  });

  test('⑤ 실저장소 — 진짜 정본 사진이 지금도 깨끗하게 잘린다(거짓양성만 검사)', () => {
    const 사진 = path.join(루트, 'docs', '캐릭터', '펠트코랄_0815', '재염색_본체.png');
    if (!fs.existsSync(사진)) return skip('정본 사진이 없다 — 실저장소 검사 건너뜀');
    const dir = 임시();
    const r = 돌리기(['절단'], { SYNK_FELT_LIB: dir });
    assert.strictEqual(r.status, 0, `정본 사진이 자기검사에서 죽었다 — 사진이 바뀌었나:\n${r.stdout}\n${r.stderr}`);
    assert.ok(fs.existsSync(path.join(dir, '원료_평상복.png')), '패치가 안 써졌다(08-15 개명 — 「중립」은 코랄 원료였다)');
  });

  /* ── 역할 층(08-15 · 유호 「가·나 한벌로」) — 중립·코랄·체리 세 분홍이 겹쳐 보인 수리 ㉮.
   * 라벨이 값과 다른 말을 하는 것이 이 라이브러리의 고질(F472)이라, 역할도 프로즈가 아니라
   * 장부+검증으로 못박는다. 탐지력은 픽스처가 진다 — 실저장소에는 거짓양성만 검사한다. */
  test('⑥ 절단·염색이 역할 장부를 쓴다 — 원료는 접두 강제, 체리 근접은 마스코트전용 자동', () => {
    const dir = 임시();
    const { 토큰 } = 픽스처(dir, { 눈: true });
    const lib = path.join(dir, 'lib');
    const env = { SYNK_FELT_TOKEN: 토큰, SYNK_FELT_ROOT: dir, SYNK_FELT_LIB: lib };
    assert.strictEqual(돌리기(['절단'], env).status, 0);
    // 파랑(체리에서 먼 색) → 공용
    assert.strictEqual(돌리기(['염색', '#4E7CFF', '--이름', '파랑'], env).status, 0);
    // 체리 코어 그대로 → 마스코트전용 «자동» — 실행규칙 ① 을 통로가 지킨다
    const 체 = 돌리기(['염색', '#FB7A87', '--이름', '체리'], env);
    assert.strictEqual(체.status, 0, 체.stderr);
    assert.match(체.stdout, /마스코트전용/, `체리 근접인데 자동 태그가 안 붙었다:\n${체.stdout}`);
    const 장 = JSON.parse(fs.readFileSync(path.join(lib, '라이브러리.json'), 'utf8'))['패치'];
    assert.strictEqual(장['원료_평상복']?.역할, '원료', '절단이 원료 역할을 안 올렸다');
    assert.strictEqual(장['파랑']?.역할, '공용');
    assert.strictEqual(장['체리']?.역할, '마스코트전용');
    // 검증 명령이 이 상태를 초록으로 읽어야 한다(자기 처방 되먹임 · F103)
    const v = 돌리기(['역할'], env);
    assert.strictEqual(v.status, 0, `통로로만 만든 라이브러리가 검증에서 죽었다:\n${v.stdout}\n${v.stderr}`);
  });

  test('⑥-b 체리 근접을 «공용»으로 내달라면 죽는다 — 실행규칙 ① 은 플래그로 못 뚫는다', () => {
    const dir = 임시();
    const { 토큰 } = 픽스처(dir, { 눈: true });
    const lib = path.join(dir, 'lib');
    const env = { SYNK_FELT_TOKEN: 토큰, SYNK_FELT_ROOT: dir, SYNK_FELT_LIB: lib };
    assert.strictEqual(돌리기(['절단'], env).status, 0);
    const r = 돌리기(['염색', '#FB7A87', '--이름', '체리2', '--역할', '공용'], env);
    assert.notStrictEqual(r.status, 0, `체리를 공용으로 냈다 — 겹침이 라이브러리로 되돌아온다:\n${r.stdout}`);
    assert.match(r.stdout + r.stderr, /마스코트전용/, '거부 사유가 고칠 길을 말해야 한다(F103)');
  });

  test('⑥-c 검증은 통로 밖 패치·역할 위조를 잡는다 — 새는 방향은 언제나 「통과」라서', () => {
    const dir = 임시();
    const { 토큰 } = 픽스처(dir, { 눈: true });
    const lib = path.join(dir, 'lib');
    const env = { SYNK_FELT_TOKEN: 토큰, SYNK_FELT_ROOT: dir, SYNK_FELT_LIB: lib };
    assert.strictEqual(돌리기(['절단'], env).status, 0);
    assert.strictEqual(돌리기(['염색', '#FB7A87', '--이름', '체리'], env).status, 0);
    // ①통로 밖에서 굴러들어온 미등록 패치
    fs.copyFileSync(path.join(lib, '원료_평상복.png'), path.join(lib, '몰래.png'));
    const r1 = 돌리기(['역할'], env);
    assert.notStrictEqual(r1.status, 0, `미등록 패치를 통과시켰다:\n${r1.stdout}`);
    assert.match(r1.stdout + r1.stderr, /몰래/, '어느 패치가 문제인지 이름을 대야 한다');
    fs.rmSync(path.join(lib, '몰래.png'));
    // ②장부를 손으로 고쳐 체리를 공용으로 위조 — 실물 픽셀을 재는 검증이 잡아야 한다
    const 장부경로 = path.join(lib, '라이브러리.json');
    const 장 = JSON.parse(fs.readFileSync(장부경로, 'utf8'));
    장['패치']['체리']['역할'] = '공용';
    fs.writeFileSync(장부경로, JSON.stringify(장, null, 1));
    const r2 = 돌리기(['역할'], env);
    assert.notStrictEqual(r2.status, 0, `장부 위조(체리→공용)를 통과시켰다 — 실측이 아니라 장부를 믿고 있다:\n${r2.stdout}`);
    assert.match(r2.stdout + r2.stderr, /실행규칙|마스코트전용/, '왜 안 되는지 근거 규칙을 대야 한다');
  });

  test('⑥-d 옛 이름 「중립_평상복」 은 조용히 안 받는다 — 고칠 이름을 대며 죽는다(F472 문법)', () => {
    const dir = 임시();
    const { 토큰 } = 픽스처(dir, { 눈: true });
    const lib = path.join(dir, 'lib');
    const env = { SYNK_FELT_TOKEN: 토큰, SYNK_FELT_ROOT: dir, SYNK_FELT_LIB: lib };
    assert.strictEqual(돌리기(['절단'], env).status, 0);
    fs.renameSync(path.join(lib, '원료_평상복.png'), path.join(lib, '중립_평상복.png'));
    const r = 돌리기(['염색', '#4E7CFF'], env);
    assert.notStrictEqual(r.status, 0, `옛 이름을 그대로 받아줬다 — 「중립」 거짓 라벨이 되살아난다:\n${r.stdout}`);
    // ⚠「원료_평상복」 만 맞추면 안 된다 — 파일이 없어 «다른 사유»(재염색 실패)로 죽어도
    // 경로 문자열에 그 이름이 섞여 우연히 통과한다(변이 실측 08-15). 옛 이름을 «알아본» 증거를 요구한다.
    assert.match(r.stdout + r.stderr, /옛 이름|git mv/, '옛 이름을 알아보고 고칠 길(git mv → 원료_평상복)을 대야 한다(F103)');
  });

  /* ── 무채 base 모드(08-15 · ㉯ 연회색 원료) — 게인은 곱이라 유채 base 의 채도를 못 낮춘다.
   * 회색 base 가 저채도 색역을 여는데, 기존 마스크(채도 C*14 미만 = 안 칠함)는 회색 천을 통째로
   * 거부했다. --무채base 가 그 문을 연다 — 단 자격 검사(유채 ≤2%)가 오용(마스코트 사진)을 막는다. */
  test('⑦ 무채base — 회색 천이 저채도 목표(Slate)에 닿고, 자격 검사가 오용을 막는다', () => {
    const dir = 임시();
    const 색갈이 = path.join(루트, 'tools', '펠트색갈이.py');
    const 회색 = path.join(dir, 'gray.png');
    const 만들기 = spawnSync(PY, ['-c', `
from PIL import Image
im = Image.new('RGB', (256, 256), (161, 159, 165))   # 연회색 천(C* ~3)
px = im.load()
for y in range(256):
    for x in range(256):
        d = ((x * 7 + y * 13) % 7) - 3
        r, g, b = px[x, y]
        px[x, y] = (r + d, g + d * 2, b + d)
im.save(r'${회색.replace(/\\/g, '\\\\')}')
`], { encoding: 'utf8' });
    assert.strictEqual(만들기.status, 0, 만들기.stderr);
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };
    // ①회색 천 + --무채base → Slate ΔE ≤ 3 (기존 유채 base 에선 18.4 로 도달 밖이던 색)
    const r1 = spawnSync(PY, [색갈이, 회색, path.join(dir, 'slate.png'), '--목표', '#8A93AD', '--무채base'],
      { encoding: 'utf8', env });
    assert.strictEqual(r1.status, 0, `무채base 가 회색 천을 거부했다:\n${r1.stdout}\n${r1.stderr}`);
    const m = r1.stdout.match(/㉠[^\n]*ΔE2000 \*\*([\d.]+)\*\*/);
    assert.ok(m, `㉠ 정확도 줄이 없다:\n${r1.stdout}`);
    assert.ok(Number(m[1]) <= 3.0, `회색 base 에서 Slate 에 못 닿았다 — ΔE ${m[1]}`);
    // ②회색 천 + 플래그 없음 → 죽되, 고칠 길(--무채base)을 말한다(F103)
    const r2 = spawnSync(PY, [색갈이, 회색, path.join(dir, 'x.png'), '--목표', '#8A93AD'],
      { encoding: 'utf8', env });
    assert.notStrictEqual(r2.status, 0, '유채 마스크가 회색 천을 통과시켰다 — 마스크 축이 죽었다');
    assert.match(r2.stdout + r2.stderr, /무채base/, '거부 사유가 고칠 플래그를 말해야 한다(F103)');
    // ③유채 그림(픽스처 코랄) + --무채base → 자격 검사가 죽인다 — 눈·배경을 마스크 없이 칠하게 된다
    const { 사진 } = 픽스처(dir, { 눈: false });
    const r3 = spawnSync(PY, [색갈이, 사진, path.join(dir, 'y.png'), '--목표', '#8A93AD', '--무채base'],
      { encoding: 'utf8', env });
    assert.notStrictEqual(r3.status, 0, `유채 그림에 무채base 를 받아줬다 — 마스크가 지킬 것을 전면 도색한다:\n${r3.stdout}`);
    assert.match(r3.stdout + r3.stderr, /유채 픽셀/, '왜 자격 미달인지 분모를 말해야 한다');
  });

  test('⑥-e 실저장소 — 지금 라이브러리 7장이 역할 정합 초록이다(거짓양성만 검사)', () => {
    const lib = path.join(루트, 'docs', '캐릭터', '펠트패치_0815');
    if (!fs.existsSync(path.join(lib, '라이브러리.json'))) return skip('장부가 없다 — 건너뜀');
    const r = 돌리기(['역할']);
    assert.strictEqual(r.status, 0, `실저장소 역할 정합이 깨졌다:\n${r.stdout}\n${r.stderr}`);
    assert.match(r.stdout, /미등록 0/, '정합 요약이 안 나왔다');
  });
}
