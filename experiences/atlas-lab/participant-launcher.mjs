// Creates local synthetic sessions only after an explicit click. No paid services.
export function mountParticipantLauncher({ root = document, getSeed }) {
  const area = root.getElementById('journey-participants');
  const make = (tag, text) => { const el = root.createElement(tag); el.textContent = text; return el; };
  let seed = getSeed(), busy = false, createButton = null;
  const enabled = area.dataset.localHost === 'optional' && ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
  function render() {
    createButton = null;
    area.replaceChildren(make('h3', '두 창에서 각자 답해 보기'));
    area.append(make('p', '같은 기기의 두 창에서 각자 동의하고 답하는 로컬 체험이에요. 고정된 가상 성인 역할이며 실제 계정 인증이나 소개 전송은 아니에요.'));
    if (!enabled) { area.append(make('p', '이 연결은 로컬 체험 서버에서만 사용할 수 있어요.')); return; }
    if (!seed) { area.append(make('p', '위에서 후보를 고르면 두 역할의 체험 창을 열 수 있어요.')); return; }
    const b = make('button', '이 후보와 두 역할 창 준비하기'); b.className = 'slab'; b.type = 'button'; b.dataset.participantAction = 'create'; b.disabled = busy;
    createButton = b;
    b.onclick = async () => {
      if (busy) return;
      busy = true; b.disabled = true; const selectedKey = seed.key;
      const notice = make('p', '별도 체험을 준비하고 있어요.'); notice.setAttribute('role', 'status'); area.append(notice);
      try {
        const response = await fetch('/api/atlas-journey/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: crypto.randomUUID(), seed }) });
        const data = await response.json(); if (!response.ok) throw new Error('host-unavailable');
        if (seed?.key !== selectedKey || createButton !== b) { notice.textContent = '후보가 달라졌어요. 현재 선택으로 다시 준비해 주세요.'; return; }
        notice.textContent = '각 링크는 한 번만 들어갈 수 있어요. 다른 역할의 답은 해당 창에서 직접 입력해 주세요. 이 별도 체험은 현재 탭의 만남 기록을 복사하지 않아요.';
        const links = make('div', ''); links.className = 'interpret-actions';
        for (const person of data.participants) {
          const link = make('a', `${person.label}의 창 열기`); link.className = 'slab'; link.target = '_blank'; link.rel = 'noreferrer noopener'; link.dataset.participantRole = person.id;
          link.href = `${location.origin}/atlas-lab/participant.html#cap=${encodeURIComponent(person.capability)}`; links.append(link);
        }
        area.append(links); b.hidden = true;
      } catch { notice.textContent = '이 서버에서는 별도 창을 준비하지 못했어요. 로컬 체험 서버에서 다시 시도해 주세요.'; }
      finally { busy = false; if (createButton === b) b.disabled = false; else render(); }
    };
    area.append(b);
  }
  render(); return Object.freeze({ setSeed(value) { seed = value; render(); } });
}
