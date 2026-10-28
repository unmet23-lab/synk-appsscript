// 시간표(초). 소리 없는 화면 글 편이라 한 카드를 3.2초 둔다(M15 v3 「2.8초는 글자 전환이 빨라 읽을 시간이 모자란다」).
import { Msg } from './data';

export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

export const T = {
  stamp: 0.7, // 반말 문자 둘에 빨간 ✗(첫 렌더: 0초에 채팅이 비어 「이렇게」가 가리킬 문자가 없었다 — 문자는 0초부터)
  clear: 3.0, // ✗ 문자가 지워지고 다시 쓰기
  // 올릴 파일 이해 시험(3점 · 6초 넘김): 「4~6초 거의 같은 화면이라 느리다」 — 첫 카드 3.2 → 3.0초, 둘째 카드 뒤 질문 · 답장을 1초 당김
  cards: [3.2, 6.2, 11.8], // 안녕하세요, 교수님 · 바트입니다 · 감사합니다
  rule: 3.5, // 위 띠에 「먼저 인사, 그다음 이름」
  reply: 9.6, // 교수님 답장 — 결과 카드(몽골어만)
  end: 15.0,
  total: 18.8, // v1 이해 시험: 끝 카드 글이 짧게 지나감 — 끝 카드 3.8초
};

// 카드 안 순서(카드 시작에서 몇 초 뒤): 한국어 → 읽기 → 몽골 뜻 → 작은 줄
export const CARD = { ko: 0.15, read: 0.45, mn: 0.8, note: 1.3 };

export const MSGS: Msg[] = [
  { from: 'me', text: '교수님 안녕~ 😊', at: -1, wrong: true },
  { from: 'me', text: '내일 수업 몇 시?', at: -1, wrong: true },
  { from: 'me', text: '안녕하세요, 교수님.', at: 3.3, item: 0 },
  { from: 'me', text: '바트입니다.', at: 6.3, item: 1 },
  { from: 'me', text: '내일 수업은 몇 시예요?', at: 8.5 },
  // 「…」 입력 중 말풍선은 세 번의 시험에서 「무슨 뜻인지 헷갈림」 — 답장이 바로 뜨게
  { from: 'prof', text: '10시예요. 😊', at: 9.6 },
  { from: 'me', text: '감사합니다!', at: 11.9, item: 2 },
];

export const TOTAL_FRAMES = fr(T.total);
