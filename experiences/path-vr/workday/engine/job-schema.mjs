/** Scene-table checks for a workday job. A job is data only: adding one must never need code.
 * validateJob() returns every problem it finds so a broken table is fixed in one pass, and the
 * page refuses to open a job that fails. No network, no DOM. */
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STEP_TYPES = new Set(['line', 'say', 'tour', 'note', 'move', 'report', 'work', 'relay']);
// The tools a work step can show (상향판 기준 1): a work screen, a paper, a phone, a chat window.
export const TOOL_KINDS = Object.freeze(['screen', 'paper', 'phone', 'chat']);
// Words a pre-registration service must not put on screen or on the record (design 4-10).
// A job that needs one as a workplace term lists the whole term in job.allowedTerms.
export const FORBIDDEN_RECORD_WORDS = Object.freeze(['추천', '적합', '합격', '검증', '보장', '점수', '등급']);

const text = (value) => typeof value === 'string' && value.trim().length > 0;
const plain = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const list = (value) => (Array.isArray(value) ? value : []);
// A path with spaces around it is refused: a browser drops them and could read ' https:…' as another site.
const localFile = (value, extension) => text(value) && value === value.trim() && !/^[a-z]+:|^\/|\.\.|\\/i.test(value) && extension.test(value);

export function validateJob(job, manifest = null) {
  const errors = [];
  if (!plain(job)) return { ok: false, errors: ['job: 장면표가 객체가 아니에요.'] };
  try { check(job, manifest, (where, message) => errors.push(`${where}: ${message}`)); }
  catch { errors.push('job: 장면표 꼴이 맞지 않아 끝까지 읽지 못했어요. 위 항목부터 고쳐 주세요.'); }
  return { ok: errors.length === 0, errors };
}

function check(job, manifest, fail) {
  if (job.schemaVersion !== 1) fail('schemaVersion', '1이어야 해요.');
  if (!ID.test(job.id || '')) fail('id', '소문자, 숫자, 하이픈으로 적어요.');
  for (const key of ['edition', 'title', 'role', 'summary']) if (!text(job[key])) fail(key, '빈 글이에요.');
  if (!(Number.isFinite(job.minutes) && job.minutes > 0)) fail('minutes', '걸리는 분을 숫자로 적어요.');
  if (job.reviewNote !== undefined && !text(job.reviewNote)) fail('reviewNote', '검토 상태 글이 비었어요.');
  const languages = list(job.hintLanguages);
  if (!Array.isArray(job.hintLanguages) || languages.some((code) => !/^[a-z]{2}$/.test(code)) || new Set(languages).size !== languages.length) fail('hintLanguages', '두 글자 언어 코드를 겹치지 않게 적어요.');
  const hinted = (where, hint) => {
    if (!languages.length) return;
    if (!plain(hint)) { fail(where, '힌트가 없어요.'); return; }
    for (const code of languages) if (!text(hint[code])) fail(where, `힌트 언어 ${code}가 비었어요.`);
  };
  // Words written in every hint language and English: a foreign guest's words, their name, a tool
  // cell in their language. The page shows the learner's hint language, or English if none was chosen.
  const everyLanguage = [...new Set([...languages, 'en'])];
  const localized = (value) => plain(value) && everyLanguage.every((code) => text(value[code]));
  const cell = (value) => text(value) || localized(value);
  const cast = plain(job.cast) ? job.cast : {};
  if (!plain(job.cast) || !Object.keys(cast).length) fail('cast', '인물이 없어요.');
  for (const [id, person] of Object.entries(cast)) {
    if (!ID.test(id) || !text(person?.name) || !text(person?.role)) fail(`cast.${id}`, '이름과 역할이 필요해요.');
    if (person?.names !== undefined && !localized(person.names)) fail(`cast.${id}`, `names에는 ${everyLanguage.join(', ')}를 모두 적어요.`);
  }
  const places = plain(job.places) ? job.places : {};
  if (!plain(job.places) || !Object.keys(places).length) fail('places', '자리가 없어요.');
  const notes = plain(job.notes) ? job.notes : {};
  for (const [id, note] of Object.entries(notes)) {
    if (!ID.test(id) || !text(note?.title)) fail(`notes.${id}`, '제목이 필요해요.');
    if (!Array.isArray(note?.body) && !Array.isArray(note?.rows)) fail(`notes.${id}`, 'body나 rows가 필요해요.');
    if (list(note?.body).some((row) => !text(row)) || list(note?.rows).some((row) => !Array.isArray(row) || row.length !== 2 || !row.every(text))) fail(`notes.${id}`, 'body는 글, rows는 글 두 칸의 줄이에요.');
    hinted(`notes.${id}`, note?.hint);
  }
  for (const [id, place] of Object.entries(places)) {
    const where = `places.${id}`;
    if (!ID.test(id)) fail(where, 'id 형식이 맞지 않아요.');
    if (!text(place?.name) || !text(place?.alt)) fail(where, '이름과 그림 설명이 필요해요.');
    if (!localFile(place?.photo, /\.(?:jpe?g|webp|png)$/i)) fail(where, '사진은 이 직업 폴더 안의 그림 파일이어야 해요.');
    // The part of the photograph a person's clip may replace in a headset: [x0, y0, x1, y1], 0~1.
    if (place?.live !== undefined) {
      const live = place.live;
      if (!Array.isArray(live) || live.length !== 4 || !live.every((n) => Number.isFinite(n) && n >= 0 && n <= 1) || live[0] >= live[2] || live[1] >= live[3]) fail(where, 'live는 [왼쪽, 위, 오른쪽, 아래]를 0~1로 적어요.');
    }
    const seen = new Set();
    if (!Array.isArray(place?.points)) fail(where, 'points 배열이 필요해요(없으면 빈 배열).');
    for (const point of list(place?.points)) {
      const at = `${where}.points.${point?.id}`;
      if (!ID.test(point?.id || '') || seen.has(point.id)) fail(at, '점 id가 잘못됐거나 겹쳐요.');
      seen.add(point?.id);
      if (![point?.x, point?.y].every((n) => Number.isFinite(n) && n >= 0.04 && n <= 0.96)) fail(at, '좌표는 0.04~0.96 사이예요.');
      if (!text(point?.label)) fail(at, '이름이 필요해요.');
      if (point?.note !== undefined && !Object.hasOwn(notes, point.note)) fail(at, `알림 글 ${point.note}가 없어요.`);
      if (point?.audio !== undefined && !localFile(point.audio, /\.mp3$/i)) fail(at, '소리는 이 직업 폴더 안의 mp3 파일이어야 해요.');
      hinted(at, point?.hint);
    }
  }
  const clips = manifest && Array.isArray(manifest.clips) ? new Map(manifest.clips.map((clip) => [clip?.id, clip])) : null;
  const clipCheck = (where, id, kind) => {
    if (!ID.test(id || '')) { fail(where, '영상 id 형식이 맞지 않아요.'); return; }
    // A missing clip is allowed: that step runs on the photograph and caption.
    const clip = clips?.get(id);
    if (clip && clip.kind !== kind) fail(where, `영상 ${id}의 종류가 ${kind}이 아니에요.`);
  };
  // forkOptions: value forks the closing lists. workOptions: tool choices, usable in `when` but not in the closing.
  const forkOptions = new Map(), forkScene = new Map(), workOptions = new Map();
  const optionsOf = (fork) => forkOptions.get(fork) || workOptions.get(fork);
  const sayIds = new Set();
  const scenes = list(job.scenes);
  if (!scenes.length) fail('scenes', '장면이 없어요.');
  const sceneIds = new Set();
  let visiting = null, needed = new Set();
  /** `when` names earlier choices: { fork: option } or { fork: [option, …] }. */
  function when(where, condition) {
    if (condition === undefined) return;
    if (!plain(condition) || !Object.keys(condition).length) { fail(where, 'when은 갈림길 id와 보기 id의 짝이에요.'); return; }
    for (const [fork, wanted] of Object.entries(condition)) {
      const options = optionsOf(fork), values = Array.isArray(wanted) ? wanted : [wanted];
      if (!options) { fail(where, `when의 갈림길 ${fork}는 이 걸음보다 앞에 없어요.`); continue; }
      if (!values.length || values.some((value) => !options.has(value))) fail(where, `when의 보기 ${fork}=${values.join('|')}이 없어요.`);
      if (forkScene.get(fork) !== visiting) needed.add(forkScene.get(fork));
    }
  }
  function branch(where, steps) {
    if (!Array.isArray(steps) || !steps.length) { fail(where, '갈림길 뒤에 이어질 걸음이 필요해요.'); return; }
    steps.forEach((step, index) => {
      const at = `${where}[${index}]`;
      if (!plain(step) || !['line', 'note', 'move'].includes(step.type)) { fail(at, '갈림길 뒤에는 line, note, move만 와요.'); return; }
      visit(at, step, true);
    });
  }
  function visit(where, step, nested = false) {
    if (!plain(step) || !STEP_TYPES.has(step.type)) { fail(where, `모르는 걸음 종류예요: ${step?.type}`); return; }
    when(where, step.when);
    if (step.type === 'line') {
      if (!Object.hasOwn(cast, step.who)) fail(where, `인물 ${step.who}가 없어요.`);
      if (!text(step.text)) fail(where, '대사가 비었어요.');
      // action: what happens in front of the learner, not something said. It has no 「다시 듣기」.
      if (step.action !== undefined && typeof step.action !== 'boolean') fail(where, 'action은 true나 false예요.');
      // channel: phone shows the line as a call, chat as a message window. A chat line has no voice.
      if (step.channel !== undefined && !['phone', 'chat'].includes(step.channel)) fail(where, 'channel은 phone이나 chat이에요.');
      // A line without a clip runs on the photograph and caption.
      if (step.channel === 'chat' && step.clip !== undefined) fail(where, '채팅 줄에는 영상이 없어요.');
      else if (step.clip !== undefined) clipCheck(where, step.clip, 'speaking');
      // foreign: the person speaks the learner's language. The caption shows it, and text is its Korean meaning.
      if (step.foreign !== undefined && !localized(step.foreign)) fail(where, `foreign에는 ${everyLanguage.join(', ')}를 모두 적어요.`);
      if (step.foreign === undefined || step.hint !== undefined) hinted(where, step.hint);
      if (step.place !== undefined && !Object.hasOwn(places, step.place)) fail(where, `자리 ${step.place}가 없어요.`);
    } else if (step.type === 'move') {
      if (!Object.hasOwn(places, step.place)) fail(where, `자리 ${step.place}가 없어요.`);
      if (step.caption !== undefined && !text(step.caption)) fail(where, '자리 옮기기 글이 비었어요.');
    } else if (step.type === 'note') {
      if (!Object.hasOwn(notes, step.note)) fail(where, `알림 글 ${step.note}가 없어요.`);
    } else if (nested) fail(where, '갈림길 안에는 이 걸음을 둘 수 없어요.');
    else if (step.type === 'tour') {
      if (!Object.hasOwn(places, step.home)) fail(where, '둘러보기가 돌아올 자리가 없어요.');
      if (!Array.isArray(step.board) || step.board.length < 1 || step.board.length > 4 || step.board.some((id) => !Object.hasOwn(places, id))) fail(where, '안내판에는 있는 자리 1~4곳을 적어요.');
      if (!text(step.prompt)) fail(where, '안내 글이 필요해요.');
      hinted(where, step.hint);
    } else if (step.type === 'say') {
      if (!ID.test(step.id || '') || sayIds.has(step.id)) fail(where, '말하기 id가 잘못됐거나 겹쳐요.');
      sayIds.add(step.id);
      if (!text(step.prompt)) fail(where, '물음이 필요해요.');
      hinted(where, step.hint);
      if (step.listen !== undefined) clipCheck(where, step.listen, 'listening');
      if (step.options === undefined) {
        // record names the turn on the sheet (「자기소개 차례」); it never claims what was said.
        if (!text(step.example) || !text(step.record)) fail(where, '갈림길이 없는 말하기에는 예시 문장과 차례 이름(record)이 필요해요.');
      } else {
        const options = list(step.options);
        if (!Array.isArray(step.options) || options.length < 2 || options.length > 3) fail(where, '갈림길 보기는 2~3개예요.');
        const ids = new Set();
        for (const option of options) {
          const at = `${where}.options.${option?.id}`;
          if (!ID.test(option?.id || '') || ids.has(option.id)) fail(at, '보기 id가 잘못됐거나 겹쳐요.');
          ids.add(option?.id);
          for (const key of ['label', 'example']) if (!text(option?.[key])) fail(at, `${key}가 비었어요.`);
          hinted(at, option?.hint);
          branch(`${at}.then`, option?.then);
        }
        forkOptions.set(step.id, ids); forkScene.set(step.id, visiting);
      }
    } else if (step.type === 'work') {
      // A tool of the job (상향판 기준 1): the learner reads a screen or paper and picks. Facts, not values.
      if (!ID.test(step.id || '') || sayIds.has(step.id)) fail(where, '도구 걸음 id가 잘못됐거나 겹쳐요.');
      sayIds.add(step.id);
      if (!text(step.prompt) || !text(step.record)) fail(where, '물음과 차례 이름(record)이 필요해요.');
      hinted(where, step.hint);
      const tool = step.tool;
      if (!plain(tool) || !TOOL_KINDS.includes(tool.kind) || !text(tool.title)) fail(where, `tool은 kind(${TOOL_KINDS.join(', ')})와 title이 필요해요.`);
      else {
        const rows = tool.rows, lines = tool.lines;
        if (rows === undefined && lines === undefined) fail(where, 'tool에는 rows나 lines가 필요해요.');
        // A value can be one text or the same thing in every language (a guest's name on a booking).
        if (rows !== undefined && (!Array.isArray(rows) || !rows.length || rows.some((row) => !Array.isArray(row) || row.length !== 2 || !text(row[0]) || !cell(row[1])))) fail(where, `tool.rows는 [이름, 값]의 줄이에요. 값은 글이나 ${everyLanguage.join(', ')}를 모두 적은 객체예요.`);
        if (lines !== undefined && (!Array.isArray(lines) || !lines.length || !lines.every(cell))) fail(where, `tool.lines는 글이나 ${everyLanguage.join(', ')}를 모두 적은 객체의 줄이에요.`);
        if (tool.note !== undefined && !text(tool.note)) fail(where, 'tool.note가 비었어요.');
      }
      const options = list(step.options);
      if (!Array.isArray(step.options) || options.length < 2 || options.length > 4) fail(where, '도구 걸음의 보기는 2~4개예요.');
      const ids = new Set();
      for (const option of options) {
        const at = `${where}.options.${option?.id}`;
        if (!ID.test(option?.id || '') || ids.has(option.id)) fail(at, '보기 id가 잘못됐거나 겹쳐요.');
        ids.add(option?.id);
        if (!text(option?.label)) fail(at, 'label이 비었어요.');
        hinted(at, option?.hint);
        // retry: after its answer the same tool comes back, and the learner picks again.
        if (option?.retry !== undefined && typeof option.retry !== 'boolean') fail(at, 'retry는 true나 false예요.');
        branch(`${at}.then`, option?.then);
      }
      if (options.length && options.every((option) => option?.retry === true)) fail(where, 'retry가 없는 보기가 하나 이상 있어야 해요.');
      workOptions.set(step.id, ids); forkScene.set(step.id, visiting);
    } else if (step.type === 'relay') {
      // The learner's own language at work (상향판 기준 2): a guest's words in the learner's language, said on in Korean.
      if (!ID.test(step.id || '') || sayIds.has(step.id)) fail(where, '잇기 걸음 id가 잘못됐거나 겹쳐요.');
      sayIds.add(step.id);
      if (!Object.hasOwn(cast, step.who)) fail(where, `인물 ${step.who}가 없어요.`);
      // in (default): the guest's words, said on in Korean. out: Korean words (meaning), said on to
      // the guest in the learner's own language; foreign is then the example, and nothing is transcribed.
      if (step.direction !== undefined && !['in', 'out'].includes(step.direction)) fail(where, 'direction은 in이나 out이에요.');
      const out = step.direction === 'out';
      for (const key of out ? ['prompt', 'meaning', 'record'] : ['prompt', 'example', 'meaning', 'record']) if (!text(step[key])) fail(where, `${key}가 비었어요.`);
      if (out && step.example !== undefined) fail(where, 'out의 예시는 foreign에 적어요.');
      if (step.channel !== undefined && step.channel !== 'phone') fail(where, 'relay의 channel은 phone만 써요.');
      // Every hint language, and English for a learner who chose none.
      if (!plain(step.foreign)) fail(where, 'foreign(외국인의 말)이 없어요.');
      else for (const code of everyLanguage) if (!text(step.foreign[code])) fail(where, `foreign의 ${code}가 비었어요.`);
      hinted(where, step.hint);
      if (step.listen !== undefined) clipCheck(where, step.listen, 'listening');
    } else if (step.type === 'report') {
      if (!ID.test(step.id || '') || sayIds.has(step.id)) fail(where, '보고 id가 잘못됐거나 겹쳐요.');
      sayIds.add(step.id);
      if (!text(step.prompt)) fail(where, '물음이 필요해요.');
      hinted(where, step.hint);
      if (step.listen !== undefined) clipCheck(where, step.listen, 'listening');
      const items = list(step.items);
      if (items.length < 2) fail(where, '보고할 일이 둘 이상 필요해요.');
      if (items.filter((item) => item?.key === true && item.when === undefined).length !== 1) fail(where, '조건 없이 늘 보이는 key 항목이 하나 있어야 해요.');
      for (const item of items) {
        const at = `${where}.items.${item?.id}`;
        if (!ID.test(item?.id || '') || !text(item?.text)) fail(at, 'id와 문장이 필요해요.');
        hinted(at, item?.hint);
        when(at, item?.when);
      }
      // Items sharing an id are alternatives: every earlier choice must show exactly one of them.
      for (const id of new Set(items.map((item) => item?.id))) {
        const group = items.filter((item) => item?.id === id);
        if (group.length < 2) continue;
        const at = `${where}.items.${id}`;
        const forks = new Set(group.flatMap((item) => (plain(item.when) ? Object.keys(item.when) : ['']))), fork = [...forks][0];
        if (forks.size !== 1 || !optionsOf(fork) || group.some((item) => Object.keys(item.when).length !== 1)) { fail(at, '같은 id의 항목들은 모두 같은 갈림길 하나를 when으로 가리켜요.'); continue; }
        const covered = group.flatMap((item) => (Array.isArray(item.when[fork]) ? item.when[fork] : [item.when[fork]]));
        if (covered.length !== optionsOf(fork).size || new Set(covered).size !== covered.length || covered.some((value) => !optionsOf(fork).has(value))) fail(at, `갈림길 ${fork}의 보기마다 꼭 한 항목이 맞아야 해요.`);
      }
      if (!text(step.record?.included) || !text(step.record?.omitted)) fail(where, '보고 기록 문구 둘이 필요해요.');
      branch(`${where}.then.included`, step.then?.included);
      branch(`${where}.then.omitted`, step.then?.omitted);
      forkOptions.set(step.id, new Set(['included', 'omitted'])); forkScene.set(step.id, visiting);
    }
  }
  scenes.forEach((scene, index) => {
    const where = `scenes[${index}]`;
    if (!ID.test(scene?.id || '') || sceneIds.has(scene.id)) fail(where, '장면 id가 잘못됐거나 겹쳐요.');
    if (!text(scene?.title)) fail(where, '장면 이름이 필요해요.');
    if (!(Number.isFinite(scene?.minutes) && scene.minutes > 0 && scene.minutes <= 9)) fail(where, '장면의 예상 분(minutes)을 9 이하로 적어요. Quest에서 한 번에 10분을 넘기지 않으려고 셉니다.');
    if (!Object.hasOwn(places, scene?.place)) fail(where, `자리 ${scene?.place}가 없어요.`);
    // requires: scenes that must be finished first (their choices feed this one).
    const requires = list(scene?.requires);
    if (scene?.requires !== undefined && (!Array.isArray(scene.requires) || requires.some((id) => !sceneIds.has(id)))) fail(where, 'requires에는 앞에 있는 장면 id를 적어요.');
    visiting = scene?.id; needed = new Set();
    if (!Array.isArray(scene?.steps) || !scene.steps.length) fail(where, '걸음이 없어요.');
    else scene.steps.forEach((step, stepIndex) => visit(`${where}.steps[${stepIndex}]`, step));
    for (const id of needed) if (!requires.includes(id)) fail(where, `when이 장면 ${id}의 고름을 쓰니 requires에 ${id}를 적어요.`);
    sceneIds.add(scene?.id);
  });
  const closing = job.closing;
  if (!plain(closing)) fail('closing', '맺음이 없어요.');
  else {
    if (!Object.hasOwn(places, closing.place)) fail('closing.place', '맺음 자리가 없어요.');
    if (!text(closing.lead)) fail('closing.lead', '맺음 첫 글이 필요해요.');
    // A repeated id would make two entries share one answer (reasons, decision, ladder), so each list keeps ids unique.
    const once = (where, items) => {
      const seen = new Set();
      for (const item of items) { if (seen.has(item?.id)) fail(`${where}.${item?.id}`, '같은 id가 두 번 있어요.'); seen.add(item?.id); }
    };
    once('closing.principles', list(closing.principles));
    once('closing.forks', list(closing.forks));
    once('closing.reflection.decisions', list(closing.reflection?.decisions));
    once('closing.ladder.items', list(closing.ladder?.items));
    once('closing.conditions.items', list(closing.conditions?.items).filter((item) => item?.id !== undefined));
    const principles = new Set();
    for (const principle of list(closing.principles)) {
      if (!ID.test(principle?.id || '') || !text(principle?.title) || !text(principle?.body)) fail(`closing.principles.${principle?.id}`, 'id, 제목, 설명이 필요해요.');
      if (principle?.hint !== undefined) hinted(`closing.principles.${principle?.id}`, principle.hint);
      principles.add(principle?.id);
    }
    if (!principles.size) fail('closing.principles', '원칙이 없어요.');
    const listed = new Set();
    if (!Array.isArray(closing.forks)) fail('closing.forks', '갈림길 목록은 배열이에요.');
    for (const fork of list(closing.forks)) {
      const where = `closing.forks.${fork?.id}`;
      const options = forkOptions.get(fork?.id);
      if (!options) { fail(where, '장면에 없는 갈림길이에요.'); continue; }
      listed.add(fork.id);
      if (!text(fork.scene) || !principles.has(fork.principle)) fail(where, '장면 이름과 원칙 id가 필요해요.');
      // say: one sentence the occupation would use here, shown whatever the learner chose.
      if (!text(fork.say)) fail(where, '「이렇게 말해요」 한 문장(say)이 필요해요.');
      for (const option of options) if (!text(fork.mine?.[option])) fail(where, `보기 ${option}의 「오늘 나는」 문장이 없어요.`);
    }
    for (const id of forkOptions.keys()) if (!listed.has(id)) fail(`closing.forks.${id}`, '이 갈림길이 맺음에 없어요.');
    const conditions = closing.conditions;
    if (!text(conditions?.lead) || !Array.isArray(conditions?.items) || !conditions.items.length || conditions.items.some((item) => !text(item?.title) || !text(item?.body))) fail('closing.conditions', '실제 조건의 첫 글과 항목이 필요해요.');
    // The closing is what a learner decides on: each item may carry a hint, always shown in the chosen language.
    list(conditions?.items).forEach((item, index) => { if (item?.hint !== undefined) hinted(`closing.conditions.items[${index}]`, item.hint); });
    const reflection = closing.reflection;
    const decisions = list(reflection?.decisions);
    if (!text(reflection?.hardLabel) || !text(reflection?.decisionLabel) || decisions.length !== 3 || decisions.some((item) => !ID.test(item?.id || '') || !text(item?.label))) fail('closing.reflection', '소감 물음과 세 가지 답이 필요해요.');
    for (const item of decisions) if (item?.hint !== undefined) hinted(`closing.reflection.decisions.${item?.id}`, item.hint);
    const ladder = closing.ladder;
    if (!text(ladder?.lead) || !Array.isArray(ladder?.items) || !ladder.items.length || ladder.items.some((item) => !ID.test(item?.id || '') || !text(item?.label))) fail('closing.ladder', '준비 사다리 항목이 필요해요.');
    for (const item of list(ladder?.items)) if (item?.hint !== undefined) hinted(`closing.ladder.items.${item?.id}`, item.hint);
    if (closing.next !== undefined && (!text(closing.next?.label) || !text(closing.next?.href) || closing.next.href !== closing.next.href.trim() || /^[a-z]+:|^\/\//i.test(closing.next.href))) fail('closing.next', '다음 칸은 같은 사이트 안의 상대 주소여야 해요.');
  }
  // Nothing a learner reads may sound like a grade or a recommendation.
  const allowed = list(job.allowedTerms).filter(text);
  for (const value of jobTexts(job)) {
    const bare = allowed.reduce((rest, term) => rest.split(term).join(' '), value);
    for (const word of FORBIDDEN_RECORD_WORDS) if (bare.includes(word)) fail('글', `「${word}」를 쓰지 않아요: ${value}`);
  }
}

/** Every string a learner can read in a job. Only allowedTerms is left out by name. A key that
 * usually holds an id or a file name (who, place, listen, …) can also be an option id that keys a
 * learner's sentence (closing.forks[].mine.listen), so such a key drops only plain ASCII
 * references and keeps any text with Korean or other letters in it. */
export function jobTexts(job) {
  const out = [], references = new Set(['id', 'photo', 'audio', 'clip', 'listen', 'who', 'place', 'home', 'note', 'principle', 'href', 'type', 'hintLanguages', 'board', 'requires', 'when']);
  const walk = (value, key) => {
    if (key === 'allowedTerms') return;
    if (typeof value === 'string') { if (!references.has(key) || /[^\x20-\x7e]/.test(value)) out.push(value); }
    else if (Array.isArray(value)) value.forEach((item) => walk(item, key));
    else if (plain(value)) for (const [name, item] of Object.entries(value)) walk(item, name);
  };
  walk(job, '');
  return out;
}

/** Clip ids a job's steps name, in first-use order. The page uses it to warn about a manifest gap. */
export function jobClipIds(job) {
  const ids = [];
  const add = (id) => { if (typeof id === 'string' && !ids.includes(id)) ids.push(id); };
  const walk = (steps) => { for (const step of list(steps)) {
    if (step?.type === 'line') add(step.clip);
    if (step?.type === 'say' || step?.type === 'report' || step?.type === 'relay') add(step.listen);
    for (const option of list(step?.options)) walk(option?.then);
    if (step?.type === 'report') { walk(step.then?.included); walk(step.then?.omitted); }
  } };
  for (const scene of list(job?.scenes)) walk(scene?.steps);
  return ids;
}

/** Files a job's table points at, relative to its folder. The local server and the publish
 * bundle allow exactly these, so nothing else in the folder (production notes) is served. */
export function jobFiles(job, manifest = null) {
  const files = new Set();
  for (const place of Object.values(plain(job?.places) ? job.places : {})) {
    if (text(place?.photo)) files.add(place.photo);
    for (const point of list(place?.points)) if (text(point?.audio)) files.add(point.audio);
  }
  // Only films that passed review are served; the others play as photograph and caption anyway.
  for (const clip of list(manifest?.clips)) if (clip?.reviewed === true && text(clip?.file)) files.add(clip.file);
  return [...files].filter((file) => file === file.trim() && !/^[a-z]+:|^\/|\.\.|\\/i.test(file)).sort();
}
