import { readingMetadata, readingAnswer, selectReadingChecks } from './understanding.mjs';
export function mountUnderstanding({ transport, available }) {
  const $ = id => document.getElementById(id), dialog = $('reading-dialog');
  if (!dialog || !transport.linked) return { invalidate() {} };
  let coach, round = [], index = 0, pid, submitted = false, epoch = 0, pending = false;
  // Start downloading earlier learning history before a new first exposure is declared.
  try { coach = globalThis.SynkLearning?.createGame({ gameId: 'synk-town', storage: localStorage }); } catch { /* retry on open */ }
  const clear = () => { epoch++; pid = null; pending = false; dialog.close(); $('reading-passage').textContent = ''; $('reading-choices').replaceChildren(); $('reading-feedback').textContent = ''; };
  const paint = () => {
    const item = round[index]; dialog.dataset.item = item.id; submitted = false; pid = coach.present(readingMetadata(item));
    $('reading-count').textContent = `${index + 1} / ${round.length}`; $('reading-passage').textContent = item.passage;
    $('reading-question').textContent = item.question; $('reading-feedback').textContent = ''; $('reading-next').hidden = true;
    $('reading-hint').disabled = false;
    $('reading-choices').replaceChildren(...item.choices.map((label, choice) => {
      const button = document.createElement('button'); button.className = 'felt-button'; button.textContent = label; button.dataset.answer = choice;
      button.onclick = async () => {
        if (submitted || pending || !available()) return; pending = true; const mine = epoch;
        try {
          await transport.read(); if (mine !== epoch || !available()) return;
          const result = coach.answer(pid, readingAnswer(item, choice)); submitted = true;
          $('reading-feedback').textContent = `${choice === item.correct ? '맞았어요.' : '함께 확인해요.'} ${item.explanation} ${result.independent ? '혼자 답한 읽기 확인으로 기록했어요.' : '도움·다시 풀기 여부를 구분해 기록했어요.'}`;
          for (const node of $('reading-choices').children) node.disabled = true;
          $('reading-hint').disabled = true; $('reading-next').hidden = false; $('reading-next').textContent = index === round.length - 1 ? '읽기 확인 마치기' : '다음 안내문';
        } catch { clear(); } finally { if (mine === epoch) pending = false; }
      }; return button;
    }));
  };
  $('reading-open').onclick = async () => {
    if (!available() || pending) return; const mine = ++epoch; pending = true;
    try {
      await transport.read(); if (mine !== epoch || !available()) return;
      coach ||= globalThis.SynkLearning?.createGame({ gameId: 'synk-town', storage: localStorage });
      if (!coach) throw Error();
      for (let attempt = 0; !transport.learningReady(); attempt++) {
        if (mine !== epoch || !available() || attempt >= 100) throw Error();
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      if (mine !== epoch || !available()) return; round = selectReadingChecks(coach); if (!round.length) throw Error(); index = 0; paint(); dialog.showModal();
    } catch { $('error').textContent = '학습 연결 또는 이 목표에 맞는 문항을 확인하지 못했어요. WORLD에서 목표를 다시 확인해 주세요.'; $('error').hidden = false; }
    finally { if (mine === epoch) pending = false; }
  };
  $('reading-hint').onclick = () => { if (pid && !submitted && available()) { coach.help(pid, 'hint'); $('reading-feedback').textContent = round[index].hint; } };
  $('reading-next').onclick = () => { if (!submitted) return; if (index === round.length - 1) clear(); else { index++; paint(); } };
  $('reading-close').onclick = clear; dialog.addEventListener('cancel', event => { event.preventDefault(); clear(); });
  return { invalidate: clear };
}
