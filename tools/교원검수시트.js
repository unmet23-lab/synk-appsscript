#!/usr/bin/env node
'use strict';
// 교원 검수 시트 하나. 교원이 확인할 것을 원본에서 그대로 뽑아 한 표로 만든다:
// 게임 문항과 게임 글(여덟 게임), 상황 예문(Strata 예문 층), 게임↔상황 초안, 문형→능력 초안.
// 표는 여기서만 만들고, 고친 것은 원본(게임 문항 파일, strata/)에 반영한다. 표를 직접 원본으로 삼지 않는다.
//
//   node tools/교원검수시트.js                       docs/교원검수/교원검수시트.csv 를 다시 만든다
//                                                    (그 파일에 교원이 적은 줄이 있으면 멈춘다 — 빈 시트로 바꾸려면 --덮어쓰기)
//   node tools/교원검수시트.js --읽기 <검수한.csv>    검수 결과를 읽어 갈래별로 센다(고침·빼기·새 문항·원본이 바뀐 줄)
//   node tools/교원검수시트.js --읽기 <검수한.csv> --적용
//                                                    「맞음」으로 확인된 상황 예문을 예문 원천의 review.reviewed 에 적는다(id와 그 문장)
//
// 교원이 채우는 칸은 「확인」(맞음 · 고침 · 빼기), 「고친 내용」, 「메모」, 「검수자」, 「날짜」다. 새 문항은 「번호」를 비우고
// 「갈래」와 「내용」을 적은 새 줄로 넣는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const SHEET = 'docs/교원검수/교원검수시트.csv';
const APPENDIX = 'docs/교원검수/오답교정_새문항_검수부록.html';
const EXAMPLES = 'strata/topik-i.situation-examples.json';
const COLUMNS = ['번호', '갈래', '자리', '내용', '정답·보기', '풀이', '읽힌 문형', '확인', '고친 내용', '메모', '검수자', '날짜'];
const KINDS = ['게임 문항', '게임 글', '상황 예문', '게임↔상황', '문형→능력'];
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const one = value => String(value ?? '').replace(/\s*\r?\n\s*/g, ' ').trim();

// Names the story's scene shows for its ids (experiences/story-classroom/stage.mjs).
const STORY_NAMES = { narrator: '이야기', marin: '마린', kkamong: '까몽', teacher: '선생님', snacks: '과자', paper: '종이', cake: '케이크', ribbon: '리본',
  flowers: '꽃', letter: '편지', box: '상자', drawer: '서랍', table: '책상', bin: '쓰레기통', shelf: '선반', board: '칠판', floor: '바닥' };

async function buildRows() {
  const { createMap } = require('../strata');
  const { topikMap } = require('../strata/topik-i');
  const { situationExamples } = require('../strata/topik-i-examples');
  const { grammarIn, grammarOf } = require('../strata/topik-i-forms');
  const grammar = require('../strata/topik-i.grammar.json');
  const skills = require('../strata/topik-i.skills.json');
  const situations = require('../strata/topik-i.situations.json');
  const map = createMap(topikMap({ includeWords: false }));
  const pointLabel = new Map(grammar.points.map(([id, label]) => [id, label]));
  const skillLabel = new Map(skills.skills.map(([id, , label]) => [id, label]));
  const read = text => grammarIn(text).map(id => pointLabel.get(id)).join(' · ');
  const rows = [];
  const add = (id, kind, place, content, answer = '', why = '', forms = '') => rows.push({ 번호: id, 갈래: kind, 자리: one(place), 내용: one(content), '정답·보기': one(answer), 풀이: one(why), '읽힌 문형': one(forms) });

  // 빈칸 베기
  {
    const { ITEMS, PRACTICE, KIND_LABEL, SKILL_LABEL } = await load('experiences/blank-slice/content.mjs');
    for (const item of [PRACTICE, ...ITEMS]) {
      const filled = item.text.replace('{}', item.answer);
      // The point of the blank itself (as the game links it), then what the whole sentence shows.
      const blank = item.skill === 'ko.reading.grammar' ? grammarOf(item.answer, { after: item.text.slice(item.text.indexOf('{}') + 2) }) : null;
      const forms = [...new Set([blank, ...grammarIn(filled)].filter(Boolean))].map(id => pointLabel.get(id)).join(' · ');
      add(`문항/blank-slice/${item.id}`, '게임 문항', `빈칸 베기 · ${KIND_LABEL[item.kind] || item.kind} · ${SKILL_LABEL[item.skill] || item.skill}${item === PRACTICE ? ' · 연습 문장' : ''}`,
        item.text.replace('{}', `[${item.answer}]`), `정답 ${item.answer} · 보기 ${item.options.join(' / ')}`, item.why, forms);
    }
  }
  // 입장 검사
  {
    const { VENUES, CAST, ITEMS } = await load('experiences/entry-check/content.mjs');
    for (const venue of VENUES) {
      const rule = (r, memo) => add(`문항/entry-check/${venue.id}.${memo ? 'memo.' : ''}${r.id}`, '게임 문항', `입장 검사 · ${venue.name} ${memo ? `알림(${memo})` : '안내문'} · ${skillLabel.get(r.skill) || r.skill}`,
        r.text, `짧은 이름 ${r.short}`, '', read(r.text));
      for (const r of venue.notice.rules) rule(r);
      if (venue.memo) rule(venue.memo.rule, venue.memo.title);
      const short = new Map([...venue.notice.rules, ...(venue.memo ? [venue.memo.rule] : [])].map(r => [r.id, r.short]));
      for (const c of venue.cases) {
        const who = CAST[c.who];
        add(`문항/entry-check/${c.id}`, '게임 문항', `입장 검사 · ${venue.name} · 손님 ${who.name}(${who.age}살) · ${skillLabel.get(c.skill) || c.skill}`,
          `말: “${c.line}” · ${c.doc ? `${c.doc.title}: ${c.doc.rows.map(([k, v]) => `${k} ${v}`).join(', ')}` : '보여 주는 표·카드 없음'} · 짐: ${(c.items || []).map(id => ITEMS[id] || id).join(', ') || '없음'} · 시각 ${c.at}`,
          c.answer === 'pass' ? '통과' : `거절 — ${short.get(c.answer) || c.answer}`, `${c.why} / 손님 대답: ${c.reply || ''}${c.oops ? ` / 잘못 들여보냈을 때: ${c.oops}` : ''}`, read(c.line));
      }
    }
  }
  // 선생님이 돌아왔다(이야기 교실)
  {
    const { EPISODE } = await load('experiences/story-classroom/story.mjs');
    const name = id => STORY_NAMES[id] || id;
    const mission = (m, place) => add(`문항/story-classroom/${m.id}`, '게임 문항', `선생님이 돌아왔다 · ${place} · ${m.skill}`, m.text,
      `움직이는 친구 ${name(m.actor)} · 옮길 것 ${name(m.object)} · 갈 곳 ${name(m.destination)}`, m.explanation, read(m.text));
    const lines = (list, part, place) => (list || []).forEach((line, i) => add(`글/story-classroom/${part}-${i + 1}`, '게임 글', `선생님이 돌아왔다 · ${place}`, `${name(line.speaker)}: ${line.text}`, '', '', read(line.text)));
    lines(EPISODE.opening, 'opening', '여는 글');
    for (const act of EPISODE.acts) {
      lines(act.intro, `${act.id}-intro`, `${act.title} 앞 글`);
      for (const m of act.missions) mission(m, act.title);
      lines(act.outro, `${act.id}-outro`, `${act.title} 뒤 글`);
    }
    for (const m of EPISODE.review || []) mission(m, '새 글로 마지막 정리');
    lines(EPISODE.ending, 'ending', '맺는 글');
  }
  // 주문 폭주
  {
    const { ORDERS, REVIEW, describeCup } = await load('experiences/order-rush/core.mjs');
    for (const [list, place] of [[ORDERS, '주문'], [REVIEW, '새 문장 주문']]) for (const o of list) {
      add(`문항/order-rush/${o.id}`, '게임 문항', `주문 폭주 · ${place} · ${o.skill}`, o.text, o.cups.map(describeCup).join(' + '), '', read(o.text));
    }
  }
  // 바람길
  {
    const { INSTRUCTIONS, actionLabel } = await load('experiences/korean-runner/instructions.mjs');
    const { LISTENING_CHECKS } = await load('experiences/korean-runner/listening-check.mjs');
    for (const i of INSTRUCTIONS) add(`문항/korean-runner/${i.id}`, '게임 문항', `바람길 · 달리며 듣는 지시 · ${i.skill}`, i.text, i.steps.map(actionLabel).join(' → '), i.explanation, read(i.text));
    for (const c of LISTENING_CHECKS) add(`문항/korean-runner/${c.id}`, '게임 문항', `바람길 · 듣기 확인 · ${c.skill}`, c.text,
      `정답 ${c.choices[c.correct]} · 보기 ${c.choices.join(' / ')}`, c.explanation, read(c.text));
  }
  // 한국어 리듬
  {
    const { TRACKS } = await load('experiences/korean-rhythm/core.mjs');
    for (const track of TRACKS) track.questions.forEach((q, i) => {
      add(`문항/korean-rhythm/t${track.id}q${i}`, '게임 문항', `한국어 리듬 · ${track.title} · ${q.category}`, q.prompt,
        q.claims.map(c => `${c.question} → ${c.answer}`).join(' · '), q.explanation, read(q.prompt));
      if (q.recall) add(`문항/korean-rhythm/t${track.id}q${i}.recall`, '게임 문항', `한국어 리듬 · ${track.title} · ${q.category} · 다시 확인`, q.recall.prompt,
        `${q.recall.question} → ${q.recall.answer}`, '', read(q.recall.prompt));
    });
  }
  // 한국어 레이싱: 주제 단계의 낱말(나머지 단계는 낱말 목록의 순서 그대로다)
  {
    const { STAGES, WORDS } = await load('experiences/korean-racing/curriculum.js');
    const word = new Map(WORDS.map(w => [w.id, w.word]));
    for (const s of STAGES.filter(stage => stage.band === 'theme')) add(`문항/korean-racing/${s.id}`, '게임 문항', `한국어 레이싱 · ${s.number}단계 「${s.title}」 · ${s.mode === 'picture' ? '그림 보고 고르기' : '듣고 고르기'}`,
      s.words.map(id => word.get(id)).join(' · '), '주제에 맞는 낱말 다섯 개');
    const { CAMPAIGN } = await load('experiences/korean-racing/campaign.js');
    const { FINALES } = await load('experiences/korean-racing/finales.js');
    const { WORD_BY_ID } = await load('experiences/korean-racing/learning.js');
    for (const stage of [...CAMPAIGN, ...FINALES]) for (const item of stage.items) add(`문항/korean-racing/${item.id}`, '게임 문항',
      `한국어 레이싱 · ${stage.title} · ${item.mode === 'reading' ? '읽기' : '듣기'}`, `${item.passage} / 질문: ${item.prompt}`,
      `정답 ${WORD_BY_ID[item.answer].word} · 보기 ${item.options.map(id => WORD_BY_ID[id].word).join(' / ')}`, item.explanation, read(item.passage));
  }
  // SYNK Town의 안내문 읽기 확인
  {
    const { READING_CHECKS } = await load('experiences/synk-town/understanding.mjs');
    for (const item of READING_CHECKS) add(`문항/synk-town/${item.id}`, '게임 문항', `SYNK Town · 안내문 읽기 · ${item.skill}`,
      `${item.passage} / 질문: ${item.question}`, `정답 ${item.choices[item.correct]} · 보기 ${item.choices.join(' / ')}`, item.explanation, read(item.passage));
  }
  // 말 랠리
  {
    const { ITEMS, PRACTICE, KIND_LABEL, SKILL_LABEL } = await load('experiences/talk-rally/content.mjs');
    for (const item of [PRACTICE, ...ITEMS]) add(`문항/talk-rally/${item.id}`, '게임 문항', `말 랠리 · ${KIND_LABEL[item.kind] || item.kind} · ${SKILL_LABEL[item.skill] || item.skill}${item === PRACTICE ? ' · 연습 공' : ''}`,
      item.line, `정답 ${item.answer} · 보기 ${item.options.join(' / ')}`, item.why, read(item.line));
  }

  const { REASON_WORDS, WORLD_GAMES } = await load('experiences/synk-account/src/atlas-words.mjs');
  const situation = new Map(situations.situations.map(([id, reason, label, when]) => [id, { reason, label, when }]));
  // 상황 예문
  for (const { situation: id, examples } of situationExamples(map, { grammarIn }).all()) {
    const s = situation.get(id);
    for (const e of examples) add(`예문/${e.id}`, '상황 예문', `${REASON_WORDS[s.reason] || s.reason} · ${s.label} — ${s.when} 쓰는 말`, e.ko,
      e.from ? `게임 문항 글 그대로(${e.from})` : '새로 쓴 초안', e.reviewed ? '교원 확인을 마친 문장' : '', e.grammar.map(point => pointLabel.get(point)).join(' · '));
  }
  // 게임↔상황 초안: 그 게임의 연습이 곧 그 상황인가
  {
    const sample = prefix => rows.filter(r => r.번호.startsWith(prefix) && r.갈래 === '게임 문항').slice(0, 3).map(r => r.내용).join(' / ');
    for (const game of WORLD_GAMES) {
      if (!game.situations.length) { add(`게임상황/${game.path}/없음`, '게임↔상황', game.label, `${game.label}: 한 상황으로 묶지 않는다(여러 일상 주제를 고루 다룬다).`, '이 게임에 맞는 상황이 있으면 메모에 적어 주세요', '', ''); continue; }
      for (const id of game.situations) {
        const s = situation.get(id);
        add(`게임상황/${game.path}/${id}`, '게임↔상황', game.label, `${game.label}의 연습 = 「${s.label}」 — ${s.when} 쓰는 말 (${REASON_WORDS[s.reason] || s.reason})`, `이 게임의 문장: ${sample(`문항/${game.path}/`)}`, '', '');
      }
    }
  }
  // 문형→능력 초안
  for (const [id, label, forms, step, pointSkills, basis] of grammar.points) {
    add(`문형능력/${id}`, '문형→능력', `${step}단계 · ${basis === undefined ? '문법 은행 순서' : '표준 교육과정 등급'}`, `${label} → ${pointSkills.map(skill => skillLabel.get(skill) || skill).join(' · ')}`,
      `형태 ${forms.join(', ')}`, '', '');
  }
  const ids = new Set();
  for (const row of rows) { if (!row.내용 || ids.has(row.번호) || !KINDS.includes(row.갈래)) throw new Error(`교원 검수 시트: 잘못된 줄 ${row.번호}`); ids.add(row.번호); }
  return rows;
}

// The original feedback functions and next-item selectors run on isolated synthetic
// memory. This is a teacher's content/connection review packet, never student evidence.
async function buildFeedbackReview() {
  const { createGame } = require('../atlas/game-browser');
  const fresh = gameId => { const memory = new Map(); let at = Date.parse('2026-10-07T00:00:00Z'); return createGame({ gameId, fold: false,
    storage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }, clock: () => new Date(at += 1000).toISOString() }); };
  const answer = (coach, metadata, correct) => { const pid = coach.present(metadata); if (metadata.audioRequired) coach.delivery(pid, { audio: 'completed' }); return coach.answer(pid, { correct, assessable: true }); };
  const activities = [];
  const activity = (gameId, label, files) => { const value = { gameId, label, sourceFiles: files.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') })), items: [], pairs: [] }; activities.push(value); return value; };
  const pair = (activity, id, coach, source, sourceResult, follow, target, metadata) => {
    const targetMetadata = target ? metadata(target) : null;
    const measured = follow.status === 'new' && target ? coach.recheck(sourceResult.eventId, answer(coach, targetMetadata, true).eventId) : null;
    activity.pairs.push({ id, sourceId: source.id, targetId: target?.id || null, status: follow.status, line: follow.line || '',
      sourceMetadata: metadata(source), targetMetadata, measured: measured ? { status: measured.status, line: measured.line, learningEffectClaim: measured.learningEffectClaim } : null });
  };
  {
    const { VENUES, ITEMS } = await load('experiences/entry-check/content.mjs');
    const { choicesFor, activeRules, composeShift } = await load('experiences/entry-check/core.mjs');
    const { caseMetadata } = await load('experiences/entry-check/learning.mjs');
    const { choiceId, choiceCorrection, immediateCheck } = await load('experiences/entry-check/correction.mjs');
    const a = activity('entry-check', '입장 검사', ['experiences/entry-check/content.mjs', 'experiences/entry-check/core.mjs', 'experiences/entry-check/learning.mjs', 'experiences/entry-check/correction.mjs']);
    for (const venue of VENUES) {
      for (const item of venue.cases) {
        const rules = activeRules(venue, item.at), label = id => id === 'pass' ? '통과' : `거절: ${rules.find(rule => rule.id === id)?.text || id}`;
        a.items.push({ id: item.id, metadata: caseMetadata(item), prompt: `${venue.name} · ${item.at} · ${item.line}`,
          context: [`안내: ${rules.map(rule => rule.text).join(' / ')}`, item.doc ? `${item.doc.title}: ${item.doc.rows.map(([key, value]) => `${key} ${value}`).join(' / ')}` : '표·카드 없음', `짐: ${(item.items || []).map(value => { const [id, count] = Array.isArray(value) ? value : [value, 1]; return `${ITEMS[id] || id}${count > 1 ? ` ${count}개` : ''} (${id})`; }).join(' / ') || '없음'}`, `원고 근거: ${item.evidence.join(', ')}`, item.followupOnly ? '글 전용 후속 확인 원고' : '기본 근무 원고'].join('\n'), explanation: item.why,
          choices: choicesFor(venue, item.at).map(id => ({ id: choiceId(id), label: label(id), correct: id === item.answer, feedback: choiceCorrection(venue, item, id) })) });
      }
      const queue = composeShift(venue, { firstTime: false });
      for (let index = 0; index < queue.length; index++) {
        const coach = fresh('entry-check'); for (const earlier of queue.slice(0, index)) answer(coach, caseMetadata(earlier), true);
        const source = queue[index], recorded = answer(coach, caseMetadata(source), false);
        const follow = immediateCheck({ venue, queue, index, item: source, coach });
        pair(a, `${venue.id}.default-${index + 1}`, coach, source, recorded, follow, follow.item, caseMetadata);
      }
    }
  }
  {
    const { LISTENING_CHECKS, checkMetadata, listeningCheckFeedback, createListeningCheckRound, createListeningCheck } = await load('experiences/korean-runner/listening-check.mjs');
    const a = activity('korean-runner', '바람길 듣기 확인', ['experiences/korean-runner/listening-check.mjs', 'experiences/korean-runner/instructions.mjs']);
    for (const item of LISTENING_CHECKS) a.items.push({ id: item.id, metadata: checkMetadata(item), prompt: item.text, context: '실제 화면에서는 최초 응답 뒤 문장을 보여 줌. 선택 전에 필수 음성을 끝까지 들음.', explanation: item.explanation,
      choices: item.choices.map((label, selected) => ({ id: item.choiceIds[selected], label, correct: selected === item.correct, feedback: listeningCheckFeedback(item, selected).correction || '' })) });
    for (const skillId of [...new Set(LISTENING_CHECKS.map(item => checkMetadata(item).skillId))]) {
      const pool = LISTENING_CHECKS.filter(item => checkMetadata(item).skillId === skillId), coach = fresh('korean-runner');
      const assignment = { ...checkMetadata(pool[0]), familyKeys: pool.map(item => checkMetadata(item).familyKey), itemKeys: pool.map(item => checkMetadata(item).itemKey), requiredAttempts: 3 };
      const round = createListeningCheckRound(coach, { assignment }), first = round.next(), check = createListeningCheck(coach);
      const token = check.begin(first.item); check.delivery(token, 'completed'); const recorded = check.answer((first.item.correct + 1) % first.item.choices.length);
      const follow = round.next(check.current); pair(a, skillId, coach, first.item, recorded, { status: follow.followup?.status || follow.status, line: follow.note }, follow.item, checkMetadata);
    }
  }
  {
    const { CAMPAIGN } = await load('experiences/korean-racing/campaign.js');
    const { FINALES } = await load('experiences/korean-racing/finales.js');
    const { WORD_BY_ID, answerFeedback } = await load('experiences/korean-racing/learning.js');
    const { racingItem, racingFollowUp } = await load('experiences/korean-racing/personalization.js');
    const a = activity('korean-racing', '한국어 레이싱 문장 코스·피날레', ['experiences/korean-racing/campaign.js', 'experiences/korean-racing/finales.js', 'experiences/korean-racing/learning.js', 'experiences/korean-racing/personalization.js']);
    for (const stage of [...CAMPAIGN, ...FINALES]) {
      for (const item of stage.items) a.items.push({ id: item.id, metadata: racingItem(item), prompt: `${item.passage}\n${item.prompt}`, context: `${stage.title} · ${item.mode === 'reading' ? '읽기 지문 표시' : '필수 음성 완료 조건'}`, explanation: item.explanation,
        choices: item.options.map(id => ({ id, label: WORD_BY_ID[id].word, correct: id === item.answer, feedback: answerFeedback(item, id) })) });
      const coach = fresh('korean-racing'), source = stage.items[0], recorded = answer(coach, racingItem(source), false);
      const follow = racingFollowUp(coach, { current: source, remaining: stage.items.slice(1), stage });
      pair(a, stage.id, coach, source, recorded, follow, follow.status === 'new' ? follow.remaining[0] : null, racingItem);
    }
  }
  {
    const { READING_CHECKS, readingMetadata, readingFeedback, selectReadingChecks, readingFollowUp } = await load('experiences/synk-town/understanding.mjs');
    const a = activity('synk-town', 'SYNK Town 안내문 읽기', ['experiences/synk-town/understanding.mjs']);
    for (const item of READING_CHECKS) a.items.push({ id: item.id, metadata: readingMetadata(item), prompt: `${item.passage}\n${item.question}`, context: `문항 도움: ${item.hint}`, explanation: item.explanation,
      choices: item.choices.map((label, selected) => ({ id: `option-${selected}`, label, correct: selected === item.correct, feedback: readingFeedback(item, selected) })) });
    for (const skill of [...new Set(READING_CHECKS.map(item => item.skill))]) {
      const pool = READING_CHECKS.filter(item => item.skill === skill), coach = fresh('synk-town');
      coach.assignment = () => ({ ...readingMetadata(pool[0]), familyKeys: pool.map(item => readingMetadata(item).familyKey), itemKeys: pool.map(item => readingMetadata(item).itemKey), requiredAttempts: 3 });
      const round = selectReadingChecks(coach), source = round[0], recorded = answer(coach, readingMetadata(source), false), follow = readingFollowUp(coach, source, round, 0);
      pair(a, skill, coach, source, recorded, follow, follow.item, readingMetadata);
    }
  }
  for (const activity of activities) {
    const first = activity.pairs.find(pair => pair.status === 'new'); activity.resultLines = [];
    if (first) for (const helped of [false, true]) for (const correct of [false, true]) {
      const coach = fresh(activity.gameId), source = answer(coach, first.sourceMetadata, false), pid = coach.present(first.targetMetadata);
      if (first.targetMetadata.audioRequired) coach.delivery(pid, { audio: 'completed' });
      if (helped) coach.help(pid, 'hint');
      const target = coach.answer(pid, { correct, assessable: true }), observed = coach.recheck(source.eventId, target.eventId);
      activity.resultLines.push({ status: observed.status, line: observed.line });
    }
  }
  const sourceFiles = ['atlas/game-learning.js', 'atlas/trail.js', 'atlas/learning.js'].map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') }));
  return { version: 'teacher-feedback-review-1', reviewStatus: 'awaiting-teacher-review', studentData: false, learningEffectClaim: false, sourceFiles, activities };
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
function feedbackHtml(packet) {
  const e = escapeHtml, font = require('./lib/브랜드폰트').블록();
  const review = '<p class="review">확인(맞음 / 고침 / 빼기): __________　검수자·날짜: __________<br>고친 내용·메모: __________________________________________________________</p>';
  const metadata = item => `${item.skillId} · 난도 ${item.difficulty} · ${item.modality} · ${item.responseFormat}\nitemKey: ${item.itemKey}\nfamilyKey: ${item.familyKey}${item.conceptIds?.length ? `\n내용 태그: ${item.conceptIds.join(', ')}` : ''}`;
  const body = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오답 교정·새 문항 연결 교원 검수 부록</title>${font}<style>body{font-family:'SUIT Variable',sans-serif;color:#222;background:#fff;max-width:1000px;margin:32px auto;padding:0 20px;line-height:1.65}h1{font-size:26px}h2{font-size:22px;border-bottom:2px solid #444;padding-top:24px}h3{font-size:18px;margin-bottom:8px}article{border-top:1px solid #ccc;padding:14px 0;break-inside:avoid}p{white-space:pre-wrap;overflow-wrap:anywhere}.meta,small{font-size:13px;color:#555}.review{border-left:3px solid #bbb;padding:8px 12px;color:#333;min-height:52px}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #ddd;padding:8px;overflow-wrap:anywhere}th{background:#f1f1f1}.source{font-size:12px}a{color:#245878}@media(max-width:600px){body{padding:0 12px;margin:16px auto}table{font-size:13px}th,td{padding:6px}}@media print{body{max-width:none;margin:0;font-size:11px}h1{font-size:20px}h2{break-before:page}a{color:inherit;text-decoration:none}.review{min-height:64px}}</style></head><body><h1>오답 교정·새 문항 연결 교원 검수 부록</h1>
<p>검수 대기. 실제 문항과 선택별 교정 글을 원본 함수에서 추출했습니다. 아래 연결쌍은 실제 선택 함수를 합성 메모리에서 실행한 대표 사례입니다. 학생 기록은 없습니다. 학생의 학습 효과나 교원 승인을 뜻하지 않습니다.</p>
<p>검토할 것: 정답이 하나인지, 교정 글이 고른 답과 원문에 맞는지, 후속 문항이 같은 측정 목표·난도·입력·응답형식을 유지하는지, 내용 태그가 달라질 때 같은 표현을 확인한다고 말해도 되는지. 교정의 원인 효과를 추론하지 않습니다.</p>
<p>입장 검사 연결은 연수 이후 기본 구성(firstTime:false), 별도 과제·순위 없음으로 계산합니다. 끝 손님을 포함한 24위치 중 새 연결 16개이며, 끝 4곳을 뺀 분모에서는 16/20입니다. 네 근무지 모두 초회 옵션을 적용한 별도 합성 비교(18/20)와 구성·분모가 다릅니다. 실제 노출과 응답 순서에 따른 결과를 보장하지 않습니다.</p>
<p>빈 검수란에 인쇄하여 적거나 다른 이름의 작성본으로 기록해 주세요. 이 HTML은 입력 저장 기능이 없습니다. CSV 문항 승인은 교원검수시트.csv의 같은 문항 번호로 적고, 부록의 교정·연결 의견은 아래 번호로 별도 작성본에 남깁니다.</p>
<nav>${packet.activities.map(a => `<a href="#${e(a.gameId)}">${e(a.label)}</a>`).join(' · ')}</nav>
<details><summary>공통 판독 코드·SHA-256</summary>${packet.sourceFiles.map(source => `<p class="source">${e(source.file)}<br>${e(source.sha256)}</p>`).join('')}</details>
${packet.activities.map(a => `<section id="${e(a.gameId)}"><h2>${e(a.label)}</h2><p>문항 ${a.items.length}개 · 오답별 교정 ${a.items.reduce((n, item) => n + item.choices.filter(choice => !choice.correct).length, 0)}개 · 합성 대표 연결 ${a.pairs.length}개(새 문항 ${a.pairs.filter(pair => pair.status === 'new').length}개)</p>
<details><summary>원본 경로·SHA-256</summary>${a.sourceFiles.map(source => `<p class="source">${e(source.file)}<br>${e(source.sha256)}</p>`).join('')}</details>
<h3>새 문항 결과 표시 문구</h3><p>같은 실제 문항쌍의 합성 응답 조건을 바꿔 추출했습니다. 도움·정오 구분의 뜻과 표현을 검토해 주세요.</p>${a.resultLines.map(result => `<p>${e(result.status)}: ${e(result.line)}</p>`).join('')}${review}
${a.items.map(item => `<article id="item-${e(a.gameId)}-${e(item.id)}"><h3>문항/${e(a.gameId)}/${e(item.id)}</h3><p>${e(item.prompt)}</p><p>${e(item.context)}</p><p class="meta">${e(metadata(item.metadata))}</p><p>원문 풀이: ${e(item.explanation)}</p><table><thead><tr><th>선택 ID·보기</th><th>정오</th><th>실제 교정·피드백</th></tr></thead><tbody>${item.choices.map(choice => `<tr><td>${e(choice.id)}<br>${e(choice.label)}</td><td>${choice.correct ? '정답' : '오답'}</td><td>${e(choice.feedback) || '추가 교정문 없음'}</td></tr>`).join('')}</tbody></table>${review}</article>`).join('')}
<h3>합성 대표 후속 연결</h3><p>조건: 이전 문항은 첫 오답, 도움 없이 응답. Runner·Racing 필수 음성은 완료로 기록하는 합성 조건입니다. 새 문항이 선택되면 첫 응답을 정답으로 가정하여 공통 recheck의 표시도 추출했습니다. 연결 불가·회차 끝도 남깁니다. 실제 이력·선택 순서·목표 지정에 따라 연결은 바뀌며 모든 가능한 쌍을 열거한 것은 아닙니다.</p>
${a.pairs.map(pair => `<article><h3>연결/${e(a.gameId)}/${e(pair.id)}</h3><p><a href="#item-${e(a.gameId)}-${e(pair.sourceId)}">${e(pair.sourceId)}</a> → ${pair.targetId ? `<a href="#item-${e(a.gameId)}-${e(pair.targetId)}">${e(pair.targetId)}</a>` : '다음 새 문항 없음'} · 선택 결과 ${e(pair.status)}</p><p>${e(pair.line)}</p><p class="meta">이전: ${e(metadata(pair.sourceMetadata))}${pair.targetMetadata ? `\n다음: ${e(metadata(pair.targetMetadata))}` : ''}</p>${pair.measured ? `<p>합성 응답 표시(${e(pair.measured.status)}): ${e(pair.measured.line)}</p>` : ''}${review}</article>`).join('')}</section>`).join('')}
</body></html>\n`;
  return `<!-- generated-teacher-review-sha256:${crypto.createHash('sha256').update(body).digest('hex')} -->\n${body}`;
}

// Manual edits (including a filled review line) are never replaced, even when the
// source changed. A teacher's written copy remains under another filename.
function writeFeedbackAppendix(html, target, { dryRun = false } = {}) {
  if (fs.existsSync(target)) {
    const before = fs.readFileSync(target, 'utf8'); if (before === html) return 'same';
    const match = /^<!-- generated-teacher-review-sha256:([a-f0-9]{64}) -->\r?\n([\s\S]*)$/.exec(before);
    if (!match || crypto.createHash('sha256').update(match[2]).digest('hex') !== match[1]) throw new Error(`교원 검수 부록: ${path.basename(target)} 에 수작업 변경이 있어 보존했다. 작성본을 다른 이름으로 두고 생성한다.`);
  }
  if (dryRun) return 'ready';
  fs.mkdirSync(path.dirname(target), { recursive: true }); const temporary = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, html); fs.renameSync(temporary, target); return 'written';
}

// RFC 4180, every field quoted. Excel reads the byte order mark as UTF-8. A value a spreadsheet would
// take for a formula (-고 싶다, =…) gets a leading space, which reading trims again: without it Excel
// shows #NAME? in those cells and saves that back.
const BOM = String.fromCharCode(0xfeff);
const cell = value => { const text = String(value ?? ''); return `"${(/^[=+\-@]/.test(text) ? ` ${text}` : text).replace(/"/g, '""')}"`; };
function toCsv(rows) {
  return BOM + [COLUMNS, ...rows.map(row => COLUMNS.map(column => row[column] ?? ''))].map(line => line.map(cell).join(',')).join('\r\n') + '\r\n';
}
function parseCsv(text) {
  const raw = String(text), source = raw.startsWith(BOM) ? raw.slice(1) : raw, table = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') { if (source[i + 1] === '"') { field += '"'; i += 1; } else quoted = false; } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && source[i + 1] === '\n') i += 1; row.push(field); field = ''; table.push(row); row = []; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); table.push(row); }
  const [head, ...body] = table.filter(line => line.some(value => value.trim() !== ''));
  if (!head || !['번호', '갈래', '내용', '확인'].every(column => head.includes(column))) throw new Error('교원 검수 시트: 머리 줄에 번호·갈래·내용·확인 칸이 있어야 한다');
  return body.map(line => Object.fromEntries(head.map((column, i) => [column.trim(), (line[i] ?? '').trim()])));
}

const VERDICT = new Map([['맞음', 'ok'], ['확인', 'ok'], ['o', 'ok'], ['ㅇ', 'ok'], ['ok', 'ok'], ['고침', 'fix'], ['수정', 'fix'], ['빼기', 'drop'], ['삭제', 'drop'], ['', 'open']]);
// What a reviewed sheet says, against the sources as they are now. Nothing a teacher wrote is dropped
// silently: a row whose source changed after the sheet was made is not counted as reviewed (its verdict
// was given to other words) and is listed; so is a row with a note or a corrected text but no verdict,
// and a number that comes twice. 「맞음」 with a corrected text is a correction, not a confirmation.
function review(reviewedRows, currentRows) {
  const current = new Map(currentRows.map(row => [row.번호, row]));
  const report = { counts: {}, fixes: [], drops: [], added: [], changed: [], noted: [], duplicates: [], unknown: [], unclear: [], confirmedExamples: [] };
  for (const kind of KINDS) report.counts[kind] = { 모두: currentRows.filter(row => row.갈래 === kind).length, 맞음: 0, 고침: 0, 빼기: 0, 아직: 0 };
  const seen = new Set();
  for (const row of reviewedRows) {
    if (!row.번호) { if (row.내용) report.added.push({ 갈래: row.갈래 || '', 자리: row.자리 || '', 내용: row.내용, '정답·보기': row['정답·보기'] || '', 메모: row.메모 || '' }); continue; }
    const now = current.get(row.번호);
    if (!now) { report.unknown.push(row.번호); continue; }
    if (seen.has(row.번호)) { report.duplicates.push({ 번호: row.번호, 확인: row.확인 || '' }); continue; }
    seen.add(row.번호);
    const verdict = VERDICT.get((row.확인 || '').trim().toLowerCase());
    if (verdict === undefined) { report.unclear.push({ 번호: row.번호, 확인: row.확인 }); continue; }
    const changedColumns = ['갈래', '자리', '내용', '정답·보기', '풀이', '읽힌 문형'].filter(column => one(row[column]) !== one(now[column]));
    const fixed = row['고친 내용'] || '', memo = row.메모 || '', edited = changedColumns.length > 0;
    if (verdict === 'open') {
      if (fixed || memo || edited) report.noted.push({ 번호: row.번호, 지금: now.내용, 시트: edited ? row.내용 : '', 고친: fixed, 메모: memo });
      continue;
    }
    if (edited) { report.changed.push({ 번호: row.번호, 시트: row.내용, 지금: now.내용, 확인: row.확인,
      ...(changedColumns.some(column => column !== '내용') ? { 바뀐칸: changedColumns } : {}) }); continue; }
    const count = report.counts[now.갈래];
    if (verdict === 'fix' || (verdict === 'ok' && fixed)) { count.고침 += 1; report.fixes.push({ 번호: row.번호, 지금: now.내용, 고친: fixed, 메모: memo }); }
    else if (verdict === 'ok') { count.맞음 += 1; if (now.갈래 === '상황 예문') report.confirmedExamples.push({ id: row.번호.slice('예문/'.length), ko: now.내용 }); }
    else { count.빼기 += 1; report.drops.push({ 번호: row.번호, 지금: now.내용, 메모: memo }); }
  }
  for (const kind of KINDS) { const c = report.counts[kind]; c.아직 = c.모두 - c.맞음 - c.고침 - c.빼기; }
  return report;
}

// Writes the confirmed sentences into the example layer's review.reviewed (id → the sentence that was
// confirmed, in the source's order) without reflowing the hand-formatted file. A sentence that has
// changed since it was confirmed is refused; an older entry whose sentence has changed is dropped.
// Before writing, the result is parsed: only review.reviewed may differ.
function applyConfirmedExamples(confirmed, file = path.join(root, EXAMPLES)) {
  const text = fs.readFileSync(file, 'utf8'), data = JSON.parse(text), eol = text.includes('\r\n') ? '\r\n' : '\n';
  const sentence = new Map(Object.values(data.examples).flat().map(([id, ko]) => [id, ko]));
  const strangers = confirmed.filter(c => !sentence.has(c.id));
  if (strangers.length) throw new Error(`교원 검수 시트: 예문이 아닌 번호 ${strangers.map(c => c.id).join(', ')}`);
  const stale = confirmed.filter(c => sentence.get(c.id) !== c.ko);
  if (stale.length) throw new Error(`교원 검수 시트: 확인한 문장이 지금 원천과 다르다 ${stale.map(c => c.id).join(', ')}`);
  const before = data.review.reviewed, next = {};
  for (const [id, ko] of sentence) if (confirmed.some(c => c.id === id) || before[id] === ko) next[id] = ko;
  const entries = Object.entries(next);
  const literal = entries.length ? `{${eol}${entries.map(([id, ko]) => `    ${JSON.stringify(id)}: ${JSON.stringify(ko)}`).join(`,${eol}`)}${eol}  }` : '{}';
  const pattern = /"reviewed":\s*\{[^}]*\}/;
  if (!pattern.test(text)) throw new Error('교원 검수 시트: 예문 원천에서 review.reviewed 를 찾지 못했다');
  const updated = text.replace(pattern, () => `"reviewed": ${literal}`);
  const expected = JSON.parse(text); expected.review.reviewed = next;
  if (JSON.stringify(JSON.parse(updated)) !== JSON.stringify(expected)) throw new Error('교원 검수 시트: 예문 원천의 review.reviewed 말고 다른 곳이 바뀌려 했다 — 쓰지 않았다');
  if (updated !== text) { const temporary = `${file}.tmp-${process.pid}`; fs.writeFileSync(temporary, updated); fs.renameSync(temporary, file); }
  return { reviewed: entries.length, added: entries.filter(([id]) => before[id] !== next[id]).length };
}

// Writes the blank sheet. A sheet a teacher has written in is never replaced by a blank one in passing:
// a reviewed file belongs under another name, read with --읽기.
function writeSheet(rows, target, overwrite = false) {
  const csv = toCsv(rows);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target) && fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') === csv.replace(/\r\n/g, '\n')) return 'same';
  if (fs.existsSync(target) && !overwrite) {
    let written;
    try { written = parseCsv(fs.readFileSync(target, 'utf8')).filter(row => row.확인 || row['고친 내용'] || row.메모 || row.검수자 || row.날짜
      || !row.번호 && row.내용 || Object.entries(row).some(([column, value]) => !COLUMNS.includes(column) && value)).length; } catch { written = -1; }
    if (written) throw new Error(written > 0 ? `교원 검수 시트: ${path.basename(target)} 에 교원이 적은 줄이 ${written}개 있다. 검수한 파일은 다른 이름으로 두고 --읽기 로 읽는다. 빈 시트로 바꾸려면 --덮어쓰기`
      : `교원 검수 시트: ${path.basename(target)} 를 읽지 못했다. 빈 시트로 바꾸려면 --덮어쓰기`);
  }
  const temporary = `${target}.tmp-${process.pid}`; fs.writeFileSync(temporary, csv); fs.renameSync(temporary, target);
  return 'written';
}

async function main() {
  const args = process.argv.slice(2), readAt = args.indexOf('--읽기');
  const known = (a, i) => ['--읽기', '--적용', '--덮어쓰기'].includes(a) || (readAt >= 0 && i === readAt + 1);
  if (!args.every(known) || (args.includes('--적용') && readAt < 0) || (args.includes('--덮어쓰기') && readAt >= 0)) throw new Error('쓰는 법: node tools/교원검수시트.js [--덮어쓰기] | --읽기 <검수한.csv> [--적용]');
  const rows = await buildRows();
  if (readAt < 0) {
    const packet = await buildFeedbackReview(), html = feedbackHtml(packet), appendix = path.join(root, APPENDIX);
    writeFeedbackAppendix(html, appendix, { dryRun: true });
    const same = writeSheet(rows, path.join(root, SHEET), args.includes('--덮어쓰기')) === 'same';
    console.log(`${same ? '그대로' : '다시 만듦'} ${SHEET} · ${rows.length}줄 (${KINDS.map(kind => `${kind} ${rows.filter(row => row.갈래 === kind).length}`).join(' · ')})`);
    const result = writeFeedbackAppendix(html, appendix); console.log(`${result === 'same' ? '그대로' : '만듦'} ${APPENDIX} · 교원 검수 대기 · 문항 ${packet.activities.reduce((n, activity) => n + activity.items.length, 0)}개 · 합성 연결 ${packet.activities.reduce((n, activity) => n + activity.pairs.length, 0)}개`);
    return;
  }
  const file = args[readAt + 1];
  if (!file) throw new Error('--읽기 뒤에 검수한 CSV 파일을 적는다');
  const report = review(parseCsv(fs.readFileSync(path.resolve(file), 'utf8')), rows);
  for (const kind of KINDS) { const c = report.counts[kind]; console.log(`${kind}: 모두 ${c.모두} · 맞음 ${c.맞음} · 고침 ${c.고침} · 빼기 ${c.빼기} · 아직 ${c.아직}`); }
  const list = (title, items, show) => { if (items.length) { console.log(`\n${title} ${items.length}`); for (const item of items) console.log(`  ${show(item)}`); } };
  list('고침', report.fixes, f => `${f.번호}: 「${f.지금}」 → 「${f.고친}」${f.메모 ? ` (${f.메모})` : ''}`);
  list('빼기', report.drops, d => `${d.번호}: 「${d.지금}」${d.메모 ? ` (${d.메모})` : ''}`);
  list('새 문항', report.added, a => `[${a.갈래}] ${a.자리 ? `${a.자리} · ` : ''}${a.내용}${a['정답·보기'] ? ` · ${a['정답·보기']}` : ''}`);
  list('「확인」은 비었는데 적은 것이 있는 줄(세지 않음 — 확인 칸을 채워 다시 읽는다)', report.noted, n => `${n.번호}: 「${n.지금}」${n.시트 ? ` · 시트의 내용 「${n.시트}」` : ''}${n.고친 ? ` · 고친 내용 「${n.고친}」` : ''}${n.메모 ? ` · 메모 ${n.메모}` : ''}`);
  list('시트를 만든 뒤 원본이 바뀐 줄(다시 확인)', report.changed, c => `${c.번호}: 시트 「${c.시트}」 · 지금 「${c.지금}」${c.바뀐칸 ? ` · 다시 볼 칸: ${c.바뀐칸.join(', ')}` : ''}`);
  list('「확인」 칸을 읽지 못한 줄', report.unclear, u => `${u.번호}: ${u.확인}`);
  list('두 번 나온 번호(첫 줄만 셈)', report.duplicates, d => `${d.번호}${d.확인 ? `: 둘째 줄의 확인 ${d.확인}` : ''}`);
  list('모르는 번호', report.unknown, u => u);
  if (args.includes('--적용')) { const result = applyConfirmedExamples(report.confirmedExamples); console.log(`\n예문 원천에 반영: 확인된 문장 ${result.reviewed}개(이번에 ${result.added}개). 고침·빼기·새 문항은 위 목록을 보고 원본에서 고친다.`); }
  else if (report.confirmedExamples.length) console.log(`\n「맞음」인 상황 예문 ${report.confirmedExamples.length}개 — --적용 을 붙이면 예문 원천에 적는다.`);
}

module.exports = { buildRows, buildFeedbackReview, feedbackHtml, writeFeedbackAppendix, toCsv, parseCsv, review, applyConfirmedExamples, writeSheet, COLUMNS, KINDS, SHEET, APPENDIX };
if (require.main === module) main().catch(error => { console.error(error.message); process.exit(1); });
