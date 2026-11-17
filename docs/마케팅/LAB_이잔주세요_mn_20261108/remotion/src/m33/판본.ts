// 판본(나라별 글, 11-10 LAB 하루 두 편 · 설계 6 · 20) — src/m33/판본/<KEY>.json 하나가 판본 하나다. 옛 data.ts(TEXT · SAY.read · MENU.read · END.mn · TAG.mn)를 대신한다(11-18 판본 틀로 옮김).
// LAB 몽골 M33 「이 잔 주세요」. 몽골어는 세 겹 검수(../../../검문/전체.txt)를 거친 글만 판본/MN.json에.
// 키는 계정 원장(docs/마케팅/sns-계정.json) LAB 계정의 rotationVersion, 없으면 countryCode. 같은 영어라도 나라마다 판본이 따로다.
// 그림 · 한국어(말풍선 · 생각 풍선 · 메뉴판 · 이름표 · 끝 띠의 한글) · 소리 · 박자 · 카메라는 정본 하나(timeline.ts · data.ts · Film.tsx)이고, 판본은 글 자리와 글꼴만 바꾼다(원본 동결).
// 글이 다 찬 판본만 낸다 — 빈 칸이 있으면 Root가 컴포지션을 등록하지 않고, 편 폴더의 판본렌더.mjs가 그 키를 건너뛰며 빈 칸을 알린다.
// `_`로 시작하는 칸(_설명 · _한도 · _원문)은 글 쓰는 사람을 위한 안내라 읽지 않는다. 키릴 읽는 법은 우리 몽골 편 규칙(ㅐㅔ=э · ㅜ=у · ㅓ=ө · ㅡ=ы).
export type LocPack = {
  lang: string; // 언어(계정 원장 language)
  font: string; // 그 나라 글 서체 줄(키릴 · 로마자는 Inter Tight · SUIT, 그 밖의 문자는 시스템 글꼴을 뒤에)
  lineH: number; // 위 띠(물음 · 뜻 줄)의 줄 높이 — 몽골판 1.16(예전 렌더 그대로)
  hook: string; // 0~4.2초 위 띠 「커피 두 잔을 사려는데…」
  hookSize: number; // 몽골판 62
  r1: string; // 4.3~5.9초 위 띠 둘째 줄 — 점원 「이 잔이요?」의 뜻(같은 줄 앞에 읽는 법 reads[2]와 「 · 」가 붙는다)
  r1Size: number; // 그 둘째 줄 글자 크기 — 몽골판 52
  heard: string; // 5.9~8.4초 위 띠 — 점원이 「이」를 「둘」이 아니라 「이것」으로 알아들었다(줄 바꿈 문자로 줄을 나눈다 · 몽골판 세 줄)
  heardSize: number; // 몽골판 56
  menu: string; // 8.4~11.6초 위 띠 — 잔을 셀 때 하나 · 둘 · 셋이 「잔」 앞에서 한 · 두 · 세가 된다(한글은 글 속에 그대로 · 몽골판 세 줄)
  menuSize: number; // 몽골판 54
  two: string; // 11.6~13.1초 — 「2잔 = «두 잔»」(한글은 글 속에 그대로)
  m2: string; // 13.1~15.0초 — 몽글 「아메리카노 두 잔 주세요!」의 뜻
  r2: string; // 15.0~16.9초 — 점원 「네, 두 잔이요!」의 뜻
  m3: string; // 16.9~18.8초 — 몽글 「이 잔도 주세요!」의 뜻
  r3: string; // 18.8~21.2초 — 점원 「네, 이 잔도요!」의 뜻
  bandSize: number; // 위 띠 two ~ r3 글자 크기 — 몽골판 62
  ends: string[]; // 21.2초~끝 끝 띠 두 줄의 뜻 — 「두 잔」 · 「이 잔」 옆(몽골판 хоёр аяга · энэ аяга)
  endSize: number; // 끝 띠 뜻 글자 크기 — 몽골판 58
  tags: string[]; // 이름표 셋의 뜻 — 「이 잔」(6.25초 · 머그) · 「두 잔」(15.55초 · 종이컵 둘) · 「-도」(17.6초 · 머그 옆)
  tagSize: number; // 이름표 뜻 글자 크기 — 몽골판 44(한글 88의 절반)
  reads: string[]; // 말풍선 · 생각 풍선 아래 읽는 법 일곱(글자 크기는 정본 그대로) — m1 아메리카노 이 잔 주세요 · think 이 잔…? · r1 이 잔이요? · m2 아메리카노 두 잔 주세요 · r2 네, 두 잔이요 · m3 이 잔도 주세요 · r3 네, 이 잔도요
  menuReads: string[]; // 메뉴판 세 줄 아래 읽는 법 — 한 잔 · 두 잔 · 세 잔
  coverAt: number; // 표지(cover.png)로 뜰 초 — 몽골판 4.75(머그 번쩍)
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
  lang: '글', font: '글', lineH: '수', hook: '글', hookSize: '수', r1: '글', r1Size: '수', heard: '글', heardSize: '수', menu: '글', menuSize: '수',
  two: '글', m2: '글', r2: '글', m3: '글', r3: '글', bandSize: '수', ends: { 글들: 2 }, endSize: '수', tags: { 글들: 3 }, tagSize: '수',
  reads: { 글들: 7 }, menuReads: { 글들: 3 }, coverAt: '수',
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
