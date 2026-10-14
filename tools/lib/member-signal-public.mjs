// 회원 혜택 앱 공개 빌드가 공통 시그널 틀(experiences/member-signal)을 묶는 규칙(2026-10-14).
// 로컬 서버는 /member-signal/… 절대 경로로 내주고, 공개본은 앱 폴더 안 signal/ 아래 상대 경로로 둔다.
import path from 'node:path';

export const SIGNAL_SOURCE = 'experiences/member-signal';
export const SIGNAL_DIR = 'signal';
export const SIGNAL_ASSETS = Object.freeze(['SUIT-Variable.woff2', 'InterTight-Regular.woff2', 'InterTight-Medium.woff2', 'InterTight-700.woff2', 'DMMono-Medium.woff2', 'SYNKArrow.woff2', 'synk-logo.svg', 'grain.svg', 'SUIT-OFL.txt', 'InterTight-OFL.txt', 'DMMono-OFL.txt']);

/** [공개 경로, 원본 경로] — 스타일과 그 안의 글꼴·그림 */
export function signalPublicFiles({ withTheme = false } = {}) {
  return [
    [`${SIGNAL_DIR}/signal.css`, `${SIGNAL_SOURCE}/signal.css`],
    ...(withTheme ? [[`${SIGNAL_DIR}/theme.js`, `${SIGNAL_SOURCE}/theme.js`]] : []),
    ...SIGNAL_ASSETS.map(name => [`${SIGNAL_DIR}/assets/${name}`, `${SIGNAL_SOURCE}/assets/${name}`]),
  ];
}

function replaceAllExact(text, old, replacement, name, { min = 1 } = {}) {
  const count = text.split(old).length - 1;
  if (count < min) throw Error(`Unexpected member signal contract (${name}): ${old}`);
  return text.replaceAll(old, replacement);
}

/**
 * index.html의 /member-signal/ 참조를 공개 상대 경로로 바꾼다.
 * keepTheme=false면 머리의 theme.js(고전 스크립트)를 빼고, 앱 모듈의 initTheme()이 대신 테마를 입힌다(기본 밤).
 */
export function signalPublicHtml(html, { keepTheme = false } = {}) {
  const theme = '<script src="/member-signal/theme.js"></script>';
  html = keepTheme ? replaceAllExact(html, theme, `<script src="./${SIGNAL_DIR}/theme.js"></script>`, 'theme script')
    : replaceAllExact(html, theme, '', 'theme script').replace(/\n[ \t]*\r?\n/g, '\n');
  html = replaceAllExact(html, 'href="/member-signal/signal.css"', `href="./${SIGNAL_DIR}/signal.css"`, 'signal stylesheet');
  html = replaceAllExact(html, '"/member-signal/assets/', `"./${SIGNAL_DIR}/assets/`, 'signal logo');
  if (html.includes('/member-signal/')) throw Error('Unexpected remaining /member-signal/ reference in index.html.');
  return html;
}

/** CSS 안 url()이 파일 위치 기준으로 공개 묶음 안의 파일을 가리키는지 */
export function cssUrlTargets(name, text) {
  const base = path.posix.dirname(name);
  return [...text.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/gi)].map(([, value]) => {
    if (value.startsWith('data:')) return { value, file: null };
    if (!value.startsWith('./') || /[?#\\%]/.test(value) || value.split('/').includes('..')) throw Error(`Unknown or non-local public asset in ${name}: ${value}`);
    return { value, file: path.posix.normalize(path.posix.join(base, value)) };
  });
}
