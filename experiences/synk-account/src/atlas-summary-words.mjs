// Words for Core's account summary (synk-account ?view=atlas): what the member chose and why they learn. Kept apart
// from the WORLD games list (atlas-words.mjs) so the SYNK ID 「내 계정」 can show them without carrying the games.
export const SETTING_WORDS = { support: { step: '단계별로 도와줘요', choose: '그때그때 맞춰 줘요', independent: '혼자 해 볼게요' },
  textSize: { standard: '보통 글씨', large: '큰 글씨' }, explanation: { brief: '짧은 설명', standard: '보통 설명', detailed: '자세한 설명' },
  motion: { full: '움직임 그대로', reduced: '움직임 줄이기' }, audio: { off: '소리 끄기', available: '소리 쓰기' } };
// Short names of the learning reasons (계약/배우는이유_선택응답_계약.json, every 값; a test keeps them equal).
export const REASON_WORDS = { culture: '드라마·음악·웹툰', travel: '한국 여행', people: '가족·친구와 이야기', life: '한국 생활', study: '한국에서 공부',
  work: '한국에서 일', career: '지금 하는 일', exam: '시험·자격', hobby: '배우는 즐거움', other: '다른 이유' };
