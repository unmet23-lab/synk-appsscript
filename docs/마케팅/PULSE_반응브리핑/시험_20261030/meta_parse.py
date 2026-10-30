# 메타 광고 라이브러리 카드 → 광고주·게재 기간·말하는 내용 집계. python -I meta_parse.py <data 폴더>
import json, os, re, sys, collections, datetime as dt
D = sys.argv[1]
d = json.load(open(os.path.join(D, 'meta', 'cards.json'), encoding='utf-8'))
TODAY = dt.date(2026, 10, 30)
ads = {}
for q, v in d.items():
    for c in v['cards']:
        lines = [l.strip() for l in c.split('\n') if l.strip() and l.strip() != '​']
        if not lines: continue
        aid = re.sub(r'\D', '', lines[0])
        m = re.search(r'(\d{4})\. (\d{1,2})\. (\d{1,2})\.(에 게재 시작함| ~)', c)
        start = dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None
        try:
            i = lines.index('광고 상세 정보 보기')
            adv = lines[i + 1]
            rest = lines[i + 2:]
        except ValueError:
            adv, rest = '?', lines
        if rest and rest[0] == '광고': rest = rest[1:]
        dom_i = next((k for k, l in enumerate(rest) if re.fullmatch(r'[A-Z0-9.-]+\.[A-Z]{2,}', l)), None)
        body = ' '.join(rest[:dom_i] if dom_i is not None else rest[:4])
        head = rest[dom_i + 1] if dom_i is not None and dom_i + 1 < len(rest) else ''
        multi = '여러 버전' in c
        same = re.search(r'광고 (\d+)개에서', c)
        ads.setdefault(aid, {'id': aid, '광고주': adv, '시작': str(start) if start else None, '일수': (TODAY - start).days if start else None,
                             '본문': body[:300], '제목': head[:200], '검색어': [], '같은소재광고수': int(same.group(1)) if same else 1, '여러버전': multi})
        ads[aid]['검색어'].append(q)
A = list(ads.values())
TH = {
    '할인·특가·쿠폰': r'할인|세일|SALE|특가|쿠폰|%|최저|타임|1\+1|무료배송|적립',
    '배송·출고': r'배송|출고|당일|내일|도착',
    '소재·보온': r'덕다운|구스|오리털|거위털|다운|캐시미어|울|퍼|따뜻|보온|경량|충전',
    '체형·사이즈': r'체형|키작|키 작|빅사이즈|사이즈|55|66|77|88|하체|커버|날씬|슬림|핏',
    '인기·후기(사회적 증거)': r'폭주|완판|재입고|품절|리뷰|후기|입소문|인기|베스트|랭킹|\d+만|만장',
    '나이대': r'[2-6]0대|중년|미시|엄마|4050|5060|어머니',
    '모델·연예인': r'착용|모델|연예인|셀럽|배우|아이돌',
}
def tagged(a): return [t for t, p in TH.items() if re.search(p, a['본문'] + ' ' + a['제목'], re.I)]
out = {'광고수(겹침 뺌)': len(A)}
out['광고주 상위'] = collections.Counter(a['광고주'] for a in A).most_common(15)
plat = re.compile(r'지그재그|Zigzag|에이블리|ABLY|무신사|MUSINSA|29CM|W컨셉|쿠팡|네이버|카카오', re.I)
own = [a for a in A if not plat.search(a['광고주'])]
out['플랫폼 광고 비율%'] = round((len(A) - len(own)) / len(A) * 100)
out['주제 비율%(전체)'] = {t: round(sum(t in tagged(a) for a in A) / len(A) * 100) for t in TH}
out['주제 비율%(브랜드 직접 광고)'] = {t: round(sum(t in tagged(a) for a in own) / max(1, len(own)) * 100) for t in TH}
days = [a['일수'] for a in A if a['일수'] is not None]
out['게재 일수'] = {'중앙': sorted(days)[len(days) // 2] if days else None, '30일+': sum(x >= 30 for x in days), '90일+': sum(x >= 90 for x in days)}
long_ = sorted([a for a in own if a['일수'] is not None], key=lambda a: -a['일수'])[:12]
out['오래 돈 브랜드 광고'] = [{k: a[k] for k in ('광고주', '시작', '일수', '제목', '본문')} for a in long_]
json.dump({'요약': out, '광고': A}, open(os.path.join(D, 'meta', 'ads.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
with open(os.path.join(D, 'meta', 'ads_report.txt'), 'w', encoding='utf-8') as f:
    f.write(json.dumps(out, ensure_ascii=False, indent=1))
print('ok', len(A))
