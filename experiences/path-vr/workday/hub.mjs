/** 직업 고르기. The catalogue (jobs/index.json) decides what is listed and what is open.
 * Every job is a card in one grid with its place photograph and its role name large, so the whole list
 * reads at a glance. An open job adds the scene count, the length and one decision button; a job that is
 * still being made carries a 「만드는 중」 flag and cannot be entered. A job without a usable photograph
 * shows its role name on a plain panel instead. */
const list = document.getElementById('jobs'), status = document.getElementById('hub-status');
const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const ARROW = 'M5 12h14m-6-6 6 6-6 6';
const PHOTO = /^[a-z0-9-]+\/places\/[a-z0-9-]+\.(?:jpg|webp)$/;

function card(job, position) {
  const open = job.status === 'open', name = job.role || job.title;
  const item = document.createElement('li');
  const box = make(open ? 'a' : 'div', `job ${open ? 'open' : 'making'}`);
  if (open) box.href = `./play.html?job=${encodeURIComponent(job.id)}`;
  const visual = make('div', 'job-visual');
  const plain = () => { box.classList.add('no-photo'); const word = make('p', 'job-word', name); word.setAttribute('aria-hidden', 'true'); visual.prepend(word); };
  if (typeof job.poster === 'string' && PHOTO.test(job.poster) && job.poster.startsWith(`${job.id}/`)) {
    const photo = Object.assign(document.createElement('img'), { src: new URL(`./jobs/${job.poster}`, import.meta.url).href, alt: job.posterAlt || '', decoding: 'async', loading: position < 3 ? 'eager' : 'lazy', width: 1920, height: 1080 });
    photo.addEventListener('error', () => { photo.remove(); plain(); }, { once: true });
    visual.append(photo);
  } else plain();
  visual.append(make('span', 'job-flag', open ? '지금 할 수 있어요' : '만드는 중'));
  const body = make('div', 'job-body');
  body.append(make('h2', 'job-role', name), make('p', 'job-summary', job.summary || ''));
  if (open) {
    const facts = [job.scenes ? `장면 ${job.scenes}개` : '', job.minutes ? `${job.minutes}분쯤` : ''].filter(Boolean);
    if (facts.length) { const meta = make('p', 'job-meta'); meta.append(...facts.map((fact) => make('span', '', fact))); body.append(meta); }
    const go = make('span', 'job-go', '이 일터로 가기');
    go.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ARROW}"/></svg>`);
    body.append(go);
  }
  box.append(visual, body); item.append(box);
  return item;
}

try {
  const response = await fetch(new URL('./jobs/index.json', import.meta.url), { cache: 'no-store' });
  if (!response.ok) throw new Error(String(response.status));
  const index = await response.json();
  const jobs = (index.jobs || []).filter((job) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(job.id || '') && typeof job.title === 'string');
  const ordered = [...jobs.filter((job) => job.status === 'open'), ...jobs.filter((job) => job.status !== 'open')];
  list.replaceChildren(...ordered.map(card));
  if (!jobs.length) throw new Error('empty');
} catch {
  status.hidden = false;
  status.textContent = '직업 목록을 불러오지 못했어요. 인터넷 연결을 확인하고 새로 고쳐 주세요.';
}
