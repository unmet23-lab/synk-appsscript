'use strict';

// Serialized into the browser by both the artwork renderer and its read-only test.
function inspectCardLayouts() {
  return Array.from(document.querySelectorAll('.artboard')).map(board => {
    const bounds = board.getBoundingClientRect();
    const copy = board.querySelector('.copy');
    const copyBounds = copy.getBoundingClientRect();
    const footer = board.querySelector('.folio').getBoundingClientRect();
    const text = Array.from(copy.querySelectorAll('h1,p,li')).map(element => {
      const rect = element.getBoundingClientRect();
      return { text: element.textContent, top: rect.top - bounds.top, bottom: rect.bottom - bounds.top,
        left: rect.left - bounds.left, right: rect.right - bounds.left, overflow: element.scrollWidth > element.clientWidth + 1 };
    });
    const assets = Array.from(board.querySelectorAll('.hero-asset,.diptych')).map(element => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top - bounds.top, bottom: rect.bottom - bounds.top, left: rect.left - bounds.left, right: rect.right - bounds.left };
    });
    const brandBox = board.querySelector('.brand-lock').getBoundingClientRect();
    const images = Array.from(board.querySelectorAll('.brand-lock img')).map(element => {
      const rect = element.getBoundingClientRect();
      return { source: element.getAttribute('src'), width: rect.width, height: rect.height, loaded: element.complete && element.naturalWidth > 0,
        top: rect.top - bounds.top, bottom: rect.bottom - bounds.top };
    });
    return { card: board.dataset.card,
      brand: { images, flatSvg: board.querySelectorAll('.brand-lock svg').length, flatDivision: board.querySelectorAll('.division-label').length,
        overlapCopy: brandBox.bottom > copyBounds.top - 24, outside: brandBox.left < bounds.left || brandBox.right > bounds.right },
      fonts: { suit: document.fonts.check('800 48px "SUIT Variable"', '한국어'), inter: document.fonts.check('600 48px "Inter Tight"', 'Өөрийн үг') },
      copyBottom: copyBounds.bottom - bounds.top, footerTop: footer.top - bounds.top, text, assets,
      textOverflow: text.some(item => item.overflow || item.right > 992 || item.bottom > footer.top - bounds.top - 16),
      collision: assets.some(asset => asset.top < copyBounds.bottom - bounds.top + 24 && asset.right > copyBounds.left - bounds.left) };
  });
}

module.exports = { inspectCardLayouts };
