'use strict';

function youtubeAboutUrl(account) {
  try {
    const url = new URL(account.publicUrl);
    const path = decodeURIComponent(url.pathname).replace(/\/$/, '');
    if (url.origin !== 'https://www.youtube.com' || url.username || url.password || !/^(?:\/@[^/]+|\/channel\/UC[\w-]{22})$/.test(path)) return null;
    url.pathname = path + '/about';
    url.search = '';
    url.hash = '';
    return url.href;
  } catch { return null; }
}

// This runs in the page. Match the catalog, the document canonical and both visible handle locations.
function readAbout({registeredUrl, externalId, handle}) {
  const result = {url:location.origin + location.pathname, observedAt:new Date().toISOString(),matched:false,metrics:{},labels:{},posts:[]};
  const registered = new URL(registeredUrl);
  if (registered.origin !== 'https://www.youtube.com' || location.origin !== registered.origin) return result;
  const header = document.querySelector('ytd-page-header-renderer,yt-page-header-renderer');
  const panels = [...document.querySelectorAll('ytd-about-channel-renderer')].filter(n=>n.getClientRects().length);
  if (panels.length !== 1) return {...result,unavailable:'retry'};
  const canonical = document.querySelector('link[rel=canonical]')?.href || '';
  const channelId = canonical.match(/^https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})\/?$/)?.[1];
  const normalized = value=>value.trim().normalize('NFC').toLowerCase();
  const expected = normalized(handle);
  if (!channelId || !expected.startsWith('@') || (externalId && channelId !== externalId)) return result;
  const officialPath = path=>{
    const parts = decodeURIComponent(path).split('/').filter(Boolean);
    if (parts.at(-1) === 'about') parts.pop();
    return parts.length === 1 && normalized(parts[0]) === expected ||
      parts.length === 2 && parts[0] === 'channel' && parts[1] === channelId;
  };
  const headerHandle = header?.innerText.split('\n').map(s=>s.trim()).find(s=>normalized(s) === expected);
  if (!headerHandle || !officialPath(registered.pathname) || !officialPath(location.pathname)) return result;
  const rows = [...panels[0].querySelectorAll('tr')].filter(n=>n.getClientRects().length);
  const handleLink = rows.flatMap(row=>[...row.querySelectorAll('a[href]')]).find(a=>{
    try {
      const url = new URL(a.href);
      return a.getClientRects().length && ['http:','https:'].includes(url.protocol) && url.host === 'www.youtube.com' &&
        normalized(decodeURIComponent(url.pathname).replace(/^\/|\/$/g,'')) === expected &&
        normalized(decodeURIComponent(a.innerText).replace(/^(?:https?:\/\/)?www\.youtube\.com\//i,'').replace(/\/$/,'')) === expected;
    } catch { return false; }
  });
  if (!handleLink) return result;
  result.matched = true;
  result.channel = {registeredUrl,headerHandle,channelId,canonical,aboutHandleUrl:handleLink.href};
  const matches = rows.map(row=>row.innerText.trim()).map(label=>({label, match:label.match(/^(?:조회수\s*([\d,]+)\s*회|([\d,]+)\s+views?)$/i)})).filter(item=>item.match);
  if (matches.length === 1) {
    const value = matches[0].match[1] || matches[0].match[2];
    const count = Number(value.replaceAll(',',''));
    if (/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value) && Number.isSafeInteger(count)) {
      result.metrics.views = count;
      result.labels.views = matches[0].label;
    }
  }
  return result;
}

module.exports = {youtubeAboutUrl,readAbout};
