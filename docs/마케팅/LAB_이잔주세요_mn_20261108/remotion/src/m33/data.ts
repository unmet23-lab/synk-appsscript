// LAB 몽골 M33 「이 잔 주세요」 장면 정본 — 말풍선 · 생각 풍선 · 메뉴판 · 이름표 · 끝 띠의 한국어. 판본마다 같다.
// 그 나라 글(위 띠 물음 · 뜻 줄, 점원 「이 잔이요?」의 뜻, 끝 띠의 뜻, 이름표 뜻, 말풍선 · 생각 풍선 · 메뉴판 아래 읽는 법)은
// 판본 글 하나(./판본/<KEY>.json — ./판본.ts)가 원천이다(11-18 판본 틀로 옮김 — 옛 TEXT · SAY.read · MENU.read · END.mn · TAG.mn은 판본 MN.json으로 옮겼다.
// 몽골어는 세 겹 검수(../../../검문/)를 거친 글 그대로). 키릴 읽는 법은 우리 몽골 편 규칙(ㅐㅔ=э · ㅜ=у · ㅓ=ө · ㅡ=ы, M28 data.ts와 같음).
// SAY의 차례가 판본 글 reads의 차례다(m1 · think · r1 · m2 · r2 · m3 · r3). MENU의 차례가 menuReads, END의 차례가 ends, TAG의 차례가 tags다.
const NL = String.fromCharCode(10);
export const SAY = {
  m1: `아메리카노${NL}이 잔 주세요!`,
  think: '이 잔…?',
  r1: '이 잔이요?',
  m2: `아메리카노${NL}두 잔 주세요!`,
  r2: '네, 두 잔이요!',
  m3: '이 잔도 주세요!',
  r3: '네, 이 잔도요!',
} as const;
export const READ_AT = { m1: 0, think: 1, r1: 2, m2: 3, r2: 4, m3: 5, r3: 6 } as const;
export const MENU = ['한 잔', '두 잔', '세 잔'] as const;
// 끝 띠(11-09 아르곤 맹검 뒤) — 문장부호 없이 한국어 크게 · 그 나라 뜻 작게. 몽골판 낱말은 세 겹 검수를 거친 «хоёр аяга» · «энэ аяга» 그대로(MN.json ends).
export const END = ['두 잔', '이 잔'] as const;
export const TAG = { thisCup: '이 잔', twoCups: '두 잔', also: '-도' } as const;
export const TAG_AT = { thisCup: 0, twoCups: 1, also: 2 } as const;
