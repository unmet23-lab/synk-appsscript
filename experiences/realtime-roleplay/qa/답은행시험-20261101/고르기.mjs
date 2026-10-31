// 답 은행 시험(2026-11-01) — 받아 적은 학습자 말만 보고 은행 묶음을 고른다(실제 앱의 「고르기」 칸).
// 학생용 길과 같은 OpenAI(18세 미만 약관 — 드라마 기획 §4-1)로 부른다. 키는 상황극 키 목록(../../lib/오픈AI키.mjs — 결제 수단 없는 월 크레딧).
// 쓰는 법: node 고르기.mjs [--모델 gpt-6-luna|gpt-6.1-terra] [--동시 6] [--몇 10]
// 결과: 고르기_<모델>.jsonl(git 밖) — {id, 판단, 묶음, 확신, ms, 사용, USD}
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 응답부르기 } from '../../lib/공급사.mjs';
import { 출력글 } from '../../lib/피드백.mjs';
import { 글값 } from '../../lib/예산.mjs';
import { 단계 } from './단계.mjs';
import { 묶음들 } from './은행.mjs';
import 학습자말 from './학습자말.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 인자 = (이름, 기본) => { const i = process.argv.indexOf(이름); return i > 0 ? process.argv[i + 1] : 기본; };
const 모델 = 인자('--모델', 'gpt-6-luna');
const 동시 = Number(인자('--동시', 6));
const 몇 = Number(인자('--몇', 0)) || 학습자말.length;
// 생각 수준 — 실시간 차례에 쓰려면 고르기가 1초 안팎이어야 한다(11-01 첫 확인: luna 기본 생각으로 4.6~5.3초). 이름 뒤에 붙여 결과 파일을 나눈다.
const 생각 = 인자('--생각', '');

export const 고르기지시 = [
  '너는 한국어 말하기 상황극 앱의 「답 고르기」 담당이다. 학습자(한국어를 배우는 외국인 초보, 대부분 몽골 사람)가 팬사인회에서 가상 아이돌 하온과 이야기한다. 하온의 대사는 미리 녹음해 둔 답 묶음에서 골라 튼다.',
  '학습자 말은 자동 받아쓰기를 거친 글이다. 외국인 억양 때문에 비슷한 소리의 다른 낱말로 바뀌거나(네 → 매, 볼로르 → 볼러), 받침 · 모음이 틀리거나, 일부가 빠질 수 있다. 소리가 비슷한 낱말을 떠올려 뜻을 짐작하되, 짐작이 서지 않으면 고르지 않는다. 학습자의 문법 실수는 신경 쓰지 말고 뜻만 본다.',
  '할 일: 지금 순간과 받아 적은 학습자 말을 보고 하온이 이어서 할 답을 정한다.',
  '- 고름: 어느 묶음의 답이 학습자 말에 자연스럽게 이어지면 그 묶음 id를 적는다. 여러 묶음이 맞으면 학습자 말의 중심 뜻에 가장 잘 맞는 하나.',
  '- 되묻기: 학습자가 다시 말해 달라고 했거나(네? · 다시요 · 천천히요), 받아 적은 글로는 뜻을 알 수 없을 때. 하온이 같은 질문을 천천히 다시 묻는다.',
  '- 생성: 학습자 말의 뜻은 분명한데 어느 묶음의 답도 자연스럽게 이어지지 않을 때. 실시간 생성으로 넘긴다.',
  '학습자가 한 말과 맞지 않는 답이 나가는 것이 가장 나쁘다. 그래도 맞는 묶음이 분명하면 망설이지 말고 고른다.',
  '확신: 네 판단이 맞을 가능성(0~1). 판단이 고름이 아니면 묶음은 빈 글로 둔다.',
].join('\n');

export function 고르기본문(말, 모델이름 = 모델, 생각수준 = 생각) {
  const d = 단계[말.단계];
  const 목록 = 묶음들(말.단계);
  const 줄 = 목록.map((b) => `- ${b.id} — ${b.뜻} / 예: ${b.예시.join(' · ')} / 답: 「${b.답[0]}」`).join('\n');
  const 수준 = 생각수준 || (모델이름 === 'gpt-6.1-terra' ? 'low' : '');
  return {
    model: 모델이름,
    max_output_tokens: 2000,
    ...(수준 ? { reasoning: { effort: 수준 } } : {}),
    input: [
      { role: 'developer', content: [{ type: 'input_text', text: 고르기지시 }] },
      // 순간마다 같은 앞부분(지시 · 순간 · 묶음 목록)을 먼저, 학습자 말을 맨 끝에 — 같은 순간의 요청이 앞부분 캐시를 함께 쓴다(11-01: 앞에 두면 cached 0)
      { role: 'user', content: [{ type: 'input_text', text: `지금 순간: ${d.상황}\n하온이 방금 한 말: 「${d.앞말}」\n\n답 묶음(id — 학습자 말의 뜻 / 학습자 말 예 / 하온 답 예):\n${줄}\n\n받아 적은 학습자 말: 「${말.받아적기}」` }] },
    ],
    text: {
      format: {
        type: 'json_schema', name: 'reply_pick', strict: true,
        schema: {
          type: 'object', additionalProperties: false, required: ['판단', '묶음', '확신'],
          properties: {
            판단: { type: 'string', enum: ['고름', '되묻기', '생성'] },
            묶음: { type: 'string', enum: ['', ...목록.map((b) => b.id)] },
            확신: { type: 'number' },
          },
        },
      },
    },
  };
}

// 429: 「try again in 12.3s」처럼 짧으면 그만큼 기다렸다 다시, 몇 시간이면 멈춘다(11-01: synk.yuh 조직의 luna가 하루치 같은 10만 토큰 상한에 닿아
// 「7h18m 뒤」였다 — 짧게 세 번 다시 보내던 판은 200줄 중 187줄을 오류로 남겼다). ms는 성공한 요청 하나의 시간이다(기다린 시간 빼고).
function 기다릴초(e) {
  const m = /try again in (?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?(?:([\d.]+)ms)?/.exec(e.본문 || '');
  if (!m) return null;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0) + Number(m[4] || 0) / 1000;
}
async function 하나(말) {
  for (let 회 = 1; ; 회++) {
    const 시작 = Date.now();
    try {
      const { 답, 키 } = await 응답부르기(고르기본문(말));
      const 출력 = JSON.parse(출력글(답) || '{}');
      if (!['고름', '되묻기', '생성'].includes(출력.판단)) throw new Error(`판단 없음: ${JSON.stringify(출력).slice(0, 80)}`);
      return { id: 말.id, 판단: 출력.판단, 묶음: 출력.판단 === '고름' ? 출력.묶음 : '', 확신: 출력.확신, ms: Date.now() - 시작, 시도: 회, 사용: 답.usage || null, USD: 글값(모델, 답.usage), 키 };
    } catch (e) {
      const 초 = e.상태 === 429 ? 기다릴초(e) : null;
      const 길다 = 초 != null && 초 > 120;
      if (회 >= 8 || e.상태 === 400 || 길다) return { id: 말.id, 오류: `${String(e.message).slice(0, 120)}${길다 ? ` (다시 ${Math.round(초 / 60)}분 뒤)` : ''}` };
      await new Promise((r) => setTimeout(r, Math.max(1000, (초 ?? 2 * 회) * 1000 + 500)));
    }
  }
}

if (process.argv[1] && path.basename(process.argv[1]) === '고르기.mjs') { // 다른 스크립트가 고르기본문만 가져갈 때는 돌지 않는다
  const 파일 = path.join(여기, `고르기_${모델}${생각 ? `_${생각}` : ''}.jsonl`);
  // --이어서: 이미 성공한 줄은 두고 나머지만 부른다. 결과는 한 줄씩 바로 덧붙여 진행이 보이게 한다.
  const 앞 = process.argv.includes('--이어서') && fs.existsSync(파일)
    ? new Map(fs.readFileSync(파일, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).filter((r) => !r.오류).map((r) => [r.id, r]))
    : new Map();
  const 대상 = 학습자말.slice(0, 몇).filter((m) => !앞.has(m.id));
  const 진행 = path.join(여기, `고르기_${모델}${생각 ? `_${생각}` : ''}.진행.jsonl`);
  fs.writeFileSync(진행, '');
  const 새 = new Map();
  let 다음 = 0;
  await Promise.all(Array.from({ length: 동시 }, async () => {
    while (다음 < 대상.length) {
      const m = 대상[다음++];
      const r = await 하나(m);
      새.set(m.id, r);
      fs.appendFileSync(진행, `${JSON.stringify(r)}\n`);
    }
  }));
  const 결과 = 학습자말.slice(0, 몇).map((m) => 앞.get(m.id) || 새.get(m.id));
  fs.writeFileSync(파일, 결과.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const 됨 = 결과.filter((r) => !r.오류);
  const ms = 됨.map((r) => r.ms).sort((a, b) => a - b);
  const 합 = (f) => 됨.reduce((s, r) => s + (f(r) || 0), 0);
  console.log(JSON.stringify({
    모델, 생각: 생각 || '(기본)', 줄: 결과.length, 오류: 결과.length - 됨.length,
    USD합: Number(합((r) => r.USD).toFixed(5)), 차례당USD: Number((합((r) => r.USD) / 됨.length).toFixed(6)),
    입력토큰평균: Math.round(합((r) => r.사용?.input_tokens) / 됨.length), 출력토큰평균: Math.round(합((r) => r.사용?.output_tokens) / 됨.length),
    생각토큰평균: Math.round(합((r) => r.사용?.output_tokens_details?.reasoning_tokens) / 됨.length),
    ms중앙: ms[Math.floor(ms.length / 2)], ms90: ms[Math.floor(ms.length * 0.9)],
    키: [...new Set(됨.map((r) => r.키))],
  }, null, 1));
}
