# COMETKiwi(wmt22-cometkiwi-da) 를 «승인 없이 열리는 판»으로 돌린다.
#
# 왜 원본이 아니라 이 판인가:
#   Unbabel/wmt22-cometkiwi-da 는 gated(승인 목록) 라 403 이 났다. 같은 무게를
#   transformers 형식으로 옮긴 vince62s/wmt22-cometkiwi-da-roberta-large 는 승인이 없다.
#   모델 카드가 원본과 점수를 맞춰 봤다고 적어 두었다(0.8640 vs 0.863973).
#
# 입력 규칙(모델 카드 그대로): 원문과 번역을 "</s></s>" 로 이어 붙인 한 문자열.
# 출력: 0~1, **높을수록 좋다**(MetricX 와 방향이 반대다).
import sys, json, io, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import torch
from transformers import XLMRobertaTokenizerFast, AutoModel

M = 'vince62s/wmt22-cometkiwi-da-roberta-large'
IN = sys.argv[1] if len(sys.argv) > 1 else 'input.jsonl'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'out_kiwi.jsonl'

print('[1/3] 여는 중 (2.3GB, 처음이면 오래 걸린다)', flush=True)
t0 = time.time()
tok = XLMRobertaTokenizerFast.from_pretrained(M, trust_remote_code=True)
model = AutoModel.from_pretrained(M, trust_remote_code=True)
model.eval()
print('    로드 %.1f초' % (time.time() - t0), flush=True)

rows = [json.loads(l) for l in open(IN, encoding='utf-8') if l.strip()]
print('[2/3] %d쌍 채점' % len(rows), flush=True)

res = []
for i, r in enumerate(rows, 1):
    text = r['source'] + '</s></s>' + r['hypothesis']
    enc = tok(text, return_tensors='pt', truncation=True, max_length=512)
    with torch.no_grad():
        out = model(**enc)
    score = float(out[0].reshape(-1)[0])
    res.append({**r, 'cometkiwi': round(score, 4)})
    print('    %d/%d  %.4f' % (i, len(rows), score), flush=True)

with open(OUT, 'w', encoding='utf-8') as f:
    for r in res:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')
print('[3/3] 끝. 결과 =', OUT, flush=True)
