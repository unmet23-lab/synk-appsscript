// 쇼케이스 영상 지시문(2026-10-31, 콘티 확정 뒤) — 만족 사례 S39(최신기법-20261030/영상시험.mjs의 한테이크3글 · 나노바나나글)를
// 학생 식당 네 컷과 체험판 듣는 반복으로 옮겼다. 굽기는 얼굴 결정 · 견적 승인 뒤 한 번에 한다(이 파일은 굽지 않는다).
// · 시작 · 끝 그림: 고른 얼굴로 칸 11 · 12 · 13을 9:16으로 다시 만든다. 끝 그림은 같은 구도의 다른 순간이다(현장노트 higgsfield
//   「Seedance 2.5에 두 사람 목소리를 이은 소리 참고를 주면 … 끝 그림 없이는 구도를 두 배로 당기고」).
// · 소리 참고: 앞 0.3초 무음 + 녹음(현장노트 「소리 참고가 클립 0초부터 맞춰 나온다」). 빠르기 · 눈 크기는 지시하지 않는다.
// · 듣는 동안은 「he never holds still」과 낱말마다 고개 · 입술 동작(S39 4판), 말하는 동안 깜빡임은 문장 사이만.
// 쓰는 법: node 지시문.mjs 보기 <C1|C3|C2|C4|반복6|반복7> · node 지시문.mjs 검사 · node 지시문.mjs 묶음 <나갈.txt>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '../../../..');
const 대본 = (await import(pathToFileURL(path.join(뿌리, 'experiences/drama/s1/ep01.mjs')).href)).default;
const 녹음 = (역) => JSON.parse(fs.readFileSync(path.join(뿌리, `experiences/drama/s1/소리/ep01-${역}.json`), 'utf8')).줄;

// 대본에서 장면 2 줄을 그대로 가져온다 — 지시문의 대사가 녹음 · 대본과 어긋나지 않게.
const 장면2 = 대본.촬영일.find((d) => d.n === 3).줄;
const 선배줄 = 장면2.filter((z) => z.누가 === '선배').map((z) => z.말);
const 학생줄 = Object.fromEntries(장면2.filter((z) => z.누가 === '학생').map((z) => [z.id, z.말]));
const 되묻기 = 대본.되묻기.선배[0];
const 실수줄 = 학생줄['s1e01-6'].replace(/헤맸어요\.$/, '헤맸어.');
if (실수줄 === 학생줄['s1e01-6']) throw new Error('6번 줄 끝이 바뀌었다 — 실수줄을 다시 정한다');

const 초 = Object.fromEntries([...녹음('senior').map((z) => [`선배${z.번호}`, z.초]), ...녹음('model').map((z) => [`모범${z.번호}`, z.초])]);
// 실수줄(「…헤맸어.」)은 아직 녹음 전 — 모범 6(16음절 4.03초)을 15음절로 어림한다. 녹음 뒤 실측으로 바꾼다.
초.실수 = Math.round(초.모범6 * 15 / 16 * 100) / 100;

const 한판 = 'One single continuous take with absolutely no cut, shot like a Korean campus drama by a real person holding the camera right in front of him: small constant natural handheld jitters, but the distance never changes.';
const 구도 = (보임) => `Keep exactly the framing of the first frame in every frame — ${보임}, his head the same size as in the first frame. The camera never moves closer, never cuts, never switches angle.`;
const 앉은구도 = (더) => 구도(`a medium shot from mid-chest up of Kwon Tae-o sitting across the table, with his varsity jacket, gray hoodie, ${더} and the bright cafeteria behind him always visible`);
// 10-31 검수 반영(Fable · 아르곤 지시문 검수를 합침 — 검수/Fable_지시문.md · 답_아르곤_지시문.md).
// S39에서 실측으로 검증된 문장(한 테이크 · 구도 잠금 · 「slowly」 기울임 · 눈 뜸 · 문장 사이 깜빡임)은 아르곤이 바꾸자고 해도 그대로 둔다.
const 식당뒤 = "Students keep eating, talking and moving at the tables far behind him until the very last frame. No part of the freshman's body is in the frame — only her own lunch tray at the bottom edge.";
const 반복뒤 = "The students at the tables far behind him stay seated, eating with only small movements. No part of the freshman's body is in the frame — only her own lunch tray at the bottom edge.";
const 식판지킴 = 'His hands never touch the trays, bowls or spoon; the food on both trays stays exactly as in the first frame.';
const 그대로 = 'Keep his face, hair and clothes identical to the first frame in every frame, with real skin texture and the soft daylight from the tall cafeteria windows on his face, and keep the look of a photoreal Korean TV drama shot in every frame.';
const 두목소리 = 'Only these two voices; no other speech, no narration, no music.';
const 한목소리 = 'Only this one voice; no other speech, no narration, no music.';
const 듣기 = (몇초, 줄, 덧 = '') => `The audio reference has two speakers. FIRST, for about the first ${몇초} seconds, a young woman off-camera — the freshman — says the Korean line "${줄}"${덧}. While she speaks, Kwon Tae-o does NOT speak: his lips stay closed, but he never holds still — he is really listening, blinking naturally, and his face and head keep moving the whole time she talks.`;
const 말할때 = 'He keeps looking straight at the camera while he speaks, blinking only briefly and only in the pauses between sentences.';
const 다른순간 = '뒤 학생 두어 명의 자리 · 자세도 바꾼 「같은 구도의 다른 순간」';
const 시작공통 = '입 다문 미소 · 학생 손 · 수저 없음(학생 식판 가장자리만) · 손짓은 9:16 가운데 안';

export const 컷 = {
 C1: {
  이름: '선배가 말을 건다', 콘티: 'B2 2–9초', 초: 8, 시작: `칸 11 구도 — 선 채로 한 손에 식판, 빈손을 막 드는 순간 · ${시작공통}, 9:16`, 끝: `같은 구도 — 식판은 그대로 한 손에, 빈손만 내리고 입 다문 미소, ${다른순간}`,
  소리: ['무음 0.3', '선배1', '꼬리 1.5'],
  글: [
   한판,
   구도('a medium shot from the waist up of Kwon Tae-o standing on the other side of the table, with his varsity jacket, gray hoodie, backpack strap, the lunch tray in one hand and the bright cafeteria behind him always visible'),
   `The audio reference has one speaker, a young man — Kwon Tae-o. He has just spotted the freshman at the table and recognizes her from this morning. He speaks the man's line in the audio word for word and in sync with it. On "저기," he waves once with his free hand and a bright smile of recognition, then lowers the hand. On "혹시 신입생이에요?" he leans his head a little forward with a curious, friendly smile. On "아까 정문 안내 지도 앞에서" his free hand gives a small thumb-jerk back over his shoulder (hand no higher than his head, fully inside the frame), and on "빙빙 돌고 있었죠?" his index finger draws two small circles in the air right in front of his chest and he grins as if remembering it, teasing but kind. ${말할때}`,
   'He stays standing the whole time, and the tray stays level and still in his other hand; the food on both trays stays exactly as in the first frame.',
   'AFTER his last word his free hand comes down and he keeps smiling at the camera with his lips closed, waiting for her answer.',
   식당뒤,
   `${그대로} ${한목소리}`,
  ],
  대사: { 선배: 선배줄[0] },
 },
 C3: {
  이름: '내 차례 ① — 끝 「요」를 빠뜨림 → 되묻기', 콘티: 'B3 9–16초', 초: 8, 시작: `칸 12 구도 — 앉아서 두 팔뚝을 탁자 위에 두고 듣는 순간 · ${시작공통}, 9:16(C2와 같은 그림)`, 끝: `같은 구도 — 윗몸을 조금 기울이고 한 손을 귀에 댄 채 장난스러운 웃음, ${다른순간}(코치 노트 동안 멈춰 두는 화면)`,
  소리: ['무음 0.3', '실수(Hana — 새 녹음)', '무음 0.5', '선배5(되묻기)', '꼬리 1.2'],
  글: [
   한판,
   앉은구도('his lunch tray on the table'),
   `${듣기('4', 실수줄, ' — her voice is higher and comes from off-camera, never from his mouth')} On "네, 맞아요" he gives one small nod with a warm smile, and from there his head keeps drifting gently, never freezing between words. On "길을 잃어서" he tilts his head to one side with a sympathetic little smile. On "한참" his smile grows and his upper body tilts slightly to one side, his head staying the same size in the frame. On "헤맸어" — she has dropped the polite ending — his eyes light up with mischief, his lips still pressed closed until she finishes the word.`,
   `THEN, as he says the man's line in the audio word for word and in sync with it — "${되묻기}" — he raises one hand from the table and cups it behind his ear (hand at head height, fully inside the frame), teasing and friendly, never annoyed, with a mischievous grin, looking right at the camera. ${말할때}`,
   'AFTER his last word he holds the pose — hand behind his ear, a teasing grin — but keeps breathing and blinking, and his grin widens a touch, waiting for her to try again.',
   식판지킴,
   식당뒤,
   `${그대로} ${두목소리}`,
  ],
  대사: { 학생: 실수줄, 선배: 되묻기 },
 },
 C2: {
  이름: '다시 해 보기 — 6번 줄 + 선배 2(S39를 식당으로)', 콘티: 'B5 21–35초', 초: 14, 시작: `C3와 같은 시작 그림(입 다문 미소 · 두 손은 식판 옆 탁자 위)`, 끝: `같은 구도 — 손을 탁자에 내리고 고개를 조금 기울여 웃으며 기다림, ${다른순간}`,
  소리: ['무음 0.3', '모범6', '무음 0.5', '선배2', '꼬리 1.2'], 소리파일: 'S39 소리 참고 그대로(synk-vendor/drama-taeo-onetake-20261031/ref-onetake.mp3 — 힉스필드에 이미 올린 것을 다시 씀)',
  이음: '체험판 이음 프레임은 「한참」 끝(입 다문 채 고개를 앞으로 기울인 얼굴) — 「헤맸어요」의 웃음 참는 얼굴로 돌리면 표정이 튄다(Fable). 체험판은 이 프레임부터 C2를 잇고, 소리는 선배 원래 녹음으로',
  글: [
   한판,
   앉은구도('his lunch tray on the table'),
   `${듣기('4.5', 학생줄['s1e01-6'])} On "네, 맞아요" he gives one small nod. On "길을 잃어서" he slowly tilts his head to one side with a curious little smile, his eyes soft and relaxed. On "한참" his head slowly tilts back the other way and comes slightly forward. On "헤맸어요" he presses his lips together, trying not to laugh, his cheeks rising and his shoulders starting to shake a little.`,
   `THEN he answers with the man's lines in the audio, word for word and in sync with them: the laugh bursts out, short and warm, with his eyes crinkled but still open and looking right at the camera. His eyes are fully open by the first word: "여기 처음 오면 다 헤매요" with an easy smile, then "나는 3학년 권태오예요", and on "편하게 선배라고 불러요" his hand leaves the table and he points his thumb at the center of his own chest with a playful grin (hand at chest height, fully inside the frame). ${말할때}`,
   'AFTER his last word his hand returns to the table and he keeps smiling at the camera with his lips closed, head slightly tilted, waiting for her answer.',
   식판지킴,
   식당뒤,
   `${그대로} ${두목소리}`,
  ],
  대사: { 학생: 학생줄['s1e01-6'], 선배: 선배줄[1] },
 },
 C4: {
  이름: '내 차례 ② — 7번 줄 + 선배 3', 콘티: 'B6 35–49초', 초: 15, 시작: `칸 13 구도 — 오른손에 숟가락을 가볍게 든 채 식판 위에 두고 왼손은 탁자 위 · ${시작공통}, 9:16`, 끝: `같은 구도 — 숟가락을 든 채 웃으며 기다림, ${다른순간}`,
  소리: ['무음 0.3', '모범7', '무음 0.5', '선배3', '꼬리 1.2'],
  이음: '체험판 이음 프레임은 「아세요?」 끝(고개를 기울인 얼굴)',
  글: [
   한판,
   앉은구도('his lunch tray on the table and his metal spoon held loosely in his right hand'),
   `${듣기('5', 학생줄['s1e01-7'])} On "네, 선배님!" his eyes crinkle in an embarrassed smile, lips still closed, and his free left hand starts to wave quickly in front of his chest — a playful "no, no" wave (hand at chest height, fully inside the frame) — while his right hand keeps the spoon still. On "그런데 혹시 도서관이" his left hand settles back on the table and his head keeps moving, straightening and tipping forward as he follows her words, and on "어디에 있는지 아세요?" it tilts to the other side with an easy, interested smile.`,
   `THEN he answers with the man's lines in the audio, word for word and in sync with them: on "선배님은 좀 부담스러운데" he laughs a little and gives a smaller flick of his left hand, embarrassed; on "뭐, 편한 대로 해요" he gives a small shrug with a relaxed smile; on "밥 먹고 같이 가요" he casually lifts the spoon in his right hand a little, as if about to start eating; and on "내가 데려다줄게요" he nods once with a warm, confident smile. ${말할때}`,
   'AFTER his last word he keeps smiling at the camera with his lips closed, spoon in hand, waiting.',
   'His hands never touch the bowls or food; the food on both trays stays exactly as in the first frame.',
   식당뒤,
   `${그대로} ${두목소리}`,
  ],
  대사: { 학생: 학생줄['s1e01-7'], 선배: 선배줄[2] },
 },
 반복6: {
  이름: '체험판 듣는 반복 — 6번 줄(C2 이음)', 콘티: '체험판 내 차례 ①', 초: 4, 시작: 'C2의 이음 프레임(「한참」 끝)', 끝: '시작과 같은 그림(거절되면 끝 그림을 빼고 마지막 문장만, 또는 Seedance 2.0 듣는 컷 — 현장노트 10-30)',
  소리: ['없음(소리 만들기 끔)'],
  글: [
   한판,
   앉은구도('his lunch tray on the table'),
   'He is listening to the freshman, who is speaking to him off-camera: his lips stay closed the whole time, but he never holds still — from the first frame to the last his head keeps drifting gently, a slow tilt to one side and smoothly back with a small unhurried nod, natural blinks, a warm attentive smile. He ends in exactly the same pose as the first frame.',
   식판지킴,
   반복뒤,
   `${그대로} No speech, no voices, no narration, no music.`,
  ],
  대사: {},
 },
 반복7: {
  이름: '체험판 듣는 반복 — 7번 줄(C4 이음)', 콘티: '체험판 내 차례 ②', 초: 4, 시작: 'C4의 이음 프레임(「아세요?」 끝)', 끝: '시작과 같은 그림(거절되면 위와 같이)',
  소리: ['없음(소리 만들기 끔)'],
  글: [
   한판,
   앉은구도('his lunch tray on the table and his metal spoon held loosely in his right hand'),
   'He is listening to the freshman, who is speaking to him off-camera: his lips stay closed the whole time, but he never holds still — from the first frame to the last his head keeps drifting gently, a slow tilt to one side and smoothly back with a small unhurried nod, natural blinks, a warm attentive smile, his right hand keeping the spoon still. He ends in exactly the same pose as the first frame.',
   'His hands never touch the bowls or food; the food on both trays stays exactly as in the first frame.',
   반복뒤,
   `${그대로} No speech, no voices, no narration, no music.`,
  ],
  대사: {},
 },
};

export const 글 = (이름) => 컷[이름].글.join('\n');

// 검사 — 길이 · 빠진 필수 문장 · 금지 문장 · 대사 일치 · 소리 길이(10-31 결정: 굽기 전 지시문은 스크립트로 먼저 본다).
const 필수 = [
 ['한 테이크', 한판],
 ['구도 잠금', 'Keep exactly the framing of the first frame in every frame'],
 ['얼굴 · 결 유지', 그대로],
 ['학생 몸 빼기', "No part of the freshman's body is in the frame"],
 ['식판 · 그릇 지킴', 'the food on both trays stays exactly as in the first frame'],
];
const 배경 = (이름) => (이름.startsWith('반복') ? ['배경 되감김 줄이기', 'stay seated, eating with only small movements'] : ['배경이 굳지 않게', 'until the very last frame']);
const 금지 = [
 [/eyes? widen/i, '눈 크기 지시는 크게 먹는다(S39 4판)'],
 [/\bzoom(s|ing)? (in|out)\b/i, '줌 지시'],
 [/\b(speaks?|says?|talks?) (slowly|quickly|fast)\b/i, '말 빠르기 지시는 박자를 바꾼다'],
 [/slow motion/i, '느린 화면'],
 [/eyebrow/i, '앞머리가 눈썹을 가려 안 보인다'],
];
const 고르기 = (s) => s.replace(/[\s.,!?…~'"「」]/g, '');

export function 검사() {
 const 문제 = [];
 for (const [이름, c] of Object.entries(컷)) {
  const t = 글(이름);
  for (const [뜻, 문장] of [...필수, 배경(이름)]) if (!t.includes(문장)) 문제.push(`${이름}: 필수 「${뜻}」 빠짐`);
  for (const [re, 뜻] of 금지) if (re.test(t)) 문제.push(`${이름}: 금지 — ${뜻} (${t.match(re)[0]})`);
  const 목소리 = /two speakers/.test(t) ? 2 : /one speaker/.test(t) ? 1 : 0;
  if (목소리 === 2 && !t.includes(두목소리)) 문제.push(`${이름}: 두 목소리 제한 문장 빠짐`);
  if (목소리 === 1 && !t.includes(한목소리)) 문제.push(`${이름}: 한 목소리 제한 문장 빠짐`);
  if (목소리 === 0 && !/No speech/.test(t)) 문제.push(`${이름}: 말 금지 문장 빠짐`);
  const 말시작 = c.대사.학생 ? t.indexOf('THEN') : 0;
  if (c.대사.학생) {
   const 줄자리 = t.indexOf(`"${c.대사.학생}"`);
   if (줄자리 < 0) 문제.push(`${이름}: 학생 줄이 대본과 다름`);
   if (!t.includes('he never holds still')) 문제.push(`${이름}: 듣는 동안 「he never holds still」 빠짐`);
   if (말시작 < 0) 문제.push(`${이름}: 듣기와 말하기를 가르는 「THEN」 빠짐`);
   // 듣는 동안 낱말 신호는 학생 줄의 조각이어야 하고 대본 순서대로 와야 한다.
   const 신호 = [...t.slice(줄자리 + c.대사.학생.length + 2, 말시작 < 0 ? undefined : 말시작).matchAll(/"([^"]*[가-힣][^"]*)"/g)].map((m) => 고르기(m[1]));
   let 자리 = 0;
   for (const z of 신호) { const i = 고르기(c.대사.학생).indexOf(z, 자리); if (i < 0) 문제.push(`${이름}: 듣는 신호 「${z}」가 학생 줄 순서에 없음`); else 자리 = i + z.length; }
   if (신호.length < 3) 문제.push(`${이름}: 듣는 동안 낱말 신호가 ${신호.length}개 — 단발 동작 사이가 멈춘다(S39)`);
  }
  if (c.대사.선배) {
   // 선배 말에서 따옴표로 묶은 조각은 대본 순서대로 들어 있어야 하고, 합쳐서 선배 줄의 70% 넘게 덮어야 한다.
   const 조각 = [...t.slice(Math.max(0, 말시작)).matchAll(/"([^"]*[가-힣][^"]*)"/g)].map((m) => 고르기(m[1]));
   const 원 = 고르기(c.대사.선배);
   let 자리 = 0, 덮음 = 0;
   for (const z of 조각) { const i = 원.indexOf(z, 자리); if (i < 0) { 문제.push(`${이름}: 선배 조각 「${z}」가 대본 순서에 없음`); continue; } 자리 = i + z.length; 덮음 += z.length; }
   if (덮음 / 원.length < 0.7) 문제.push(`${이름}: 선배 줄을 ${Math.round(덮음 / 원.length * 100)}%만 덮음`);
  }
  // 소리 길이(S39 꼴: 앞 0.3초 무음 + 녹음 + 꼬리 무음): 목소리는 클립 끝 0.4초 전에 끝나야 끝 기다림이 남고, 꼬리까지 합쳐 클립을 넘지 않는다.
  const 한토막 = (x) => (/^(무음|꼬리)/.test(x) ? Number(x.split(' ')[1]) : x.startsWith('실수') ? 초.실수 : x.startsWith('선배') ? 초[x.match(/선배\d/)[0]] : x.startsWith('모범') ? 초[x] : 0);
  const 소리초 = c.소리.reduce((a, x) => a + 한토막(x), 0);
  const 목소리끝 = 소리초 - c.소리.filter((x) => x.startsWith('꼬리')).reduce((a, x) => a + 한토막(x), 0);
  if (목소리끝 > c.초 - 0.4) 문제.push(`${이름}: 목소리가 ${목소리끝.toFixed(2)}초에 끝나 클립 ${c.초}초에 꽉 참`);
  if (소리초 > c.초 + 0.05) 문제.push(`${이름}: 소리 참고 ${소리초.toFixed(2)}초가 클립 ${c.초}초보다 길다`);
  c.소리초 = Math.round(소리초 * 100) / 100;
  c.글자 = t.length;
  if (t.length > 2800) 문제.push(`${이름}: ${t.length}자 — S39(약 2,400자)보다 꽤 길다`);
 }
 return 문제;
}

export function 묶음글() {
 const 문제 = 검사();
 const 줄 = ['# 쇼케이스 영상 지시문 묶음(굽기 전, 2026-10-31)', '', '모델: Seedance 2.5 · omni_reference · 720p · 9:16 · 소리 만들기 켬(반복만 끔). 시작 · 끝 그림 + 소리 참고(앞 0.3초 무음 + 녹음).', `스크립트 검사: ${문제.length ? 문제.join(' / ') : '통과(필수 문장 · 금지 문장 · 대사 일치 · 소리 길이 · 길이)'}`, ''];
 for (const [이름, c] of Object.entries(컷)) {
  줄.push(`## ${이름} — ${c.이름} (${c.콘티}, ${c.초}초)`, `- 시작 그림: ${c.시작}`, `- 끝 그림: ${c.끝}`, `- 소리 참고: ${c.소리.join(' + ')} = 약 ${c.소리초}초${c.소리파일 ? ` — ${c.소리파일}` : ''}`, ...(c.이음 ? [`- 체험판 이음: ${c.이음}`] : []), `- 지시문(${c.글자}자):`, '', 글(이름), '');
 }
 return 줄.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const [명령, 가] = process.argv.slice(2);
 if (명령 === '보기' && 컷[가]) console.log(글(가));
 else if (명령 === '검사') { const 문제 = 검사(); for (const [이름, c] of Object.entries(컷)) console.log(`${이름}\t${c.초}초\t소리 ${c.소리초}초\t${c.글자}자`); console.log(문제.length ? `문제 ${문제.length}:\n- ${문제.join('\n- ')}` : '검사 통과'); process.exit(문제.length ? 1 : 0); }
 else if (명령 === '묶음' && 가) { fs.writeFileSync(가, 묶음글(), 'utf8'); console.log(`썼다: ${가}`); }
 else { console.error('쓰는 법: node 지시문.mjs 보기 <C1|C3|C2|C4|반복6|반복7> · 검사 · 묶음 <나갈.txt>'); process.exit(2); }
}
