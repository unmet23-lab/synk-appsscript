// 판본(나라별 글, 11-10 LAB 하루 두 편 · 설계 6 · 20) — src/m19/판본/<KEY>.json 하나가 판본 하나다. 옛 data.ts(LOCS — mn · zhs · my)를 대신한다(11-13 판본 틀로 옮김).
// LAB 몽골 M19 「ах = 형 · 오빠」. 몽골어는 세 겹 검수(../../검문/화면글.txt), 간체 · 버마어는 두 채널 판 세 겹 검수(../../게시/검문/zhs.txt · my_화면.txt)를 거친 글만 판본/MN · CN · MM.json에.
// 키는 계정 원장(docs/마케팅/sns-계정.json) LAB 계정의 rotationVersion, 없으면 countryCode. 같은 영어라도 나라마다 판본이 따로다.
// 그림 · 한국어(말풍선 형! · 오빠! · 누나! · 언니! · 띠의 한글 · 이름표 칩) · 소리 · 박자 · 카메라는 정본 하나(timeline.ts · data.ts · Film.tsx)이고, 판본은 글 자리와 글꼴만 바꾼다(원본 동결).
// 글이 다 찬 판본만 낸다 — 빈 칸이 있으면 Root가 컴포지션을 등록하지 않고, 편 폴더의 판본렌더.mjs가 그 키를 건너뛰며 빈 칸을 알린다.
// `_`로 시작하는 칸(_설명 · _한도 · _원문)은 글 쓰는 사람을 위한 안내라 읽지 않는다. 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅡ=ы · 받침 ㅇ=н).
export type LocPack = {
  lang: string; // 언어(계정 원장 language)
  font: string; // 그 나라 글 서체 줄(키릴 · 로마자는 Inter Tight · SUIT, 그 밖의 문자는 시스템 글꼴을 뒤에)
  lineH: number; // 물음 · 「한 형 두 이름」 · ✗ 까닭 줄의 줄 높이
  hook: string; // 0~1.7초 위 띠 물음(「손위 형제를 한국어로 뭐라고 부를까?」)
  hookSize: number;
  reveal: string; // 10.2~11.9초 위 띠 「형 한 명인데 이름이 둘!」
  revealSize: number;
  colA: string; // 끝 이름표 머리 — 손위 남자 형제(형 · 오빠 칩 위)
  colB: string; // 끝 이름표 머리 — 손위 여자 형제(누나 · 언니 칩 위)
  headSize: number;
  reads: string[]; // 읽는 법 넷 — 형 · 오빠 · 누나 · 언니(몽골판만 키릴, 다른 판은 로마자)
  readSize: number;
  means: string[]; // 풀이 줄 넷 — 남자가 형을 · 여자가 오빠를 · 남자가 누나를 · 여자가 언니를 이렇게 부른다
  meanSize: number;
  meanLineH: number; // 장면 풀이 줄(11.9초~ 등)과 8.6초 「오빠」 풀이 줄의 줄 높이 — 몽골판 1.2(예전 렌더 그대로)
  meanOneLine: boolean; // 풀이 줄 · ✗ 까닭 줄을 한 줄로(nowrap — 넘치면 띠 밖으로 삐져나감) — 몽골판 true, 그 밖은 false(줄 바꿈 문자 · 자동 줄 바꿈)
  revealMeanSize: number; // 8.6~10.2초 「오빠」 풀이 줄 글자 크기 — 몽골판 44, 그 밖은 meanSize와 같게
  why: string[]; // (선택) ✗ 까닭 줄 둘 — [여동생 「형!」 ✗ · 남동생 「언니!」 ✗]. 비우면 몽골판 짜임(띠 낱말에 ✗ · 까닭 줄 없음)
  whySize: number;
  rowM: string; // 끝 범례 파랑 — 남자가 부르면
  rowF: string; // 끝 범례 분홍 — 여자가 부르면
  rowSize: number;
  end: string; // 25.6초~ 끝 줄 「누가 부르느냐에 따라 달라요!」
  endSize: number;
  endLineNormal: boolean; // 끝(22.2초~) 이름표 머리 · 범례 · 끝 줄의 줄 높이를 글꼴 기본(normal)으로 — 몽골판 true(예전 렌더 그대로), 그 밖은 false(lineH)
  coverAt: number; // 표지(cover.png)로 뜰 초
  // 나라 인사 카드(11-12, 선택 — Greeting.tsx). hello가 빈 글이면 인사 없이 원본 그대로다.
  hello: string; // 인사말(그 나라 말) — 인사 그림에 펠트 글자로 구워져 있다(화면 글꼴로 얹지 않는다)
  helloName: string; // 한글 나라 이름(느낌표까지) — 구운 글자
  helloRead: string; // 나라 이름 읽는 법(로마자) — 구운 글자
  helloVo: string; // 몽글 목소리(소진)가 읽는 글 — public/greet/<KEY>.wav
  helloSec: number; // 인사 길이(초) — 그만큼 원본이 뒤로 밀린다
};

// ── 아래는 다섯 편이 같은 꼴로 쓴다(편마다 칸 표만 다르다) ──
// 칸 꼴: 글(빈 글 안 됨) · 글?(선택 — 비우면 그 자리를 그리지 않음) · 수 · 참거짓 · 글들(개수 고정, 선택이면 빈 글 됨) · 수들
type 칸 = '글' | '글?' | '수' | '참거짓' | { 글들: number; 선택?: boolean } | { 수들: number };
const 칸표: Record<keyof LocPack, 칸> = {
  lang: '글', font: '글', lineH: '수', hook: '글', hookSize: '수', reveal: '글', revealSize: '수', colA: '글', colB: '글', headSize: '수',
  reads: { 글들: 4 }, readSize: '수', means: { 글들: 4 }, meanSize: '수', meanLineH: '수', meanOneLine: '참거짓', revealMeanSize: '수',
  why: { 글들: 2, 선택: true }, whySize: '수', rowM: '글', rowF: '글', rowSize: '수', end: '글', endSize: '수', endLineNormal: '참거짓', coverAt: '수',
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
