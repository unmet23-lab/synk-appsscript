// Y51 — 화면 숫자 · 시각은 모두 기록 값이다.
// · 벽시계 37.9시간 · 일한 시간 7시간 · AI 심사 19번: docs/_ops/편실측.jsonl 첫 줄(「PULSE 빛 견본」 — 손님 이름은 화면에 쓰지 않는다)
// · 구운 그림: synk-vendor/light-samples-20261111/받음의 PNG(합성 그림 `_…` 뺌) 85장(굽지 않은 틀 그림 섞임) · gen_log.jsonl 완료 80번 → 「80장」
// · 해 질 녘 벌의 구운 시각: gen_log.jsonl `"step":"done"` 줄(UTC) + 9시간 = 한국 시각
//   R3 11-12 13:38Z → 밤 10:38 · R3c 18:47Z → 새벽 3:47 · R3d 21:22Z → 아침 6:22 · R3e 22:55Z → 아침 7:55
// · 마지막 심사: 맹검/R_해질녘_6회차 — 네 벌(R3 · R3c · R3d · R3e) 가운데 R3(첫 벌)을 고름
export const STAGE = '#0E0D0C';
export const INK = '#F4F2EC';
export const DIM = '#9C9890';
export const BUTTER = '#F5C445';

export const SAMPLES = ['A', 'B', 'C', 'D', 'E', 'F'] as const; // 보여 드린 견본 여섯 장(빛만 다름)

export const SUNSET: { img: string; when: string }[] = [
  { img: 'R3', when: '밤 10:38' },
  { img: 'R3c', when: '새벽 3:47' },
  { img: 'R3d', when: '아침 6:22' },
  { img: 'R3e', when: '아침 7:55' },
];

export const WALL_HOURS = 38; // 37.9시간
export const WORK_HOURS = 7;
export const BAKED = 80; // 「80장」(사실 검수 11-19 — gen_log 완료 80번, 받음 85장에는 굽지 않은 틀 그림이 섞임)
