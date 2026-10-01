#!/usr/bin/env node
'use strict';

// Read the existing authorities; never copy quiz questions/answers or student data.
// Rebuild requires the sibling Talk source checkout. Runtime lookup does not.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { 뱅크읽기 } = require('./lib/문법뱅크');
const { validateMap } = require('../strata');
const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'strata', 'maps', 'ko.json');
const hash = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const normalized = value => value.replace(/\r\n/g, '\n');
const clone = value => JSON.parse(JSON.stringify(value));
const reference = (source, selector) => ({ source, selector });

function loadSources({ root = ROOT, talkRoot = path.resolve(ROOT, '..', 'SYNK-talk') } = {}) {
  const specs = {
    grammar_bank: [path.join(root, '엔진_콘텐츠AI.js'), 'SYNK-appsscript/엔진_콘텐츠AI.js'],
    skills: [path.join(talkRoot, 'contents', '토픽퀴즈문항.js'), 'SYNK-talk/contents/토픽퀴즈문항.js'],
    error_tags: [path.join(root, '계약', '수집_교정_계약.json'), 'SYNK-appsscript/계약/수집_교정_계약.json'],
    tag_links: [path.join(talkRoot, 'lib', '태그기술표.js'), 'SYNK-talk/lib/태그기술표.js'],
  };
  const sources = {}, contents = {};
  for (const [key, [file, label]] of Object.entries(specs)) {
    contents[key] = normalized(fs.readFileSync(file, 'utf8'));
    sources[key] = { path: label, sha256: hash(contents[key]), hash_format: 'sha256-utf8-lf' };
  }
  // The two Talk modules contain only authored data and pure lookup functions.
  // Invalidate their cache so two builds in one process read the current source.
  const localRequire = createRequire(__filename);
  const readModule = file => { delete require.cache[require.resolve(file)]; return localRequire(file); };
  const pack = readModule(specs.skills[0]), links = readModule(specs.tag_links[0]);
  return {
    grammar: clone(뱅크읽기(contents.grammar_bank).GRAMMAR_BANK),
    skills: clone(pack.스킬표), grammarBySkill: clone(pack.문법대응),
    tags: JSON.parse(contents.error_tags).오류태그.filter(tag => tag !== '오류없음'),
    tagToSkill: clone(links.표), missingTags: clone(links.대응없음), sources,
  };
}

function buildMap(input) {
  const { grammar, skills, grammarBySkill, tags, tagToSkill, missingTags, sources } = input;
  if (!Array.isArray(grammar) || !Array.isArray(skills) || !Array.isArray(tags)
    || !Array.isArray(missingTags) || !grammarBySkill || !tagToSkill || !sources) throw new TypeError('Strata build: invalid sources');
  const byGrammar = new Map(grammar.map(row => [row[0], row]));
  if (byGrammar.size !== grammar.length) throw new TypeError('Strata build: duplicate grammar');
  const skillIds = skills.map(skill => skill.skill_id);
  if (new Set(skillIds).size !== skills.length || Object.keys(grammarBySkill).length !== skills.length
    || Object.keys(grammarBySkill).some(id => !skillIds.includes(id))) throw new TypeError('Strata build: grammar membership must cover each skill exactly');
  const partition = [...Object.keys(tagToSkill), ...missingTags];
  if (new Set(partition).size !== partition.length || partition.length !== tags.length
    || partition.some(tag => !tags.includes(tag))) throw new TypeError('Strata build: tag partition differs from the contract');
  if (Object.values(tagToSkill).some(id => !skillIds.includes(id))) throw new TypeError('Strata build: tag references an unknown skill');
  const nodes = grammar.map(row => {
    if (row.length < 6 || !['요', '표'].includes(row[5])) throw new TypeError('Strata build: malformed grammar row');
    return { id: row[0], kind: 'grammar_point', label_ko: row[1], label_mn: null,
      level: { intro: row[3], review: row[4], basis: 'grammar_bank', evidence_code: row[5] },
      difficulty: { authored: null, measured: null, n: 0 },
      material: { target_forms: [row[1]], explanation: row[2], status: 'draft', reviewed: false },
      source_refs: [reference('grammar_bank', `GRAMMAR_BANK:${row[0]}`)] };
  });
  const edges = [];
  for (const skill of skills) {
    const grammarIds = grammarBySkill[skill.skill_id];
    if (!Array.isArray(grammarIds) || new Set(grammarIds).size !== grammarIds.length) throw new TypeError('Strata build: invalid membership');
    if (grammarIds.some(id => !byGrammar.has(id))) throw new TypeError('Strata build: missing grammar reference');
    nodes.push({ id: skill.skill_id, kind: 'skill', label_ko: skill.label_ko, label_mn: skill.label_mn || null,
      domain: skill.domain, level: grammarIds.length ? {
        intro: Math.max(...grammarIds.map(id => byGrammar.get(id)[3])), basis: 'grammar_bank', coverage: 'mapped_grammar_only',
      } : null, difficulty: { authored: null, measured: null, n: 0 },
      source_refs: [reference('skills', `스킬표:${skill.skill_id}`), reference('skills', `문법대응:${skill.skill_id}`)] });
    for (const id of grammarIds) edges.push({ from: id, to: skill.skill_id, type: 'part_of',
      confidence: 'authored', reviewed: false, source_refs: [reference('skills', `문법대응:${skill.skill_id}`)] });
  }
  const links = { tags: tags.map(tag => ({ tag, node: tagToSkill[tag] || null, fit: tagToSkill[tag] ? 'full' : 'none',
    confidence: 'authored', reviewed: false,
    source_refs: [reference('error_tags', `오류태그:${tag}`), reference('tag_links', `${tagToSkill[tag] ? '표' : '대응없음'}:${tag}`)] })) };
  const body = { schema_ver: 1, subject: 'ko', sources, tag_vocabulary: tags, nodes, edges, links };
  // No build timestamp: identical input produces identical bytes and version.
  const data = { map_ver: `strata-ko-1-${hash(JSON.stringify(body)).slice(0, 16)}`, ...body };
  validateMap(data);
  return data;
}

function serialize(data) { return `${JSON.stringify(data, null, 2)}\n`; }
function main(argv = process.argv.slice(2)) {
  let check = false, talkRoot;
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--check') check = true;
    else if (argv[index] === '--talk-root' && argv[index + 1] && !argv[index + 1].startsWith('--')) talkRoot = path.resolve(argv[++index]);
    else throw new TypeError('Usage: node tools/strata-build.js [--check] [--talk-root PATH]');
  }
  const map = buildMap(loadSources(talkRoot ? { talkRoot } : {}));
  const output = serialize(map), current = fs.existsSync(OUTPUT) ? normalized(fs.readFileSync(OUTPUT, 'utf8')) : null;
  if (current !== output && check) { console.error('Strata map differs from its sources. Run node tools/strata-build.js.'); return 1; }
  if (current !== output) { fs.mkdirSync(path.dirname(OUTPUT), { recursive: true }); fs.writeFileSync(OUTPUT, output, 'utf8'); }
  console.log(`${map.map_ver}: ${map.nodes.length} nodes, ${map.links.tags.length} tags (${check ? 'checked' : 'built'})`);
  return 0;
}
if (require.main === module) {
  try { process.exitCode = main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { loadSources, buildMap, serialize, main };
