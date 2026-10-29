"""Render the source artwork into Android legacy and adaptive launcher icons."""
from io import BytesIO
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'android/icon'
RES = ROOT / 'android/app/src/main/res'
SIZES = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}


def render(name: str, size: int) -> Image.Image:
    result = subprocess.run(
        ['rsvg-convert', '-w', str(size), '-h', str(size), str(SOURCE / name)],
        check=True,
        capture_output=True,
    )
    return Image.open(BytesIO(result.stdout)).convert('RGBA')


for density, size in SIZES.items():
    directory = RES / f'mipmap-{density}'
    full = render('app-icon.svg', size)
    full.save(directory / 'ic_launcher.png')

    circle = Image.new('L', (size, size))
    ImageDraw.Draw(circle).ellipse((0, 0, size - 1, size - 1), fill=255)
    round_icon = full.copy()
    round_icon.putalpha(Image.composite(full.getchannel('A'), Image.new('L', (size, size)), circle))
    round_icon.save(directory / 'ic_launcher_round.png')

    render('app-icon-foreground.svg', round(size * 2.25)).save(directory / 'ic_launcher_foreground.png')
