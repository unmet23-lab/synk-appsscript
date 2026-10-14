// 로컬 앱 서버가 공통 시그널 틀을 내주는 허용 목록. 공개 빌드는 tools/prepare-*-public.mjs가 같은 파일을 묶는다.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
export const MEMBER_SIGNAL_FILES = Object.freeze(['signal.css', 'signal.mjs', 'theme.js', ...['SUIT-Variable.woff2', 'InterTight-Regular.woff2', 'InterTight-Medium.woff2', 'InterTight-700.woff2', 'DMMono-Medium.woff2', 'SYNKArrow.woff2', 'synk-logo.svg', 'grain.svg'].map(name => `assets/${name}`)]);

/** [요청 경로, 파일 경로] 목록 */
export function memberSignalRoutes() {
  return MEMBER_SIGNAL_FILES.map(name => [`/member-signal/${name}`, path.join(root, name)]);
}
