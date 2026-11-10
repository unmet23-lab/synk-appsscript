// 변형 시험 실행기(설계 §11 가상 학습자 관문 7 · 시제품 prototype/mutants.mjs). 규칙을 하나씩 일부러 깬 사본을 만들어,
// 그 규칙을 지키는 시험이 사본에서 실패하는지(= 잡는지) 본다. 잡지 못하는 변형이 있으면 두뇌가 아니라 시험을 먼저 고친다.
// 규칙을 더하거나 고칠 때는 그 규칙을 깬 변형을 MUTANTS에 함께 더한다(단계 2 · 3).
//
// 변형 하나 = [잡을 시험 묶음, 갈래, 이름, 바꿀 파일(패키지 기준), 바꿀 글, 바꾼 글]. 바꿀 글은 그 파일에 꼭 한 번 있어야 한다.
// 사본은 packages/atlas/.mutants/<번호>/에 src · loader를 복사해 만든다 — 패키지 안이라 사본에서도 ts-fsrs 같은 의존이 풀린다.
// 시험 파일은 패키지의 것 그대로이고, ATLAS_SUBJECT_ROOT=<사본>으로 돌아 사본의 src · loader를 본다(test/support/subject.mjs).
//   node packages/atlas/tools/mutants.mjs           목록 전부
//   node packages/atlas/tools/mutants.mjs --self    실행기 자체 시험(빈 코치의 ready를 깨뜨린 변형을 unit 묶음이 잡는가)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { testEnv } from './test.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORK = path.join(ROOT, '.mutants');

export const MUTANTS = [
  // 단계 2 · 3이 시제품의 변형 64개를 규칙과 함께 옮겨 온다 — 예:
  // ['properties', '기억', '같은 자리 규칙이 없다 — 답마다 새 자리', 'src/memory/index.mjs', 'if (sameSitting(…)) {', 'if (false) {'],
];

export const SELF_TEST = [
  [
    'unit',
    '실행기',
    '빈 코치의 ready가 거절된다',
    'src/coach/index.mjs',
    'ready: Promise.resolve()',
    "ready: Promise.reject(new Error('mutant'))",
  ],
];

// 사본 하나를 만든다. change가 없으면 바꾸지 않은 사본이다. 바꿀 글이 그 파일에 꼭 한 번 있지 않으면 null.
function prepare(label, change = null) {
  const dir = path.join(WORK, String(label));
  fs.rmSync(dir, { recursive: true, force: true });
  for (const part of ['src', 'loader'])
    fs.cpSync(path.join(ROOT, part), path.join(dir, part), { recursive: true });
  if (!change) return dir;
  const target = path.join(dir, change.file);
  const text = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
  if (text.split(change.from).length !== 2) return null;
  fs.writeFileSync(target, text.replace(change.from, change.to));
  return dir;
}

function caught(group, dir) {
  const run = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'test.mjs'), group], {
    cwd: ROOT,
    encoding: 'utf8',
    env: testEnv({ ATLAS_SUBJECT_ROOT: dir }),
  });
  return run.status !== 0;
}

// 바꾸지 않은 사본에서 시험이 먼저 통과해야 한다 — 아니면 모든 변형이 「잡음」으로 보여 시험이 무딘 것을 감춘다.
function baseline(groups) {
  for (const group of groups) {
    if (caught(group, prepare('baseline'))) {
      throw new Error(
        `Atlas mutants: 바꾸지 않은 사본에서 ${group} 시험이 실패한다 — 변형을 볼 수 없다`,
      );
    }
  }
}

export function runMutants(list) {
  const missed = [];
  try {
    baseline([...new Set(list.map(([group]) => group))]);
    list.forEach(([group, kind, name, file, from, to], index) => {
      const dir = prepare(index, { file, from, to });
      const result = dir === null ? '바꿀 자리를 못 찾음' : caught(group, dir) ? '잡음' : '못 잡음';
      if (result !== '잡음') missed.push(name);
      console.log(`${result} · ${kind} · ${name}`);
    });
  } finally {
    fs.rmSync(WORK, { recursive: true, force: true });
  }
  console.log(`변형 ${list.length}개 가운데 못 잡은 것: ${missed.length}`);
  return missed;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const list = process.argv.includes('--self') ? SELF_TEST : MUTANTS;
  if (!list.length)
    console.log(
      'atlas mutants: 아직 변형이 없다 — 단계 2 · 3이 규칙과 함께 더한다(실행기 자체 시험은 --self)',
    );
  else if (runMutants(list).length) process.exitCode = 1;
}
