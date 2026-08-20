/* Canva 브랜드 키트 대조기 — 브라우저 콘솔에 붙여넣어 실행한다.
 *
 * 왜 이 파일이 필요한가:
 *   repo의 테스트는 Canva 안을 볼 수 없다. 사람이 색을 바꾸거나 팔레트 이름을 손대면
 *   **조용히** 정본과 어긋나고, 아무도 모른 채 그 키트로 산출물이 나간다.
 *   실제로 2026-08-03에 그 드리프트가 발견됐다 — 팔레트 이름이 `05 K-Culture (Part 6 only)`인 채였는데
 *   정본 v1.5가 KC Sun을 모드 C 2도 잉크로 빼내 「Part 6 only」가 그 색에는 거짓이 돼 있었다.
 *   색 이름(`KC Sun (Part6·겹침 잉크)`)만 갱신되고 팔레트 이름은 낡은 채 남아 서로 모순이었다.
 *
 * 이 파일의 기대값은 `tests/브랜드색.test.js`가 정본 킷(디자인_토큰.json)과 대조해 **낡지 않게 잠근다** —
 * 검증기가 스스로 낡으면 검증기가 있다는 사실이 더 위험하다.
 *
 * ── 쓰는 법 (유호님 기준 클릭 단위) ──────────────────────────────────
 *  1. 크롬에서 https://www.canva.com/brand/kAHO4v46jZ4/ingredient/IG-GNS-PuYTVP4d 를 연다
 *     (브랜드 키트 → 색상 화면. 스와치가 다 보일 때까지 잠깐 기다린다)
 *  2. F12 → 상단 탭에서 「Console」 클릭
 *  3. 이 파일 내용을 통째로 복사해 붙여넣고 Enter
 *  4. 초록 「✅ 전부 일치」가 뜨면 끝. 빨강이 뜨면 그 줄에 무엇이 어긋났는지 적혀 있다
 *
 * 글꼴은 Canva가 미리보기를 이미지로 그려서 텍스트로 못 읽는다 — 이 대조기의 범위 밖이다.
 * 글꼴은 슬롯 8개가 한글로 정상 렌더되는지 눈으로 본다(폴백되면 자형이 확 달라진다).
 */
(() => {
  'use strict';

  // 정본 42색 — 2027 킷 「내일 꾸러미」 41색(조항 ⓙ) + 다크 「양모 밤」 바탕 Ink Deep(조항 ⓚ · 둘 다 2026-08-20 유호님 확정).
      // ⚠ Canva 실물이 이 42색을 아직 안 받았으면 빨간불이 정상이다 — 정본이 앞서간 것이니 Canva 키트를 갱신한다(유호님 몫).
      // 🔑 키는 **반드시 소문자**다 — 조회가 aria-label 을 toLowerCase() 해서 비교한다(대문자로 적으면 그 색이 영영 「빠진 색」으로 잡힌다).
  const KIT = {
    '#fbb7a3': 'Coral Soft',
    '#fd9c87': 'Coral 2',
    '#f96859': 'Coral',
    '#ae322a': 'Coral 3',
    '#941f19': 'Coral Rim',
    '#fef0e9': 'Coral Wash',
    '#fbf7f0': 'Paper',
    '#2b2320': 'Ink',
    '#080605': 'Ink Deep',
    '#f0e3c8': 'Stitch',
    '#ede7dc': 'Oat',
    '#c7bfb2': 'Stone',
    '#8d857a': 'Ash Wool',
    '#575046': 'Deep Wool',
    '#c5d6f5': 'Lapis Soft',
    '#3d6bc9': 'Lapis',
    '#24448c': 'Lapis Deep',
    '#d3e8be': 'Meadow Soft',
    '#7db45a': 'Meadow',
    '#3f6b2e': 'Meadow Deep',
    '#ffebb0': 'Butter Soft',
    '#f5c445': 'Butter',
    '#7e5a10': 'Butter Deep',
    '#f8c7de': 'Pop Soft',
    '#e05c97': 'Pop',
    '#99295d': 'Pop Deep',
    '#ff3e88': 'KC Hot Pink',
    '#ff6ba8': 'KC Pink 2',
    '#ffd447': 'KC Sun',
    '#4e7cff': 'KC Cool Blue',
    '#e4e4e7': 'Chalk',
    '#eaeaea': 'Chalk 2',
    '#d1d2d4': 'Chalk 3',
    '#08090c': 'Graphite',
    '#1d1d1c': 'Graphite 2',
    '#262626': 'Graphite 3',
    '#373737': 'Graphite 4',
    '#8c8c8c': 'Ash',
    '#666666': 'Ash 2',
    '#c8ff3d': 'Lime',
    '#b8e836': 'Lime 2',
    '#13724a': 'Emerald',
  };

  // 팔레트 이름은 「오용 차단 장치」다 — 이름에 제한을 박아 두면 쓰는 사람이 규칙을 안 찾아봐도 걸린다.
  const PALETTES = [
    '01 Core',
    '02 Cream Family',
    '03 Coral Family',
    '04 Navy Family',
    '05 K-Culture (3색 Part 6 전용 · Sun=모드C 2도)', // v1.5 — Sun만 모드 C로 빠졌다
    '06 Slate (3층 잉크 · Slate=다크 / Slate 2=라이트)', // v1.8 — 바닥을 바꿔 쓰면 대비 미달
    /* v1.10 — 팔레트 이름은 **안 바꾼다**(유호님이 등록해 둔 것을 그대로 둔다). 이 문구는 "Lime 2 는"
     * 이라고 그 색을 지목하고 있어 Emerald 에 대해 거짓말을 하지 않는다. Emerald 의 제한은
     * 아래 NAMED 의 **스와치 이름**이 진다 — 색마다 자기 규칙을 이름에 달고 있으면 팔레트 이름을
     * 매번 고쳐 Canva 를 왕복할 필요가 없다. */
    '07 Lime Family (Lime 2 · 라이트에선 면으로만)',
  ];

  // 시맨틱이 박힌 색 이름 — 지워지면 그 자리가 바로 오용된다(라임=v1.6, Sun=v1.5)
  const NAMED = {
    '#c8ff3d': 'Lime (앱 성장·획득 전용)',
    '#ffd447': 'KC Sun (Part6·겹침 잉크)',
    '#b8e836': 'Lime 2 (라이트=면만)',
    '#13724a': 'Emerald (라이트 전용)',
  };

  const leaves = [...document.querySelectorAll('*')]
    .filter((e) => e.childElementCount === 0)
    .map((e) => (e.textContent || '').trim());

  const swatches = [...document.querySelectorAll('[aria-label]')]
    .map((e) => (e.getAttribute('aria-label') || '').trim().toLowerCase())
    .filter((v) => /^#[0-9a-f]{6}$/.test(v));

  const problems = [];

  if (!swatches.length) {
    console.log('%c⚠ 스와치를 하나도 못 읽었다 — 색상 화면이 맞는지, 다 로드됐는지 확인하고 다시 실행하라',
      'color:#b45309;font-weight:bold');
    return;
  }

  const found = [...new Set(swatches)];
  for (const [hex, name] of Object.entries(KIT)) {
    if (!found.includes(hex)) problems.push(`빠진 색: ${name} ${hex}`);
  }
  for (const hex of found) {
    if (!KIT[hex]) problems.push(`키트에 없는 색이 들어와 있다: ${hex}`);
  }
  // 개수는 **KIT 에서 파생한다.** 여기 숫자를 손으로 적으면 색이 느는 날 KIT 만 갱신되고
  // 이 줄이 낡아, 올바른 키트를 보고 빨간불을 낸다(v1.10 에서 실제로 22 인 채 남았다).
  const 킷개수 = Object.keys(KIT).length;
  if (found.length !== 킷개수) problems.push(`색이 ${found.length}개다 — 키트는 ${킷개수}색이다`);

  for (const p of PALETTES) {
    if (!leaves.includes(p)) {
      const near = leaves.filter((t) => /^0\d /.test(t));
      problems.push(`팔레트 이름 불일치 — 기대: 「${p}」 / 화면: ${JSON.stringify(near)}`);
    }
  }

  for (const [hex, label] of Object.entries(NAMED)) {
    if (!leaves.includes(label)) problems.push(`색 이름이 사라졌거나 바뀌었다 (${hex}) — 기대: 「${label}」`);
  }

  if (problems.length === 0) {
    console.log(`%c✅ 전부 일치 — ${킷개수}색 · 팔레트 ${PALETTES.length}개 이름 · 시맨틱 색 이름 ${Object.keys(NAMED).length}건`,
      'color:#027a48;font-weight:bold;font-size:14px');
  } else {
    console.log('%c✘ 정본과 어긋난 곳 ' + problems.length + '건', 'color:#b91c1c;font-weight:bold;font-size:14px');
    problems.forEach((p) => console.log('   • ' + p));
    console.log('%c정본 = docs/디자인_컨셉_정본_v1.md · memory brand-color-kit-2026-08-01', 'color:#667085');
  }
  return problems.length === 0 ? 'PASS' : problems;
})();
