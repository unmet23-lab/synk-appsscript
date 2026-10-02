# -*- coding: utf-8 -*-
"""capture.cjs가 찍은 shots/를 휴대폰·데스크톱 확인 시트로 묶는다. python qa/make_sheets.py"""
from PIL import Image, ImageDraw, ImageFont
import os
HERE = os.path.dirname(os.path.abspath(__file__))
f = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 30); fs = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 22)
def sheet(names, labels, out, width, title, cols):
    ims = [Image.open(os.path.join(HERE, 'shots', n)).convert('RGB') for n in names]
    ims = [im.resize((width, round(im.height * width / im.width)), Image.LANCZOS) for im in ims]
    gap, pad, head = 28, 40, 110
    rows = (len(ims) + cols - 1) // cols
    h = max(im.height for im in ims)
    S = Image.new('RGB', (pad * 2 + cols * width + (cols - 1) * gap, head + rows * (h + 56) + pad), (243, 238, 230)); d = ImageDraw.Draw(S)
    d.text((pad, 34), title, fill=(43, 35, 32), font=f)
    for i, (im, lab) in enumerate(zip(ims, labels)):
        r, c = divmod(i, cols); x = pad + c * (width + gap); y = head + r * (h + 56)
        d.text((x, y), lab, fill=(87, 80, 70), font=fs); S.paste(im, (x, y + 36))
    S.save(os.path.join(HERE, out), quality=88); print(out, S.size)
sheet(['mobile_01_lobby.png', 'mobile_02_practice.png', 'mobile_03_practice_sliced.png', 'mobile_04_correct.png', 'mobile_06_wrong_explain.png', 'mobile_05_missed.png', 'mobile_07_results.png', 'mobile_08_pause.png'],
      ['① 입구', '② 연습: 빛나는 조각 베기', '③ 벤 순간(두 쪽·빈칸 채움)', '④ 1번 문장 맞힘', '⑤ 틀림: 정답·이유', '⑥ 두 번 놓침', '⑦ 결과', '⑧ 쉬기'],
      '시트_휴대폰.jpg', 390, '빈칸 베기 · 휴대폰 390×844 · 실제 터치로 그어 진행한 장면 (2026-10-02 MVP · 타격감·소리 반영)', 4)
sheet(['desktop_01_lobby.png', 'desktop_02_practice.png', 'desktop_04_correct.png', 'desktop_06_wrong_explain.png', 'desktop_05_missed.png', 'desktop_07_results.png'],
      ['① 입구', '② 연습', '③ 맞힘(두 쪽·연속 점수)', '④ 틀림: 정답·이유', '⑤ 두 번 놓침', '⑥ 결과'],
      '시트_데스크톱.jpg', 720, '빈칸 베기 · 데스크톱 1440×900 · 실제 마우스로 그어 진행한 장면 (2026-10-02 MVP · 타격감·소리 반영)', 3)
