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
  'docs/브랜드_폰트_정본.md',
];

/* 판 번호(v13.0 같은)를 손으로 올리던 것은 2026-09-17에 걷었다 — 지침을 고칠 때마다
 * 숫자를 안 올리면 시험이 깨졌고, 그게 지침 손질을 막는 문턱이었다. 이제 머리말의
 * 날짜만 읽고, 실제 판별은 커밋이 한다. 사람이 따로 올릴 것이 없다. */
const claudeMd = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8');
const mVer = claudeMd.match(/^>\s*\**(\d{4}-\d{2}-\d{2})/m);
const VER_DATE = mVer ? mVer[1] : '';
const VER = VER_DATE || '현재 원문';
const 커밋 = (() => {
  try {
    const r = require('child_process').spawnSync('git', ['-C', REPO, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : '';
  } catch { return ''; }
})();
const STAMP = `${VER}${커밋 ? ` · ${커밋}` : ''}`;


function readme(files) {
  return `# SYNK 지침 사본

${STAMP}

원문 경로를 유지한 자료입니다. 사용할 때 현재 저장소와 대조하고 이번 요청에 필요한 문서만 읽습니다.

${files.map(f => '- `'+f+'`').join('\n')}
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
