# (기록용 — 그때 화면 화면/구글_Pro_837.png은 본편을 ChatGPT로 통일하며 뺐다)
# B24 장면 v2 — 실제 ₩29,000 화면 위 엄지 → 옆 사람 손바닥 탁 → 앞에 선 동료 「잠깐, 그거 어디 쓰려고?」 → 나 「다들 쓴다길래.」 → 동료 「다들 뭐에 쓰는데?」 → 나 「몰라.」 + 동료 피식(제목 · 이름표 없음).
# v1 심사 「손 두 개와 요금표뿐이라 사람 사이의 일이 안 보인다 · 덮은 뒤 멈춤 · 초록 테두리」를 받아 동료 얼굴과 한 방 되묻기를 넣었다.
import sys, subprocess
sys.path.insert(0, '합성')
from 판굽기 import 굽기, 읽기
원 = 읽기('화면/구글_Pro_837.png')
화면 = 원[337:2574, 129:1161]  # 실제 화면을 손가락으로 벌린 만큼(1.25배) — 값 · 글은 그대로
줌 = lambda t: (1.12, 522, 985)
A = 굽기('v2_A', [(1.60, 3.00)], lambda t: 화면, 줌=줌, 폴더='장면/원천', crf=16)
C = 굽기('v2_C', [(3.00, 4.10)], lambda t: 화면, 줌=줌, 폴더='장면/원천', crf=16)
V2 = '장면/원천/V2.mp4'; V1 = '장면/원천/V1.mp4'
def 얼굴(src, a, b):
    return f"[{src}:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,fps=30,scale=1080:1920:flags=lanczos:out_color_matrix=bt709,format=yuv420p"
fc = ';'.join([
 f"[0:v]setpts=PTS-STARTPTS,format=yuv420p[a]",
 얼굴(2, 1.35, 2.40) + '[b]',
 f"[1:v]setpts=PTS-STARTPTS,format=yuv420p[c]",
 얼굴(2, 3.85, 4.95) + '[d]',
 얼굴(2, 6.25, 7.20) + '[e]',
 "[a][b][c][d][e]concat=n=5:v=1:a=0[v]",
 # 소리: V1 환경음 · 탁(원 2.56초 → 0.96초), 동료 말은 V2 그대로, 내 말은 소진
 "[3:a]atrim=start=1.60:end=7.20,asetpts=PTS-STARTPTS,volume=1.0[amb]",
 "[2:a]atrim=start=0.58:end=1.08,asetpts=PTS-STARTPTS,afade=t=out:st=0.44:d=0.06,adelay=980|980[jam]",
 "[2:a]atrim=start=1.38:end=2.42,asetpts=PTS-STARTPTS,adelay=1430|1430[q1]",
 "[2:a]atrim=start=3.95:end=4.96,asetpts=PTS-STARTPTS,adelay=3650|3650[q2]",
 "[4:a]adelay=2500|2500,volume=1.0[p1]",
 "[5:a]adelay=4830|4830,volume=1.0[p6]",
 "[amb][jam][q1][q2][p1][p6]amix=inputs=6:normalize=0,alimiter=limit=0.89,atrim=0:5.6[m]",
])
subprocess.run(['ffmpeg','-y','-v','error','-i',A,'-i',C,'-i',V2,'-i',V1,'-i','remotion/public/vo/p01.wav','-i','remotion/public/vo/p06.wav','-filter_complex',fc,
 '-map','[v]','-map','[m]','-c:v','libx264','-crf','16','-preset','medium','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-c:a','aac','-b:a','192k','-movflags','+faststart','장면/장면_v2.mp4'],check=True)
