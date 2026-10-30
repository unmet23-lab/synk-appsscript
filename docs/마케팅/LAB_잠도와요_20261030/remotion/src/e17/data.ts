// LAB 영어 E17 「잠도 와요」 화면 글 정본. 장면 그림은 판/*.png(GPT 이미지 2.5, 몽글 정본은 생김새 참고로만)를 public/img로 옮긴 것.
// 줄 차례는 잠 → 친구 → 비 → 눈 → 전화(timeline.ts flips와 같은 차례). 목소리 줄은 M18과 같은 소진 줄(vo/w1~w6)을 옮겨 쓴다.
export const TEXT = {
  hook: 'In Korean, sleep “comes.”',
  snapKo: '와요',
  endLine: 'Sleep comes. 😴',
  endLineKo: '잠이 와요',
};

// fx = 그 장면에서 「오는」 움직임 · vo = public/vo 줄 · cam = 장면 그림(940×1672 좌표)에서 다가갈 자리
export type Scene = {
  img: string;
  subj: string;
  read: string;
  lit: string;
  mean?: string;
  verb: string; // 영어로는 이 동사(기획 · 캡션용)
  sent: string; // 끝 카드에서 그 줄 옆에 붙는 영어 문장 뜻(v4: 「= get sleepy」 꼴은 와요 뜻이 여럿으로 읽힘)
  vo: string;
  fx: 'zzz' | 'bell' | 'rain' | 'snow' | 'buzz';
  cam: [number, number];
};
export const SCENES: Scene[] = [
  { img: 'img/jam.jpg', subj: '잠이', read: 'jami wayo', lit: 'Sleep comes.', mean: '= I’m sleepy.', verb: 'get sleepy', sent: 'I’m sleepy', vo: 'w4', fx: 'zzz', cam: [470, 820] },
  { img: 'img/friend.jpg', subj: '친구가', read: 'chinguga wayo', lit: 'My friend comes.', verb: 'come', sent: 'My friend is here', vo: 'w1', fx: 'bell', cam: [520, 950] },
  { img: 'img/rain.jpg', subj: '비가', read: 'biga wayo', lit: 'Rain comes.', mean: '= It’s raining.', verb: 'fall', sent: 'It’s raining', vo: 'w2', fx: 'rain', cam: [470, 800] },
  { img: 'img/snow.jpg', subj: '눈이', read: 'nuni wayo', lit: 'Snow comes.', mean: '= It’s snowing.', verb: 'fall', sent: 'It’s snowing', vo: 'w3', fx: 'snow', cam: [520, 800] },
  { img: 'img/phone.jpg', subj: '전화가', read: 'jeonhwaga wayo', lit: 'A call comes.', mean: '= My phone rings.', verb: 'ring', sent: 'My phone rings', vo: 'w5', fx: 'buzz', cam: [450, 900] },
];
