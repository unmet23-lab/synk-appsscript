// Ego 실행기에서 확인한 예약 대화의 모델 답변만 읽는다.
const { profileId, threadUrl, account } = geminiContest;
const name = 'SYNK Gemini contest receipts';
const previous = (await listTaskSpaces()).find(s => s.name === name);
if (previous && (previous.profileId !== profileId || previous.ownership !== 'agent')) {
  throw Error('Gemini 공모 수신 공간의 프로필 또는 제어권이 달라 다음 회차에 다시 읽습니다.');
}
const task = previous ? await taskSpace(previous.id) : await taskSpace(name, { profileId });
try {
  const tabs = await task.tabs();
  const tab = tabs.find(t => t.active) || tabs[0];
  const page = tab.label ? task.page(tab.label) : await task.adopt(tab.page);
  const target = new URL(threadUrl);
  target.searchParams.set('authuser', account);
  await page.goto(target.href, { timeout: 25000 });
  await page.waitForSelector('loc=css:model-response message-content', { timeout: 22000 });
  await page.waitForFunction((email) => Array.from(document.querySelectorAll('a[aria-label],button[aria-label]'))
    .some(el => /Google (계정|Account)/i.test(el.getAttribute('aria-label')) &&
      el.getAttribute('aria-label').toLowerCase().includes(email.toLowerCase())), account, { timeout: 10000 });
  const receipt = await page.evaluate(({ account, path }) => {
    const label = Array.from(document.querySelectorAll('a[aria-label],button[aria-label]'))
      .map(el => el.getAttribute('aria-label')).find(s => /Google (계정|Account)/i.test(s));
    const email = label?.match(/[\w.+-]+@[\w.-]+\.[a-z]+/i)?.[0]?.toLowerCase();
    if (email !== account.toLowerCase() || location.origin !== 'https://gemini.google.com' ||
        location.pathname.replace(/^\/u\/\d+\//, '/') !== path) throw Error('Gemini 계정이나 예약 대화가 다릅니다.');
    const messages = Array.from(document.querySelectorAll('model-response message-content')).flatMap(node => {
      const blocks = Array.from(node.querySelectorAll('pre')).map(el => el.innerText);
      return [...blocks, node.innerText].filter(s => s?.includes('synk-contest-pilot-v1') && s.length < 550000);
    });
    return [...new Set(messages)];
  }, { account, path: new URL(threadUrl).pathname.replace(/^\/u\/\d+\//, '/') });
  console.log('SYNKGEMINIDATA=' + JSON.stringify(receipt));
} finally {
  await task.finish({ keep: [] });
}
