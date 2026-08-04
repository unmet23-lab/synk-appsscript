#!/usr/bin/env node
// 발표물빌드 — `docs/발표물/_src_*.html` 을 브랜드 폰트 임베드본으로 굽는다.
//
// 왜 있나 (유호님 08-05 확정 "임베드 통로에 태운다"):
//   발표물 6종은 폰트를 **이름으로만** 지정하고 있었다. 그 폰트가 깔린 기계에서만 제대로 나오고,
//   안 깔린 기계에선 맑은고딕·굴림으로 조용히 폴백한다 — 화면은 멀쩡해 보이고 종이에서만 틀린다.
//   이 PC 가 정확히 그 상태였다(설치된 브랜드 폰트는 SUIT 뿐). 임베드하면 기계를 안 탄다.
//
// 왜 스크립트인가: 손으로 6번 부르면 언젠가 5번만 부른다. 그때 빠진 1개는 **초록으로 보인다**
//   (파일이 그대로 있으니까). 목록을 손으로 들지 않고 `_src_` 규칙에서 파생시킨다.
//
// 사용법:
//   node tools/발표물빌드.js            # HTML 만
//   node tools/발표물빌드.js --pdf      # PDF 까지 (헤드리스 크롬)
//   node tools/발표물빌드.js --check    # 굽지 않고 「빌드가 필요한가」만 본다(CI·배포 게이트용)
//
// 종료 코드: 실패·미갱신이 있으면 1.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
// 픽스처 이음매 — 회귀가 실저장소를 건드리지 않고 탐지력을 잴 수 있게 한다(bump-version 의 SYNK_BUMP_ROOT 와 같은 계열).
const DIR = process.env.SYNK_PRESENT_ROOT || path.join(ROOT, 'docs', '발표물');
const EMBED = path.join(ROOT, 'docs', 'tools', '브랜드폰트_임베드.py');
const SRC_PREFIX = '_src_';

/** 소스 → 산출물 이름. 접두만 뗀다 — 산출물 파일명은 절대 안 바꾼다(대외 링크·유호님 즐겨찾기가 걸려 있다). */
const outNameOf = (srcName) => srcName.slice(SRC_PREFIX.length);

const MARKER = '/*@FONTS@*/';

/** 줄끝만 통일한다 — 파이썬 write_text·git autocrlf 를 거치며 CRLF 가 섞여도 내용 대조가 안 흔들리게. */
const normalize = (s) => s.replace(/\r\n/g, '\n');

/**
 * 산출물에서 임베드된 @font-face 묶음을 도로 마커로 되돌린다 → 소스와 1:1 비교가 된다.
 * 빌드가 `marker → faces.join('\n')` 이라 되돌리는 것도 그 한 덩어리다.
 * base64 안엔 `}` 가 안 나온다(알파벳이 A-Za-z0-9+/=) — `[^}]*` 가 안전한 이유.
 */
const unembed = (html) =>
  normalize(html).replace(/@font-face\{[^}]*\}(?:\n@font-face\{[^}]*\})*/, MARKER);

/** 파이썬 실행기를 찾는다. 못 찾으면 **통과가 아니라 실패** — 조용히 건너뛰면 낡은 산출물이 초록으로 남는다. */
function findPython() {
  for (const cmd of ['python', 'py', 'python3']) {
    const r = spawnSync(cmd, ['-c', 'import fontTools, brotli'], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return cmd;
  }
  return null;
}

function sources() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR)
    .filter((f) => f.startsWith(SRC_PREFIX) && f.endsWith('.html'))
    .sort();
}

function main() {
  const args = process.argv.slice(2);
  const wantPdf = args.includes('--pdf');
  const checkOnly = args.includes('--check');

  const srcs = sources();
  if (!srcs.length) {
    console.error(`🔴 ${path.relative(ROOT, DIR)} 에 ${SRC_PREFIX}*.html 이 0건 — 경로가 바뀌었는지 확인하라.`);
    console.error('   (0건을 「할 일 없음」으로 넘기면 스캔이 조용히 죽은 것을 못 본다)');
    return 1;
  }

  // --check = 「산출물이 이 소스에서 나온 게 맞는가」를 **내용으로** 본다. 굽지 않으므로 파이썬이 없어도 답한다.
  //
  // ⚠ mtime 으로 재면 **CI 에서 깨진다**(08-05 실측: 로컬 1254/0 초록인데 원격은 빨강).
  //   git 은 파일 시각을 보존하지 않는다. 새 클론에선 모든 파일이 체크아웃 시각을 받는데,
  //   그 순서를 정하는 건 **체크아웃 쓰기 순서**다 — `01_….html` 이 `_src_01_….html` 보다
  //   먼저 쓰이므로 **소스가 항상 더 새로 보인다.** 그래서 플래키가 아니라 **매번 결정적으로**
  //   6/6 걸렸고, 로컬(빌드 직후라 산출물이 더 새로움)에선 영원히 안 걸린다.
  //   (원인 특정은 옆 세션 local_ab10e000 의 지적 — 나는 「순서가 제멋대로」까지만 봤다.)
  //   시각은 repo 밖 환경 상태지 내용이 아니다 → 판정을 내용으로 옮겼다. 내용 대조는 더 세다:
  //   「소스를 고치고 안 구웠다」를 시각이라는 대리 지표가 아니라 **차이 자체**로 잡는다.
  if (checkOnly) {
    const stale = [];
    for (const s of srcs) {
      const out = path.join(DIR, outNameOf(s));
      if (!fs.existsSync(out)) { stale.push(`${outNameOf(s)} — 산출물 없음`); continue; }
      const html = fs.readFileSync(out, 'utf8');
      if (!/@font-face/.test(html)) { stale.push(`${outNameOf(s)} — 산출물에 @font-face 가 없다(임베드 안 된 사본)`); continue; }
      if (html.includes(MARKER)) { stale.push(`${outNameOf(s)} — 마커가 그대로 남았다(치환 실패본)`); continue; }
      if (unembed(html) !== normalize(fs.readFileSync(path.join(DIR, s), 'utf8'))) {
        stale.push(`${outNameOf(s)} — 소스와 산출물 내용이 어긋난다(소스를 고치고 안 구웠다)`);
      }
    }
    if (stale.length) {
      console.log(`🔴 발표물 빌드 필요 ${stale.length}건 — \`node tools/발표물빌드.js --pdf\` 를 돌려라`);
      stale.forEach((s) => console.log(`   - ${s}`));
      return 1;
    }
    console.log(`✅ 발표물 ${srcs.length}종 전부 최신 (임베드본 확인)`);
    return 0;
  }

  const py = findPython();
  if (!py) {
    console.error('🔴 python + fontTools + brotli 를 못 찾았다. `pip install fonttools brotli`');
    return 1;
  }

  let fail = 0;
  for (const s of srcs) {
    const src = path.join(DIR, s);
    const out = path.join(DIR, outNameOf(s));
    const cmd = [EMBED, src, out];
    if (wantPdf) cmd.push('--pdf', out.replace(/\.html$/, '.pdf'));

    console.log(`\n── ${outNameOf(s)}`);
    const r = spawnSync(py, cmd, { encoding: 'utf8', timeout: 300000 });
    if (r.stdout) process.stdout.write(r.stdout.replace(/^/gm, '   '));
    if (r.status !== 0) {
      fail++;
      console.error(`   🔴 실패 (rc=${r.status})`);
      if (r.stderr) console.error(r.stderr.replace(/^/gm, '   '));
      continue;
    }

    // 「돌았다」가 아니라 **결과**를 본다 — 치환이 안 돼도 rc 0 으로 끝날 수 있다.
    const html = fs.readFileSync(out, 'utf8');
    if (!/@font-face/.test(html) || html.includes('/*@FONTS@*/')) {
      fail++;
      console.error('   🔴 산출물에 임베드가 안 들어갔다(마커 잔존 또는 @font-face 없음)');
    }
  }

  console.log(`\n${fail ? '🔴' : '✅'} 발표물 ${srcs.length}종 · 실패 ${fail}건`);
  return fail ? 1 : 0;
}

process.exit(main());
