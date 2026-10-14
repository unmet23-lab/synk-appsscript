import { isLoopback, publicUrl } from './core.mjs';

// Platform is the hub. This catalog grants no account or company access.
export const PATH_INTERVIEW_URL = 'https://synk.im/path/interview/film/rehearsal.html';
export const APPLICATIONS = Object.freeze([
  Object.freeze({ id: 'world', name: 'SYNK WORLD', category: 'learn', keywords: ['레이싱', '리듬', '주문 폭주', '바람길', '싱크 타운'], subtitle: '놀면서 익히는 한국어', audience: '학습과 경험을 즐기는 회원', image: 'sticker-book.webp', tags: ['한국어', '학습', '미니게임', 'Town', '숙제', 'AI 코칭'], description: '한국어 놀이·마을 생활·학습 이어가기를 한 앱에 모아요. 미니게임과 SYNK TOWN에서 다음 학습으로 이어갑니다.', available: '미니게임의 웹 체험을 사용할 수 있어요. Town·숙제·AI 코칭의 데스크톱 제공 범위는 별도 안내합니다.' }),
  Object.freeze({ id: 'messenger', name: 'SYNK Workspace', category: 'work', subtitle: '수업·대화·업무를 한곳에서', audience: '회사 구성원·담당 교사', image: 'laptop-felt.webp', tags: ['워크스페이스', '업무', '내 수업', '교사', '팀 대화', '파일', '협업'], description: '싱크 워크스페이스에서 내 수업, 팀 대화, 공유 파일, 업무와 제작을 연결해요. 담당 반의 학습 기록과 회사 자료는 각자의 권한으로 확인해요.', available: '기존 워크스페이스 웹 서비스에 연결해요. 회사 업무는 회사 초대·로그인, 내 수업은 교사 연결과 담당 반 권한이 필요해요. 일반 SYNK 회원 가입만으로 접근 권한을 주지 않아요.' }),
  Object.freeze({ id: 'path', name: 'SYNK PATH', category: 'learn', webOnly: true, keywords: ['패스', '면접', '진로', '취업', '유학', 'VR', 'Quest', '음성', '가상 캠퍼스'], subtitle: '세 면접관 앞에서 미리 연습하는 첫 면접', audience: '한국 유학·진로·취업을 준비하는 학습자', image: 'path-vr-felt.webp', tags: ['실사 면접실', '60~90초', '한국어 음성', 'Quest VR'], description: '무거운 면접실의 분위기 속에서 말로 답하고, 경청과 필기를 하는 세 면접관의 후속 질문까지 이어 가요.', available: 'PC에서는 글이나 음성으로, 지원 Quest 브라우저에서는 음성을 준비한 뒤 VR로 연습해요. 실제 후속 대사는 경험·준비 두 종류이며, 답변에 맞는 질문을 선택해요.' })
]);

export function messengerDestination(value, base) {
  const origin = new URL(base);
  if (!value) return origin.protocol === 'http:' && isLoopback(origin.hostname)
    ? 'http://127.0.0.1:4191/?tab=messenger' : null;
  if (typeof value !== 'string') throw new Error('워크스페이스 주소를 확인해 주세요.');
  const url = publicUrl(value);
  // Configuration carries no identity or redirects. At launch, the fixed production
  // destination may receive a non-credential account match condition in its fragment.
  if (url.hash || [...url.searchParams].some(([key, val]) => key !== 'tab' || !['home', 'messenger'].includes(val)))
    throw new Error('워크스페이스 입구에는 홈·메신저 경로만 등록해 주세요.');
  if (!isLoopback(origin.hostname) && isLoopback(url.hostname))
    throw new Error('운영 플랫폼에 로컬 워크스페이스 주소를 등록할 수 없어요.');
  return url.href;
}
