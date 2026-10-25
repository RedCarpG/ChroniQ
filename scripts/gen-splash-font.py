"""The loading screen's two tiny fonts, cut from the titles' typefaces to just what it shows.

The splash (index.html, drawn before any of the app's code or style arrives) sets 星曆 and its
line in 思源宋体 and ChroniQ in Cormorant Garamond. The full 思源宋体 comes in slices, and the
splash's dozen characters sit in ten of them (some 380 kB), so these are cut down to those
characters alone and merged into one small file; Cormorant likewise to the letters of ChroniQ.

Run once after changing the splash's text (needs fontTools and brotli: pip install fonttools brotli):
    python scripts/gen-splash-font.py
Writes public/fonts/splash-zh.woff2 and public/fonts/splash-en.woff2 (SIL Open Font License, as
the fonts they come from).
"""
import re
import sys
from io import BytesIO
from pathlib import Path

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
ZH_TEXT = '星曆觀象知數察時變·'
EN_TEXT = 'ChroniQ'
NOTO = ROOT / 'node_modules/@fontsource/noto-serif-sc'
CORMORANT = ROOT / 'node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2'
OUT = ROOT / 'public/fonts'


def slices_for(text):
    """The 思源宋体 600 slice files that hold each character of text (from fontsource's unicode-ranges)"""
    css = (NOTO / '600.css').read_text(encoding='utf-8')
    faces = []
    for m in re.finditer(r'noto-serif-sc-(\d+)-600-normal\.woff2[\s\S]*?unicode-range: ([^;]+);', css):
        ranges = []
        for r in m.group(2).split(','):
            a, _, b = r.strip()[2:].partition('-')
            ranges.append((int(a, 16), int(b or a, 16)))
        faces.append((m.group(1), ranges))
    files = []
    for ch in text:
        cp = ord(ch)
        n = next((n for n, rs in faces if any(a <= cp <= b for a, b in rs)), None)
        if n is None:
            sys.exit(f'no slice holds {ch}')
        path = NOTO / f'files/noto-serif-sc-{n}-600-normal.woff2'
        if path not in files:
            files.append(path)
    return files


def cut(path, text):
    """A font with only the glyphs for text, as a TTFont (outlines kept, layout tables dropped)"""
    font = TTFont(path)
    options = subset.Options()
    options.layout_features = []
    options.name_IDs = ['*']
    options.notdef_outline = True
    sub = subset.Subsetter(options)
    sub.populate(text=text)
    sub.subset(font)
    font.flavor = None
    out = BytesIO()
    font.save(out)
    out.seek(0)
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    pieces = [cut(p, ZH_TEXT) for p in slices_for(ZH_TEXT)]
    merged = Merger().merge(pieces)
    merged.flavor = 'woff2'
    merged.save(OUT / 'splash-zh.woff2')
    en = TTFont(cut(CORMORANT, EN_TEXT))
    en.flavor = 'woff2'
    en.save(OUT / 'splash-en.woff2')
    for name in ('splash-zh.woff2', 'splash-en.woff2'):
        print(name, (OUT / name).stat().st_size, 'bytes')


main()
