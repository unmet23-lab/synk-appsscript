import { MEMBER_BENEFITS, memberBenefit } from '../../../desktop/renderer/benefits.mjs';
import { renderMemberInsight } from '../../../desktop/renderer/member-insight-view.mjs';

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
// 혜택 포스터는 PC 앱(launcher)과 같은 물건·같은 규칙: 사업 색 면에서 구운 물건 하나(benefits.css의 .benefit-object), 번호 라벨, 상태 칩.
const artPath = benefit => `./assets/member/${benefit.asset}`;
const art = benefit => `<img class="benefit-object" src="${artPath(benefit)}" alt="${esc(benefit.alt)}">`;
const number = item => `${String(MEMBER_BENEFITS.indexOf(item) + 1).padStart(2, '0')} / ${String(MEMBER_BENEFITS.length).padStart(2, '0')}`;
const state = item => `<span class="benefit-status is-${item.status}"><span class="led" aria-hidden="true"></span>${esc(item.statusLabel)}</span>`;

// The loopback-only demo is separate from membership and production launch rights.
const LOCAL_PREVIEWS = Object.freeze({ care: 'http://127.0.0.1:4296/', fortune: 'http://127.0.0.1:4299/' });
export function localBenefitPreview(id, base) {
  if (!Object.hasOwn(LOCAL_PREVIEWS, id) || memberBenefit(id)?.status !== 'preview') return null;
  try {
    const url = new URL(base);
    return url.protocol === 'http:' && !url.username && !url.password && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      ? LOCAL_PREVIEWS[id] : null;
  } catch { return null; }
}

const PUBLIC_ENTRIES = Object.freeze({ care: 'https://synk.im/care/', fortune: 'https://synk.im/fortune/' });
export function publicBenefitEntry(id) {
  if (!Object.hasOwn(PUBLIC_ENTRIES, id)) return null;
  const value = memberBenefit(id)?.publicUrl;
  return value === PUBLIC_ENTRIES[id] ? value : null;
}

export function filterBenefits(query = '') {
  const term = query.trim().toLocaleLowerCase();
  return MEMBER_BENEFITS.filter(item => [item.name, item.kicker, item.headline, item.description, '회원 무료 혜택'].join(' ').toLocaleLowerCase().includes(term));
}

export function benefitCards(query = '') {
  const benefits = filterBenefits(query);
  return benefits.length ? `<div class="benefit-grid">${benefits.map((item, index) => `<article class="benefit-card benefit-${item.id}">
    <a class="benefit-art" href="#benefits/${item.id}" aria-label="${esc(item.name)} 소개 보기"><span class="benefit-index">${number(item)}</span>${state(item)}${art(item)}</a>
    <div class="benefit-copy"><p class="benefit-kicker">${item.kicker}</p><h2><a href="#benefits/${item.id}">${item.name}</a></h2><p>${item.description}</p><a class="benefit-link" href="#benefits/${item.id}">${item.id === 'insight' ? '내 성향 보기' : '소개 보기'} <span aria-hidden="true">↗</span></a></div>
  </article>`).join('')}</div>` : '<p class="benefit-empty">검색어에 맞는 회원 혜택이 없어요.</p>';
}

export function benefitHero({ home = false } = {}) {
  return `<section class="benefit-hero ${home ? 'benefit-home' : ''}" aria-labelledby="benefit-heading">
    <div class="benefit-hero-copy"><p class="sb-eyebrow">SYNK FOR YOU <span>회원 혜택</span></p>
    <h1 id="benefit-heading">회원이면<br><span>모두 무료.</span></h1><p>내 성향, AI 구독 계정판, 무료 운세, 플레저.<br>SYNK ID 하나로 넷 다 써요.</p>
    ${home ? '<a class="sb-btn soft" href="#benefits">회원 혜택 보기 <span aria-hidden="true">→</span></a>' : '<button class="benefit-text-link" data-action="scroll-benefits">네 가지 보기 <span aria-hidden="true">↓</span></button>'}
    <p class="benefit-disclosure">네 가지 모두 무료예요.<br>플레저와 무료 운세는 로그인 없이도 열려요.</p></div>
    <div class="benefit-hero-art" aria-hidden="true"><span class="benefit-index">MEMBER BENEFITS</span><img class="benefit-object" src="./assets/member/benefit-gift.webp" alt=""></div>
  </section>`;
}

export function benefitsPage() {
  return benefitHero() + `<section id="benefit-collection" class="benefit-collection" aria-labelledby="benefit-collection-title"><div class="section-heading"><div><p class="sb-eyebrow">ALL BENEFITS</p><h2 id="benefit-collection-title">네 가지 회원 혜택</h2></div><span class="benefit-count">01 — ${String(MEMBER_BENEFITS.length).padStart(2, '0')}</span></div>${benefitCards()}</section>
  <section class="benefit-promise"><p class="sb-eyebrow">WHERE TO OPEN</p><h2>여는 곳은<br>혜택마다 달라요.</h2><div><p>플레저와 무료 운세는 웹(synk.im)에서 바로 열려요. AI 구독 계정판은 PC 앱에서만 써요.</p><p>내 성향은 로그인하면 여기서 볼 수 있어요. 기록을 남기려면 열린 화면에서 같은 SYNK ID로 로그인해 주세요.</p><a class="benefit-link" href="./client.html?product=platform">SYNK ID 관리 <span aria-hidden="true">↗</span></a></div></section>`;
}

export function benefitDetail(id, base, { library = null, insight = { status: 'signed-out', report: null } } = {}) {
  const item = memberBenefit(id);
  // 성향 소개도 PC 앱처럼 포스터(물건·번호 라벨·상태 스티커)를 넘겨 다른 소개 머리와 같은 틀로 연다.
  if (id === 'insight' && item) return renderMemberInsight(insight, { poster: { art: artPath(item), label: `SYNK FOR YOU · ${number(item)}`, badge: item.statusLabel, status: item.status } });
  if (!item) return '<div class="page-heading"><h1>찾는 회원 혜택이 없어요.</h1><a class="benefit-link" href="#benefits">회원 혜택으로 돌아가기 →</a></div>';
  const preview = localBenefitPreview(id, base), publicEntry = publicBenefitEntry(id);
  const saved = library?.saved?.includes(id), favorite = library?.favorites?.includes(id);
  // 소개 머리: 위 번호 라벨·스티커 → 오른쪽 위 물건 → 큰 한글(--word)과 한 줄 제목 → 설명 선. 화면 제목에는 서비스 이름을 함께 읽힌다.
  return `<a class="back-link benefit-back" href="#benefits">← 회원 혜택 모두 보기</a><header class="benefit-detail-hero benefit-${item.id}">${art(item)}<div class="benefit-detail-top"><span class="benefit-index">SYNK FOR YOU · ${number(item)}</span>${state(item)}</div><div class="benefit-detail-title"><h1><span class="sr-only">${esc(item.name)}. </span>${item.headline}</h1></div><p class="benefit-detail-note">${item.description}</p></header>
    <section class="benefit-availability" aria-label="여는 곳"><div><span class="benefit-status">${item.statusLabel}</span><p>${item.availability}</p></div>${publicEntry ? `<a class="sb-btn" href="${esc(publicEntry)}" data-web="${item.id}" target="_blank" rel="noopener noreferrer">웹에서 열기 ↗</a>` : ''}${preview ? `<a class="sb-btn soft" href="${preview}" data-web="${item.id}" target="_blank" rel="noopener noreferrer">이 PC에서 열기 ↗</a>` : !publicEntry ? (item.embedded ? '<a class="benefit-link" href="#downloads">PC 앱 받기 →</a>' : '<a class="benefit-link" href="./client.html?product=platform">SYNK ID 알아보기 ↗</a>') : ''}${preview ? `<p class="benefit-local-note">「이 PC에서 열기」는 이 컴퓨터에서 켜 둔 ${item.name} 화면을 열어요. ${id === 'fortune' ? '로그인하지 않고 넣은 내용은 이 화면에만 남아요. 로그인한 뒤 저장하면 출생정보와 운세 기록이 계정에 남아요.' : '기본으로는 쓰는 동안만 남고, 기기에 저장할지는 앱에서 골라요.'}</p>` : ''}</section>
    ${library && !item.embedded ? `<section class="launch-bar" aria-label="기기 라이브러리"><div><strong>라이브러리에 담기</strong><p>이 기기에 바로가기만 저장해요. 앱 안의 기록과는 관계없어요.</p></div><div class="actions"><button class="sb-btn soft" data-action="save" data-id="${item.id}" aria-pressed="${!!saved}">${saved ? '라이브러리에서 빼기' : '라이브러리에 담기'}</button><button class="sb-btn soft" data-action="favorite" data-id="${item.id}" aria-pressed="${!!favorite}">${favorite ? '★ 즐겨찾기' : '☆ 즐겨찾기'}</button><a class="benefit-link" href="#library">내 라이브러리 →</a></div></section>` : ''}
    <section class="benefit-how"><p class="sb-eyebrow">${item.status === 'planned' ? 'COMING SOON' : 'HOW IT WORKS'}</p><h2>${item.status === 'planned' ? '준비하고 있는 것' : '이렇게 써요'}</h2><ol>${item.steps.map((step, index) => `<li><span class="benefit-step-number">0${index + 1}</span><div><h3>${step.title}</h3><p>${step.body}</p></div></li>`).join('')}</ol></section>
    <section class="benefit-more"><div class="section-heading"><h2>다른 회원 혜택</h2><a href="#benefits">회원 혜택 모두 보기 →</a></div><div class="benefit-related">${MEMBER_BENEFITS.filter(other => other.id !== id).map(other => `<a class="benefit-${other.id}" href="#benefits/${other.id}"><img src="${artPath(other)}" alt=""><div><span>${other.statusLabel}</span><strong>${other.name}</strong><p>${other.kicker}</p></div><span aria-hidden="true">↗</span></a>`).join('')}</div></section>`;
}
