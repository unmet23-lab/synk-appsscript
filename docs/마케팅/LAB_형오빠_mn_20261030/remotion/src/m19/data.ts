// LAB 몽골 M19 「ах = 형 · 오빠」 화면 글 정본. 몽골어는 세 겹 검수(../검문/화면글.txt)를 거친 글만 둔다.
// 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅡ=ы · 받침 ㅇ=н, 「아는 단어 총동원」 data.ts와 같음).
export const TEXT = {
  hook: 'Ах эгчээ солонгосоор юу гэж дууддаг вэ?',
  reveal: 'Нэг ах — хоёр нэр!',
  colA: 'Ах',
  colB: 'Эгч',
  rowM: 'Та эрэгтэй бол',
  rowF: 'Та эмэгтэй бол',
  end: 'Хэн дуудахаас хамаарна!',
};

// bubble = 그 장면에서 부르는 아이 머리 위 말풍선 자리(그림 941×1672 좌표) · tail = 꼬리 방향(-1 왼쪽 아래 · 1 오른쪽 아래)
export type Scene = { img: string; ko: string; read: string; mn: string; vo: string; bubble: [number, number]; tail: -1 | 1; cam: [number, number] };
export const SCENES: Scene[] = [
  { img: 'img/hyeong.jpg', ko: '형', read: 'хён', mn: 'Эрэгтэй хүн ахаа ингэж дууддаг', vo: 'h1', bubble: [190, 700], tail: 1, cam: [400, 900] },
  { img: 'img/oppa.jpg', ko: '오빠', read: 'оппа', mn: 'Эмэгтэй хүн ахаа ингэж дууддаг', vo: 'o1', bubble: [250, 790], tail: 1, cam: [420, 950] },
  { img: 'img/nuna.jpg', ko: '누나', read: 'нуна', mn: 'Эрэгтэй хүн эгчээ ингэж дууддаг', vo: 'n1', bubble: [260, 650], tail: 1, cam: [500, 900] },
  { img: 'img/eonni.jpg', ko: '언니', read: 'өнни', mn: 'Эмэгтэй хүн эгчээ ингэж дууддаг', vo: 'e1', bubble: [660, 580], tail: -1, cam: [470, 950] },
];

// 핵심 장면(둘이) 말풍선 — 왼쪽 남동생 「형!」 · 오른쪽 여동생 「오빠!」
// oops = 6.6~8.6초 반응 컷(형 「나…?」 · 남동생 웃음 · 여동생 머쓱 — v3 볼 이유 심사), oopsGirl = 그 그림의 여동생 말풍선 자리
export const OOPS = { img: 'img/oops.jpg', girl: [700, 760] as [number, number], cam: [560, 900] as [number, number] };
export const KEY = { img: 'img/key.jpg', boy: [190, 740] as [number, number], girl: [720, 770] as [number, number], cam: [470, 820] as [number, number] };
// 끝 가족 사진 이름표 자리(그림 좌표) — 형(오빠) 머리 위 · 누나(언니) 머리 위
export const END = { img: 'img/family.jpg', cam: [470, 1000] as [number, number], ah: [615, 500] as [number, number], egch: [250, 540] as [number, number] };

// ── 두 채널 판(11-06 15시 회차, 기획장부/LAB.md 머리말 「두 채널 판」) — 샤오훙수 간체 · 틱톡 버마어. 같은 정본에서 렌더하고 판끼리 따로 고치지 않는다.
// 한국어(말풍선 한글 · 남동생 도윤 · 여동생 소진 목소리)는 그대로, 읽는 법은 영어 로마자, 물음 · 풀이 · 범례 · 맺음 줄은 그 나라 말로 다시 썼다
// (현지어 세 겹 검수 — ../../게시/검문/zhs.txt · my.txt). 중국어 哥哥 · 姐姐, 버마어 အစ်ကို · အစ်မ도 몽골어 ах · эгч처럼 부르는 사람의 성별을 안 가른다.
// why = ✗ 순간의 까닭 줄(몽골 판 v1~v4 시험관 둘이 「✗가 왜 틀렸나」를 같이 짚음 — 두 채널 판만 더함, 몽골 판은 null이라 예전 렌더 그대로).
export type Loc = 'mn' | 'zhs' | 'my';
export type LocPack = {
  font: string; // 그 나라 글 서체 줄(한글 · 키릴 · 로마자는 SUIT · Inter Tight)
  lineH: number;
  hook: string;
  hookSize: number;
  reveal: string;
  revealSize: number;
  colA: string;
  colB: string;
  headSize: number;
  reads: [string, string, string, string]; // 형 · 오빠 · 누나 · 언니 읽는 법
  readSize: number;
  means: [string, string, string, string]; // 장면 넷 풀이 줄
  meanSize: number;
  why: [string, string] | null; // [여동생 「형!」 ✗ · 남동생 「언니!」 ✗]
  whySize: number;
  rowM: string;
  rowF: string;
  rowSize: number;
  end: string;
  endSize: number;
};
export const LOCS: Record<Loc, LocPack> = {
  mn: {
    font: "'Inter Tight', 'SUIT', sans-serif",
    lineH: 1.15,
    hook: TEXT.hook,
    hookSize: 56,
    reveal: TEXT.reveal,
    revealSize: 72,
    colA: TEXT.colA,
    colB: TEXT.colB,
    headSize: 52,
    reads: SCENES.map((s) => s.read) as [string, string, string, string],
    readSize: 56,
    means: SCENES.map((s) => s.mn) as [string, string, string, string],
    meanSize: 50,
    why: null,
    whySize: 44,
    rowM: TEXT.rowM,
    rowF: TEXT.rowF,
    rowSize: 64,
    end: TEXT.end,
    endSize: 62,
  },
  zhs: {
    font: "'Inter Tight', 'Microsoft YaHei', 'SUIT', sans-serif",
    lineH: 1.25,
    hook: '哥哥、姐姐\n用韩语怎么叫？',
    hookSize: 76,
    reveal: '同一个哥哥，\n两种叫法！',
    revealSize: 80,
    colA: '哥哥',
    colB: '姐姐',
    headSize: 56,
    reads: ['hyeong', 'oppa', 'nuna', 'eonni'],
    readSize: 56,
    means: ['男生这样叫哥哥', '女生这样叫哥哥', '男生这样叫姐姐', '女生这样叫姐姐'],
    meanSize: 60,
    why: ['女生不能叫“형”！', '男生不能叫“언니”！'], // Fable: 「X不叫“Y”」는 「X는 Y라는 이름이 아니다」로 먼저 읽힌다
    whySize: 58,
    rowM: '如果你是男生',
    rowF: '如果你是女生',
    rowSize: 74,
    end: '关键看是谁在叫！',
    endSize: 76,
  },
  my: {
    font: "'Inter Tight', 'SUIT', 'Myanmar Text', sans-serif",
    lineH: 1.5,
    hook: 'အစ်ကို၊ အစ်မကို\nကိုရီးယားလို ဘယ်လိုခေါ်လဲ?',
    hookSize: 64,
    reveal: 'အစ်ကို တစ်ယောက်တည်းကိုပဲ\nခေါ်ပုံ နှစ်မျိုး!', // Fable: တစ်ယောက်만이면 수 세기로 읽혀 「같은 한 사람」이 안 산다 · 대조기 11-07: 조사 없는 줄표는 직역투 → ကိုပဲ, 5 · 6번 구어 အစ်ကို့ကို
    revealSize: 62,
    colA: 'အစ်ကို',
    colB: 'အစ်မ',
    headSize: 54,
    reads: ['hyeong', 'oppa', 'nuna', 'eonni'],
    readSize: 56,
    means: ['ယောက်ျားလေးက အစ်ကို့ကို ဒီလိုခေါ်တယ်', 'မိန်းကလေးက အစ်ကို့ကို ဒီလိုခေါ်တယ်', 'ယောက်ျားလေးက အစ်မကို ဒီလိုခေါ်တယ်', 'မိန်းကလေးက အစ်မကို ဒီလိုခေါ်တယ်'],
    meanSize: 46,
    why: ['မိန်းကလေးက “형” လို့ မခေါ်ဘူး!', 'ယောက်ျားလေးက “언니” လို့ မခေါ်ဘူး!'], // Fable: 버마어 조판은 「」 대신 “ ”
    whySize: 50,
    rowM: 'ယောက်ျားလေးက ခေါ်ရင်', // 11-07 v4: 「남자라면」 → 「남자가 부르면」(시험관 셋 「색을 누구에게 맞춰 보나」 — 색은 부르는 사람)
    rowF: 'မိန်းကလေးက ခေါ်ရင်',
    rowSize: 66,
    end: 'ဘယ်သူခေါ်လဲဆိုတာပေါ်\nမူတည်တယ်!',
    endSize: 76,
  },
};
