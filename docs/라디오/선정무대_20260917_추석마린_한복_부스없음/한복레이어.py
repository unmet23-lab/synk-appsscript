from PIL import Image
from pathlib import Path

root = Path(r"C:\Users\q1212\Documents\SYNK-appsscript")
outdir = root / "docs/라디오/선정무대_20260917_추석마린_한복_부스없음"
generated = Path(r"C:\Users\q1212\.codex\generated_images\01a0aa59-f8ed-7b03-a4c3-d53a71df06ec\exec-6feac1ec-0a9e-4d97-abdb-cb9f3860d2d2.png")
img = Image.open(generated).convert("RGBA")
# The generated source is a garment-only square. Fit its complete contour to Marine's 1024 body frame.
# The slightly compressed height keeps the skirt above the body feet while leaving the head and flower visible.
fitted = img.resize((540, 410), Image.Resampling.LANCZOS)
canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
canvas.alpha_composite(fitted, (242, 510))
asset = root / "docs/Loom_자산/옷층/옷_마린_한복.webp"
canvas.save(asset, "WEBP", lossless=True, method=6)
# Keep an exact copy of the generated source beside the operation evidence.
(outdir / "생성원본_마린한복.png").write_bytes(generated.read_bytes())
# Make a standalone composited inspection image on a neutral background.
body = Image.open(root / "docs/캐릭터/화면_1024/마린_본체.webp").convert("RGBA")
comp = Image.new("RGBA", (1024, 1024), (232, 223, 211, 255))
comp.alpha_composite(body)
comp.alpha_composite(canvas)
comp.convert("RGB").save(outdir / "한복합성_중립.png")
print({"asset": str(asset), "size": canvas.size, "alpha_bbox": canvas.getchannel("A").getbbox(), "generated": str(generated)})


