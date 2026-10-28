/** The notebook's language preference. The server owns each choice; an open scene keeps its L. */
export function createLanguageSettings(settings, { command, readContext = () => ({}), scene = null }) {
  const field = document.createElement('fieldset'); field.className = 'sound-settings'; field.hidden = true;
  const legend = document.createElement('legend'); legend.textContent = '이야기 말'; field.append(legend);
  const rows = new Map();
  for (const [channel, label] of [['reading', '읽는 말'], ['listening', '듣는 말']]) {
    const row = document.createElement('div'), title = document.createElement('p'); title.textContent = label;
    const note = document.createElement('p'); note.className = 'field-note'; row.append(title, note);
    const buttons = [], choices = document.createElement('div'); choices.className = 'options'; choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', label); row.append(choices);
    for (const [choice, words] of [['easier', '한 단계 쉽게'], ['broader', '한 단계 넓게'], ['always-easy', '늘 쉬운 말로'], ['auto', '알아서 맞춰 주세요']]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'felt'; button.textContent = words; button.dataset.choice = choice;
      button.addEventListener('click', async () => { buttons.forEach(b => { b.disabled = true; }); try { await command('LANGUAGE_SET', { channel, choice }); } finally { buttons.forEach(b => { b.disabled = false; }); } });
      buttons.push(button); choices.append(button);
    }
    rows.set(channel, { note, buttons }); field.append(row);
  }
  const note = document.createElement('p'); note.className = 'field-note'; note.textContent = '고른 말은 다음 이야기부터 써요. 듣는 말은 소리로 먼저 듣는 이야기에서 써요.'; field.append(note); settings.append(field);
  let busy = false, dismissed = null;
  const offer = document.createElement('section'); offer.className = 'ask-card'; offer.dataset.kind = 'consent'; offer.hidden = true; offer.setAttribute('aria-label', '내 마스코트의 제안');
  const words = document.createElement('p'); words.className = 'ask-line'; words.textContent = '말을 조금 더 넓혀 볼까요?'; offer.append(words);
  const actions = document.createElement('div'); actions.className = 'ask-actions'; offer.append(actions);
  for (const [choice, label] of [['accepted', '넓혀 볼래요'], ['declined', '지금이 좋아요'], ['later', '나중에']]) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'felt'; b.textContent = label;
    b.addEventListener('click', async () => {
      if (busy) return;
      if (choice === 'later') { dismissed = Number(offer.dataset.at); offer.hidden = true; return; }
      busy = true; try { if (await command('LANGUAGE_ANSWER', { channel: 'reading', choice })) offer.hidden = true; } finally { busy = false; }
    }); actions.append(b);
  }
  scene?.append(offer);
  return { update(language, blocked = false) { field.hidden = language?.version !== 1; if (field.hidden) return;
    for (const [channel, row] of rows) { const seat = language.ladder?.[channel]; row.note.textContent = seat?.fixed ? '내가 고른 말로 이어 가요.' : '도움이 필요했던 이야기를 보고 맞춰요.';
      for (const button of row.buttons) if (['auto', 'always-easy'].includes(button.dataset.choice)) button.setAttribute('aria-pressed', String(button.dataset.choice === 'auto' ? !seat?.fixed : seat?.fixed && seat.stable === 'L1'));
    }
    const last = language.ladder?.reading?.lastOffer; offer.dataset.at = last?.at || '';
    if (blocked && last) dismissed = last.at;
    offer.hidden = blocked || !last || last.answer !== null || dismissed === last.at;
  }, async boundary(language, now) {
    if (busy || language?.version !== 1) return;
    let context = {}; try { context = readContext() || {}; } catch { return; }
    const row = language.ladder.reading;
    // The host reads the complete main learning graph. The screen only suppresses a question
    // for a personal choice/low day, and never claims that a partial local summary is evidence.
    if (row.fixed || row.stable === 'L4' || ['tired', 'no_time'].includes(context.today?.condition)) return;
    busy = true; try { await command('LANGUAGE_OFFER', { channel: 'reading', ...(context.today?.condition ? { condition: context.today.condition } : {}) }); } finally { busy = false; }
  } };
}
