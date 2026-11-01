// 시간표(초). 원본 x96sxkv-s4E(25초 · 한 장의 숫자 표 위로 1부터 소리 내어 세다 6에서 딴 뜻 소리 한 방 · 숫자마다 약 1.2초)의
// 「일정한 박자로 세다 한 숫자에서 멈칫」만 옮긴다 — 표 대신 엘리베이터 이야기를 세우므로 칸 · 박자는 오마주.json 「다르게」.
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

export const T = {
  total: 16,
  panel: 1.5, // 몽글에서 버튼판 가까이로 컷
  count: [1.6, 2.3, 3.0, 3.9], // 일 · 이 · 삼 · 사 — v1 볼 이유 심사 「2~5초 긴장이 안 오른다」로 빠르게 몬다
  ghost: 4.32, // 불이 나간 사이 F에 불이 들어오고 작은 유령이 나타난다
  eq1: 4.9, // 4 = 사
  eq2: 5.8, // 죽음 = 사
  react: 7.2, // 몽글 얼굴로 컷
  patch: 7.8, // 4 위에 F를 꿰맨 버튼
  so: 7.85, // 그래서 F
  arrive: 8.9, // 문 앞으로 컷 · 도착 종 · 「4층 = 귀신들의 층」
  open: 9.4, // 문이 열린다
  opened: 10.2, // 「귀신들의 층」
  face: 11.1, // 몽글 얼굴
  slam: 11.85, // 문을 닫는다
  slamEnd: 12.2,
  relief: 12.65, // 안도 — 머리 위 유령
  end: 12.9, // 안도 말풍선
  zoom: 13.6, // 머리 위로 다가감
  pop: 14.25, // 그제야 머리 위에 유령이 나타난다
  whisper: 14.65, // 유령이 「사!」
} as const;

export const TOTAL_FRAMES = fr(T.total);
