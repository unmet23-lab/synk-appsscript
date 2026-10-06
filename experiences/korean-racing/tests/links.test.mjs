import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gameHref, GAME_LINKS, wireGameLinks } from '../links.js';

// 바람길·말의 리듬 링크는 같은 저장 공간(공통 코인·학습 기록)을 쓰도록 이 페이지가 열린 자리를 따른다.
test('다른 게임 링크: 학습 허브·공개 사이트·레이싱 패키지 자리에 맞춘다', () => {
  assert.equal(gameHref('runner', '/korean-racing/', 'http://127.0.0.1:4280/korean-racing/?qa'), '/korean-runner/');
  assert.equal(gameHref('rhythm', '/korean-racing/index.html', 'http://127.0.0.1:4280/korean-racing/index.html'), '/korean-rhythm/');
  assert.equal(gameHref('runner', '/try/racing/', 'https://synk.im/try/racing/'), '/try/runner/');
  assert.equal(gameHref('rhythm', '/try/racing/', 'https://synk.im/try/racing/?garage=1'), '/try/rhythm/');
  assert.equal(gameHref('runner', '/', 'http://127.0.0.1:5197/'), 'http://127.0.0.1:5197/play/runner/');
  assert.equal(gameHref('rhythm', '/배포/', 'https://example.test/%EB%B0%B0%ED%8F%AC/'), 'https://example.test/%EB%B0%B0%ED%8F%AC/play/rhythm/');
});

test('입구와 결과의 링크 넷을 모두 바꾸고, 공개 동기화가 찾는 원래 주소는 두 번씩 남아 있다', () => {
  const links = new Map(GAME_LINKS.map(([id]) => [id, { href: '' }]));
  wireGameLinks({ getElementById: (id) => links.get(id) }, { pathname: '/try/racing/', href: 'https://synk.im/try/racing/' });
  assert.deepEqual([...links.values()].map((l) => l.href), ['/try/runner/', '/try/rhythm/', '/try/runner/', '/try/rhythm/']);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const [id] of GAME_LINKS) assert.match(html, new RegExp(`id="${id}"`), `${id} 링크가 index.html에 있다`);
  // SYNK-website sync-play-games.mjs는 이 두 주소가 정확히 두 번씩 있어야 공개용으로 바꾼다.
  assert.equal(html.split('href="/play/runner/"').length - 1, 2);
  assert.equal(html.split('href="/play/rhythm/"').length - 1, 2);
  assert.equal(html.split('<head>').length - 1, 1);
});
