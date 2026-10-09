import { createWorldLearningHost } from './generated/world-learning-host.cjs';
import { scopedStorage } from './core.mjs';
import { SETTING_WORDS, REASON_WORDS, WORLD_GAMES, picksForReasons, sentencesForReasons } from './atlas-words.mjs';
import { createWardrobeView } from './wardrobe-view.mjs';
import { createWorldPlayHost } from '../../play-common/account-host.mjs';
import { takeWorldPlayEntry,worldGameHref } from './world-play-entry.mjs';
import { createClassroomTownHost } from './classroom-town-host.mjs';
const memberLabel = member => ({ student: '학생', teacher: '강사', director: '원장', reviewer: '검수 담당' })[member.role] || (member.kind === 'staff' ? '교직원' : '회원');
const element = (tag, text, className) => { const node = document.createElement(tag);if (text != null) node.textContent = text;if (className) node.className = className;return node; };
// 기기 시각으로 「10월 10일 05:00」(계정 지우기 취소 기한).
const dueText = value => { const d = new Date(value);if (!value || Number.isNaN(d.getTime())) return '';return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export function createAccountView({ client, product, guard, notice, logout, preview = false, localConnection = false, onGameRequest = null, classConnection = null }) {
  const root = document.getElementById('account'), world = document.getElementById('world-games');let data, host, playHost, wardrobeView, ended = false, deleteRequestId, gameFrame, gameGeneration=0, loadVersion=0, stopPreferences, learningPending=false, learningUnconfirmed=false,playEntryUsed=false;
  const closeGame=()=>{gameGeneration++;if(window.SYNKTownHost)delete window.SYNKTownHost;try{host?.closeRun?.();}catch{}if(gameFrame){gameFrame.removeAttribute?.('src');gameFrame.hidden=true;}};
  // Back in front: read what other devices chose (help style, moment memory); going to the background: send what changed here.
  const retryPlay = () => { if(playHost&&!['conflict','stopped'].includes(playHost.status().phase))void playHost.retry().catch(()=>{}); };
  const visibility = () => { try { if (document.visibilityState === 'hidden') { void host?.flush();void playHost?.flush().catch(()=>{}); } else { void host?.retry();retryPlay();void wardrobeView?.refresh(); } } catch { /* an ended session has nothing to send */ } };
  const online = () => { try { void host?.retry();retryPlay();void wardrobeView?.refresh(); } catch { /* a stopped account must not resume */ } };
  const stopWorld = () => { wardrobeView?.stop();wardrobeView=null;stopPreferences?.();stopPreferences=null;document.removeEventListener?.('visibilitychange', visibility);window.removeEventListener?.('online',online);closeGame();playHost?.stop();playHost=null;if(window.SYNKPlayHost)delete window.SYNKPlayHost;host?.stop();host = null;if (window.SYNKLearningHost) delete window.SYNKLearningHost;world.replaceChildren();world.hidden = true;gameFrame=null; };
  async function action(fn) { try { guard();await fn();if (!ended) guard(); } catch (error) { if (!ended) notice(error.message, true); } }
  const button = (text, fn, className = 'plain') => { const b = element('button', text, className);b.type = 'button';b.onclick = () => { b.disabled = true;void action(fn).finally(() => { b.disabled = false; }); };return b; };
  const card = title => { const c = element('section', null, 'sb-card');c.append(element('h3', title));return c; };
  const list = (rows, empty) => { const ul = element('ul', null, 'details');for (const value of rows.length ? rows : [empty]) ul.append(typeof value === 'string' ? element('li', value) : value);return ul; };
  // The host owns local credentials and reports server revocation separately.
  // Do not make local sign-out depend on a successful account API request here.
  const signOut = (scope = 'current') => logout(undefined, { scope,
    sessionId: (data.sessions || []).find(session => session.current && !session.revoked)?.id || null });
  function games() {
    stopWorld();if (product !== 'world' || !data.account?.synk_user_id) return;
    world.hidden = false;world.append(element('h2', 'WORLD에서 이어서 연습해요.'));
    const context=classConnection?data.classroom:data;
    const personalConnected = data.learning?.enabled === true && data.capabilities?.learningSync === true && data.account.status === 'active';
    const connected = context?.learning?.enabled === true && personalConnected;
    const status = element('p', '', 'notice');status.setAttribute('role', 'status');status.setAttribute('aria-live', 'polite');
    const statusActions = element('div', null, 'actions'), retry = element('button', '저장 상태 다시 확인', 'sb-btn soft');retry.type = 'button';
    let learningState = { phase: 'idle', queued: 0 }, retrying = false;
    const renderLearningStatus = state => {
      learningState = state;
      const queued = Number.isSafeInteger(state.queued) && state.queued > 0 ? state.queued : 0;
      const waiting = queued ? `아직 계정에 저장하지 못한 연습 기록 ${queued}개가 있어요.` : '계정의 최신 연습 기록을 확인하지 못했어요.';
      status.textContent = preview ? '미리보기예요. 실제 계정에 기록을 저장하지 않아요.'
        : !connected ? '이 계정의 기기 내 기록으로 연습해요. 비회원 기록과 합치거나 서버에 보내지 않아요.'
        : ['blocked', 'stopped'].includes(state.phase) ? ['STORAGE_ERROR', 'HISTORY_CAPACITY'].includes(state.code) ? '이 기기에 연습 기록을 보관하지 못했어요. 저장 공간과 브라우저 설정을 확인한 뒤 계정 화면에 다시 들어와 주세요.' : '학습 기록 연결이 중단됐어요. 계정 화면에 다시 들어와 로그인과 학습 연결 동의를 확인해 주세요.'
        : state.phase === 'offline' ? `${waiting} 이 기기의 기록은 유지하며, 다시 연결하면 저장과 불러오기를 재시도해요.`
        : state.phase === 'synced' && !queued ? state.complete === true ? '현재 연습 기록을 계정에 저장하고 최신 기록을 확인했어요.' : '이전 연습 기록을 아직 모두 확인하지 못했어요. 저장 상태 다시 확인으로 이어서 확인해 주세요.'
        : state.phase === 'syncing' || retrying ? `계정 기록을 확인하고 있어요.${queued ? ` 저장 대기 ${queued}개.` : ''}`
        : queued ? waiting : '학습 계정을 연결할 준비가 되었어요.';
      retry.hidden = preview || !connected || state.phase === 'blocked' || state.phase === 'stopped';
      retry.disabled = retrying || state.phase === 'syncing';
      retry.textContent = retrying || state.phase === 'syncing' ? '저장 상태 확인 중…' : state.phase === 'offline' ? '학습 기록 다시 연결' : '저장 상태 다시 확인';
      if (state.phase === 'synced' && !queued) void wardrobeView?.refresh();
    };
    retry.onclick = () => {
      if (retry.disabled || retry.hidden) return;
      const currentHost = host;retrying = true;renderLearningStatus(learningState);
      void action(async () => { await currentHost?.retry();guard();if (!ended && host === currentHost) renderLearningStatus(currentHost.status()); })
        .finally(() => { retrying = false;if (!ended && host === currentHost) renderLearningStatus(learningState); });
    };
    statusActions.append(retry);world.append(status, statusActions);renderLearningStatus(learningState);
    const playStatus=element('p','','notice'),playActions=element('div',null,'actions');playStatus.setAttribute('role','status');playStatus.dataset.playStatus='';
    let playState={phase:'loading'},opening=false,pendingPath=null;
    const playRetry=button('게임 기록 다시 연결',async()=>{
      const current=playHost;if(!current)throw new Error('게임 저장을 연결할 WORLD 계정을 다시 확인해 주세요.');
      if(current.status().phase==='stopped'){await signOut();return;}
      await current.retry();guard();if(ended||playHost!==current)return;
      if(pendingPath)await openGame(pendingPath);
    },'sb-btn soft');playRetry.dataset.playAction='retry';
    const useRemote=button('계정 진도 사용',()=>resolvePlay('remote'),'sb-btn soft'),useLocal=button('이 기기의 진도 사용',()=>resolvePlay('local'),'sb-btn soft');
    useRemote.dataset.playAction='remote';useLocal.dataset.playAction='local';
    const importOld=button('이 브라우저의 이전 게임 기록 가져오기',async()=>{const current=playHost;if(!current)return;closeGame();await current.importLegacy();guard();if(!ended&&current===playHost)notice('이전 기록을 계정에 가져왔어요. 게임을 다시 열어 주세요.');},'sb-btn soft');importOld.dataset.playAction='import';
    async function resolvePlay(choice){const current=playHost;if(!current)return;closeGame();await current.resolve(choice);guard();if(!ended&&playHost===current)notice('진도를 다시 확인했어요. 게임을 다시 열어 주세요.');}
    function renderPlayStatus(value){
      playState=value||{phase:'offline'};const phase=playState.phase;
      playStatus.textContent=preview?'미리보기에서는 코인과 게임 기록을 저장하지 않아요.':localConnection?'수업 개발 연결이에요. 코인과 구매품은 정식 WORLD 로그인 후 연결돼요.':data.account.status!=='active'?'활성화된 WORLD 계정에서 게임 기록을 이어갈 수 있어요.':phase==='synced'?'코인·구매한 물건·게임 진도가 계정에 연결됐어요. / Your coins, items and progress are connected.':phase==='saving'?`게임 기록을 계정에 저장하고 있어요. / Saving your game records…${playState.pending?` (${playState.pending})`:''}`:phase==='loading'?'계정의 게임 기록을 불러오고 있어요. / Loading your game records…':phase==='conflict'?'다른 기기의 진도가 달라요. 사용할 진도를 골라 주세요. 코인과 구매품은 계정 기록을 유지해요. / Choose progress to keep. Account coins and purchases stay unchanged.':`${playState.message||'게임 기록을 불러오지 못했어요.'} 게임 기록 다시 연결을 눌러 주세요. / Reconnect your game records before opening a game.`;
      if(phase==='stopped')playStatus.textContent='계정 연결이 종료됐어요. 다시 로그인해 주세요. / Account connection ended. Sign in again.';
      if(phase==='synced'&&playState.rejected)playStatus.textContent=`${playState.message} / Connected. Unprocessed requests are kept on this device; other progress can still be saved.`;
      playRetry.textContent=phase==='stopped'?'다시 로그인하기':'게임 기록 다시 연결';
      playRetry.hidden=preview||localConnection||data.account.status!=='active'||phase==='synced'||phase==='saving'||phase==='conflict';playRetry.disabled=phase==='loading';useRemote.hidden=phase!=='conflict';useLocal.hidden=phase!=='conflict'||playState.code==='IMPORT_CONFLICT';importOld.hidden=preview||!playState.canImport||phase!=='synced';
      if(playState.code==='IMPORT_CONFLICT')playStatus.textContent='계정에 이미 게임 기록이 있어 이전 브라우저 기록을 합치지 않았어요. 계정 진도를 선택해 주세요. 이전 기록은 이 기기에 보존돼요.';
      if(phase==='conflict'||phase==='stopped')closeGame();
    }
    function renderPlayFailure(current,error){const state=current.status?.();renderPlayStatus(['conflict','stopped'].includes(state?.phase)?state:{phase:'offline',message:error.message});}
    playActions.append(playRetry,useRemote,useLocal,importOld);world.append(playStatus,playActions);renderPlayStatus(playState);
    if(!preview&&data.account.status==='active'&&client.play){
      const owner=data.account.synk_user_id;
      playHost=createWorldPlayHost({accountId:owner,client:client.play,guard,onStatus:value=>{if(!ended&&data?.account?.synk_user_id===owner)renderPlayStatus(value);}});
      window.SYNKPlayHost=playHost;const current=playHost;
      void current.ready().catch(error=>{if(!ended&&playHost===current)renderPlayFailure(current,error);});
    }else renderPlayStatus({phase:'offline'});
    wardrobeView = createWardrobeView({ owner: data.account.synk_user_id, client, guard, preview });world.append(wardrobeView.element);
    if (!preview) {
      const accountKey = (connected ? data.account.synk_user_id : `local:${data.account.synk_user_id}`)+(classConnection?`:class:${classConnection.classId}`:'');
      const learningRevision=context?.learning?.revision||data.learning.revision;
      const storage = scopedStorage(localStorage, accountKey, learningRevision, guard);
      const personalKey = personalConnected ? data.account.synk_user_id : `local:${data.account.synk_user_id}`;
      const personalMemory = { accountKey: personalKey, revision: data.learning.revision, connected: personalConnected,
        storage: scopedStorage(localStorage, personalKey, data.learning.revision, guard), transport: client.memory };
      // The page's own engine builds the account-wide adapter; a game frame only builds its coach.
      host = createWorldLearningHost({ accountKey, revision: learningRevision, storage, connected, engine: window.SynkLearning?.engine,
        transport: classConnection?.client.learning||client.learning, personalMemory, guard, onStatus: state => { if (!ended) renderLearningStatus(state); } });
      window.SYNKLearningHost = host;document.addEventListener?.('visibilitychange', visibility);window.addEventListener?.('online',online);
      const preferences=host.preferences?.();
      if(preferences){
        const panel=element('section',null,'world-preferences'), choices=[];
        panel.append(element('h3','나에게 맞게 연습해요'),element('p',personalConnected?'고른 도움 방식은 개인 연습·수업·다른 기기에서 이어져요. 오늘 컨디션은 이 기기에만 남아요.':'고른 도움 방식과 오늘 컨디션은 이 기기에만 남아요. 계정 학습 연결을 켜면 새로 고르는 도움 방식을 다른 기기에서도 이어갈 수 있어요.','small'));
        const render=()=>{try{const support=preferences.presentation()?.support??null,today=preferences.today();for(const [b,kind,value]of choices)b.setAttribute('aria-pressed',String((kind==='help'?support:today)===value));}catch{for(const [b]of choices)b.disabled=true;}};
        for(const [kind,label,values]of [['help','도움은 어떻게 받을까요?',[['step','단계별로 도와줘요'],['choose','그때그때 맞춰 줘요'],['independent','혼자 해 볼게요']]],['today','오늘은 어때요?',[['good','좋아요'],['okay','보통이에요'],['tired','피곤해요'],['no_time','시간이 없어요']]]]){
          const group=element('div',null,'world-preference-group');group.setAttribute('role','group');group.setAttribute('aria-label',label);group.append(element('p',label));
          const row=element('div',null,'world-preference-choices');
          for(const [value,text]of values){const b=button(text,async()=>{if(kind==='today')preferences.setToday(preferences.today()===value?null:value);else {const current=preferences.presentation()||{};preferences.setPresentation({...current,support:current.support===value?'choose':value});}render();},'sb-btn soft');b.dataset[kind]=value;choices.push([b,kind,value]);row.append(b);}group.append(row);panel.append(group);
        }
        stopPreferences=preferences.subscribe(render);render();world.append(panel);
      }
    }
    const links = element('div', null, 'game-links'), frame = element('iframe');gameFrame=frame;frame.hidden = true;frame.title = 'WORLD 학습 게임';frame.allow = 'autoplay; fullscreen';
    async function openGame(path){
      guard();if(opening||!WORLD_GAMES.some(game=>game.path===path))return;
      if(preview){notice('로컬 화면 예시에서는 실제 게임 계정 연결을 시작하지 않아요.');return;}
      if(localConnection&&path!=='learning-hub'){await onGameRequest?.(path);return;}
      if(!playHost){renderPlayStatus({phase:'offline'});throw new Error('게임 저장을 연결한 뒤 다시 시작해 주세요.');}
      opening=true;pendingPath=path;closeGame();const currentPlay=playHost,currentHost=host,generation=gameGeneration;
      try{await currentPlay.retry();guard();if(ended||currentPlay!==playHost||generation!==gameGeneration)return;
        if(currentPlay.status?.().phase==='conflict')throw new Error('사용할 게임 진도를 먼저 골라 주세요.');
        if((localConnection||classConnection)&&path!=='learning-hub'){await onGameRequest?.(path);pendingPath=null;return;}
        await currentHost?.ready();guard();if(ended||host!==currentHost||currentPlay!==playHost||generation!==gameGeneration)return;
        frame.src=worldGameHref(path);frame.hidden=false;pendingPath=null;
      }catch(error){if(!ended&&currentPlay===playHost){renderPlayFailure(currentPlay,error);throw error;}}
      finally{opening=false;}
    }
    for (const { path, label } of WORLD_GAMES) links.append(button(label,()=>openGame(path),'sb-glass'));
    world.append(links, frame);
    if(!preview&&!playEntryUsed){playEntryUsed=true;const entry=takeWorldPlayEntry();if(entry)void action(()=>openGame(entry));}
  }
  async function load({ preserveWorld = false } = {}) {
    const version=++loadVersion,result = await client.load();guard();if (ended || version!==loadVersion || learningPending) return;
    if(classConnection){const context=await classConnection.client.load();guard();if(ended || version!==loadVersion)return;if(context?.account?.synk_user_id!==result.account?.synk_user_id)throw new Error('수업 계정이 바뀌었어요. 다시 로그인해 주세요.');result.classroom=context;classConnection.onContext?.(context);}
    if(preserveWorld && !classConnection && applyAccount(result))return;
    learningUnconfirmed=false;data = result;render();
  }
  // A foreground account read may update labels and device sessions without
  // replacing the running WORLD host. Changed identity/consent requires re-entry.
  function applyAccount(result) {
    guard();if(ended || !data || !result?.account?.synk_user_id)return false;
    const binding=value=>JSON.stringify([value.account?.synk_user_id,value.account?.status,value.learning?.revision,value.learning?.enabled,value.capabilities?.learningSync]);
    if(binding(result)!==binding(data))return false;
    // A read started before a consent write must not restore the old WORLD host.
    if(learningPending)return true;
    if(learningUnconfirmed)return false;
    loadVersion++;
    const {classroom,...current}=data;
    if(JSON.stringify(current)===JSON.stringify(result))return true;
    data={...result,...(classroom?{classroom}:{})};render(true);return true;
  }
  // What Atlas keeps for this account, as other SYNK products read it. An older server without the
  // summary leaves the card saying so; the rest of the account screen does not wait for it.
  async function atlas(target) {
    let result;
    try { result = typeof client.atlasSummary === 'function' ? await client.atlasSummary() : null;guard(); }
    catch { if (!ended) target.replaceChildren(element('h3', '아틀라스가 기억하는 나'), element('p', '요약은 아직 준비 중이에요. 연습과 계정은 그대로 쓸 수 있어요.', 'small'));return; }
    if (ended) return;
    if (!result?.summary) { target.replaceChildren(element('h3', '아틀라스가 기억하는 나'), element('p', '현재 보여 줄 요약이 없어요. 계정과 연습은 계속 사용할 수 있어요.', 'small'));return; }
    const { summary } = result, rows = [];
    const chosen = Object.entries(summary.presentation || {}).filter(([key, value]) => SETTING_WORDS[key]?.[value]).map(([key, value]) => SETTING_WORDS[key][value]);
    rows.push(chosen.length ? `고른 설정 · ${chosen.join(' · ')}` : '고른 설정 · 아직 없어요');
    const reasons = (summary.reasons || []).map(reason => REASON_WORDS[reason]).filter(Boolean);
    rows.push(reasons.length ? `배우는 이유 · ${reasons.join(' · ')}` : '배우는 이유 · 아직 밝히지 않았어요');
    // Practice a declared reason picked, with Vellum's line. WORLD opens it from its game list below.
    // The SYNK ID portal names the game without a link: since 2026-10-05 synk.im does not link into
    // the games (they stay published at /try/, unlinked).
    const picks = picksForReasons(summary.forReasons);
    for (const pick of picks) rows.push(`이 이유로 고른 연습 · ${pick.label} — ${pick.line}`);
    // A sentence said where each reason leads (Strata's example layer), also for a reason no game serves.
    for (const said of sentencesForReasons(summary.forReasons, picks)) rows.push(`이 이유로 고른 말 · ${said.label} — “${said.ko}”`);
    const practice = summary.practice || {};
    rows.push(practice.answered ? `연습 · ${practice.answered}문항 · 혼자 맞힌 문항 ${practice.independent} · 도움 받은 문항 ${practice.assisted}` : '연습 · 아직 저장된 연습이 없어요');
    for (const skill of (practice.skills || []).slice(0, 3)) rows.push(skill.line);
    target.replaceChildren(element('h3', '아틀라스가 기억하는 나'), list(rows, ''),
      element('p', result.shared === 'practice-and-settings'
        ? '다른 SYNK 앱도 이 요약으로 시작해요. 직접 고른 것과 실제 연습에서만 나오며, 나이·성별이나 성격은 짐작하지 않아요.'
        : '학습 기록 저장이 꺼져 있어 다른 SYNK 앱에는 직접 밝힌 배우는 이유만 전해요.', 'small'));
  }
  function render(keepWorld = false) {
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
    input.disabled = learningPending || learningUnconfirmed || !input.checked && !canEnable;input.indeterminate=learningUnconfirmed;
    input.onchange = () => {
      if(ended || learningPending || learningUnconfirmed)return;
      const enabled=input.checked, revision=data.learning.revision;
      learningPending=true;learningUnconfirmed=true;loadVersion++;input.disabled=true;input.indeterminate=true;if(!enabled)stopWorld();
      void action(async()=>{
        if(enabled && !canEnable)throw new Error('현재는 계정 학습 연결을 켤 수 없어요.');
        await client.setLearning(enabled,revision);guard();if(ended)return;
        learningPending=false;await load();if(!ended && !learningUnconfirmed)notice(data.learning?.enabled ? '학습 기록 연결에 동의했어요.' : '학습 기록 연결을 껐어요.');
      }).finally(()=>{learningPending=false;if(!ended)render(true);});
    };
    toggle.append(input, element('span', '계정에 학습 기록 연결'));learning.append(toggle);
    if(learningUnconfirmed){
      learning.append(element('p',learningPending?'학습 연결 변경 결과를 확인하고 있어요.':'학습 연결 변경 결과를 확인하지 못했어요. 상태를 다시 확인한 뒤 연습을 이어 주세요.','small'));
      if(!learningPending){const retry=button('학습 연결 상태 다시 확인',async()=>{await load();if(!ended && !learningUnconfirmed)notice('현재 학습 연결 상태를 확인했어요.');},'sb-btn soft');retry.dataset.action='retry-learning-consent';learning.append(retry);}
    }
    if (!canEnable) learning.append(element('p', deleting ? (pendingDeletion ? '삭제 요청을 받아 학습 연결을 켤 수 없어요. 아래에서 요청을 취소하면 다시 켤 수 있어요.' : '삭제 요청을 처리하고 있어 학습 연결을 켤 수 없어요.') : '계정 학습 연결은 아직 제공 전이에요. 이 계정의 기기 내 연습은 계속할 수 있어요.', 'small'));
    const memory = card('아틀라스가 기억하는 나');memory.classList.add('atlas-card');memory.append(element('p', '요약을 불러오고 있어요.', 'small'));void atlas(memory);
    const rights = card('이용 권한');rights.append(list((data.entitlements || []).map(e => `${e.key}${e.product ? ` · ${e.product}` : ''}${e.status ? ` · ${e.status}` : ''}${e.valid_until ? ` · ${new Date(e.valid_until).toLocaleDateString('ko-KR')}까지` : ''}`), '현재 표시할 이용 권한이 없어요.'));
    const sessions = card('연결된 로그인');
    for (const session of data.sessions || []) { const row = element('div', null, 'session-row');row.append(element('p', `${session.label || session.product || '로그인'}${session.current ? ' · 현재' : ''}${session.revoked ? ' · 종료됨' : ''}`, 'small'));if (!session.revoked) row.append(button('종료', async () => { if (session.current) await signOut();else { await client.revokeSession(session.id);await load({preserveWorld:true}); } }));sessions.append(row); }
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
    if(!keepWorld)games();
  }
  async function launchRun(run){
    guard();if(ended||!(localConnection||classConnection)||!host||!gameFrame||!data.learning?.enabled||classConnection&&!data.classroom?.sharing?.enabled)throw new Error('먼저 WORLD 학습 연결을 확인해 주세요.');
    const paths={'korean-racing':'/korean-racing/','korean-runner':'/korean-runner/','korean-rhythm':'/korean-rhythm/','order-rush':'/order-rush/','entry-check':'/entry-check/','story-classroom':'/story-classroom/','blank-slice':'/blank-slice/','synk-town':'/synk-town/linked.html'};
    const url=new URL(run?.href||'',location.href);if(!paths[run?.gameId]||url.origin!==location.origin||url.pathname!==paths[run.gameId]||url.hash)throw new Error('지원하는 WORLD 게임 주소가 아니에요.');
    closeGame();const currentHost=host,currentPlay=playHost,generation=gameGeneration;
    if(!localConnection){if(!currentPlay)throw new Error('게임 기록을 계정에 연결한 뒤 다시 시작해 주세요.');
      await currentPlay.ready();guard();if(currentPlay!==playHost||currentPlay.status?.().phase==='conflict')throw new Error('게임 기록을 다시 확인해 주세요.');}
    await currentHost.ready();guard();
    if(ended||host!==currentHost||generation!==gameGeneration)throw Object.assign(new Error('게임 연결이 바뀌었어요. 다시 시작해 주세요.'),{code:'RUN_ENDED'});
    host.beginRun(run);
    if(run.gameId==='synk-town'){
      const current=()=>{guard();if(ended||generation!==gameGeneration)throw new Error('Town 연결이 끝났어요.');};
      const townClient=classConnection?.client||client;
      window.SYNKTownHost=classConnection
        ?createClassroomTownHost({client:townClient,classId:classConnection.classId,learnerId:classConnection.learnerId,guard:current})
        :Object.freeze({async read(){current();const result=await townClient.townRead();current();return result;},async command(payload){current();const result=await townClient.townCommand(payload);current();return result;}});
    }
    if(classConnection)url.pathname=run.gameId==='synk-town'?new URL('../synk-town/linked.html',location.href).pathname:new URL(worldGameHref(run.gameId)).pathname;
    gameFrame.src=url.href;gameFrame.hidden=false;world.hidden=false;gameFrame.scrollIntoView?.({behavior:'smooth',block:'start'});
  }
  return { load,applyAccount,launchRun,closeGame, stop() { ended = true;loadVersion++;document.body.classList.remove('account-open');stopWorld();root.replaceChildren();root.hidden = true; } };
}
