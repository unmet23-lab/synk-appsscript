// LAB 영어 E52 「ㅋㅋㅋ」(11-26 07시 회차) — 편 전체를 영상으로(제작 절차 lab-whole-video), 짜임은 「더 먹어」처럼(lab-video-story):
// 칸 10개 · 넓게 · 가깝게 · 아주 가깝게 · 세 번 커지는 쌓임(ㅋ 둘 → 넷 → 여덟, 친구 웃음이 함께 커짐) → 반전(ㅋ 하나에 싸늘) → 풀림(마구 누름) → 끝 새 사건(ㅋ 폭포).
// 샷은 Flow Omni 1.2 Flash로 구운 720×1280 영상(public/vid — git 밖, tools/플로우영상.js 「넣기」)이고, 글 · 소리는 그 위에 얹는다.
import type { 말풍선말 } from './말풍선';

export const FPS = 30;
export const fr = (s: number) => Math.round(s * FPS);

// 칸 — at: 편 초 · len: 쓸 길이 · vid: 샷 · from: 영상 안 시작 초 · zoom: 칸 첫 배율(그 칸 동안 +12% 천천히 다가감) · ox · oy: 다가가는 기준점(%)
// shake: 반전 칸의 짧은 흔들림(초) — 제작 절차 lab-whole-video 「칸마다 10~15% 천천히 다가가기와 반전 칸의 짧은 흔들림」
export type Cut = { at: number; len: number; vid: string; from?: number; zoom?: number; ox?: number; oy?: number; shake?: number; 크기: '넓게' | '가깝게' | '아주 가깝게'; 일: string };
export const CUTS: Cut[] = [
  { at: 0, len: 2.2, vid: 's1.mp4', from: 0, 크기: '넓게', 일: '밤 몽글 방 — 침대 위 폰이 빛나며 친구 문자 「ㅋㅋ」' },
  { at: 2.2, len: 1.6, vid: 's2.mp4', from: 0.2, 크기: '아주 가깝게', 일: '폰 빛을 받은 몽글이 갸웃 「크크…?」' },
  { at: 3.8, len: 1.8, vid: 's3.mp4', from: 1.2, 크기: '넓게', 일: '친구 방 — 방석의 친구가 웃음이 커지며 「ㅋㅋㅋㅋ」(쌓임 2)' },
  { at: 5.6, len: 1.8, vid: 's4.mp4', from: 0.4, 크기: '가깝게', 일: '친구가 배꼽을 잡고 「ㅋㅋㅋㅋㅋㅋㅋㅋ」(쌓임 3)' },
  { at: 7.4, len: 3.5, vid: 's5.mp4', from: 0, 크기: '가깝게', 일: '몽글이 알아챔 — 「크크크!」 → 천천히 「크, 크, 크…」(배우는 말)' },
  { at: 10.9, len: 1.4, vid: 's5.mp4', from: 3.5, zoom: 1.3, ox: 50, oy: 62, 크기: '아주 가깝게', 일: '몽글이 몸으로 폰을 한 번 눌러 「ㅋ」 하나만 보냄' },
  { at: 12.3, len: 3.0, vid: 's6.mp4', from: 0.2, shake: 13.05, 크기: '아주 가깝게', 일: '반전 — 기대하던 친구 얼굴이 싸늘해짐 「…크.」' },
  { at: 15.3, len: 2.2, vid: 's7.mp4', from: 0, 크기: '가깝게', 일: '풀림 — 당황한 몽글이 폰을 마구 눌러 ㅋ을 쏟아 보냄' },
  { at: 17.5, len: 3.0, vid: 's8.mp4', from: 0, 크기: '넓게', 일: '끝 새 사건 — 친구 폰에서 펠트 ㅋ이 쏟아지고 친구가 바닥을 구름' },
  { at: 20.5, len: 2.5, vid: 's8.mp4', from: 3.0, zoom: 1.22, ox: 55, oy: 70, 크기: '가깝게', 일: '쌓인 ㅋ 속에서 웃는 친구 · 끝 줄' },
];
export const FILM = 23.0;
export const SCENE_FROM = 15.3; // 한 장면 먼저(장면 심사) — c8 + c9(당황해 누름 → ㅋ 폭포)
export const SCENE_TO = 20.5;

// 목소리(초 · 파일) — public/vo. 몽글 소진(Typecast), 친구 일레븐 v4 Taehyung
export const VO: [number, string, number?][] = [
  [2.4, 'm1'], // 크크…?
  [3.95, 'f1'], // 크크.(낮게 웃음)
  [5.7, 'f2'], // 크크크크크!(배꼽)
  [7.6, 'm2'], // 크크크!(배우는 말 첫 번 — 초당 3.4음절)
  [9.0, 'm2b'], // 크, 크, 크…(배우는 말 둘째 번 — 천천히 1.9음절)
  [11.05, 'm3'], // 크!(하나만 보냄)
  [13.75, 'f3'], // …크.(싸늘)
  [15.45, 'm4'], // 어… 아니 아니, 크크크크크!
  [17.6, 'f4', 0.9], // 크하하하하하!(구름)
];
// 효과음(초 · 파일 · 크기)
export const SFX: [number, string, number][] = [
  [0.55, 'ding.wav', 0.35], // 문자 옴
  [3.9, 'ding.wav', 0.25],
  [5.65, 'ding.wav', 0.25],
  [11.1, 'tap.wav', 0.35], // 몸으로 폰 누름
  [11.35, 'send.wav', 0.3], // 보냄
  [12.9, 'ding.wav', 0.3], // 친구 폰에 ㅋ 하나 도착
  [13.05, 'freeze.wav', 0.32], // 싸늘(반전)
  [15.5, 'tap.wav', 0.3],
  [15.85, 'tap.wav', 0.3],
  [16.2, 'tap.wav', 0.3],
  [16.55, 'tap.wav', 0.3],
  [16.9, 'tap.wav', 0.3],
  [17.65, 'pour.wav', 0.4], // ㅋ 폭포
];

// 화면 글 — 말풍선(말한 사람 · 보낸 폰 쪽 꼬리, 교훈 L21 · L08)
export const SAYS: 말풍선말[] = [
  { at: 0.6, to: 2.2, head: 'Text from Korean friend', ko: ['ㅋㅋ'], read: 'keu-keu', mean: '🙂', x: 700, y: 1430, 꼬리x: 660, 크기: 96, 바탕: '#FFFFFF' },
  { at: 2.4, to: 3.8, ko: ['ㅋㅋ…?'], read: 'keu-keu…?', mean: 'What does this mean? 🤔', x: 540, y: 560, 꼬리x: 540 },
  { at: 3.95, to: 5.6, head: 'Text from Korean friend', ko: ['ㅋㅋㅋㅋ'], mean: '😄', x: 540, y: 980, 꼬리x: 560, 크기: 96, 바탕: '#FFFFFF' },
  { at: 5.7, to: 7.4, head: 'Text from Korean friend', ko: ['ㅋㅋㅋㅋㅋㅋㅋㅋ'], mean: '🤣🤣', x: 540, y: 900, 꼬리x: 520, 크기: 96, 바탕: '#FFFFFF' },
  { at: 7.55, to: 10.9, ko: ['ㅋㅋㅋ'], read: 'keu-keu-keu', mean: '= Korean “lol” 😂', x: 540, y: 700, 꼬리x: 560, 크기: 110 },
  { at: 11.3, to: 12.3, head: 'Mongle texts back', ko: ['ㅋ'], mean: 'just one', x: 540, y: 1250, 꼬리x: 520, 크기: 110, 바탕: '#FFFFFF' },
  { at: 13.8, to: 15.3, ko: ['…ㅋ?'], read: '…keu?', mean: 'Just ONE ㅋ? 😐 Cold.', x: 520, y: 560, 꼬리x: 600 },
  { at: 15.6, to: 17.5, head: 'Mongle texts back', ko: ['ㅋㅋㅋㅋㅋㅋㅋㅋ'], mean: 'No no! 🤣🤣🤣', x: 560, y: 900, 꼬리x: 420, 크기: 96, 바탕: '#FFFFFF' },
];
export const HEAD = { at: 0.05, to: 2.2, l1: 'In Korea, we don’t text', l2: 'lol' };
// 끝 줄 — 가장 센 장면(ㅋ 폭포) 위에 제목만 한 크기 한 줄(제작 절차 「끝 3초」)
export const END = { at: 20.6, to: 23.0, l1: 'more ㅋ = more 😂' };
// ㅋ 폭포 — 친구 폰 자리(%)에서 튀어 올라 떨어져 쌓인다. 크고 드문드문(빽빽한 무늬 없음 — 유호님 11-20)
export const POUR = { at: 17.7, from: { x: 70, y: 83 }, n: 14 };
