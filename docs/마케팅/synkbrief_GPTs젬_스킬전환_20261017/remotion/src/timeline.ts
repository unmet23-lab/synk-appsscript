// 본편 시간표: 장면마다 나레이션 줄을 얹고, 다음 장면은 앞 장면 내용이 끝난 뒤 첫 반 박에 내려앉는다(위로 밀기 전환, T프레임).
// 나레이션 길이가 바뀌면(다시 굽기) 이 표가 저절로 다시 잡힌다. 인스타(A 훅)와 유튜브(C 훅)는 앞 두 장면만 다르다.
import { beat, BEAT_SEC, FIRST_BEAT_SEC, FPS } from './lib/beat';
import { VO } from './vo';

export const T = 12; // 들어오는 장면이 시퀀스 시작 + T에 착지

/** f 이후 첫 반 박(프레임) */
const halfBeatAtOrAfter = (f: number) => {
  const k = Math.ceil(((f / FPS - FIRST_BEAT_SEC) / BEAT_SEC) * 2 - 1e-6);
  return beat(k / 2);
};

export type SceneKey = 'hookA' | 'hookC' | 'quizA' | 'quizC' | 'gem1' | 'gem2' | 'gpt' | 'lock' | 'notice' | 'other' | 'ledger' | 'questions' | 'tool' | 'end';
// delay: 착지 뒤 몇 프레임에 말을 시작할지. from/to: 그 줄의 일부만(초). cut: 이 장면의 내용이 끝나는 곳(줄의 초) — 말은 다음 장면으로 이어진다.
type VoiceSpec = { id: string; delay: number; from?: number; to?: number; cut?: number };
type SceneSpec = { key: SceneKey; voices: VoiceSpec[]; tail: number; wait?: string };

export type Scene = {
  key: SceneKey;
  from: number; // 전체 프레임
  len: number;
  land: number; // 시퀀스 안 착지 프레임
  z: Record<string, number>; // 줄 id → 그 줄 0초의 시퀀스 안 프레임
};
export type Clip = { id: string; at: number; trimBefore: number; trimAfter?: number; end: number };

const build = (specs: SceneSpec[]) => {
  const scenes: Scene[] = [];
  const clips: Clip[] = [];
  const zero: Record<string, number> = {};
  const fullEnd: Record<string, number> = {};
  let land = 0;
  specs.forEach((s, i) => {
    const start = i === 0 ? 0 : land - T;
    let contentEnd = land + 8;
    for (const v of s.voices) {
      const from = v.from ?? 0;
      const to = v.to ?? VO[v.id].dur;
      const at = land + v.delay;
      zero[v.id] = at - Math.round(from * FPS);
      const end = at + Math.round((to - from) * FPS);
      fullEnd[v.id] = end;
      clips.push({ id: v.id, at, trimBefore: Math.round(from * FPS), trimAfter: v.to !== undefined ? Math.round(to * FPS) : undefined, end });
      const cutEnd = v.cut !== undefined ? zero[v.id] + Math.round(v.cut * FPS) : end;
      contentEnd = Math.max(contentEnd, cutEnd + s.tail);
    }
    if (s.wait) contentEnd = Math.max(contentEnd, fullEnd[s.wait] + s.tail);
    const last = i === specs.length - 1;
    const nextLand = last ? contentEnd : halfBeatAtOrAfter(contentEnd + 13);
    const z: Record<string, number> = {};
    for (const k of Object.keys(zero)) z[k] = zero[k] - start;
    scenes.push({ key: s.key, from: start, len: nextLand - start, land: land - start, z });
    land = nextLand;
  });
  const total = scenes[scenes.length - 1].from + scenes[scenes.length - 1].len;
  return { scenes, clips, total };
};

// 말 사이는 0.3초 남짓: 다음 줄은 장면이 내려앉기 4프레임 전(올라오는 중)에 시작하고, 나가는 장면은 말끝 4프레임 전에 떠난다.
// 생각할 틈(맞혀 보기)·정지(실제 안내·결과)·끝 화면만 더 머문다. 유호님 10-13 「템포가 너~무 느리고」.
const REST: SceneSpec[] = [
  { key: 'gem1', voices: [{ id: 'v03', delay: -4, cut: 1.62 }], tail: 0 },
  { key: 'gem2', voices: [], wait: 'v03', tail: 8 },
  { key: 'gpt', voices: [{ id: 'v04', delay: -4 }], tail: 4 },
  { key: 'lock', voices: [{ id: 'v05', delay: -2, to: 0.74 }], tail: 16 },
  { key: 'notice', voices: [{ id: 'v05', delay: -2, from: 0.78 }], tail: 14 },
  { key: 'other', voices: [{ id: 'v06', delay: -4 }], tail: -4 },
  { key: 'ledger', voices: [{ id: 'v07', delay: -4 }], tail: 0 },
  { key: 'questions', voices: [{ id: 'v08', delay: -4 }], tail: -2 },
  { key: 'tool', voices: [{ id: 'v09', delay: -4 }], tail: 6 },
  { key: 'end', voices: [{ id: 'v10', delay: 4 }], tail: 45 },
];

export const CUT = {
  A: build([{ key: 'hookA', voices: [{ id: 'a01', delay: 3 }], tail: -4 }, { key: 'quizA', voices: [{ id: 'a02', delay: -4 }], tail: 20 }, ...REST]),
  C: build([{ key: 'hookC', voices: [{ id: 'c01', delay: 3 }], tail: -2 }, { key: 'quizC', voices: [{ id: 'c02', delay: -4 }], tail: 20 }, ...REST]),
};

/** 줄 id의 n번째 낱말이 시작하는 시퀀스 안 프레임 */
export const wf = (s: Scene, id: string, n: number) => s.z[id] + Math.round(VO[id].words[n].t * FPS);
/** 줄 id가 끝나는 시퀀스 안 프레임 */
export const vEnd = (s: Scene, id: string) => s.z[id] + Math.round(VO[id].dur * FPS);
