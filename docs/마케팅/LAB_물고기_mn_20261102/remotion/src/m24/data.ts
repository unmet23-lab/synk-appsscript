// LAB 몽골 M24 「물고기 = загас」 화면 글 정본. 그림 · 소리는 영어 편 E22(LAB_물고기_20261101)를 나눠 쓴다(장부 관문 조건).
// 몽골어는 세 겹 검수(../../검문/화면글.txt)를 거친 글만 둔다. 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅡ=ы · 받침 ㅇ=н).
export const READ = { mul: 'мул', gogi: 'гоги', mulgogi: 'мулгоги', nun: 'нун', nunmul: 'нунмул', gae: '', mulgae: '' };

export type Loc = 'mn';
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
  endA: string;
  endB: string;
  endSize: number;
  lunch: string; // 몽글 말풍선
  lunchSize: number;
  mean: number; // 뜻 글 크기
  bye: string; // 끝 — 몽글의 작별
  both: string; // 끝 — 고기도 이제 물고기(금붕어와 둘 다)
  byeSize: number;
};
export const LOCS: Record<Loc, LocPack> = {
  mn: {
    font: "'Inter Tight', 'SUIT', sans-serif",
    lineH: 1.14,
    water: 'ус',
    meat: 'мах',
    eye: 'нүд',
    dog: '',
    litFish: 'Шууд орчуулбал:\n«усны мах» 🤔',
    fish: 'Жинхэнэ утга нь:\nЗАГАС',
    tears: 'НУЛИМС',
    litSeal: '',
    seal: '',
    endA: '',
    endB: '',
    endSize: 72,
    lunch: 'Миний өдрийн хоол!!',
    lunchSize: 84,
    mean: 76,
    bye: 'Баяртай, мах минь! 👋',
    byeSize: 62,
    both: 'Одоо хоёулаа 🐟',
  },
};
