// A 진열대(2026-11-08)의 선반 칸 하나: 회색 무대 위 펠트 물건 → 이름 · 설명 · 상태. 칸 전체가 소개로 가는 링크이고,
// 바로 여는 단추나 즐겨찾기 같은 다른 조작은 링크 밖(after)에 둔다(링크 안에 단추를 넣지 않는다). 모양은 platform.css의 .shelf.
// 글은 부르는 쪽이 넘긴 그대로 쓴다(카탈로그 글은 고정 문구, 사용자 글은 부르는 쪽이 이스케이프한다).
export function shelfItem({ href, image, imageClass = '', alt = '', name, heading = 'h3', desc = '', meta = '', dot = false, peek = '', big = false, cls = '', attrs = '', after = '' }) {
  return `<li class="shelf-item${big ? ' big' : ''}${cls ? ' ' + cls : ''}"${attrs ? ' ' + attrs : ''}><a class="shelf-link" href="${href}"><div class="stage"><img${imageClass ? ` class="${imageClass}"` : ''} src="${image}" alt="${alt}"></div><div class="label"><${heading} class="name">${name}</${heading}>${desc ? `<p class="desc">${desc}</p>` : ''}${meta ? `<p class="meta">${dot ? '<span class="dot" aria-hidden="true"></span>' : ''}${meta}</p>` : ''}${peek ? `<span class="peek">${peek}</span>` : ''}</div></a>${after}</li>`;
}

// 칸이 셋 이하인 선반은 세 칸 격자로 둔다(넷째 칸이 빈 회색으로 남지 않게). 넷 이상은 넓은 창 4열.
export const shelfColumns = count => count <= 3 ? ' cols-3' : '';
