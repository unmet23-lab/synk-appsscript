// 제품 두 안(10-22 유호님 「1안 2안 둘 다 띄워줘볼래 ?」): 홈쇼핑 장면 넷은 같은 틀에 제품 렌더 · 글만 바꿔 끼운다.
// 공포 컷 · 목소리 · 값(99,000 → 990,000 → 9,900,000 → 9,900원)은 두 안이 같다 — 대사에 제품 이름이 없다.
// 렌더 프레임 열(Seq)은 블렌더 알파 렌더(1080²)이고, cx · top · bottom은 그 프레임에서 받침째 제품이 차지하는 자리(px)다 —
// Turntable이 이 값으로 「받침 밑이 화면의 bottom에, 받침째 높이가 h px」가 되게 키운다.

export type Seq = { dir: string; prefix: string; n: number; cx: number; top: number; bottom: number };

export type Product = {
  key: '1' | '2';
  phone: string;
  main: Seq; // H1 · H2 · HE의 회전 받침
  h1: { big: string; small: string; h: number }; // h는 HE도 같이 쓴다
  // stickerAt(구성 딱지 x · y · 지름) · band(「매진 임박」 띠 left · top)가 없으면 1안 자리
  h2: { big: string; small: string; sticker: string; stickerAt?: [number, number, number]; band?: [number, number];
    tables: { cx: number; bottom: number; h: number; offset: number; dim?: number }[] };
  // solo가 없으면 받침만 크게 + main을 아주 작게(1안 미니 병), 있으면 받침째 렌더한 그 프레임 열 하나(2안 뚜껑, shadow는 그림자 진하기)
  h3: { big: string; small: string; sticker: string; arrowTo: [number, number]; solo?: { seq: Seq; h: number; shadow?: number } };
  he: { big: string; small: string };
};

// 1안 · 맑음 MALGEUM 토너(지유 v7 블렌더 병 A2, 블렌더/돌림판.py) — 120장 −60°→+60°
export const P1: Product = {
  key: '1',
  phone: '1577-맑음',
  main: { dir: 'bottle', prefix: 'full', n: 120, cx: 540, top: 262, bottom: 908 },
  h1: { big: '맑음 MALGEUM', small: '토너 150ml', h: 720 },
  h2: {
    big: '맑음 토너', small: '3병 세트', sticker: '3병\n세트',
    tables: [
      { cx: 985, bottom: 905, h: 540, offset: 6, dim: 0.08 },
      { cx: 1560, bottom: 905, h: 540, offset: -6, dim: 0.08 },
      { cx: 1272, bottom: 962, h: 680, offset: 0 },
    ],
  },
  h3: { big: '맑음 토너', small: '미니 10ml', sticker: '실제 크기', arrowTo: [1355, 690] },
  he: { big: '맑음 MALGEUM', small: '토너 150ml' },
};

// 2안 · 가상 브랜드 「꽉 KKWAK」 진공 밀폐용기(블렌더/밀폐용기.py) — 대 · 중 · 소를 쌓은 탑, 셋째는 뚜껑만 하나. 96장 −45°→+45°
// cx · top · bottom은 렌더 프레임들의 알파 > 200 테두리를 합친 상자(1안 병 값도 같은 문턱으로 잰 것)
export const STACK: Seq = { dir: 'kkwak', prefix: 'stack', n: 96, cx: 540, top: 230, bottom: 940 };
export const LID: Seq = { dir: 'kkwak', prefix: 'lid', n: 96, cx: 540, top: 419, bottom: 798 };
export const P2: Product = {
  key: '2',
  phone: '1577-꽉꽉',
  main: STACK,
  h1: { big: '꽉 KKWAK', small: '진공 밀폐용기 3종', h: 720 },
  // Fable P2(10-22): 1안 자리의 「매진 임박」 띠가 앞 탑 맨 아래 라벨 · 토마토를, 「6종 세트」 딱지가 뒤 탑 맨 위 용기를 덮었다 —
  // 띠는 뒤 탑 받침 앞으로 내리고, 딱지는 오른쪽 위로 작게, 뒤 탑은 작게
  h2: {
    big: '꽉 밀폐용기', small: '6종 세트', sticker: '6종\n세트', stickerAt: [1800, 300, 190], band: [1300, 840],
    tables: [
      { cx: 1560, bottom: 900, h: 520, offset: -8, dim: 0.06 },
      { cx: 1090, bottom: 962, h: 640, offset: 8 },
    ],
  },
  // 화살은 뚜껑 오른쪽 끝으로 — 가운데(1330, 760)를 겨누니 화살촉이 뚜껑 인쇄 「VACUUM」을 덮었다.
  // 흰 받침 위 흰 뚜껑이라 그림자를 진하게(0.38 → 0.55, Fable P2)
  h3: { big: '꽉 밀폐용기', small: '뚜껑만 1개', sticker: '뚜껑만!', arrowTo: [1440, 735], solo: { seq: LID, h: 360, shadow: 0.55 } },
  he: { big: '꽉 KKWAK', small: '진공 밀폐용기 3종' },
};
