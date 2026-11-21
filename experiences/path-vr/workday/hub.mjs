/** 직업 고르기. The catalogue (jobs/index.json) decides what is listed and what is open:
 * a job that is still being made shows its card and cannot be entered. */
const list = document.getElementById('jobs'), status = document.getElementById('hub-status');
const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };

function card(job) {
  const open = job.status === 'open';
  const item = document.createElement('li');
  const box = make(open ? 'a' : 'div', `job ${open ? 'open' : 'making'}`);
  if (open) box.href = `./play.html?job=${encodeURIComponent(job.id)}`;
  const photo = make('div', 'job-photo');
  if (open && typeof job.poster === 'string' && /^[a-z0-9-]+\/places\/[a-z0-9-]+\.(?:jpg|webp)$/.test(job.poster)) {
    const image = Object.assign(document.createElement('img'), { src: new URL(`./jobs/${job.poster}`, import.meta.url).href, alt: job.posterAlt || '', decoding: 'async', width: 1920, height: 1080 });
    photo.append(image);
  } else photo.append(make('span', 'job-word', job.role || job.title));
  const body = make('div', 'job-body');
  body.append(make('span', 'job-state', open ? '지금 할 수 있어요' : '만드는 중'), make('h2', '', job.title), make('p', '', job.summary || ''));
  if (open) {
    body.append(make('p', 'job-meta', [job.role, job.scenes ? `장면 ${job.scenes}개` : '', job.minutes ? `${job.minutes}분쯤` : ''].filter(Boolean).join(' · ')), make('span', 'job-go', '이 일터로 가기'));
  } else body.append(make('p', 'job-meta', job.role || ''));
  box.append(photo, body); item.append(box);
  return item;
}

try {
  const response = await fetch(new URL('./jobs/index.json', import.meta.url), { cache: 'no-store' });
  if (!response.ok) throw new Error(String(response.status));
  const index = await response.json();
  const jobs = (index.jobs || []).filter((job) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(job.id || '') && typeof job.title === 'string');
  list.replaceChildren(...jobs.map(card));
  if (!jobs.length) throw new Error('empty');
} catch {
  status.hidden = false;
  status.textContent = '직업 목록을 불러오지 못했어요. 인터넷 연결을 확인하고 새로 고쳐 주세요.';
}
