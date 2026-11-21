// Y75 실제 숫자(docs/_ops/qa/공간정리_20261120/README.md). 크기는 탐색기와 같은 GiB이고 화면에는 GB로 적는다.
// 네 묶음 합 52.6 = 다 쓴 작업 사본 8.9 + 안 쓰는 작업 폴더 3.69 + 임시 파일 19.08 + 오래된 영상 · 그림 · 소리 20.97(6,537개).
// 넷째 묶음 안에 만족 사례 셋의 미디어 1,046개 7.35GB가 섞였다 → 11:42~12:27 되살림(빠진 파일 0). 고친 규칙으로 다시 세니 28곳 8.49GB → 17:18 되살림.
// 실제 화면: 영상 10개가 있던 폴더(films)에 안내 파일 「Drive로_옮긴_파일」 하나만 남은 탐색기 창(주소 줄 · 왼쪽 줄 흐림, public/real/films_가림.png).
// 안내 파일의 옮긴 파일 10개 크기는 그 파일 그대로(이름은 남의 회사 이름이 섞여 막대로 가림).
export const STAGE = '#0F1A2A';
export const STAGE_HI = '#1A2B44';
export const INK = '#F4F1EA'; // 위 큰 글(흰)
export const SUB = '#9AA9BE';
export const DARK = '#15130F';
export const BUTTER = '#F5C445';
export const PAPER = '#F4F1EA';

export const BUNDLES: { label: string; gb: number }[] = [
  { label: '끝난 작업 복사본', gb: 8.9 },
  { label: '오래 안 연 작업 폴더', gb: 3.69 },
  { label: '임시 파일', gb: 19.08 },
  { label: '오래된 영상 · 그림 · 소리', gb: 20.97 },
];

export const NOTE_SIZES = ['5.0MB', '6.6MB', '11.0MB', '3.6MB', '11.7MB', '12.9MB', '5.8MB', '4.2MB', '4.4MB', '6.1MB'];

/** 0~1 사이의 고정된 값(파일 줄 막대 길이). */
export const rnd = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
