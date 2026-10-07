"""Genera FlowPublicidad.pen: la identidad publicitaria de Flow en un solo archivo de Pencil.

Las piezas se dibujan con el mismo motor de los videos (papercut_style) y se graban como vectores,
así lo que se ve en Pencil es lo mismo que sale en video. Cada componente lleva metadata para que
pen2video.py sepa cómo animarlo (actor del motor, etiqueta, pieza de papel, fondo).
"""
import json, math, random, string, os, copy
import cairo
import papercut_style as ps
import chattito_tiktok as C
import flowcore_tiktok as FC
from recorder import Recorder, new_ctx, bbox

P = ps.P
RES = 'recursos/'
_rng = random.Random(77)


def nid():
    return ''.join(_rng.choice(string.ascii_letters + string.digits) for _ in range(6))


def hexc(c, a=1.0):
    s = '#%02X%02X%02X' % tuple(int(round(max(0, min(1, v)) * 255)) for v in c[:3])
    if a < .999:
        s += '%02X' % int(round(a * 255))
    return s


def jag_list(pts, amp, step, seed):
    r = random.Random(seed)
    out = []
    n = len(pts)
    for i in range(n):
        x0, y0 = pts[i]; x1, y1 = pts[(i + 1) % n]
        L = math.hypot(x1 - x0, y1 - y0)
        if L < 1e-6:
            continue
        k = max(1, int(round(L / step)))
        nx, ny = -(y1 - y0) / L, (x1 - x0) / L
        for j in range(k):
            t = j / k; o = r.uniform(-amp, amp)
            out.append((x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o))
    return out


def geom(subs, ox, oy):
    return ''.join('M' + 'L'.join('%.1f %.1f' % (x - ox, y - oy) for x, y in sp) + 'Z' for sp in subs)


GRAIN = {'type': 'image', 'url': RES + 'grano.png', 'mode': 'cover', 'blendMode': 'softLight', 'opacity': .42}
SHADOW = {'type': 'shadow', 'offset': {'x': 4, 'y': 6}, 'blur': 6, 'color': '#0000002B'}


def path_node(name, subs, ox, oy, fill, effect=None, stroke=None):
    xs = [p[0] for sp in subs for p in sp]; ys = [p[1] for sp in subs for p in sp]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    w, h = max(1, x1 - x0), max(1, y1 - y0)
    n = {'type': 'path', 'id': nid(), 'name': name, 'x': round(x0 - ox, 2), 'y': round(y0 - oy, 2), 'width': round(w, 2),
         'height': round(h, 2), 'viewBox': [0, 0, round(w, 2), round(h, 2)], 'geometry': geom(subs, x0, y0)}
    if fill is not None:
        n['fill'] = fill
    if effect:
        n['effect'] = effect
    if stroke:
        n.update(stroke)
    return n


def items_to_nodes(items, ox, oy, seed=1):
    """Convierte lo grabado por el motor en nodos de Pencil (coordenadas locales a ox, oy)."""
    nodes = []
    for k, it in enumerate(items):
        if it['kind'] == 'fill':
            col = hexc(it['color'], it['a'])
            subs = [sp for sp in it['subpaths'] if len(sp) > 2]
            if not subs:
                continue
            if it['paper'] and it['shadow'] and it['a'] > .5:
                rim = [jag_list(sp, 2.6, 7, seed * 131 + k * 7 + j) for j, sp in enumerate(subs)]
                nodes.append(path_node('Filo', rim, ox, oy, '#FFFFFAEB', SHADOW))
            fill = [col, dict(GRAIN)] if it['paper'] and it['a'] > .5 else col
            nodes.append(path_node('Papel', subs, ox, oy, fill))
        elif it['kind'] == 'stroke':
            pts = it['pts']
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            pad = it['width']
            x0, y0 = min(xs) - pad, min(ys) - pad
            w, h = max(xs) - min(xs) + 2 * pad, max(ys) - min(ys) + 2 * pad
            nodes.append({'type': 'path', 'id': nid(), 'name': 'Trazo', 'x': round(x0 - ox, 2), 'y': round(y0 - oy, 2),
                          'width': round(w, 2), 'height': round(h, 2), 'viewBox': [0, 0, round(w, 2), round(h, 2)],
                          'geometry': 'M' + 'L'.join('%.1f %.1f' % (x - x0, y - y0) for x, y in pts),
                          'stroke': hexc(it['color'], it['a']), 'strokeWidth': round(it['width'], 2),
                          'strokeLinecap': 'round', 'strokeLinejoin': 'round'})
        else:
            nodes.append({'type': 'text', 'id': nid(), 'name': 'Texto', 'x': round(it['x'] - ox, 1),
                          'y': round(it['baseline'] - 1.04 * it['size'] - oy, 1), 'content': it['text'],
                          'fontFamily': 'Nunito', 'fontWeight': it['weight'], 'fontSize': round(it['size'], 1),
                          'fill': hexc(it['color'], it['a'])})
    return nodes


def record(fn, tex=True):
    c = new_ctx()
    ps.begin_frame(0, textura=tex)
    with Recorder() as r:
        fn(c)
    return r.items


def component(name, items, meta, pad=8, seed=1, anchor=None):
    x0, y0, x1, y1 = bbox(items, pad)
    fr = {'type': 'frame', 'id': nid(), 'name': name, 'reusable': True, 'layout': 'none',
          'width': round(x1 - x0), 'height': round(y1 - y0), 'children': items_to_nodes(items, x0, y0, seed)}
    m = dict(meta)
    if anchor is not None:
        m['anchor'] = [round(anchor[0] - x0, 2), round(anchor[1] - y0, 2)]
    fr['metadata'] = m
    return fr


# ------------------------------------------------------------------ layout helpers
def section(name, children, w, h, fill_url=None, fill_color=None):
    fr = {'type': 'frame', 'id': nid(), 'name': name, 'layout': 'none', 'clip': False, 'width': w, 'height': h, 'children': children}
    if fill_url:
        fr['fill'] = {'type': 'image', 'url': RES + fill_url, 'mode': 'cover'}
    elif fill_color:
        fr['fill'] = fill_color
    return fr


def text(name, content, x, y, size, color, weight='900', ls=None, lh=None, w=None):
    t = {'type': 'text', 'id': nid(), 'name': name, 'x': x, 'y': y, 'content': content, 'fontFamily': 'Nunito',
         'fontWeight': weight, 'fontSize': size, 'fill': color}
    if ls:
        t['letterSpacing'] = ls
    if lh:
        t['lineHeight'] = lh
    if w:
        t['textGrowth'] = 'fixed-width'; t['width'] = w
    return t


def grid(comps, x0, y0, maxw, gap=56, label=True):
    """Acomoda componentes en filas; agrega su nombre debajo."""
    out, x, y, rowh = [], x0, y0, 0
    for c in comps:
        if x + c['width'] > x0 + maxw and x > x0:
            x = x0; y += rowh + gap + (30 if label else 0); rowh = 0
        c['x'], c['y'] = x, y
        out.append(c)
        if label:
            out.append(text('Nombre · ' + c['name'], c['name'], x, y + c['height'] + 10, 14, '#8D8582', '800'))
        x += c['width'] + gap
        rowh = max(rowh, c['height'])
    return out, y + rowh + (40 if label else 0) - y0


def header(title, sub, eyebrow):
    return [text('Eyebrow', eyebrow, 60, 52, 15, '#8D8582', '800', ls=2.5),
            text('Título', title, 58, 74, 62, '#006E84'),
            text('Subtítulo', sub, 62, 156, 18, '#3A2E30', '700')]
