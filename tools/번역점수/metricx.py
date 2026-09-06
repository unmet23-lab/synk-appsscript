# MetricX-24 hybrid large 를 QE(참조 없는) 모드로 돌린다.
# predict.py 를 그대로 못 쓴다 — 그 파일은 transformers 4.30 시절 Trainer 를 쓰는데
# 이 방에는 5.16 이 있다. 그래서 predict.py 의 «입력 만드는 규칙»만 그대로 베끼고
# 추론은 직접 돈다. 베낀 규칙 둘:
#   1) QE 입력 = "source: {원문} candidate: {번역}"
#   2) 토크나이즈 뒤 맨 끝 EOS 토큰을 뗀다  <- 이걸 빼먹으면 점수가 달라진다
# 출력 = MT5ForRegressionOutput.predictions, 0~25 로 clamp. 낮을수록 좋다.
import sys, json, io, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# transformers 5.x 에서 사라진 상수 하나를 메운다(mt5 모듈 import 시점에만 쓰인다)
import transformers.models.mt5.modeling_mt5 as _m
if not hasattr(_m, '__HEAD_MASK_WARNING_MSG'):
    setattr(_m, '__HEAD_MASK_WARNING_MSG', 'shim')

import torch, transformers
from metricx24 import models

MODEL = 'google/metricx-24-hybrid-large-v2p6'
TOK = 'google/mt5-large'
IN = sys.argv[1] if len(sys.argv) > 1 else 'input.jsonl'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'out_metricx.jsonl'

print('[1/4] 토크나이저 여는 중', flush=True)
tok = transformers.AutoTokenizer.from_pretrained(TOK, legacy=False, use_fast=False)

print('[2/4] 모델 여는 중 (4.9GB, 처음이면 오래 걸린다)', flush=True)
t0 = time.time()
model = models.MT5ForRegression.from_pretrained(MODEL, torch_dtype='auto')
model.eval()
print('    모델 로드 %.1f초' % (time.time() - t0), flush=True)

rows = [json.loads(l) for l in open(IN, encoding='utf-8') if l.strip()]
print('[3/4] %d쌍 채점' % len(rows), flush=True)

res = []
for i, r in enumerate(rows, 1):
    text = 'source: ' + r['source'] + ' candidate: ' + r['hypothesis']
    enc = tok(text, max_length=1536, truncation=True, padding=False, return_tensors='pt')
    ids = enc['input_ids'][:, :-1]          # EOS 뗀다
    mask = enc['attention_mask'][:, :-1]
    t1 = time.time()
    with torch.no_grad():
        out = model(input_ids=ids, attention_mask=mask)
    score = float(out.predictions[0])
    res.append({**r, 'metricx': round(score, 3), '초': round(time.time() - t1, 1)})
    print('    %d/%d  %.3f  (%.1f초)' % (i, len(rows), score, time.time() - t1), flush=True)

with open(OUT, 'w', encoding='utf-8') as f:
    for r in res:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')
print('[4/4] 끝. 결과 =', OUT, flush=True)
