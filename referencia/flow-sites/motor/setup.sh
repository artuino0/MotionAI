#!/usr/bin/env bash
# Prepara el motor de papel de Flow en un entorno nuevo (Linux con Python 3 y ffmpeg).
set -e
cd "$(dirname "$0")"
pip install --break-system-packages -q pycairo numpy opencv-python-headless shapely cairosvg fonttools pillow 2>/dev/null \
  || pip install -q pycairo numpy opencv-python-headless shapely cairosvg fonttools pillow
mkdir -p ~/.fonts
if ! fc-list | grep -qi NunitoBlack; then
  curl -sfL -o /tmp/Nunito.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/Nunito%5Bwght%5D.ttf"
  python3 - <<'E'
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
import os
for w, name in [(900, "NunitoBlack"), (700, "NunitoBold")]:
    g = instantiateVariableFont(TTFont("/tmp/Nunito.ttf"), {"wght": w})
    for r in g["name"].names:
        if r.nameID in (1, 4, 16, 6): r.string = name
        if r.nameID in (2, 17): r.string = "Regular"
    g.save(os.path.expanduser("~/.fonts/%s.ttf" % name))
E
  fc-cache -f >/dev/null
fi
python3 -c "import cairo, cv2, shapely, cairosvg; import papercut_style; print('motor listo')"
