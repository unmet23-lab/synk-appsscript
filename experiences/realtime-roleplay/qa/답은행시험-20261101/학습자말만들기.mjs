// 답 은행 시험(2026-11-01) — 가짜 학습자 말 200줄을 Gemini가 만든다.
// 답 은행(은행.mjs)은 Claude가 쓰므로 출제는 다른 회사 모델에 맡긴다(시험이 은행에 맞춰 쉬워지지 않게).
// 이 스크립트는 은행을 읽지 않는다. 결과: 학습자말.mjs(커밋 — qa 폴더의 .json은 git 밖 규칙이라 모듈로).
// 쓰는 법: node experiences/realtime-roleplay/qa/답은행시험-20261101/학습자말만들기.mjs
// 키: tools/모델정책.js 「글」(AI Studio 무료 키). 무료 등급이라 보낸 글이 구글 학습에 쓰일 수 있다 — 지어낸 장면 자료라 괜찮다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 단계들 } from './단계.mjs';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 루트 = path.resolve(여기, '../../../..');
const { 제미나이 } = require(path.join(루트, 'tools/lib/제미나이호출.js'));
const { 부르기: 구독부르기 } = require(path.join(루트, 'tools/lib/제미나이구독호출.js'));
// 11-01 첫 판은 무료 API의 gemini-3.8-flash로 돌다 503 · 시간 초과가 이어져, 도구 안쪽 재시도까지 하루 몫(20회)을 다 썼다(429).
// 3.7 Flash도 같은 몫으로 셈해 429였다 → `--통로 구독`이면 같은 3.8 Flash(high)를 Google AI 구독 통로(agy · Ultra)로 부른다.
// 안쪽 재시도는 꺼서 한 시도 = 요청 하나로 센다.
const 값 = (이름, 기본) => (process.argv.includes(이름) ? process.argv[process.argv.indexOf(이름) + 1] : 기본);
const 통로 = 값('--통로', 'api');
const 모델 = 값('--모델', 'gemini-3.8-flash');

const 스키마 = {
  type: 'object',
  properties: {
    말들: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          학습자말: { type: 'string' },
          뜻: { type: 'string' },
          받아적기: { type: 'string' },
          오류정도: { type: 'string', enum: ['없음', '가벼움', '심함'] },
          수준: { type: 'string', enum: ['입문', '초급', '초중급'] },
          유형: { type: 'string' },
        },
        required: ['학습자말', '뜻', '받아적기', '오류정도', '수준', '유형'],
      },
    },
  },
  required: ['말들'],
};

function 지시(d) {
  return `너는 한국어 교육 연구를 돕는 자료 작성자다. 아래 「팬사인회 말하기 상황극」에서 실제 학습자들이 할 법한 말을 만든다. 이 자료는 AI 상대역이 학습자 말을 얼마나 잘 받아 내는지 시험하는 데 쓴다 — 쉬운 말만 모으면 시험이 무의미하니, 실제 교실과 앱에서 나오는 말의 폭을 그대로 담아라.

[장면]
- 가상 아이돌 「하온」(실존 인물 아님, 밝고 다정한 20대)의 팬사인회. 학습자는 팬으로서 자기 차례에 하온과 짧게 이야기하고 사인을 받는다.
- 학습자: 한국어를 배우는 외국인. 대부분 몽골 사람(10대 후반~20대, 일부 30대), TOPIK 1~2급 정도. 한국어가 서툴러 조사 · 어미 · 높임을 자주 틀리고, 단어 하나로 답하기도 하고, 머뭇거리거나 몽골어 · 영어 · 러시아어를 섞기도 한다. 일부는 K팝 팬이라 실제 아이돌 · 노래 이름을 말하기도 한다.
- 화면의 미션 카드(학습자가 볼 수 있음): 인사하기 · 내 이름 말하기 · 어디에서 왔는지 말하기 · 좋아하는 노래나 무대 말하기 · 사인 부탁하기 · 고맙다고 인사하고 헤어지기.

[지금 순간] ${d.상황}
하온이 방금 한 말: 「${d.앞말}」
→ 이 말을 들은 학습자가 바로 이어서 하는 한 차례의 말을 정확히 ${d.개수}개 만든다.

[폭]
- 대략 열에 여섯은 평범한 답(그 질문에 맞게 답하는 말 — 문법이 틀려도 된다). 나머지는 실제로 흔히 나오는 예외를 고르게 섞는다: 한꺼번에 여러 가지 말하기, 미션을 앞당기기, 질문을 잘못 알아듣기, 단어 하나 · 짧은 소리, 머뭇거림, 다른 언어로 말하기 · 섞기, 하온에게 되묻거나 질문하기, 칭찬 · 고백 · 팬심, 여러 가지 부탁, 엉뚱한 말 · 장난, 드물게 무례하거나 선 넘는 말. 이 목록에 없더라도 실제 팬사인회와 초보 학습자를 떠올려 나올 법한 말이면 넣는다.
- 같은 말을 되풀이하지 말고 말투 · 길이 · 수준(입문 · 초급 · 초중급)을 섞는다. 이름이 나오면 몽골 이름(볼로르 · 투야 · 바트 · 나랑 · 엥흐 등)이나 별명을 쓴다.

[받아적기 흉내]
학습자는 외국인 억양으로 말하고, 앱은 자동 받아쓰기로 그 말을 글로 바꾼다. 「받아적기」 칸에는 한국어 자동 받아쓰기가 실제로 적었을 법한 글을 쓴다.
- 오류 정도는 대략 없음 55% · 가벼움 30% · 심함 15%.
- 실제로 본 오류: 이름이 비슷한 소리로 바뀜(볼로르 → 볼로 · 볼러 · 볼롤), 짧은 대답이 다른 낱말로(네 → 매), 받침이 빠지거나 붙음, 어/오 · 으/우 · ㄹ/ㄴ 헷갈림, 말 일부가 빠짐, 비슷한 소리의 다른 한국어 낱말로 바뀜, 외국어를 한글 소리로 적거나 그대로 적음.
- 받아쓰기는 무작위 자모가 아니라 대개 실제 한국어 낱말 · 글자로 나온다. 「가벼움」은 사람이 읽으면 뜻을 짐작할 수 있는 정도, 「심함」은 사람이 읽어도 뜻을 알기 어렵거나 다른 뜻으로 읽히는 정도다.
- 학습자가 원래 틀리게 말한 문법(조사 · 어미)은 받아쓰기 오류가 아니다 — 그것은 「학습자말」에 이미 들어 있고, 받아쓰기는 그 말을 소리대로 적는 데서 출발한다.

[칸]
- 학습자말: 학습자가 실제로 소리 내어 한 말(틀린 문법 그대로, 외국어는 그 언어 그대로)
- 뜻: 학습자가 하려던 말을 한국어로 짧게(예: 「이름을 말하고 몽골에서 왔다고 함」)
- 받아적기: 위 규칙대로
- 오류정도: 없음 | 가벼움 | 심함
- 수준: 입문 | 초급 | 초중급
- 유형: 이 말의 성격을 짧은 한국어 꼬리표 하나로(자유롭게)`;
}

// 순간마다 받자마자 git 밖 조각으로 저장하고, 다시 돌리면 받은 순간은 건너뛴다(11-01 첫 판: 503 · 300초 시간 초과가 이어져
// 끝에서만 저장하던 판은 한 순간이 세 번 실패하면 앞 순간까지 잃었다).
const 조각폴더 = path.join(루트, '.tmp', '답은행시험-20261101', '학습자말조각');
fs.mkdirSync(조각폴더, { recursive: true });
const 결과 = [];
const 기록 = [];
for (const d of 단계들) {
  const 조각파일 = path.join(조각폴더, `${d.id}.json`);
  let 받음 = fs.existsSync(조각파일) ? JSON.parse(fs.readFileSync(조각파일, 'utf8')) : null;
  if (받음) console.log(`${d.id}: 저장된 조각 ${받음.말들.length}줄`);
  for (let 회 = 1; !받음 && 회 <= 3; 회++) {
    try {
      const 답 = 통로 === '구독'
        ? await 구독부르기({ model: 모델, prompt: 지시(d), schema: 스키마, thinking: 'high', timeoutMs: 600_000 })
        : await 제미나이(null, 모델, 지시(d), { schema: 스키마, thinking: 'high', timeoutMs: 600_000, 상세: true, 재시도지연: [] });
      const 말들 = JSON.parse(답.text).말들;
      if (!Array.isArray(말들) || 말들.length < d.개수 * 0.9) throw new Error(`개수 모자람 ${말들?.length}/${d.개수}`);
      받음 = { 말들: 말들.slice(0, d.개수), 모델판: 답.modelVersion, 사용: 답.usage };
      fs.writeFileSync(조각파일, JSON.stringify(받음));
    } catch (e) {
      console.error(`${d.id} ${회}회 실패: ${String(e.message).split('\n')[0].slice(0, 200)}`);
      if (회 === 3 || /^429/.test(e.message)) throw e; // 하루 몫이 바닥나면 더 보내지 않는다
      await new Promise((r) => setTimeout(r, 30_000 * 회));
    }
  }
  받음.말들.forEach((m, i) => 결과.push({ id: `${d.id}-${String(i + 1).padStart(2, '0')}`, 단계: d.id, 앞말: d.앞말, ...m }));
  기록.push({ 단계: d.id, 개수: 받음.말들.length, 모델판: 받음.모델판, 입력토큰: 받음.사용?.promptTokenCount, 출력토큰: 받음.사용?.candidatesTokenCount, 생각토큰: 받음.사용?.thoughtsTokenCount });
  console.log(`${d.id}: ${받음.말들.length}줄 (${받음.모델판})`);
}

const 머리 = `// 답 은행 시험(2026-11-01) — 가짜 학습자 말. 학습자말만들기.mjs가 ${모델}(${통로 === '구독' ? 'Google AI 구독 통로 agy' : 'AI Studio 무료 키'})로 만들었다. 손대지 않는다.
// 만든 때: ${new Date().toISOString()} · 단계별 기록: ${JSON.stringify(기록)}
// 이름은 지어낸 몽골 이름이고, 학습자가 말하는 실제 아이돌 · 노래 이름은 학습자 말 흉내일 뿐이다(학생 정보 없음).
`;
fs.writeFileSync(path.join(여기, '학습자말.mjs'), `${머리}export default ${JSON.stringify(결과, null, 1)};\n`);
console.log(`모두 ${결과.length}줄 → 학습자말.mjs`);
