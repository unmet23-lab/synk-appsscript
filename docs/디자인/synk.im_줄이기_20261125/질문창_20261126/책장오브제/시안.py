"""검정 무대 묻기 창 위에 책장 오브제를 얹은 시안을 짓는다(11-27 유호님 「검정 무대에 책장을 얹기」).

쓰임: python -I 시안.py <홈 출력 폴더> <시안 출력 폴더> <판 설정.json>
  홈 출력 폴더: 공개빌드/짓기.py가 지은 out(index.html · en/index.html · assets/v12/…)
  판 설정: {"<판 이름>": {"그림": "판/새틴3_….png", "자름": [x0, y0, x1, y1], "책": [[x0, y0, x1, y1] × 4]}}
    자름 · 책은 원본 그림 너비 · 높이에 대한 비율(0~1). 책 넷은 왼쪽부터 한국 유학 · AI 강의 · 광고 · 회사.
  판마다 <시안 출력 폴더>/<판 이름>/에 홈 사본을 쓴다. 책을 누르면 그 사업 질문으로, 다시 누르면 전체로 돌아간다.
"""
import json, shutil, sys
from pathlib import Path
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
OUT, DEST, CONF = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
HERE = Path(__file__).parent
conf = json.loads(CONF.read_text('utf8'))
KS = ['study', 'ai', 'ads', 'company']
NAME = {'ko': ['한국 유학', 'AI 강의', '광고', '회사'], 'en': ['Study', 'AI training', 'Advertising', 'Company']}
ALL = {'ko': '전체', 'en': 'All'}

CSS = """
/* 책장 오브제 시안 */
.st-pick{grid-template-columns:minmax(0,1fr) min(34vw,460px);grid-template-areas:"t t" "m b" "m s"}
.st-side>.st-k,.st-scopes{display:none}
.st-shelf{grid-area:b;position:relative;width:100%;margin:4.5vh 0 0;padding:26px 0 30px}
.st-shelf img{display:block;width:100%;height:auto;-webkit-mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.st-book{position:absolute;border-radius:22px;cursor:pointer}
.st-book::before{content:"";position:absolute;inset:-10% -14%;border-radius:50%;background:radial-gradient(closest-side,rgba(255,240,222,.2),rgba(255,240,222,0));opacity:0;transition:opacity .4s}
.st-book:hover::before{opacity:.55}
.st-book[aria-pressed="true"]::before{opacity:1}
.st-bn{position:absolute;left:50%;top:calc(100% + 14px);transform:translateX(-50%);white-space:nowrap;font:500 14px/1 var(--sans);color:var(--g3);transition:color .2s}
.st-book:hover .st-bn,.st-book[aria-pressed="true"] .st-bn{color:#fff}
.st-book[aria-pressed="true"] .st-bn::before{content:"";position:absolute;left:-10px;top:50%;width:2px;height:12px;margin-top:-6px;border-radius:2px;background:#f96859}
.st-ball{position:absolute;right:0;top:0;font:500 13px/1 var(--sans);color:var(--g3);padding:6px 0}
.st-ball[aria-pressed="true"]{color:#fff}
@media (max-width:820px){
  .st-pick{grid-template-columns:minmax(0,1fr);grid-template-areas:"t" "b" "m" "x"}
  .st-shelf{width:calc(100% + 44px);margin:6px -22px 0;padding:26px 0 26px}
  .st-bn{font-size:12px;top:calc(100% + 8px)}
  .st-ball{right:22px}
  .st-book[aria-pressed="true"] .st-bn::before{left:-8px}
}
"""
JS = """
(() => {
  const books = [...document.querySelectorAll('.st-book')], all = document.querySelector('.st-ball');
  const sync = () => { const k = document.querySelector('.st-sc[aria-pressed="true"]')?.dataset.k || 'all'; books.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k))); all.setAttribute('aria-pressed', String(k === 'all')); };
  const pick = k => { document.querySelector(`.st-sc[data-k="${k}"]`)?.click(); sync(); };
  books.forEach(b => b.addEventListener('click', () => pick(b.getAttribute('aria-pressed') === 'true' ? 'all' : b.dataset.k)));
  all.addEventListener('click', () => pick('all'));
  new MutationObserver(sync).observe(document.querySelector('.st-scopes'), { attributes: true, childList: true, subtree: true });
})();
"""

for name, c in conf.items():
    d = DEST / name
    if d.exists():
        shutil.rmtree(d)
    shutil.copytree(OUT, d)
    im = Image.open(HERE / c['그림']).convert('RGB')
    W, H = im.size
    x0, y0, x1, y1 = c['자름']
    crop = im.crop((round(x0 * W), round(y0 * H), round(x1 * W), round(y1 * H)))
    cw, ch = crop.size
    if cw > 1600:
        crop = crop.resize((1600, round(ch * 1600 / cw)), Image.LANCZOS)
    crop.save(d / 'assets/v12/shelf.webp', quality=86)
    fw, fh = (x1 - x0), (y1 - y0)
    for lang, page in (('ko', d / 'index.html'), ('en', d / 'en/index.html')):
        h = page.read_text('utf8')
        btn = []
        for k, n, (bx0, by0, bx1, by1) in zip(KS, NAME[lang], c['책']):
            l, t = (bx0 - x0) / fw * 100, (by0 - y0) / fh * 100
            w, hh = (bx1 - bx0) / fw * 100, (by1 - by0) / fh * 100
            btn.append(f'<button type="button" class="st-book" data-k="{k}" aria-pressed="false" style="left:{l:.2f}%;top:{t:.2f}%;width:{w:.2f}%;height:{hh:.2f}%"><span class="st-bn">{n}</span></button>')
        shelf = (f'<div class="st-shelf"><img src="/assets/v12/shelf.webp" alt="" width="{crop.size[0]}" height="{crop.size[1]}">'
                 + ''.join(btn) + f'<button type="button" class="st-ball" aria-pressed="true">{ALL[lang]}</button></div>')
        a = '</p></div>\n        <div class="st-main">'
        assert h.count(a) == 1, (page, h.count(a))
        h = h.replace(a, '</p></div>\n        ' + shelf + '\n        <div class="st-main">')
        h = h.replace('</body>', f'<style>{CSS}</style><script>{JS}</script></body>')
        page.write_text(h, 'utf8')
    print(name, crop.size)
