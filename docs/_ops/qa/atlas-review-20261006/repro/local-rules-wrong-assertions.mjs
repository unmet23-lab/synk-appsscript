// 검수 재현 스크립트(2026-10-06). 로컬 한국어 규칙이 부정·과거·타인·불확실 변형을 현재 본인 제안으로 내는 문장들(직접 지은 문장만).
// 저장소·네트워크·유료 호출을 건드리지 않는다. 실행: node <이 파일>
// Read-only reproduction: sentences I wrote myself, run through the local explicit-expression extractor
// and Core prepare. Shows what is proposed as the person's own current fact, and the cited span.
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url)).replace(/\\/g, '/');
const Interpretation = require(ROOT + 'atlas/interpretation.js');
const content = require(ROOT + 'docs/마케팅/맞춤도구/computer/content.js');
const { createComputerCatalog, extractComputerProposals } = await import(pathToFileURL(ROOT + 'experiences/atlas-lab/interpretation.mjs').href);
const catalog = createComputerCatalog(content), scope = { domain: 'SHIFT', workspace: 'review-probe', subject: 'synthetic' }, at = '2026-10-06T00:00:00.000Z';
const groups = {
  '부정': ['제 램은 16GB가 아닙니다.', '지금 램은 8GB가 아닌 16GB입니다.', '예산은 100~150만원이 아닙니다.', 'LM Studio는 지웠고 Gemini를 써요.', 'Ollama는 무거워서 ChatGPT를 써요.', '현재 RAM은 64GB가 아님.'],
  '과거': ['제 램은 16GB였다가 32GB로 올렸어요.', '제 램은 8GB에서 16GB로 바꿨어요.', '지금 램은 8GB에서 32GB가 됐어요.'],
  '타인': ['Tom은 프리미어로 4K 영상을 편집해요.', '민수 컴퓨터가 있어요.', '민수만 맥이 편해요.', '팀장님도 윈도우가 편해요.', '3팀은 프리미어로 영상을 편집해요.', '형 노트북이 있어요.'],
  '불확실·희망·계획': ['제 램은 16GB인 것 같아요.', '제 램은 16GB일 거예요.', '제 램은 32GB면 좋겠어요.', '사려고 봐 둔 램 32GB 노트북이 있어요.', '제 램은 32GB로 늘릴 거예요.', '제 램은 16GB 이상이어야 해요.'],
  '대상 혼동': ['제 컴퓨터에서 웹 AI를 써요.', '내 컴퓨터에서 ChatGPT 같은 AI를 사용해요.', '로컬 AI보다 웹 AI를 써요.', '포토샵보다 캔바를 써요.', '아이패드를 매일 들고 다녀요.', '4K 모니터로 영상을 편집해요.'],
  '대조(시험이 보류를 기대하는 같은 유형)': ['친구 컴퓨터가 있어요.', '제 램은 16GB였어요.', '민수는 프리미어로 영상을 편집해요.', '제 램은 아마 32GB인 것 같아요.', '램 32GB 노트북을 원해요.'],
};
let offsetErrors = 0;
for (const [group, sentences] of Object.entries(groups)) {
  console.log('\n## ' + group);
  for (const text of sentences) {
    const source = { id: 'probe-source', scope, at, text, actor: 'self' };
    const out = extractComputerProposals({ source, catalog });
    const prepared = Interpretation.prepare({ contract: catalog.contract, scope, sources: [source], proposals: out.proposals, at });
    for (const p of out.proposals) for (const e of p.evidence) if (text.slice(e.start, e.end) !== e.quote) offsetErrors += 1;
    for (const h of out.held) if (text.slice(h.start, h.end) !== h.quote) offsetErrors += 1;
    const shown = prepared.proposals.map(p => `${p.field}=${p.value} [${p.subject}/${p.stance}/${p.status}]`).join(', ');
    console.log(`"${text}"\n    -> ${shown || '(제안 없음)'}${out.held.length ? ' | 보류: ' + out.held.map(h => h.reason).join(' / ') : ''}`);
  }
}
console.log('\noffset mismatches:', offsetErrors);
