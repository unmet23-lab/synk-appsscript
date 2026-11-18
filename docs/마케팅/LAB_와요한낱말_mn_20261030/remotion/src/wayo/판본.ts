// 판본(나라별 글, 11-10 LAB 하루 두 편 · 설계 6 · 20) — src/wayo/판본/<KEY>.json 하나가 판본 하나다. 옛 data.ts(TEXT · ROWS.mn · ROWS.read)와 Film의 「ваё」를 대신한다(11-18 판본 틀로 옮김).
// LAB 몽골 M18 「와요 한 낱말」. 몽골어는 세 겹 검수(../../../검문/화면글.txt)를 거친 글만 판본/MN.json에.
// 키는 계정 원장(docs/마케팅/sns-계정.json) LAB 계정의 rotationVersion, 없으면 countryCode. 같은 영어라도 나라마다 판본이 따로다.
// 그림 · 한국어(주어 · 와요 · 끝 표 맨 아래 주어 줄) · 소리 · 박자 · 카메라는 정본 하나(timeline.ts · data.ts · Film.tsx)이고, 판본은 글 자리와 글꼴만 바꾼다(원본 동결).
// 글이 다 찬 판본만 낸다 — 빈 칸이 있으면 Root가 컴포지션을 등록하지 않고, 편 폴더의 판본렌더.mjs가 그 키를 건너뛰며 빈 칸을 알린다.
// `_`로 시작하는 칸(_설명 · _한도 · _원문)은 글 쓰는 사람을 위한 안내라 읽지 않는다. 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅡ=ы · ㅈ=ж · ㅊ=ч).
export type LocPack = {
  lang: string; // 언어(계정 원장 language)
  font: string; // 그 나라 글 서체 줄(키릴 · 로마자는 Inter Tight · SUIT, 그 밖의 문자는 시스템 글꼴을 뒤에)
  lineH: number; // 뒤집힌 줄 아래 작은 뜻 줄(lines를 작게)의 줄 높이 — 몽골판 1.15(예전 렌더 그대로)
  title: string; // 0~4.48초 위 머리 글 「몽골어로는 4 낱말, 한국어로는 단 한 낱말」(둘째 줄이 뒤집히는 4.48초에 걷힌다)
  titleSize: number; // 몽골판 37
  lines: string[]; // 판의 다섯 줄(친구 · 비 · 눈 · 잠 · 전화 — 위에서 아래) — 뒤집히기 전에는 크게, 한국어로 뒤집힌 뒤에는 한국어 · 읽는 법 아래 작게
  lineSizes: number[]; // 뒤집히기 전 다섯 줄의 글자 크기 — 몽골판 52 · 52 · 52 · 52 · 46(예전 렌더 그대로 — 16자 넘는 줄은 46)
  reads: string[]; // 다섯 줄의 한국어(「친구가 와요」 …) 아래 읽는 법 — 몽골판만 키릴, 다른 판은 로마자
  readSize: number; // 몽골판 40
  meanSize: number; // 뒤집힌 뒤 작은 뜻 줄 글자 크기 — 몽골판 34
  endHead: string; // 15.52초~ 끝 표 머리 「몽골어로는:」
  endHeadSize: number; // 몽골판 46
  verbs: string[]; // 끝 표 2×2 칸의 동사 넷(그 나라 말에서 다섯 줄에 쓰인 동사 — 몽골판 ирэх · орох · хүрэх · дуугарах)
  verbSize: number; // 몽골판 50
  nouns: string[]; // 동사마다 그 동사가 쓰인 낱말(동사 아래 작게 — 몽골판 найз · бороо · цас · нойр · утас)
  nounSize: number; // 몽골판 32
  endKo: string; // 17.6초~ ↓ 아래 「한국어로는: 단 하나」(그 아래 큰 「와요」)
  endKoSize: number; // 몽골판 44
  wayoRead: string; // 큰 「와요」 아래 읽는 법 — 몽골판 ваё, 다른 판은 로마자
  wayoReadSize: number; // 몽골판 44
  coverAt: number; // 표지(cover.png)로 뜰 초 — 몽골판 0(펠트 판 다섯 줄 · 머리 글, 나간 표지와 같은 장면)
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
  lang: '글', font: '글', lineH: '수', title: '글', titleSize: '수', lines: { 글들: 5 }, lineSizes: { 수들: 5 }, reads: { 글들: 5 }, readSize: '수', meanSize: '수',
  endHead: '글', endHeadSize: '수', verbs: { 글들: 4 }, verbSize: '수', nouns: { 글들: 4 }, nounSize: '수', endKo: '글', endKoSize: '수', wayoRead: '글', wayoReadSize: '수',
  coverAt: '수',
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
