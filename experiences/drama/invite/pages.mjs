const SITE_ORIGIN = 'https://synk.im';
const STYLESHEET_HREF = '/world/invite/invite.css';
const HERO_IMAGE_PATH = '/world/drama/media/taeo-still.webp';
const HERO_IMAGE_URL = 'https://synk.im/world/drama/media/taeo-still.webp';
const NEUTRAL_PATH = '/world/invite/';
const STUDY_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeqDI-LOHgKCxMWSG6t08O-QmKvth_rg6Y4y4PK_FAVrUSGdA/viewform';

const COPY_FIELDS = [
  'title',
  'intro',
  'start',
  'soon',
  'study',
  'language',
  'browser',
  'guide',
  'authhelp',
];

const LOCALES = {
  en: {
    code: 'en',
    label: 'English',
    ogLocale: 'en_US',
    altOgLocale: 'mn_MN',
    pathname: '/world/invite/en/',
    startHref: '/world/?drama=1&invite=1&lang=en',
  },
  mn: {
    code: 'mn',
    label: 'Монгол',
    ogLocale: 'mn_MN',
    altOgLocale: 'en_US',
    pathname: '/world/invite/mn/',
    startHref: '/world/?drama=1&invite=1&lang=mn',
  },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatAccountHelp(value) {
  return escapeHtml(value).replace(
    /가입하기|Google로 로그인|이메일로 로그인/g,
    (label) => '<span class="invite-auth-label" lang="ko">' + label + '</span>'
  );
}

function readLocaleCopy(copy, locale) {
  const source = copy?.[locale] ?? {};
  const result = {};
  for (const field of COPY_FIELDS) {
    result[field] = typeof source[field] === 'string' ? source[field].trim() : '';
  }
  return result;
}

function formatBrandTitle(title) {
  return /synk/i.test(title) ? title : `${title} — SYNK WORLD`;
}

function formatBilingualTitle(enTitle, mnTitle) {
  const combined = enTitle === mnTitle ? enTitle : `${enTitle} · ${mnTitle}`;
  return formatBrandTitle(combined);
}

function formatBilingualDescription(enIntro, mnIntro) {
  return enIntro === mnIntro ? enIntro : `${enIntro} / ${mnIntro}`;
}

function renderDocument({
  lang,
  pathname,
  title,
  description,
  ogLocale,
  altOgLocale,
  bodyClass,
  bodyHtml,
}) {
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const canonicalUrl = `${SITE_ORIGIN}${pathname}`;

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapedTitle}</title>
  <meta name="description" content="${escapedDescription}">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${NEUTRAL_PATH}">
  <link rel="alternate" hreflang="en" href="${SITE_ORIGIN}${LOCALES.en.pathname}">
  <link rel="alternate" hreflang="mn" href="${SITE_ORIGIN}${LOCALES.mn.pathname}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="SYNK WORLD">
  <meta property="og:locale" content="${ogLocale}">
  <meta property="og:locale:alternate" content="${altOgLocale}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  <meta property="og:image" content="${HERO_IMAGE_URL}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDescription}">
  <meta name="twitter:image" content="${HERO_IMAGE_URL}">
  <link rel="stylesheet" href="${STYLESHEET_HREF}">
</head>
<body class="${bodyClass}">
${bodyHtml}
</body>
</html>
`;
}

function renderNeutralPage(en, mn) {
  const bodyHtml = `  <div class="invite-shell">
    <header class="invite-header">
      <h1 class="invite-wordmark" lang="en">SYNK WORLD</h1>
      <nav class="invite-choice-nav" aria-label="${escapeHtml(en.language)} / ${escapeHtml(mn.language)}">
        <a class="invite-cta invite-choice-cta" href="${LOCALES.en.pathname}" lang="en" hreflang="en">${LOCALES.en.label}</a>
        <a class="invite-cta invite-choice-cta" href="${LOCALES.mn.pathname}" lang="mn" hreflang="mn">${LOCALES.mn.label}</a>
      </nav>
    </header>
    <main class="invite-stage invite-stage-neutral">
      <figure class="invite-media">
        <img class="invite-still" src="${HERO_IMAGE_PATH}" alt="" width="1600" height="900" decoding="async" fetchpriority="high">
      </figure>
      <div class="invite-bilingual">
        <section class="invite-locale-card" lang="en">
          <h2 class="invite-card-title">${escapeHtml(en.title)}</h2>
          <p class="invite-intro">${escapeHtml(en.intro)}</p>
          <p class="invite-soon">${escapeHtml(en.soon)}</p>
        </section>
        <section class="invite-locale-card" lang="mn">
          <h2 class="invite-card-title">${escapeHtml(mn.title)}</h2>
          <p class="invite-intro">${escapeHtml(mn.intro)}</p>
          <p class="invite-soon">${escapeHtml(mn.soon)}</p>
        </section>
      </div>
    </main>
  </div>`;

  return renderDocument({
    lang: 'en',
    pathname: NEUTRAL_PATH,
    title: formatBilingualTitle(en.title, mn.title),
    description: formatBilingualDescription(en.intro, mn.intro),
    ogLocale: LOCALES.en.ogLocale,
    altOgLocale: LOCALES.mn.ogLocale,
    bodyClass: 'invite-page invite-page-neutral',
    bodyHtml,
  });
}

function renderLocalizedPage(localeMeta, t) {
  const isEn = localeMeta.code === 'en';
  const studyHtml =
    localeMeta.code === 'mn' && t.study
      ? `\n          <p class="invite-study"><a class="invite-study-link" href="${STUDY_FORM_URL}" rel="noopener noreferrer">${escapeHtml(t.study)}</a></p>`
      : '';

  const bodyHtml = `  <div class="invite-shell">
    <header class="invite-header">
      <span class="invite-wordmark" lang="en">SYNK WORLD</span>
      <nav class="invite-lang-switch" aria-label="${escapeHtml(t.language)}">
        <span class="invite-lang-label">${escapeHtml(t.language)}</span>
        <a class="invite-lang-link" href="${LOCALES.en.pathname}" hreflang="en" lang="en"${isEn ? ' aria-current="page"' : ''}>${LOCALES.en.label}</a>
        <a class="invite-lang-link" href="${LOCALES.mn.pathname}" hreflang="mn" lang="mn"${!isEn ? ' aria-current="page"' : ''}>${LOCALES.mn.label}</a>
      </nav>
    </header>
    <main class="invite-stage invite-stage-localized">
      <figure class="invite-media">
        <img class="invite-still" src="${HERO_IMAGE_PATH}" alt="" width="1600" height="900" decoding="async" fetchpriority="high">
      </figure>
      <div class="invite-panel">
        <h1 class="invite-title">${escapeHtml(t.title)}</h1>
        <p class="invite-intro">${escapeHtml(t.intro)}</p>
        <p class="invite-soon">${escapeHtml(t.soon)}</p>
        <a class="invite-cta" href="${localeMeta.startHref}">${escapeHtml(t.start)}</a>
        <div class="invite-meta">
          <p class="invite-browser">${escapeHtml(t.browser)}</p>
          <details class="invite-guide">
            <summary class="invite-guide-summary">${escapeHtml(t.guide)}</summary>
            <p class="invite-authhelp">${formatAccountHelp(t.authhelp)}</p>
          </details>${studyHtml}
        </div>
      </div>
    </main>
  </div>`;

  return renderDocument({
    lang: localeMeta.code,
    pathname: localeMeta.pathname,
    title: formatBrandTitle(t.title),
    description: t.intro,
    ogLocale: localeMeta.ogLocale,
    altOgLocale: localeMeta.altOgLocale,
    bodyClass: 'invite-page invite-page-localized',
    bodyHtml,
  });
}

export function renderDramaInvites(copy) {
  const en = readLocaleCopy(copy, 'en');
  const mn = readLocaleCopy(copy, 'mn');

  return {
    'invite/index.html': renderNeutralPage(en, mn),
    'invite/en/index.html': renderLocalizedPage(LOCALES.en, en),
    'invite/mn/index.html': renderLocalizedPage(LOCALES.mn, mn),
  };
}
