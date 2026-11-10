// 변형 시험 실행기(설계 §11 가상 학습자 관문 7 · 시제품 prototype/mutants.mjs). 규칙을 하나씩 일부러 깬 사본을 만들어,
// 그 규칙을 지키는 시험이 사본에서 실패하는지(= 잡는지) 본다. 잡지 못하는 변형이 있으면 두뇌가 아니라 시험을 먼저 고친다.
// 규칙을 더하거나 고칠 때는 그 규칙을 깬 변형을 목록에 함께 더한다 — 두뇌(단계 2)는 tools/mutants/brain.mjs, 기록(단계 3)은
// tools/mutants/record.mjs처럼 단계마다 파일 하나를 두고 여기서 모은다(두 세션이 같은 목록 파일을 고치지 않게).
//
// 변형 하나 = [잡을 시험 묶음, 갈래, 이름, 바꿀 파일(패키지 기준), 바꿀 글, 바꾼 글]. 바꿀 글은 그 파일에 꼭 한 번 있어야 한다.
// 사본은 packages/atlas/.mutants/<번호>/에 src · loader를 복사해 만든다 — 패키지 안이라 사본에서도 ts-fsrs 같은 의존이 풀린다.
// 시험 파일은 패키지의 것 그대로이고, ATLAS_SUBJECT_ROOT=<사본>으로 돌아 사본의 src · loader를 본다(test/support/subject.mjs).
//   node packages/atlas/tools/mutants.mjs           목록 전부
//   node packages/atlas/tools/mutants.mjs --self    실행기 자체 시험(Vellum의 언어 물러서기를 깨뜨린 변형을 unit 묶음이 잡는가)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAIN_MUTANTS } from './mutants/brain.mjs';
import { COACH_MUTANTS } from './mutants/coach.mjs';
import { MAP_MUTANTS } from './mutants/map.mjs';
import { RECORD_MUTANTS } from './mutants/record.mjs';
import { testEnv } from './test.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 실행마다 자기 사본 폴더(.mutants/<pid>)를 쓴다 — check의 자체 시험과 gate의 변형 실행이 함께 돌아도 서로의 사본을 지우지 않는다
// (11-10: 하나뿐인 .mutants를 다른 실행이 끝나며 지워, 그 순간 돌던 변형이 「사본 없음」으로 실패해 거짓 「잡음」이 될 수 있었다).
const BASE = path.join(ROOT, '.mutants');
const WORK = path.join(BASE, String(process.pid));

export const MUTANTS = [...BRAIN_MUTANTS, ...MAP_MUTANTS, ...RECORD_MUTANTS, ...COACH_MUTANTS];

export const SELF_TEST = [
  [
    'unit',
    '실행기',
    'Vellum이 다른 언어로 물러선다',
    'src/vellum/index.mjs',
    '  const row = TABLE[lang]?.[code];',
    '  const row = TABLE[lang]?.[code] ?? TABLE.en?.[code] ?? TABLE.ko[code];',
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

// 시험이 사본에서 실패했나(= 잡았나). 시험 도중 사본이 사라졌으면 잡은 것이 아니라 실행이 깨진 것이다 — 멈춘다.
function caught(group, dir) {
  const run = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'test.mjs'), group], {
    cwd: ROOT,
    encoding: 'utf8',
    env: testEnv({ ATLAS_SUBJECT_ROOT: dir }),
  });
  if (!fs.existsSync(path.join(dir, 'src')))
    throw new Error(`Atlas mutants: 시험 도중 사본이 사라졌다(${dir}) — 다른 실행과 부딪쳤다`);
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
  console.log(`atlas mutants: 사본 폴더 ${path.relative(ROOT, WORK).replace(/\\/g, '/')}`);
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
    if (fs.existsSync(BASE) && !fs.readdirSync(BASE).length) fs.rmSync(BASE, { recursive: true });
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
