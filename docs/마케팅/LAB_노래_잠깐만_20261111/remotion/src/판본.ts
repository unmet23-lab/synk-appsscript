// 판본(나라별 글) — src/판본/<KEY>.json 하나가 판본 하나다(이야기 편 판본 틀과 같은 꼴, 2026-11-11).
// 키는 계정 원장(docs/마케팅/sns-계정.json) LAB 계정의 rotationVersion, 없으면 countryCode. 소리 · 박자 · 그림 · 한국어 칸은 public/song.json
// 하나이고(원본 동결), 판본은 loc 글과 글꼴만 바꾼다. 글이 다 찬 판본만 컴포지션(song-<KEY>)이 된다 — 빈 칸이 있으면 판본렌더.mjs가 알린다.
// `_`로 시작하는 칸(_설명 · _원문)은 Remotion이 읽지 않는다(_원문은 역번역 대조의 한국어 뜻 — tools/lib/판본잇기.js).
import type { Loc } from './songDoc';

export type LocPack = Loc & { coverAt: number };

type 칸 = '글' | '글들' | '수';
const 칸표: Record<keyof LocPack, 칸> = {
  lang: '글', bridge: '글', mean: '글', read: '글들', clap: '글', say: '글', real: '글', end: '글', coverAt: '수',
};

export const 빈칸 = (p: Record<string, unknown>, 음절수: number): string[] => {
  const out: string[] = [];
  for (const [k, kind] of Object.entries(칸표) as [string, 칸][]) {
    const v = p[k];
    if (kind === '글') {
      if (typeof v !== 'string' || !v.trim()) out.push(`${k}: 빈 글`);
    } else if (kind === '수') {
      if (typeof v !== 'number' || !Number.isFinite(v)) out.push(`${k}: 수가 아님`);
    } else if (!Array.isArray(v) || v.length !== 음절수 || v.some((x) => typeof x !== 'string' || !x.trim())) out.push(`${k}: 음절 ${음절수}개의 글이 아님`);
  }
  return out;
};

type 묶음 = { keys(): string[]; (id: string): unknown };
declare global {
  namespace NodeJS {
    interface Require {
      context(dir: string, deep: boolean, re: RegExp): 묶음;
    }
  }
}
const ctx: 묶음 = require.context('./판본', false, /^\.\/[A-Z]{2}\.json$/);
export const 판본들 = (음절수: number): { key: string; pack: LocPack }[] =>
  [...new Set(ctx.keys().map((k: string) => k.replace(/^.*\/([A-Z]{2})\.json$/, '$1')))]
    .sort()
    .map((key) => ({ key, raw: ctx(`./${key}.json`) as Record<string, unknown> }))
    .filter(({ raw }) => 빈칸(raw, 음절수).length === 0)
    .map(({ key, raw }) => ({ key, pack: Object.fromEntries(Object.keys(칸표).map((k) => [k, raw[k]])) as LocPack }));
