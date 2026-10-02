import { createWorldLearningHost } from './generated/world-learning-host.cjs';
import { scopedStorage } from './core.mjs';
const memberLabel = member => ({ student: '학생', teacher: '강사', director: '원장', reviewer: '검수 담당' })[member.role] || (member.kind === 'staff' ? '교직원' : '회원');
const element = (tag, text, className) => { const node = document.createElement(tag);if (text != null) node.textContent = text;if (className) node.className = className;return node; };
export function createAccountView({ client, product, guard, notice, logout, preview = false, localConnection = false, onGameRequest = null }) {
  const root = document.getElementById('account'), world = document.getElementById('world-games');let data, host, ended = false, deleteRequestId, gameFrame, gameGeneration=0;
  const closeGame=()=>{gameGeneration++;if(window.SYNKTownHost)delete window.SYNKTownHost;try{host?.closeRun?.();}catch{}if(gameFrame){gameFrame.removeAttribute?.('src');gameFrame.hidden=true;}};
  const stopWorld = () => { closeGame();host?.stop();host = null;if (window.SYNKLearningHost) delete window.SYNKLearningHost;world.replaceChildren();world.hidden = true;gameFrame=null; };
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
    const connected = data.learning?.enabled === true && data.capabilities?.learningSync === true && data.account.status !== 'deletion-requested';
    const status = element('p', connected ? '학습 계정을 연결할 준비가 되었어요.' : '이 계정의 기기 내 기록으로 연습해요. 비회원 기록과 합치거나 서버에 보내지 않아요.', 'notice');world.append(status);
    if (!preview) {
      const accountKey = connected ? data.account.synk_user_id : `local:${data.account.synk_user_id}`;
      const storage = scopedStorage(localStorage, accountKey, data.learning.revision, guard);
      // The page's own engine builds the account-wide adapter; a game frame only builds its coach.
      host = createWorldLearningHost({ accountKey, revision: data.learning.revision, storage, connected, engine: window.SynkLearning?.engine,
        transport: client.learning, guard, onStatus: state => { if (ended) return;status.textContent = state.phase === 'synced' ? '계정 학습 기록을 연결했어요.' : state.phase === 'offline' ? `연결을 기다리는 기록 ${state.queued}개 · 이 기기에 보관해요.` : state.phase === 'blocked' ? '학습 연결을 확인하지 못했어요. 계정 상태를 새로 확인해 주세요.' : '학습 기록을 연결하고 있어요.'; } });
      window.SYNKLearningHost = host;
    }
    const links = element('div', null, 'game-links'), frame = element('iframe');gameFrame=frame;frame.hidden = true;frame.title = 'WORLD 학습 게임';frame.allow = 'autoplay; fullscreen';
    for (const [path, label] of [['korean-racing', '한국어 레이싱'], ['korean-runner', '바람길'], ['korean-rhythm', '한국어 리듬'], ['order-rush', '주문 폭주'], ['entry-check', '입장 검사'], ['story-classroom', '선생님이 돌아왔다']]) {
      links.append(button(label, async () => { guard();if (preview) { notice('로컬 화면 예시에서는 실제 게임 계정 연결을 시작하지 않아요.');return; }if(localConnection){await onGameRequest?.(path);return;}frame.src = new URL(`../${path}/`, location.href).href;frame.hidden = false; }, 'sb-glass'));
    }
    world.append(links, frame);
  }
  async function load() {
    const result = await client.load();guard();if (ended) return;data = result;render();
  }
  function render() {
    document.body.classList.add('account-open');root.hidden = false;root.replaceChildren();const head = element('div', null, 'account-head');
    head.append(element('h2', `${data.account?.profile?.display_name || '나'}의 ${localConnection?'개발용 WORLD 연결':'SYNK ID'}`), button(localConnection?'이 창의 연결 종료':'이 제품에서 로그아웃', () => signOut()));root.append(head);
    const grid = element('div', null, 'account-grid'), identity = card('계정과 소속');
    identity.append(element('p', `SYNK ID · ${data.account?.synk_user_id || '확인 중'}`, 'small'));
    identity.append(list((data.memberships || []).map(m => `${memberLabel(m)}${m.student_code ? ` · ${m.student_code}` : ''}${m.active === false ? ' · 소속 종료' : ''}`), '아직 연결된 소속이 없어요.'));
    identity.append(element('p', `로그인 연결: ${(data.account?.providers || []).join(', ') || '이메일'}`, 'small'));
    const deleting = data.account?.status === 'deletion-requested', canEnable = data.capabilities?.learningSync === true && !deleting;
    const learning = card('학습 기록 연결');learning.append(element('p', localConnection?'이 개발 연결에서는 기록 동기화와 선생님에게 보여주기를 함께 켜고 끕니다. 기존 비회원 기록은 가져오지 않아요.':'동의하면 연결된 연습 기록을 다른 기기에서도 이어 쓸 수 있어요. 기존 비회원 기록을 계정에 자동으로 옮기지 않아요.', 'small'));
    const toggle = element('label', null, 'toggle'), input = element('input');input.type = 'checkbox';input.checked = data.learning?.enabled === true;
    input.disabled = !input.checked && !canEnable;
    input.onchange = () => { const enabled = input.checked;input.disabled = true;if (!enabled) stopWorld();void action(async () => { if (enabled && !canEnable) throw new Error('현재는 계정 학습 연결을 켤 수 없어요.');await client.setLearning(enabled, data.learning.revision);await load();notice(enabled ? '학습 기록 연결에 동의했어요.' : '학습 기록 연결을 껐어요.'); }).finally(() => { input.checked = data.learning?.enabled === true;input.disabled = !input.checked && !canEnable; }); };
    toggle.append(input, element('span', '계정에 학습 기록 연결'));learning.append(toggle);
    if (!canEnable) learning.append(element('p', deleting ? '계정 삭제 요청이 접수되어 학습 연결을 다시 켤 수 없어요.' : '계정 학습 연결은 아직 제공 전이에요. 이 계정의 기기 내 연습은 계속할 수 있어요.', 'small'));
    const rights = card('이용 권한');rights.append(list((data.entitlements || []).map(e => `${e.key}${e.product ? ` · ${e.product}` : ''}${e.status ? ` · ${e.status}` : ''}${e.valid_until ? ` · ${new Date(e.valid_until).toLocaleDateString('ko-KR')}까지` : ''}`), '현재 표시할 이용 권한이 없어요.'));
    const sessions = card('연결된 로그인');
    for (const session of data.sessions || []) { const row = element('div', null, 'session-row');row.append(element('p', `${session.label || session.product || '로그인'}${session.current ? ' · 현재' : ''}${session.revoked ? ' · 종료됨' : ''}`, 'small'));if (!session.revoked) row.append(button('종료', async () => { if (session.current) await signOut();else { await client.revokeSession(session.id);await load(); } }));sessions.append(row); }
    if (!(data.sessions || []).length) sessions.append(element('p', '표시할 로그인 기록이 없어요.', 'small'));
    if(!localConnection)sessions.append(button('모든 제품의 로그인 종료', () => signOut('all')));grid.append(identity, learning, rights, sessions);root.append(grid);
    if(!localConnection){
    const actions = element('div', null, 'actions');actions.append(button('연결된 연습 기록 내려받기', async () => {
      const events = [], metadata = [];let after = 0, until;
      for (let page = 0; page < 1000; page++) { const result = await client.exportPage({ after, until });guard();
        if (!Array.isArray(result.events) || !Number.isSafeInteger(result.cursor) || result.cursor < after || result.hasMore && result.cursor <= after) throw new Error('내보내기 진행을 확인하지 못했어요. 다시 시도해 주세요.');
        until ??= result.until;events.push(...result.events);if (Array.isArray(result.eventMeta)) metadata.push(...result.eventMeta);after = result.cursor;
        if (!result.hasMore) { const blob = new Blob([JSON.stringify({ scope: 'connected-learning-records', account: result.account || data.account, until, events, eventMeta: metadata }, null, 2)], { type: 'application/json' });const a = element('a');a.href = URL.createObjectURL(blob);a.download = 'synk-connected-learning.json';a.click();setTimeout(() => URL.revokeObjectURL(a.href), 1000);notice('연결된 연습 기록을 내려받았어요. 다른 과제·AI 기록은 이 파일 범위에 포함되지 않아요.');return; }
      }throw new Error('기록이 많아 한 번에 마치지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    }, 'sb-btn soft'));
    const deleteButton = button(deleting ? '계정 삭제 요청 접수됨' : '계정 삭제 요청', async () => { const dialog = element('dialog');dialog.append(element('h2', '계정 삭제를 요청할까요?'), element('p', '이 버튼은 삭제 요청을 접수해요. 접수 결과와 실제 삭제 완료를 구분해서 안내해요.', 'small'));
      const controls = element('div', null, 'actions');controls.append(button('삭제 요청 보내기', async () => { deleteRequestId ||= crypto.randomUUID();await client.requestDeletion(deleteRequestId);stopWorld();dialog.close();await load();notice('계정 삭제 요청이 접수되었어요. 실제 삭제 완료 여부는 서비스의 처리 안내를 확인해 주세요.'); }), button('취소', async () => dialog.close()));dialog.append(controls);dialog.addEventListener('close', () => dialog.remove());document.body.append(dialog);dialog.showModal();
    }, 'plain danger');deleteButton.disabled = deleting;actions.append(deleteButton);root.append(actions);
    }
    games();
  }
  function launchRun(run){
    guard();if(ended||!localConnection||!host||!gameFrame||!data.learning?.enabled)throw new Error('먼저 WORLD 학습 연결을 확인해 주세요.');
    const paths={'korean-racing':'/korean-racing/','korean-runner':'/korean-runner/','korean-rhythm':'/korean-rhythm/','order-rush':'/order-rush/','entry-check':'/entry-check/','story-classroom':'/story-classroom/','synk-town':'/synk-town/linked.html'};
    const url=new URL(run?.href||'',location.href);if(!paths[run?.gameId]||url.origin!==location.origin||url.pathname!==paths[run.gameId]||url.hash)throw new Error('지원하는 WORLD 게임 주소가 아니에요.');
    closeGame();host.beginRun(run);const generation=gameGeneration;
    if(run.gameId==='synk-town'){
      const current=()=>{guard();if(ended||generation!==gameGeneration)throw new Error('Town 연결이 끝났어요.');};
      window.SYNKTownHost=Object.freeze({async read(){current();const result=await client.townRead();current();return result;},async command(payload){current();const result=await client.townCommand(payload);current();return result;}});
    }
    gameFrame.src=url.href;gameFrame.hidden=false;world.hidden=false;gameFrame.scrollIntoView?.({behavior:'smooth',block:'start'});
  }
  return { load,launchRun,closeGame, stop() { ended = true;document.body.classList.remove('account-open');stopWorld();root.replaceChildren();root.hidden = true; } };
}
