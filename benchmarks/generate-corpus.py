#!/usr/bin/env python3
"""
Generates the benchmark corpus.

The corpus is generated rather than committed for two reasons: binary PDFs
in git age badly, and a generated corpus can carry ground truth. Every
raster page is produced by rendering known text into an image, so the OCR
benchmark can compare recognised text against the exact string that was
drawn instead of against a human's guess.

Deterministic: a fixed seed, fixed text, fixed layout. Two runs on two
machines produce the same bytes, so a benchmark number is comparable across
runs.

    python3 benchmarks/generate-corpus.py

Writes benchmarks/corpus/*.pdf and benchmarks/corpus/ground-truth/*.txt.
Both are gitignored.
"""

from __future__ import annotations

import random
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
CORPUS = ROOT / "corpus"
TRUTH = CORPUS / "ground-truth"

# A4 at the given dpi. 300 dpi is what a document scanner defaults to;
# 150 dpi is what people get when they photograph a page or scan "for email".
A4_INCHES = (8.27, 11.69)

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
]

# Deliberately ordinary business prose: OCR engines behave differently on
# dense legal text than on marketing copy, and the former is what people
# actually scan.
PARAGRAPHS = [
    "This agreement is made between the supplier and the customer on the date "
    "set out above, and governs the provision of the services described in "
    "Schedule 1 for the duration of the initial term.",
    "The customer shall pay each invoice within thirty days of the invoice "
    "date. Amounts not paid when due shall bear interest at the statutory "
    "rate applicable to commercial transactions.",
    "Neither party shall be liable for any failure to perform its obligations "
    "where such failure results from circumstances beyond its reasonable "
    "control, provided that the affected party notifies the other promptly.",
    "All intellectual property rights in any materials created under this "
    "agreement shall vest in the customer upon payment in full of the fees "
    "relating to those materials.",
    "This agreement may be terminated by either party on sixty days written "
    "notice, or immediately in the event of a material breach which remains "
    "unremedied for fourteen days after written notice.",
    "Any notice given under this agreement shall be in writing and shall be "
    "delivered by hand, sent by prepaid first class post, or sent by "
    "electronic mail to the address of the relevant party.",
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    raise SystemExit("no usable TTF font found - edit FONT_CANDIDATES")


def page_text(page_number: int) -> str:
    """Deterministic per-page body text, and the OCR ground truth."""
    chosen = [PARAGRAPHS[(page_number + offset) % len(PARAGRAPHS)] for offset in range(4)]
    heading = f"SECTION {page_number + 1}"
    return heading + "\n\n" + "\n\n".join(chosen)


def render_page(text: str, dpi: int, rng: random.Random, degrade: bool) -> Image.Image:
    """
    Renders text to a page image the way a scanner would deliver it.

    `degrade` adds the artefacts that make OCR interesting: a fraction of a
    degree of skew, sensor noise and a slight blur. Without them the image is
    a synthetic ideal that every OCR engine reads perfectly, and the number
    means nothing.
    """
    width = int(A4_INCHES[0] * dpi)
    height = int(A4_INCHES[1] * dpi)

    image = Image.new("L", (width, height), color=255)
    draw = ImageDraw.Draw(image)

    body_size = max(12, int(dpi / 300 * 42))
    heading_size = int(body_size * 1.4)
    margin = int(dpi * 0.9)
    wrap_at = max(20, int((width - 2 * margin) / (body_size * 0.5)))

    y = margin
    for index, block in enumerate(text.split("\n\n")):
        font = load_font(heading_size if index == 0 else body_size)
        for line in textwrap.wrap(block, width=wrap_at):
            draw.text((margin, y), line, fill=20, font=font)
            y += int(font.size * 1.45)
        y += int(body_size * 0.9)

    if degrade:
        image = image.rotate(rng.uniform(-0.6, 0.6), fillcolor=255, resample=Image.BICUBIC)
        image = image.filter(ImageFilter.GaussianBlur(radius=dpi / 900))
        noise = Image.effect_noise((width, height), 18).convert("L")
        image = Image.blend(image, noise, alpha=0.06)

    return image.convert("RGB")


def write_pdf(images: list[Image.Image], path: Path, dpi: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    head, *rest = images
    head.save(path, "PDF", save_all=True, append_images=rest, resolution=dpi, quality=85)


def build_scan(name: str, pages: int, dpi: int, degrade: bool = True) -> None:
    rng = random.Random(f"{name}:{dpi}")
    images = []
    truth = []

    for number in range(pages):
        text = page_text(number)
        truth.append(text)
        images.append(render_page(text, dpi, rng, degrade))

    write_pdf(images, CORPUS / f"{name}.pdf", dpi)
    (TRUTH / f"{name}.txt").write_text("\n\n".join(truth), encoding="utf-8")

    size_mb = (CORPUS / f"{name}.pdf").stat().st_size / 1024 / 1024
    print(f"  {name}.pdf  {pages}p @ {dpi}dpi  {size_mb:.2f} MB")


def build_photos(name: str, pages: int, dpi: int) -> None:
    """
    Full-bleed photographic pages: gradients plus noise, which behave like
    photographs under JPEG rather than like text.
    """
    rng = random.Random(name)
    width = int(A4_INCHES[0] * dpi)
    height = int(A4_INCHES[1] * dpi)
    images = []

    for _ in range(pages):
        base = Image.new("RGB", (width, height))
        pixels = base.load()
        offset = rng.randint(0, 255)
        # A coarse gradient is enough; the noise layer below is what makes
        # the JPEG payload behave like a photograph.
        for y in range(0, height, 4):
            for x in range(0, width, 4):
                colour = ((x + offset) % 256, (y + offset) % 256, (x + y) % 256)
                for dy in range(4):
                    for dx in range(4):
                        if x + dx < width and y + dy < height:
                            pixels[x + dx, y + dy] = colour
        noise = Image.effect_noise((width, height), 40).convert("RGB")
        images.append(Image.blend(base, noise, alpha=0.35))

    write_pdf(images, CORPUS / f"{name}.pdf", dpi)
    size_mb = (CORPUS / f"{name}.pdf").stat().st_size / 1024 / 1024
    print(f"  {name}.pdf  {pages}p @ {dpi}dpi  {size_mb:.2f} MB")


def main() -> None:
    CORPUS.mkdir(parents=True, exist_ok=True)
    TRUTH.mkdir(parents=True, exist_ok=True)

    print("generating corpus:")
    build_scan("scan-300dpi-10p", pages=10, dpi=300)
    build_scan("scan-150dpi-5p", pages=5, dpi=150)
    build_scan("scan-clean-300dpi-3p", pages=3, dpi=300, degrade=False)
    build_photos("photo-3p", pages=3, dpi=200)
    print(f"\nwrote {CORPUS}")
    print("text-native fixture: node benchmarks/generate-text-pdf.mjs")


if __name__ == "__main__":
    main()
