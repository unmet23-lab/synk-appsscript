// 본편 시간표(10-23 v4 「ChatGPT 대화 잠그기」 알아듣기 판). 장면은 전부 배경음 박에 착지한다 — 박 격자는 지난 편들과 같은 곡(src/lib/beat.ts).
// 곡 구조(지난 편 실측): 12~15박 드럼 빠짐 → 16박 드롭 / 47~63박 조용한 구간. v4는 조용한 구간에 들기 전 48박에서 곡의 끝맺음(원곡 53.0초 첫 타격)으로 건너뛴다.
// v3(47.8초 · 여덟 장면)에서 줄인 까닭: 10-23 낯선 사람 이해 시험에서 16초 이탈 · 막힌 말 아홉 — 한 문장(잠가 숨긴다 · PIN 잊고 재설정하면 다 지워진다)만 남기고
// 경고를 앞 절반(약 9.4초)으로 당겼다. 나머지(다시 잠기는 때 · 다른 화면 새로고침 · 잠가도 그대로인 것 · 차례로 열림)는 캡션 · 고정 댓글 · 블로그로.
import { beat } from '../lib/beat';

export const T = 12; // 밀기 전환: 시퀀스 시작 + 12프레임 = 착지 박

/** 장면이 착지하는 박. cut은 본편 음악을 끊고 끝맺음으로 잇는 박. 목소리를 구운 뒤 줄 길이에 맞춰 정했다(scripts/vo-place.mjs가 겹침을 막는다). */
export const B = {
  hook: 0, // 상황 + 약속(남이 보면 곤란한 대화 → PIN으로 잠가 숨긴다)
  how: 9, // 잠그는 법(점 세 개 → 대화 잠그기 → PIN 4자리)
  warn: 19, // 경고(PIN 잊고 재설정하면 전부 삭제 · 만들 때 적어 두기) — 약 9.4초, 앞 절반
  open: 33, // 다시 볼 때(프로젝트 안의 잠긴 대화 폴더 · PIN)
  end: 42, // 끝(어디서 되는지 · 언제 다시 잠기는지는 캡션 · 고정 댓글에) — 끝 줄은 착지 12프레임 전에 먼저 시작한다
  cut: 50, // 끝 줄 바로 뒤 곡 끝맺음으로 잇는다
} as const;

/** 끝맺음: 곡 끝맺음의 첫 타격(원곡 1590프레임 = 53.0초)부터 1.6초. 끝 화면(끝 장면 밀기부터)이 6초를 넘지 않게 v3의 2.8초에서 줄였다. */
export const TAIL = { songFrame: 1590, frames: Math.round(1.6 * 30) };
export const CUT = beat(B.cut);
export const TOTAL = CUT + TAIL.frames;

export type Key = Exclude<keyof typeof B, 'cut'>;
export const ORDER: Key[] = ['hook', 'how', 'warn', 'open', 'end'];

/** 장면 시퀀스: 첫 장면은 0에서, 나머지는 착지 12프레임 전에 시작. 끝 장면은 영상 끝까지. 앞뒤가 12프레임 겹쳐 밀기에 빈 화면이 없다. */
export const seq = (k: Key) => {
  const i = ORDER.indexOf(k);
  const from = i === 0 ? 0 : beat(B[k]) - T;
  const to = k === 'end' ? TOTAL : beat(B[ORDER[i + 1]]);
  return { from, len: to - from };
};

/** 장면 안 프레임: 장면 k가 착지한 뒤 b박째(절대 박 번호) */
export const at = (k: Key, b: number) => beat(b) - beat(B[k]) + (k === 'hook' ? 0 : T);
