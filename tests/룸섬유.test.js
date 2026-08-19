/**
 * Loom 섬유 레시피 — **한 벌인지**를 기계로 센다 (2026-08-19 · 유호 지시 08-18 「섬유 하나로 좁힌다」).
 *
 * 왜 이 검사인가: 섬유를 굽는 자리가 둘이다 —
 *   · `tools/룸털.py`   = 축을 재는 시험대
 *   · `tools/룸장면.py` = 지면이 쓰는 부품(원판·판·칩)
 * 레시피를 두 벌로 적으면 그 순간 갈라지고, **갈라지는 방향은 언제나 「통과」**다:
 * 한쪽만 고친 날 시험대는 좋아 보이는데 지면의 부품은 옛 값 그대로 구워진다(F517 계보).
 *
 * ⚠ `bpy` 는 이 저장소 밖(Blender 안)이라 **동작은 못 잰다** — 여기서 재는 것은 «갈라짐»뿐이고,
 *   그 사실을 적어 둔다(안 적으면 다음 사람이 이 초록을 「털이 잘 나온다」로 읽는다 · F207).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 읽기 = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const 모듈 = 'tools/lib/룸섬유.py';
const 쓰는것 = ['tools/룸털.py', 'tools/룸장면.py'];

/** 레시피의 «서명» — 이 낱말들이 모듈 밖에 있으면 그건 사본이다. */
const 서명 = ['ShaderNodeBsdfHairPrincipled', "st.type = 'HAIR'", 'rendered_child_count'];

test('① 레시피 모듈이 실재하고, 서명 전량을 들고 있다', () => {
  const m = 읽기(모듈);
  for (const s of 서명) {
    assert.ok(m.includes(s), `레시피 모듈에 «${s}» 가 없다 — 서명이 낡았거나 모듈이 빈 껍데기다`);
  }
  assert.ok(/def 털입히기\(/.test(m), '공용 통로 `털입히기()` 가 없다');
  assert.ok(/def 가닥진단\(/.test(m), '`가닥진단()` 이 없다 — 「가닥 0 인데 렌더는 멀쩡」이 안 드러난다');
});

test('② 굽는 두 자리가 «부르기만» 한다 — 사본 0 (갈라짐 가드)', () => {
  const 사본 = [];
  for (const p of 쓰는것) {
    const 글 = 읽기(p);
    assert.match(글, /import 룸섬유/, `${p} 가 공용 레시피를 안 부른다`);
    for (const s of 서명) {
      if (글.includes(s)) 사본.push(`${p} — «${s}» 를 자기 안에 들고 있다(사본)`);
    }
  }
  assert.deepEqual(사본, [],
    `레시피가 두 벌이 됐다 — 한쪽만 고친 날 지면의 부품은 옛 값으로 구워진다:\n  ${사본.join('\n  ')}`);
});

test('③ 탐지력 — 서명 한 줄만 베껴 넣어도 ② 가 잡는다(픽스처)', () => {
  /* 실저장소만 재면 「지금 사본이 없다」와 「검사가 안 돈다」가 같은 모양이다. */
  const 가짜 = "import 룸섬유\nhair = nt.nodes.new('ShaderNodeBsdfHairPrincipled')\n";
  const 걸린것 = 서명.filter((s) => 가짜.includes(s));
  assert.deepEqual(걸린것, ['ShaderNodeBsdfHairPrincipled'],
    '픽스처에서조차 서명을 못 잡는다 — ② 는 그냥 안 도는 검사다');
});

test('④ 굵기는 «손대지 않는다» — 유호 판정 08-18 을 코드가 아니라 부재로 지킨다', () => {
  const m = 읽기(모듈);
  assert.ok(!/root_radius|tip_radius/.test(m),
    '가닥 굵기를 손으로 고정했다 — 균일함 자체가 「기하학적이고 징그럽다」의 범인이었다(유호 판정 08-18). '
    + '기본값(뿌리→끝으로 자연히 가늘어짐)을 그대로 둔다.');
  assert.match(m, /굵기는 «건드리지 않는다»/, '그 이유가 코드 옆에 안 적혀 있다 — 다음 사람이 다시 넣는다');
});

test('⑤ 재질 축이 «기본값을 안 바꿨다» — 이미 구운 자산이 통째로 갈리는 것을 막는다', () => {
  const 장면 = 읽기('tools/룸장면.py');
  assert.match(장면, /재질 = 값\("--재질", "유리"\)/,
    '`--재질` 기본이 유리가 아니다 — 기본을 털로 바꾸면 구운 자산 8벌이 한 번에 갈린다(별도 트랙)');
  assert.match(장면, /def 몸재질\(/, '재질 갈래가 한 자리에 안 모였다 — 세 부품이 각자 고르면 어긋난다');
});

test('⑥ 섬유 렌더 프로파일 — «털일 때만» 켜지고 유리 경로는 안 건드린다', () => {
  const 장면 = 읽기('tools/룸장면.py');
  assert.match(장면, /if 재질 == "털":\s*\n\s*c\.max_bounces = 8/,
    '섬유 프로파일이 없거나 게이트(`if 재질 == "털"`) 밖에 있다 — 유리 예산(투과 32튐)을 '
    + '그대로 쓰면 500px·64샘플이 11분을 넘긴다(2026-08-19 실측 타임아웃)');
  assert.match(장면, /c\.transmission_bounces = 32/,
    '유리 기본 경로(32튐)가 사라졌다 — 섬유 프로파일이 그 위에 있어야지 대체하면 안 된다');
});

test('⑦ 형태 축(NEXP·축비)이 상수가 아니라 레버다 — 유호님이 고르는 자리', () => {
  const 시험대 = 읽기('tools/룸털.py');
  assert.match(시험대, /NEXP = float\(인자\("--지수", "4\.2"\)\)/,
    '형태 지수가 CLI 인자가 아니라 상수로 박혀 있다 — 설계 §3-4b D 는 「형태는 디자인 결정이라 '
    + '유호님 몫」이라 적었는데, 상수면 굽는 사람만 고를 수 있다');
  assert.match(시험대, /축비 = tuple/, '축 비율도 인자로 못 받는다');
});

