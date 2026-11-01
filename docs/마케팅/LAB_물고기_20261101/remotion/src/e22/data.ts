// LAB 영어 E22 「물고기」 화면 글 정본. 그림은 판/*.png(GPT 이미지 2.5, 몽글 정본은 생김새 참고로만)를 public/img로 옮긴 것.
// 한국어 낱말과 읽는 법(로마자) · 소리는 모든 판이 같고, 뜻 글만 그 나라 말로 다시 쓴다(기획장부/LAB.md 머리말 「두 채널 판」).
export const READ = { mul: 'mul', gogi: 'go-gi', mulgogi: 'mul-go-gi', nun: 'nun', nunmul: 'nun-mul', gae: 'gae', mulgae: 'mul-gae' };

export type Loc = 'en' | 'zhs' | 'my';
export type LocPack = {
  font: string;
  lineH: number;
  water: string;
  meat: string;
  eye: string;
  dog: string;
  litFish: string; // 물고기 — 글자 그대로
  fish: string;
  tears: string;
  litSeal: string;
  seal: string;
  endA: string; // 끝 줄 앞(물 앞)
  endB: string; // 끝 줄 뒤(물 뒤)
  endSize: number;
  lunch: string; // 몽글 말풍선
  lunchSize: number;
  mean: number; // 뜻 글 크기
};
export const LOCS: Record<Loc, LocPack> = {
  en: {
    font: "'Inter Tight', 'SUIT', sans-serif",
    lineH: 1.12,
    water: 'water',
    meat: 'meat',
    eye: 'eye',
    dog: 'dog',
    litFish: 'water meat?',
    fish: 'FISH',
    tears: 'TEARS',
    litSeal: 'water dog?',
    seal: 'SEAL',
    endA: 'Just add ',
    endB: '.',
    endSize: 72,
    lunch: 'My lunch!!',
    lunchSize: 100,
    mean: 66,
  },
  zhs: {
    font: "'Inter Tight', 'Microsoft YaHei', 'SUIT', sans-serif",
    lineH: 1.18,
    water: '水',
    meat: '肉',
    eye: '眼睛',
    dog: '狗',
    litFish: '水肉？',
    fish: '鱼',
    tears: '眼泪',
    litSeal: '水狗？',
    seal: '海狗',
    endA: '加个 ',
    endB: ' 就行',
    endSize: 70,
    lunch: '我的午饭！！',
    lunchSize: 100,
    mean: 70,
  },
  my: {
    font: "'Inter Tight', 'SUIT', 'Myanmar Text', sans-serif",
    lineH: 1.4,
    water: 'ရေ',
    meat: 'အသား',
    eye: 'မျက်လုံး',
    dog: 'ခွေး',
    litFish: 'ရေအသား?',
    fish: 'ငါး',
    tears: 'မျက်ရည်',
    litSeal: 'ရေခွေး?',
    seal: 'ပင်လယ်ဖျံ',
    endA: '',
    endB: ' ထည့်လိုက်ရုံပဲ',
    endSize: 38,
    lunch: 'ငါ့နေ့လယ်စာ!!',
    lunchSize: 84,
    mean: 60,
  },
};
