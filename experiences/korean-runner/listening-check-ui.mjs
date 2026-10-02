import { LISTENING_CHECKS, createListeningCheck, checkMetadata } from './listening-check.mjs';
import { InstructionAudio } from './audio.mjs';
export function mountListeningCheck({ coach, beforeOpen, onClose = () => {} }) {
  const $ = id => document.getElementById(id), dialog = $('listening-check-dialog');
  let check = null, context, bank, gain, round = [], index = 0, epoch = 0, pending = false;
  const status = text => { $('check-status').textContent = text; };
  const choicesDisabled = value => { for (const button of $('check-choices').children) button.disabled = value; };
  function interrupt() {
    epoch++; pending = false; bank?.stop();
    if (check?.current && !check.current.answered) { check.delivery(check.current.token, 'failed'); choicesDisabled(true); status('소리가 멈췄어요. 다시 들은 뒤 답해 주세요.'); $('check-replay').disabled = false; }
  }
  function close() { interrupt(); check?.cancel(); dialog.close(); $('check-choices').replaceChildren(); $('check-feedback').textContent = ''; onClose(); }
  async function play(replay = false) {
    if (!check?.current || pending || check.current.answered) return;
    const mine = ++epoch, token = check.current.token, item = check.current.item;
    pending = true; choicesDisabled(true); $('check-replay').disabled = true; status('목소리를 준비하고 있어요.');
    try {
      if (replay) check.replay();
      if (!context || context.state === 'closed') {
        const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) throw Error();
        context = new Audio(); gain = context.createGain(); gain.gain.value = .88; gain.connect(context.destination);
        const music = context.createGain();
        bank = new InstructionAudio(context, gain, music);
        context.onstatechange = () => { if (dialog.open && context.state !== 'running' && pending) interrupt(); };
      }
      // Install a per-play callback: delayed callbacks from a previous question are ignored.
      bank.onState = (audio, played) => {
        if (!dialog.open || mine !== epoch || played.checkToken !== check?.current?.token) return;
        check.delivery(played.checkToken, audio);
        if (audio === 'completed') { pending = false; choicesDisabled(false); $('check-replay').disabled = false; status('들은 내용과 같은 행동을 골라 주세요. 시간 제한은 없어요.'); }
      };
      if (!await bank.resume() || !await bank.prepare([item])) throw Error();
      if (mine !== epoch || !dialog.open) return;
      status('지시를 듣고 있어요…'); if (!bank.play({ ...item, checkToken: token })) throw Error();
    } catch {
      if (mine !== epoch || !dialog.open) return; check.delivery(token, 'failed'); pending = false;
      status('음성을 불러오지 못했어요. 듣기 실력의 오답으로 기록하지 않아요.'); $('check-replay').disabled = false;
    }
  }
  function question() {
    const item = round[index]; check.begin(item); $('check-count').textContent = `${index + 1} / ${round.length}`;
    $('check-feedback').textContent = ''; $('check-next').hidden = true;
    $('check-choices').replaceChildren(...item.choices.map((label, choice) => {
      const button = document.createElement('button'); button.textContent = label; button.className = 'check-choice'; button.dataset.choice = choice; button.disabled = true;
      button.onclick = () => {
        const result = check.answer(choice); if (!result) return;
        choicesDisabled(true); $('check-replay').disabled = true;
        $('check-feedback').textContent = `${choice === item.correct ? '맞았어요.' : '다시 확인해요.'} “${item.text}” ${result.verdict === 'unassessed' ? '기록 연결을 확인하지 못해 이해도 근거에는 넣지 않았어요.' : result.independent ? '처음 듣고 혼자 답한 기록이에요.' : result.assisted ? '다시 듣기 도움을 받은 기록이에요.' : '이미 만난 표현의 복습 기록이에요.'}`;
        $('check-next').hidden = false; $('check-next').textContent = index === round.length - 1 ? '확인 마치기' : '다음 지시 듣기'; status('달리기 동작 점수와 별도로 기록했어요.');
      }; return button;
    }));
    play();
  }
  async function open() {
    if (!beforeOpen() || dialog.open) return;
    if (!coach) { status('학습 기록을 준비하지 못했어요. 앱을 다시 열어 주세요.'); dialog.showModal(); return; }
    try {
      check ||= createListeningCheck(coach);
      const candidates = LISTENING_CHECKS.map(item => ({ ...item, ...checkMetadata(item), id: item.id, skillIds: [checkMetadata(item).skillId] }));
      const selected = coach.recommend(candidates, { audioAvailable: true })?.selected;
      round = [...LISTENING_CHECKS].sort((a, b) => Number(b.id === selected?.id) - Number(a.id === selected?.id)); index = 0;
      dialog.showModal(); question();
    } catch { close(); }
  }
  $('listening-check').onclick = open; $('result-listening-check').onclick = open;
  $('check-replay').onclick = () => play(true); $('check-close').onclick = close;
  $('check-next').onclick = () => { if (!check?.current?.answered) return; if (++index >= round.length) close(); else question(); };
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && dialog.open) interrupt(); });
  addEventListener('pagehide', close);
  return { interrupt, get open() { return dialog.open; } };
}
