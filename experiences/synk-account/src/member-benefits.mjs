import { MEMBER_BENEFITS, memberBenefit } from '../../../desktop/renderer/benefits.mjs';
import { renderMemberInsight } from '../../../desktop/renderer/member-insight-view.mjs';

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
// 혜택 포스터는 PC 앱(launcher)과 같은 물건·같은 규칙: 사업 색 면에서 구운 물건 하나(benefits.css의 .benefit-object), 번호 라벨, 상태 칩.
const artPath = benefit => `./assets/member/${benefit.asset}`;
const art = benefit => `<img class="benefit-object" src="${artPath(benefit)}" alt="${esc(benefit.alt)}">`;
const number = item => `${String(MEMBER_BENEFITS.indexOf(item) + 1).padStart(2, '0')} / ${String(MEMBER_BENEFITS.length).padStart(2, '0')}`;
const state = item => `<span class="benefit-status is-${item.status}"><span class="led" aria-hidden="true"></span>${esc(item.statusLabel)}</span>`;

// The loopback-only demo is separate from membership and production launch rights.
const LOCAL_PREVIEWS = Object.freeze({ care: 'http://127.0.0.1:4296/', fortune: 'http://127.0.0.1:4299/', rehearsal: 'http://127.0.0.1:4297/', 'family-album': 'http://127.0.0.1:4298/' });
export function localBenefitPreview(id, base) {
  if (!Object.hasOwn(LOCAL_PREVIEWS, id) || memberBenefit(id)?.status !== 'preview') return null;
  try {
    const url = new URL(base);
    return url.protocol === 'http:' && !url.username && !url.password && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      ? LOCAL_PREVIEWS[id] : null;
  } catch { return null; }
}

const PUBLIC_ENTRIES = Object.freeze({ care: 'https://synk.im/care/', fortune: 'https://synk.im/fortune/', rehearsal: 'https://synk.im/rehearsal/', 'family-album': 'https://synk.im/album/' });
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
    <div class="benefit-copy"><p class="benefit-kicker">${item.kicker}</p><h2><a href="#benefits/${item.id}">${item.name}</a></h2><p>${item.description}</p><a class="benefit-link" href="#benefits/${item.id}">${item.embedded ? '내 기록 살펴보기' : item.status === 'preview' ? '자세히 살펴보기' : '어떤 경험인가요?'} <span aria-hidden="true">↗</span></a></div>
  </article>`).join('')}</div>` : '<p class="benefit-empty">검색어에 맞는 회원 혜택이 없어요.</p>';
}

export function benefitHero({ home = false } = {}) {
  return `<section class="benefit-hero ${home ? 'benefit-home' : ''}" aria-labelledby="benefit-heading">
    <div class="benefit-hero-copy"><p class="sb-eyebrow">SYNK FOR YOU <span>회원 혜택</span></p>
    <h1 id="benefit-heading">소중한 순간을,<br><span>더 잘.</span></h1><p>오늘의 운세로 가볍게 시작하고,<br>마음을 전하고, 말을 준비하고,<br>가족의 이야기를 간직하는 일.<br>당신의 일상 가까이에 SYNK가 함께합니다.</p>
    ${home ? '<a class="sb-btn soft" href="#benefits">회원 혜택 만나보기 <span aria-hidden="true">→</span></a>' : '<button class="benefit-text-link" data-action="scroll-benefits">회원 혜택 살펴보기 <span aria-hidden="true">↓</span></button>'}
    <p class="benefit-disclosure">공개 서비스는 웹에서 바로 시작해요.<br>서비스별 현재 상태를 확인해 주세요.</p></div>
    <div class="benefit-hero-art" aria-hidden="true"><span class="benefit-index">MEMBER BENEFITS</span><img class="benefit-object" src="./assets/member/benefit-gift.webp" alt=""></div>
  </section>`;
}

export function benefitsPage() {
  return benefitHero() + `<section id="benefit-collection" class="benefit-collection" aria-labelledby="benefit-collection-title"><div class="section-heading"><div><p class="sb-eyebrow">MADE FOR YOUR EVERYDAY</p><h2 id="benefit-collection-title">나를 알아가고, 일상을 더 즐겁게</h2></div><span class="benefit-count">01 — ${String(MEMBER_BENEFITS.length).padStart(2, '0')}</span></div>${benefitCards()}</section>
  <section class="benefit-promise"><p class="sb-eyebrow">A LITTLE MORE PERSONAL</p><h2>매번 처음부터<br>설명하지 않아도 되도록.</h2><div><p>내가 고른 말과 남긴 이야기, 연습에서 어려웠던 순간이 다음 경험에 이어지도록 만들고 있어요.</p><p>서비스별로 기억할 내용을 직접 고르고, 확인하고, 고칠 수 있는 경험을 준비합니다.</p><a class="benefit-link" href="./client.html?product=platform">내 SYNK ID 관리 <span aria-hidden="true">↗</span></a></div></section>`;
}

export function benefitDetail(id, base, { library = null, insight = { status: 'signed-out', report: null } } = {}) {
  const item = memberBenefit(id);
  // 성향 소개도 PC 앱처럼 포스터(물건·번호 라벨·상태 스티커)를 넘겨 다른 소개 머리와 같은 틀로 연다.
  if (id === 'insight' && item) return renderMemberInsight(insight, { poster: { art: artPath(item), label: `SYNK FOR YOU · ${number(item)}`, badge: item.statusLabel, status: item.status } });
  if (!item) return '<div class="page-heading"><h1>서비스를 찾을 수 없어요.</h1><a class="benefit-link" href="#benefits">회원 혜택으로 돌아가기 →</a></div>';
  const preview = localBenefitPreview(id, base), publicEntry = publicBenefitEntry(id);
  const saved = library?.saved?.includes(id), favorite = library?.favorites?.includes(id);
  // 소개 머리: 위 번호 라벨·스티커 → 오른쪽 위 물건 → 큰 한글(--word)과 한 줄 제목 → 설명 선. 화면 제목에는 서비스 이름을 함께 읽힌다.
  return `<a class="back-link benefit-back" href="#benefits">← 회원 혜택 모두 보기</a><header class="benefit-detail-hero benefit-${item.id}">${art(item)}<div class="benefit-detail-top"><span class="benefit-index">SYNK FOR YOU · ${number(item)}</span>${state(item)}</div><div class="benefit-detail-title"><h1><span class="sr-only">${esc(item.name)}. </span>${item.headline}</h1></div><p class="benefit-detail-note">${item.description}</p></header>
    <section class="benefit-availability" aria-label="현재 제공 상태"><div><span class="benefit-status">${item.statusLabel}</span><p>${item.availability}</p></div>${publicEntry ? `<a class="sb-btn" href="${esc(publicEntry)}" data-web="${item.id}" target="_blank" rel="noopener noreferrer">${item.name} 웹에서 시작 ↗</a>` : ''}${preview ? `<a class="sb-btn soft" href="${preview}" data-web="${item.id}" target="_blank" rel="noopener noreferrer">개발 미리보기 열기 ↗</a>` : !publicEntry ? '<a class="benefit-link" href="./client.html?product=platform">SYNK ID 알아보기 ↗</a>' : ''}${preview ? `<p class="benefit-local-note">개발 미리보기는 이 컴퓨터에서 실행 중인 ${item.name}에 연결해요. ${id === 'fortune' ? '비회원 입력은 이 화면에만 남아요. 계정 연결 후 저장을 누르면 출생정보와 운세 기록을 SYNK 계정에서 이어갈 수 있어요.' : '기본은 이번 사용 중에만 보관하며, 기기 저장은 앱에서 직접 선택해요.'}</p>` : ''}</section>
    ${library && !item.embedded ? `<section class="launch-bar" aria-label="기기 라이브러리"><div><strong>다음에도 쉽게 찾아요</strong><p>이 기기에 바로가기만 저장해요. 앱의 개인 기록·계정 저장과는 별개예요.</p></div><div class="actions"><button class="sb-btn soft" data-action="save" data-id="${item.id}" aria-pressed="${!!saved}">${saved ? '라이브러리에서 빼기' : '라이브러리에 담기'}</button><button class="sb-btn soft" data-action="favorite" data-id="${item.id}" aria-pressed="${!!favorite}">${favorite ? '★ 즐겨찾는 서비스' : '☆ 즐겨찾기'}</button><a class="benefit-link" href="#library">내 라이브러리 →</a></div></section>` : ''}
    <section class="benefit-how"><p class="sb-eyebrow">${item.status === 'planned' ? 'COMING EXPERIENCE' : 'HOW IT WORKS'}</p><h2>${item.status === 'planned' ? '이런 경험을 준비하고 있어요' : '이렇게 시작해요'}</h2><ol>${item.steps.map((step, index) => `<li><span class="benefit-step-number">0${index + 1}</span><div><h3>${step.title}</h3><p>${step.body}</p></div></li>`).join('')}</ol></section>
    <section class="benefit-more"><div class="section-heading"><h2>일상의 다른 순간에도</h2><a href="#benefits">회원 혜택 모두 보기 →</a></div><div class="benefit-related">${MEMBER_BENEFITS.filter(other => other.id !== id).map(other => `<a class="benefit-${other.id}" href="#benefits/${other.id}"><img src="${artPath(other)}" alt=""><div><span>${other.statusLabel}</span><strong>${other.name}</strong><p>${other.kicker}</p></div><span aria-hidden="true">↗</span></a>`).join('')}</div></section>`;
}
