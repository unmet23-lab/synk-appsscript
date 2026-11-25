import { isLoopback, publicUrl } from './core.mjs';

// Platform is the hub. This catalog grants no account or company access.
export const PATH_APP_URL = 'https://synk.im/path/app/';
export const PATH_INTERVIEW_URL = 'https://synk.im/path/interview/film/rehearsal.html';
export const APPLICATIONS = Object.freeze([
  Object.freeze({ id: 'world', name: 'SYNK WORLD', category: 'learn', keywords: ['한글 만나기', '바람길', '리듬', 'TOPIK', '싱크 타운'], subtitle: '한국어 게임과 TOPIK 연습', audience: '한국어를 배우는 사람 누구나', image: 'world-annyeong.webp', tags: ['한국어', '학습', '미니게임', 'TOWN', '과제', 'AI 코칭'], description: 'TOPIK 진단부터 쓰기 연습, 한국어 게임까지 들어 있어요. 내 연습 기록에 맞춰 다음 연습을 골라 줘요.', available: '미니게임은 설치 없이 웹에서 바로 할 수 있어요.' }),
  Object.freeze({ id: 'messenger', name: 'SYNK Workspace', category: 'work', keywords: ['메신저', '사내 메신저', 'Workspace'], subtitle: '팀이 대화하고 일하는 업무 앱', audience: 'SYNK 회사 구성원과 담당 교사', image: 'laptop.webp', tags: ['워크스페이스', '업무', '내 수업', '교사', '팀 대화', '파일', '협업'], description: '채널 대화와 회사 자료, 작업실이 한 앱에 있어요. 교사는 「내 수업」에서 맡은 반을 챙겨요.', available: '회사 일은 회사 초대를 받아야, 내 수업은 반을 맡은 교사로 등록돼야 열려요. SYNK ID만으로는 들어갈 수 없어요.' }),
  Object.freeze({ id: 'path', name: 'SYNK PATH', category: 'learn', webOnly: true, keywords: ['패스', '유학', '대학', '입학', '서류', '장학금', '면접', '진로', '취업'], subtitle: '대학 비교부터 서류, 입학 면접까지 챙기는 한국 유학 준비 앱', audience: '한국 유학·진로·취업을 준비하는 학습자', image: 'path-app-cards.webp', tags: ['한국 유학', '대학 비교', '서류 준비', '면접 연습'], description: '내 한국어와 성적, 준비한 돈을 넣으면 대학 모집 요강의 조건과 나란히 보여 줘요.', available: '휴대폰과 PC의 브라우저에서 바로 열려요. 로그인하지 않아도 둘러볼 수 있어요.' })
]);

export function messengerDestination(value, base) {
  const origin = new URL(base);
  if (!value) return origin.protocol === 'http:' && isLoopback(origin.hostname)
    ? 'http://127.0.0.1:4191/?tab=messenger' : null;
  if (typeof value !== 'string') throw new Error('Workspace 주소 형식이 맞지 않아요.');
  const url = publicUrl(value);
  // Configuration carries no identity or redirects. At launch, the fixed production
  // destination may receive a non-credential account match condition in its fragment.
  if (url.hash || [...url.searchParams].some(([key, val]) => key !== 'tab' || !['home', 'messenger'].includes(val)))
    throw new Error('Workspace 입구에는 홈·메신저 경로만 넣을 수 있어요.');
  if (!isLoopback(origin.hostname) && isLoopback(url.hostname))
    throw new Error('공개 플랫폼에는 이 PC의 Workspace 주소를 넣을 수 없어요.');
  return url.href;
}
