import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'parse5';
import { renderDramaInvites } from '../invite/pages.mjs';

const copy = JSON.parse(readFileSync(new URL('../invite/copy.json', import.meta.url), 'utf8'));
const pages = renderDramaInvites(copy);
const locales = ['mn', 'en'];

function findAll(node, tag) {
  const children = (node.childNodes || []).flatMap(child => findAll(child, tag));
  return node.tagName === tag ? [node, ...children] : children;
}

function attr(node, key) {
  return node?.attrs?.find(item => item.name === key)?.value;
}

function textOf(node) {
  return node.nodeName === '#text' ? node.value : (node.childNodes || []).map(textOf).join('');
}

function links(document, base) {
  return findAll(document, 'a').map(anchor => ({
    url: new URL(attr(anchor, 'href'), base), label: textOf(anchor).trim()
  }));
}

test('the shared invitation opens either published language without an account', () => {
  const doc = parse(pages['invite/index.html']);
  const targets = links(doc, 'https://synk.im/world/invite/');
  const body = textOf(findAll(doc, 'body')[0]);
  for (const lang of locales) {
    assert.ok(targets.some(({url}) => url.href === `https://synk.im/world/invite/${lang}/`));
    assert.ok(body.includes(copy[lang].soon));
  }
});

test('both languages share a named navigation landmark with one link per language', () => {
  const doc = parse(pages['invite/index.html']);
  const nav = findAll(doc, 'nav').find(node => findAll(node, 'a').length === locales.length);
  assert.ok(nav, 'the two language choices must be reachable together');
  assert.ok(attr(nav, 'aria-label') || attr(nav, 'aria-labelledby'));
  const navigationLinks = findAll(nav, 'a');
  for (const locale of locales) {
    const pathname = `/world/invite/${locale}/`;
    const matching = findAll(doc, 'a').filter(anchor => attr(anchor, 'href') === pathname);
    assert.equal(matching.length, 1);
    assert.ok(navigationLinks.includes(matching[0]));
    assert.equal(attr(matching[0], 'hreflang'), locale);
    assert.equal(attr(matching[0], 'lang'), locale);
  }
});

test('every invitation publishes the launch schedule and opens the right waitlist email draft', () => {
  const dates = {
    en: [/February 2027/i, /late December 2026/i],
    mn: [/2027 оны 2(?:-р| дугаар) сар/, /бүх хүнд 2026 оны 12(?:-р| дугаар) сарын сүүлээр [^.]*урилга илгээнэ/],
  };
  for (const [page, languages] of [
    ['invite/index.html', locales],
    ...locales.map(lang => [`invite/${lang}/index.html`, [lang]]),
  ]) {
    const doc = parse(pages[page]);
    const body = textOf(findAll(doc, 'body')[0]);
    const shareDescription = findAll(doc, 'meta').find(node => attr(node, 'property') === 'og:description');
    const mailLinks = links(doc, 'https://synk.im').filter(({url}) => url.protocol === 'mailto:');
    assert.equal(mailLinks.length, languages.length, page);
    for (const lang of languages) {
      const t = copy[lang];
      for (const date of dates[lang]) assert.match(t.schedule, date);
      assert.ok(body.includes(t.schedule), page);
      assert.ok(attr(shareDescription, 'content').includes(t.schedule), page);
      const manualHelp = t.emailHelp.replace('{email}', 'hello@synk.im').replace('{subject}', () => t.mailSubject);
      assert.ok(t.emailHelp.includes('{subject}'), page);
      assert.ok(body.includes(manualHelp), page);
      const draft = mailLinks.find(({ label }) => label === t.join);
      assert.ok(draft, page);
      assert.equal(draft.url.pathname, 'hello@synk.im');
      assert.equal(draft.url.searchParams.get('subject'), t.mailSubject);
      assert.equal(draft.url.searchParams.get('body'), t.mailBody);
      assert.ok(t.mailSubject && t.mailBody);
    }
  }
});

test('account help keeps punctuation and markup-like examples as plain text', () => {
  const help = 'Read <example>가입하기</example> & continue.';
  const sample = renderDramaInvites({ ...copy, en: { ...copy.en, authhelp: help } });
  const doc = parse(sample['invite/en/index.html']);
  const paragraph = findAll(findAll(doc, 'details')[0], 'p')[0];
  assert.equal(textOf(paragraph), help);
  assert.equal(findAll(paragraph, 'example').length, 0);
});

for (const lang of locales) {
  test(`the ${lang} signup guide preserves each Korean button name as one label`, () => {
    const doc = parse(pages[`invite/${lang}/index.html`]);
    const help = findAll(findAll(doc, 'details')[0], 'p')[0];
    assert.equal(textOf(help), copy[lang].authhelp);
    const names = findAll(help, 'span').filter(span => attr(span, 'lang') === 'ko');
    assert.deepEqual(names.map(textOf), ['가입하기', 'Google로 로그인', '이메일로 로그인']);
  });

  test(`the ${lang} invitation is localized before scripts run and opens episode one`, () => {
    const path = `/world/invite/${lang}/`;
    const doc = parse(pages[`invite/${lang}/index.html`]);
    assert.equal(attr(findAll(doc, 'html')[0], 'lang'), lang);
    assert.equal(textOf(findAll(doc, 'h1')[0]).trim(), copy[lang].title);
    const body = textOf(findAll(doc, 'body')[0]);
    assert.ok(body.includes(copy[lang].soon));
    const anchors = links(doc, 'https://synk.im' + path);
    const primary = anchors.find(({url}) => url.pathname === '/world/' && url.searchParams.get('drama') === '1');
    assert.ok(primary);
    assert.equal(primary.url.origin, 'https://synk.im');
    assert.equal(primary.url.searchParams.get('invite'), '1');
    assert.equal(primary.url.searchParams.get('lang'), lang);
    assert.ok(primary.label.includes(copy[lang].start));
    assert.ok(findAll(doc, 'meta').some(node => attr(node, 'property') === 'og:title' && attr(node, 'content')?.includes(copy[lang].title)));
    assert.ok(anchors.some(({url}) => url.pathname === `/world/invite/${lang === 'en' ? 'mn' : 'en'}/`));
    assert.equal(anchors.some(({url}) => url.hostname === 'docs.google.com'), lang === 'mn');
  });
}
