"""iPhone launch images (apple-touch-startup-image) for the time-of-day opening screen.

iOS shows these for a moment before the page draws. They match the first frame of the
splash (the daytime sky, before the sun and Nomi rise), so the hand-over is smooth.
Run: python3 tools/make-launch-images.py   (needs Pillow)
"""
from pathlib import Path
from PIL import Image

SIZES = ["640x1136", "750x1334", "828x1792", "1125x2436", "1170x2532", "1179x2556",
         "1206x2622", "1242x2208", "1242x2688", "1284x2778", "1290x2796", "1320x2868"]
# the daytime splash: linear-gradient(180deg, #7b68ee 0%, #b6a8ff 50%, #f3eeff 100%)
STOPS = [(0.0, (0x7B, 0x68, 0xEE)), (0.5, (0xB6, 0xA8, 0xFF)), (1.0, (0xF3, 0xEE, 0xFF))]


def colour(t):
    for (a, ca), (b, cb) in zip(STOPS, STOPS[1:]):
        if t <= b:
            k = (t - a) / (b - a)
            return tuple(round(x + (y - x) * k) for x, y in zip(ca, cb))
    return STOPS[-1][1]


out = Path(__file__).resolve().parent.parent / "assets" / "splash"
for size in SIZES:
    w, h = map(int, size.split("x"))
    column = Image.new("RGB", (1, h))
    column.putdata([colour(y / (h - 1)) for y in range(h)])
    column.resize((w, h), Image.NEAREST).save(out / f"launch-{size}.png", optimize=True)
    print("wrote", f"launch-{size}.png")
