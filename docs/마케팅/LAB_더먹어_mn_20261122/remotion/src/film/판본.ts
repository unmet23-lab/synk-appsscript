// 판본(나라별 글, 11-10 LAB 하루 두 편 · 설계 6 · 20) — src/film/판본/<KEY>.json 하나가 판본 하나다(M72 「계세요」 판본.ts를 이 편 칸으로 옮김).
// 키는 계정 원장(docs/마케팅/sns-계정.json) LAB 계정의 rotationVersion, 없으면 countryCode.
// 그림 · 한국어(말풍선 한글 · 목소리) · 소리 · 박자는 정본 하나(data.ts · Film.tsx)이고, 판본은 글 자리와 글꼴만 바꾼다(원본 동결).
// 글이 다 찬 판본만 낸다 — 빈 칸이 있으면 Root가 컴포지션을 등록하지 않는다. `_`로 시작하는 칸은 안내라 읽지 않는다.
export type LocPack = {
  lang: string;
  font: string;
  lineH: number; // 줄 높이 — 원래 값(뜻 1.16 · 꼬리 1.15 · 머리 글 · 끝 제목 1.2)보다 클 때만 쓴다
  head: string; // 첫 3초 머리 글 — 화면 위(약속: 「배불러요」라고 해도 안 멈춘다)
  headSize: number;
  pills: string[]; // 알약 둘 — ① 「✗ 배불러요」가 안 통함(빨강) ② 「✓ …」 밥을 끝내는 말(초록)
  reads: string[]; // 말풍선 열의 한국어 읽는 법(몽골판은 키릴, 다른 판은 로마자)
  means: string[]; // 말풍선 뜻 줄 열(data.ts CELLS의 b 차례)
  meanSizes: number[];
  tags: string[]; // 말풍선 아래 「→ …」 꼬리 열(빈 글이면 없음)
  endCard: string; // 끝 제목 아래 뜻 줄(END_AT부터 — 한국어 「잘 먹었습니다!」 ✓는 Film이 그린다)
  endSize: number;
  ask: string; // 끝 질문(선택)
  askSize: number;
  coverAt: number;
  hello: string;
  helloName: string;
  helloRead: string;
  helloVo: string;
  helloSec: number;
};

type 칸 = "글" | "글?" | "수" | "참거짓" | { 글들: number; 선택?: boolean } | { 수들: number };
const 칸표: Record<keyof LocPack, 칸> = {
  lang: "글", font: "글", lineH: "수", head: "글", headSize: "수", pills: { 글들: 2 }, reads: { 글들: 10 }, means: { 글들: 10 }, meanSizes: { 수들: 10 },
  tags: { 글들: 10, 선택: true }, endCard: "글?", endSize: "수", ask: "글?", askSize: "수", coverAt: "수",
  hello: "글?", helloName: "글?", helloRead: "글?", helloVo: "글?", helloSec: "수",
};

// 판본 글에서 빈 칸 · 틀린 꼴을 찾는다(없으면 빈 배열)
export const 빈칸 = (p: Record<string, unknown>): string[] => {
  const out: string[] = [];
  for (const [k, kind] of Object.entries(칸표) as [string, 칸][]) {
    const v = p[k];
    if (kind === '글' || kind === '글?') {
      if (typeof v !== 'string') out.push(`${k}: 글이 아님`);
      else if (kind === '글' && !v.trim()) out.push(`${k}: 빈 글`);
    } else if (kind === '수') {
      if (typeof v !== 'number' || !Number.isFinite(v)) out.push(`${k}: 수가 아님`);
    } else if (kind === '참거짓') {
      if (typeof v !== 'boolean') out.push(`${k}: true/false가 아님`);
    } else if ('수들' in kind) {
      if (!Array.isArray(v) || v.length !== kind.수들 || v.some((x) => typeof x !== 'number' || !Number.isFinite(x))) out.push(`${k}: 수 ${kind.수들}개가 아님`);
    } else if (!Array.isArray(v) || v.length !== kind.글들) out.push(`${k}: 글 ${kind.글들}개가 아님`);
    else
      v.forEach((x, i) => {
        if (typeof x !== 'string') out.push(`${k}[${i}]: 글이 아님`);
        else if (!kind.선택 && !x.trim()) out.push(`${k}[${i}]: 빈 글`);
      });
  }
  // 나라 인사 — 인사말이 있으면 나라 이름 · 읽는 법 · 목소리 글도 있어야 하고 길이는 0~3초
  if (typeof p.hello === 'string' && p.hello.trim()) {
    for (const k of ['helloName', 'helloRead', 'helloVo']) if (typeof p[k] !== 'string' || !(p[k] as string).trim()) out.push(`${k}: 빈 글(인사가 켜진 판본)`);
    if (!(typeof p.helloSec === 'number' && p.helloSec > 0 && p.helloSec <= 3)) out.push('helloSec: 0~3초의 수가 아님');
  }
  return out;
};

// 판본 폴더의 JSON을 번들 때 모두 묶는다(rspack · webpack의 require.context — 파일을 더하면 다음 번들에 저절로 든다)
type 묶음 = { keys(): string[]; (id: string): unknown };
declare global {
  namespace NodeJS {
    interface Require {
      context(dir: string, deep: boolean, re: RegExp): 묶음;
    }
  }
}
const ctx: 묶음 = require.context('./판본', false, /^\.\/[A-Z]{2}\.json$/);
const 키들: string[] = [...new Set(ctx.keys().map((k: string) => k.replace(/^.*\/([A-Z]{2})\.json$/, '$1')))].sort();
export const 판본들: { key: string; pack: LocPack }[] = 키들
  .map((key) => ({ key, raw: ctx(`./${key}.json`) as Record<string, unknown> }))
  .filter(({ raw }) => 빈칸(raw).length === 0)
  .map(({ key, raw }) => ({ key, pack: Object.fromEntries(Object.keys(칸표).map((k) => [k, raw[k]])) as LocPack }));
