// LAB 몽골 M19 「ах = 형 · 오빠」 장면 정본 — 그림 · 한국어(말풍선 · 띠의 한글) · 목소리 · 좌표. 판본마다 같다.
// 그 나라 글(물음 · 읽는 법 · 풀이 · 이름표 머리 · 범례 · 끝 줄)은 판본 글 하나(./판본/<KEY>.json — ./판본.ts)가 원천이다(11-13 판본 틀로 옮김 — 옛 LOCS mn · zhs · my는 판본 MN · CN · MM).

// bubble = 그 장면에서 부르는 아이 머리 위 말풍선 자리(그림 941×1672 좌표) · tail = 꼬리 방향(-1 왼쪽 아래 · 1 오른쪽 아래)
export type Scene = { img: string; ko: string; vo: string; bubble: [number, number]; tail: -1 | 1; cam: [number, number] };
export const SCENES: Scene[] = [
  { img: 'img/hyeong.jpg', ko: '형', vo: 'h1', bubble: [190, 700], tail: 1, cam: [400, 900] },
  { img: 'img/oppa.jpg', ko: '오빠', vo: 'o1', bubble: [250, 790], tail: 1, cam: [420, 950] },
  { img: 'img/nuna.jpg', ko: '누나', vo: 'n1', bubble: [260, 650], tail: 1, cam: [500, 900] },
  { img: 'img/eonni.jpg', ko: '언니', vo: 'e1', bubble: [660, 580], tail: -1, cam: [470, 950] },
];

// 핵심 장면(둘이) 말풍선 — 왼쪽 남동생 「형!」 · 오른쪽 여동생 「오빠!」
// oops = 6.6~8.6초 반응 컷(형 「나…?」 · 남동생 웃음 · 여동생 머쓱 — v3 볼 이유 심사), oopsGirl = 그 그림의 여동생 말풍선 자리
export const OOPS = { img: 'img/oops.jpg', girl: [700, 760] as [number, number], cam: [560, 900] as [number, number] };
export const KEY = { img: 'img/key.jpg', boy: [190, 740] as [number, number], girl: [720, 770] as [number, number], cam: [470, 820] as [number, number] };
// 끝 가족 사진 이름표 자리(그림 좌표) — 형(오빠) 머리 위 · 누나(언니) 머리 위
export const END = { img: 'img/family.jpg', cam: [470, 1000] as [number, number], ah: [615, 500] as [number, number], egch: [250, 540] as [number, number] };

// 두 채널 판(11-06 15시 회차, 기획장부/LAB.md 머리말 「두 채널 판」)에서 판본으로 — 같은 정본에서 렌더하고 판본끼리 따로 고치지 않는다.
// 한국어(말풍선 한글 · 남동생 도윤 · 여동생 소진 목소리)는 그대로, 읽는 법 · 물음 · 풀이 · 범례 · 맺음 줄만 판본 글이 바꾼다.
// 중국어 哥哥 · 姐姐, 버마어 အစ်ကို · အစ်မ도 몽골어 ах · эгч처럼 부르는 사람의 성별을 안 가른다.
