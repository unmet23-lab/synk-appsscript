"""Build six self-contained monochrome technical drawings for the filing draft.

This creates illustrative drawings of the existing local Core 0.5 implementation.
It does not create a registration certificate or claim that a patent was granted.
"""
from pathlib import Path
from html import escape
import base64
import io
import json

from fontTools.ttLib import TTFont
from fontTools import subset

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
svgs = []
TEXTS = []

def text(x, y, words, size=24, weight=500, anchor="middle", family="body"):
    TEXTS.append(words)
    return f'<text x="{x}" y="{y}" class="{family}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}">{escape(words)}</text>'

def lines(x, y, words, size=24, gap=32, weight=500, anchor="middle"):
    return ''.join(text(x, y + i * gap, word, size, weight, anchor) for i, word in enumerate(words))

def rect(x, y, w, h, dashed=False, stroke=2):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="white" stroke="black" stroke-width="{stroke}"' + (' stroke-dasharray="8 6"' if dashed else '') + '/>'

def line(x1, y1, x2, y2, arrow=False, dashed=False, width=2):
    return f'<path d="M {x1} {y1} L {x2} {y2}" fill="none" stroke="black" stroke-width="{width}"' + (' marker-end="url(#arrow)"' if arrow else '') + (' stroke-dasharray="7 6"' if dashed else '') + '/>'

def path(points, arrow=True, dashed=False):
    d = 'M ' + ' L '.join(f'{x} {y}' for x,y in points)
    return f'<path d="{d}" fill="none" stroke="black" stroke-width="2" stroke-linejoin="miter"' + (' marker-end="url(#arrow)"' if arrow else '') + (' stroke-dasharray="7 6"' if dashed else '') + '/>'

def box(x, y, w, h, words, size=24, gap=32, dashed=False):
    baseline = y + h / 2 - (len(words)-1)*gap/2 + size*.34
    return rect(x,y,w,h,dashed) + lines(x+w/2,baseline,words,size,gap)

def figure(number, title, inner):
    title_text = f'도 {number}  {title}'
    head = text(45, 57, title_text, 28, 800, 'start')
    head += line(45, 80, 955, 80)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650" viewBox="0 0 1000 650" role="img" aria-labelledby="title desc">
<title id="title">{escape(title_text)}</title><desc id="desc">{escape(FIGS[number-1]['caption'])}</desc>
<defs><style>__FONTS__
.body {{ font-family: 'Inter Tight', 'SUIT Variable', sans-serif; }}
text {{ fill: black; font-synthesis: none; }}
</style><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="black"/></marker></defs>
<rect width="1000" height="650" fill="white"/>{head}{inner}</svg>'''

FIGS = [
    {'number':1,'file':'fig1.svg','title':'전체 처리 장치','caption':'동일 원음과 사건을 보존하는 저장부, 시간·능력 범위 판정부, 사용 자격 판정부, 기여 원장 및 확인 계획의 연결을 나타낸다. 점선은 화면에서 발생한 실제 확인 사건의 입력 경로이며, 각 박스는 로컬 작업실의 기능 구분이다.','refs':'100 처리 장치 · 110 기록 저장부 · 120 시간·범위 판정부 · 130 사용 자격 판정부 · 140 기여 원장 · 150 확인 계획부 · 160 화면·출력부'},
    {'number':2,'file':'fig2.svg','title':'원음과 자격 기록의 관계','caption':'원음의 참조, 발화 식별자와 시도 구분을 바탕으로 전사 자료 및 능력별 최초 수행의 자격을 연결한다. 도움 기록의 시간·능력 범위는 관련 수행 자격에 연결되고, 원인 사건 및 전후 기여는 전이 기록으로 남는다. 논리적 관계도이며 별도 DB 테이블 여섯 개를 뜻하지 않는다.','refs':'200 발화 기록 · 210 원음 · 220 시도 구분 · 230 목적·능력별 자격 · 240 도움 기록 · 250 기여 전이'},
    {'number':3,'file':'fig3.svg','title':'늦은 도움에 따른 기여 갱신','caption':'늦게 도착한 도움이나 실제 확인 사건을 기존 원음·발화·시도에 연결한다. 시간·능력 범위와 목적별 조건에 따라 자격 및 기여를 갱신하고 원인 사건과 전후 결과를 저장한다. 관련 자격의 결과를 선택적으로 변경한다는 뜻이며, 전체 처리가 영향 셀만 방문한다는 뜻은 아니다.','refs':'110 사건 저장 · 120 관계 판정 · 130 자격 계산 · 140 원장 · 150 재계획 · 210 원음 · 250 기여 전이'},
    {'number':4,'file':'fig4.svg','title':'고정 녹음 구간과 도움 가능 범위','caption':'고정된 녹음 구간 [S,E]와 도움 발생 가능 범위 [L,U]를 비교한다. U<S이면 발화 전, L>E이면 발화 후, S≤L≤U≤E이면 발화 중이며 나머지는 불명이다. 그림의 수치는 설명용 상대 시각이며 각 행은 별도 사례다.','refs':'120 시간 판정 · 200 고정 녹음 구간 [S,E] · 240 도움 가능 범위 [L,U]'},
    {'number':5,'file':'fig5.svg','title':'같은 원음의 자격 변화','caption':'도움 시간만 불명인 상태에서 해당 도움을 조사 능력에 한정해 확인한 예다. 별도 사례 A는 발화 전 도움으로 최초 조사 수행의 기여를 제외하고, 사례 B는 발화 후 도움으로 그 기여를 반영한다. 전사 확인·문항 역할·과거형 독립·관측 범위 등 다른 조건은 충족된 것으로 전제한다.','refs':'210 동일 원음 · 200 동일 발화 · 220 원래 시도 e0 · 230 목적·능력별 자격'},
    {'number':6,'file':'fig6.svg','title':'기존 근거 확인과 새 수행의 분리','caption':'Core가 생성하는 유한한 확인 후보에서 기존 원음·기록을 확인하는 행동과 답 제시 후 새 응답을 얻는 행동을 구별한다. 새 응답은 원래 전사·독립 수행의 확인 수단으로 소급하지 않는다. 실제 결과가 저장된 뒤 자격과 남은 확인 계획을 다시 계산한다.','refs':'130 자격 판정 · 150 확인 계획부 · 220 새 시도 e1 · 230 원래 자격 · 260 확인 행동'},
]

# FIG. 1 — functional connections, not separate deployed services.
s = rect(45,110,910,485,dashed=True)
s += text(66,143,'100  프로세서·메모리를 갖는 처리 장치',24,600,'start')
s += box(75,180,240,110,['110  기록 저장부','원음·발화·도움'])
s += box(380,180,240,110,['120  관계 판정','시간·능력 범위'])
s += box(685,180,240,110,['130  자격 판정','용도·시도·능력'])
s += box(685,385,240,110,['140  기여 원장','원인·전후 결과'])
s += box(380,385,240,110,['150  확인 계획','남은 조건·수단'])
s += box(75,385,240,110,['160  화면·출력','판정·확인 행동'])
s += line(315,235,380,235,True) + line(620,235,685,235,True)
s += line(805,290,805,385,True)
s += path([(755,290),(755,330),(500,330),(500,385)])
s += text(520,321,'남은 조건',22)
s += line(380,440,315,440,True)
s += path([(805,495),(805,550),(195,550),(195,495)])
s += text(500,581,'저장된 판정·기여 출력',22)
s += line(195,385,195,290,True,True)
s += text(258,337,'실제 확인',22)
s += text(500,626,'로컬 작업실의 기능 구성 · 운영 학생 DB 연결을 나타내지 않음',22)
svgs.append(figure(1,FIGS[0]['title'],s))

# FIG. 2 — logical records and links.
s = box(60,120,260,104,['210  원음','내용 지문·참조'])
s += box(380,120,290,104,['200  발화 기록','식별자·전사·시각'])
s += box(730,120,210,104,['220  시도','원래 시도 e0'])
s += line(320,172,380,172,True) + line(670,172,730,172,True)
s += rect(320,300,620,207)
s += text(630,336,'230  목적·능력별 자격',25,600)
s += line(320,358,940,358) + line(528,358,528,507) + line(734,358,734,507)
s += lines(424,395,['전사 자료','원음–전사 쌍','e0 · 전사'],23,38)
s += lines(631,395,['최초 수행','조사 사용','e0 · 조사'],23,38)
s += lines(837,395,['최초 수행','과거형 사용','e0 · 과거형'],23,38)
s += line(525,224,525,300,True)
s += path([(835,224),(835,264),(695,264),(695,300)])
s += box(60,324,205,166,['240  도움','발생 가능 범위','대상 능력·출처'],23,35)
s += path([(265,407),(290,407),(290,334),(320,334)])
s += box(405,557,450,64,['250  원인 사건·자격의 전후 기여'],24)
s += line(630,507,630,557,True)
s += text(60,591,'논리 레코드',22,500,'start')
svgs.append(figure(2,FIGS[1]['title'],s))

# FIG. 3 — delayed arrival and selective qualification changes.
s = ''
steps=[('S110','늦은 도움·실제 확인 사건 수신'),('S120','원음·발화·시도 기록에 연결'),('S130','시간·능력 범위와 용도 조건 판정'),('S140','자격 및 기여의 현재 결과 계산'),('S150','원인 사건·전후 기여를 저장'),('S160','화면 갱신·남은 조건으로 재계획')]
for i,(ref,desc) in enumerate(steps):
    y=103+i*86
    s += box(65,y,570,62,[f'{ref}  {desc}'],24)
    if i<5: s += line(350,y+62,350,y+86,True)
s += box(710,103,225,125,['210  동일 원음','내용 보존'],24,35)
s += path([(635,220),(677,220),(677,165),(710,165)],dashed=True)
s += rect(710,310,225,166)
s += lines(823,348,['130  자격 결과','반영 / 보류 / 제외'],24,42,600)
s += text(823,440,'조건에 따라 결정',22)
s += line(635,392,710,392,True)
s += box(710,533,225,62,['250  기여 전이'],24)
s += path([(635,478),(674,478),(674,564),(710,564)])
s += text(500,634,'새 사건으로 판단이 바뀌어도, 기존 원음 내용은 보존한다.',23)
svgs.append(figure(3,FIGS[2]['title'],s))

# FIG. 4 — same fixed capture interval, four separate help-range examples.
s = text(500,117,'고정 녹음 구간 200: [100, 110]',24,600)
x=lambda t: 365+(t-90)*15
s += rect(x(100),144,x(110)-x(100),22)
s += text(x(100),195,'S = 100',22) + text(x(110),195,'E = 110',22)
s += line(x(100),207,x(100),555,False,True) + line(x(110),207,x(110),555,False,True)
for label,formula,lo,hi,y in [('발화 전','U < S',92,98,254),('발화 후','L > E',112,118,344),('발화 중','S ≤ L ≤ U ≤ E',102,108,434),('불명','경계를 걸침',98,103,524)]:
    s+=text(60,y-4,label,25,600,'start')+text(60,y+29,formula,22,500,'start')
    s+=line(340,y,905,y)
    s+=line(x(lo),y,x(hi),y,False,False,8)
    s+=line(x(lo),y-10,x(lo),y+10,False,False,2)+line(x(hi),y-10,x(hi),y+10,False,False,2)
    labelx=(x(lo)+x(hi))/2
    s+=f'<rect x="{labelx-65}" y="{y-45}" width="130" height="32" fill="white"/>'
    s+=text(labelx,y-20,f'[{lo}, {hi}]',22,600)
s+=text(500,596,'각 행은 별도 사례 · 굵은 선: 도움 발생 가능 범위 [L,U]',23)
s+=text(500,628,'정밀화는 기존 범위 안에서만 허용한다.',23)
svgs.append(figure(4,FIGS[3]['title'],s))

# FIG. 5 — alternative refinement outcomes from the same type of uncertain state.
s = box(55,108,890,80,['210  원음 · 200  발화 · 220  원래 시도 e0: 동일하게 유지'],25)
xs=[55,325,530,735,945]
ys=[224,318,400,482,564]
s+=rect(55,224,890,340)
for xx in xs[1:-1]:s+=line(xx,224,xx,564)
for yy in ys[1:-1]:s+=line(55,yy,945,yy)
s+=lines(190,265,['230  사용 자격','목적 · 능력'],23,33,600)
s+=lines(427,265,['정밀화 전','도움 시간 불명'],23,33,600)
s+=lines(632,265,['확인 사례 A','발화 전 도움'],23,33,600)
s+=lines(840,265,['확인 사례 B','발화 후 도움'],23,33,600)
rowlabels=[['전사 자료','원음–전사 쌍'],['최초 수행','조사 사용'],['최초 수행','과거형 사용']]
values=[['반영','반영 유지','반영 유지'],['보류','제외','반영'],['반영','반영 유지','반영 유지']]
for i,words in enumerate(rowlabels):
    yc=359+i*82
    s+=lines(190,yc-8,words,23,31)
    for j,value in enumerate(values[i]): s+=text([427,632,840][j],yc+8,value,26,600)
s+=text(500,601,'전제: 도움 범위는 조사 · 전사 확인과 과거형 독립 등 나머지 조건 충족',22)
s+=text(500,633,'A와 B는 서로 다른 확인 사례이며, A에서 B로 뒤집는 정밀화가 아니다.',22)
svgs.append(figure(5,FIGS[4]['title'],s))

# FIG. 6 — the producer's eligibility contract and actual outcome boundary.
s=box(245,105,510,62,['230  원래 수행의 보류 조건'],25)
s+=rect(185,200,630,93)
s+=text(500,237,'150  Core의 후보 생성·귀속 조건',25)
s+=text(500,272,'계획은 예상이며 실제 관측 기록을 만들지 않음',22)
s+=line(500,167,500,200,True)
s+=box(55,328,420,70,['260  원음·기존 기록 확인'],24)
s+=box(525,328,420,70,['260  답 제시 후 새 응답'],24)
s+=path([(365,293),(365,311),(265,311),(265,328)])
s+=path([(635,293),(635,311),(735,311),(735,328)])
s+=text(265,432,'원래 근거를 확인할 수단',23)
s+=text(735,432,'원래 근거의 확인 수단에서 제외',23)
s+=box(55,470,420,74,['실제 확인 사건 → 원래 자격 재판정'],23)
s+=box(525,470,420,74,['새 발화·시도 e1로 저장·판정'],23)
s+=line(265,441,265,470,True)+line(735,441,735,470,True)
s+=path([(265,544),(265,570),(500,570),(500,593)])
s+=path([(735,544),(735,570),(500,570)],False)
s+=box(165,593,670,43,['150  실제 결과 후 남은 조건으로 다시 계획'],23)
svgs.append(figure(6,FIGS[5]['title'],s))

def font_face(path, name, weight='100 900'):
    font = TTFont(path)
    options = subset.Options()
    options.flavor = 'woff2'
    options.recalc_timestamp = False
    options.drop_tables = ['DSIG']
    sub = subset.Subsetter(options=options)
    sub.populate(text=''.join(TEXTS))
    sub.subset(font)
    font.flavor='woff2'
    data=io.BytesIO()
    font.save(data)
    encoded=base64.b64encode(data.getvalue()).decode('ascii')
    return f"@font-face{{font-family:'{name}';font-style:normal;font-weight:{weight};src:url(data:font/woff2;base64,{encoded}) format('woff2');}}"

font_css = font_face(REPO/'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2','SUIT Variable')
font_css += font_face(REPO/'docs/브랜드_폰트/InterTight/InterTight-Medium.ttf','Inter Tight','500')
font_css += font_face(REPO/'docs/브랜드_폰트/InterTight/InterTight-SemiBold.ttf','Inter Tight','600')
font_css += font_face(REPO/'docs/브랜드_폰트/InterTight/InterTight-Bold.ttf','Inter Tight','700')
for f,svg in zip(FIGS,svgs):
    (HERE/f['file']).write_text(svg.replace('__FONTS__',font_css),encoding='utf-8')
(HERE.parent/'figs.json').write_text(json.dumps(FIGS,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
intro='''# 등록 목표 명세서 도면 초안

2026-09-12 · SYNK Core 0.5 로컬 작업실의 실제 처리 관계 · 출원 검토용

이 도면은 현재 구현으로 설명할 수 있는 등록 목표 문안에 붙이는 기술 도면 초안이다. 등록된 공보·특허증이나 최종 출원 도면으로 표시하지 않는다. 여섯 도면은 단색 선화, 공통 1000×650 viewBox이며 SUIT Variable과 Inter Tight 글리프를 각 SVG 안에 포함한다. 그림 내용에 마스코트·광고 문구·등록번호를 넣지 않았다.

## 공통 부호

| 부호 | 뜻 |
| --- | --- |
| 100 | 프로세서·메모리를 갖는 처리 장치 |
| 110 | 원음 참조·발화·도움·확인 사건의 기록 저장부 |
| 120 | 시간 관계 및 대상 능력 범위 판정부 |
| 130 | 목적·시도·능력별 사용 자격 판정부 |
| 140 | 원인 사건과 자격의 전후 기여를 저장하는 기여 원장 |
| 150 | 지원하는 유한 후보에서 조건부 확인 조합을 계산하는 확인 계획부 |
| 160 | 현재 로컬 작업실의 화면·출력부 |
| 200 | 발화 식별자·전사·실제 수행 시점 등을 가진 발화 기록 |
| 210 | 음성 내용 및 그 참조. 저장 경로에서 내용 지문으로 식별하는 원음 |
| 220 | 발화가 속하는 시도 구분. 원래 시도 e0와 새 시도 e1 등을 구별 |
| 230 | 용도·시도·능력별 자격과 보류 조건을 가진 논리 셀 |
| 240 | 발생 가능 시간·대상 능력·출처 등을 가진 도움 사건 |
| 250 | 원인 사건, 이전/이후 자격과 철회/추가되는 기여의 전이 |
| 260 | 기존 원음·기록 확인 또는 새 응답 획득의 행동 후보 |

장치 부호 110~160은 기능 구분이다. 별도 서버·배포된 마이크로서비스·실제 학생 DB를 뜻하지 않는다. 200~260도 논리 요소이며 전부 별도 물리 테이블로 저장한다는 주장은 아니다. S110~S160은 도3의 처리 단계 부호다.

'''
details=''
for f in FIGS:
    details+=f"## 도 {f['number']}. {f['title']}\n\n파일: `figures/{f['file']}`\n\n{f['caption']}\n\n부호: {f['refs']}\n\n"
notes='''## 도면을 읽을 때 유지할 한정

- **원음과 자격은 다르다.** 원음의 바이트를 바꾸는 것이 아니라, 그 발화를 어느 목적·시도·능력의 근거로 쓸 수 있는지를 갱신한다. 내용 지문은 내용 대응을 확인하며 외부 시각·화자·사건 진위를 인증하지 않는다.
- **늦게 도착한 사건과 늦게 발생한 도움은 다르다.** 도3은 나중에 기록된 사건을 받아 발생 범위와 발화 구간을 다시 대조하는 흐름이다. 저장·업로드 시각을 실제 발화 시각으로 대체하지 않는다.
- **녹음 구간은 고정되어 있다.** 도4의 불확실성은 도움 발생 가능 범위에 있다. 모듈이 녹음 시계 오차를 자동 획득하거나 녹음 시작·끝의 불확실 범위까지 계산하는 것은 아니다.
- **시간 정밀화는 부분집합이다.** 새 도움 범위는 기존 범위와 같거나 그 안으로 좁아져야 한다. 한 번 확정된 발화 전 범위를 발화 후 범위로 옮기는 입력은 정밀화로 받지 않는다. 도5의 A와 B는 서로 다른 확인 사례다.
- **시간 관계만으로 모두 승인하지 않는다.** 도5는 조사에만 관련된 도움과 충족된 전사 확인·문항 역할·관측 범위·과거형 독립 조건을 전제로 한다. 불명인 다른 조건이 있으면 해당 자격의 보류가 남는다. `overlap`은 도움 가능 범위 전체가 녹음 구간 안에 있을 때의 관계이며 현재 Core는 관련 최초 수행을 보류한다.
- **새 응답의 소급 금지는 Core 후보 계약까지 포함한다.** 도6의 구별은 Core가 생성하는 지원 후보와 귀속 조건을 합친 동작이다. 범용 planner가 행동 문안이나 임의 입력을 해석하여 모든 발화 귀속을 자동 인증한다는 주장은 아니다. 새 응답을 받는 버튼을 실제로 사용할 수 있어도 원래 근거 확인의 적격 후보로 승인하지 않는다.
- **계획은 실제 증거를 만들지 않는다.** 유리한 결과 가정의 확인 조합을 제안한 뒤 실제 확인 사건을 저장해야 자격과 다음 계획이 바뀐다. 반대·불명·무응답도 실제 결과대로 반영한다. 현재 계획 목표는 원래 발화의 지원 목적 범위다.
- **기여 갱신은 모델 삭제가 아니다.** 화면·저장 원장의 자격과 기여를 갱신하는 로컬 동작이다. 학습된 AI 모델의 가중치에서 내용을 지우거나 운영 앱의 학생 성과를 바꾸었다는 뜻이 아니다.

## 구현 대조

- `core.cjs`: `applyEvent`, `timingFor`, `collectBlockers`, `makeCell`, `evidencePlan`.
- `temporal-evidence.cjs`: `classifyHelpTime`, `refineTimeBounds`, `normalizeHelpScope`.
- `projection.cjs`: `effectSnapshot`, `actionFor`, `buildLedgerEntry`.
- `audit-20260912/EVIDENCE_AUDIT.md`: 실제 원음 보존·계획 귀속·범위 정밀화·선택 갱신의 한계.
- `advance-20260912/REPORT.md`: 실제 구현, 계산 한도, 시간·확인 시연의 조건.

관련 원문을 직접 읽어 도면을 만들었으며 제품 코드는 변경하지 않았다. 시작 시 수동 session-freshness 조회는 `status:unavailable`였으므로 그 조회를 내용 동일성 근거로 쓰지 않았다. 도면은 현재 작업 폴더에서 직접 읽은 소스와 검수 문서를 기준으로 한다.

## 제작과 렌더 확인

생성기: `python figures/build_figures.py` — 설치된 Python 3.14와 fontTools 사용. `figs.json`과 이 설명서의 도면 제목·설명·부호는 같은 FIGS 데이터에서 생성한다.

렌더: `node figures/render_figures.cjs` — 기존 Chrome과 설치된 Playwright 사용. 모든 SVG를 1000×650에서 실제 렌더하여 `figures/qa/fig1.png`~`fig6.png`에 저장한다. 텍스트의 캔버스 이탈·서로 겹침, 외부 요청, 실제 렌더 폰트를 `figures/qa/verification.json`에 남긴다.

6개 도면의 실제 픽셀을 검수했다. 처음 렌더에서 발견한 도1의 반환선·도4의 점선과 범위 표기·도6의 연결선과 설명 글자 겹침을 고쳤고, 도2의 도움 연결은 전사 전용 칸이 아닌 목적별 자격 머리부에 연결했다. 재렌더에서 텍스트 이탈 0·텍스트끼리 겹침 0·외부 요청 0이며 SUIT Variable 및 Inter Tight의 실제 사용자 폰트 사용을 확인했다. 최종 PDF의 페이지 배치와 실제 출력 크기는 루트 통합 검수에서 따로 확인한다.
'''
(HERE.parent/'FIGURES.md').write_text(intro+details+notes,encoding='utf-8')
print(json.dumps({'figures':len(svgs),'viewBox':'0 0 1000 650','embeddedFonts':['SUIT Variable','Inter Tight'],'files':[f['file'] for f in FIGS]},ensure_ascii=False))
