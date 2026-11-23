// 판본(나라별 글, 11-10 LAB 하루 두 편 · 설계 6 · 20) — src/m36/판본/<KEY>.json 하나가 판본 하나다.
// 키는 계정 원장(docs/마케팅/sns-계정.json) LAB 계정의 rotationVersion, 없으면 countryCode. 같은 영어라도 나라마다 판본이 따로다.
// 그림 · 한국어(부름 말 · 큰 한글 · 목소리) · 소리 · 박자 · 카메라는 정본 하나(Film.tsx · timeline.ts)이고, 판본은 글 자리와 글꼴만 바꾼다(원본 동결).
// 글이 다 찬 판본만 낸다 — 빈 칸이 있으면 Root가 컴포지션을 등록하지 않고, 편 폴더의 판본렌더.mjs가 그 키를 건너뛰며 빈 칸을 알린다.
// `_`로 시작하는 칸(_설명 · _한도 · _원문)은 글 쓰는 사람을 위한 안내라 읽지 않는다.
export type LocPack = {
  lang: string; // 언어(계정 원장 language)
  font: string; // 그 나라 글 서체 줄(키릴 · 로마자는 Inter Tight · SUIT, 그 밖의 문자는 시스템 글꼴을 뒤에)
  lineH: number; // 그 나라 글 줄 높이 하한(배수) — 칸마다 원래 값(1.08 ~ 1.2)보다 클 때만 쓴다. 몽골판 1.08(원래 값 그대로)
  hook: string; // 0~1.9초 위쪽 벽의 머리 물음 「네 이름의 뜻은 한국어로 뭐라고 할까?」(줄 바꿈 문자로 두 줄)
  hookSize: number; // 몽골판 68
  teacher: string; // 부름 말 위 「교수:」(네 번 — 0.12 · 3.35 · 6.2 · 8.7초)
  teacherSize: number; // 몽골판 44
  names: string[]; // 이름 셋(나란 · 사라 · 볼드) — 부름 말 아래 줄과 낱말 칸 맨 위 「<이름> → 나란」 줄. 몽골판은 책상 이름표 그대로 키릴
  nameSize: number; // 이름 줄 · 「누구?」 줄 · 몽글 줄 글자 크기 — 몽골판 58
  mongleAsk: string; // 8.7~9.75초 「몽글 씨?」 아래 「누구지?」
  ssi: string; // 3.35~4.7초 「사라 씨?」 아래 「씨 = 높여 부르는 말」(한글 「씨」는 글 속에 그대로)
  ssiSize: number; // 몽골판 66
  reads: string[]; // 낱말 넷(해 · 달 · 강철 · 몽글몽글)의 읽는 법 — 대괄호는 코드가 두른다. 몽골판만 키릴, 다른 판은 로마자
  readSize: number; // 몽골판 58
  means: string[]; // 낱말 넷의 그 나라 뜻(해 · 달 · 강철 · 몽글몽글 = 폭신폭신 · 보들보들)
  meanSize: number; // 몽골판 58
  mongleName: string; // 9.75~11.55초 낱말 칸 맨 위 「몽글 = 한국어 낱말」(한글 「몽글」은 글 속에 그대로)
  askTop: string; // 11.7초~끝 끝 첫 줄 「이름마다 뜻이 있다」
  askTopSize: number; // 몽골판 54
  ask: string; // 끝 큰 줄 「네 이름은?」
  askSize: number; // 몽골판 118
  askSmall: string; // 끝 셋째 줄 「댓글에 써 줘!」
  askSmallSize: number; // 몽골판 64
  coverAt: number; // 표지(cover.png)로 뜰 초 — 몽골판 1.6(머리 물음 + 해가 솟은 교실). 인사가 있는 판본은 인사 길이만큼 뒤
  // 나라 인사 카드(11-12, 선택 — Greeting.tsx). hello가 빈 글이면 인사 없이 원본 그대로다.
  hello: string; // 인사말(그 나라 말) — 인사 그림에 펠트 글자로 구워져 있다(화면 글꼴로 얹지 않는다)
  helloName: string; // 한글 나라 이름(느낌표까지) — 구운 글자
  helloRead: string; // 나라 이름 읽는 법(로마자) — 구운 글자
  helloVo: string; // 몽글 목소리(소진)가 읽는 글 — public/greet/<KEY>.wav
  helloSec: number; // 인사 길이(초) — 그만큼 원본이 뒤로 밀린다
};

// ── 아래는 여러 편이 같은 꼴로 쓴다(편마다 칸 표만 다르다) ──
// 칸 꼴: 글(빈 글 안 됨) · 글?(선택 — 비우면 그 자리를 그리지 않음) · 수 · 참거짓 · 글들(개수 고정, 선택이면 빈 글 됨) · 수들
type 칸 = '글' | '글?' | '수' | '참거짓' | { 글들: number; 선택?: boolean } | { 수들: number };
const 칸표: Record<keyof LocPack, 칸> = {
  lang: '글', font: '글', lineH: '수', hook: '글', hookSize: '수', teacher: '글', teacherSize: '수', names: { 글들: 3 }, nameSize: '수',
  mongleAsk: '글', ssi: '글', ssiSize: '수', reads: { 글들: 4 }, readSize: '수', means: { 글들: 4 }, meanSize: '수', mongleName: '글',
  askTop: '글', askTopSize: '수', ask: '글', askSize: '수', askSmall: '글', askSmallSize: '수', coverAt: '수',
  hello: '글?', helloName: '글?', helloRead: '글?', helloVo: '글?', helloSec: '수',
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
