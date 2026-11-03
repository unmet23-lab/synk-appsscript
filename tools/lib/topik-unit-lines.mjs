// TOPIK 3→4급 단원 글 원고(experiences/topik-units/u*.json)의 말하기 줄을 드라마 대본 꼴로 읽는다(2026-11-03).
// 대사 칸 명세 검수 도구(tools/topik-review.mjs --드라마)가 드라마 대본과 같은 단위 · 지문 · 판정으로 단원 줄을 검수하게 하려는 것이다.
// · 카페 손님 대사(cafe.frames)는 장면 대사(scene) — 손님 말 뒤에 학습자가 말하는 연습이고 평가로 세지 않는다.
// · 측정 카드(measure.B · C)는 처음 보는 대사(unseen) — 상황 카드만 보고 처음 말하는 것이라 판정이 free다(빠진 말 노트를 주지 않는다).
// · 검수 결과(검수:'passed' · 검수지문)는 원고 JSON의 그 줄에 그대로 적는다(markUnitReviewed). talk 대사 은행에는 아직 싣지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const UNIT_LINE_FILES = Object.freeze([path.join(root, 'experiences/topik-units/u14.json')]);
const SKILL = 'ko.speaking.explain';

// 층의 대표 꼴이 대사에 없고 관련형(층 셋째 칸)이 있으면 그 꼴로 적는다 — S460 「에 따라」 줄은 「에 따르면」을 쓴다(r17 검수 지적).
const grammarOf = layer => (id, line = '') => {
  const point = layer.get(id);
  if (!point) return id;
  const bare = form => form.replace(/^-/, '');
  const used = line.includes(bare(point[1])) ? null : (point[2] || []).find(form => line.includes(bare(form)));
  return used ? `${used}(${id} ${point[1]}의 관련형)` : `${point[1]}(${id})`;
};
/** 화면에 함께 보이는 자료를 한 줄 글로 — 검수자가 맞는 답 · 틀린 답을 가르려면 자료를 봐야 한다. */
export function dataText(content, key) {
  const d = content.data?.[key];
  if (key === 'menu') return '메뉴판: ' + (content.data?.menu || []).map(m => `${m.name} ${m.price}원(${m.note})`).join(' · ');
  if (!d) return null;
  if (d.tables) return `${d.title} — 학생 ${d.survey?.n}명 · ` + d.tables.map(t => `${t.q}: ` + t.rows.map(([k, v]) => `${k} ${v}${t.unit ?? '%'}`).join(' · ')).join(' / ');
  const cols = d.columns || [];
  return `${d.title} — ` + d.rows.map(r => `${r[0]} ${cols[1]} ${r[1]}명 → ${cols[2]} ${r[2]}명`).join(' · ') + (d.causes ? ' / 까닭: ' + d.causes.map(c => c.join(' — ')).join(' · ') : '');
}
const reviewOf = row => (row.검수 ? {검수: row.검수, 검수지문: row.검수지문} : {});
/** 원고 JSON 하나를 드라마 대본 꼴({id, 인물, 촬영일, 처음보는대사})로 바꾼다. */
export function unitEpisode(content, layer = defaultLayer()) {
  const cast = content.cast || {};
  const g = grammarOf(layer);
  const frames = content.cafe?.frames || [];
  const 줄 = frames.flatMap(frame => [
    {누가: frame.손님, 말: frame.손님말},
    {누가: '학생', id: frame.id, ...reviewOf(frame), 능력: SKILL, 상황: `카페 카운터 연습 — 화면 자료: ${dataText(content, frame.data)}`, 말: frame.말, 뜻: frame.모범뜻 ?? null, 문법: [g(frame.grammar, frame.말)], 명세: frame.명세},
  ]);
  const measures = ['B', 'C'].map(key => content.measure?.[key]).filter(Boolean);
  const 처음보는대사 = measures.map(card => ({id: card.id, ...reviewOf(card), 능력: card.능력, 상황: `${card.상황?.ko ?? ''} — 화면 자료: ${dataText(content, card.data)}`,
    말: card.말, 뜻: card.모범뜻 ?? null, 문법: (card.grammar || []).map(id => g(id, card.말)), 명세: card.명세}));
  return {
    id: content.unit.toLowerCase(),
    인물: Object.fromEntries(Object.entries(cast).map(([name, who]) => [name, {이름: name, 소개: who.소개, 말투: who.말투}])),
    촬영일: [{이름: `${content.unit} ${content.title} · 동아리 카페 카운터`, 장소: '캠퍼스 창업 동아리 카페', 줄}],
    처음보는대사,
  };
}
function defaultLayer() {
  const layer = JSON.parse(fs.readFileSync(path.join(root, 'strata/topik-ii.grammar.json'), 'utf8'));
  return new Map(layer.points.map(point => [point[0], point]));
}
export const readUnitEpisode = file => unitEpisode(JSON.parse(fs.readFileSync(file, 'utf8')));

/** 원고 JSON 글에서 그 줄의 검수 칸을 바꾼다 — hash가 있으면 검수:'passed' · 검수지문, null이면 지운다. 줄이 없으면 그대로. */
export function markUnitReviewed(text, marks) {
  const content = JSON.parse(text);
  const rows = [...(content.cafe?.frames || []), ...['B', 'C'].map(key => content.measure?.[key]).filter(Boolean)];
  let changed = false;
  for (const row of rows) {
    if (!marks.has(row.id)) continue;
    const hash = marks.get(row.id);
    if (hash) { if (row.검수 !== 'passed' || row.검수지문 !== hash) { row.검수 = 'passed'; row.검수지문 = hash; changed = true; } }
    else if ('검수' in row || '검수지문' in row) { delete row.검수; delete row.검수지문; changed = true; }
  }
  return changed ? JSON.stringify(content, null, 2) + '\n' : text;
}
