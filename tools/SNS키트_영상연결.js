#!/usr/bin/env node
/**
 * SNS 키트 → 영상 프로젝트 연결 — HyperFrames(또는 다른 HTML 영상) 프로젝트에 키트 사본을 넣는다.
 * 원문: docs/디자인/SNS키트/README.md §9 (2026-10-01)
 *
 * 쓰는 법:  node tools/SNS키트_영상연결.js <영상 프로젝트 폴더>
 * 결과:     <프로젝트>/assets/synk-kit/
 *             kit.css      스크랩북 토큰·부품을 안에 합친 키트 스타일(서체 경로를 fonts/로 바꿈)
 *             motion.js    SynkMotion 프리셋
 *             fonts/       SUIT Variable · Inter Tight · DM Mono
 *             assets/      실땀·스티커·펠트 물건·로고·마스코트·사진
 *
 * 왜 복사하나: 렌더 서버는 프로젝트 폴더 밖(../)을 읽지 못한다. 원본은 키트에만 두고 고칠 때마다 다시 연결한다.
 * HyperFrames는 이름 붙인 글꼴마다 같은 파일 안의 @font-face를 요구하므로, 컴포지션 <style>에 아래 출력의
 * @font-face 네 줄을 붙여 넣는다(이 도구가 마지막에 출력한다).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KIT = path.join(ROOT, 'docs', '디자인', 'SNS키트');
const 대상 = process.argv[2];
if (!대상) { console.error('쓰는 법: node tools/SNS키트_영상연결.js <영상 프로젝트 폴더>'); process.exit(2); }
const 프로젝트 = path.resolve(대상);
if (!fs.existsSync(프로젝트)) { console.error('폴더가 없다:', 프로젝트); process.exit(2); }
const OUT = path.join(프로젝트, 'assets', 'synk-kit');
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });

const 글꼴 = [
  ['docs/브랜드_폰트/SUIT/SUIT-Variable.woff2', 'SUIT-Variable.woff2'],
  ['docs/브랜드_폰트/InterTight/InterTight-Medium.ttf', 'InterTight-Medium.ttf'],
  ['docs/브랜드_폰트/InterTight/InterTight-SemiBold.ttf', 'InterTight-SemiBold.ttf'],
  ['docs/브랜드_폰트/InterTight/InterTight-Bold.ttf', 'InterTight-Bold.ttf'],
  ['docs/브랜드_폰트/DM_Mono/DMMono-Medium.ttf', 'DMMono-Medium.ttf'],
];
for (const [src, name] of 글꼴) fs.copyFileSync(path.join(ROOT, src), path.join(OUT, 'fonts', name));

for (const f of fs.readdirSync(path.join(KIT, 'assets'))) fs.copyFileSync(path.join(KIT, 'assets', f), path.join(OUT, 'assets', f));

// kit.css: @import 한 스크랩북을 안에 합치고, 서체 경로를 fonts/로 바꾼다
let css = fs.readFileSync(path.join(KIT, 'kit.css'), 'utf8');
const sb = fs.readFileSync(path.join(ROOT, 'docs', '디자인', '펠트스크랩북', 'scrapbook.css'), 'utf8');
css = css.replace(/@import url\("\.\.\/펠트스크랩북\/scrapbook\.css"\);/, '/* ── 펠트 스크랩북(scrapbook.css) 합침 ── */\n' + sb + '\n/* ── SNS 키트 ── */');
css = css.replace(/url\("\.\.\/\.\.\/브랜드_폰트\/[^"]*\/([^"/]+)"\)/g, 'url("fonts/$1")');
fs.writeFileSync(path.join(OUT, 'kit.css'), css);
fs.copyFileSync(path.join(KIT, 'motion.js'), path.join(OUT, 'motion.js'));

// GSAP는 복사하지 않고 HyperFrames 공식 틀처럼 CDN 주소를 쓴다(컴파일러가 실패 때 대체 경로까지 챙긴다).
// 주의: 컴파일러는 로컬 스크립트를 페이지에 끼워 넣는다. 그래서 motion.js 안에 script 닫는 태그 문자열이 있으면
// 거기서 스크립트가 끊긴다(2026-10-01 'Invalid or unexpected token'으로 확인).
try { fs.rmSync(path.join(OUT, 'gsap.min.js')); } catch { /* 없으면 그만 */ }

console.log('연결함', path.relative(ROOT, OUT));
console.log('GSAP: <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>');
console.log('컴포지션 <style>에 붙일 @font-face:');
console.log(`@font-face{font-family:'SUIT Variable';font-weight:100 900;src:url("assets/synk-kit/fonts/SUIT-Variable.woff2") format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:400 600;src:url("assets/synk-kit/fonts/InterTight-SemiBold.ttf")}
@font-face{font-family:'Inter Tight';font-weight:700 900;src:url("assets/synk-kit/fonts/InterTight-Bold.ttf")}
@font-face{font-family:'DM Mono';font-weight:400 700;src:url("assets/synk-kit/fonts/DMMono-Medium.ttf")}`);
console.log('9:16 장면은 section 바로 안의 <div class="k-center">에 내용을 넣는다(가운데 배치 기본, README §9 배치).');
