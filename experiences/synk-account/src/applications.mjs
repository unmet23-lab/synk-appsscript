import { isLoopback, publicUrl } from './core.mjs';

// Platform is the hub, these are its two applications. This catalog grants no access.
export const APPLICATIONS = Object.freeze([
  Object.freeze({ id: 'world', name: 'SYNK WORLD', category: 'learn', keywords: ['레이싱', '리듬', '주문 폭주', '바람길', '싱크 타운'], subtitle: '놀면서 익히는 한국어', audience: '학습과 경험을 즐기는 회원', image: 'sticker-book.webp', tags: ['한국어', '학습', '미니게임', 'Town', '숙제', 'AI 코칭'], description: '한국어 놀이·마을 생활·학습 이어가기를 한 앱에 모아요. 미니게임과 SYNK TOWN에서 다음 학습으로 이어갑니다.', available: '미니게임의 웹 체험을 사용할 수 있어요. Town·숙제·AI 코칭의 데스크톱 제공 범위는 별도 안내합니다.' }),
  Object.freeze({ id: 'messenger', name: 'SYNK 사내 메신저', category: 'work', subtitle: '대화에서 시작되는 팀의 하루', audience: '초대받은 회사 구성원', image: 'laptop-felt.webp', tags: ['업무', '팀 대화', '파일', '협업'], description: '팀 대화, 공유 파일, 업무 협업을 연결하는 회사의 공간. 회사가 초대한 구성원이 자신의 권한 안에서 함께 일해요.', available: '기존 회사 웹 서비스에 연결해요. 회사 초대·로그인이 필요하며, 일반 SYNK 회원 가입만으로 접근 권한을 주지 않아요.' })
]);

export function messengerDestination(value, base) {
  const origin = new URL(base);
  if (!value) return origin.protocol === 'http:' && isLoopback(origin.hostname)
    ? 'http://127.0.0.1:4191/?tab=messenger' : null;
  if (typeof value !== 'string') throw new Error('사내 메신저 주소를 확인해 주세요.');
  const url = publicUrl(value);
  // The launch link never carries identity, tokens, user-controlled redirects, or fragments.
  if (url.hash || [...url.searchParams].some(([key, val]) => key !== 'tab' || !['home', 'messenger'].includes(val)))
    throw new Error('사내 메신저 입구에는 홈·메신저 경로만 등록해 주세요.');
  if (!isLoopback(origin.hostname) && isLoopback(url.hostname))
    throw new Error('운영 플랫폼에 로컬 메신저 주소를 등록할 수 없어요.');
  return url.href;
}
