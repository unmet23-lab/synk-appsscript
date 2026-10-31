// LAB 영어 E19 「4층 F」 화면 글 정본. 그림은 판/*.png(GPT 이미지 2.5, 몽글 정본은 생김새 참고로만)를 public/img로 옮긴 것.
// 한국어(일 · 이 · 삼 · 사)와 읽는 법(로마자) · 소리는 모든 판이 같고, 영어 글만 그 나라 말로 다시 쓴다(기획장부/LAB.md 머리말 「두 채널 판」).
export const COUNT = [
  { ko: '일', read: 'il', n: '1' },
  { ko: '이', read: 'i', n: '2' },
  { ko: '삼', read: 'sam', n: '3' },
  { ko: '사', read: 'sa', n: '4' },
];

// 버튼 자리(그림 940×1672 좌표) — 아래 1부터 위 5까지
export const BTN = { x: 298, r: 112, y1: 1270, y2: 996, y3: 718, yF: 440, y5: 158 };

export type Loc = 'en' | 'zhs' | 'my';
export type LocPack = {
  font: string;
  hook: string;
  hookSize: number;
  death: string; // 死 옆 뜻
  sameSound: string;
  floorF: string;
  so: string;
  soSub: string;
  soSize: number;
  phew: string;
  phewSize: number;
  end: string;
  endSize: number;
  lineH: number;
};
export const LOCS: Record<Loc, LocPack> = {
  en: {
    font: "'Inter Tight', 'SUIT', sans-serif",
    hook: 'Where’s floor 4?',
    hookSize: 64,
    death: 'death',
    sameSound: '4 and death: same sound.',
    floorF: 'The death floor.',
    so: 'So the button says F.',
    soSub: 'F = Four',
    soSize: 66,
    phew: 'Phew…',
    phewSize: 88,
    end: 'A ghost followed you.',
    endSize: 72,
    lineH: 1.15,
  },
  zhs: {
    font: "'Inter Tight', 'Microsoft YaHei', 'SUIT', sans-serif",
    hook: '4楼去哪了？',
    hookSize: 72,
    death: '死',
    sameSound: '韩语里发音一模一样！',
    floorF: '死亡楼层',
    so: '所以按钮标成 F',
    soSub: 'F = Four（四）',
    soSize: 72,
    phew: '呼……',
    phewSize: 88,
    end: '有个鬼跟你出来了',
    endSize: 78,
    lineH: 1.2,
  },
  my: {
    font: "'Inter Tight', 'SUIT', 'Myanmar Text', sans-serif",
    hook: '၄ လွှာ ဘယ်မှာလဲ?',
    hookSize: 58,
    death: 'သေခြင်း',
    sameSound: 'အသံတူတယ်',
    floorF: 'သေမင်းလွှာ',
    so: 'ဒါကြောင့် ခလုတ်မှာ F လို့ ရေးတယ်',
    soSub: 'F = Four (၄)',
    soSize: 54,
    phew: 'ဟူး…',
    phewSize: 88,
    end: 'တစ္ဆေတစ်ကောင် လိုက်လာပြီ',
    endSize: 62,
    lineH: 1.4,
  },
};
