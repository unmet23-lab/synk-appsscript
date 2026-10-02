export const LOCAL_PLATFORM_URL = 'http://127.0.0.1:4280/synk-account/platform.html';

const loopback = hostname => ['127.0.0.1', 'localhost', '[::1]'].includes(hostname);

// Navigation is public configuration. It never carries a session or grants company access.
export function resolvePlatformUrl(value, { origin } = {}) {
  const local = origin ? loopback(new URL(origin).hostname) : false;
  if (value === undefined) return local ? LOCAL_PLATFORM_URL : null;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value !== value.trim() || /[\s\\]/.test(value)) throw new Error('SYNK 플랫폼 주소를 확인해 주세요.');
  let url;
  try { url = new URL(value); } catch { throw new Error('SYNK 플랫폼 주소는 전체 HTTPS 주소로 설정해 주세요.'); }
  if (url.username || url.password || url.search || url.hash || !['https:', 'http:'].includes(url.protocol)) throw new Error('SYNK 플랫폼 주소에는 로그인 정보나 검색·해시 값을 넣을 수 없습니다.');
  if (loopback(url.hostname) ? !local : url.protocol !== 'https:') throw new Error('외부 SYNK 플랫폼에는 HTTPS 주소가 필요합니다.');
  return url.href;
}
