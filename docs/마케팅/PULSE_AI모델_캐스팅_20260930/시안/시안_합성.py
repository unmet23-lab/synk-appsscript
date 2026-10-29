# LoRA로 뽑은 사람 사진(손에 무지 갈색 캔)에 블렌더 MORU 캔 렌더를 얹는다(2026-10-21, 1차 다섯 명 영상 게이트 시안).
#   제작 규칙: 제품·로고·글자는 AI로 그리지 않는다 — 캔의 그림·글자는 렌더 화소 그대로 남기고, 사람·손·둘레만 AI 화소다.
#   순서: SAM 3 글 지정으로 캔·손 마스크 → 캔 축(기울기)·폭·높이 → 같은 폭·기울기로 렌더를 놓고 기울기·가로를 조금씩 돌려 원래 캔과
#        가장 잘 겹치는 자리를 찾음 → 짙은 잉크 밝기를 원래 캔에 맞춤 · 손가락 닿은 곳 그늘 · 결(흐림·잡티) 맞춤
#        → 원래 캔 자리를 둘레 바탕으로 메운 깨끗한 판에 렌더를 얹고 앞에 나온 손가락은 원래 화소(10-21 게이트 뒤 고침)
#        → (--다듬기) 캔 둘레 칸만 같은 LoRA로 img2img(0.2~0.35)해 손·이음새를 녹이고, 캔 안쪽(글자)은 렌더 화소를 되붙인다.
#   쓰기(SAM 가상환경):
#     C:\SYNK-LoRA\tools\sam\venv\Scripts\python.exe -X utf8 시안_합성.py <사람.png> <출력_앞이름> --렌더 <캔 렌더 폴더>
#       [--elev 8] [--yaw 0] [--key auto|L|R] [--다듬기 0.28 --lora f05_soyeon_v2\f05_soyeon_v2.safetensors --prompt "…"]
#   출력: <앞이름>.png(최종) · <앞이름>_합성.png(다듬기 전) · <앞이름>_확인.jpg(사람·마스크·합성·최종 나란히) · <앞이름>.json(잰값)
import argparse
import glob
import json
import math
import os
import re
import sys
import time
import urllib.request
import uuid

import cv2
import numpy as np
import torch
from PIL import Image

SAM3 = r"C:\SYNK-LoRA\tools\sam\sam3"
COMFY = r"C:\SYNK-LoRA\tools\ComfyUI"
HOST = "http://127.0.0.1:8188"


# ---------- 마스크 ----------
def sam3(img, texts):
    from transformers import Sam3Model, Sam3Processor
    dev = "cuda" if torch.cuda.is_available() and torch.cuda.mem_get_info()[0] > 6e9 else "cpu"
    model = Sam3Model.from_pretrained(SAM3).to(dev)
    proc = Sam3Processor.from_pretrained(SAM3)
    pil = Image.fromarray(img)
    out = {}
    for t in texts:
        inputs = proc(images=pil, text=t, return_tensors="pt").to(dev)
        with torch.no_grad():
            o = model(**inputs)
        r = proc.post_process_instance_segmentation(o, threshold=0.35, mask_threshold=0.5,
                                                    target_sizes=inputs.get("original_sizes").tolist())[0]
        out[t] = [(r["masks"][k].cpu().numpy().astype(bool), float(r["scores"][k])) for k in range(len(r["masks"]))]
    del model
    if dev == "cuda":
        torch.cuda.empty_cache()
    return out, dev


def pick_can(cands, hand):
    """캔 후보 중 점수가 높고 손과 맞닿은 것."""
    if not cands:
        raise SystemExit("캔을 찾지 못함")
    near = cv2.dilate(hand.astype(np.uint8), np.ones((25, 25), np.uint8)).astype(bool) if hand.any() else None
    def score(c):
        m, s = c
        touch = (m & near).sum() / max(m.sum(), 1) if near is not None else 0
        return s + (0.3 if touch > 0.01 else 0)
    return max(cands, key=score)[0]


# ---------- 모양 재기 ----------
def axis_of(mask):
    ys, xs = np.nonzero(mask)
    pts = np.stack([xs, ys], 1).astype(np.float64)
    c = pts.mean(0)
    w, v = np.linalg.eigh(np.cov((pts - c).T))
    ax = v[:, 1]
    if ax[1] > 0:  # 위쪽(-y)을 보게
        ax = -ax
    tilt = math.degrees(math.atan2(ax[0], -ax[1]))  # 0 = 똑바로, + = 위가 오른쪽으로 기움
    return c, tilt


def upright(mask, c, tilt):
    M = cv2.getRotationMatrix2D((float(c[0]), float(c[1])), -tilt, 1.0)  # 기울기를 펴는 회전
    h, w = mask.shape
    return cv2.warpAffine(mask.astype(np.uint8), M, (w, h), flags=cv2.INTER_NEAREST).astype(bool), M


def profile(mask, skip=None):
    """똑바로 세운 마스크에서 위·아래 끝, 가운데 60% 줄의 폭 중앙값과 그 가로 중심."""
    rows = np.nonzero(mask.any(1))[0]
    top, bot = int(rows.min()), int(rows.max())
    h = bot - top
    widths, centers = [], []
    for y in range(top + int(h * 0.2), bot - int(h * 0.2)):
        if skip is not None and skip[y].sum() > 2:
            continue
        xs = np.nonzero(mask[y])[0]
        if len(xs) > 3:
            widths.append(xs.max() - xs.min() + 1)
            centers.append((xs.max() + xs.min()) / 2)
    if not widths:
        for y in range(top + int(h * 0.2), bot - int(h * 0.2)):
            xs = np.nonzero(mask[y])[0]
            if len(xs) > 3:
                widths.append(xs.max() - xs.min() + 1)
                centers.append((xs.max() + xs.min()) / 2)
    return top, bot, float(np.median(widths)), float(np.median(centers))


# ---------- 렌더 고르기 ----------
def renders(folder):
    out = []
    for p in glob.glob(os.path.join(folder, "can_e*_y*_k*.png")):
        m = re.search(r"can_e([+-]\d+)_y([+-]\d+)_k([LR])\.png$", os.path.basename(p))
        if m:
            out.append((int(m.group(1)), int(m.group(2)), m.group(3), p))
    return out


def load_render(path):
    im = cv2.imdecode(np.fromfile(path, np.uint8), cv2.IMREAD_UNCHANGED)  # 16비트 BGRA — imread는 한글 경로를 못 읽어 None(10-29 리허설)
    im = im.astype(np.float32) / (65535.0 if im.dtype == np.uint16 else 255.0)
    rgb = im[..., [2, 1, 0]] * 255.0
    a = im[..., 3]
    return rgb, a


def key_side(img, can):
    """원래 캔의 왼쪽·오른쪽 밝기로 큰 빛 쪽을 어림한다."""
    g = img.mean(2)
    ys, xs = np.nonzero(can)
    mid = np.median(xs)
    left, right = g[can & (np.arange(img.shape[1])[None, :] < mid)], g[can & (np.arange(img.shape[1])[None, :] >= mid)]
    return "L" if left.mean() >= right.mean() else "R"


# ---------- 다듬기(ComfyUI img2img) ----------
def comfy(path, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(HOST + path, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def img2img(crop, lora, prompt, denoise, seed, size):
    name = f"pulse_gate/harm_{uuid.uuid4().hex[:8]}.png"
    os.makedirs(os.path.join(COMFY, "input", "pulse_gate"), exist_ok=True)
    Image.fromarray(crop).resize((size, size), Image.LANCZOS).save(os.path.join(COMFY, "input", name))
    g = {
        "unet": {"class_type": "UNETLoader", "inputs": {"unet_name": "z_image_turbo_bf16.safetensors", "weight_dtype": "default"}},
        "clip": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_4b.safetensors", "type": "lumina2", "device": "default"}},
        "vae": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
        "lora": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["unet", 0], "lora_name": lora, "strength_model": 1.0}},
        "shift": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["lora", 0], "shift": 3}},
        "pos": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["clip", 0]}},
        "neg": {"class_type": "CLIPTextEncode", "inputs": {"text": "low quality", "clip": ["clip", 0]}},
        "load": {"class_type": "LoadImage", "inputs": {"image": name}},
        "enc": {"class_type": "VAEEncode", "inputs": {"pixels": ["load", 0], "vae": ["vae", 0]}},
        "sampler": {"class_type": "KSampler", "inputs": {"seed": seed, "steps": 8, "cfg": 1, "sampler_name": "res_multistep",
                                                         "scheduler": "simple", "denoise": denoise, "model": ["shift", 0],
                                                         "positive": ["pos", 0], "negative": ["neg", 0], "latent_image": ["enc", 0]}},
        "dec": {"class_type": "VAEDecode", "inputs": {"samples": ["sampler", 0], "vae": ["vae", 0]}},
        "save": {"class_type": "SaveImage", "inputs": {"filename_prefix": "pulse_gate/harm", "images": ["dec", 0]}},
    }
    pid = comfy("/prompt", {"prompt": g, "client_id": str(uuid.uuid4())})["prompt_id"]
    while True:
        time.sleep(1.5)
        h = comfy(f"/history/{pid}")
        if pid in h:
            imgs = [i for o in h[pid].get("outputs", {}).values() for i in o.get("images", [])]
            if h[pid].get("status", {}).get("status_str") == "error":
                raise SystemExit("다듬기 실패")
            if imgs:
                f = imgs[0]
                out = Image.open(os.path.join(COMFY, "output", f["subfolder"], f["filename"])).convert("RGB")
                return np.asarray(out.resize((crop.shape[1], crop.shape[0]), Image.LANCZOS)).astype(np.float32)


def feather(mask, r):
    m = mask.astype(np.float32)
    if r > 0:
        m = cv2.GaussianBlur(m, (0, 0), r)
    return np.clip(m, 0, 1)


# ---------- 본체 ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("out")
    ap.add_argument("--렌더", dest="rdir", required=True)
    ap.add_argument("--elev", type=int, default=8)
    ap.add_argument("--yaw", type=int, default=0)
    ap.add_argument("--key", default="auto")
    ap.add_argument("--폭배율", dest="wscale", type=float, default=1.0, help="잰 폭에 곱한다(손가락이 캔 마스크를 넓혔을 때 0.95 등)")
    ap.add_argument("--밀기", dest="shift", default="0,0", help="렌더를 세운 축 기준 x,y 화소만큼 옮김")
    # 정렬(10-21): AI가 그린 캔은 높이/폭 2.1~2.6, MORU 슬림 캔은 2.62라 폭을 맞추면 조금 길다. 가운데를 맞추면 늘어난 길이가
    # 아래로도 가서 캔 바닥을 받친 손바닥과 겹치고 아래 모서리가 손 마스크에 깎였다(은정 S1·S2) → 손이 쥔 바닥을 맞추고 위로 늘인다
    # top(10-29 리허설): 캔 아래가 화면 밖이거나 손에 가린 접사(캔 윗부분만 보임)는 뚜껑 끝을 맞추고 아래로 늘인다
    ap.add_argument("--정렬", dest="align", choices=["bottom", "center", "top"], default="bottom")
    # 팽창(10-21 Fable 게이트): SAM 캔 마스크는 가장자리의 반쯤 섞인 화소를 빼먹어, 렌더 옆에 원래 캔 테두리가 옅은 띠로 남았다(민재 S2·채원 S1)
    ap.add_argument("--팽창", dest="grow", type=int, default=3, help="메울 자리를 잴 때 캔 마스크를 넓히는 화소")
    ap.add_argument("--맞춤없이", dest="fit", action="store_false", help="기울기·가로 맞춤 찾기를 끈다(10-21 게이트 전 방식)")
    ap.add_argument("--나중메움", dest="clean", action="store_false", help="깨끗한 판 없이 얹은 뒤 남은 띠만 메운다(10-21 게이트 전 방식)")
    # 기울기(10-29 리허설): 손가락이 캔 아래를 덮어 PCA 축이 15° 기운 사진(한결 S4) — 잰 축 대신 이 각도(도, + = 위가 오른쪽)로 세운다
    ap.add_argument("--기울기", dest="tilt", type=float, default=None)
    # 밝기하한 · 색그대로(10-29 리허설 Fable P1-4): 해 질 녘 무지 캔이 거의 검어 배율이 0.35~0.5로 잡히자 라벨의 코랄 · 루비가 와인색이 됐다 —
    #   배율을 이 값 아래로 내리지 않고, --색그대로면 색마다 다른 배율 · 빛 색 입히기 없이 밝기 배율 하나만 쓴다(손님 라벨 색상 그대로)
    ap.add_argument("--밝기하한", dest="gain_min", type=float, default=0.0)
    ap.add_argument("--색그대로", dest="keep_hue", action="store_true")
    ap.add_argument("--다듬기", dest="harm", type=float, default=0.0)
    ap.add_argument("--lora", default="")
    ap.add_argument("--prompt", default="")
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()

    img = np.asarray(Image.open(a.base).convert("RGB"))
    H, W = img.shape[:2]
    ms, dev = sam3(img, ["can", "hand"])
    hand = np.zeros((H, W), bool)
    for m, s in ms["hand"]:
        hand |= m
    can = pick_can(ms["can"], hand)
    can_core = can & ~hand
    c, tilt = axis_of(can)
    if a.tilt is not None:
        tilt = a.tilt
    up_can, M = upright(can, c, tilt)
    up_hand, _ = upright(hand, c, tilt)
    top, bot, wid, cx = profile(up_can, up_hand)
    wid *= a.wscale
    side = key_side(img, can_core) if a.key == "auto" else a.key

    # 렌더: 같은 기울기 · 같은 폭
    cands = [r for r in renders(a.rdir) if r[1] == a.yaw and r[2] == side]
    if not cands:
        raise SystemExit(f"렌더 없음: yaw {a.yaw} key {side}")
    elev, _, _, rpath = min(cands, key=lambda r: abs(r[0] - a.elev))
    rrgb, ra = load_render(rpath)
    rtop, rbot, rwid, rcx = profile(ra > 0.5)
    s = wid / rwid
    # 세운 좌표에서 렌더 (rcx, 바닥 또는 위아래 가운데) → 원래 캔 (cx, 바닥 또는 위아래 가운데)
    dx, dy = (float(v) for v in a.shift.split(","))
    if a.align == "bottom":
        tx, ty, rmid = cx + dx, bot + dy, rbot
    elif a.align == "top":
        tx, ty, rmid = cx + dx, top + dy, rtop
    else:
        tx, ty, rmid = cx + dx, (top + bot) / 2 + dy, (rtop + rbot) / 2
    A_up = np.array([[s, 0, tx - s * rcx], [0, s, ty - s * rmid], [0, 0, 1]], np.float64)
    Minv = cv2.invertAffineTransform(M)  # 세운 좌표 → 원래 좌표
    A = np.vstack([Minv, [0, 0, 1]]) @ A_up
    # 맞춤(10-21 Fable 게이트 뒤): 손가락이 가린 쪽이 마스크에서 빠져 PCA 축이 몇 도 기울고(민재 S2 -4.9도인데 캔은 거의 곧음),
    # 한쪽 가장자리 띠가 남았다. 캔 마스크 무게중심을 축으로 기울기 ±6도 · 가로 ±16화소를 성글게, 그 둘레를 0.25도 · 1화소로
    # 다시 훑어 「렌더가 못 덮은 원래 캔 + 원래 캔 밖으로 나간 렌더」(손 뺌, 반 해상도)가 가장 작은 자리를 고른다.
    piv = c
    half = (W // 2, H // 2)
    ra_h = ra.astype(np.float32)
    core_h = cv2.resize(can_core.astype(np.uint8), half, interpolation=cv2.INTER_NEAREST).astype(bool)
    keep_h = ~cv2.resize(cv2.dilate(can.astype(np.uint8), np.ones((2 * a.grow + 1,) * 2, np.uint8)) | hand.astype(np.uint8),
                          half, interpolation=cv2.INTER_NEAREST).astype(bool)

    def place(dth, dxx):
        R = np.vstack([cv2.getRotationMatrix2D((float(piv[0]), float(piv[1])), -dth, 1.0), [0, 0, 1]])
        return (np.array([[1, 0, dxx], [0, 1, 0], [0, 0, 1]], np.float64) @ R @ A)[:2]

    def misfit(A2):
        Ah = A2.copy()
        Ah[:, 2] *= 0.5
        Ah[:, :2] *= 0.5
        wa_h = cv2.warpAffine(ra_h, Ah, half, flags=cv2.INTER_LINEAR, borderValue=0)
        return int((core_h & (wa_h < 0.5)).sum() + ((wa_h > 0.5) & keep_h).sum())

    fit0 = misfit(place(0.0, 0.0))
    best = (fit0, 0.0, 0.0)
    if a.fit:
        for grid in ((np.arange(-6.0, 6.01, 0.5), np.arange(-16, 17, 2)), None):
            if grid is None:  # 둘레를 촘촘히
                grid = (best[1] + np.arange(-0.5, 0.51, 0.25), best[2] + np.arange(-2, 3, 1))
            for dth in grid[0]:
                for dxx in grid[1]:
                    m = misfit(place(dth, dxx))
                    if m < best[0]:
                        best = (m, float(dth), float(dxx))
    edge = abs(best[1]) >= 6.0 or abs(best[2]) >= 16  # 범위 끝에 걸리면 기록에 남긴다
    A2 = place(best[1], best[2])
    wr = cv2.warpAffine(rrgb, A2, (W, H), flags=cv2.INTER_LANCZOS4, borderValue=0)
    wa = np.clip(cv2.warpAffine(ra, A2, (W, H), flags=cv2.INTER_LINEAR, borderValue=0), 0, 1)

    # 밝기: 렌더 몸통의 짙은 잉크(밝기 아래 55%)를 원래 캔 몸통 중앙값에 맞춤(크림 글자·은색 테는 같이 따라감)
    body = can_core & (wa > 0.95)
    lum_r = wr.mean(2)
    lum_b = img.astype(np.float32).mean(2)
    if body.sum() > 200:
        lr = lum_r[body]
        dark = body & (lum_r <= np.percentile(lr, 55))
        gain_l = np.median(lum_b[body]) / max(np.median(lum_r[dark]), 1.0)
        ch_gain = []
        for k in range(3):
            g = np.median(img[..., k][body].astype(np.float32)) / max(np.median(wr[..., k][dark]), 1.0)
            ch_gain.append(0.5 * g + 0.5 * gain_l)
        ch_gain = np.clip(np.array(ch_gain), 0.35, 2.2)
        gain_l = max(gain_l, a.gain_min)
        if a.keep_hue:
            ch_gain = np.full(3, gain_l)
        else:
            ch_gain = np.maximum(ch_gain, a.gain_min)
    else:
        gain_l, ch_gain = 1.0, np.ones(3)
    # 어두운 곳에만 배율을 주고 밝은 곳(은색 테 · 크림 글자 · 반사 띠)은 그대로 둔다(무릎 곡선). 통째로 곱하면 은색이 회색으로 죽었다.
    lum = wr.mean(2, keepdims=True)
    t = np.clip((lum - 105.0) / (235.0 - 105.0), 0, 1)
    knee = t * t * (3 - 2 * t)
    wr = wr * (ch_gain[None, None, :] * (1 - knee) + knee)
    # 빛 색: 렌더는 중립 흰빛이라 밤 조명·노을에서 캔만 회색으로 뜬다. 원래 캔의 밝은 반사(위 3%)는 그 장면 빛 색이므로,
    # 렌더의 밝은 반사 색과의 비(밝기는 그대로)를 렌더 전체에 곱한다(무릎 곡선이 남긴 은색 테도 장면 빛을 받는다).
    light = np.ones(3, np.float32)
    if body.sum() > 200 and not a.keep_hue:
        def hi(arr, m):
            l = arr.mean(2)
            sel = m & (l >= np.percentile(l[m], 97))
            c = arr[sel].mean(0)
            return c / max(c.mean(), 1e-3)
        light = np.clip(hi(img.astype(np.float32), can_core) / hi(wr, wa > 0.95), 0.85, 1.18).astype(np.float32)
        light = light / light.mean()
        wr = wr * light[None, None, :]
    # 손가락 닿은 곳 그늘
    dist = cv2.distanceTransform((~hand).astype(np.uint8), cv2.DIST_L2, 5)
    shade = 1.0 - 0.22 * np.exp(-dist / 7.0)
    wr = wr * shade[..., None]

    # 결: 살짝 흐리고, 사람 사진의 잔결만큼 잡티(원래 캔 안쪽의 라플라시안 MAD로 잰다 — 표준편차는 반사 띠까지 세어 3을 넘었다)
    wr = cv2.GaussianBlur(wr, (0, 0), 0.35)
    inner = cv2.erode(can_core.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
    hp = lum_b - cv2.GaussianBlur(lum_b, (0, 0), 1.0)
    vals = hp[inner] if inner.sum() > 200 else hp.ravel()
    sigma = float(np.clip(1.4826 * np.median(np.abs(vals - np.median(vals))), 0.4, 2.5))
    rng = np.random.default_rng(7)
    wr = wr + rng.normal(0, sigma, wr.shape[:2])[..., None]

    # 얹기: 손가락(손 마스크)은 앞
    hand_soft = feather(cv2.dilate(hand.astype(np.uint8), np.ones((3, 3), np.uint8)), 1.0)
    alpha = wa * (1 - hand_soft)
    # 깨끗한 판(10-21 Fable 게이트 뒤): 원래 캔 자리(마스크 밖 테두리 화소까지 --팽창, 손 뺌)를 둘레 바탕으로 먼저 메우고 그 위에 렌더를 얹는다.
    # 렌더를 얹은 뒤 못 덮은 띠만 메우면 TELEA가 렌더의 짙은 가장자리와 바탕을 섞어 옅은 띠가 남았다(민재 S2 오른쪽 손가락 옆).
    grown = cv2.dilate(can.astype(np.uint8), np.ones((2 * a.grow + 1,) * 2, np.uint8)).astype(bool) if a.grow > 0 else can
    hole = (grown & ~hand).astype(np.uint8)
    clean = cv2.inpaint(img, hole, 6, cv2.INPAINT_TELEA) if a.clean else img
    comp = clean.astype(np.float32) * (1 - alpha[..., None]) + wr * alpha[..., None]
    left = grown & ~hand & (wa < 0.5)  # 렌더가 못 덮어 메운 바탕이 보이는 자리(확인판 노랑)
    left = cv2.dilate(left.astype(np.uint8), np.ones((5, 5), np.uint8)) & (wa < 0.98).astype(np.uint8) & (~hand).astype(np.uint8)
    leftover = int(left.sum())
    comp8 = np.clip(comp, 0, 255).astype(np.uint8)
    if leftover > 0 and not a.clean:
        comp8 = cv2.inpaint(comp8, left, 6, cv2.INPAINT_TELEA)
    Image.fromarray(comp8).save(a.out + "_합성.png")

    final = comp8.astype(np.float32)
    box = None
    if a.harm > 0:
        ys, xs = np.nonzero((wa > 0.05) | can)
        y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
        side_px = int(max(y1 - y0, x1 - x0) * 1.45)
        cy, cxx = (y0 + y1) // 2, (x0 + x1) // 2
        bx0 = int(np.clip(cxx - side_px // 2, 0, max(W - side_px, 0)))
        by0 = int(np.clip(cy - side_px // 2, 0, max(H - side_px, 0)))
        side_px = min(side_px, W, H)
        box = (bx0, by0, side_px)
        crop = comp8[by0:by0 + side_px, bx0:bx0 + side_px]
        redo = img2img(crop, a.lora, a.prompt, a.harm, a.seed, 1024)
        # 칸 가장자리는 부드럽게 원래로
        m = np.zeros((side_px, side_px), np.float32)
        pad = int(side_px * 0.12)
        m[pad:-pad, pad:-pad] = 1
        m = feather(m, pad * 0.5)
        region = final[by0:by0 + side_px, bx0:bx0 + side_px]
        final[by0:by0 + side_px, bx0:bx0 + side_px] = region * (1 - m[..., None]) + redo * m[..., None]
        # 캔 안쪽(글자·그림)은 렌더 화소를 되붙인다: 렌더 알파를 3화소 깎고 손가락 둘레는 뺀다
        core = cv2.erode((wa > 0.5).astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
        core &= ~cv2.dilate(hand.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
        keep = feather(core, 1.5)
        final = final * (1 - keep[..., None]) + comp.clip(0, 255) * keep[..., None]
    final8 = np.clip(final, 0, 255).astype(np.uint8)
    Image.fromarray(final8).save(a.out + ".png")

    # 확인판
    def tint(base, mask, col):
        t = base.astype(np.float32).copy()
        t[mask] = t[mask] * 0.45 + np.array(col, np.float32) * 0.55
        return t.astype(np.uint8)
    panels = [img, tint(tint(tint(img, can, (255, 60, 60)), hand, (60, 120, 255)), left.astype(bool), (255, 220, 0)), comp8, final8]  # 노랑 = 메운 자리
    tw = 360
    th = int(H * tw / W)
    sheet = Image.new("RGB", (tw * 4 + 30, th), "white")
    for i, p in enumerate(panels):
        sheet.paste(Image.fromarray(p).resize((tw, th), Image.LANCZOS), (i * (tw + 10), 0))
    sheet.save(a.out + "_확인.jpg", quality=88)
    info = {"base": a.base, "render": os.path.basename(rpath), "elev": elev, "yaw": a.yaw, "key": side, "tilt": round(tilt, 2), "align": a.align,
            "canWidthPx": round(wid, 1), "canHeightPx": bot - top, "renderScale": round(s, 4), "gain": [round(float(g), 3) for g in ch_gain], "light": [round(float(g), 3) for g in light],
            "noiseSigma": round(sigma, 2), "grow": a.grow, "cleanPlate": a.clean,
            "fit": {"dTilt": best[1], "dx": best[2], "misfitBefore": fit0, "misfitAfter": best[0], "atEdge": bool(edge)},
            "leftoverPx": leftover, "harm": a.harm, "harmBox": box, "samDevice": dev,
            "canAspect": round((bot - top) / max(wid, 1), 3), "renderAspect": round((rbot - rtop) / max(rwid, 1), 3)}
    json.dump(info, open(a.out + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(info, ensure_ascii=False))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
