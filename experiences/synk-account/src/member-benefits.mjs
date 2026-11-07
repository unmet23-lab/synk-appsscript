import { MEMBER_BENEFITS, memberBenefit } from '../../../desktop/renderer/benefits.mjs';
import { renderMemberInsight } from '../../../desktop/renderer/member-insight-view.mjs';
import { shelfItem, shelfColumns } from './platform-shelf.mjs';

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
// 혜택 물건은 PC 앱(launcher)과 같은 펠트 물건이다. A 진열대(2026-11-08)부터는 사업 색 면 대신 회색 선반 위에 선다.
const artPath = benefit => `./assets/member/${benefit.asset}`;

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

// 로그인한 사람에게 「로그인하면 바로」는 맞지 않는다 — 내 성향은 회원 혜택으로 바로 본다는 말로.
export const benefitStatus = (item, signedIn = false) => item.id === 'insight' && signedIn ? '회원 혜택 · 바로 보기' : item.statusLabel;
// 혜택 칸 아래 행동 한 줄(늘 보임, 칸마다 같은 높이): 웹에서 바로 여는 것은 그 혜택을 새 창으로, PC 전용은 PC 앱 받기, 내 성향은 이 화면에서 보기.
function benefitAction(item) {
  const web = publicBenefitEntry(item.id);
  if (web) return `<a class="go-link benefit-link" href="${esc(web)}" data-web="${item.id}" target="_blank" rel="noopener noreferrer">웹에서 열기 ↗</a>`;
  if (item.embedded && item.id !== 'insight') return '<a class="go-link benefit-link" href="#downloads">PC 앱 받기 →</a>';
  return `<a class="go-link benefit-link" href="#benefits/${item.id}">${item.id === 'insight' ? '내 성향 보기' : '소개 보기'} →</a>`;
}
// 혜택 선반 칸: 물건 → 이름 · 한 줄 · 여는 곳 → 행동 한 줄. 칸(그림 · 이름)을 누르면 그 혜택 소개로 간다.
export function benefitItem(item, { heading = 'h3', signedIn = false } = {}) {
  return shelfItem({ href: `#benefits/${item.id}`, image: artPath(item), imageClass: 'benefit-object', alt: esc(item.alt), name: item.name, heading,
    desc: item.headline, meta: benefitStatus(item, signedIn), cls: `benefit-card benefit-${item.id}`, attrs: `data-benefit="${item.id}"`,
    after: `<div class="go benefit-go">${benefitAction(item)}</div>` });
}

export function benefitCards(query = '', { signedIn = false } = {}) {
  const benefits = filterBenefits(query);
  return benefits.length ? `<ul class="shelf benefit-grid${shelfColumns(benefits.length)}" aria-label="회원 혜택">${benefits.map(item => benefitItem(item, { signedIn })).join('')}</ul>` : '<p class="benefit-empty">검색어에 맞는 회원 혜택이 없어요.</p>';
}

// 혜택 목록 첫머리: 선물 포스터 · 영문 꼬리표 없이 두 줄 제목(둘째 줄 회색)과 한 단락.
export function benefitHero() {
  return `<header class="page-heading benefit-title"><h1 id="benefit-heading">회원이면<br><span>모두 무료.</span></h1><p>내 성향, AI 구독 계정판, 플레저.<br>SYNK ID 하나로 셋 다 써요.</p><p class="small">세 가지 모두 무료예요. 플레저는 로그인 없이도 열려요.</p></header>`;
}

export function benefitsPage({ signedIn = false } = {}) {
  return benefitHero() + `<section id="benefit-collection" class="benefit-collection" aria-labelledby="benefit-collection-title"><h2 id="benefit-collection-title" class="sr-only">세 가지 회원 혜택</h2>${benefitCards('', { signedIn })}</section>
  <section class="benefit-promise" aria-labelledby="benefit-promise-title"><h2 id="benefit-promise-title">여는 곳은<br>혜택마다 달라요.</h2><div><p>플레저는 웹(synk.im)에서 바로 열려요. AI 구독 계정판은 PC 앱에서만 써요.</p><p>내 성향은 로그인하면 여기서 볼 수 있어요. 기록을 남기려면 열린 화면에서 같은 SYNK ID로 로그인해 주세요.</p><a class="link" href="./client.html?product=platform">SYNK ID 관리 ↗</a></div></section>`;
}

export function benefitDetail(id, base, { library = null, insight = { status: 'signed-out', report: null }, signedIn = false } = {}) {
  const item = memberBenefit(id);
  // 내 성향 소개는 PC 앱과 함께 쓰는 화면(member-insight-view)이라 그 틀과 글을 그대로 쓴다.
  if (id === 'insight' && item) return renderMemberInsight(insight, { poster: { art: artPath(item), label: '회원 혜택', badge: signedIn ? '' : item.statusLabel, status: item.status } });
  if (!item) return '<div class="page-heading"><h1>찾는 회원 혜택이 없어요.</h1><p><a class="link" href="#benefits">회원 혜택으로 돌아가기 →</a></p></div>';
  const preview = localBenefitPreview(id, base), publicEntry = publicBenefitEntry(id);
  const saved = library?.saved?.includes(id), favorite = library?.favorites?.includes(id);
  // 앱 소개와 같은 7 : 5. 왼쪽 회색 무대 위 물건, 오른쪽 한 줄 → 이름 → 제목 한 줄 → 설명 → 단추(검정 알약 하나) → 여는 곳 → 쓰는 법 줄 목록.
  const primary = publicEntry ? `<a class="sb-btn" href="${esc(publicEntry)}" data-web="${item.id}" target="_blank" rel="noopener noreferrer">웹에서 열기 ↗</a>` : '';
  const local = preview ? `<a class="sb-btn ${publicEntry ? 'soft' : ''}" href="${preview}" data-web="${item.id}" target="_blank" rel="noopener noreferrer">이 PC에서 열기 ↗</a>` : '';
  const fallback = !publicEntry && !preview ? (item.embedded ? '<a class="sb-btn" href="#downloads">PC 앱 받기 →</a>' : '<a class="sb-btn" href="./client.html?product=platform">SYNK ID 알아보기 ↗</a>') : '';
  const others = MEMBER_BENEFITS.filter(other => other.id !== id);
  return `<nav class="crumb" aria-label="위치"><a href="#benefits">회원 혜택</a><span aria-hidden="true">/</span><span aria-current="page">${esc(item.name)}</span></nav>
  <div class="detail benefit-detail benefit-${item.id}">
    <div class="detail-art"><div class="detail-stage"><img class="benefit-object" src="${artPath(item)}" alt="${esc(item.alt)}"></div></div>
    <div class="detail-text">
      <p class="aud">${item.kicker}</p><h1>${item.name}</h1><p class="sub">${item.headline}</p><p class="sum">${item.description}</p>
      <div class="acts">${primary}${local}${fallback}</div>
      <p class="state">${item.status === 'integrated' || publicEntry ? '<span class="dot" aria-hidden="true"></span>' : ''}${item.statusLabel}</p>
      <p class="benefit-availability">${item.availability}</p>
      ${preview ? `<p class="benefit-local-note">「이 PC에서 열기」는 이 컴퓨터에서 켜 둔 ${item.name} 화면을 열어요. ${id === 'fortune' ? '로그인하지 않고 넣은 내용은 이 화면에만 남아요. 로그인한 뒤 저장하면 출생정보와 운세 기록이 계정에 남아요.' : '기본으로는 쓰는 동안만 남고, 기기에 저장할지는 앱에서 골라요.'}</p>` : ''}
      ${library && !item.embedded ? `<section class="benefit-library" aria-label="기기 라이브러리"><div class="line-row"><div><strong>라이브러리에 담기</strong><p>이 기기에 바로가기만 저장해요. 앱 안의 기록과는 관계없어요.</p></div><div class="actions"><button class="sb-btn soft" data-action="save" data-id="${item.id}" aria-pressed="${!!saved}">${saved ? '라이브러리에서 빼기' : '라이브러리에 담기'}</button><button class="sb-btn soft" data-action="favorite" data-id="${item.id}" aria-pressed="${!!favorite}">${favorite ? '★ 즐겨찾기' : '☆ 즐겨찾기'}</button><a class="link" href="#library">내 라이브러리 →</a></div></div></section>` : ''}
      <section class="info benefit-how"><h2>${item.status === 'planned' ? '준비하고 있는 것' : '이렇게 써요'}</h2><ol class="steps">${item.steps.map((step, index) => `<li><span class="step-number">0${index + 1}</span><div><h3>${step.title}</h3><p>${step.body}</p></div></li>`).join('')}</ol></section>
    </div>
  </div>
  ${others.length ? `<section class="block benefit-more" aria-labelledby="benefit-more-title"><div class="block-head"><h2 id="benefit-more-title">다른 회원 혜택</h2><a class="link" href="#benefits">회원 혜택 모두 보기 →</a></div><ul class="shelf${shelfColumns(others.length)}">${others.map(other => benefitItem(other, { signedIn })).join('')}</ul></section>` : ''}`;
}
