# -*- coding: utf-8 -*-
"""capture.cjs가 찍은 shots/를 휴대폰·데스크톱 확인 시트로 묶는다. python make_sheets.py"""
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
sheet(['mobile_01b_how.png','mobile_02_briefing.png','mobile_03_tut01.png','mobile_03_tut02.png','mobile_03_tut03.png','mobile_03_tut04.png',
       'mobile_03_tut05.png','mobile_03_tut06.png','mobile_03_tut07.png','mobile_03_tut08.png','mobile_03_tut09.png','mobile_03_tut10.png',
       'mobile_03_tut11.png','mobile_03_tut12.png'],
      ['① 하는 방법 + 연수 단추','② 근무 전 안내(연수)','연수 1 손님의 말','연수 2 안내문','연수 3 표와 짐','연수 4 통과 누르기',
       '연수 5 이유 읽기','연수 6 짐 보기','연수 7 규칙 ②','연수 8 거절 누르기','연수 9 규칙 고르기','연수 10 다음 손님',
       '연수 11 돋보기','연수 12 혼자 시작'],
      '시트_연수_휴대폰.jpg', 390, '입장 검사 · 첫 근무 연수 12단계 · 휴대폰 390×844 · 실제 클릭 (2026-10-02)', 7)
sheet(['mobile_04_hint.png','mobile_05_feedback_wrong.png','mobile_06_results.png','mobile_07_library_video.png','mobile_08_pause.png','mobile_09_memo_alert.png'],
      ['① 혼자: 돋보기','② 틀림 + 그 뒤에 생긴 일','③ 결과(연수 표시)','④ 도서관 반복 영상','⑤ 쉬기: 목소리·움직임 켜고 끄기','⑥ 근무 중 알림'],
      '시트_휴대폰.jpg', 390, '입장 검사 · 휴대폰 390×844 · 연수 뒤 혼자 하기 (2026-10-02)', 6)
sheet(['desktop_01b_how.png','desktop_03_tut01.png','desktop_03_tut04.png','desktop_03_tut09.png','desktop_03_tut05.png','desktop_07_library_video.png'],
      ['① 하는 방법','② 연수 1 손님의 말','③ 연수 4 통과 누르기','④ 연수 9 규칙 고르기','⑤ 연수 5 이유 읽기','⑥ 도서관 반복 영상'],
      '시트_데스크톱.jpg', 720, '입장 검사 · 데스크톱 1440×900 · 연수와 움직이는 장면 (2026-10-02)', 3)
