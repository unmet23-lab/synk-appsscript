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

  // 정본 21색 — 19색의 hex 원천 = docs/_archive/브랜드_색상키트_원본_CrewDossier_2026-08-01.html
  //             06 Slate 2색은 2026-08-07 유호님 확정 추가 (컨셉 정본 조항 ⓔ)
  const KIT = {
    '#f6f1e8': 'Cream', '#ff6b5c': 'Coral', '#1a2340': 'Navy', '#c8ff3d': 'Lime', '#171820': 'Ink',
    '#fbf7ee': 'Paper', '#efe7d7': 'Cream 2', '#e7ddc7': 'Cream 3',
    '#ffe9e4': 'Coral Wash', '#ffcfc6': 'Coral Soft', '#ff8877': 'Coral 2', '#e8543f': 'Coral 3',
    '#2a3358': 'Navy 3', '#131a32': 'Navy Ink', '#0f1730': 'Navy 2',
    '#ff3e88': 'KC Hot Pink', '#ff6ba8': 'KC Pink 2', '#ffd447': 'KC Sun', '#4e7cff': 'KC Cool Blue',
    '#8a93ad': 'Slate', '#5f657d': 'Slate 2',
  };

  // 팔레트 이름은 「오용 차단 장치」다 — 이름에 제한을 박아 두면 쓰는 사람이 규칙을 안 찾아봐도 걸린다.
  const PALETTES = [
    '01 Core',
    '02 Cream Family',
    '03 Coral Family',
    '04 Navy Family',
    '05 K-Culture (3색 Part 6 전용 · Sun=모드C 2도)', // v1.5 — Sun만 모드 C로 빠졌다
    '06 Slate (3층 잉크 · Slate=다크 / Slate 2=라이트)', // v1.8 — 바닥을 바꿔 쓰면 대비 미달
  ];

  // 시맨틱이 박힌 색 이름 — 지워지면 그 자리가 바로 오용된다(라임=v1.6, Sun=v1.5)
  const NAMED = {
    '#c8ff3d': 'Lime (앱 성장·획득 전용)',
    '#ffd447': 'KC Sun (Part6·겹침 잉크)',
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
  if (found.length !== 21) problems.push(`색이 ${found.length}개다 — 키트는 21색이다`);

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
    console.log('%c✅ 전부 일치 — 21색 · 팔레트 6개 이름 · 시맨틱 색 이름 2건', 'color:#027a48;font-weight:bold;font-size:14px');
  } else {
    console.log('%c✘ 정본과 어긋난 곳 ' + problems.length + '건', 'color:#b91c1c;font-weight:bold;font-size:14px');
    problems.forEach((p) => console.log('   • ' + p));
    console.log('%c정본 = docs/디자인_컨셉_정본_v1.md · memory brand-color-kit-2026-08-01', 'color:#667085');
  }
  return problems.length === 0 ? 'PASS' : problems;
})();
