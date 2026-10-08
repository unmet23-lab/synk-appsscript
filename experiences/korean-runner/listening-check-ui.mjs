// 듣기 확인 판: 달리지 않고 MP3를 끝까지 들은 뒤 들은 행동을 쿠션 카드 셋에서 고른다(한 번에 한 문제, 문장은 답한 뒤에 보인다).
// 기록 규칙은 listening-check.mjs가 맡는다. 이 파일은 화면만: 끝까지 듣기 전에는 카드를 잠그고, 들은 뒤의 다시 듣기만 도움으로 남기고,
// 답한 뒤 다시 듣기는 재채점 없이 복습한다. 소리가 끊기면 다시 들은 뒤 답하게 한다.
// 요소 이름(#listening-check·#check-choices button 등)은 WORLD 확인 도구가 그대로 쓴다.
import { createListeningCheck, createListeningCheckRound, listeningCheckFeedback } from './listening-check.mjs';
import { InstructionAudio } from './audio.mjs';
import { fitText } from './kit/lab.mjs';

export function mountListeningCheck({ coach, beforeOpen, onClose = () => {} }) {
  const $ = (id) => document.getElementById(id), dialog = $('listening-check-dialog');
  let check = null, context, bank, gain, round = null, index = 0, epoch = 0, pending = false, rightCount = 0, stopped = false, recheckSource = null;
  const status = (text) => { $('check-status').textContent = text; };
  const phase = (p) => { $('check-q').dataset.phase = p; };
  const choicesDisabled = (value) => {
    for (const button of $('check-choices').children) button.disabled = value;
    $('check-choices').classList.toggle('waiting', value && !check?.current?.answered);
  };
  const reviewReady = (text = '정답과 해설을 보며 다시 들었어요. 처음 고른 답과 기록은 그대로예요.') => { choicesDisabled(true); $('check-replay').disabled = false; phase('answered'); status(text); };
  const ready = () => { if (check?.current?.answered) { reviewReady(); return; } choicesDisabled(false); $('check-replay').disabled = false; phase('ready'); status('들은 내용과 같은 행동을 골라 주세요. 시간 제한은 없어요.'); };
  const nextLabel = (text) => { $('check-next').querySelector('span').textContent = text; };
  // 끝까지 듣기 전에 끊긴 재생은 아직 못 들은 것이다. 한 번 끝까지 들었으면 끊긴 다시 듣기는 아무것도 바꾸지 않는다(답은 열려 있다).
  function interrupt() {
    epoch++; pending = false; bank?.stop();
    const now = check?.current;
    if (!now) return;
    if (now.answered) { reviewReady('다시 듣기를 멈췄어요. 정답과 해설을 확인한 뒤 다음으로 갈 수 있어요.'); return; }
    if (now.audio === 'completed') { ready(); return; }
    check.delivery(now.token, 'failed'); choicesDisabled(true); phase('stopped'); status('소리가 멈췄어요. 다시 들은 뒤 답해 주세요.'); $('check-replay').disabled = false;
  }
  // 계정이 기록을 거절해도(끝난 WORLD 과제 등) 판이 열린 채 남지 않게 한다.
  function close() {
    recheckSource = null;
    interrupt(); try { check?.cancel(); } catch { /* 이미 끝난 과제: 더 남길 것이 없다 */ }
    if (dialog.open) dialog.close();
    $('check-choices').replaceChildren(); $('check-feedback').textContent = ''; onClose();
  }
  async function play(replay = false) {
    if (!check?.current || pending) return;
    const mine = ++epoch, token = check.current.token, item = check.current.item;
    pending = true; choicesDisabled(true); $('check-replay').disabled = true; phase(check.current.answered ? 'reviewing' : 'listening'); status(check.current.answered ? '정답과 해설을 보며 다시 들어요. 답은 다시 채점하지 않아요.' : '목소리를 준비하고 있어요.');
    try {
      if (replay) check.replay();
      if (!context || context.state === 'closed') {
        const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) throw Error();
        context = new Audio(); gain = context.createGain(); gain.gain.value = 0.88; gain.connect(context.destination);
        const music = context.createGain();
        bank = new InstructionAudio(context, gain, music);
        context.onstatechange = () => { if (dialog.open && context.state !== 'running' && pending) interrupt(); };
      }
      // 재생마다 새 알림을 건다: 앞 문제의 늦은 알림은 무시된다.
      bank.onState = (audio, played) => {
        if (!dialog.open || mine !== epoch || played.checkToken !== check?.current?.token) return;
        if (!check.current.answered) check.delivery(played.checkToken, audio);
        if (audio === 'completed') { pending = false; ready(); }
      };
      if (!await bank.resume() || !await bank.prepare([item])) throw Error();
      if (mine !== epoch || !dialog.open) return;
      status(check.current.answered ? '해설을 보며 다시 듣고 있어요. 처음 답은 다시 채점하지 않아요.' : '지시를 듣고 있어요…'); if (!bank.play({ ...item, checkToken: token })) throw Error();
    } catch {
      if (mine !== epoch || !dialog.open) return; pending = false;
      if (check.current?.answered) { reviewReady('복습 음성을 불러오지 못했어요. 처음 고른 답과 기록은 그대로예요. 해설을 읽거나 다시 듣기를 눌러 주세요.'); return; }
      check.delivery(token, 'failed');
      if (check.current?.audio === 'completed') { ready(); return; }
      phase('stopped'); status('음성을 불러오지 못했어요. 이 문제는 틀린 것으로 기록하지 않아요.'); $('check-replay').disabled = false;
    }
  }
  function question(plan) {
    recheckSource = plan.followup?.status === 'new' ? plan.followup.sourceAttemptId : null;
    const item = plan.item; index = plan.index; dialog.dataset.item = item.id; check.begin(item); $('check-count').textContent = `${index + 1} / ${round.total}`;
    $('check-plan').textContent = plan.note;
    $('check-feedback').textContent = ''; $('check-next').hidden = true;
    $('check-choices').replaceChildren(...item.choices.map((label, choice) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = `choice c${choice}`; button.dataset.choice = choice; button.disabled = true;
      button.setAttribute('aria-label', `${choice + 1}번: ${label}`);
      button.innerHTML = `<span class="no" aria-hidden="true">${choice + 1}</span><span class="lbl"></span>`;
      button.querySelector('.lbl').textContent = label;
      button.onclick = () => {
        const result = check.answer(choice); if (!result) return;
        const sourceAttemptId = recheckSource; recheckSource = null;
        let recheckLine = '';
        if (sourceAttemptId && result.eventId) {
          try { const line = coach.recheck?.(sourceAttemptId, result.eventId)?.line; if (typeof line === 'string') recheckLine = line; }
          catch { /* old bundle or unavailable history: keep the original answer */ }
        }
        const right = choice === item.correct; if (right) rightCount += 1;
        choicesDisabled(true); $('check-replay').disabled = false; phase('answered');
        for (const b of $('check-choices').children) {
          const i = Number(b.dataset.choice);
          b.classList.toggle('chosen', i === choice); b.classList.toggle('right', i === item.correct); b.classList.toggle('dim', i !== choice && i !== item.correct);
        }
        const fb = $('check-feedback'); fb.textContent = '';
        const quote = document.createElement('q'); quote.textContent = item.text;
        fb.append(`${right ? '맞았어요.' : '다시 확인해요.'} `, quote);
        const feedback = listeningCheckFeedback(item, choice);
        const selection = document.createElement('span'); selection.className = 'selection'; selection.textContent = `고른 행동: ${feedback.selectedLabel} · 맞는 행동: ${feedback.correctLabel}`; fb.append(selection);
        const explanation = document.createElement('span'); explanation.className = 'explanation'; explanation.textContent = feedback.explanation; fb.append(explanation);
        if (feedback.correction) { const correction = document.createElement('span'); correction.className = 'correction'; correction.textContent = feedback.correction; fb.append(correction); }
        const record = document.createElement('span'); record.className = 'record'; record.textContent = result.verdict === 'unassessed' ? '기록이 제대로 남았는지 확인하지 못해서 듣기 기록에는 넣지 않았어요.' : result.independent ? '처음 듣고 혼자 답한 기록이에요.' : result.assisted ? '다시 듣기 도움을 받은 기록이에요.' : result.exposure === 'repeat' ? '이미 만난 표현의 복습 기록이에요.' : '전에 도움을 받았는지, 이미 들은 문장인지 확인하지 못해서 혼자 해낸 기록으로 세지 않았어요.'; fb.append(record);
        if (recheckLine) { const recheck = document.createElement('span'); recheck.className = 'record'; recheck.textContent = recheckLine; fb.append(recheck); }
        const last = index === round.total - 1;
        if (last) { const sum = document.createElement('span'); sum.className = 'sum'; sum.textContent = `이번 확인: ${round.total}문제 중 ${rightCount}문제를 맞혔어요.`; fb.append(sum); }
        $('check-next').hidden = false; nextLabel(last ? '확인 마치기' : '다음 지시 듣기'); status('정답과 해설을 확인하거나 다시 들을 수 있어요. 다음 단추를 누를 때까지 기다릴게요.');
        $('check-next').focus({ preventScroll: true });
      };
      return button;
    }));
    requestAnimationFrame(() => { for (const b of $('check-choices').children) fitText(b.querySelector('.lbl'), { maxLines: 2, minPx: 13 }); });
    play();
  }
  async function open() {
    if (!beforeOpen() || dialog.open) return;
    rightCount = 0; stopped = false; recheckSource = null;
    if (!coach) { status('학습 기록을 준비하지 못했어요. 앱을 다시 열어 주세요.'); $('check-choices').replaceChildren(); $('check-next').hidden = true; dialog.showModal(); return; }
    try {
      check ||= createListeningCheck(coach);
      round = createListeningCheckRound(coach); index = 0;
      const plan = round.next();
      if (plan.status !== 'ready') { $('check-choices').replaceChildren(); $('check-feedback').textContent = ''; $('check-plan').textContent = ''; $('check-count').textContent = ''; $('check-next').hidden = true; $('check-replay').hidden = true; status('이 목표에 맞는 문항을 준비하지 못했어요. WORLD에서 학습 목표를 다시 확인해 주세요.'); dialog.showModal(); return; }
      $('check-replay').hidden = false;
      dialog.showModal(); question(plan);
    } catch { close(); }
  }
  $('listening-check').onclick = open; $('result-listening-check').onclick = open;
  $('check-replay').onclick = () => play(true); $('check-close').onclick = close;
  $('check-next').onclick = () => {
    if (!check?.current?.answered) return;
    if (stopped) { close(); return; }
    epoch++; pending = false; bank?.stop();
    const plan = round.next(check.current);
    if (plan.status === 'finished') close();
    else if (plan.status === 'ready') question(plan);
    else { stopped = true; status(plan.note); $('check-replay').disabled = false; nextLabel('확인 마치기'); }
  };
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && dialog.open) interrupt(); });
  addEventListener('pagehide', close);
  return {
    interrupt, close,
    get open() { return dialog.open; },
    /** 확인용(?qa): 지금 문제 — 정답 자리와 소리 상태 */
    state: () => { const c = check?.current; return c ? { id: c.item.id, correct: c.item.correct, audio: c.audio, heard: c.heard, answered: c.answered, index, total: round?.total ?? 0, rightCount } : null; },
  };
}
