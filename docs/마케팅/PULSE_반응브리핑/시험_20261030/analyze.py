# 업종 반응 브리핑 시험(10-30) — 모은 자료를 요약한다. python -I analyze.py <data 폴더>
import json, os, re, sys, statistics as st, datetime as dt, collections

D = sys.argv[1]
J = lambda p: json.load(open(os.path.join(D, p), encoding='utf-8'))
out = {}

# ── 1) 네이버 검색 흐름(여성, 하루 단위 → 주 평균) ─────────────────────
svg = J('naver/trend_svg.json')
names = ['패딩', '경량패딩', '롱패딩', '숏패딩', '코트']
start = dt.date(2023, 1, 1)
series = {}
for i, g in enumerate(svg['groups']):
    vals = [round((469 - cy) / 467 * 100, 2) for cy in g['cy']]
    series[names[i]] = {start + dt.timedelta(days=k): v for k, v in enumerate(vals)}
def week_of(d): return d - dt.timedelta(days=d.weekday())
weekly = {}
for n, s in series.items():
    w = collections.defaultdict(list)
    for d, v in s.items(): w[week_of(d)].append(v)
    weekly[n] = {k: sum(v) / len(v) for k, v in sorted(w.items()) if len(v) == 7}
season = {}
for n, w in weekly.items():
    rows = {}
    for y in (2023, 2024, 2025):
        span = {k: v for k, v in w.items() if dt.date(y, 8, 1) <= k <= dt.date(y + 1, 3, 31)}
        if not span: continue
        pk = max(span, key=span.get)
        # 같은 주(10월 넷째 주 무렵) 값과 정점 대비
        same = min(span, key=lambda k: abs((k - dt.date(y, 10, 20)).days))
        rows[f'{y}-{y+1}'] = {'정점주': str(pk), '정점값': round(span[pk], 1), '10월20일주': round(span[same], 1), '정점대비%': round(span[same] / span[pk] * 100)}
    last = max(w)
    rows['지금'] = {'주': str(last), '값': round(w[last], 1)}
    season[n] = rows
out['검색_시즌'] = season
# 주간 표(차트용, 2025-08 ~ 끝)
out['검색_주간'] = {n: [[str(k), round(v, 1)] for k, v in w.items() if k >= dt.date(2024, 8, 1)] for n, w in weekly.items()}

# ── 2) 네이버 쇼핑 ───────────────────────────────────────────────
nv, nv2 = J('naver/naver.json'), J('naver/naver2.json')
out['쇼핑_이번달순위'] = nv['순위']['2026-10'][:20]
out['쇼핑_작년12월순위'] = nv['순위']['2025-12'][:20]
out['쇼핑_주별'] = {k: v[:10] for k, v in nv2['주별순위'].items()}
out['쇼핑_연령'] = {k: v[:12] for k, v in nv2['연령순위'].items()}
out['쇼핑_하위'] = {k: v[:10] for k, v in nv2['하위순위'].items()}
out['쇼핑_비중'] = {k: [(x['label'], round(x['ratio'], 1)) for x in v[0]['data']] for k, v in nv['비중'].items() if isinstance(v, list) and v}
cmp_ = {}
for k, arr in nv2['견줌'].items():
    cmp_[k] = {s['이름']: {'최근4주평균': round(st.mean([x[1] for x in s['값'][-4:]]), 1), '작년12월평균': round(st.mean([x[1] for x in s['값'] if x[0].startswith('202512')]), 1)} for s in arr}
out['쇼핑_분야견줌'] = cmp_
out['쇼핑_패딩주간'] = nv['추이']['패딩'][-12:]

# ── 3) 유튜브 쇼츠 ───────────────────────────────────────────────
cands = J('candidates.json')
men = re.compile(r'남자|남성|남친|남편|아빠|men\b|man\b', re.I)
def is_men(v): return bool(men.search((v['제목'] or '') + ' ' + (v['채널'] or '')))
women = [v for v in cands if not is_men(v)]
ANG = {
    '비교': r'비교|vs|VS|차이|중 ?뭐|\d종',
    '이것만 사세요(결정 도움)': r'사세요|사지 ?마|지침서|이것만|딱 ?\d|무조건|필수|꼭 ?사|사야 ?할|쟁여',
    '체형·키': r'키작|키 작|체형|통통|하체|상체|스트레이트|웨이브|내추럴|키 ?큰|작아 ?보|커 ?보|날씬|덩치|뱃살',
    '나이대': r'[2-6]0대|4050|5060|중년|시니어|미드라이프|60\+',
    '연예인·셀럽': r'연예인|김나영|한혜연|한소희|주우재|슬기|셀럽|사복|아이돌|배우',
    '가격·세일': r'만원|원대|가성비|저렴|세일|할인|특가|최저',
    '하울·코디 모음': r'하울|룩북|코디|데일리룩|ootd|OOTD|모음',
    '광고 표시': r'#광고|유료광고|협찬|\[광고\]|광고\)',
}
def tags(v):
    t = (v['제목'] or '') + ' ' + ' '.join(v.get('태그') or [])
    return [a for a, p in ANG.items() if re.search(p, t)]
rows = []
for a in ANG:
    g = [v for v in women if a in tags(v)]
    if not g: continue
    sp = [v for v in g if v['튄편']]
    rows.append({'각도': a, '영상': len(g), '튄편': len(sp), '튄비율%': round(len(sp) / len(g) * 100),
                 '배수중앙': round(st.median([v['배수'] for v in g if v['배수']]) , 1) if any(v['배수'] for v in g) else None,
                 '참여율중앙%': round(st.median([v['참여율'] for v in g if v['참여율'] is not None]), 2)})
base_sp = [v for v in women if v['튄편']]
out['유튜브_요약'] = {'후보(쇼츠·1만+·9/15 이후)': len(cands), '여성 쪽': len(women), '여성 쪽 튄편': len(base_sp),
                    '기준 튄비율%': round(len(base_sp) / len(women) * 100), '기준 배수중앙': round(st.median([v['배수'] for v in women if v['배수']]), 1)}
out['유튜브_각도'] = sorted(rows, key=lambda r: -r['튄비율%'])
ex = {}
for a in ANG:
    g = sorted([v for v in women if a in tags(v) and v['튄편']], key=lambda v: -(v['배수'] or 0))[:4]
    ex[a] = [{'id': v['id'], '제목': v['제목'][:60], '채널': v['채널'], '구독': v['구독'], '조회': v['조회'], '배수': v['배수'], '길이': v['길이'], '올린때': v['올린때'][:10]} for v in g]
out['유튜브_각도예'] = ex
shop = re.compile(r'쇼핑몰|자체제작|진행|입고|주문|구매처|오픈|공구')
out['유튜브_가게채널'] = [{'id': v['id'], '제목': v['제목'][:70], '채널': v['채널'], '구독': v['구독'], '조회': v['조회'], '배수': v['배수'], '튄편': v['튄편']}
                       for v in women if shop.search((v['제목'] or '') + ' ' + (v['채널'] or ''))][:12]
# 길이별
def lb(s): return '15초 이하' if s <= 15 else ('16~30초' if s <= 30 else ('31~60초' if s <= 60 else '61초+'))
lens = collections.defaultdict(list)
for v in women: lens[lb(v['길이'])].append(v)
out['유튜브_길이'] = {k: {'영상': len(g), '튄비율%': round(sum(v['튄편'] for v in g) / len(g) * 100), '참여율중앙%': round(st.median([v['참여율'] for v in g]), 2)} for k, g in sorted(lens.items())}

# ── 4) 댓글 ────────────────────────────────────────────────────
TH = {
    '키·사이즈·핏': r'키\s?(가|는|몇|\d)|\d{3}\s?(cm|센치)|사이즈|size|기장|어깨|핏|오버핏|크게|작게|정사이즈|S사이즈|M사이즈|L사이즈|XL|프리',
    '제품 정보 요청': r'정보|어디(서|꺼|거|껀|제품|브랜드)?\s?(인가요|예요|에요|요|\?)|제품명|품번|모델명|링크|이름이?\s?뭐|어디 ?꺼|어디 ?거|궁금',
    '가격·가성비': r'가격|얼마|비싸|싸다|싸요|가성비|만원|원대|세일|할인',
    '따뜻함·기능': r'따뜻|따듯|춥|보온|추위|바람|방수|무게|가벼|무거',
    '소재·품질 걱정': r'털 ?빠|보풀|구김|냄새|세탁|빨래|오리털|거위털|충전재|필파워|구스|덕다운|솜|퀄리티|품질|짱짱|원단',
    '체형 고민': r'통통|뚱|하체|상체|팔뚝|체형|키작|키 작|작아 ?보|커 ?보|부해|부해보|덩치|날씬',
    '나이 걱정': r'[2-6]0대|중년|나이|늙|젊어 ?보|어려 ?보',
    '구매 의도·후기': r'사고 ?싶|살래|사야|샀어|샀는데|구매|주문|장바구니|품절|입고|재입고|득템|저도 ?샀',
}
men_ids = {v['id'] for v in cands if is_men(v)}
com_files = [f for f in os.listdir(os.path.join(D, 'comments')) if f.endswith('.json') and f[:-5] not in men_ids]
allc = []
per_video = []
for f in com_files:
    c = J(os.path.join('comments', f))
    rows_ = [x for x in c['댓글'] if not x.get('주인')]
    for x in rows_: x['영상'] = c['id']
    allc += rows_
    per_video.append({'id': c['id'], '제목': c['제목'][:50], '댓글받음': len(rows_)})
th_stats = []
for t, p in TH.items():
    m = [x for x in allc if re.search(p, x['글'], re.I)]
    th_stats.append({'주제': t, '댓글': len(m), '비율%': round(len(m) / max(1, len(allc)) * 100, 1), '좋아요합': sum(x['좋아요'] or 0 for x in m), '영상수': len({x['영상'] for x in m})})
out['댓글_요약'] = {'영상': len(com_files), '댓글(주인 뺌)': len(allc)}
out['댓글_주제'] = sorted(th_stats, key=lambda r: -r['댓글'])
json.dump(out, open(os.path.join(D, 'summary.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
# 읽을 댓글: 주제별 좋아요 상위
read = {}
for t, p in TH.items():
    m = sorted([x for x in allc if re.search(p, x['글'], re.I)], key=lambda x: -(x['좋아요'] or 0))[:14]
    read[t] = [f"[{x['좋아요']}] {x['글'][:140]}" for x in m]
read['좋아요 상위 전체'] = [f"[{x['좋아요']}] ({x['영상']}) {x['글'][:160]}" for x in sorted(allc, key=lambda x: -(x['좋아요'] or 0))[:45]]
json.dump(read, open(os.path.join(D, 'comments_read.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok')
