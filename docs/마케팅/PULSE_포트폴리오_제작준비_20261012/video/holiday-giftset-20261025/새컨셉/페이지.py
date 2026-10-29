# -*- coding: utf-8 -*-
# 유호님께 보여 드릴 기획 페이지 — 시안 그림을 data URI로 넣은 한 장(git 밖, 아티팩트로 올림)
#   python -I -X utf8 페이지.py   → <밖>/시안/기프트세트_새컨셉.html (페이지_시험.json이 있으면 재시험 · Fable 칸을 채움)
import base64
import html
import json
import os

웹 = r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/holiday-giftset/새컨셉/시안/웹"
HERE = os.path.dirname(웹)  # git 밖 시안 폴더 — 그림이 든 HTML은 저장소에 두지 않는다
OUT = os.path.join(HERE, "기프트세트_새컨셉.html")
jp = os.path.join(HERE, "페이지_시험.json")
extra = json.load(open(jp, encoding="utf-8")) if os.path.exists(jp) else {}


def img(n):
    with open(os.path.join(웹, n), "rb") as f:
        return "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()


def frames(items):
    out = []
    for n, beat, cap in items:
        out.append(f'<figure class="fr"><img src="{img(n)}" alt="{html.escape(beat + " " + cap)}" loading="lazy">'
                   f'<figcaption><b>{html.escape(beat)}</b>{html.escape(cap)}</figcaption></figure>')
    return '<div class="strip">' + "".join(out) + "</div>"


C = [("a1_세로.jpg", "기 0–2초", "깜깜한 유리에 서리 결정이 자란다. 겨울밤, 창이 언다"),
     ("c1_세로.jpg", "승 2–7초", "새벽에 쓴 「다녀올게」 위로 서리가 다시 끼고, 밤에 다른 손이 「꼭 바르고 나가」"),
     ("c2_세로.jpg", "전 7–11초", "크리스마스이브 새벽 「창틀 봐」, 창턱에 육각 선물 상자"),
     ("c3_끝글_세로.jpg", "결 11–15초", "아침 창에 「고마워」와 열린 선물, 끝 줄과 이름")]
A = [("a1_세로.jpg", "기 0–2.5초", "깜깜한 유리에 결정 하나가 여섯 갈래로 자란다"),
     ("a2_세로.jpg", "승 2.5–6초", "창 가장자리부터 고사리처럼 뻗은 서리꽃이 창을 덮어 간다"),
     ("a3_세로.jpg", "전 6–10초", "안에서 온기가 닿은 자리부터 녹아 열린 맑은 동그라미, 그 너머 창턱의 선물"),
     ("a4_세로.jpg", "결 10–13초", "동그라미를 지나 방 안으로, 두 제품 가까이"),
     ("a3_끝글_세로.jpg", "끝 13–15초", "다시 창 밖에서 「온기가 닿은 자리부터 맑아진다」 · 이름")]
B = [("b1_세로.jpg", "기–승 0–6초", "얼음 덩어리 속에 잠든 두 제품, 금빛 세럼 한 방울이 떨어져 얼음에 금이 번진다"),
     ("b2_세로.jpg", "전 6–11초", "깨지는 순간 시간이 멎고, 카메라가 조각 · 금빛 방울 · 제품 사이를 지난다"),
     ("b1_끝글_세로.jpg", "결 11–15초", "다시 흐르며 조각이 흩어지고 제품이 내려앉음 + 이름")]

재시험 = extra.get("재시험", "<p class='mute'>고친 판으로 다시 본 결과를 넣는 중입니다.</p>")
페이블 = extra.get("페이블", "<p class='mute'>검수 결과를 넣는 중입니다.</p>")

page = f"""<title>유리결 서리꽃 새 컨셉</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@300;500&display=swap">
<style>
/* 한 줄 흐름: 겨울밤 창 — 짙은 남색 바탕에 서리 은빛 · 방 금빛 두 온도, 그림이 주인공 */
:root {{
  --night: #0b1020; --panel: #121a30; --ink: #ece6da; --mute: #a3abbf; --frost: #b9c8e6; --gold: #dcb878;
  --line: rgba(185, 200, 230, 0.16);
  --serif: "Noto Serif KR", "Batang", serif; --sans: "Noto Sans KR", "Malgun Gothic", sans-serif;
  color-scheme: dark;
}}
body {{ background: var(--night); color: var(--ink); font-family: var(--sans); font-size: 15px; line-height: 1.7; }}
.wrap {{ max-width: 1120px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 40px 72px; display: grid; gap: 56px; }}
h1, h2, h3 {{ font-family: var(--serif); font-weight: 300; text-wrap: balance; margin: 0; letter-spacing: -0.01em; }}
h1 {{ font-size: clamp(30px, 5vw, 46px); line-height: 1.25; }}
h2 {{ font-size: clamp(22px, 3vw, 30px); }}
h3 {{ font-size: 22px; font-weight: 500; }}
p {{ margin: 0; max-width: 68ch; }}
.mute {{ color: var(--mute); }}
.eyebrow {{ font-size: 12px; letter-spacing: 0.12em; color: var(--frost); }}
.hero {{ display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: 32px; align-items: center; }}
.hero .lede {{ display: grid; gap: 18px; min-width: 0; }}
.hero img {{ width: 100%; max-width: 100%; border-radius: 6px; display: block; }}
.ask {{ border-left: 2px solid var(--gold); padding: 10px 0 10px 16px; display: grid; gap: 4px; }}
.ask b {{ color: var(--gold); font-weight: 500; }}
section {{ display: grid; gap: 18px; min-width: 0; }}
.table-wrap {{ overflow-x: auto; }}
table {{ border-collapse: collapse; width: 100%; min-width: 640px; font-size: 14px; }}
th, td {{ text-align: left; vertical-align: top; padding: 10px 12px; border-bottom: 1px solid var(--line); }}
th {{ font-weight: 500; color: var(--mute); font-size: 12px; letter-spacing: 0.06em; }}
td.n {{ font-variant-numeric: tabular-nums; white-space: nowrap; }}
a {{ color: var(--frost); text-underline-offset: 3px; }}
a:focus-visible {{ outline: 2px solid var(--gold); outline-offset: 2px; }}
.concept {{ display: grid; gap: 16px; padding-block: 28px; border-top: 1px solid var(--line); }}
.concept header {{ display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: baseline; }}
.tag {{ font-size: 12px; letter-spacing: 0.08em; padding: 2px 10px; border: 1px solid var(--line); border-radius: 999px; color: var(--mute); }}
.tag.rec {{ border-color: var(--gold); color: var(--gold); }}
.weapon {{ color: var(--frost); }}
.meta {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px 28px; margin: 0; }}
.meta div {{ min-width: 0; display: grid; gap: 4px; }}
.meta dt {{ font-size: 12px; color: var(--mute); letter-spacing: 0.06em; }}
.meta dd {{ margin: 0; }}
.strip {{ display: grid; grid-auto-flow: column; grid-auto-columns: minmax(150px, 200px); gap: 14px; overflow-x: auto;
  padding-bottom: 8px; scroll-snap-type: x proximity; }}
.fr {{ margin: 0; display: grid; gap: 8px; scroll-snap-align: start; min-width: 0; align-content: start; }}
.fr img {{ width: 100%; aspect-ratio: 9 / 16; object-fit: cover; border-radius: 4px; display: block; }}
.fr figcaption {{ font-size: 13px; line-height: 1.55; color: var(--mute); display: grid; gap: 2px; }}
.fr figcaption b {{ color: var(--gold); font-weight: 500; }}
.risk {{ font-size: 14px; color: var(--mute); }}
.risk b {{ color: var(--ink); font-weight: 500; }}
.prod {{ display: grid; grid-template-columns: minmax(0, 260px) minmax(0, 1fr); gap: 24px; align-items: start; }}
.prod img {{ width: 100%; max-width: 100%; aspect-ratio: 9 / 16; object-fit: cover; border-radius: 4px; display: block; }}
.prod .items {{ display: grid; gap: 14px; min-width: 0; }}
.prod .items div {{ display: grid; gap: 2px; }}
.prod b {{ font-weight: 500; }}
.box {{ background: var(--panel); border-radius: 6px; padding: 18px 20px; display: grid; gap: 12px; min-width: 0; }}
.box h3 {{ font-size: 18px; }}
ul {{ margin: 0; padding-left: 1.2em; display: grid; gap: 6px; }}
@media (max-width: 760px) {{ .hero, .prod {{ grid-template-columns: 1fr; }} .prod img {{ max-width: 260px; }} }}
@media (prefers-reduced-motion: reduce) {{ * {{ scroll-behavior: auto; }} }}
</style>
<div class="wrap">
  <div class="hero">
    <div class="lede">
      <span class="eyebrow">PULSE 포트폴리오 · 시즌 홀리데이 기프트 세트 · 10월 29일</span>
      <h1>유리결 서리꽃,<br>컨셉부터 다시</h1>
      <p>지난 판은 원본의 컷과 초만 옮겨 「흰 상자가 열리는 영상」에 그쳤습니다. 이번에는 레퍼런스를 숫자로 다시 고르고, 안마다 무엇으로 이길지 먼저 정한 세 안을 블렌더 시안 컷으로 만들었습니다. 그림 · 영상 모델은 쓰지 않았고(크레딧 0), 제품 · 서리 · 창에 쓴 글씨 · 라벨까지 모두 직접 지은 것입니다.</p>
      <div class="ask"><b>고르실 것 — 세 안 가운데 하나</b><span>추천은 안 3 「창에 쓴 말」입니다(첫 2초는 안 1의 서리 결정 접사로 엽니다). 처음엔 안 1을 추천했는데, 낯선 시청자 시험에서 둘 다 안 3을 고르고 안 1은 「흔한 고급 화장품 공식」으로도 읽혀 바꿨습니다.</span></div>
    </div>
    <img src="{img('c3_끝글_세로.jpg')}" alt="안 3 끝 그림 — 아침 서리 창에 쓴 고마워, 열린 선물과 두 제품, 끝 줄">
  </div>

  <section>
    <h2>레퍼런스에서 읽은 것</h2>
    <p class="mute">유튜브 공식 API로 직접 읽은 숫자입니다(상세 6,187편, 받아 잰 영상 11편). 「평소의 몇 배」는 그 채널 최근 업로드 중앙값과 견준 값입니다.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>무엇</th><th>원본</th><th>숫자</th><th>먹힌 까닭</th></tr></thead>
      <tbody>
        <tr><td>결정이 번지는 한 컷</td><td><a href="https://www.youtube.com/watch?v=Wqk_CKSxlyU" target="_blank" rel="noopener">얼어붙는 비눗방울</a> (Adrian Ybarra)</td><td class="n">133.3만 · 평소 1,093배 · 좋아요 2.13%</td><td>컷 없이 결정이 깃털 · 고사리처럼 번지고 뒤는 금빛 보케. 댓글 「식물처럼 자란다」「마법」</td></tr>
        <tr><td>〃</td><td><a href="https://www.youtube.com/watch?v=kcUYvUpc58E" target="_blank" rel="noopener">frozen bubbles</a> · <a href="https://www.youtube.com/watch?v=53iE0fKcu5o" target="_blank" rel="noopener">Bubble freeze</a></td><td class="n">146.7만 · 79.7만(20초 · 컷 0)</td><td>2초부터 결정이 번지는 쇼츠 호흡. 「터지는 걸 보러 왔다」</td></tr>
        <tr><td>얼굴 없는 짧은 이야기</td><td><a href="https://www.youtube.com/watch?v=uXlWYZ022zU" target="_blank" rel="noopener">Nike 스펙 광고</a> (Adam Saunders)</td><td class="n">216.1만 · 46초</td><td>시계 숫자로 하루를 세며 손 · 물건만, 끝에 한 줄</td></tr>
        <tr><td>공력만(독립 3D 뷰티 CG)</td><td>표본 상위 다섯</td><td class="n">2023~25 상한 약 9만</td><td>가상 브랜드가 공력만으로 크게 퍼진 사례는 없음. 이름은 바닥을 올리고 터짐은 복권</td></tr>
        <tr><td>역풍</td><td>코카콜라 2025 AI 홀리데이 · 맥도날드 네덜란드 2025</td><td class="n">좋아요 0.58% · 3일 만에 삭제</td><td>「영혼 없음」, 일관성 깨짐. 국내 반응 「AI인 걸 알면 기분 나쁘다 · 내용이 문제」</td></tr>
      </tbody>
    </table></div>
    <p>가상 브랜드에도 옮겨지는 힘은 둘이었습니다. 사람들이 넋 놓고 보는 현상 그 자체(결정이 표면을 타고 번지는 한 컷)와, 끝에서 뜻이 바뀌는 한 줄입니다. 결정 영상의 큰 숫자는 2011~17년 업로드가 쌓은 것이라, 「넋 놓고 보게 하는 힘은 증명됐다」까지만 믿습니다.</p>
  </section>

  <section>
    <h2>세 안</h2>
    <article class="concept">
      <header><h3>안 3 「창에 쓴 말」</h3><span class="tag rec">추천</span><span class="weapon">무기: 이야기(기승전결 · 여운)</span></header>
      <dl class="meta">
        <div><dt>한 문장</dt><dd>얼굴 볼 틈 없는 겨울, 창에 쓴 한마디가 선물이 된다.</dd></div>
        <div><dt>끝 줄</dt><dd>「서리꽃은 따뜻한 창에만 핀다」 — 창 서리꽃은 방 안이 따뜻할 때 피는 실제 현상입니다. 서로 챙기는 집이라서 핀다는 뜻으로 닫힙니다.</dd></div>
      </dl>
      {frames(C)}
      <p class="risk"><b>6초</b> 「창틀 봐」 0–2 → 선물 2–4 → 「고마워」 · 끝 줄 · 이름 4–6. <b>만드는 법</b> 서리는 날마다 다른 서리를 물리 계산으로 풀고, 글씨는 우리 글꼴의 뼈대를 손끝 폭으로 다시 그어 획 순서대로 녹아 써지게 블렌더로 굽습니다. 손이 보이는 컷만 시댄스 무제한 뒤에 뽑습니다. <b>위험</b> 15초에 말 넷은 빠듯합니다. 원하시면 30초 본편 + 15초 · 6초 줄임판이 이야기에 더 맞습니다.</p>
    </article>
    <article class="concept">
      <header><h3>안 1 「온기가 닿은 자리」</h3><span class="weapon">무기: 비싼 장치(물리로 자라는 서리 · 녹아 맑아지는 유리)</span></header>
      <dl class="meta">
        <div><dt>한 문장</dt><dd>온기가 닿은 자리부터 맑아진다 — 유리결.</dd></div>
        <div><dt>시험 뒤 바꾼 것</dt><dd>끝 줄을 바꿨습니다(「따뜻한 창에만 핀다」는 녹는 그림과 반대로 읽혔습니다).</dd></div>
      </dl>
      {frames(A)}
      <p class="risk"><b>위험</b> 가장 비싸 보이지만 한 시험관은 「확대 영상 → 제품 → 시 같은 문구, 흔한 고급 화장품 공식」으로 읽었습니다. 선물 단서가 약합니다.</p>
    </article>
    <article class="concept">
      <header><h3>안 2 「얼어붙은 1초」</h3><span class="weapon">무기: 순수 스펙터클</span></header>
      <dl class="meta">
        <div><dt>한 문장</dt><dd>겨울의 가장 맑은 1초를 담았다.</dd></div>
        <div><dt>근거</dt><dd>얼어붙는 비눗방울의 「터지는 걸 보러 왔다」(146.7만).</dd></div>
      </dl>
      {frames(B)}
      <p class="risk"><b>위험</b> 시험관 둘 다 「그냥 제품 광고」로 읽었고 첫 컷에서 넘긴다고 했습니다. 얼음이 깨지며 제품이 드러나는 꼴은 흔하고, 여운을 맡을 줄이 없습니다.</p>
    </article>
  </section>

  <section>
    <h2>제품 · 포장도 다시</h2>
    <div class="prod">
      <img src="{img('a4_세로.jpg')}" alt="창턱의 육각 남색 크림 단지와 육각 유리 앰플, 뒤로 서리 낀 창">
      <div class="items">
        <p class="mute">지난 판(흰 상자 · 샴페인 리본 · 맑은 단지 · 네모 앰플)은 「그냥 일반 제품」으로 읽힌 몫이 있었습니다. 눈 결정의 여섯 모를 디자인 말로 삼았습니다.</p>
        <div><b>앰플 30 ml</b><span class="mute">육각 두꺼운 유리, 금빛 세럼, 금 목, 얼음 결정 모양 젖빛 크리스털 캡, 서리꽃 새김과 흰 잉크 라벨</span></div>
        <div><b>크림 50 ml</b><span class="mute">깊은 밤 남색 유리 육각 단지, 금 띠, 금박 라벨, 젖빛 크리스털 뚜껑에 서리꽃이 맑게 깎임</span></div>
        <div><b>상자</b><span class="mute">육각 밤 남색 판지, 뚜껑 금박 서리꽃, 흰 실크 띠 하나, 금 육각 봉인</span></div>
        <div><b>서리꽃 무늬</b><span class="mute">손으로 그린 눈꽃이 아니라 시뮬레이션이 푼 실제 결정 하나입니다. 「이 브랜드의 무늬는 진짜 눈 결정」이 제품 이야기가 됩니다</span></div>
      </div>
    </div>
  </section>

  <section>
    <h2>보여 드리기 전 시험 · 검수</h2>
    <div class="box">
      <h3>낯선 시청자 시험 1차 — 시험관 둘(서로 다른 모델 · 보드 순서 다르게, 우리 판단을 뺀 보드)</h3>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>안 3 창에 쓴 말</th><th>안 1 온기가 닿은 자리</th><th>안 2 얼어붙은 1초</th></tr></thead>
        <tbody>
          <tr><td>「그냥 일반 제품 광고」</td><td>아니오 · 아니오</td><td>예 · 아니오에 가까움</td><td>예(가장 심함) · 예</td></tr>
          <tr><td>비싸 보임(5점)</td><td class="n">3 · 3</td><td class="n">4 · 4</td><td class="n">3 · 4</td></tr>
          <tr><td>여운(5점)</td><td class="n">4 · 4</td><td class="n">3 · 4</td><td class="n">2 · 3</td></tr>
          <tr><td>끝까지 볼까</td><td>5할 · 끝까지</td><td>2~3할 · 끝까지</td><td>첫 컷에 넘김 · 넘김</td></tr>
          <tr><td>하나만 고르면 · 선물하고 싶은 광고</td><td>둘 다 안 3</td><td>—</td><td>—</td></tr>
        </tbody>
      </table></div>
      <p class="mute">짚은 것을 고쳤습니다. 창 글씨가 「굵은 고딕 · 검은 페인트」 같다 → 글꼴 뼈대를 손끝 폭으로 다시 긋고 녹은 물줄기를 더함. 「손 트지 마」인데 얼굴용 제품 → 「꼭 바르고 나가」. 「고마워」 장면이 없다 → 아침 컷을 새로. 서리가 벽지 같다 → 날마다 다른 시뮬레이션 서리. 안 1은 말과 그림이 반대 → 끝 줄 바꿈. 셋 공통으로 이름이 작다 → 키움. 라벨이 없어 3D 견본 같다 → 라벨. 볼만한 장면이 5초 뒤 → 안 3을 결정 접사로 엶.</p>
    </div>
    <div class="box"><h3>고친 판으로 다시 본 시험</h3>{재시험}</div>
    <div class="box"><h3>Fable 검수</h3>{페이블}</div>
  </section>

  <section>
    <h2>고르신 뒤</h2>
    <p>15초 · 6초 콘티를 짜고, 서리 계산을 컷 박자에 맞춰 다시 푼 뒤 블렌더로 움직임을 굽습니다. 소리를 얹고, 낯선 시청자 시험과 Fable 검수를 거쳐 다시 보여 드립니다. 안 3이면 손 컷만 시댄스 무제한 뒤에 뽑고, 30초 본편을 원하시면 그 판부터 짭니다. 가로판은 같은 움직임을 카메라 둘로 굽습니다.</p>
  </section>
</div>
"""
open(OUT, "w", encoding="utf-8").write(page)
print(OUT, round(len(page) / 1e6, 2), "MB")
