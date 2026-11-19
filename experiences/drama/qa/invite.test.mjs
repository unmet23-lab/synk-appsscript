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

for (const lang of locales) {
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
