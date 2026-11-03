# (기록용 — 그때 화면 화면/구글_Pro_837.png은 본편을 ChatGPT로 통일하며 뺐다)
# B24 장면 v1 — 실제 ₩29,000 화면의 「Pro 가입하기」 위에서 망설이는 엄지 → 옆 사람 손바닥이 탁 → 「잠깐, 그거 어디 쓰려고?」 「다들 쓴다길래.」(제목 · 이름표 없음)
import sys, subprocess
sys.path.insert(0, '합성')
from 판굽기 import 굽기, 읽기
원 = 읽기('화면/구글_Pro_837.png')
화면 = 원[337:2574, 129:1161]  # 실제 화면을 손가락으로 벌린 만큼(1.25배) — 값 · 글은 그대로
낼 = 굽기('장면v1_판', [(0.45, 5.75)], lambda t: 화면, 줌=lambda t: (1.12, 522, 985), 폴더='장면/원천', crf=16)
# 소리: V1의 환경음 · 탁 + 말 두 줄(친구 1.65초 · 나 3.15초)
subprocess.run(['ffmpeg','-y','-v','error','-i',낼,'-ss','0.45','-t','5.3','-i','장면/원천/V1.mp4','-i','remotion/public/vo/n01.wav','-i','remotion/public/vo/p01.wav',
 '-filter_complex','[1:a]volume=1.0[a];[2:a]adelay=1650|1650[b];[3:a]adelay=3350|3350[c];[a][b][c]amix=inputs=3:normalize=0,alimiter=limit=0.9[m]',
 '-map','0:v','-map','[m]','-c:v','copy','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart','장면/장면_v1.mp4'],check=True)
