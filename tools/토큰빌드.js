#!/usr/bin/env node
// 토큰빌드 — 디자인 토큰 정본(docs/디자인_토큰.json)에서 CSS 변수 파일을 파생시킨다.
//
// 왜 있나: Coral 하나가 55개 파일·180곳에 손복사돼 있었다(2026-08-06 실측).
//   복사본은 언젠가 갈라지고, 갈라지는 방향은 조용하다. 값의 원천을 JSON 하나로 좁히고
//   소비 파일은 전부 여기서 「생성」한다 — 어긋날 수 있는 구조 자체를 없앤다(CLAUDE.md 신뢰성 3번째).
//   동결된 구 산출물은 소급하지 않는다. 새 산출물부터 이 통로를 쓴다.
//
// 사용법:
//   node tools/토큰빌드.js            # docs/tools/synk-tokens.css 생성
//   node tools/토큰빌드.js --check    # 생성물이 정본과 어긋나면 exit 1 (CI·테스트용)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
/* 표기 접기 정의는 저장소에 하나뿐이다(`tests/lib/소스검사.js`) — 손으로 접으면 CRLF 축만 막히고
 * 줄끝 공백은 샌다(도구층 실측 08-17: 12벌 전부 그 반쪽 · #Q101). */
const { 표기접기 } = require('../tests/lib/소스검사.js');
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));
const 토큰 = require(path.join(ROOT, 'docs', '디자인_토큰.json'));
/** 산출 경로 — 환경변수가 이음매다(테스트가 실파일 안 건드리고 --check 탐지력을 잰다). */
const OUT = process.env.SYNK_토큰_OUT
  ? path.resolve(process.env.SYNK_토큰_OUT)
  : path.join(ROOT, 'docs', 'tools', 'synk-tokens.css');

const slug = (이름) => 이름.toLowerCase().replace(/\s+/g, '-');

// 시맨틱 값은 킷 「이름」 참조다 — 모르는 이름이면 조용히 넘기지 않고 죽는다.
const 킷맵 = Object.fromEntries(토큰.색.킷.map((c) => [c.이름, c.hex]));
function hexOf(이름, 자리) {
  if (!킷맵[이름]) throw new Error(`시맨틱 「${자리}」가 킷에 없는 이름을 참조한다: ${이름}`);
  return 킷맵[이름];
}

function build() {
  const L = [];
  L.push('/* 자동 생성 — 손으로 고치지 말 것. 원천 = docs/디자인_토큰.json · 빌드 = node tools/토큰빌드.js */');
  L.push('/* 조항(코랄 글자 금지·순백 금지 등)의 정본 = DESIGN.md·디자인_컨셉_정본_v1.md — 변수는 값만 나른다. */');
  L.push(':root{');
  for (const c of 토큰.색.킷) L.push(`  --synk-${slug(c.이름)}:${c.hex}; /* ${c.직책} */`);
  const 라 = 토큰.색.시맨틱.라이트;
  L.push('  /* 시맨틱(라이트 기본) */');
  for (const [k, v] of Object.entries(라)) L.push(`  --synk-${slug(k)}:${hexOf(v, `라이트.${k}`)}; /* = ${v} */`);
  L.push(`  --synk-font:${토큰.서체.본문스택};`);
  L.push(`  --synk-font-mono:${토큰.서체.모노스택};`);
  L.push(`  --synk-mn-scale:${토큰.서체.몽골어보정};`);
  L.push('}');
  L.push('/* 다크 — 앱·반전면. 근거 = 컨셉 정본 코랄 5단 다크 열 + Lime 운용 */');
  L.push('[data-synk-theme="dark"]{');
  for (const [k, v] of Object.entries(토큰.색.시맨틱.다크)) L.push(`  --synk-${slug(k)}:${hexOf(v, `다크.${k}`)}; /* = ${v} */`);
  L.push('}');
  return L.join('\n') + '\n';
}

if (require.main === module) {
  /* 🔑 목록은 눈으로 정하지 않았다 — `CLI도구들()` 이 재고, 회귀 ④ 가 매번 다시 센다.
   * ⚠ **`build()` 보다 먼저** 판정한다 — 뒤에 두면 오타를 친 실행이 굽기를 다 하고 죽는다. */
  const 아는플래그 = ['--check'];
  const 플래그오류 = 인자게이트('토큰빌드', process.argv.slice(2), 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); process.exit(1); }
  const css = build();
  if (process.argv.includes('--check')) {
    const 현재 = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    // ⚠ 줄끝 표기는 내용이 아니다 — Windows 새 체크아웃(워크트리·CI 격리 사본)은 autocrlf 가 CRLF 로
    //   내려놓아 바이트 비교가 전부 거짓 적색이 됐다(2026-08-07 실측 · git diff 는 0건이었다).
    // 🔑 **양쪽을 같은 문으로 접는다** — 한쪽만 접으면 그 비대칭이 곧 다음 거짓 적색이다.
    if (표기접기(현재) !== 표기접기(css)) {
      console.error(`[토큰빌드] ${path.relative(ROOT, OUT)} 가 정본과 어긋난다 — node tools/토큰빌드.js 로 재생성하라.`);
      process.exit(1);
    }
    console.log('[토큰빌드] 정합 OK');
  } else {
    fs.writeFileSync(OUT, css);
    console.log(`[토큰빌드] ${path.relative(ROOT, OUT)} 생성 (킷 ${토큰.색.킷.length}색 + 시맨틱 + 서체)`);
  }
}

module.exports = { build, slug };
