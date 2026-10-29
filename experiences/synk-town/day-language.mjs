/** The notebook's language preference. The server owns each choice; an open scene keeps its L. The widening question is
 * the mascot's (day-ask.mjs draws view.ask kind widen, W9): this module only asks the host for it as a scene ends. */
export function createLanguageSettings(settings, { command, readContext = () => ({}) }) {
  const field = document.createElement('fieldset'); field.className = 'sound-settings language-settings'; field.hidden = true;
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
  let busy = false;
  return { update(language) { field.hidden = language?.version !== 1; if (field.hidden) return;
    for (const [channel, row] of rows) { const seat = language.ladder?.[channel]; row.note.textContent = seat?.fixed ? '내가 고른 말로 이어 가요.' : '도움이 필요했던 이야기를 보고 맞춰요.';
      for (const button of row.buttons) if (['auto', 'always-easy'].includes(button.dataset.choice)) button.setAttribute('aria-pressed', String(button.dataset.choice === 'auto' ? !seat?.fixed : seat?.fixed && seat.stable === 'L1'));
    }
  },
  /** A scene just ended (format: its response format — the conversation single-choice, the tea order cup-compose). Only when
   * the host says a question could still stand today (askReady — a host from before W9 never does, so no offer is made that
   * this screen would not draw) does it ask; the host alone reads the whole learning record and decides. */
  async boundary(language, now, format) {
    if (busy || language?.version !== 1 || language.askReady !== true) return;
    let context = {}; try { context = readContext() || {}; } catch { return; }
    const row = language.ladder.reading;
    // The screen only suppresses a question for a personal choice or a low day, and never claims a partial local summary is evidence.
    if (row.fixed || row.stable === 'L4' || ['tired', 'no_time'].includes(context.today?.condition)) return;
    busy = true; try { await command('LANGUAGE_OFFER', { channel: 'reading', ...(format ? { format } : {}), ...(context.today?.condition ? { condition: context.today.condition } : {}) }); } finally { busy = false; }
  } };
}
