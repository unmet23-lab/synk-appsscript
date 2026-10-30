# 댓글 예시 — 원문 대신 뜻만 옮긴 한 줄. 좋아요·영상은 원자료에서 찾아 붙인다. python -I build_examples.py <data> <upload>
import json, os, sys
D, U = sys.argv[1], sys.argv[2]
import re
cands = json.load(open(os.path.join(D, 'candidates.json'), encoding='utf-8'))
men_ids = {v['id'] for v in cands if re.search(r'남자|남성|남친|남편|아빠|men|man', (v['제목'] or '') + ' ' + (v['채널'] or ''), re.I)}
allc = []
for f in os.listdir(os.path.join(D, 'comments')):
    c = json.load(open(os.path.join(D, 'comments', f), encoding='utf-8'))
    for x in c['댓글']:
        if not x.get('주인') and c['id'] not in men_ids: allc.append((x['글'], x['좋아요'], c['id'], c['제목']))
def find(sub, vid=None):
    hits = [h for h in allc if sub in h[0] and (vid is None or h[2] == vid)]
    if not hits: raise SystemExit(f'찾기 {sub!r}: 0개')
    return max(hits, key=lambda h: h[1] or 0)
EX = [
    ('나 같은 사람이 입으면?', '광고모델 해도', '출연자가 광고 모델 같다는 칭찬. 옷보다 입은 사람이 먼저 보인다'),
    ('나 같은 사람이 입으면?', '똥배', '배가 조금만 나와도 못 입을 옷이라는 걱정'),
    ('나 같은 사람이 입으면?', '언니자체가', '입은 사람이 예쁜 거지 패딩은 평범하다는 반응'),
    ('나 같은 사람이 입으면?', '복고 아줌마', '화면 속 사람은 예쁜데 내가 입으면 촌스러워질 것 같다는 걱정'),
    ('얼마고 어디서 사요?', '가격은 왜 안적는지', '가격이 안 나와서 직접 찾아봤더니 60만 원대였다는 불만'),
    ('얼마고 어디서 사요?', '검정바지 정보', '입은 바지가 어디 것인지 알려 달라는 요청'),
    ('얼마고 어디서 사요?', '정보는 안주고', '옷 정보는 안 알려 주고 입어 보기만 한다는 불평'),
    ('싸 보이면 어쩌지?', '퀄리티에 비해 가격이 비쌈', '품질에 비해 비싸다, 다른 브랜드가 낫다는 평'),
    ('싸 보이면 어쩌지?', '싼티나서', '잘못 사면 싸 보여서 아직 마음에 드는 걸 못 찾았다는 고민'),
    ('싸 보이면 어쩌지?', '질이 안좋은게', '앞의 두세 개 말고는 영상으로 봐도 질이 떨어져 보인다는 평'),
    ('싸 보이면 어쩌지?', '칙칙', '원단 색이 칙칙해서 뭘 입어도 칙칙해 보인다는 평'),
]
rows = []
for k, (theme, sub, gist) in enumerate(EX, 1):
    t, likes, vid, title = find(sub)
    rows.append({'id': f'c{k}', 'theme': theme, 'likes': likes, 'gist': gist, 'video': vid, 'video_title': title[:60], 'url': 'https://www.youtube.com/shorts/' + vid})
json.dump(rows, open(os.path.join(U, 'comment_examples.json'), 'w', encoding='utf-8'), ensure_ascii=False)
for r in rows: print(r['id'], r['likes'], r['video'])
