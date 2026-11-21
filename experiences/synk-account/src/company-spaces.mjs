// synk.im 홈 「회사 공간」 칸(유호님 11-21 「배정된 계정에만 링크」, 「웅」 — 회사 공간 로그인이 끊긴 배정 회원에게도).
// 로그인 뒤 고르기 화면 없이 들어간 다음, 회사 서버에 이 탭의 SYNK 플랫폼 로그인으로 자기 배정만 조용히 묻고,
// 배정된 계정에만 Workspace · PULSE 바로가기를 세운다. 회사 쿠키는 쓰지 않는다(credentials: 'omit').

export const COMPANY_SPACES_URL = 'https://workspace.synk.im/api/customer/entry/destinations';
const MAX_RESPONSE_CHARS = 4096;
const SUCCESS_KEYS = ['accountMatch', 'pulse', 'version', 'workspace'];
const WORKSPACE_STATES = new Set(['assigned', 'unassigned']);
const PULSE_STATES = new Set(['assigned', 'unassigned', 'unavailable']);

// 칸에 세우는 순서와 글. 목적지 '/'는 Workspace, '/pulse-app/'은 PULSE다.
export const COMPANY_SPACES = Object.freeze([
  Object.freeze({ destination: '/', key: 'workspace', name: 'Workspace', text: '팀이 함께 일하는 곳', href: 'https://workspace.synk.im/' }),
  Object.freeze({ destination: '/pulse-app/', key: 'pulse', name: 'PULSE', text: '고객과 함께 만드는 곳', href: 'https://workspace.synk.im/pulse-app/' }),
]);
const KNOWN_DESTINATIONS = new Set(COMPANY_SPACES.map(space => space.destination));

// 이름은 번들 안의 다른 모듈과 겹치지 않게 짓는다 — 겹치면 묶을 때 이름이 밀려 공개본 조각 갈아 끼우기가 어긋난다
const isCompanySpacesRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const sameKeys = (value, keys) => Object.keys(value).sort().join(',') === keys.join(',');

// 회사 서버의 답을 고정된 꼴로만 읽는다. 맞지 않으면 null(칸을 세우지 않음)이다.
export function readCompanySpacesBody(body) {
  if (!isCompanySpacesRecord(body) || !sameKeys(body, SUCCESS_KEYS) || body.version !== 1 || body.accountMatch !== true) return null;
  const { workspace, pulse } = body;
  if (!isCompanySpacesRecord(workspace) || !sameKeys(workspace, ['destination', 'state']) || workspace.destination !== '/' || !WORKSPACE_STATES.has(workspace.state)) return null;
  if (!isCompanySpacesRecord(pulse) || !sameKeys(pulse, ['destination', 'state']) || pulse.destination !== '/pulse-app/' || !PULSE_STATES.has(pulse.state)) return null;
  return [...(workspace.state === 'assigned' ? ['/'] : []), ...(pulse.state === 'assigned' ? ['/pulse-app/'] : [])];
}

// 한 번 묻는다. 성공이면 { destinations }, 실패면 { code } — 토큰은 부른 쪽(계정 관리자) 밖으로 나가지 않고 답에도 싣지 않는다.
export async function requestCompanySpaces({ fetch: fetcher, token, expectedAccountId, signal, url = COMPANY_SPACES_URL } = {}) {
  if (typeof fetcher !== 'function' || typeof token !== 'string' || !token || typeof expectedAccountId !== 'string' || !expectedAccountId) return { code: 'INVALID_INPUT' };
  let response;
  try {
    response = await fetcher(url, {
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedAccountId }),
      ...(signal ? { signal } : {}),
    });
  } catch {
    return { code: 'TEMPORARY_UNAVAILABLE' };
  }
  if (!response || response.redirected === true || !Number.isInteger(response.status)) return { code: 'TEMPORARY_UNAVAILABLE' };
  let text;
  try {
    text = await response.text();
  } catch {
    return { code: 'TEMPORARY_UNAVAILABLE' };
  }
  if (typeof text !== 'string' || text.length > MAX_RESPONSE_CHARS) return { code: 'TEMPORARY_UNAVAILABLE' };
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { code: 'TEMPORARY_UNAVAILABLE' };
  }
  if (response.status === 200) {
    const destinations = readCompanySpacesBody(body);
    return destinations ? { destinations } : { code: 'TEMPORARY_UNAVAILABLE' };
  }
  const code = body?.error?.code;
  return { code: typeof code === 'string' && /^[A-Z_]{1,40}$/.test(code) ? code : 'TEMPORARY_UNAVAILABLE' };
}

// 플랫폼이 쥐는 칸 상태: 어느 계정의 결과인지와 배정된 목적지.
export const emptyCompanySpaces = () => ({ accountId: null, destinations: [] });

export function acceptCompanySpaces(value) {
  const accountId = typeof value?.accountKey === 'string' && value.accountKey ? value.accountKey : null;
  const destinations = Array.isArray(value?.destinations) ? [...new Set(value.destinations.filter(item => KNOWN_DESTINATIONS.has(item)))] : [];
  return accountId ? { accountId, destinations } : emptyCompanySpaces();
}

// 로그아웃하거나 다른 계정이 되면 칸을 비운다. 같은 계정으로 다시 들어와도 새 조회가 끝나기 전에는 옛 칸을 그리지 않는다(카본 A1).
export function keepCompanySpaces(spaces, status, identity) {
  if (status === 'signed-out' || (identity?.accountId && identity.accountId !== spaces?.accountId)) return emptyCompanySpaces();
  return spaces;
}

// 지금 로그인한 계정이 조회한 계정과 같을 때만 칸을 그린다. workspaceHref는 Workspace 주소에 계정 기대값을 싣는 함수다.
export function companySpacesHtml(spaces, identity, { esc, workspaceHref }) {
  if (!(identity?.signedIn === true && identity.status === 'signed-in' && identity.accountId && identity.accountId === spaces?.accountId)) return '';
  const rows = COMPANY_SPACES.filter(space => spaces.destinations.includes(space.destination));
  if (!rows.length) return '';
  return `<section class="block company-spaces" aria-labelledby="company-spaces-title"><div class="block-head"><h2 id="company-spaces-title">회사 공간</h2></div><ul class="rows solio-rows">${rows.map(space => `<li class="row"><a class="row-main" href="${esc(space.destination === '/' ? workspaceHref(space.href, identity) : space.href)}" data-company-space="${space.key}">${space.name}</a><p class="solio-row-text">${space.text}</p></li>`).join('')}</ul></section>`;
}
