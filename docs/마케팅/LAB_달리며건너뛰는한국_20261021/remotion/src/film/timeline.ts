// 「달리며 건너뛰는 한국」 박표(콘티 v2 · 120 BPM · 한 박 0.5초 = 12장, 24 fps). 바탕 영상(편집/바탕편집.py)과 같은 자리다.
export const FPS = 24;
export const TOTAL_FRAMES = 720; // 30.0초
export const BEAT = 12;
export const s = (sec: number) => Math.round(sec * FPS);

// 화면 글의 때(초) — 콘티 v2 「화면 글(영어판)」 · v1 콘티 F절. v2(11-07 이해 시험 v1 뒤): 테이프 · 폰 시점 · 출발 · 다이빙에 뜻 한 줄씩,
// 답은 0.25초마다 빠르게(시험관 「21~27초 천천히 차서 이탈」), 이름 끝말 27.0 → 25.0 · 보내기 28.5 → 27.5(「끝말을 읽기엔 짧다」)
// v3(11-07 이해 시험 v2 뒤): 첫 3초가 「12곳 퀴즈」를 약속하자 3~10초 열차 장난이 「장소는 언제?」로 읽혔다(시험관 셋) — 이야기 줄을
// 「열차와 달려 한국을 건넜다 → 1단계 폰 붙이기 → 2단계 달리기 → 장소마다 맞혀 보기 → 착지 0점 → 정답」으로 바꾸고, 숫자 칩은 장소가 시작되는 10.0초부터.
export const HOOK_END = 3.0; // 0~3초 「I raced a train / across Korea.」 + 「12 places — can you name them?」
export const TAPE_IN = 3.0; // 「Step 1: tape phone to train」 + 크레용 화살표(테이프 장면)
export const CAM_IN = 4.5; // 폰 시점 = 카메라 틀(● REC)
// v3: 볼 이유 심사(opus v2) 「몽타주 내내 열차 카메라 화면을 남겨 경주로 읽히게」 — REC 화면을 다이빙까지 잇고, 꽃밭에 처박히는 순간 「■ STOP」
export const CAM_OUT = 19.3; // 카메라 틀이 꺼지는 때
export const REC_STOP = 18.85; // 꽃잎이 튀는 순간 ● REC → ■ STOP
export const RACE_IN = 6.0; // 열차 출발 = 「Step 2: race it!」
export const RACE_OUT = 8.6;
export const COUNTER_IN = 10.0; // 첫 장소(진해) = 「1/12 places」 · 「Name each place!」
export const NAME_OUT = 12.0;
export const COUNT_AT = [10.0, 12.0, 12.5, 13.0, 13.5, 14.0, 14.5, 15.0, 15.5, 16.0, 16.5, 17.0]; // n번째 장소가 화면에 들어오는 때
export const FINISH_IN = 20.0; // 다리가 솟음 = 「made it… sort of」
export const ANSWER_IN = 21.0; // 답 카드
export const ROW_STEP = 6; // 답 한 줄 = 0.25초(8분음표)
// v6(Fable 맹검 v4 P1 「27.46~27.52 쓰러짐에 CTA 페이드인 · 카드 퇴장이 겹치고 곡 끝 한 타는 0.5초 뒤 빈 들판에」): 카드를 26.75초에 걷고(다리가 기울기 시작하는 27.17초 앞),
//   다리가 꽃 속으로 사라지는 27.5초에 곡 끝 한 타(곡편집.py가 한 박을 빼 당김), 보내기는 그 한 박 뒤 28.0초. 카드가 일찍 걷혀 끝말은 23.5초로 당겨 3.25초를 지킨다.
export const LESSON_IN = 23.5; // 이름 끝말(v5: 25.0 → 24.0 — 시험관 「끝말 표가 너무 짧게 지나간다」, v6: → 23.5)
export const CTA_IN = 28.0; // 보내기(v6: 27.5 → 28.0)

// 열두 곳 — 기획 「장소 12곳 · 계절 순서」. suf = 이름 끝말 수업에 쓰는 끝 글자(없으면 빈칸)
export type Place = { ko: string; ro: string; suf: string };
export const PLACES: Place[] = [
  { ko: '진해 여좌천', ro: 'Jinhae Yeojwacheon', suf: '' },
  { ko: '남해 다랭이마을', ro: 'Namhae Daraengi-maeul', suf: '마을' },
  { ko: '우도', ro: 'Udo', suf: '도' },
  { ko: '보성 녹차밭', ro: 'Boseong Nokchabat', suf: '' },
  { ko: '하늘공원', ro: 'Haneul Gongwon', suf: '공원' },
  { ko: '퍼플섬', ro: 'Purple Island', suf: '섬' }, // v6: 로마자 「Peopeulseom」은 읽히지 않는다(Fable v4 P2) — 공식 영어 이름
  { ko: '첨성대', ro: 'Cheomseongdae', suf: '' },
  { ko: '내장산', ro: 'Naejangsan', suf: '산' },
  { ko: '순천만', ro: 'Suncheonman', suf: '만' },
  { ko: '정동진', ro: 'Jeongdongjin', suf: '' },
  { ko: '한라산', ro: 'Hallasan', suf: '산' },
  { ko: '성산일출봉', ro: 'Seongsan Ilchulbong', suf: '' },
];

// 이름 끝말(23.5초) — 위 suf와 같은 글자
export const ENDINGS: { ko: string; ro: string; en: string }[] = [
  { ko: '산', ro: 'san', en: 'mountain' },
  { ko: '섬 · 도', ro: 'seom · do', en: 'island' },
  { ko: '만', ro: 'man', en: 'bay' },
  { ko: '공원', ro: 'gongwon', en: 'park' },
  { ko: '마을', ro: 'maeul', en: 'village' },
];

// LAB 테마(SNS 키트 kit.css [data-acc="lab"])
export const C = {
  field: '#F96859', // 코랄 면
  onField: '#2A120D', // 코랄 면 위 짙은 갈색 글자
  acc: '#AE322A', // 흰 종이 위 강조(코랄 그늘)
  wash: '#FEF0E9',
  soft: '#FBB7A3',
  ink: '#0A0A0A',
  paper: '#FFFFFF',
};

// cover916 안전 영역: 위 269 · 아래 1248 · 왼쪽 65 · 오른쪽 920(단추 열)
export const SAFE = { top: 269, bottom: 1248, left: 65, right: 920 };
