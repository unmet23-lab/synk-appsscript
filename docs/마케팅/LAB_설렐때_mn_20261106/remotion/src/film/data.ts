// LAB 몽골 M31 「설렐 때 네 마디」 화면 글 정본(11-06). 몽골어는 세 겹 검수(../../../검문/화면글.txt)를 거친 글만 둔다.
// 우리편 M1 「화날 때 네 마디」(10-31, 인스타 72시간 19,463회 · 평소의 136배)의 뼈대를 1:1로 — 머리 글 → 상황 칸 + 표현 칸 넷 → 끝.
// M1이 몽글의 나쁜 하루였다면 이 편은 그 거울: 늦가을 캠퍼스에서 그 사람 때문에 설렘 게이지가 찬다. 끝은 그 사람 앞에서 굳은 인사 →
// 혼자 남자 「내일 시간 있어?」 → 그제야 터지는 불꽃놀이(터짐은 한 번만 — 11-04 관문 조건 ⑴).
// 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅜ=у · ㅡ=ы · 받침 ㅇ=н). 소리는 소진(세기 1.0) · 그 사람 범수 · 효과음은 직접 합성(../../../소리/만들기.py).
export const FPS = 30;
export const TOTAL = 29.0;

export type Bubble = {
  n: number; // 1~4
  ko: string;
  read: string;
  mn: string;
  gauge: number; // 이 칸에서 차오르는 설렘 게이지(0~1)
  side: 'left' | 'right';
  bottom: number;
  width: number;
  tip: [number, number];
};

export type Cell = {
  at: number;
  img: string;
  sit?: string;
  next?: { at: number; img: string };
  bubble?: Bubble;
  vo?: { id: string; at: number }[];
};

export const TEXT = {
  hook: 'Зүрх догдлох үедээ\nхэлэх 4 хэллэг',
  gauge: 'ДОГДЛОЛ',
  call: { ko: '몽글아!', read: 'монгыра', mn: '(миний нэр!)' },
  hiKo: '안녕!',
  hiRead: 'аннён',
  hiMn: 'Сайн уу!',
  replyKo: '안녕하세요…',
  replyRead: 'аннёнхасэё',
  replyMn: 'Сайн байна уу…',
  msgKo: '내일 시간 있어?',
  msgMn: 'Маргааш завтай юу?',
  replyMsgKo: '네! 있어요!',
  replyMsgRead: 'нэ! иссөё!',
  replyMsgMn: 'Тийм ээ, завтай!',
  inner: 'дотроо',
  end1: 'Найздаа л хэлдэг 4 үг —',
  end2: 'тэр хүний өмнө дотроо л!',
};

export const CELLS: Cell[] = [
  // 머리 칸 — 끝 장면(그 사람 앞에서 굳은 인사)을 앞에서 먼저: 「안녕!」에 「안녕하세요…」, 속으로는 「반했어!!」(시험 v2 · v3 볼 이유 심사 「0~3초가 강의 광고처럼 멈춤 — 24초 장면을 첫 컷으로」)
  { at: 0.0, img: 'open.jpg', vo: [{ id: 'b2', at: 0.1 }, { id: 'a5', at: 0.75 }] },
  { at: 3.2, img: 'lib1.jpg', sit: 'Номын санд харц тулгарчихлаа…' },
  {
    at: 5.0, img: 'lib2.jpg', vo: [{ id: 'a1', at: 5.12 }, { id: 'a1', at: 6.5 }],
    bubble: { n: 1, ko: '두근두근', read: 'дугындугын', mn: 'Зүрх минь түг түг\nцохилж байна!', gauge: 0.25, side: 'right', bottom: 700, width: 660, tip: [620, 840] },
  },
  { at: 7.7, img: 'rain1.jpg', next: { at: 8.6, img: 'rain2.jpg' }, sit: 'Шүхэргүй зогсож байтал\nтэр шүхрээрээ халхлаад өглөө…' },
  {
    at: 9.6, img: 'rain3.jpg', next: { at: 11.05, img: 'rain3b.jpg' }, vo: [{ id: 'a2', at: 9.72 }, { id: 'a2', at: 11.1 }],
    bubble: { n: 2, ko: '설레!', read: 'сөллэ', mn: 'Сэтгэл минь\nдогдолж байна!', gauge: 0.5, side: 'right', bottom: 680, width: 560, tip: [600, 730] },
  },
  { at: 12.5, img: 'hall1.jpg', sit: 'Тэр миний нэрийг санаж байжээ…', vo: [{ id: 'b1', at: 12.66 }] },
  {
    at: 14.4, img: 'hall2.jpg', vo: [{ id: 'a3', at: 14.52 }, { id: 'a3', at: 16.0 }],
    bubble: { n: 3, ko: '심쿵!', read: 'шимкун', mn: 'Зүрх минь зогсох\nшиг боллоо!', gauge: 0.75, side: 'left', bottom: 680, width: 620, tip: [520, 890] },
  },
  { at: 17.5, img: 'tree1.jpg', sit: 'Тэр надад инээмсэглэлээ…' },
  {
    at: 19.4, img: 'tree2.jpg', next: { at: 20.95, img: 'tree2b.jpg' }, vo: [{ id: 'a4', at: 19.52 }, { id: 'a4', at: 21.0 }],
    bubble: { n: 4, ko: '반했어…', read: 'банхэссө', mn: 'Дурлачихлаа…', gauge: 1, side: 'right', bottom: 860, width: 600, tip: [580, 1170] },
  },
  // 끝 — 그 사람 앞에서 굳은 인사(게이지는 꽉 차 떨기만, 터지지 않음) → 혼자 남자 문자 → 그제야 불꽃놀이
  { at: 22.5, img: 'greet.jpg', vo: [{ id: 'b2', at: 22.62 }, { id: 'a5', at: 23.32 }] },
  { at: 24.4, img: 'phone.jpg' },
  { at: 25.7, img: 'burst.jpg' },
];

export const GREET_AT = 22.5;
export const PHONE_AT = 24.4;
export const MSG_AT = 24.55;
export const BURST_AT = 25.7;
export const END_LINE_AT = 22.8; // 맺음 줄 — 그 사람 앞에서 굳은 인사 칸(겉 「안녕하세요…」 · 속 「반했어!!」인 바로 그 자리). 시험 v3 · v4 · v5 볼 이유 「끝 화면에 글 상자가 몰려 답장이 1초 남짓」으로 끝에서 옮겼다
// 답장 — 속으로는 불꽃놀이인데 문자 답은 또 공손하게 「네! 있어요!」(장면 심사 v1 「다음에 무엇을 보고 싶나 — 유령이 뭐라고 답하는지 · 또 존댓말인지」)
export const REPLY_AT = 26.95; // 원본 M1 끝 장치(26.9초) 자리 — 답장이 2초 넘게 숨 쉬게
export const OPEN_INNER_AT = 1.5; // 머리 칸의 생각 구름
export const INNER_AT = 23.45; // 「안녕하세요…」와 함께 — 속마음 구름(v2 시험: 작은 딱지라 못 읽음)

// 배경음 — public/sfx/bgm.wav는 보유곡 시티팝_147(docs/홍보물/BGM)의 앞 29.6초. 말 둘레에서만 낮춘다
export const BGM_VOL = 0.2;
export const BGM_DUCK = 0.5;
export const VO_LEN: Record<string, number> = { a1: 0.79, a2: 0.6, a3: 0.71, a4: 0.66, a5: 0.95, a6: 0.9, b1: 0.7, b2: 0.5 };
export const REPLY_VO = { id: 'a6', at: 27.1 };
// 게이지가 넘칠 듯 차오르는 심장 박자(끝 칸) — 효과음 heart.wav와 같은 초
export const HOLD_BEATS = [22.75, 23.15, 23.5, 23.8, 24.05, 25.0, 25.3];

export const SFX: { file: string; at: number; vol: number }[] = [
  { file: 'heart.wav', at: 0.15, vol: 0.55 },
  { file: 'heart.wav', at: 0.95, vol: 0.65 },
  { file: 'heart.wav', at: 1.7, vol: 0.75 },
  { file: 'heart.wav', at: 2.4, vol: 0.85 },
  { file: 'campus.wav', at: 0.0, vol: 0.5 },
  { file: 'freeze.wav', at: 0.7, vol: 0.5 },
  { file: 'sparkle.wav', at: 1.5, vol: 0.35 },
  { file: 'page.wav', at: 3.25, vol: 0.7 },
  { file: 'heart.wav', at: 4.4, vol: 0.8 },
  { file: 'sparkle.wav', at: 5.0, vol: 0.4 },
  { file: 'heart.wav', at: 5.9, vol: 0.7 },
  { file: 'heart.wav', at: 7.2, vol: 0.6 },
  { file: 'rain.wav', at: 7.7, vol: 0.55 },
  { file: 'umbrella.wav', at: 8.55, vol: 0.8 },
  { file: 'sparkle.wav', at: 9.6, vol: 0.5 },
  { file: 'chime.wav', at: 12.58, vol: 0.35 },
  { file: 'thud.wav', at: 14.4, vol: 0.9 },
  { file: 'leaves.wav', at: 17.5, vol: 0.6 },
  { file: 'melt.wav', at: 19.42, vol: 0.5 },
  { file: 'campus.wav', at: 22.5, vol: 0.6 },
  { file: 'freeze.wav', at: 23.18, vol: 0.5 },
  { file: 'heart.wav', at: 22.75, vol: 0.55 },
  { file: 'heart.wav', at: 23.15, vol: 0.62 },
  { file: 'heart.wav', at: 23.5, vol: 0.7 },
  { file: 'heart.wav', at: 23.8, vol: 0.78 },
  { file: 'heart.wav', at: 24.05, vol: 0.85 },
  { file: 'buzz.wav', at: 24.42, vol: 0.75 },
  { file: 'ding.wav', at: 24.58, vol: 0.45 },
  { file: 'heart.wav', at: 25.0, vol: 0.9 },
  { file: 'heart.wav', at: 25.3, vol: 0.95 },
  { file: 'rise.wav', at: 25.2, vol: 0.7 },
  { file: 'burst.wav', at: 25.7, vol: 1 },
  { file: 'ding.wav', at: 26.97, vol: 0.4 },
  { file: 'sparkle.wav', at: 27.0, vol: 0.45 },
];

// ── 현지어 판(두 채널 판 — 샤오훙수 간체 · 틱톡 버마어, 장부 머리말 「두 채널 판」). 같은 정본에서 렌더하고 판끼리 따로 고치지 않는다.
export type Loc = 'mn' | 'zhs' | 'my';
export type LocPack = {
  font: string;
  lineH: number;
  hook: string;
  hookSize: number;
  gauge: string;
  sits: string[];
  sitSize: number;
  reads: string[];
  means: string[];
  meanSize: number;
  callRead: string;
  callMn: string;
  hiRead: string;
  hiMn: string;
  replyRead: string;
  replyMn: string;
  msgMn: string;
  replyMsgRead: string;
  replyMsgMn: string;
  inner: string;
  end1: string;
  end2: string;
  endSize: number;
};
export const LOCS: Record<Loc, LocPack> = {
  mn: {
    font: "'Inter Tight', 'SUIT', sans-serif",
    lineH: 1.14,
    hook: TEXT.hook,
    hookSize: 78,
    gauge: TEXT.gauge,
    sits: CELLS.filter((c) => c.sit).map((c) => c.sit as string),
    sitSize: 54,
    reads: CELLS.filter((c) => c.bubble).map((c) => (c.bubble as Bubble).read),
    means: CELLS.filter((c) => c.bubble).map((c) => (c.bubble as Bubble).mn),
    meanSize: 50,
    callRead: TEXT.call.read,
    callMn: TEXT.call.mn,
    hiRead: TEXT.hiRead,
    hiMn: TEXT.hiMn,
    replyRead: TEXT.replyRead,
    replyMn: TEXT.replyMn,
    msgMn: TEXT.msgMn,
    replyMsgRead: TEXT.replyMsgRead,
    replyMsgMn: TEXT.replyMsgMn,
    inner: TEXT.inner,
    end1: TEXT.end1,
    end2: TEXT.end2,
    endSize: 60,
  },
  // 두 채널 판은 몽골 판 세 겹 검수 뒤 현지어 세 겹(게시/검문/zhs.txt · my.txt)을 거쳐 채운다 — 그 전에는 몽골 판 글이 그대로 남지 않게 빈 칸 대신 몽골 판을 막는다
  zhs: undefined as unknown as LocPack,
  my: undefined as unknown as LocPack,
};
