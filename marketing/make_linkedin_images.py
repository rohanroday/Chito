"""Builds LinkedIn images (1080x1350) for Chito from app screenshots in marketing/screens/.

Run:  python marketing/make_linkedin_images.py   → writes marketing/linkedin/*.png
Uses the app's own colours (DESIGN.md) and fonts (Yatra One + Mukta from apps/mobile/node_modules).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
SCREENS = ROOT / "screens"
OUT = ROOT / "linkedin"
OUT.mkdir(exist_ok=True)
FONTS = ROOT.parent / "apps" / "mobile" / "node_modules" / "@expo-google-fonts"

MAROON = (123, 30, 40)
MAROON_DARK = (94, 20, 29)
GOLD = (255, 214, 10)
GOLD_DEEP = (201, 151, 0)
PARCHMENT = (251, 244, 230)
SAND = (242, 232, 213)
INK = (36, 21, 15)
MUTED = (122, 106, 94)
TURQUOISE = (15, 124, 128)
FLAGS = [(37, 99, 201), (255, 255, 255), (214, 58, 42), (46, 158, 62), (255, 214, 10)]

W, H = 1080, 1350


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    paths = {
        "display": FONTS / "yatra-one" / "400Regular" / "YatraOne_400Regular.ttf",
        "bold": FONTS / "mukta" / "700Bold" / "Mukta_700Bold.ttf",
        "semibold": FONTS / "mukta" / "600SemiBold" / "Mukta_600SemiBold.ttf",
        "body": FONTS / "mukta" / "400Regular" / "Mukta_400Regular.ttf",
    }
    return ImageFont.truetype(str(paths[name]), size)


def prayer_flags(img: Image.Image, y: int, size: int = 26, gap: int = 10) -> None:
    d = ImageDraw.Draw(img)
    d.line([(0, y + 2), (W, y + 2)], fill=(255, 255, 255, 120), width=2)
    x, i = 14, 0
    while x < W:
        c = FLAGS[i % len(FLAGS)]
        d.rectangle([x, y + 4, x + size, y + 4 + int(size * 0.8)], fill=c, outline=(0, 0, 0, 40))
        x += size + gap
        i += 1


def dentil(img: Image.Image, y: int, h: int = 12) -> None:
    d = ImageDraw.Draw(img)
    d.rectangle([0, y, W, y + h], fill=MAROON_DARK)
    for x in range(4, W, 16):
        d.rectangle([x, y + 3, x + 7, y + h - 3], fill=GOLD_DEEP)


def phone(shot: Path, width: int) -> Image.Image:
    """Screenshot inside a dark rounded phone frame with a soft shadow."""
    src = Image.open(shot).convert("RGB")
    ratio = src.height / src.width
    bezel = max(10, width // 28)
    inner_w = width - 2 * bezel
    inner_h = int(inner_w * ratio)
    screen = src.resize((inner_w, inner_h), Image.LANCZOS)
    r_outer, r_inner = width // 7, width // 7 - bezel // 2
    frame = Image.new("RGBA", (width, inner_h + 2 * bezel), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle([0, 0, frame.width - 1, frame.height - 1], r_outer, fill=(28, 18, 14))
    mask = Image.new("L", screen.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, inner_w - 1, inner_h - 1], r_inner, fill=255)
    frame.paste(screen, (bezel, bezel), mask)
    # Shadow
    pad = 40
    shadow = Image.new("RGBA", (frame.width + 2 * pad, frame.height + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([pad, pad + 14, pad + frame.width, pad + frame.height + 14], r_outer, fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    shadow.alpha_composite(frame, (pad, pad))
    return shadow


def paste_center(canvas: Image.Image, item: Image.Image, cx: int, top: int, angle: float = 0) -> None:
    if angle:
        item = item.rotate(angle, resample=Image.BICUBIC, expand=True)
    canvas.alpha_composite(item, (int(cx - item.width / 2), top))


def text_center(d: ImageDraw.ImageDraw, y: int, s: str, f: ImageFont.FreeTypeFont, fill) -> int:
    box = d.textbbox((0, 0), s, font=f)
    d.text(((W - (box[2] - box[0])) / 2 - box[0], y), s, font=f, fill=fill)
    return y + (box[3] - box[1])


def base(bg=MAROON) -> Image.Image:
    img = Image.new("RGBA", (W, H), bg + (255,))
    return img


def footer(img: Image.Image, n: int, total: int) -> None:
    d = ImageDraw.Draw(img)
    dentil(img, H - 70)
    d.rectangle([0, H - 58, W, H], fill=MAROON)
    f = font("semibold", 26)
    d.text((40, H - 50), "Chito · Sikkim's own quick bazaar", font=f, fill=GOLD)
    s = f"{n}/{total}"
    box = d.textbbox((0, 0), s, font=f)
    d.text((W - 40 - (box[2] - box[0]), H - 50), s, font=f, fill=(255, 255, 255))


def fitted(name: str, size: int, s: str, max_w: int) -> ImageFont.FreeTypeFont:
    """Largest font (up to `size`) that keeps `s` within `max_w` pixels."""
    d = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    while size > 20 and d.textbbox((0, 0), s, font=font(name, size))[2] > max_w:
        size -= 2
    return font(name, size)


def slide_title(img: Image.Image, kicker: str, title: str, sub: str) -> None:
    d = ImageDraw.Draw(img)
    y = 70
    y = text_center(d, y, kicker.upper(), font("bold", 28), TURQUOISE) + 14
    y = text_center(d, y, title, fitted("display", 64, title, W - 100), MAROON) + 18
    text_center(d, y, sub, fitted("body", 32, sub, W - 100), MUTED)


TOTAL = 5


def cover() -> None:
    img = base(MAROON)
    d = ImageDraw.Draw(img)
    prayer_flags(img, 18)
    text_center(d, 92, "Tashi Delek 🙏".replace(" 🙏", ""), font("semibold", 36), (255, 255, 255))
    text_center(d, 140, "Chito", font("display", 132), GOLD)
    text_center(d, 300, "A quick grocery delivery app for my hometown,", font("body", 34), (255, 235, 235))
    text_center(d, 342, "Singtam, Sikkim", font("bold", 40), (255, 255, 255))
    paste_center(img, phone(SCREENS / "jhola.jpg", 300), 250, 470, angle=6)
    paste_center(img, phone(SCREENS / "map.jpg", 300), 830, 470, angle=-6)
    paste_center(img, phone(SCREENS / "home.jpg", 340), W // 2, 430)
    d = ImageDraw.Draw(img)
    chips = ["React Native", "Node.js", "MongoDB", "Next.js", "Razorpay"]
    f = font("semibold", 26)
    widths = [d.textbbox((0, 0), c, font=f)[2] + 36 for c in chips]
    x = (W - (sum(widths) + 12 * (len(chips) - 1))) // 2
    for c, w in zip(chips, widths):
        d.rounded_rectangle([x, 1196, x + w, 1244], 24, fill=GOLD)
        d.text((x + 18, 1203), c, font=f, fill=MAROON)
        x += w + 12
    footer(img, 1, TOTAL)
    img.convert("RGB").save(OUT / "01_cover.png", optimize=True)


def two_phones(name: str, n: int, kicker: str, title: str, sub: str, left: str, right: str, captions: tuple[str, str]) -> None:
    img = base(PARCHMENT)
    slide_title(img, kicker, title, sub)
    d = ImageDraw.Draw(img)
    for cx, shot, cap in ((285, left, captions[0]), (795, right, captions[1])):
        ph = phone(SCREENS / shot, 380)
        top = 255
        paste_center(img, ph, cx, top)
        f = fitted("semibold", 28, cap, 470)
        box = d.textbbox((0, 0), cap, font=f)
        # The phone image has a 40px shadow margin around the frame
        d.text((cx - (box[2] - box[0]) / 2, top + ph.height - 40 + 14), cap, font=f, fill=INK)
    footer(img, n, TOTAL)
    img.convert("RGB").save(OUT / name, optimize=True)


def admin_slide() -> None:
    img = base(PARCHMENT)
    slide_title(img, "For the shop owner", "Live store dashboard", "New orders chime in · assign riders · end-of-day report")
    shot = Image.open(SCREENS / "admin.jpg").convert("RGB")
    sd = ImageDraw.Draw(shot)
    # Hide the Next.js dev badge in the corner
    sd.ellipse([shot.width - 36, shot.height - 36, shot.width - 6, shot.height - 6], fill=PARCHMENT)
    # Hide the admin's login email (bottom of the sidebar): it must not appear in a public post
    sidebar = shot.getpixel((5, 470))
    sd.rectangle([6, 464, 122, 481], fill=sidebar)
    tw = 960
    th = int(tw * shot.height / shot.width)
    shot = shot.resize((tw, th), Image.LANCZOS)
    bar = 40
    win = Image.new("RGBA", (tw + 20, th + bar + 10), (0, 0, 0, 0))
    wd = ImageDraw.Draw(win)
    wd.rounded_rectangle([0, 0, win.width - 1, win.height - 1], 22, fill=(28, 18, 14))
    for i, c in enumerate([(255, 95, 87), (255, 189, 46), (40, 200, 64)]):
        wd.ellipse([22 + i * 26, 14, 36 + i * 26, 28], fill=c)
    win.paste(shot, (10, bar))
    pad = 40
    sh = Image.new("RGBA", (win.width + 2 * pad, win.height + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([pad, pad + 14, pad + win.width, pad + win.height + 14], 22, fill=(0, 0, 0, 100))
    sh = sh.filter(ImageFilter.GaussianBlur(18))
    sh.alpha_composite(win, (pad, pad))
    paste_center(img, sh, W // 2, 330)
    d = ImageDraw.Draw(img)
    points = [
        "⚡ Orders appear instantly (Socket.io) with a chime",
        "🛵 Pack, assign a waiting rider, mark delivered",
        "📊 Day report: cash vs online, cash per rider, best sellers",
    ]
    f = font("semibold", 32)
    y = 330 + sh.height + 10
    for p in points:
        p = p.split(" ", 1)[1]
        text_center(d, y, p, f, INK)
        y += 52
    footer(img, 5, TOTAL)
    img.convert("RGB").save(OUT / "05_admin.png", optimize=True)


if __name__ == "__main__":
    cover()
    two_phones("02_shop.png", 2, "Monastery-inspired design", "Shop like home", "170+ products · arched cards · prayer-flag details",
               "login.jpg", "categories.jpg", ("Tashi Delek! OTP login", "Aisles with a side rail"))
    two_phones("03_search_map.png", 3, "Built for Sikkim", "Nepali search & a 3 km zone", "Type चिया or chiya · pin the door on the map",
               "search.jpg", "map.jpg", ("Search in Nepali, Hindi, English", "Delivery only within 3 km"))
    two_phones("04_family_tracking.png", 4, "Order for family", "Away from home? Send groceries", "The rider calls Mom · pay online, nothing at the door",
               "formom.jpg", "tracking.jpg", ("Deliver to Mom's house", "Live tracking up the mountain"))
    admin_slide()
    print("Wrote:", ", ".join(sorted(p.name for p in OUT.glob("*.png"))))
