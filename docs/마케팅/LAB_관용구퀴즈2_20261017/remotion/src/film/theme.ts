// 한 화면에 강조색 하나. 바탕은 따뜻한 오프화이트, 글자는 거의 검정.
export const C = {
  bg: '#F2EFE9',
  ink: '#111112',
  muted: '#6F6A63',
  hair: 'rgba(17,17,18,0.10)',
  card: '#FFFFFF',
  accent: '#F96859', // SYNK 코랄
  accentInk: '#C9382A', // 밝은 바탕 위 작은 강조 글자
  accentSoft: 'rgba(249,104,89,0.22)',
  ghost: 'rgba(17,17,18,0.045)',
};

// 9:16 안전 영역: 아래 20%(y>1536)와 오른쪽 단추 열(x>930)에는 글자를 두지 않는다.
export const W = 1080;
export const H = 1920;
export const PAD = 96;
