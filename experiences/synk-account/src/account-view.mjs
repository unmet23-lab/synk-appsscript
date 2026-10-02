import { createWorldLearningHost } from './generated/world-learning-host.cjs';
import { scopedStorage } from './core.mjs';
const memberLabel = member => ({ student: '학생', teacher: '강사', director: '원장', reviewer: '검수 담당' })[member.role] || (member.kind === 'staff' ? '교직원' : '회원');
// Words for Core's account summary (synk-account ?view=atlas): the settings a person chose and the
// learning reasons they declared. A summary describes choices and practice, never ability or a trait.
const SETTING_WORDS = { support: { step: '단계별로 도와줘요', choose: '그때그때 맞춰 줘요', independent: '혼자 해 볼게요' },
  textSize: { standard: '보통 글씨', large: '큰 글씨' }, explanation: { brief: '짧은 설명', standard: '보통 설명', detailed: '자세한 설명' },
  motion: { full: '움직임 그대로', reduced: '움직임 줄이기' }, audio: { off: '소리 끄기', available: '소리 쓰기' } };
const REASON_WORDS = { culture: '드라마·음악·웹툰', travel: '한국 여행', people: '가족·친구와 이야기', life: '한국 생활', study: '한국에서 공부',
  work: '한국에서 일', career: '지금 하는 일', exam: '시험·자격', hobby: '배우는 즐거움', other: '다른 이유' };
const element = (tag, text, className) => { const node = document.createElement(tag);if (text != null) node.textContent = text;if (className) node.className = className;return node; };
// 기기 시각으로 「10월 10일 05:00」(계정 지우기 취소 기한).
const dueText = value => { const d = new Date(value);if (!value || Number.isNaN(d.getTime())) return '';return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export function createAccountView({ client, product, guard, notice, logout, preview = false, localConnection = false, onGameRequest = null, classConnection = null }) {
  const root = document.getElementById('account'), world = document.getElementById('world-games');let data, host, ended = false, deleteRequestId, gameFrame, gameGeneration=0;
  const closeGame=()=>{gameGeneration++;if(window.SYNKTownHost)delete window.SYNKTownHost;try{host?.closeRun?.();}catch{}if(gameFrame){gameFrame.removeAttribute?.('src');gameFrame.hidden=true;}};
  // Back in front: read what other devices chose (help style, moment memory); going to the background: send what changed here.
  const visibility = () => { try { if (document.visibilityState === 'hidden') void host?.flush();else void host?.retry(); } catch { /* an ended session has nothing to send */ } };
  const stopWorld = () => { document.removeEventListener?.('visibilitychange', visibility);closeGame();host?.stop();host = null;if (window.SYNKLearningHost) delete window.SYNKLearningHost;world.replaceChildren();world.hidden = true;gameFrame=null; };
  async function action(fn) { try { guard();await fn();if (!ended) guard(); } catch (error) { if (!ended) notice(error.message, true); } }
  const button = (text, fn, className = 'plain') => { const b = element('button', text, className);b.type = 'button';b.onclick = () => { b.disabled = true;void action(fn).finally(() => { b.disabled = false; }); };return b; };
  const card = title => { const c = element('section', null, 'sb-card');c.append(element('h3', title));return c; };
  const list = (rows, empty) => { const ul = element('ul', null, 'details');for (const value of rows.length ? rows : [empty]) ul.append(element('li', value));return ul; };
  // The host owns local credentials and reports server revocation separately.
  // Do not make local sign-out depend on a successful account API request here.
  const signOut = (scope = 'current') => logout(undefined, { scope,
    sessionId: (data.sessions || []).find(session => session.current && !session.revoked)?.id || null });
  function games() {
    stopWorld();if (product !== 'world' || !data.account?.synk_user_id) return;
    world.hidden = false;world.append(element('h2', 'WORLD에서 이어서 연습해요.'));
    const context=classConnection?data.classroom:data;
    const connected = context?.learning?.enabled === true && data.learning?.enabled === true && data.capabilities?.learningSync === true && data.account.status === 'active';
    const status = element('p', connected ? '학습 계정을 연결할 준비가 되었어요.' : '이 계정의 기기 내 기록으로 연습해요. 비회원 기록과 합치거나 서버에 보내지 않아요.', 'notice');world.append(status);
    if (!preview) {
      const accountKey = (connected ? data.account.synk_user_id : `local:${data.account.synk_user_id}`)+(classConnection?`:class:${classConnection.classId}`:'');
      const learningRevision=context?.learning?.revision||data.learning.revision;
      const storage = scopedStorage(localStorage, accountKey, learningRevision, guard);
      // The page's own engine builds the account-wide adapter; a game frame only builds its coach.
      host = createWorldLearningHost({ accountKey, revision: learningRevision, storage, connected, engine: window.SynkLearning?.engine,
        transport: classConnection?.client.learning||client.learning, memoryTransport: classConnection?undefined:client.memory, guard, onStatus: state => { if (ended) return;status.textContent = state.phase === 'synced' ? '계정 학습 기록을 연결했어요.' : state.phase === 'offline' ? `연결을 기다리는 기록 ${state.queued}개 · 이 기기에 보관해요.` : state.phase === 'blocked' ? '학습 연결을 확인하지 못했어요. 계정 상태를 새로 확인해 주세요.' : '학습 기록을 연결하고 있어요.'; } });
      window.SYNKLearningHost = host;document.addEventListener?.('visibilitychange', visibility);
    }
    const links = element('div', null, 'game-links'), frame = element('iframe');gameFrame=frame;frame.hidden = true;frame.title = 'WORLD 학습 게임';frame.allow = 'autoplay; fullscreen';
    for (const [path, label] of [['korean-racing', '한국어 레이싱'], ['korean-runner', '바람길'], ['korean-rhythm', '한국어 리듬'], ['order-rush', '주문 폭주'], ['entry-check', '입장 검사'], ['story-classroom', '선생님이 돌아왔다'], ['blank-slice', '빈칸 베기']]) {
      links.append(button(label, async () => { guard();if (preview) { notice('로컬 화면 예시에서는 실제 게임 계정 연결을 시작하지 않아요.');return; }if(localConnection||classConnection){await onGameRequest?.(path);return;}frame.src = new URL(`../${path}/`, location.href).href;frame.hidden = false; }, 'sb-glass'));
    }
    world.append(links, frame);
  }
  async function load() {
    const result = await client.load();guard();if (ended) return;
    if(classConnection){const context=await classConnection.client.load();guard();if(ended)return;if(context?.account?.synk_user_id!==result.account?.synk_user_id)throw new Error('수업 계정이 바뀌었어요. 다시 로그인해 주세요.');result.classroom=context;classConnection.onContext?.(context);}
    data = result;render();
  }
  // What Atlas keeps for this account, as other SYNK products read it. An older server without the
  // summary leaves the card saying so; the rest of the account screen does not wait for it.
  async function atlas(target) {
    let result;
    try { result = typeof client.atlasSummary === 'function' ? await client.atlasSummary() : null;guard(); }
    catch { if (!ended) target.replaceChildren(element('h3', '아틀라스가 기억하는 나'), element('p', '요약은 아직 준비 중이에요. 연습과 계정은 그대로 쓸 수 있어요.', 'small'));return; }
    if (ended || !result?.summary) return;
    const { summary } = result, rows = [];
    const chosen = Object.entries(summary.presentation || {}).filter(([key, value]) => SETTING_WORDS[key]?.[value]).map(([key, value]) => SETTING_WORDS[key][value]);
    rows.push(chosen.length ? `고른 설정 · ${chosen.join(' · ')}` : '고른 설정 · 아직 없어요');
    const reasons = (summary.reasons || []).map(reason => REASON_WORDS[reason]).filter(Boolean);
    rows.push(reasons.length ? `배우는 이유 · ${reasons.join(' · ')}` : '배우는 이유 · 아직 밝히지 않았어요');
    const practice = summary.practice || {};
    rows.push(practice.answered ? `연습 · ${practice.answered}문항 · 혼자 맞힌 문항 ${practice.independent} · 도움 받은 문항 ${practice.assisted}` : '연습 · 아직 저장된 연습이 없어요');
    for (const skill of (practice.skills || []).slice(0, 3)) rows.push(skill.line);
    target.replaceChildren(element('h3', '아틀라스가 기억하는 나'), list(rows, ''),
      element('p', result.shared === 'practice-and-settings'
        ? '다른 SYNK 앱도 이 요약으로 시작해요. 직접 고른 것과 실제 연습에서만 나오며, 나이·성별이나 성격은 짐작하지 않아요.'
        : '학습 기록 저장이 꺼져 있어 다른 SYNK 앱에는 직접 밝힌 배우는 이유만 전해요.', 'small'));
  }
  function render() {
    document.body.classList.add('account-open');root.hidden = false;root.replaceChildren();const head = element('div', null, 'account-head');
    head.append(element('h2', `${data.account?.profile?.display_name || '나'}의 ${localConnection?'개발용 WORLD 연결':'SYNK ID'}`), button(localConnection?'이 창의 연결 종료':'이 제품에서 로그아웃', () => signOut()));root.append(head);
    const grid = element('div', null, 'account-grid'), identity = card('계정과 소속');
    identity.append(element('p', `SYNK ID · ${data.account?.synk_user_id || '확인 중'}`, 'small'));
    identity.append(list((data.memberships || []).map(m => `${memberLabel(m)}${m.student_code ? ` · ${m.student_code}` : ''}${m.active === false ? ' · 소속 종료' : ''}`), '아직 연결된 소속이 없어요.'));
    identity.append(element('p', `로그인 연결: ${(data.account?.providers || []).join(', ') || '이메일'}`, 'small'));
    const deleting = data.account?.status === 'deletion-requested', canEnable = data.capabilities?.learningSync === true && !deleting;
    // 계정 지우기 7일 취소 유예: 아직 처리 전인 자기 삭제 요청이 있으면 그 기한까지 이 화면에서 취소할 수 있다.
    const pendingDeletion = deleting ? (data.dataRequests || []).find(r => r.kind === 'delete' && r.status === 'pending') : null;
    const learning = card('학습 기록 연결');learning.append(element('p', localConnection?'이 개발 연결에서는 기록 동기화와 선생님에게 보여주기를 함께 켜고 끕니다. 기존 비회원 기록은 가져오지 않아요.':'동의하면 연결된 연습 기록을 다른 기기에서도 이어 쓸 수 있어요. 기존 비회원 기록을 계정에 자동으로 옮기지 않아요.', 'small'));
    const toggle = element('label', null, 'toggle'), input = element('input');input.type = 'checkbox';input.checked = data.learning?.enabled === true;
    input.disabled = !input.checked && !canEnable;
    input.onchange = () => { const enabled = input.checked;input.disabled = true;if (!enabled) stopWorld();void action(async () => { if (enabled && !canEnable) throw new Error('현재는 계정 학습 연결을 켤 수 없어요.');await client.setLearning(enabled, data.learning.revision);await load();notice(enabled ? '학습 기록 연결에 동의했어요.' : '학습 기록 연결을 껐어요.'); }).finally(() => { input.checked = data.learning?.enabled === true;input.disabled = !input.checked && !canEnable; }); };
    toggle.append(input, element('span', '계정에 학습 기록 연결'));learning.append(toggle);
    if (!canEnable) learning.append(element('p', deleting ? (pendingDeletion ? '삭제 요청을 받아 학습 연결을 켤 수 없어요. 아래에서 요청을 취소하면 다시 켤 수 있어요.' : '삭제 요청을 처리하고 있어 학습 연결을 켤 수 없어요.') : '계정 학습 연결은 아직 제공 전이에요. 이 계정의 기기 내 연습은 계속할 수 있어요.', 'small'));
    const memory = card('아틀라스가 기억하는 나');memory.classList.add('atlas-card');memory.append(element('p', '요약을 불러오고 있어요.', 'small'));void atlas(memory);
    const rights = card('이용 권한');rights.append(list((data.entitlements || []).map(e => `${e.key}${e.product ? ` · ${e.product}` : ''}${e.status ? ` · ${e.status}` : ''}${e.valid_until ? ` · ${new Date(e.valid_until).toLocaleDateString('ko-KR')}까지` : ''}`), '현재 표시할 이용 권한이 없어요.'));
    const sessions = card('연결된 로그인');
    for (const session of data.sessions || []) { const row = element('div', null, 'session-row');row.append(element('p', `${session.label || session.product || '로그인'}${session.current ? ' · 현재' : ''}${session.revoked ? ' · 종료됨' : ''}`, 'small'));if (!session.revoked) row.append(button('종료', async () => { if (session.current) await signOut();else { await client.revokeSession(session.id);await load(); } }));sessions.append(row); }
    if (!(data.sessions || []).length) sessions.append(element('p', '표시할 로그인 기록이 없어요.', 'small'));
    if(!localConnection)sessions.append(button('모든 제품의 로그인 종료', () => signOut('all')));grid.append(identity, learning, memory, rights, sessions);root.append(grid);
    if(!localConnection){
    const actions = element('div', null, 'actions');actions.append(button('연결된 연습 기록 내려받기', async () => {
      const events = [], metadata = [];let after = 0, until, atlasMemory;
      for (let page = 0; page < 1000; page++) { const result = await client.exportPage({ after, until });guard();
        if (after === 0 && Array.isArray(result.atlasMemory)) atlasMemory = result.atlasMemory;
        if (!Array.isArray(result.events) || !Number.isSafeInteger(result.cursor) || result.cursor < after || result.hasMore && result.cursor <= after) throw new Error('내보내기 진행을 확인하지 못했어요. 다시 시도해 주세요.');
        until ??= result.until;events.push(...result.events);if (Array.isArray(result.eventMeta)) metadata.push(...result.eventMeta);after = result.cursor;
        if (!result.hasMore) { const blob = new Blob([JSON.stringify({ scope: 'connected-learning-records', account: result.account || data.account, ...(atlasMemory ? { atlasMemory } : {}), until, events, eventMeta: metadata }, null, 2)], { type: 'application/json' });const a = element('a');a.href = URL.createObjectURL(blob);a.download = 'synk-connected-learning.json';a.click();setTimeout(() => URL.revokeObjectURL(a.href), 1000);notice('연결된 연습 기록을 내려받았어요. 다른 과제·AI 기록은 이 파일 범위에 포함되지 않아요.');return; }
      }throw new Error('기록이 많아 한 번에 마치지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    }, 'sb-btn soft'));
    const deleteButton = button(deleting ? '계정 삭제 요청 접수됨' : '계정 삭제 요청', async () => { const dialog = element('dialog');dialog.append(element('h2', '계정 삭제를 요청할까요?'), element('p', '요청하면 학습 기록 연결을 바로 멈춰요. 7일 동안은 이 화면에서 요청을 취소할 수 있고, 그 뒤에 계정과 학습 기록, 맞춤 기억, 로그인 정보를 지워요(늦어도 요청 후 30일 안에). 지운 뒤에는 되돌릴 수 없어요.', 'small'));
      const controls = element('div', null, 'actions');controls.append(button('삭제 요청 보내기', async () => { deleteRequestId ||= crypto.randomUUID();const result = await client.requestDeletion(deleteRequestId);stopWorld();dialog.close();await load();const due = dueText(result?.request?.due_at);notice(`삭제 요청을 받았어요. 학습 기록 연결을 멈췄고, ${due ? `${due}까지는` : '7일 동안은'} 이 화면에서 취소할 수 있어요.`); }), button('취소', async () => dialog.close()));dialog.append(controls);dialog.addEventListener('close', () => dialog.remove());document.body.append(dialog);dialog.showModal();
    }, 'plain danger');deleteButton.disabled = deleting;actions.append(deleteButton);
    if (pendingDeletion) actions.append(button('삭제 요청 취소', async () => { await client.cancelDeletion(pendingDeletion.request_id);deleteRequestId = null;await load();notice('삭제 요청을 취소했어요. 학습 기록 연결은 꺼 둔 채로 두었으니, 다시 쓰려면 위의 스위치를 켜 주세요.'); }, 'sb-btn soft'));
    if (deleting) root.append(element('p', pendingDeletion ? `삭제 요청을 받았어요. ${dueText(pendingDeletion.due_at) ? `${dueText(pendingDeletion.due_at)}까지는` : '7일 동안은'} 아래에서 취소할 수 있고, 그 뒤에 계정과 기록을 지워요.` : '삭제 요청을 처리하고 있어요. 늦어도 요청 후 30일 안에 계정과 기록을 지워요.', 'small'));
    root.append(actions);
    }
    games();
  }
  function launchRun(run){
    guard();if(ended||!(localConnection||classConnection)||!host||!gameFrame||!data.learning?.enabled||classConnection&&!data.classroom?.sharing?.enabled)throw new Error('먼저 WORLD 학습 연결을 확인해 주세요.');
    const paths={'korean-racing':'/korean-racing/','korean-runner':'/korean-runner/','korean-rhythm':'/korean-rhythm/','order-rush':'/order-rush/','entry-check':'/entry-check/','story-classroom':'/story-classroom/','blank-slice':'/blank-slice/','synk-town':'/synk-town/linked.html'};
    const url=new URL(run?.href||'',location.href);if(!paths[run?.gameId]||url.origin!==location.origin||url.pathname!==paths[run.gameId]||url.hash)throw new Error('지원하는 WORLD 게임 주소가 아니에요.');
    closeGame();host.beginRun(run);const generation=gameGeneration;
    if(run.gameId==='synk-town'){
      const current=()=>{guard();if(ended||generation!==gameGeneration)throw new Error('Town 연결이 끝났어요.');};
      const townClient=classConnection?.client||client;
      window.SYNKTownHost=Object.freeze({async read(){current();const result=await townClient.townRead();current();return result;},async command(payload){current();const result=await townClient.townCommand(payload);current();return result;}});
    }
    if(classConnection)url.pathname=new URL(`../${run.gameId}/${run.gameId==='synk-town'?'linked.html':''}`,location.href).pathname;
    gameFrame.src=url.href;gameFrame.hidden=false;world.hidden=false;gameFrame.scrollIntoView?.({behavior:'smooth',block:'start'});
  }
  return { load,launchRun,closeGame, stop() { ended = true;document.body.classList.remove('account-open');stopWorld();root.replaceChildren();root.hidden = true; } };
}
