# 지유 스킨케어 광고 · 사람·솜 컷 6개(1·3·4·5·7·훅 C)를 로컬 MiniMax H3(ComfyUI 127.0.0.1:8188)로 뽑는다.
#   그래프·설정은 하린 `비교/h3_로컬.py`와 같다: 본체 minimax_h3_fl2va_pruned_int8_convrot · 글 인코더 qwen3vl_32b nvfp4_awq ·
#   영상 VAE int8 · 소리 VAE fp32, res_multistep · simple · BasicGuider, 터보 LoRA 없이 20단계, 768×1344, 124프레임(5.17초), 24fps.
#   - 시작 그림: 키프레임_A의 틀 그림(9:16)을 가운데에서 4:7로 잘라 768×1344로 줄여 넣는다. first_frame은 비율을 보지 않고
#     늘이기만 하므로(nodes_minimax_h3.py) 비율을 먼저 맞춘다. 최종 9:16은 768 폭에서 756을 잘라 키운다(가장자리 1.6% 덜 씀).
#   - 컷 3(솜 옆 밀기): 시작 창을 첫 프레임에, 끝 창을 48프레임(2.0초)에 MiniMaxH3AddGuide로 못 박는다. 편집은 0~2초만 쓴다.
#   - 지시문 틀은 하린 `지시문.py`(GLOBAL·REF·TEX·LIGHT·CHAR·ACT·CAM·SHOT·CONS)를 따르고, 컷 4·훅 C에는 Fable 검수대로
#     「hand and pad/towel perfectly still, only the eyelids/gaze move」을 넣는다(브리프 3절).
#   - 영상에 붙어 나온 소리는 버린다(소리는 음악·내레이션·효과음으로 따로).
# 쓰기: <ComfyUI venv python> -X utf8 영상_H3.py --준비          ← 입력 그림만 만들고 한 장 표로 본다
#       <ComfyUI venv python> -X utf8 영상_H3.py 4 1 7 5 C 3     ← 적은 순서대로 하나씩 넣고 끝날 때마다 받는다
#       H3_SEED=7 … 영상_H3.py 4                                  ← 안 되면 시드만 바꿔 한 번 더(브리프 1절)
#       H3_LAST=1 … 영상_H3.py 7b                                 ← 컷 7 다시(사람 작게 · 왼쪽, 10-19)
import json
import os
import shutil
import sys
import time
import urllib.request
import uuid

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018")
K = os.path.join(V, "키프레임_A")
OUT = os.path.join(V, "영상_H3")
COMFY = "http://127.0.0.1:8188"
COMFY_DIR = r"C:\SYNK-LoRA\tools\ComfyUI"
STEPS = int(os.environ.get("H3_STEPS", "20"))
SEED = int(os.environ.get("H3_SEED", "42"))
FRAMES = 124
W, H = 768, 1344
GUIDE_AT = 48  # 컷 3 끝 창을 못 박는 프레임(2.0초)
# H3_LAST=1: 끝 프레임(5.17초)에도 시작 그림을 넣어 화면 틀을 양쪽에서 묶는다. 10-19 컷 7(시드 42)이 「locked-off」 지시에도
# 0~1.5초에 옆으로 밀려 엔드카드 자리(오른쪽 빈 벽)가 줄었다. 표정 변화는 가운데에서 일어나고 편집은 앞 3초만 쓴다.
LAST = os.environ.get("H3_LAST") == "1"
TAG = "_끝고정" if LAST else ""
LOG = os.path.join(OUT, "기록.txt")

# 컷: 시작 그림(키프레임_A) — 컷 3은 (시작, 끝)
# 7b(10-19 컷 7 다시): v3c 엔드카드 병·글자가 9:16 글자 자리(y 269~1248 · x 65~920) 밖이라 사람을 작게 · 왼쪽에 둔 판.
#   승인한 1:1 원본(컷7_v6b)을 0.58배로 9:16 캔버스 왼쪽에 놓고 위아래만 Gemini로 채운 뒤 가운데 띠는 원본 화소를 되붙였다
#   (synk-vendor/…/키프레임_A/컷7_v7_만들기/). 영상은 컷 7과 같이 H3_LAST=1로 뽑는다.
INPUTS = {
    "1": "컷1_v3.jpg",
    "3": ("컷3_시작_창.jpg", "컷3_끝_창.jpg"),
    "4": "컷4_v4_틀.jpg",
    "5": "컷5_v3b_틀.jpg",
    "7": "컷7_v6b_틀.jpg",
    "7b": "컷7_v7_틀.jpg",
    "C": "훅C_틀.jpg",
}
NAMES = {"1": "컷1", "3": "컷3", "4": "컷4", "5": "컷5", "7": "컷7", "7b": "컷7b", "C": "훅C"}
# 세트 2(10-19 유호님 「배경이 너무 휑하다 … 제대로 좋은 화장실처럼」 → A안 「호텔 욕실」로 전체 다시): 키프레임_세트2의 틀 그림.
#   컷 이름 뒤에 s2(1s2 · 3s2 · 4s2 · 5s2 · 7s2 · Cs2), 결과는 <컷>_세트2_s<시드>.mp4. 지시문은 GLOBAL2 + 같은 SHOTS(7s2만 따로).
K2 = os.path.join(V, "키프레임_세트2")
for _c in ("1", "4", "5", "7", "C"):
    INPUTS[_c + "s2"] = os.path.join(K2, f"{NAMES[_c]}_틀.jpg")
    NAMES[_c + "s2"] = NAMES[_c] + "_세트2"
INPUTS["3s2"] = (os.path.join(K2, "컷3_시작_창.jpg"), os.path.join(K2, "컷3_끝_창.jpg"))
NAMES["3s2"] = "컷3_세트2"

GLOBAL = ("GLOBAL STYLE: Live-action footage from a Korean skincare commercial, vertical 9:16, about 7:30 in the morning at the "
          "sink of a bright white bathroom: a window with a thin white sheer curtain at camera left, the edge of a white marble "
          "vanity and one small green potted plant. Real-time speed throughout, no slow motion, no time dilation. No fade in or "
          "out; the first and last frames are full-exposure frames.")
GLOBAL2 = ("GLOBAL STYLE: Live-action footage from a premium Korean skincare commercial, vertical 9:16, about 7:30 in the morning "
           "in a high-end hotel-style bathroom: warm greige limewash plaster walls, a honed white marble vanity with an integrated "
           "basin and a brushed-brass faucet, a brass towel bar with a cream linen towel, a small olive branch in a stoneware "
           "vase, and a window with a thin white sheer curtain at camera left. Real-time speed throughout, no slow motion, no "
           "time dilation. No fade in or out; the first and last frames are full-exposure frames.")
REF_FACE = ("REFERENCES: the start image is the first frame of this single shot; keep its framing, light, wardrobe and her face "
            "exactly. Keep her exactly this person throughout.")
REF_PAD = ("REFERENCES: the start image is the first frame of this single shot and the guide image is the frame two seconds in; "
           "keep the framing, light, marble and the cotton pad exactly.")
TEX_FACE = ("TEXTURE AND REALISM: She looks like a real young woman filmed on set: unretouched skin with visible pores, slight "
            "asymmetry, the fresh dewy sheen of just-washed skin, natural skin color variation, neutral skin color with no yellow "
            "cast. No beauty filter, no airbrushed or glowing skin, no advertising-model expression, no added grain, no added "
            "sharpening, no plastic sheen.")
TEX_PAD = ("TEXTURE AND REALISM: Real macro footage on set, shallow depth of field, real cotton fibers with a wet sheen, real "
           "marble. No added grain, no added sharpening, no CG look.")
LIGHT_FACE = ("LIGHT: Soft directional morning light through the sheer curtain from camera left only; the camera-left side of her "
              "face is brighter and the other side falls into soft shade. Never flat frontal light. The light stays constant.")
LIGHT_PAD = "LIGHT: Soft directional morning light through the sheer curtain from camera left; the light stays constant."
CHAR_FACE = ("CHARACTER: Jiyu, a young Korean woman in her early twenties, long straight black hair worn down with a center part, "
             "a white terry-cloth headband, a plain white cotton short-sleeve T-shirt. Her hairstyle, headband and hair color "
             "never change.")
ACT_ONE = ("ACTING: An ordinary moment caught in progress, not a pose. One small action only; everything else stays still. Her "
           "small eye movements are physically natural and she blinks naturally. Expressions never slowly morph. No talking, no "
           "humming, no grin, no teeth showing, no nodding, no facial reshaping.")
ACT_SMILE = ("ACTING: An ordinary moment caught in progress, not a pose. Her small eye and mouth movements are physically natural; "
             "expressions change quickly and briefly, never a slow morph. No talking, no humming, no big grin, no teeth showing, "
             "no nodding, no facial reshaping.")
CAM_FACE = ("CAMERA: A real cinema camera held steady by an operator, with only slight natural breathing; no zoom, no orbit, no "
            "other camera moves. Keep her face readable and correctly focused.")
CAM_LOCK = ("CAMERA: A locked-off cinema camera on a tripod; the frame does not move at all. Keep her face readable and correctly "
            "focused.")
CAM_PAD = ("CAMERA: 100mm macro on a slider. One very slow, smooth sideways slide that arrives at the guide frame two seconds in, "
           "then the camera stays still. No zoom, no rotation, no focus pull.")
CONS_FACE = ("CONSISTENCY: the same woman, headband, hair and T-shirt as the start image. She is alone. No bottles, jars or "
             "products, no text, no logos, no subtitles.")
CONS_PAD = ("CONSISTENCY: the same pad and marble as the start image. No people, no hands, no bottles, jars or products, no "
            "text, no logos, no subtitles.")

SHOTS = {
    "1": ("Single shot, shoulder-up, 65mm. Her face is turned about 15 degrees toward the window at camera left, the light on "
          "the camera-left side of her face, her skin fresh and dewy just after washing; the one or two tiny water droplets at "
          "her hairline and chin stay where they are and do not run. Her eyes are open from the first frame. During the first "
          "two seconds she slowly raises her gaze from the sink below to just beside the lens, then holds it there. Her head "
          "barely moves, her lips stay closed, no hands in frame."),
    "3": ("Single shot, macro close-up of one round cotton pad lying on the white marble vanity, already soaked with clear "
          "toner, thin and translucent. Nothing in the scene moves: the toner does not spread, no drips, no bubbles. No people, "
          "no hands, no bottle."),
    "4": ("Single shot, chest-up, 65mm. Her body and face are turned about 45 degrees to camera right, away from the window. A "
          "thin cotton pad soaked with clear toner already rests flat on her right cheek (camera left, the side the window light "
          "falls on), held by her fingertips. Her hand and the pad stay perfectly still; only her eyelids and gaze move: over "
          "about two seconds her open eyes slowly lower until her gaze rests down and to the side, then they stay lowered. Lips "
          "stay closed."),
    "5": ("Single shot, shoulder-up, 50mm, her left profile in a three-quarter view facing the window at camera left. The window "
          "light runs along her forehead, nose and lip line and grazes her visible cheek; the back of her head and her neck stay "
          "in shade. Hands out of frame. With her eyes open and looking out of the window, she takes one slow breath in and her "
          "shoulders drop slightly; she may gently close her eyes at the very end. Apart from the breath keep movement minimal: "
          "her head does not turn, and her nose and profile do not change shape."),
    "7": ("Single shot, chest-up, 65mm, locked-off camera. Her face is turned about 15 degrees toward the window at camera left, "
          "lit like the first shot. The right third of the frame is a plain, softly shaded wall that stays empty. She looks into "
          "the lens from the first frame with a faint closed-mouth smile; within the first second the smile deepens slightly "
          "into soft half-moon eyes, lips stay closed, and it holds until the end. She may blink once. Nothing else moves."),
    "7b": ("Single shot, waist-up medium shot, 50mm, locked-off camera. She stands behind the white marble vanity in the left "
           "half of the frame, her face turned about 15 degrees toward the window at camera left, lit like the first shot. The "
           "right half of the frame is a plain, softly shaded wall that stays empty; the ceiling, window and vanity stay exactly "
           "as in the start image. She looks into the lens from the first frame with a faint closed-mouth smile; within the "
           "first second the smile deepens slightly into soft half-moon eyes, lips stay closed, and it holds until the end. She "
           "may blink once. Nothing else moves."),
    "C": ("Single shot, shoulder-up, 65mm. A soft white towel is already pressed against her right cheek (camera left), held "
          "by her hand; window light from camera left. Her hand and the towel stay perfectly still; only her eyelids and gaze "
          "move: during the first two seconds she slowly raises her eyes from below to just beside the lens, then holds. Lips "
          "stay closed."),
}


# 4s2 다시 뽑기(10-19): 첫 판(시드 42)은 0.75~2.0초에 없던 올리브 가지가 화면 오른쪽에 자라나듯 생겼다
SHOTS["4s2"] = SHOTS["4"] + (" Nothing new appears in the frame: no plants, branches or objects enter or grow; the background "
                             "stays exactly as in the start image.")
# 손에 든 병(10-20 유호님 「맑음 병 CG가 너무 촌스러운데 트렌디하게」 → 「손에 든 병」 · 「병도 새로」): 컷 7을 지유가 새 병
# (투명 유리)을 볼 옆에 든 장면으로. 시작 그림 키프레임_세트2/컷7손_틀.jpg, 영상은 컷 7처럼 H3_LAST=1(끝 프레임도 시작 그림)
INPUTS["7hs2"] = os.path.join(K2, "컷7손_틀.jpg")
NAMES["7hs2"] = "컷7손_세트2"
CONS_HAND = ("CONSISTENCY: the same woman, headband, hair and T-shirt as the start image. She is alone. The only product is the "
             "clear glass toner bottle in her hand; it keeps exactly its shape, cap, print and place. No other bottles, no text, no "
             "logos, no subtitles.")
SHOTS["7hs2"] = ("Single shot, shoulder-up, 65mm, locked-off camera. She holds the clear glass toner bottle upright beside her "
                 "cheek with its printed front facing the lens; her hand and the bottle stay perfectly still in exactly the same "
                 "place for the whole shot. She looks into the lens from the first frame with a soft closed-mouth smile; within the "
                 "first second the smile deepens slightly into soft half-moon eyes, lips stay closed, and it holds until the end. "
                 "She may blink once. Nothing new appears and nothing else moves.")
SHOTS["7s2"] = ("Single shot, waist-up medium shot, 35mm, locked-off camera. She stands behind the white marble vanity in the left "
                 "half of the frame, her face turned about 15 degrees toward the window at camera left, lit like the first shot. "
                 "The right half of the frame is a plain, softly lit plaster wall that stays empty; the ceiling, window, towel bar, "
                 "vanity, basin and faucet stay exactly as in the start image. She looks into the lens from the first frame with a "
                 "faint closed-mouth smile; within the first second the smile deepens slightly into soft half-moon eyes, lips stay "
                 "closed, and it holds until the end. She may blink once. Nothing else moves.")


def prompt(cut):
    base = cut[:-2] if cut.endswith("s2") else cut
    glob_ = GLOBAL2 if cut.endswith("s2") else GLOBAL
    shot = SHOTS[cut] if cut in SHOTS else SHOTS[base]  # get(cut, SHOTS[base])는 base가 없는 컷(7hs2)에서 먼저 터진다
    if base == "3":
        parts = [glob_, REF_PAD, TEX_PAD, LIGHT_PAD, CAM_PAD, shot, CONS_PAD]
    else:
        act = ACT_SMILE if base in ("7", "7b", "7h") else ACT_ONE
        cam = CAM_LOCK if base in ("7", "7b", "7h") else CAM_FACE
        parts = [glob_, REF_FACE, TEX_FACE, LIGHT_FACE, CHAR_FACE, act, cam, shot, CONS_HAND if base == "7h" else CONS_FACE]
    return "\n".join(parts)


def fit47(src, dst):
    """가운데에서 4:7로 잘라 768×1344로 줄인다(틀 그림은 9:16이라 위아래가 조금 잘린다)."""
    im = Image.open(src).convert("RGB")
    w, h = im.size
    if h / w > H / W:
        nh = round(w * H / W)
        top = (h - nh) // 2
        im = im.crop((0, top, w, top + nh))
    else:
        nw = round(h * W / H)
        left = (w - nw) // 2
        im = im.crop((left, 0, left + nw, h))
    if im.width < W:
        raise SystemExit(f"{os.path.basename(src)}: 폭 {im.width}가 {W}보다 작음")
    im.resize((W, H), Image.LANCZOS).save(dst)


def prepare(cut):
    """ComfyUI input/jiyu/에 입력 그림을 만들고 이름을 돌려준다(ComfyUI 쪽은 영문 이름)."""
    os.makedirs(os.path.join(COMFY_DIR, "input", "jiyu"), exist_ok=True)
    srcs = INPUTS[cut] if isinstance(INPUTS[cut], tuple) else (INPUTS[cut],)
    names = []
    for i, s in enumerate(srcs):
        name = f"jiyu/cut{cut}{'_end' if i else ''}.png"
        fit47(os.path.join(K, s), os.path.join(COMFY_DIR, "input", name))
        names.append(name)
    return names


def graph(cut, names):
    g = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "minimax_h3_fl2va_pruned_int8_convrot.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", "type": "minimax", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "minimax_h3_video_vae_int8_convrot.safetensors"}},
        "5": {"class_type": "LoadImage", "inputs": {"image": names[0]}},
        "6": {"class_type": "MiniMaxH3ImageToVideo", "inputs": {"clip": ["2", 0], "vae": ["3", 0], "prompt": prompt(cut),
                                                                 "width": W, "height": H, "length": FRAMES, "first_frame": ["5", 0]}},
        "7": {"class_type": "RandomNoise", "inputs": {"noise_seed": SEED}},
        "8": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "res_multistep"}},
        "9": {"class_type": "BasicScheduler", "inputs": {"model": ["1", 0], "scheduler": "simple", "steps": STEPS, "denoise": 1.0}},
        "10": {"class_type": "BasicGuider", "inputs": {"model": ["1", 0], "conditioning": ["6", 0]}},
        "11": {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["7", 0], "guider": ["10", 0], "sampler": ["8", 0],
                                                                  "sigmas": ["9", 0], "latent_image": ["6", 1]}},
        "12": {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["3", 0]}},
        "14": {"class_type": "CreateVideo", "inputs": {"images": ["12", 0], "fps": 24}},
        "15": {"class_type": "SaveVideo", "inputs": {"video": ["14", 0], "filename_prefix": f"jiyu/h3_{cut}_s{SEED}{'_last' if LAST else ''}",
                                                     "format": "auto", "codec": "auto"}},
    }
    if LAST:
        g["6"]["inputs"]["last_frame"] = ["5", 0]
    if len(names) > 1:
        # 끝 창을 2.0초에 못 박는다(AddGuide는 비율을 지키며 가운데를 잘라 맞춘다)
        g["20"] = {"class_type": "LoadImage", "inputs": {"image": names[1]}}
        g["21"] = {"class_type": "MiniMaxH3AddGuide", "inputs": {"positive": ["6", 0], "vae": ["3", 0], "latent": ["6", 1],
                                                                  "image": ["20", 0], "frame_idx": GUIDE_AT}}
        g["10"]["inputs"]["conditioning"] = ["21", 0]
    return g


def post(path, data):
    req = urllib.request.Request(COMFY + path, data=json.dumps(data).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def get(path):
    return json.load(urllib.request.urlopen(COMFY + path, timeout=60))


def log(msg):
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def run(cut):
    names = prepare(cut)
    pid = post("/prompt", {"prompt": graph(cut, names), "client_id": str(uuid.uuid4())})["prompt_id"]
    t0 = time.time()
    log(f"{NAMES[cut]}{TAG} 넣음 {pid} steps={STEPS} seed={SEED}")
    while True:
        time.sleep(10)
        h = get(f"/history/{pid}")
        if pid not in h:
            continue
        st = h[pid].get("status", {})
        if st.get("status_str") == "error" or any(m[0] == "execution_error" for m in st.get("messages", [])):
            log(f"{NAMES[cut]} 오류 {json.dumps(st.get('messages'), ensure_ascii=False)[:1500]}")
            return False
        files = [f for o in h[pid].get("outputs", {}).values() for k in ("images", "videos", "gifs") for f in o.get(k, [])]
        if files:
            f = files[0]
            dst = os.path.join(OUT, f"{NAMES[cut]}_s{SEED}{TAG}.mp4")
            shutil.copyfile(os.path.join(COMFY_DIR, "output", f.get("subfolder", ""), f["filename"]), dst)
            log(f"{NAMES[cut]} 끝 {time.time() - t0:.0f}초 → {os.path.basename(dst)}")
            return True


def sheet():
    """입력 그림 한 장 표(768×1344를 1/4로)."""
    tiles = []
    for cut in INPUTS:
        n = 2 if isinstance(INPUTS[cut], tuple) else 1
        for i in range(n):
            p = os.path.join(COMFY_DIR, "input", f"jiyu/cut{cut}{'_end' if i else ''}.png")
            tiles.append(Image.open(p).resize((W // 4, H // 4), Image.LANCZOS))
    s = Image.new("RGB", (len(tiles) * (W // 4 + 8), H // 4), "white")
    for i, t in enumerate(tiles):
        s.paste(t, (i * (W // 4 + 8), 0))
    out = os.path.join(OUT, "_입력그림.jpg")
    s.save(out, quality=90)
    print(out)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    os.makedirs(OUT, exist_ok=True)
    args = sys.argv[1:]
    if "--준비" in args:
        for c in INPUTS:
            prepare(c)
        sheet()
        sys.exit(0)
    for c in args:
        if c not in INPUTS:
            raise SystemExit(f"모르는 컷 {c} (있는 컷: {' '.join(INPUTS)})")
    for c in args:
        run(c)
