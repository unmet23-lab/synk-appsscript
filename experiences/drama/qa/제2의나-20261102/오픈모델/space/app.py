# 「제2의 나」 사진 아바타 — 오픈 편집 모델 견주기(2026-11-03). 비공개 ZeroGPU Space(우리 계정).
# 나중에 자체 GPU + 오픈 모델로 옮길 수 있는지, GPT 이미지 2.5와 같은 입력(유호님 본인 동의 사진 · 지어낸 대역) ·
# 같은 지시문으로 기준 사진 · 옷장 편집을 굽는다. 모델은 Space 변수 ME2_MODEL로 고른다(Space 하나에 모델 하나).
# 공식 데모의 지시문 다시 쓰기(DashScope — 사진과 지시문을 바깥 API로 보냄)는 넣지 않았다. 지시문은 받은 그대로 쓴다.
import json
import os
import time

import gradio as gr
import spaces
import torch

MODEL = os.environ.get("ME2_MODEL", "qwen2511")
REPO = {
    "qwen2511": "Qwen/Qwen-Image-Edit-2511",
    "firered11": "FireRedTeam/FireRed-Image-Edit-1.1",
    "longcat": "meituan-longcat/LongCat-Image-Edit",
    "longcat_turbo": "meituan-longcat/LongCat-Image-Edit-Turbo",
}[MODEL]
QWEN = MODEL in ("qwen2511", "firered11")

if QWEN:
    from diffusers import QwenImageEditPlusPipeline as Pipe
else:
    from diffusers import LongCatImageEditPipeline as Pipe

pipe = Pipe.from_pretrained(REPO, torch_dtype=torch.bfloat16).to("cuda")

# 빠른 판(8스텝 증류 LoRA · CFG 1) — FireRed 공식 데모와 같은 방식(LoRA를 켜고 스텝 · CFG만 바꾼다). 둘 다 Apache 2.0.
FAST = {
    "qwen2511": ("lightx2v/Qwen-Image-Edit-2511-Lightning", "Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors"),
    "firered11": ("FireRedTeam/FireRed-Image-Edit-LoRA-Zoo", "FireRed-Image-Edit-Lightning-8steps-v1.0.safetensors"),
}.get(MODEL)
if FAST:
    pipe.load_lora_weights(FAST[0], weight_name=FAST[1], adapter_name="fast")
    pipe.disable_lora()

# Qwen 계열 bf16 묶음(57.7GB)은 기본 크기(large)로 옮기다 메모리에서 멈춘다(11-03 실측) — 큰 조각(xlarge, 한도 2배)으로.
SIZE = "xlarge" if QWEN else "large"
# 한 스텝 GPU 초 어림(CFG 두 번 포함) — 부르기 전 한도 확인에 쓰는 duration 상한. 실측은 돌려주는 gpu_s로 본다.
STEP_S = {"qwen2511": 3.2, "firered11": 3.2, "longcat": 2.2, "longcat_turbo": 1.2}[MODEL]


def _dur(image, prompt, seed, steps, cfg, width, height, fast):
    cfg_mul = 1.0 if float(cfg) > 1 else 0.55
    return int(min(240, 30 + int(steps) * STEP_S * cfg_mul))


@spaces.GPU(duration=_dur, size=SIZE)
def edit(image, prompt, seed, steps, cfg, width, height, fast):
    """image 한 장 + 지시문 → 편집한 한 장. width · height가 0이면 입력 비율 그대로(약 1메가화소). fast면 증류 LoRA를 켠다."""
    t0 = time.time()
    g = torch.Generator("cuda").manual_seed(int(seed))
    img = image.convert("RGB")
    if FAST:
        if fast:
            pipe.enable_lora()
            pipe.set_adapters(["fast"], adapter_weights=[1.0])
        else:
            pipe.disable_lora()
    if QWEN:
        out = pipe(image=[img], prompt=prompt, negative_prompt=" ", true_cfg_scale=float(cfg), guidance_scale=1.0,
                   num_inference_steps=int(steps), width=int(width) or None, height=int(height) or None,
                   max_sequence_length=1024, generator=g).images[0]
    else:   # LongCat: 출력 크기는 입력 비율로 정해진다(파이프라인이 높이 · 너비를 받지 않음)
        out = pipe(img, prompt, negative_prompt="", guidance_scale=float(cfg), num_inference_steps=int(steps),
                   generator=g).images[0]
    torch.cuda.synchronize()
    return out, json.dumps({"model": MODEL, "repo": REPO, "gpu_s": round(time.time() - t0, 2), "size": list(out.size),
                            "steps": int(steps), "cfg": float(cfg), "seed": int(seed), "fast": bool(fast and FAST),
                            "gpu_size": SIZE})


with gr.Blocks(title=f"me2 open edit · {MODEL}") as demo:
    with gr.Row():
        image = gr.Image(type="pil", label="입력")
        result = gr.Image(type="pil", format="png", label="결과")
    prompt = gr.Textbox(label="지시문", lines=8)
    with gr.Row():
        seed = gr.Number(value=42, precision=0, label="seed")
        steps = gr.Number(value=40, precision=0, label="스텝")
        cfg = gr.Number(value=4.0, label="CFG")
        width = gr.Number(value=0, precision=0, label="가로(0=입력 비율)")
        height = gr.Number(value=0, precision=0, label="세로(0=입력 비율)")
        fast = gr.Checkbox(value=False, label="빠른 판(8스텝 LoRA)")
    info = gr.Textbox(label="기록")
    gr.Button("굽기").click(edit, [image, prompt, seed, steps, cfg, width, height, fast], [result, info], api_name="edit")

demo.launch()
