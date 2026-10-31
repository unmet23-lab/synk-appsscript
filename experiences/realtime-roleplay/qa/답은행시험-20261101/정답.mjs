// 답 은행 시험(2026-11-01) — 정답 매기기 자료와 GPT 검수.
// 정답은 학습자가 「하려던 말」 기준으로, 은행 묶음 가운데 자연스러운 것을 모두 고른 것이다(기준: 정답기준.md).
// Fable(주 검수)과 GPT(대조 검수)가 같은 기준 · 같은 자료를 받고, 고르기 결과는 보지 않는다.
// 쓰는 법:
//   node 정답.mjs 자료 <폴더>   → <폴더>/<조>/자료.md (Fable 세 조 — 처음·나라 / 좋아함·사인 / 끝·작별뒤)
//   node 정답.mjs gpt [--동시 6] → 정답_GPT.jsonl(git 밖)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 응답부르기 } from '../../lib/공급사.mjs';
import { 출력글 } from '../../lib/피드백.mjs';
import { 글값 } from '../../lib/예산.mjs';
import { 단계 } from './단계.mjs';
import { 묶음들, 되묻기 } from './은행.mjs';
import 학습자말 from './학습자말.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 기준 = fs.readFileSync(path.join(여기, '정답기준.md'), 'utf8');
export const 조들 = { 가: ['처음', '나라'], 나: ['좋아함', '사인'], 다: ['끝', '작별뒤'] };

export function 순간글(단계id) {
  const d = 단계[단계id];
  const 묶 = 묶음들(단계id).map((b) => `- **${b.id}** (${b.뜻})\n${b.답.map((t) => `  - 「${t}」`).join('\n')}`).join('\n');
  return `## 순간 「${단계id}」\n상황: ${d.상황}\n하온이 방금 한 말: 「${d.앞말}」\n\n답 묶음(하온이 이어서 할 말 — 변형은 서로 바꿔 튼다):\n${묶}\n\n되묻기 줄(묶음 아님): ${되묻기(단계id).map((t) => `「${t}」`).join(' · ')}`;
}

export function 말글(m) {
  return `- id: ${m.id}\n  학습자말: 「${m.학습자말}」\n  뜻: ${m.뜻}\n  받아적기: 「${m.받아적기}」`;
}

function 자료(폴더) {
  for (const [조, 순간들] of Object.entries(조들)) {
    const 말들 = 학습자말.filter((m) => 순간들.includes(m.단계));
    const 글 = [
      기준,
      '---',
      ...순간들.map((s) => `${순간글(s)}\n\n### 이 순간의 학습자 말\n${말들.filter((m) => m.단계 === s).map(말글).join('\n')}`),
    ].join('\n\n');
    fs.mkdirSync(path.join(폴더, 조), { recursive: true });
    fs.writeFileSync(path.join(폴더, 조, '자료.md'), 글);
    console.log(`${조}: ${순간들.join('·')} ${말들.length}줄 → ${path.join(폴더, 조, '자료.md')}`);
  }
}

function 검수본문(m) {
  const ids = 묶음들(m.단계).map((b) => b.id);
  return {
    model: 'gpt-6.1-terra',
    reasoning: { effort: 'medium' },
    max_output_tokens: 4000,
    input: [
      { role: 'developer', content: [{ type: 'input_text', text: 기준 }] },
      { role: 'user', content: [{ type: 'input_text', text: `${순간글(m.단계)}\n\n### 학습자 말\n${말글(m)}` }] },
    ],
    text: {
      format: {
        type: 'json_schema', name: 'gold_label', strict: true,
        schema: {
          type: 'object', additionalProperties: false,
          required: ['자연스러운', '최선', '되묻기허용', '받아적기로뜻앎', '평범', '메모'],
          properties: {
            자연스러운: { type: 'array', items: { type: 'string', enum: ids } },
            최선: { type: 'string', enum: [...ids, '되묻기', '생성'] },
            되묻기허용: { type: 'boolean' },
            받아적기로뜻앎: { type: 'boolean' },
            평범: { type: 'boolean' },
            메모: { type: 'string' },
          },
        },
      },
    },
  };
}

async function gpt(동시) {
  const 결과 = new Array(학습자말.length);
  let 다음 = 0;
  await Promise.all(Array.from({ length: 동시 }, async () => {
    while (다음 < 학습자말.length) {
      const i = 다음++;
      const m = 학습자말[i];
      for (let 회 = 1; ; 회++) {
        try {
          const { 답 } = await 응답부르기(검수본문(m));
          const o = JSON.parse(출력글(답) || '{}');
          if (!Array.isArray(o.자연스러운)) throw new Error('자연스러운 없음');
          결과[i] = { id: m.id, ...o, USD: 글값('gpt-6.1-terra', 답.usage) };
          break;
        } catch (e) {
          if (회 >= 3 || e.상태 === 400) { 결과[i] = { id: m.id, 오류: String(e.message).slice(0, 200) }; break; }
          await new Promise((r) => setTimeout(r, 3000 * 회));
        }
      }
    }
  }));
  fs.writeFileSync(path.join(여기, '정답_GPT.jsonl'), 결과.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const 됨 = 결과.filter((r) => !r.오류);
  console.log(JSON.stringify({ 줄: 결과.length, 오류: 결과.length - 됨.length, USD합: Number(됨.reduce((s, r) => s + (r.USD || 0), 0).toFixed(4)) }));
}

const [명령, ...나머지] = process.argv.slice(2);
if (명령 === '자료') 자료(나머지[0]);
else if (명령 === 'gpt') await gpt(Number(나머지[나머지.indexOf('--동시') + 1]) || 6);
else if (명령) { console.error('명령: 자료 <폴더> | gpt'); process.exit(1); }
