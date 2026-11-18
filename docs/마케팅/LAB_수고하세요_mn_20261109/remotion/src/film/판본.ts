// 판본(나라별 글, 11-10 LAB 하루 두 편 · 설계 6 · 20) — src/film/판본/<KEY>.json 하나가 판본 하나다. 옛 data.ts(TEXTS · FONTS — mn · cn · mm)를 대신한다(11-18 판본 틀로 옮김).
// LAB 몽골 M32 「수고하세요 ↔ 안녕히 계세요」. 몽골어는 세 겹 검수(../../../게시/검문/), 간체 · 버마어는 두 채널 판 세 겹 검수(같은 폴더 zhs.txt · my.txt)를 거친 글만 판본/MN · CN · MM.json에.
// 키는 계정 원장(docs/마케팅/sns-계정.json) LAB 계정의 rotationVersion, 없으면 countryCode. 같은 영어라도 나라마다 판본이 따로다.
// 그림 · 한국어(말풍선 · 팻말의 수고하세요 · 안녕히 계세요 · 끝 띠의 안녕히 계세요!) · 소리 · 박자 · 카메라는 정본 하나(data.ts · Film.tsx)이고, 판본은 글 자리와 글꼴만 바꾼다(원본 동결).
// 글이 다 찬 판본만 낸다 — 빈 칸이 있으면 Root가 컴포지션을 등록하지 않고, 편 폴더의 판본렌더.mjs가 그 키를 건너뛰며 빈 칸을 알린다.
// `_`로 시작하는 칸(_설명 · _한도 · _원문)은 글 쓰는 사람을 위한 안내라 읽지 않는다. 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅜ=у · ㅡ=ы · 받침 ㅇ=н).
// 옛 코드에서 버마어 판만 다르게 그리던 것(위 띠 글자 0.82배 · 팻말 0.94배 · 줄 높이 1.5 · 팻말 위 끝 850px)은 꾸러미 칸(…Size · lineH · meanLineH · ruleTop)이 됐다.
export type LocPack = {
  lang: string; // 언어(계정 원장 language)
  font: string; // 그 나라 글 서체 줄(키릴 · 로마자는 Inter Tight · SUIT, 그 밖의 문자는 시스템 글꼴을 뒤에)
  lineH: number; // 쪽빛 펠트 띠(머리 글 · 왜 줄 · 다시 줄 · 팻말 · 장난 줄 · 끝 띠)의 줄 높이 — 몽골 · 간체판 1.18, 버마어판 1.5
  hook: string; // 0~1.75초 위 띠 「교수님께 «수고하세요»라고 하면…」(«수고하세요»의 한글은 글 속에 그대로)
  hookSize: number;
  a1Mean: string; // 0.25~3.25초 몽글 말풍선 「교수님, 수고하세요!」의 뜻 줄
  literal: string; // 5.5~8.7초 위 띠 첫 줄 「수고하세요 = «일 잘하세요!»」(한글 수고하세요는 글 속에 그대로)
  literalNote: string; // 같은 띠 둘째 줄 「윗사람에게는 어색하게 들릴 때가 있다」
  literalSize: number;
  again: string; // 8.7~10.6초 위 띠 「그럼 «안녕히 계세요»라고 하면…」(되감기)
  againSize: number;
  a2Mean: string; // 9.4~11.0초 몽글 「안녕히 계세요!」의 뜻 줄 — 19.1~20.6초 외침 「안녕히 계세요!!」 말풍선에도 같은 줄이 뜬다
  b1Mean: string; // 11.0~12.9초 교수 「그래요, 잘 가요」의 뜻 줄
  ruleFriend: string; // 12.9~16.4초 위아래 판 사이 팻말 첫 줄 「친구 · 동료에게」(뒤에 「: 수고하세요」가 붙는다)
  ruleElder: string; // 같은 팻말 둘째 줄 「교수님 · 윗사람에게」(뒤에 「: 안녕히 계세요」가 붙는다)
  ruleSize: number;
  ruleTop: number; // 팻말 위 끝(px) — 몽골 · 간체판 872, 버마어판 850(줄 높이가 커서 위로)
  gag: string; // 16.5~17.3초 위 띠 「윗사람은 너에게 말해도 된다」(교수 「수고해요」)
  gagSize: number;
  b2Mean: string; // (선택) 16.52~17.4초 교수 「수고해요」 말풍선의 뜻 줄 — 비우면 말풍선이 작아지고 뜻 줄이 없다(몽골판)
  end: string; // 20.6초~끝 위 띠 「교수님께:」(뒤에 한글 「안녕히 계세요!」가 붙는다)
  endSize: number;
  meanSize: number; // 말풍선 뜻 줄(a1Mean · a2Mean · b1Mean · b2Mean) 글자 크기 — 정본 44
  meanLineH: number; // 말풍선 뜻 줄의 줄 높이 — 몽골 · 간체판 1.16, 버마어판 1.5
  reads: string[]; // 말풍선 아래 읽는 법 여섯(data.ts READ_AT 차례) — 교수님, 수고하세요! · 안녕히 계세요! · 그래요, 잘 가요 · 수고해요 · 네! 수고하… · 안녕히 계세요!!
  coverAt: number; // 표지(cover.png)로 뜰 초 — 몽골판 2.47(프레임 74 · 나간 몽골 표지), 간체 · 버마어판 6.5
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
  lang: '글', font: '글', lineH: '수', hook: '글', hookSize: '수', a1Mean: '글', literal: '글', literalNote: '글', literalSize: '수',
  again: '글', againSize: '수', a2Mean: '글', b1Mean: '글', ruleFriend: '글', ruleElder: '글', ruleSize: '수', ruleTop: '수',
  gag: '글', gagSize: '수', b2Mean: '글?', end: '글', endSize: '수', meanSize: '수', meanLineH: '수', reads: { 글들: 6 }, coverAt: '수',
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
