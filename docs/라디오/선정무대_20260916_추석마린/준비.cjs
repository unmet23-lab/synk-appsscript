'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const dir = __dirname;
const root = path.resolve(dir, '..', '..', '..');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const manifestPath = path.join(dir, 'manifest.json');
let followThrough = {};
try {
  const prior = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  followThrough = Object.fromEntries(['runtimeTuning', 'broadcast']
    .filter((key) => prior[key] !== undefined)
    .map((key) => [key, prior[key]]));
} catch { /* first generation has no post-apply record */ }
const basePath = path.join(root, 'docs/라디오/선정무대_20260910/가운데배치_20260915/after-마스코트.html');
const baseSha = 'd3d21c4200e3db0ad5bb4fd8d51ad49eea9ad9adf7840883f4d410b930112428';
const base = fs.readFileSync(basePath);
if (sha(base) !== baseSha) throw new Error('기준 마스코트 HTML이 바뀌었다. 새 원문을 대조해야 한다.');

let html = base.toString('utf8');
const nl = html.includes('\r\n') ? '\r\n' : '\n';
function one(oldText, newText, label) {
  const at = html.indexOf(oldText);
  if (at < 0 || html.indexOf(oldText, at + oldText.length) >= 0) throw new Error(label + ' 기준 문장을 하나로 찾지 못했다.');
  html = html.slice(0, at) + newText + html.slice(at + oldText.length);
}
function oneRegex(re, newText, label) {
  const matches = [...html.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))];
  if (matches.length !== 1) throw new Error(label + ' 기준 구역을 하나로 찾지 못했다: ' + matches.length);
  html = html.replace(re, newText);
}

oneRegex(
  /\/\* 🆕 2026-09-08 부스가 «서는 결»[\s\S]*?^const 부스결 = new Set\(\[[^\r\n]*\]\);/m,
  [
    '/* 2026-09-16 사용자 요청 — 이번 방송은 추석 마당에도 DJ 부스를 세운다.',
    '   기존 전자·시티팝 결의 부스 동작은 유지한다. */',
    "const 부스결 = new Set(['전자네온물가', '전자밤도시', '시티팝노을휴양지', '추석보름달마당']);",
  ].join(nl),
  '부스 장면표',
);

oneRegex(
  /  \/\* 🆕 2026-09-07 신설 — 추석 시즌 무대[\s\S]*?^  추석보름달마당:[^\r\n]*$/m,
  [
    '  /* 2026-09-16 사용자 요청 — 이번 추석 생중계는 마린을 고정하고 헤드폰을 얹는다.',
    '     마린 본체에 이미 있는 꽃은 그대로 두고, 보름달 한옥 배경은 자연생동 영상으로 잇는다. */',
    "  추석보름달마당: { DJ: '마린', 옷: ['펠트헤드폰'], 접지: 'rgba(58,38,24,0.66)', 바닥: 8.75 },",
  ].join(nl),
  '추석 차림표',
);

one("let 현재DJ = ['몽글', '까몽', '마린'].includes(인자.get('DJ')) ? 인자.get('DJ') : '까몽';", "let 현재DJ = '마린';", '기본 DJ');
one("const 첫결 = 인자.get('결') || '반딧불노을들판';", "const 첫결 = '추석보름달마당';", '첫 장면');
one('Promise.all(Object.keys(컷표).map(DJ =>', "Promise.all(Object.keys(컷표).filter(DJ => DJ === '마린').map(DJ =>", '마린 전용 준비');
one('    일감.결 = 사건.결 || null;', "    일감.결 = '추석보름달마당';", '곡 사이 장면 고정');
one('    const 갈DJ = DJ들.includes(사건.DJ) ? 사건.DJ : 결의DJ(일감.결);', "    const 갈DJ = '마린';", '곡 사이 DJ 고정');

const candidatePath = path.join(dir, 'after-마스코트.html');
fs.writeFileSync(candidatePath, html, 'utf8');

const stageName = 'chuseok-natural-20260909-v2.mp4';
const stagePath = path.join(root, 'docs/라디오/무대영상/추석_자연생동_20260909_v2.mp4');
const stageSha = 'c0e984f2ce771cabd1704c5ac25335c1b05519731566de7dfa98cf6622827df7';
if (sha(fs.readFileSync(stagePath)) !== stageSha) throw new Error('승인된 추석 자연생동 영상의 지문이 다르다.');

const list = 'ffconcat version 1.0\n' + Array.from({ length: 80 }, () => `file '${stageName}'\n`).join('');
const listPath = path.join(dir, '무대차례.txt');
fs.writeFileSync(listPath, list, 'utf8');

const protectedRemote = {
  '/opt/synk-radio/지면/bots/오버레이/라디오표정리듬.js': '7d583cbb9334358ee4f5676dba9286ec37a3e6f5ad5adeea92d034aa0cc457c8',
  '/opt/synk-radio/지면/bots/오버레이/라디오가장자리-b76f448ab55a.js': 'b76f448ab55af135a5e2dc652683fc721edfc35ceaad7ae1af4bcac138a25a58',
  '/opt/synk-radio/지면/bots/오버레이/radio13-06fdc6100afc.js': '06fdc6100afca914845cc53d3eb8dd6fca068460e367d7196f1cd0f629f74852',
  '/opt/synk-radio/지면/docs/Loom_자산/라디오소품/부스.webp': '3beff72bd96adf9554d151874a14616e0585aaf57c720595dbbf846613c48d33',
  '/opt/synk-radio/지면/docs/Loom_자산/라디오소품/디스크.webp': '05996b67558d1031c8578d4aa99e09857a2da9dd86a41e64730e25328a136839',
  '/opt/synk-radio/지면/docs/Loom_자산/옷층/옷_마린_펠트헤드폰.webp': '83ebff535f52449375973b08ff710f53f4605a9992c53a569434cdaba58a07b2',
  '/opt/synk-radio/지면/docs/캐릭터/화면_1024/마린_본체.webp': '65efc6beb75ba27a94da8d2fbab616236453e646ffcf3f1e9a5e21d7be2d024c',
  '/opt/synk-radio/지면/docs/캐릭터/화면_1024/마린_눈감음.webp': '5c80ea55c74a6083b1801ce316413c6e15b0e7632057932ed659618c21920cf7',
  '/opt/synk-radio/지면/docs/캐릭터/화면_1024/마린_눈웃음.webp': '9de17a519099ed03e36864d66a579d41b5fcf535accc54da00d8d0663e9f6944',
  '/opt/synk-radio/지면/docs/캐릭터/화면_1024/마린_궁금함.webp': 'fe7503e4970ba5cfa47c53a0243ca26ce2ef6aa78c1b594446a7398def149e9e',
  '/opt/synk-radio/지면/docs/캐릭터/화면_1024/마린_집중.webp': 'b80f1dd91cf5b69c55603baf56a930f5bc0c90866e4b3bb1f67bd7b5cee4c43c',
  '/opt/synk-radio/지면/docs/캐릭터/화면_1024/마린_안도.webp': 'acdd99d512917303954f920772ad09f2c857100c1b724f645ccad3d1f4018207',
  '/opt/synk-radio/지면/docs/캐릭터/화면_1024/마린_응원.webp': 'df788332b75fa44adc30236354f86a2007c3da36b68fd79ed882eebed55d5e6f',
  '/opt/synk-radio/지면/docs/캐릭터/화면_1024/마린_놀람.webp': 'b3deef46baf1bccf217d42cdd394f6bc20a1cf448e36e713c421a770043e7a43',
  '/opt/synk-radio/지면/docs/캐릭터/화면_1024/마린_인사.webp': '839cc1062360058a04c969ade1b3561f78a095f358e7a48026c4c12cf791ed41',
  '/opt/synk-radio/무대차례/chuseok-natural-20260909-v2.mp4': stageSha,
  '/opt/synk-radio/무대차례/field-radio13-20260910-986177a55b4b.mp4': '986177a55b4bb21ae4d82c483f1c66a92e14d2e48d7a441a7ab76bd0f7e98a65',
  '/opt/synk-radio/소리/synk-radio-blok11-20260909-gapless.flac': 'c9295db33abc8609bda2cdbc885dfce563b52cb6cc6a9db49f7ec276bf931f45',
  '/opt/synk-radio/소리/playlist.txt': '374e9ce2cc0d6f81928c5639cf69ed0abb9252f2d9f8c2025a24ad330a0bee5c',
};

const manifest = {
  at: new Date().toISOString(),
  scope: '이번 방송 프로필: 추석 자연생동 배경 + 마린 + 헤드폰 + DJ 부스. 곡 경계에도 장면과 DJ를 고정.',
  source: { path: path.relative(root, basePath).replace(/\\/g, '/'), sha256: baseSha },
  candidate: { path: 'docs/라디오/선정무대_20260916_추석마린/after-마스코트.html', sha256: sha(Buffer.from(html)) },
  stage: { localPath: path.relative(root, stagePath).replace(/\\/g, '/'), remotePath: `/opt/synk-radio/무대차례/${stageName}`, sha256: stageSha, listPath: 'docs/라디오/선정무대_20260916_추석마린/무대차례.txt', entryCount: 80, listSha256: sha(Buffer.from(list)) },
  remotePrecondition: {
    overlaySha256: baseSha,
    stageListSha256: '19552c7713584218a93a1e72b7b8f20f57d034ad453ea3394159d8176c9885bc',
  },
  protectedRemote,
  sourceVisuals: {
    booth: 'docs/Loom_자산/라디오소품/부스.webp',
    disc: 'docs/Loom_자산/라디오소품/디스크.webp',
    headset: 'docs/Loom_자산/옷층/옷_마린_펠트헤드폰.webp',
    marineAssetsComeFrom: '원격 라디오 서버의 기존 화면_1024 세트. 로컬의 다른 작업본은 이번 배포에 포함하지 않는다.',
  },
  composition: { canvas: [1280, 720], overlayQuery: '층=마스코트,전광판&크기=.32&자리=중하&바닥=2.5&부스=1', backgroundLoopSeconds: 60 },
  initialApplyPreserved: ['기존 오디오 FLAC', '재생목록', '송출 자격증명', 'radio-live 서비스 파일', '조율 설정', 'radio-stream 비활성 상태'],
  ...followThrough,
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ sourceSha: baseSha, candidateSha: manifest.candidate.sha256, stageSha, stageListSha: manifest.stage.listSha256, stageEntries: manifest.stage.entryCount }, null, 2));
