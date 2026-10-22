import { isLoopback, publicUrl } from './core.mjs';

// Platform is the hub. This catalog grants no account or company access.
export const PATH_INTERVIEW_URL = 'https://synk.im/path/interview/film/rehearsal.html';
export const APPLICATIONS = Object.freeze([
  Object.freeze({ id: 'world', name: 'SYNK WORLD', category: 'learn', keywords: ['한글 만나기', '바람길', '리듬', 'TOPIK', '싱크 타운'], subtitle: '한국어 게임과 TOPIK 연습', audience: '한국어를 배우는 사람 누구나', image: 'sticker-book.webp', tags: ['한국어', '학습', '미니게임', 'TOWN', '과제', 'AI 코칭'], description: 'TOPIK 진단부터 쓰기 연습, 한국어 게임까지 들어 있어요. 내 연습 기록에 맞춰 다음 연습을 골라 줘요.', available: '미니게임은 설치 없이 웹에서 바로 할 수 있어요.' }),
  Object.freeze({ id: 'messenger', name: 'SYNK Workspace', category: 'work', keywords: ['메신저', '사내 메신저', 'Workspace'], subtitle: '팀이 대화하고 일하는 업무 앱', audience: 'SYNK 회사 구성원과 담당 교사', image: 'laptop-felt.webp', tags: ['워크스페이스', '업무', '내 수업', '교사', '팀 대화', '파일', '협업'], description: '채널 대화와 회사 자료, 작업실이 한 앱에 있어요. 교사는 「내 수업」에서 맡은 반을 챙겨요.', available: '회사 일은 회사 초대를 받아야, 내 수업은 반을 맡은 교사로 등록돼야 열려요. SYNK ID만으로는 들어갈 수 없어요.' }),
  Object.freeze({ id: 'path', name: 'SYNK PATH', category: 'learn', webOnly: true, keywords: ['패스', '면접', '진로', '취업', '유학', 'VR', 'Quest', '음성', '가상 캠퍼스'], subtitle: '세 면접관 앞에서 미리 해 보는 60~90초 면접 연습', audience: '한국 유학·진로·취업을 준비하는 학습자', image: 'path-vr-felt.webp', tags: ['면접 연습', '60~90초', '한국어 음성', 'Quest VR'], description: '질문에 말로 답하면, 듣고 받아 적던 면접관이 내 답에 맞춰 다음 질문을 해요.', available: 'PC에서는 글이나 목소리로 답하고, Quest 브라우저에서는 VR로 들어가 목소리로 답해요.' })
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
