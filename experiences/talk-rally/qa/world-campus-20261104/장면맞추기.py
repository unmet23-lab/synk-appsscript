"""
말 랠리 캠퍼스 판(2026-11-04) — 사진의 탁구대에 3D 카메라를 맞춘다. 공 · 그림자 · 대답 칸이 사진 속 탁구대 위에 놓이게.

방법: 탁구대 면의 흰 선을 사진에서 찾아 네 점을 잡는다 — 먼 쪽 두 모서리(±0.7625, −1.37)와, 네트 자리에서 양옆 선이 지나는 두 점(±0.7625, 0).
네 점 ↔ 실제 크기(1.525 × 2.74m)로 호모그래피를 풀고, 주점 = 사진 가운데 · 정사각 화소를 가정해 초점 거리를 구한 뒤 위치 · 방향을 낸다.
숫자는 world-scene.mjs의 camera 칸에 들어간다. 다른 표정 판은 판맞추기.py가 이 판에 맞춘다.

    python -I -X utf8 장면맞추기.py <기준 판> [--점 fx0,fy0,fx1,fy1,nx0,ny0,nx1,ny1]

--점을 주지 않으면 흰 선을 찾아 잡고, 잡은 점을 그린 확인 그림을 사진 옆에 _점.jpg로 쓴다(눈으로 본다).
"""
import json
import math
import sys

import cv2
import numpy as np

여기 = None
T_W, T_L = 1.525, 2.74


def 흰선(img):
    """밝고 채도 낮은 화소(탁구대의 흰 선) 가림판 — 사진 아래쪽 탁구대 면만 본다."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, w = img.shape[:2]
    m = ((hsv[..., 2] > 170) & (hsv[..., 1] < 60)).astype(np.uint8) * 255
    m[: int(h * 0.5)] = 0
    return m


def 찾기(img):
    h, w = img.shape[:2]
    m = 흰선(img)
    # 먼 쪽 가장자리: 가운데 띠에서 가장 위에 있는 긴 가로 흰 선
    cols = range(int(w * 0.25), int(w * 0.75))
    rows = np.array([np.count_nonzero(m[y, int(w * 0.25) : int(w * 0.75)]) for y in range(h)])
    far_y = next(y for y in range(int(h * 0.5), h) if rows[y] > 0.6 * len(cols))
    # 양옆 선: 탁구대 파랑 면의 왼쪽 · 오른쪽 끝을 줄마다 찾아 직선을 맞춘다(먼 가장자리 아래 ~ 네트 위)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    파랑 = (hsv[..., 0] > 95) & (hsv[..., 0] < 130) & (hsv[..., 1] > 50) & (hsv[..., 2] < 170)
    # 네트 윗 띠: 먼 가장자리 아래에서 다시 나오는 긴 가로 흰 선
    y = far_y + 30
    while rows[y] > 0.6 * len(cols):
        y += 1
    y += 12
    net_y = next(yy for yy in range(y, h) if rows[yy] > 0.75 * len(cols))
    왼, 오 = [], []
    for yy in range(far_y + 6, net_y - 4, 2):
        xs = np.flatnonzero(파랑[yy])
        if len(xs) < w * 0.3:
            continue
        # 흰 선 안쪽의 파랑 끝 → 흰 선 폭 절반만큼 바깥이 면의 가장자리지만, 그 차이는 작아 안쪽 끝으로 쓴다
        왼.append((xs[0], yy))
        오.append((xs[-1], yy))
    왼, 오 = np.array(왼, float), np.array(오, float)
    ax, bx = np.polyfit(왼[:, 1], 왼[:, 0], 1)
    cx, dx = np.polyfit(오[:, 1], 오[:, 0], 1)
    # 네트 자리(z=0)의 탁구대 면: 네트 아래 끝(클램프가 면에 닿는 줄). 띠 위 끝이 아니라 면의 줄이어야 한다 — 그물 아래 끝을 찾는다
    검정 = (hsv[..., 2] < 70)
    base_y = net_y
    for yy in range(net_y + 8, min(h, net_y + 320)):
        if np.count_nonzero(검정[yy, int(w * 0.3) : int(w * 0.7)]) > 0.45 * (0.4 * w):
            base_y = yy
    return {"far": [(ax * far_y + bx, far_y), (cx * far_y + dx, far_y)], "net": [(ax * base_y + bx, base_y), (cx * base_y + dx, base_y)], "net_top": net_y}


def 풀기(pts, w, h):
    obj = np.array([[-T_W / 2, -T_L / 2], [T_W / 2, -T_L / 2], [-T_W / 2, 0], [T_W / 2, 0]], float)
    img = np.array(pts, float)
    H, _ = cv2.findHomography(obj, img)
    cx, cy = w / 2, h / 2
    # 초점 거리: 두 축 벡터의 길이가 같다는 조건 |h1|ω = |h2|ω. 탁구대가 좌우 대칭이면 H[2,0] ≈ 0이라 직교 조건(h1 · ω · h2 = 0)은 0/0으로 풀리지 않는다.
    A = H[0] - cx * H[2]
    B = H[1] - cy * H[2]
    C = H[2]
    f = math.sqrt(abs(((A[1] ** 2 + B[1] ** 2) - (A[0] ** 2 + B[0] ** 2)) / (C[0] ** 2 - C[1] ** 2)))
    K = np.array([[f, 0, cx], [0, f, cy], [0, 0, 1]], float)
    M = np.linalg.inv(K) @ H
    s = 1 / np.linalg.norm(M[:, 0])
    if M[2, 2] * s < 0:
        s = -s
    r1, r2, t = s * M[:, 0], s * M[:, 1], s * M[:, 2]
    # 평면 좌표 (X, Z) → 세상 좌표(x = X, y = 0, z = Z). 세상 축 기준 회전 행렬의 열은 R·e_x, R·e_y, R·e_z.
    rx, rz = r1, r2
    ry = np.cross(rz, rx)   # 세상 y(위)
    R = np.stack([rx, ry, rz], 1)
    U, _, Vt = np.linalg.svd(R)
    R = U @ Vt
    if np.linalg.det(R) < 0:
        U[:, 2] *= -1
        R = U @ Vt
    C_world = -R.T @ t
    # OpenCV 카메라(x 오른쪽 · y 아래 · z 앞) → three.js 카메라(x 오른쪽 · y 위 · z 뒤)
    cv2gl = np.diag([1.0, -1.0, -1.0])
    Rc = (cv2gl @ R).T   # 세상 ← 카메라(three)
    q = 행렬사원수(Rc)
    fov = 2 * math.degrees(math.atan(h / 2 / f))
    # 다시 재기: 네 점을 투영해 사진 점과의 오차(px)
    err = 0.0
    for (X, Z), (u, v) in zip(obj, img):
        p = K @ (R @ np.array([X, 0, Z]) + t)
        err = max(err, math.hypot(p[0] / p[2] - u, p[1] / p[2] - v))
    near = K @ (R @ np.array([0, 0, T_L / 2]) + t)
    print(f"확인: 가까운 끝 가운데 y = {near[1] / near[2]:.0f}px(사진 높이 {h})")
    return {"fov": round(fov, 4), "position": [round(float(x), 5) for x in C_world], "quaternion": [round(float(x), 6) for x in q], "focalPx": round(f, 2), "errPx": round(err, 3)}


def 행렬사원수(R):
    t = np.trace(R)
    if t > 0:
        s = math.sqrt(t + 1.0) * 2
        return [(R[2, 1] - R[1, 2]) / s, (R[0, 2] - R[2, 0]) / s, (R[1, 0] - R[0, 1]) / s, 0.25 * s]
    i = int(np.argmax(np.diag(R)))
    j, k = (i + 1) % 3, (i + 2) % 3
    s = math.sqrt(1.0 + R[i, i] - R[j, j] - R[k, k]) * 2
    q = [0.0, 0.0, 0.0, (R[k, j] - R[j, k]) / s]
    q[i] = 0.25 * s
    q[j] = (R[j, i] + R[i, j]) / s
    q[k] = (R[k, i] + R[i, k]) / s
    return q


if __name__ == "__main__":
    path = sys.argv[1]
    img = cv2.imdecode(np.fromfile(path, np.uint8), cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    if "--점" in sys.argv:
        v = [float(x) for x in sys.argv[sys.argv.index("--점") + 1].split(",")]
        pts = [(v[0], v[1]), (v[2], v[3]), (v[4], v[5]), (v[6], v[7])]
    else:
        found = 찾기(img)
        pts = found["far"] + found["net"]
        print("찾은 점", found)
    cam = 풀기(pts, w, h)
    print(json.dumps({"photo": [w, h], "points": [[round(a, 1), round(b, 1)] for a, b in pts], **cam}, ensure_ascii=False))
    show = img.copy()
    for (a, b), c in zip(pts, [(0, 0, 255), (0, 255, 0), (255, 0, 255), (0, 255, 255)]):
        cv2.circle(show, (int(a), int(b)), 14, c, 3)
    cv2.line(show, (int(pts[0][0]), int(pts[0][1])), (int(pts[1][0]), int(pts[1][1])), (0, 0, 255), 2)
    cv2.line(show, (int(pts[2][0]), int(pts[2][1])), (int(pts[3][0]), int(pts[3][1])), (255, 0, 255), 2)
    crop = show[int(h * 0.52) :, :]
    out = path.rsplit(".", 1)[0] + "_점.jpg"
    ok, buf = cv2.imencode(".jpg", cv2.resize(crop, None, fx=0.6, fy=0.6), [cv2.IMWRITE_JPEG_QUALITY, 88])
    buf.tofile(out)
    print("확인 그림", out)
