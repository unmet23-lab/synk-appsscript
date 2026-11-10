// 지도(단계 1)의 변형 목록 — 번호 장부 · 조립 · 읽기 · 빌드 검사의 규칙을 하나씩 일부러 깬 사본을 unit 묶음(test/unit/map/)이
// 모두 잡아야 한다. 꼴은 tools/mutants/brain.mjs와 같다: [잡을 묶음, 갈래, 이름, 바꿀 파일, 바꿀 글, 바꾼 글].
// 지도 규칙을 더하거나 고칠 때는 그 규칙을 깬 변형을 여기에 함께 더한다.
const U = 'unit';
const LEDGER = 'src/map/ledger.mjs';
const COMPOSE = 'src/map/compose.mjs';
const READ = 'src/map/index.mjs';
const AUDIT = 'src/map/audit.mjs';

export const MAP_MUTANTS = [
  [
    U,
    '장부',
    '새 열쇠가 마지막 번호를 다시 쓴다(번호가 겹친다)',
    LEDGER,
    'const n = next.length + 1;',
    'const n = next.length;',
  ],
  [
    U,
    '장부',
    '이름 표의 새 이름이 이미 다른 번호여도 지나간다(Fable P2-3)',
    LEDGER,
    'else if (byKey.has(to) && byKey.get(to) !== byKey.get(root))',
    'else if (false)',
  ],
  [
    U,
    '조립',
    '은행에서 빠진 문항을 은퇴로 남기지 않는다',
    COMPOSE,
    '.filter(([n]) => !liveItems.has(n))',
    '.filter(() => false)',
  ],
  [
    U,
    '조립',
    '접기 칸이 바뀌어도 바뀐 문항으로 보지 않는다(색인 판이 안 오른다)',
    COMPOSE,
    'else if (JSON.stringify(foldViewOf(prev)) !== JSON.stringify(foldViewOf(row)))',
    'else if (false)',
  ],
  [
    U,
    '조립',
    '같은 열쇠의 다른 칸을 첫 줄로 덮는다(Fable P2-9)',
    COMPOSE,
    'if (!sameFold(first, row)) problems.push',
    'if (false) problems.push',
  ],
  [
    U,
    '조립',
    '고아 태그를 조용히 버린다(Fable P2-9)',
    COMPOSE,
    '.filter(key => !keys.has(key))',
    '.filter(() => false)',
  ],
  [
    U,
    '읽기',
    '태그 없는 문항에 계열 단위를 채우지 않는다(설계 §3-1)',
    READ,
    'row.units.length ? [...row.units] : [`${FAMILY_UNIT}${row.familyKey}`]',
    '[...row.units]',
  ],
  [
    U,
    '읽기',
    '이름 표를 한 홉만 따른다(Fable P2-4)',
    READ,
    'at = renames[at];',
    'return renames[at];',
  ],
  [
    U,
    '검사',
    '문항 하나뿐인 단위를 놓친다(단계 1 관문)',
    AUDIT,
    'if (entry.items === 1) onlyItem.push(unit);',
    'if (entry.items === 0) onlyItem.push(unit);',
  ],
  [
    U,
    '조립',
    '색인의 계열 표에 장부의 옛 이름을 싣는다(아르곤 A1)',
    COMPOSE,
    'families: currentRows(familyLedger.rows, renames.families),',
    'families: familyLedger.rows,',
  ],
  [
    U,
    '조립',
    '계열 줄의 빈 난도를 null로 맞추지 않는다 — 판마다 계열 줄이 모두 바뀜으로 잡힌다(아르곤 A2)',
    COMPOSE,
    'difficulty: row.difficulty ?? null,',
    'difficulty: row.difficulty,',
  ],
];
