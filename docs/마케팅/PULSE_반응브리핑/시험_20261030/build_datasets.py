# 브리핑에 붙일 자료 파일을 만든다. python -I build_datasets.py <data 폴더> <upload 폴더>
import json, os, re, sys, datetime as dt, collections
D, U = sys.argv[1], sys.argv[2]
os.makedirs(U, exist_ok=True)
J = lambda p: json.load(open(os.path.join(D, p), encoding='utf-8'))
def W(name, rows):
    json.dump(rows, open(os.path.join(U, name), 'w', encoding='utf-8'), ensure_ascii=False)
    print(name, len(rows))

# 1) 네이버 검색 흐름(여성) — 하루 값 → 주(월요일 시작) 평균, 7일이 다 찬 주만
svg = J('naver/trend_svg.json')
names = ['패딩', '경량패딩', '롱패딩', '숏패딩', '코트']
start = dt.date(2023, 1, 1)
rows = []
for i, g in enumerate(svg['groups']):
    w = collections.defaultdict(list)
    for k, cy in enumerate(g['cy']):
        d = start + dt.timedelta(days=k)
        w[d - dt.timedelta(days=d.weekday())].append((469 - cy) / 467 * 100)
    for wk, vs in sorted(w.items()):
        if len(vs) == 7:
            rows.append({'week': str(wk), 'series': names[i], 'index': round(sum(vs) / 7, 1)})
W('search_weekly.json', rows)

# 2) 네이버 쇼핑 비중·검색어
nv, nv2 = J('naver/naver.json'), J('naver/naver2.json')
lab = {'Age 2026-10': '2026년 10월', 'Age 2025-11~12': '2025년 11~12월', 'Device 2026-10': '2026년 10월', 'Device 2025-11~12': '2025년 11~12월'}
age, dev = [], []
for k, v in nv['비중'].items():
    if not isinstance(v, list) or not v: continue
    for x in v[0]['data']:
        if k.startswith('Age'): age.append({'period': lab[k], 'age': x['label'], 'ratio': round(x['ratio'], 2)})
        if k.startswith('Device'): dev.append({'period': lab[k], 'device': x['label'], 'ratio': round(x['ratio'], 2)})
W('shop_age.json', age); W('shop_device.json', dev)
kw = []
def add(group, words, n=10):
    for r, w in enumerate(words[:n], 1): kw.append({'group': group, 'rank': r, 'keyword': w})
add('2026-10 전체', nv['순위']['2026-10'], 20)
add('2025-12 전체', nv['순위']['2025-12'], 10)
wk = {'2026-10-01': '10/1~7', '2026-10-08': '10/8~14', '2026-10-15': '10/15~21', '2026-10-22': '10/22~29'}
for k, v in nv2['주별순위'].items(): add(wk[k], v)
for k, v in nv2['연령순위'].items(): add(k + '대', v)
for k, v in nv2['하위순위'].items(): add(k, v)
W('shop_keywords.json', kw)

# 3) 유튜브 쇼츠(여성 쪽)
c = J('candidates.json')
men = re.compile(r'남자|남성|남친|남편|아빠|men\b|man\b', re.I)
ANG = {
    '비교': r'비교|vs|VS|차이|중 ?뭐|\d종',
    '이것만 사세요': r'사세요|사지 ?마|지침서|이것만|딱 ?\d|무조건|필수|꼭 ?사|사야 ?할|쟁여',
    '체형·키': r'키작|키 작|체형|통통|하체|상체|스트레이트|웨이브|내추럴|키 ?큰|작아 ?보|커 ?보|날씬|덩치|뱃살',
    '나이대': r'[2-6]0대|4050|5060|중년|시니어|미드라이프|60\+',
    '연예인 이름': r'연예인|김나영|한혜연|한소희|주우재|슬기|셀럽|사복|아이돌|배우',
    '가격·세일': r'만원|원대|가성비|저렴|세일|할인|특가|최저',
    '코디 모음·하울': r'하울|룩북|코디|데일리룩|ootd|OOTD|모음',
}
yt = []
for v in c:
    if men.search((v['제목'] or '') + ' ' + (v['채널'] or '')): continue
    t = (v['제목'] or '') + ' ' + ' '.join(v.get('태그') or [])
    yt.append({'id': v['id'], 'title': re.sub(r'\s+', ' ', v['제목'])[:80], 'channel': v['채널'].strip(), 'subs': v['구독'],
               'views': v['조회'], 'usual': v['평소'], 'multiple': v['배수'], 'seconds': v['길이'], 'published': v['올린때'][:10],
               'spike': bool(v['튄편']), 'angles': '|'.join(a for a, p in ANG.items() if re.search(p, t)),
               'url': 'https://www.youtube.com/shorts/' + v['id']})
W('yt_videos.json', yt)

# 4) 댓글(여성 쪽 영상) — 주제 수와 범위
s = J('summary.json')
W('comment_themes.json', [{'theme': r['주제'], 'comments': r['댓글'], 'share': r['비율%'], 'likes': r['좋아요합'], 'videos': r['영상수']} for r in s['댓글_주제']])
W('comment_scope.json', [{'videos': s['댓글_요약']['영상'], 'comments': s['댓글_요약']['댓글(주인 뺌)']}])

# 5) 메타 광고 라이브러리
m = J('meta/ads.json')['광고']
TH = {
    '할인·쿠폰': r'할인|세일|SALE|특가|쿠폰|%|최저|타임|1\+1|무료배송|적립',
    '소재·보온': r'덕다운|구스|오리털|거위털|다운|캐시미어|울|퍼|따뜻|보온|경량|충전',
    '체형·사이즈·핏': r'체형|키작|키 작|빅사이즈|사이즈|55|66|77|88|하체|커버|날씬|슬림|핏',
    '인기·후기': r'폭주|완판|재입고|품절|리뷰|후기|입소문|인기|베스트|랭킹|\d+만|만장',
    '모델·착용': r'착용|모델|연예인|셀럽|배우|아이돌',
    '배송·출고': r'배송|출고|당일|내일|도착',
    '나이대': r'[2-6]0대|중년|미시|엄마|4050|5060|어머니',
}
ads = []
for a in m:
    adv = a['광고주']
    grp = '테무' if re.search(r'temu', adv, re.I) else ('쇼핑 앱' if re.search(r'지그재그|zigzag|에이블리|ably|무신사|musinsa|29cm|w컨셉|쿠팡|naverplus', adv, re.I) else '브랜드·쇼핑몰')
    text = a['본문'] + ' ' + a['제목']
    ads.append({'id': a['id'], 'advertiser': adv if adv != '?' else '(이름 못 읽음)', 'group': grp, 'start': a['시작'], 'days': a['일수'],
                'topics': '|'.join(t for t, p in TH.items() if re.search(p, text, re.I))})
W('meta_ads.json', ads)
print('테무', sum(a['group'] == '테무' for a in ads), '나이대', sum('나이대' in a['topics'] for a in ads))
