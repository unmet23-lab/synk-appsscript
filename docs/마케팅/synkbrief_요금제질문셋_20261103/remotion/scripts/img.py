# 실제 화면에서 칸을 잘라 public/img에 둔다 — 값 · 글은 화면 그대로다(키우기만 한다). 쓰는 곳은 src/Film.tsx.
import cv2, numpy as np
def rd(p): return cv2.imdecode(np.fromfile(p, np.uint8), 1)
def wr(n, im):
    cv2.imencode('.png', im)[1].tofile(f'remotion/public/img/{n}.png'); print(n, im.shape[1], im.shape[0])
S = 3
파일 = rd('화면/챗GPT_표_파일.png')
도움말 = rd('화면/챗GPT_도움말_한도.png')
# 공식 도움말의 마지막 문장 앞머리만 뺀 그대로(「한도에 도달하면 ChatGPT에서 알려드립니다.」) — 시험관 셋이 Claude 화면과 ChatGPT 화면이 섞여 헷갈린다고 짚어 ChatGPT 쪽 글로 바꿈
wr('card_help', 도움말[1192:1250, 256:1228])
wr('card_file', 파일[int(298 * S):int(346 * S), int(32 * S):int(398 * S)])
