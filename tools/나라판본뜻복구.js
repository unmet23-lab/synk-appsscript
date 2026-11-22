'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { spawnSync } = require('node:child_process');
const { 보내기 } = require('./lib/클로드키.js');
const { GPT검수 } = require('./lib/GPT검수모델.js');
const { sha256, readJson } = require('./lib/판본글.js');
const { 답읽기 } = require('./뜻검사.js');
const { 잠그기 } = require('./크레딧실행.js');
const { 공용작업본 } = require('./lib/공용작업본.js');
const { 지금읽기 } = require('./예약멈춤.js');

const repo = path.resolve(__dirname, '..');
const task = 'synk-daily-lab-versions';
const models = { sonnet: 'claude-sonnet-5-5', haiku: 'claude-haiku-5-5', opus: 'claude-opus-5-5', fable: 'claude-fable-5-2' };
const configFile = path.join(os.homedir(), '.config', 'synk', 'lab-meaning-review.json');
const safeName = text => typeof text === 'string' && /^[가-힣A-Za-z0-9_-]+$/.test(text);
function inside(parent, file) {
  const rel = path.relative(parent, file);
  return Boolean(rel && !rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}
function atomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + crypto.randomUUID();
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(temp, file);
}
function nodeTool(tree, name, args, { input, codes = [0], cwd = tree, timeout = 600000, sessionId } = {}) {
  const res = spawnSync(process.execPath, [path.join(tree, 'tools', name), ...args], {
    cwd, input, env: { ...process.env, SYNK_LAB_REQUIRE_MUSE: '1', ...(sessionId ? {SYNK_LAB_RECOVERY_SESSION:sessionId} : {}) }, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024,
  });
  if (res.error || !codes.includes(res.status)) {
    throw Object.assign(Error(name + ' 실행 실패 ' + (res.error?.message || String(res.stderr || res.stdout).trim().slice(-450))), { code: res.error?.code });
  }
  return res.stdout;
}
function config() {
  const c = readJson(configFile);
  if (!Array.isArray(c.accounts) || !c.accounts.length || !c.accounts.every(x => typeof x === 'string' && x.trim()) ||
      !Number.isFinite(Date.parse(c.enabledAt))) throw Error('승인된 검수 계정 설정이 필요합니다.');
  return c;
}
function verifyInput(tree, folder, retryMuse = false) {
  const m = readJson(path.join(folder, '재료.json'));
  if (!m.편폴더 || !m.글 || !m.만든곳 || path.relative(tree, m.만든곳) ||
      !inside(path.join(tree, 'docs', '마케팅'), fs.realpathSync(m.편폴더)) ||
      !inside(fs.realpathSync(m.편폴더), fs.realpathSync(m.글)) || sha256(m.글) !== m.지문) throw Error('재료와 현재 예약 사본의 원고가 다릅니다.');
  if (!safeName(m.편) || !safeName(m.판본) || path.basename(m.편폴더) !== m.편) throw Error('예약 판본 이름을 확인할 수 없습니다.');
  if (!Array.isArray(m.시험관) || !m.시험관.length || !m.시험관.every(s => s === 'gpt' || Object.hasOwn(models, s))) throw Error('시험관 배정을 확인할 수 없습니다.');
  if (retryMuse && m.뮤즈1차?.상태 === '미완료') {
    const questionHash = sha256(path.join(folder, '질문.md'));
    if (questionHash !== m.뮤즈1차.질문지문) throw Error('뮤즈 재시도 전에 시험지가 바뀌었습니다.');
    const plan = path.join(m.편폴더, '기획.md');
    const source = (fs.existsSync(plan) ? fs.readFileSync(plan, 'utf8') : '별도 기획 원문 없음') + '\n\n판본 글\n' + fs.readFileSync(m.글, 'utf8');
    const original = require(path.join(tree, 'tools/lib/뮤즈1차.js')).review('콘텐츠', source);
    if (!original) throw Error('뮤즈 1차 검수가 아직 끝나지 않았습니다.');
    if (readJson(path.join(folder, '재료.json')).시각 !== m.시각 || sha256(m.글) !== m.지문 || sha256(path.join(folder, '질문.md')) !== questionHash) throw Error('뮤즈 재시도 중 재료가 바뀌었습니다.');
    m.뮤즈1차 = { 모델: 'muse-spark-1.3', 원답: path.basename(original), 원답지문: sha256(original),
      질문지문: sha256(path.join(folder, '질문.md')), 확인시각: new Date().toISOString() };
    atomic(path.join(folder, '재료.json'), m);
  }
  const file = m.뮤즈1차?.원답;
  const report = typeof file === 'string' && /^[0-9a-f]{64}\.txt$/.test(file) && path.join(tree, '.tmp', '뮤즈1차', file);
  if (m.뮤즈1차?.모델 !== 'muse-spark-1.3' || !report || !fs.existsSync(report) || sha256(report) !== m.뮤즈1차.원답지문 ||
      sha256(path.join(folder, '질문.md')) !== m.뮤즈1차.질문지문) throw Error('뮤즈 원답과 현재 시험지의 연결을 확인할 수 없습니다.');
  return m;
}
function validAnswer(text, m) {
  const a = 답읽기(text);
  if (typeof a.요약 !== 'string' || !a.요약.trim() || !a.웃음 || typeof a.웃음.웃김 !== 'boolean' ||
      !['모름줄','불편','결함'].every(key => Array.isArray(a[key])) ||
      (m.퀴즈?.length && (!['풀기','유일'].every(key => Array.isArray(a[key]) && m.퀴즈.every(q => a[key].filter(x => Number(x?.문제) === Number(q.문제)).length === 1))))) throw Error('완결된 뜻검사 답을 받지 못했습니다.');
}
async function examine(tree, folder, c, only, check = () => {}, journal = folder) {
  check();
  const unlock = 잠그기(path.join(folder, '.검수크레딧.lock'), Infinity);
  try {
    const m = verifyInput(tree, folder, true);
    if (only && !m.시험관.includes(only)) throw Error('배정되지 않은 시험관입니다.');
    const question = fs.readFileSync(path.join(folder, '질문.md'), 'utf8');
    const secret = path.join(os.homedir(), 'SYNK_보안');
    for (const judge of only ? [only] : m.시험관) {
      check();
      const dest = path.join(folder, '답_' + judge + '.md');
      const generation = crypto.createHash('sha256').update(JSON.stringify([path.resolve(folder),m.시각,m.지문,m.뮤즈1차.질문지문])).digest('hex');
      const callFile = path.join(journal, '.검수크레딧', generation, judge + '.json');
      const previous = fs.existsSync(callFile) ? readJson(callFile) : null;
      if (fs.existsSync(dest)) {
        if (fs.statSync(dest).mtimeMs < Date.parse(m.시각) - 2000) throw Error('현재 재료보다 먼저 작성한 시험관 답입니다.');
        const answer = fs.readFileSync(dest,'utf8');
        validAnswer(answer, m);
        if (previous?.상태 === '받음' && previous.답 === answer && previous.응답) {
          const receiptFile = path.join(folder,'호출_' + judge + '.json');
          if (!fs.existsSync(receiptFile) || readJson(receiptFile).답지문 !== sha256(dest)) {
            atomic(receiptFile,{...previous.응답,질문지문:m.뮤즈1차.질문지문,답지문:sha256(dest),받은시각:fs.statSync(dest).mtime.toISOString()});
          }
        }
        continue;
      }
      const blind = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-meaning-'));
      try {
        fs.writeFileSync(path.join(blind, '질문.md'), question);
        const answerFile = path.join(blind, '답.md');
        if (previous?.상태 === '요청중') throw Error(judge + ' 요청 결과가 불명확해 중복 호출을 보류합니다.');
        if ((previous?.상태 === '불완전' || previous?.상태 === '거절') && previous.횟수 >= 2) throw Error(judge + ' 답 두 건이 불완전해 이 시험관을 보류합니다.');
        const attempt = (previous?.횟수 || 0) + 1;
        let data = previous?.상태 === '받음' ? previous.응답 : null;
        if (data && typeof previous.답 === 'string') {
          try { validAnswer(previous.답,m); } catch (error) {
            atomic(callFile,{ ...previous, 상태:'불완전', 횟수:previous.횟수 || 1 });
            throw error;
          }
          fs.writeFileSync(answerFile, previous.답);
        } else {
          const sending = () => {
            check();
            atomic(callFile,{상태:'요청중',횟수:previous?.횟수 || 0,시각:new Date().toISOString()});
            check();
          };
          try {
            if (judge === 'gpt') {
              sending();
              nodeTool(tree, 'codex계정.js', ['exec', '--skip-git-repo-check', '-C', blind, '-s', 'read-only', '-m', GPT검수.모델,
                '-c', 'model_reasoning_effort=' + GPT검수.추론, '-o', answerFile, '-'], { cwd: blind, input: question, timeout: 1800000 });
              data = { 모델: GPT검수.모델, 추론: GPT검수.추론, 경로: '기존 GPT 구독' };
            } else {
              const { 응답, 키이름 } = await 보내기({ model: models[judge], max_tokens: 16000, messages: [{ role: 'user', content: question }] }, {
                용도: '판본뜻검사/' + m.편 + '/' + m.판본 + '/' + judge, 검수전용키: c.accounts, 보내기전: sending,
                목록경로: path.join(secret, '클로드_키목록_검수.json'), 상태경로: path.join(secret, '클로드_키상태_검수.json'),
                기록경로: path.join(secret, '클로드_사용기록_검수.jsonl'),
              });
              if (응답.model !== models[judge] || 응답.stop_reason !== 'end_turn' || !응답.id) {
                atomic(callFile,{ 상태:'불완전', 횟수:attempt, 모델:응답.model, 종료:응답.stop_reason, 응답ID:응답.id });
                throw Error('시험관 모델이나 응답 종료를 확인하지 못했습니다.');
              }
              fs.writeFileSync(answerFile, 응답.content.filter(b => b.type === 'text').map(b => b.text).join('\n'));
              data = { 모델: 응답.model, 계정: 키이름, 응답ID: 응답.id, 사용: 응답.usage, 경로: '기존 검수 크레딧' };
            }
          } catch (error) {
            if ((judge === 'gpt' && error.code !== 'ETIMEDOUT') || ['클로드키_모두소진','클로드키_전송전중단'].includes(error.code) || (error.http >= 400 && error.http < 500 && error.http !== 408)) {
              atomic(callFile, { 상태: '거절', 횟수: previous?.횟수 || 0, 시각: new Date().toISOString(), HTTP: error.http });
            }
            throw error;
          }
          const answer = fs.readFileSync(answerFile,'utf8');
          try { validAnswer(answer,m); } catch (error) {
            atomic(callFile,{ 상태:'불완전', 횟수:attempt, 응답:data, 답:answer });
            throw error;
          }
          atomic(callFile, { 상태: '받음', 횟수:attempt, 응답: data, 답: answer });
        }
        validAnswer(fs.readFileSync(answerFile, 'utf8'), m);
        const current = verifyInput(tree, folder);
        if (current.시각 !== m.시각 || current.뮤즈1차.질문지문 !== m.뮤즈1차.질문지문) throw Error('시험 도중 회차가 바뀌었습니다.');
        check();
        if (!fs.existsSync(dest)) {
          nodeTool(tree, '뜻검사.js', ['답넣기', folder, judge, answerFile]);
          atomic(path.join(folder, '호출_' + judge + '.json'), { ...data, 질문지문: m.뮤즈1차.질문지문,
            답지문: sha256(dest), 받은시각: new Date().toISOString() });
        }
      } finally { fs.rmSync(blind, { recursive: true, force: true }); }
    }
    if (only) return;
    verifyInput(tree, folder);
    for (const s of m.시험관) validAnswer(fs.readFileSync(path.join(folder, '답_' + s + '.md'), 'utf8'), m);
    check();
    nodeTool(tree, '뜻검사.js', ['채점', folder, '--기록'], { codes: [0, 1, 3] });
    const grade = readJson(path.join(folder, '채점.json'));
    const prep = readJson(path.join(m.편폴더, '게시', '준비.json')).돌림.판본[m.판본].검수.뜻;
    if (!m.시험관.every(s => Object.hasOwn(grade.시험관별, s)) || grade.지문 !== m.지문 ||
        prep.지문 !== m.지문 || prep.시각 !== grade.시각 || prep.결과 !== grade.결과) throw Error('최종 채점과 판본 기록이 일치하지 않습니다.');
    return { 편: m.편, 판본: m.판본, 시험관: m.시험관, 결과: grade.결과, 지문: grade.지문, 채점시각:grade.시각, 검수기록:prep, 채점: path.join(folder, '채점.json') };
  } finally { unlock(); }
}
function inWindow(slot, now) {
  const time = new Date(slot + 9 * 3600000);
  const hour = time.getUTCHours();
  if (time.getUTCMinutes() !== 10 || ![9,22].includes(hour) || now < slot) return false;
  return now < slot + (hour === 9 ? 260 : 500) * 60000;
}
function eligible(run, c, now) {
  return run?.작업 === task && run.실행?.켜짐 && !run.실행.바쁨 && run.판정?.종류 === '멈춤' &&
    run.판정.확실 && run.판정.한도 && /hit your (?:5-hour|session|weekly) limit|usage limit reached/i.test(run.판정.까닭) &&
    run.예정 >= Date.parse(c.enabledAt) && inWindow(run.예정, now);
}
// Claude Desktop writes the chosen model and Agent description into a sibling metadata file.
function judgeQuota(dir, m, judge) {
  if (!fs.existsSync(dir) || !Object.hasOwn(models, judge)) return false;
  for (const file of fs.readdirSync(dir).filter(name => /^agent-[a-z0-9-]+\.meta\.json$/i.test(name))) {
    const meta = readJson(path.join(dir,file));
    if (![judge, models[judge]].includes(meta.model) || !String(meta.description).includes(m.뮤즈1차.질문지문.slice(0,16))) continue;
    const log = path.join(dir,file.replace('.meta.json','.jsonl'));
    if (!fs.existsSync(log)) continue;
    const last = require('../.claude/skills/이어서/세션고르기.cjs').원문끝메시지(log, 1).at(-1);
    if (last?.type === 'assistant' && last.isApiErrorMessage === true &&
        last.apiError === 'usage_limit_reached' && Date.parse(last.timestamp) >= Date.parse(m.시각)) return true;
  }
  return false;
}
function childQuota(run, m, judge) {
  const picker = require('../.claude/skills/이어서/세션고르기.cjs');
  const parent = picker.원문찾기(path.join(os.homedir(),'.claude','projects'), {
    cliSessionId: run.실행.CLI, cwd: run.실행.사본, originCwd: run.실행.공용,
  });
  return parent && judgeQuota(path.join(path.dirname(parent), path.basename(parent,'.jsonl'), 'subagents'), m, judge);
}
function activeFolders(tree, run, completed = new Set()) {
  const dir = path.join(tree, '.tmp', '판본뜻검수');
  if (!fs.existsSync(dir)) return [];
  const folders = [];
  for (const f of fs.readdirSync(dir).filter(x => /^[0-9a-f]{64}\.json$/.test(x))) {
    const entry = readJson(path.join(dir, f));
    if (Date.parse(entry.시각) < Math.floor(run.시작 / 1000) * 1000) continue;
    if (!fs.existsSync(path.join(entry.밖, '재료.json'))) continue;
    const m = readJson(path.join(entry.밖, '재료.json'));
    if (m.만든곳 !== tree && (!m.만든곳 || path.relative(tree, m.만든곳))) continue;
    if (m.시각 !== entry.시각 || m.지문 !== entry.지문 || !fs.existsSync(m.글) || sha256(m.글) !== m.지문) continue;
    const gradeFile = path.join(entry.밖, '채점.json');
    if (fs.existsSync(gradeFile)) {
      const g = readJson(gradeFile);
      const p = readJson(path.join(m.편폴더, '게시', '준비.json')).돌림?.판본?.[m.판본]?.검수?.뜻;
      if (g.지문 === m.지문 && Date.parse(g.시각) >= Date.parse(m.시각) && p?.시각 === g.시각 && p.결과 === g.결과 && p.지문 === m.지문 && m.시험관.every(s => Object.hasOwn(g.시험관별, s))) {
        completed.add(JSON.stringify([m.편,m.판본]));
        continue;
      }
    }
    folders.push(entry.밖);
  }
  return folders;
}
function gitClean(tree, relative) {
  const r = spawnSync('git', ['status', '--porcelain', '--', relative], { cwd: tree, windowsHide: true, encoding: 'utf8' });
  return r.status === 0 && !r.stdout.trim();
}
function readyVersions(tree, common, queue) {
  return queue.filter(row => {
    if (row.상태 !== '뜻 검수 전' || !safeName(row.편) || !safeName(row.키)) return false;
    const episode = path.join(tree, 'docs', '마케팅', row.편);
    const prep = path.join(episode, '게시', '준비.json');
    if (!fs.existsSync(prep)) return false;
    const v = readJson(prep).돌림?.판본?.[row.키];
    if (!v?.글 || !v.파일 || v.검수?.글자?.결과 !== '통과' || v.검수?.현지어?.결과 !== '통과') return false;
    const source = path.resolve(episode, v.글), video = path.resolve(episode, v.파일);
    if (!inside(episode, source) || !inside(episode, video) || !fs.existsSync(source)) return false;
    const h = sha256(source), sharedVideo = path.resolve(common, path.relative(tree, video));
    const rendered = fs.existsSync(video) ? video : sharedVideo;
    return v.검수.현지어.지문 === h && v.검수.글자.글지문 === h && fs.existsSync(rendered) && sha256(rendered) === v.검수.글자.지문;
  });
}
function gitFile(tree, ref, relative) {
  const read = spawnSync('git',['show',ref + ':' + relative],{cwd:tree,windowsHide:true,maxBuffer:16*1024*1024});
  if (read.status !== 0) throw Error('판본의 Git 기록을 읽을 수 없습니다: ' + ref);
  return read.stdout;
}
function earlierExamBusy(material, rows = 지금읽기({작업상세:task}).회차들) {
  if (!material.예약세션) return false;
  const owner = rows.find(r => r.작업 === task && r.세션 === material.예약세션 &&
    r.실행?.사본 && material.만든곳 && !path.relative(r.실행.사본,material.만든곳));
  return Boolean(owner?.실행.켜짐 && owner.판정.종류 !== '멈춤' && owner.실행.바쁨);
}
function copyPreviousExam(previous, folder, ownerBusy = earlierExamBusy) {
  if (!fs.existsSync(path.join(previous,'재료.json')) || fs.existsSync(folder)) return;
  const grade = path.join(previous,'채점.json');
  const frozen = readJson(path.join(previous,'재료.json'));
  const materialTime = Date.parse(frozen.시각);
  const graded = fs.existsSync(grade) && Date.parse(readJson(grade).시각) >= materialTime;
  const lock = path.join(previous,'.검수크레딧.lock');
  let inFlight = false;
  if (!graded && fs.existsSync(lock)) {
    const pid = readJson(lock).pid;
    if (Number.isInteger(pid) && pid > 0) {
      try { process.kill(pid,0); inFlight = true; } catch (error) { inFlight = error.code === 'EPERM'; }
    }
  }
  if (!graded && (inFlight || ownerBusy(frozen))) throw Error('다른 사본에서 같은 판본을 채점 중입니다.');
  const snapshot = graded ? sha256(grade) : null;
  // 앞 예약의 미완료 시험지는 새 판본에 섞지 않고, 이미 끝난 앞회차 기록만 보존한다.
  const archive = path.join(previous,'앞회차');
  if (!graded && !fs.existsSync(archive)) return;
  const tmp = folder + '.' + crypto.randomUUID();
  fs.mkdirSync(path.dirname(folder),{recursive:true});
  try {
    fs.cpSync(previous,tmp,{recursive:true,filter:file => {
      if (fs.lstatSync(file).isSymbolicLink()) return false;
      if (!graded && file !== previous && file !== archive && !inside(archive,file)) return false;
      return file === previous || /^(앞회차|채점답|[0-9]+|질문\.md|재료\.json|채점\.json|답_[a-z0-9.-]+\.md)$/i.test(path.basename(file));
    }});
    if ((graded && (sha256(grade) !== snapshot || sha256(path.join(tmp,'채점.json')) !== snapshot)) ||
        readJson(path.join(previous,'재료.json')).시각 !== frozen.시각) throw Error('앞 회차 기록이 복사 중에 바뀌었습니다.');
    fs.renameSync(tmp,folder);
  } finally { if (fs.existsSync(tmp)) fs.rmSync(tmp,{recursive:true,force:true}); }
}
// Only the judged edition’s meaning field is eligible for publication; re-evaluate on every retry.
function publishGrade(tree, relative, proof, check) {
  const rec = proof.검수기록;
  if (!rec || !rec.시각 || !rec.결과 || !rec.지문 || rec.시각 !== proof.채점시각 || rec.지문 !== proof.지문 || rec.결과 !== proof.결과 ||
      !Array.isArray(proof.시험관) || !proof.시험관.length || !isDeepStrictEqual([...rec.시험관 || []].sort(),[...proof.시험관].sort())) throw Error('시험관이 채점한 판본 기록이 온전하지 않습니다.');
  const common = 공용작업본(tree), key = proof.판본;
  const source = path.relative(tree,proof.글).split(path.sep).join('/');
  const file = path.join(tree,relative), sharedSource = path.join(common,source);
  const local = readJson(file).돌림?.판본?.[key];
  const episode = path.dirname(path.dirname(relative));
  const pointsToSource = version => typeof version?.글 === 'string' &&
    !path.relative(path.resolve(tree,episode,version.글),proof.글);
  const recorded = version => pointsToSource(version) && isDeepStrictEqual(version.검수?.뜻,proof.검수기록);
  const snapshot = () => {
    const ref = spawnSync('git',['rev-parse','--verify','refs/remotes/origin/master^{commit}'],{cwd:tree,windowsHide:true,encoding:'utf8'});
    const commit = ref.stdout?.trim();
    if (ref.status !== 0 || !/^[a-f0-9]{40,64}$/.test(commit)) throw Error('공용 Git 커밋을 확인하지 못했습니다.');
    const version = JSON.parse(gitFile(tree,commit,relative).toString('utf8')).돌림?.판본?.[key];
    const digest = crypto.createHash('sha256').update(gitFile(tree,commit,source)).digest('hex');
    return { commit, version, digest };
  };
  const sharedMatches = () => fs.existsSync(sharedSource) && sha256(sharedSource) === proof.지문 &&
    recorded(readJson(path.join(common,relative)).돌림?.판본?.[key]);
  let remote = snapshot();
  if (!recorded(local) || sha256(proof.글) !== proof.지문 || remote.digest !== proof.지문 || !pointsToSource(remote.version)) {
    throw Error('채점한 원고와 회차·공용 Git의 원고가 일치하기를 기다립니다.');
  }
  if (!recorded(remote.version)) {
    const base = gitFile(tree,'HEAD',relative);
    const desired = JSON.parse(base.toString('utf8'));
    const variant = desired.돌림?.판본?.[key];
    if (!pointsToSource(variant)) throw Error('이 판본 원고가 반영될 때까지 채점을 보관합니다.');
    variant.검수 = { ...variant.검수, 뜻:proof.검수기록 };
    const bytes = Buffer.from(JSON.stringify(desired,null,2)+'\n');
    const parts = require('./내커밋.js').조각만들기(base.toString('latin1'),bytes.toString('latin1')).묶음.map(x=>x.id);
    if (!parts.length) throw Error('회차의 기존 커밋이 공용 Git에 반영되기를 기다립니다.');
    check();
    nodeTool(tree,'바로올리기.js',[relative,'--조각',relative+'='+parts.join(','),'-m','나라 판본 뜻검사 복구 결과 '+proof.편+' '+key,'--실행']);
  }
  remote = snapshot();
  if (remote.digest !== proof.지문 || !recorded(remote.version)) throw Error('공용 Git에서 원고와 최종 채점이 아직 맞지 않습니다.');
  if (!sharedMatches() && gitClean(common,relative) && gitClean(common,source)) {
    check();
    nodeTool(common,'바로올리기.js',['따라가기','--실행']);
  }
  if (!sharedMatches()) throw Error('공용 작업본에서 같은 원고와 최종 채점이 반영되기를 기다립니다.');
  const final = snapshot();
  if (final.digest !== proof.지문 || !recorded(final.version)) throw Error('공용 파일을 대조하는 동안 Git의 판본이 바뀌었습니다.');
  return final.commit;
}
async function recoverItem(tree,state,run,c,item,check) {
  const { folder, episode, key, hash } = item;
  if (!safeName(episode) || !safeName(key)) throw Error('계획의 판본 이름이 올바르지 않습니다.');
  const ep = path.join(tree,'docs','마케팅',episode);
  const prep = path.join(ep,'게시','준비.json');
  const expected = path.join(state,'시험',episode,key);
  if (!item.time && path.relative(expected,folder)) throw Error('새 시험은 회차 전용 폴더에서만 시작합니다.');
  const itemId = crypto.createHash('sha256').update(JSON.stringify([run.예정,episode,key,hash,path.resolve(folder),item.time || null])).digest('hex');
  const proofFile = path.join(state,'결과',episode,key,itemId + '.json');
  const bindingFile = path.join(state,'고정',itemId + '.json');
  const binding = fs.existsSync(bindingFile) ? readJson(bindingFile) : null;
  let proof = fs.existsSync(proofFile) ? readJson(proofFile) : null;
  if (proof && (proof.편 !== episode || proof.판본 !== key || proof.지문 !== hash || proof.세션 !== run.세션)) throw Error('보관한 결과와 판본이 다릅니다.');
  const mat = path.join(folder,'재료.json');
  let material = fs.existsSync(mat) ? readJson(mat) : null;
  const ours = material && material.만든곳 && !path.relative(tree, material.만든곳) &&
    material.지문 === hash && material.편 === episode && material.판본 === key &&
    Date.parse(material.시각) >= Math.floor(run.시작 / 1000) * 1000;
  if (!ours && !proof) {
    if (item.time || binding) throw Error('고정한 시험 재료가 없어 새 호출을 보류합니다.');
    const version = readJson(prep).돌림.판본[key];
    const join = require('./lib/판본잇기.js');
    if (sha256(path.resolve(ep,version.글)) !== hash || join.글낡음(ep,key,version) || join.렌더낡음(ep,key,version)) throw Error('예약 뒤 판본 글이나 영상이 달라졌습니다.');
    if (item.previous && new Date(run.예정 + 9*3600000).getUTCHours() === 22 && Date.now() >= run.예정 + 470*60000) throw Error('밤 회차의 새 판본 시작 시간이 지났습니다.');
    if (item.previous) copyPreviousExam(item.previous,folder);
    check();
    nodeTool(tree, '뜻검사.js', ['판본', ep, key, '--밖', folder],{sessionId:run.세션});
    material = readJson(mat);
  }
  const relative = path.relative(tree,prep).split(path.sep).join('/');
  if (!proof) {
    if (material.편 !== episode || material.판본 !== key || path.relative(ep,material.편폴더) || path.relative(tree,material.만든곳) || material.지문 !== hash || (item.time && item.time !== material.시각)) throw Error('뜻검사 재료가 계획과 다릅니다.');
    const question = sha256(path.join(folder,'질문.md'));
    if (binding && (binding.세션 !== run.세션 || binding.재료시각 !== material.시각 || binding.질문 !== question)) throw Error('고정한 시험지가 변경되어 새 호출을 보류합니다.');
    if (!binding) atomic(bindingFile,{세션:run.세션,재료시각:material.시각,질문:question});
    const grade = await examine(tree, folder, c, null, check, state);
    const calls = {};
    for (const judge of material.시험관) {
      const call = path.join(folder,'호출_' + judge + '.json');
      if (fs.existsSync(call)) {
        const r = readJson(call);
        if (r.질문지문 === question && r.답지문 === sha256(path.join(folder,'답_' + judge + '.md')) &&
            Date.parse(r.받은시각) >= Date.parse(material.시각)) calls[judge] = r;
      }
    }
    proof = { 예약: run.예정, 세션: run.세션, 사본: tree, ...grade, 글:material.글, 재료시각:material.시각, 호출:calls, 운영:'회차 사본에 기록' };
    atomic(proofFile, proof);
  }
  if (proof.운영 === '공용 파일과 Git 기록 확인') return proof;
  proof.공용커밋 = publishGrade(tree, relative, proof, check);
  proof.공용확인시각 = new Date().toISOString();
  proof.운영 = '공용 파일과 Git 기록 확인';
  atomic(proofFile, proof);
  return proof;
}
async function recover(c, run, common) {
  const tree = fs.realpathSync(run.실행.사본);
  if (!run.실행.공용 || path.relative(common, fs.realpathSync(run.실행.공용)) ||
      !path.relative(common, tree) || !fs.statSync(path.join(tree, '.git')).isFile() ||
      path.relative(common, 공용작업본(tree))) throw Error('이 예약의 작업 사본을 확인하지 못했습니다.');
  const state = path.join(common, '.tmp', '나라판본뜻복구', String(run.예정));
  const unlock = 잠그기(path.join(state, '실행.lock'), Infinity);
  try {
    const doneFile = path.join(state, '완료.json');
    if (fs.existsSync(doneFile)) return;
    const planFile = path.join(state, '계획.json');
    if (!fs.existsSync(planFile)) {
      const completed = new Set();
      const items = activeFolders(tree, run, completed).map(folder => {
        const m = readJson(path.join(folder, '재료.json'));
        return { folder, episode: m.편, key: m.판본, hash: m.지문, time: m.시각 };
      });
      if (!items.length) {
        const queue = JSON.parse(nodeTool(common, '판본할일.js', ['--상한', '999', '--json'])).줄;
        const limit = new Date(run.예정 + 9 * 3600000).getUTCHours() === 9 ? 6 : 22;
        for (const row of readyVersions(tree, common, queue)) {
          if (items.length + completed.size >= limit) break;
          if (completed.has(JSON.stringify([row.편,row.키]))) continue;
          const episode = path.join(tree, 'docs', '마케팅', row.편);
          const version = readJson(path.join(episode,'게시','준비.json')).돌림.판본[row.키];
          const join = require('./lib/판본잇기.js');
          if (join.글낡음(episode,row.키,version) || join.렌더낡음(episode,row.키,version)) continue;
          items.push({ folder: path.join(state,'시험',row.편,row.키), previous: path.join(common,'.tmp','뜻검사',row.편,row.키),
            episode: row.편, key: row.키, hash: sha256(path.resolve(episode,version.글)) });
        }
      }
      if (!items.length) {
        console.log('현재 영상과 글의 검수를 마친 뜻검사 대기 판본이 없습니다.');
        return;
      }
      atomic(planFile, { session: run.세션, tree, items });
    }
    const plan = readJson(planFile);
    if (plan.session !== run.세션 || path.relative(plan.tree, tree)) throw Error('같은 시각의 다른 예약 사본입니다.');
    const results = [];
    for (const item of plan.items) {
      if (!inWindow(run.예정, Date.now())) break;
      const check = () => {
        const live = currentRun();
        if (!eligible(live,c,Date.now()) || live.세션 !== run.세션) throw Error('예약 시간이나 실행 상태가 바뀌었습니다.');
      };
      check();
      try {
        results.push(await recoverItem(tree,state,run,c,item,check));
      } catch (error) {
        const name = crypto.createHash('sha256').update(JSON.stringify(item)).digest('hex');
        atomic(path.join(state, '대기', name + '.json'), { 편: item.episode, 판본: item.key, 시각: new Date().toISOString(), 이유: error.message });
        console.error(item.episode + ' ' + item.key + ' 대기: ' + error.message);
      }
    }
    if (results.length === plan.items.length) atomic(doneFile, { 예약: run.예정, 세션: run.세션, 사본: tree, 결과: results });
    console.log(JSON.stringify({ 예약: run.예정, 완료: results.length }));
    if (results.length !== plan.items.length) throw Error('미완료 판본의 사유를 이 회차의 대기 기록에 남겼습니다.');
  } finally { unlock(); }
}
function currentRun() {
  const rows = 지금읽기({ 작업상세: task }).회차들.filter(r => r.작업 === task && Number.isFinite(r.예정));
  return rows.sort((a,b) => b.예정 - a.예정)[0];
}
async function main(argv) {
  const c = config();
  if (argv[0] === '시험관' && argv.length === 3) {
    const run = currentRun();
    const folder = fs.realpathSync(argv[1]);
    if (!run?.실행?.켜짐 || !run.실행.사본 || path.relative(repo, fs.realpathSync(run.실행.사본)) ||
        !inWindow(run.예정,Date.now()) || run.예정 < Date.parse(c.enabledAt) ||
        !activeFolders(repo,run).some(f => !path.relative(fs.realpathSync(f),folder))) throw Error('현재 나라 판본 예약의 시험 폴더에서만 검수 크레딧을 쓸 수 있습니다.');
    const m = verifyInput(repo, folder);
    if (!childQuota(run,m,argv[2])) throw Error('이 시험관의 구독 한도 기록이 아직 확인되지 않았습니다.');
    const check = () => {
      const live = currentRun();
      if (!inWindow(run.예정,Date.now()) || live?.세션 !== run.세션 || !live?.실행?.켜짐) throw Error('시험관 예약 시간이나 상태가 바뀌었습니다.');
    };
    const state = path.join(공용작업본(repo),'.tmp','나라판본뜻복구',String(run.예정));
    return examine(repo, folder, c, argv[2],check,state);
  }
  if (argv.length !== 1 || argv[0] !== '예약') throw Error('사용법: 나라판본뜻복구.js 예약 | 시험관 <시험 폴더> <이름>');
  const run = currentRun();
  if (eligible(run, c, Date.now())) await recover(c, run, fs.realpathSync(공용작업본(repo)));
}
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { publishGrade, earlierExamBusy, recoverItem, copyPreviousExam, judgeQuota, eligible, inWindow, readyVersions, activeFolders, verifyInput, validAnswer, examine };

