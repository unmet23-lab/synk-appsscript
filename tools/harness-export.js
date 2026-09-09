#!/usr/bin/env node
/**
 * 하네스 내보내기 — 저장소의 공통 원칙과 모델별 지침을 원문 그대로 묶는다.
 * 명시한 생성 파일만 갱신하며 출력 폴더나 그 안의 다른 파일을 지우지 않는다.
 * 개인 기억, 로그인 설정, 훅, tools/ 전체는 내보내지 않는다.
 *
 * 사용: node tools/harness-export.js [--out <경로>] [--dry]
 * require 시 생성하지 않는다. rot-check는 DEFAULT_OUT/VER/STAMP를 사용한다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const outIdx = args.indexOf('--out');
const DEFAULT_OUT = path.join(os.homedir(), 'OneDrive', 'Desktop', 'SYNK_하네스');
const OUT = outIdx >= 0 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : DEFAULT_OUT;

// 필수 지침은 모두 읽은 다음 출력한다. 파일 부재를 빈 지침으로 위장하지 않는다.
const REQUIRED = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'docs/AI_운영원칙.md'];
const REFERENCES = [
  'docs/AI_스택_가이드.md',
  'docs/AI_워크플로우_아키텍처.md',
  'docs/명품_기준_v1.md',
  'DESIGN.md',
  'docs/디자인_토큰.json',
  'docs/디자인_컨셉_정본_v1.md',
  'docs/브랜드_폰트_정본.md',
];

const claudeMd = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8');
const mVer = claudeMd.match(/\*\*(v[\d.]+)\s*·\s*([\d-]+)\*\*/)
  || claudeMd.match(/^>\s*\**(v[\d.]+)\s*·\s*([\d-]+)/m);
const VER = mVer ? mVer[1] : '(버전 미검출)';
const VER_DATE = mVer ? mVer[2] : '';
const STAMP = `${VER} · 정본일 ${VER_DATE}`;

function 버전확인() {
  if (mVer) return;
  console.error('CLAUDE.md 에서 지침 판을 못 읽었다 — 이식 폴더를 만들지 않는다.');
  console.error('머리줄의 v12.0 · 2026-09-09 같은 버전과 날짜를 확인한다.');
  process.exit(2);
}

function readme(files) {
  return `# SYNK 하네스 이식 꾸러미

> 생성물의 정본 = SYNK-appsscript 저장소 · 지침 **${STAMP}**
> 갱신: 저장소에서 \`node tools/harness-export.js --out <이 폴더>\`

## 담긴 문서

\`00_정본/\`은 원래 상대 경로를 유지한 문서 묶음입니다. 세 모델의 지침은 각자의 원문이며 다른 모델의 지침을 복제해 대신 넣지 않습니다.

| 파일 | 용도 |
|---|---|
| \`AGENTS.md\` | Codex에서 시작하는 작업의 진입 지침 |
| \`CLAUDE.md\` | Claude에서 시작하는 작업의 진입 지침 |
| \`GEMINI.md\` | Gemini/Antigravity에서 시작하는 작업의 진입 지침 |
| \`docs/AI_운영원칙.md\` | 세 모델이 함께 따르는 공통 원칙 |

그 밖에 실제 포함한 정본·참고 문서:
${files.filter((f) => !REQUIRED.includes(f)).map((f) => `- \`${f}\``).join('\n') || '- 없음'}

## 적용 방식

직접 요청받은 모델이 조사·제작·검증·통합까지 맡습니다. 이 묶음은 생성 시점의 사본입니다. 원래 저장소의 해당 모델 지침·공통 원칙·업무 원문의 현재 내용과 대조한 뒤 필요한 부분만 사용합니다. 다른 환경에는 목표·작업 사본·관련 원문을 전달하고 실제로 읽고 실행할 수 있는지 확인합니다.

진행 중인 작업·병렬 작업·워크트리·후속 일정은 현재 메인 하네스의 기본 기능이 맡습니다. 별도 강제 훅을 설치하는 꾸러미가 아닙니다. Gemini 실행 통로는 현행 공통 원칙과 작업 흐름 안내가 정하며, 구독용 Gemini CLI가 계속 제공된다고 가정하지 않습니다.

철학, 엔진 설계, 마스코트 원본, 스킬과 실행 도구는 이 묶음에 통째로 복제하지 않습니다. 관련 문서가 가리키는 저장소의 정본을 필요한 범위에서 읽고 사용합니다. 브랜드 색·서체 값을 이 안내에 다시 적어 별도 정본을 만들지 않습니다.

## 갱신과 보존

이 도구는 위에 명시한 생성 파일과 README만 갱신합니다. 출력 폴더 전체를 지우지 않으며 관계없는 파일은 그대로 둡니다. 내보낸 지침을 바꾸려면 저장소 원문을 고친 뒤 다시 실행합니다.

이전 판이 남긴 파일도 자동 삭제하지 않습니다. 예전의 훅·개인 기억·전체 도구 폴더가 같은 출력 위치에 이미 있다면 이번 판의 생성물 목록 밖에 있는 과거 자료입니다. 새로 공유할 때는 빈 출력 폴더에 생성한 이번 문서 묶음을 사용합니다.

개인 기억 전체, 로그인·권한 설정, 자격증명, 학생 식별 데이터, 훅, tools/ 전체는 기본 내보내기 대상이 아닙니다. 문서를 전달했다고 앱 연결·로그인·실행 환경까지 옮겨진 것으로 보고하지 않습니다.
`;
}

// 기존 생성 경로가 다른 파일로 연결돼 있으면 그 대상을 덮어쓰지 않는다.
function checkDestination(rel) {
  let current = OUT;
  for (const piece of rel.split('/')) {
    current = path.join(current, piece);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (stat && stat.isSymbolicLink()) {
      throw new Error(`출력 경로가 다른 위치로 연결돼 있어 갱신하지 않는다: ${rel}`);
    }
  }
  return path.join(OUT, rel);
}

function main() {
  버전확인();
  if (outIdx >= 0 && (!args[outIdx + 1] || args[outIdx + 1].startsWith('--'))) {
    throw new Error('--out 뒤에 출력 폴더 경로가 필요하다.');
  }
  const files = [...REQUIRED, ...REFERENCES.filter((f) => fs.existsSync(path.join(REPO, f)))];
  const plan = files.map((file) => ({
    rel: `00_정본/${file}`,
    body: fs.readFileSync(path.join(REPO, file)),
  }));
  plan.push({ rel: 'README.md', body: Buffer.from(readme(files), 'utf8') });
  for (const item of plan) item.dst = checkDestination(item.rel);

  console.log(`하네스 내보내기 — 정본 ${STAMP}`);
  console.log(`대상: ${OUT}${DRY ? ' [DRY RUN]' : ''}`);
  for (const { rel, dst, body } of plan) {
    if (!DRY) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, body);
    }
    console.log(`  + ${rel}`);
  }
  console.log(DRY ? `예정 ${plan.length}건 — 실제 쓰기 없음` : `생성·갱신 ${plan.length}건 — 그 밖의 파일 보존`);
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`하네스 내보내기 실패: ${error.message}`);
    process.exitCode = 1;
  }
}
module.exports = { DEFAULT_OUT, VER, STAMP };
