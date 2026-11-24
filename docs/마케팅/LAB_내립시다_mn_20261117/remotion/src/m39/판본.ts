// 판본(나라별 글, 11-10 LAB 하루 두 편 · 설계 6 · 20) — src/m39/판본/<KEY>.json 하나가 판본 하나다.
// 키는 계정 원장(docs/마케팅/sns-계정.json) LAB 계정의 rotationVersion, 없으면 countryCode. 같은 영어라도 나라마다 판본이 따로다.
// 그림 · 한국어(외침 「내립시다!」 · 큰 한글 · 목소리) · 소리 · 박자 · 카메라는 정본 하나(Film.tsx · timeline.ts)이고, 판본은 글 자리와 글꼴만 바꾼다(원본 동결).
// 글이 다 찬 판본만 낸다 — 빈 칸이 있으면 Root가 컴포지션을 등록하지 않고, 편 폴더의 판본렌더.mjs가 그 키를 건너뛰며 빈 칸을 알린다.
// `_`로 시작하는 칸(_설명 · _한도 · _원문)은 글 쓰는 사람을 위한 안내라 읽지 않는다.
export type LocPack = {
  lang: string; // 언어(계정 원장 language)
  font: string; // 그 나라 글 서체 줄(키릴 · 로마자는 Inter Tight · SUIT, 그 밖의 문자는 시스템 글꼴을 뒤에)
  sayFont: string; // 장면 속 외침 글(together · ok · callAunt · wait)의 서체 줄 — 몽골판은 한국어 외침과 같은 SUIT 먼저(원래 그대로)
  lineH: number; // 그 나라 글 줄 높이 하한(배수) — 칸마다 원래 값(외침 1.05 · 큰 줄 1.12 · 작은 줄 · 덧붙임 · 읽는 법 1.2)보다 클 때만 쓴다. 몽골판 1.05(원래 값 그대로)
  hook: string; // 0~1.92초 위쪽 머리 글 「붐비는 지하철. 한 아주머니가 크게 말했다…」(줄 바꿈 문자로 두 줄)
  hookSize: number; // 몽골판 72
  callRead: string; // 1.07~1.92초 아주머니 외침 「내립시다!」 아래 읽는 법(몽골판 «нэрипсида!»)
  heardSmall: string; // 1.92~5.3초 위 작은 줄 「「내립시다!」는 이렇게 들렸다:」(한글 「내립시다!」는 글 속에 그대로)
  smallSize: number; // 작은 줄(heardSmall · meantSmall · youSmall) 글자 크기 — 몽골판 52
  heard: string; // 1.92~5.3초 큰 줄 — 몽글이 알아들은 뜻 「「같이 내리자!」」
  heardSize: number; // 몽골판 100
  together: string; // 2.8~4.3초 몽글 머리 위 산호색 외침 「같이?!」
  togetherSize: number; // 몽골판 104
  ok: string; // 4.4~5.3초 몽글 머리 위 산호색 외침 「좋아!!」
  okSize: number; // 몽골판 130
  gotOff: string; // 7.36~9.42초 위 상황 줄 「그래서 따라 내렸다.」
  gotOffSize: number; // 몽골판 74
  callAunt: string; // 9.42~10.42초 몽글 곁 외침 — 멀어지는 아주머니를 부르는 말 「아주머니…?」
  callAuntSize: number; // 몽골판 92
  noLook: string; // 9.42~11.41초 위 상황 줄 「아주머니는 돌아보지도 않았다.」
  noLookSize: number; // 몽골판 74
  back: string; // 11.41~12.01초 위 상황 줄 「도로 타려는데…」(0.6초뿐)
  backSize: number; // 몽골판 74
  wait: string; // 11.46~12.83초 · 12.83~13.73초 몽글 외침 「기다려요!!」(두 번 — 열차 문 앞 · 창 안 얼굴 칸)
  waitSizes: number[]; // 두 외침의 글자 크기 — 몽골판 92 · 96
  shut: string; // 12.01~14.59초 위 상황 줄 「문이 닫혀 버렸다!」
  shutSize: number; // 몽골판 78
  line: string; // 14.59~17.6초 위 큰 줄 「여기는 내가 내릴 역이 아니었다.」
  lineSize: number; // 몽골판 80
  meantSmall: string; // 17.6~20.91초 위 작은 줄 「아주머니의 「내립시다!」는:」(한글 「내립시다!」는 글 속에 그대로)
  meant: string; // 17.6~20.91초 큰 줄 — 아주머니가 한 말의 뜻 「「나 내려요, 길 비켜 줘요!」」(줄 바꿈 문자로 두 줄)
  meantSize: number; // 몽골판 88
  fair: string; // 19.0~20.91초 큰 줄 아래 덧붙임 「붐비는 칸에서는 이렇게 말한다.」
  fairSize: number; // 몽골판 62
  youSmall: string; // 20.91~22.95초 위 작은 줄 「내가 내릴 때는 이렇게 말해:」(그 아래 큰 한국어 「잠시만요, 내릴게요」는 정본)
  youRead: string; // 20.91~22.95초 큰 한국어 아래 읽는 법(몽골판 키릴 «жамсиманё, нэрилгэё»)
  youReadSize: number; // 몽골판 62
  eq: string; // 22.95~24.85초 큰 줄 — 「잠시만요, 내릴게요」의 뜻 「「실례합니다, 저 내려요.」」(줄 바꿈 문자로 두 줄, 위 작은 한국어는 정본)
  eqSize: number; // 몽골판 78
  pracRead: string; // 25.75초~끝 몽글 연습 외침 「잠시만요… 내릴게요…」 아래 줄 「(연습하는 중…)」
  endSmall: string; // 24.85초~끝 위 끝 줄 「다음 열차: 8분」
  endSmallSize: number; // 몽골판 62
  coverAt: number; // 표지(cover.png)로 뜰 초 — 몽골판 1.45(만원 지하철에서 「내립시다!」를 외치는 아주머니와 머리 글). 인사가 있는 판본은 인사 길이만큼 뒤
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
  lang: '글', font: '글', sayFont: '글', lineH: '수', hook: '글', hookSize: '수', callRead: '글', heardSmall: '글', smallSize: '수', heard: '글', heardSize: '수',
  together: '글', togetherSize: '수', ok: '글', okSize: '수', gotOff: '글', gotOffSize: '수', callAunt: '글', callAuntSize: '수', noLook: '글', noLookSize: '수',
  back: '글', backSize: '수', wait: '글', waitSizes: { 수들: 2 }, shut: '글', shutSize: '수', line: '글', lineSize: '수',
  meantSmall: '글', meant: '글', meantSize: '수', fair: '글', fairSize: '수', youSmall: '글', youRead: '글', youReadSize: '수', eq: '글', eqSize: '수',
  pracRead: '글', endSmall: '글', endSmallSize: '수', coverAt: '수',
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
