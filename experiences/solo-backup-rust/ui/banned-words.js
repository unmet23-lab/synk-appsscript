// 화면 글 검사(설계 4.12 · T18). 손님이 보는 화면에 백업 도구의 속말이 나오면 실패다.
// 시험(tests/ui-words.test.cjs)과 tauri-driver 시험(test-support/ui-driver.cjs)이 같은 목록을 쓴다.
// 엔진이 내보내는 단계 글 · 오류 글(예: 「B2 암호화 저장소 연결 중」)은 화면에 그대로 옮기지 않고 screen-model.js가 제 말로 바꾼다.

// 한글 낱말은 글자 그대로 찾는다
const KO = ['스냅샷', '버킷', '출입증', '저장소', '레포', '리포지토리', '섀도 복사', '해시', '프룬', '팩 파일'];
// 라틴 낱말은 낱말 경계로 찾는다(「pack」이 「package」에 걸리지 않게)
const EN = ['restic', 'snapshot', 'snapshots', 'bucket', 'buckets', 'repository', 'repo', 'pack', 'packs', 'prune', 'forget', 'B2', 'Backblaze', 'S3', 'VSS', 'DPAPI', 'SHA-256', 'SHA256', 'hash', 'json', 'API', 'keyId', 'applicationKey', 'endpoint'];

export const BANNED = Object.freeze([...KO, ...EN]);

const enRe = new RegExp(`(?<![A-Za-z0-9])(${EN.map((w) => w.replace(/[-]/g, '\\-')).join('|')})(?![A-Za-z0-9])`, 'gi');

/** 글에서 걸린 낱말 목록(겹치지 않게, 처음 나온 차례로) */
export function findBanned(text) {
  const s = String(text || '');
  const hits = [];
  for (const w of KO) if (s.includes(w)) hits.push(w);
  for (const m of s.matchAll(enRe)) hits.push(m[1]);
  return [...new Set(hits)];
}

/** HTML 조각에서 보이는 글과 손님에게 읽히는 속성(aria-label · title · placeholder · alt)만 뽑는다 */
export function visibleText(html) {
  const s = String(html || '');
  const attrs = [...s.matchAll(/\s(?:aria-label|title|placeholder|alt)="([^"]*)"/g)].map((m) => m[1]);
  const body = s
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return `${body} ${attrs.join(' ')}`
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
