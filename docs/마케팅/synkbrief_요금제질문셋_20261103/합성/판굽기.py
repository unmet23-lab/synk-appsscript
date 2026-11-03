# V1(초록 화면) + 실제 요금 화면 → 1080×1920 30fps 판. 쓰는 법: from 판굽기 import 굽기
#   굽기(이름, 조각=[(V1시작초, V1끝초[, 빠르기])…], 화면=함수(판 안 초)->BGR 그림(가로세로 430:932), 줌=함수(초)->(z, cx, cy), 소리=True)
import cv2, json, sys, subprocess, numpy as np, os
sys.path.insert(0, os.path.dirname(__file__))
import 키
_J = json.load(open(os.path.join(os.path.dirname(__file__), 'V1_모서리.json')))
Q = np.array(_J['q'], np.float32); FPS = _J['fps']
_cap = None; _프레임 = {}
def V1프레임(i):
    if i not in _프레임:
        _cap_ = cv2.VideoCapture(os.path.join(os.path.dirname(__file__), '..', '장면', '원천', 'V1.mp4'))
        _cap_.set(1, i)
        ok, f = _cap_.read(); _cap_.release()
        _프레임[i] = f
    return _프레임[i]

def 읽기(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), 1)

def 판한장(t_v1, 화면그림, z=1.0, cx=540.0, cy=960.0):
    """V1의 t_v1초 프레임에 화면을 끼우고, (cx,cy)를 가운데로 z배 키운 1080×1920."""
    i = min(int(round(t_v1 * FPS)), len(Q) - 1)
    f = V1프레임(i)
    # 줌까지 한 번에: 원본 720×1280을 1080×1920×z로 키운 좌표에서 잘라 쓴다
    W, H = 1080, 1920
    A = np.array([[z, 0, W / 2 - cx * z], [0, z, H / 2 - cy * z]], np.float32)
    A영상 = A.copy(); A영상[:2, :2] *= 1080 / 720
    큰 = cv2.warpAffine(f, A영상, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    q = Q[i].copy()
    q = (q * z) + np.array([W / 2 - cx * z, H / 2 - cy * z], np.float32)
    return 키.끼우기(큰, 화면그림, q)

def 굽기(이름, 조각, 화면, 줌=None, 소리=None, 폴더='remotion/public/plate', crf=14):
    os.makedirs(폴더, exist_ok=True)
    낼 = os.path.join(폴더, 이름 + '.mp4')
    p = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', '1080x1920', '-r', '30', '-i', '-',
                          '-vf', 'scale=out_color_matrix=bt709,format=yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                          '-c:v', 'libx264', '-crf', str(crf), '-preset', 'medium', 낼], stdin=subprocess.PIPE)
    판초 = 0.0; 수 = 0
    for 칸 in 조각:
        a, b = 칸[0], 칸[1]; rate = 칸[2] if len(칸) > 2 else 1.0
        칸길이 = abs(b - a) / rate
        프레임수 = int(round(칸길이 * 30))
        for k in range(프레임수):
            tv = a + (b - a) * (k / max(프레임수, 1))
            tt = 수 / 30
            z, cx, cy = 줌(tt) if 줌 else (1.0, 540.0, 960.0)
            p.stdin.write(판한장(tv, 화면(tt), z, cx, cy).tobytes())
            수 += 1
    p.stdin.close(); p.wait()
    print(이름, 수, '프레임', 수 / 30, '초')
    return 낼
