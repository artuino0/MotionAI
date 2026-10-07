"""
papercut_style.py — Motor de estilo «papel recortado» de los comerciales Flow.

Contiene paleta, tratamiento del papel (corte, filo rasgado, grano, sombras),
tipografía y etiquetas, escenarios, personajes, dispositivos e isotipo.
Las especificaciones están en la Guía de estilo (Claude Docs).

Requisitos: pycairo, numpy, opencv-python y las fuentes NunitoBlack / NunitoBold
instaladas (instancias estáticas de Nunito a peso 900 y 700).

Uso básico por cuadro:
    import papercut_style as ps
    ps.begin_frame(fi, textura=True)   # fija boil y textura
    ... dibuja con ps.wall, ps.person, ps.tag, ps.phone, ps.isotipo ...
"""
import cairo, math, random, os, sys

W, H = 1080, 1920
FPS = 12
DUR = 30.0
NF = int(FPS * DUR)
BOIL = 3


def hx(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


P = dict(
    pink=hx('F6CFCB'), pink2=hx('EDB3B1'), cream=hx('FBF3E4'), paper=hx('FFFBF3'),
    mustard=hx('EDB43E'), teal=hx('006E84'), teal2=hx('3FA3B5'), tealL=hx('D3ECEF'),
    coral=hx('FF7A66'), coralD=hx('E5604F'), coralL=hx('FFD9D1'), mint=hx('9ED3C0'), mintL=hx('DDF1E8'),
    sky=hx('A9D3EA'), ink=hx('3A2E30'), white=hx('FFFFFF'), red=hx('D9433E'), wood=hx('C48A62'),
    woodD=hx('9C6A49'), green=hx('3E8A6E'), navy=hx('2F3A56'), gray=hx('DDD8D3'), grayD=hx('8D8582'),
    cheek=hx('F59A93'), mouth=hx('8C2E36'), tongue=hx('F2777A'), plaid=hx('C9433F'),
    yellowL=hx('FBE6B0'), shirtG=hx('3E9C86'),
    # temporada · Día de Muertos
    cempa=hx('F59E1B'), cempaD=hx('D9770F'), rosamx=hx('E2457E'), rosamxL=hx('F7C6D8'), morado=hx('7B4A9E'), moradoL=hx('D9C6EA'),
    azulmx=hx('3B7DC4'), verdemx=hx('3E9C6E'), vela=hx('FFF4DC'), llama=hx('FFC23D'), pan=hx('D08A45'), panD=hx('A9662C'),
    # temporada · Halloween
    noche=hx('2E2645'), noche2=hx('3B3159'), calabaza=hx('F2782E'), calabazaD=hx('C85A1C'), bruja=hx('5B3A7A'),
    limo=hx('8FD14F'), hueso=hx('F4EEDC'), sombra=hx('1D1830'),
)
SK = [hx('8A5A3F'), hx('C68E68'), hx('E8B996'), hx('6B4330'), hx('D9A27C'), hx('A8704E')]


class St:
    boil = 0
    k = 0
    desat = 0.0
    tex = False
    clean = False
    group = None


def _make_grain(n=512, seed=3):
    import numpy as np
    r = np.random.default_rng(seed)
    g = r.normal(0, 1, (n, n))
    # fibras: ruido estirado horizontal y vertical
    import cv2
    f1 = cv2.resize(r.normal(0, 1, (n, n // 16)), (n, n), interpolation=cv2.INTER_CUBIC)
    f2 = cv2.resize(r.normal(0, 1, (n // 16, n)), (n, n), interpolation=cv2.INTER_CUBIC)
    blob = cv2.resize(r.normal(0, 1, (n // 64, n // 64)), (n, n), interpolation=cv2.INTER_CUBIC)
    v = g * .6 + f1 * .22 + f2 * .18 + blob * .3
    v = (v - v.mean()) / v.std()
    v = np.clip(128 + v * 34, 0, 255).astype(np.uint8)
    a = np.dstack([v, v, v, np.full_like(v, 255)]).copy()
    surf = cairo.ImageSurface.create_for_data(memoryview(a), cairo.FORMAT_ARGB32, n, n)
    global _GRAIN_BUF
    _GRAIN_BUF = (a, surf)
    pat = cairo.SurfacePattern(surf)
    pat.set_extend(cairo.EXTEND_REPEAT)
    return pat


GRAIN = None


def grain(c, alpha=.55):
    global GRAIN
    if GRAIN is None:
        GRAIN = _make_grain()
    c.save()
    c.set_operator(cairo.OPERATOR_SOFT_LIGHT)
    c.set_source(GRAIN)
    c.paint_with_alpha(alpha)
    c.restore()


S = St()


def rng():
    S.k += 1
    return random.Random(S.k * 7919 + S.boil * 104729)


def col(c, a=1.0):
    if S.desat > 0:
        l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
        d = S.desat
        c = tuple(x * (1 - d) + (l * 0.85 + 0.1) * d for x in c)
    return (c[0], c[1], c[2], a)


# ---------- easing ----------
def cl(x):
    return max(0.0, min(1.0, x))


def eoc(x):
    x = cl(x)
    return 1 - (1 - x) ** 3


def eob(x, s=1.8):
    x = cl(x) - 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2


def prog(t, t0, d=0.35):
    return cl((t - t0) / d)


# ---------- cut paper primitives ----------
def jag(pts, amp=2.2, seg=46, closed=True):
    r = rng()
    out = []
    n = len(pts)
    m = n if closed else n - 1
    for i in range(m):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        L = math.hypot(x1 - x0, y1 - y0)
        if L < 1e-6:
            continue
        k = max(1, int(L / seg))
        nx, ny = -(y1 - y0) / L, (x1 - x0) / L
        for j in range(k):
            tt = j / k
            o = r.uniform(-amp, amp) if j > 0 else r.uniform(-amp * .6, amp * .6)
            out.append((x0 + (x1 - x0) * tt + nx * o, y0 + (y1 - y0) * tt + ny * o))
    if not closed:
        out.append(pts[-1])
    return out


def path(c, pts):
    c.move_to(*pts[0])
    for p in pts[1:]:
        c.line_to(*p)
    c.close_path()


SH = (5, 7)


def fillpts(c, pts, color, a=1.0, shadow=True):
    if S.group is not None:
        S.group.append(pts)
        return
    tex = S.tex and not S.clean
    if shadow:
        if tex:
            for dx, dy, al in [(SH[0] * 1.5, SH[1] * 1.5, .06), (SH[0], SH[1], .08), (SH[0] * .5, SH[1] * .5, .06)]:
                c.save(); c.translate(dx, dy); path(c, pts); c.set_source_rgba(0, 0, 0, al * a); c.fill(); c.restore()
        else:
            c.save()
            c.translate(*SH)
            path(c, pts)
            c.set_source_rgba(0, 0, 0, 0.15 * a)
            c.fill()
            c.restore()
    if tex and a > .5 and len(pts) > 2:
        rim = jag(pts, amp=2.6, seg=7)
        path(c, rim)
        c.set_source_rgba(1, 1, .98, .92 * a)
        c.fill()
        rng()  # mantiene la secuencia de cortes
        r = random.Random(S.k * 7919 + 17)  # tono fijo por pieza: no cambia con el boil
        k = r.uniform(.955, 1.04)
        color = tuple(min(1, x * k) for x in color)
    path(c, pts)
    c.set_source_rgba(*col(color, a))
    c.fill()
    if tex and a > .5:
        c.save()
        path(c, pts)
        c.clip()
        grain(c, .6)
        c.restore()


def group_begin():
    """Abre un grupo: las piezas siguientes se juntan en una sola silueta de papel."""
    S.group = []


def group_end(c, color, shadow=True):
    """Dibuja el grupo como UNA pieza: una sombra, un filo, un color y un grano para toda la silueta."""
    pieces, S.group = S.group, None
    if not pieces:
        return
    tex = S.tex and not S.clean

    def union(fill_pts=None):
        c.push_group()
        for pts in pieces:
            path(c, fill_pts(pts) if fill_pts else pts)
            c.set_source_rgba(1, 1, 1, 1)
            c.fill()
        return c.pop_group()

    if shadow:
        offs = [(SH[0] * 1.5, SH[1] * 1.5, .06), (SH[0], SH[1], .08), (SH[0] * .5, SH[1] * .5, .06)] if tex else [(SH[0], SH[1], .15)]
        m = union()
        for dx, dy, al in offs:
            c.save(); c.translate(dx, dy); c.set_source_rgba(0, 0, 0, al); c.mask(m); c.restore()
    if tex:
        rim = union(lambda p: jag(p, amp=2.6, seg=7))
        c.set_source_rgba(1, 1, .98, .92); c.mask(rim)
        r = random.Random(len(pieces) * 131 + int(color[0] * 1000))
        k = r.uniform(.955, 1.04)
        color = tuple(min(1, x * k) for x in color)
    m = union()
    c.set_source_rgba(*col(color)); c.mask(m)
    if tex:
        global GRAIN
        if GRAIN is None:
            GRAIN = _make_grain()
        c.save()
        c.set_operator(cairo.OPERATOR_SOFT_LIGHT)
        c.set_source(GRAIN)
        c.push_group(); c.set_source_rgba(1, 1, 1, .6); c.mask(m); mm = c.pop_group()
        c.set_source(GRAIN); c.mask(mm)
        c.restore()


def shape(c, pts, color, amp=2.2, shadow=True, a=1.0, seg=46):
    fillpts(c, jag(pts, amp, seg), color, a, shadow)


def rect(c, x, y, w, h, color, **k):
    shape(c, [(x, y), (x + w, y), (x + w, y + h), (x, y + h)], color, **k)


def rr_pts(x, y, w, h, r):
    r = max(1, min(r, w / 2, h / 2))
    pts = []
    for cx, cy, a0 in [(x + w - r, y + r, -90), (x + w - r, y + h - r, 0), (x + r, y + h - r, 90), (x + r, y + r, 180)]:
        for i in range(4):
            a = math.radians(a0 + i * 30)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def rrect(c, x, y, w, h, r, color, **k):
    shape(c, rr_pts(x, y, w, h, r), color, **k)


def ell_pts(cx, cy, rx, ry, a0=0, a1=360):
    per = math.pi * (rx + ry)
    full = (a1 - a0) >= 360
    n = max(9, int(per * (a1 - a0) / 360 / 24))
    rng_ = range(n) if full else range(n + 1)
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in rng_]


def ell(c, cx, cy, rx, ry, color, a0=0, a1=360, **k):
    shape(c, ell_pts(cx, cy, rx, ry, a0, a1), color, **k)


def stroke(c, pts, w, color, a=1.0):
    c.set_line_width(w)
    c.set_line_cap(cairo.LINE_CAP_ROUND)
    c.set_line_join(cairo.LINE_JOIN_ROUND)
    c.move_to(*pts[0])
    for p in pts[1:]:
        c.line_to(*p)
    c.set_source_rgba(*col(color, a))
    c.stroke()


def arcp(cx, cy, r, a0, a1, n=10, ry=None):
    ry = ry or r
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def tw(c, s, size, font='NunitoBlack'):
    c.select_font_face(font)
    c.set_font_size(size)
    return c.text_extents(s).x_advance


def txt(c, s, x, y, size, color, font='NunitoBlack', align='c', a=1.0):
    w = tw(c, s, size, font)
    xx = x - w / 2 if align == 'c' else (x if align == 'l' else x - w)
    c.move_to(xx, y + size * 0.36)
    c.set_source_rgba(*col(color, a))
    c.show_text(s)
    return w


def tag(c, cx, cy, lines, size, bg, fg, ang=0, sc=1.0, tape=True, font='NunitoBlack', pad=(34, 22)):
    if sc <= 0.02:
        return
    c.save()
    c.translate(cx, cy)
    c.rotate(math.radians(ang))
    c.scale(sc, sc)
    wmax = max(tw(c, l, size, font) for l in lines)
    lh = size * 1.22
    w = wmax + pad[0] * 2
    h = lh * len(lines) + pad[1] * 2 - size * 0.22
    rrect(c, -w / 2, -h / 2, w, h, 14, bg)
    y = -h / 2 + pad[1] + size * 0.5
    for l in lines:
        txt(c, l, 0, y, size, fg, font)
        y += lh
    if tape:
        for sx in (-1, 1):
            c.save()
            c.translate(sx * (w / 2 - 26), -h / 2 + 2)
            c.rotate(math.radians(-sx * 28))
            rect(c, -32, -13, 64, 26, P['paper'], a=0.78, shadow=False, amp=1.4)
            c.restore()
    c.restore()
    return w


def tag_w(c, lines, size, font='NunitoBlack', pad=34):
    return max(tw(c, l, size, font) for l in lines) + pad * 2


# ---------- backgrounds & props ----------
def cross(c, x, y, s, color, a=1.0):
    c.save()
    c.translate(x, y)
    c.rotate(math.radians(45))
    rect(c, -s, -s * .28, 2 * s, s * .56, color, shadow=False, amp=1, a=a)
    rect(c, -s * .28, -s, s * .56, 2 * s, color, shadow=False, amp=1, a=a)
    c.restore()


def wall(c, base, stripe, dot=None, dot_a=0.9):
    c.set_source_rgba(*col(base))
    c.paint()
    for i in range(-1, 9):
        rect(c, i * 140 + 35, -20, 64, H + 40, stripe, shadow=False, amp=3, seg=160)
    if dot:
        for i in range(8):
            for j in range(14):
                cross(c, 70 + i * 140 + (j % 2) * 70, 60 + j * 140, 12, dot, a=dot_a)
    if S.tex:
        grain(c, .45)


def gingham(c, x, y, w, h, base, stripe, sz=62):
    rect(c, x, y, w, h, base, amp=2, seg=120)
    c.save()
    c.rectangle(x - 10, y, w + 20, h + 10)
    c.clip()
    for i in range(int(w / sz) + 2):
        rect(c, x + i * sz * 2, y, sz, h + 20, stripe, a=0.42, shadow=False, amp=1.5, seg=300)
    for j in range(int(h / sz) + 2):
        rect(c, x - 10, y + 10 + j * sz * 2, w + 20, sz, stripe, a=0.42, shadow=False, amp=1.5, seg=300)
    c.restore()


def bunting(c, y0, cols, n=9, sag=36):
    stroke(c, [(x, y0 + sag * math.sin(math.pi * x / W)) for x in range(-10, W + 30, 40)], 4, P['ink'], a=0.55)
    for i in range(n):
        x = (i + 0.5) * W / n
        y = y0 + sag * math.sin(math.pi * x / W)
        shape(c, [(x - 46, y - 4), (x + 46, y - 4), (x, y + 78)], cols[i % len(cols)])


def clock(c, x, y, r, am, ah):
    ell(c, x, y, r + 14, r + 14, P['woodD'])
    ell(c, x, y, r, r, P['paper'], shadow=False)
    for i in range(12):
        a = math.radians(i * 30)
        ell(c, x + math.cos(a) * r * .8, y + math.sin(a) * r * .8, 4, 4, P['ink'], shadow=False, amp=.4)
    for ang, L, w in [(ah, r * .5, 9), (am, r * .76, 6)]:
        c.save()
        c.translate(x, y)
        c.rotate(ang)
        rect(c, -w / 2, -L, w, L + 8, P['ink'], shadow=False, amp=.8)
        c.restore()
    ell(c, x, y, 8, 8, P['coral'], shadow=False, amp=.5)


# ---------- characters ----------
def torso(c, p):
    kind = p.get('top', 'shirt')
    sc = p['shirt']
    pts = [(-160, 600), (-152, 250), (-138, 165), (-70, 122), (70, 122), (138, 165), (152, 250), (160, 600)]
    if kind == 'cape':
        pts = [(-235, 600), (-205, 300), (-125, 150), (-40, 118), (40, 118), (125, 150), (205, 300), (235, 600)]
    tp = jag(pts)
    fillpts(c, tp, sc)
    c.save()
    path(c, tp)
    c.clip()
    if kind == 'stripes':
        for i in range(-6, 7):
            rect(c, i * 40 - 8, 100, 16, 520, P['sky'], shadow=False, amp=1, seg=200)
    if kind == 'plaid':
        for i in range(-5, 6):
            rect(c, i * 56 - 10, 100, 20, 520, hx('5A1E1E'), a=.32, shadow=False, amp=1, seg=200)
        for j in range(7):
            rect(c, -180, 150 + j * 74, 360, 18, hx('5A1E1E'), a=.32, shadow=False, amp=1, seg=200)
    if kind == 'cardigan':
        shape(c, [(-46, 118), (46, 118), (30, 600), (-30, 600)], P['paper'], shadow=False)
        for j in range(4):
            ell(c, -40, 230 + j * 80, 7, 7, P['woodD'], shadow=False, amp=.4)
    c.restore()
    if kind in ('shirt', 'stripes', 'plaid'):
        shape(c, [(-40, 120), (0, 172), (40, 120)], p['skin'], shadow=False)
    if kind == 'coat':
        shape(c, [(-72, 122), (0, 240), (72, 122), (44, 122), (0, 200), (-44, 122)], P['teal2'])
        for j in range(3):
            ell(c, 0, 290 + j * 80, 8, 8, P['grayD'], shadow=False, amp=.4)
    if kind == 'cape':
        rrect(c, -60, 112, 120, 30, 12, P['paper'], amp=1)
    if p.get('apron'):
        rect(c, -96, 215, 192, 400, p['apron'])
        stroke(c, [(-82, 220), (-58, 128)], 11, p['apron'])
        stroke(c, [(82, 220), (58, 128)], 11, p['apron'])
        rect(c, -50, 300, 100, 70, P['paper'], a=.35, shadow=False, amp=1)


def face(c, expr, p):
    ey = -2
    if expr in ('happy', 'calm'):
        for sx in (-1, 1):
            stroke(c, arcp(sx * 38, ey + 8, 17, 200, 340, 8), 8, P['ink'])
    elif expr == 'stress':
        for sx in (-1, 1):
            ell(c, sx * 38, ey, 9, 12, P['ink'], shadow=False, amp=.5)
            stroke(c, [(sx * 18, ey - 36), (sx * 56, ey - 26)], 7, P['ink'])
    for sx in (-1, 1):
        ell(c, sx * 58, 32, 17, 11, P['cheek'], a=.85, shadow=False, amp=1)
    if expr == 'happy':
        ell(c, 0, 42, 30, 27, P['mouth'], 0, 180, shadow=False, amp=1)
        ell(c, 0, 58, 15, 7, P['tongue'], 0, 180, shadow=False, amp=.5)
    elif expr == 'calm':
        stroke(c, arcp(0, 30, 22, 25, 155, 8), 7, P['ink'])
    elif expr == 'stress':
        stroke(c, [(-24, 52), (-12, 45), (0, 52), (12, 45), (24, 52)], 6, P['ink'])
        shape(c, [(104, -52), (116, -28), (114, -16), (104, -10), (94, -16), (92, -28)], P['sky'], amp=1)


def person(c, x, y, s, p, expr='happy'):
    c.save()
    c.translate(x, y)
    c.scale(s, s)
    sk = p['skin']
    hs = p.get('hair')
    hc = p.get('hc', P['ink'])
    group_begin()
    if hs == 'bandana':
        for hx_, hy, r in [(-98, 20, 50), (98, 20, 50), (-84, 72, 42), (84, 72, 42), (-70, -50, 50), (70, -50, 50)]:
            ell(c, hx_, hy, r, r, hc)
    if hs == 'graybob':
        rrect(c, -116, -50, 232, 150, 60, hc)
    if hs == 'pony':
        ell(c, 98, -40, 34, 70, hc)
    if hs == 'buns':
        for sx in (-1, 1):
            ell(c, sx * 74, -98, 38, 38, hc)
    group_end(c, hc)
    if hs == 'buns':
        for sx in (-1, 1):
            ell(c, sx * 50, -80, 9, 9, P['mustard'], shadow=False, amp=.5)
    rect(c, -28, 60, 56, 80, sk, shadow=False)
    if p.get('mask'):
        pass
    torso(c, p)
    if p.get('mask'):
        rrect(c, -62, 100, 124, 44, 16, P['sky'], amp=1)
    for sx in (-1, 1):
        ell(c, sx * 92, 12, 18, 24, sk)
    ell(c, 0, 0, 95, 105, sk)
    # front hair
    if hs == 'bandana':
        group_begin()
        for hx_, hy in [(-86, -24), (86, -24)]:
            ell(c, hx_, hy, 26, 30, hc)
        group_end(c, hc)
        ell(c, 0, -32, 104, 86, P['red'], 180, 360)
        for dx, dy in [(-60, -60), (-20, -90), (25, -70), (65, -55), (-35, -45), (5, -50), (50, -95)]:
            ell(c, dx, dy, 7, 7, P['paper'], shadow=False, amp=.4)
        shape(c, [(52, -108), (96, -150), (100, -112)], P['red'])
        shape(c, [(52, -108), (30, -158), (78, -136)], P['red'])
    elif hs in ('curly', 'spiky', 'graybob', 'pony', 'buns'):
        group_begin()
    if hs == 'curly':
        ell(c, 0, -36, 100, 80, hc, 180, 360)
        for a in range(190, 352, 18):
            ell(c, 96 * math.cos(math.radians(a)), -36 + 80 * math.sin(math.radians(a)), 22, 22, hc, shadow=False)
    elif hs == 'spiky':
        ell(c, 0, -40, 98, 74, hc, 180, 360)
        for i in range(7):
            x0 = -84 + i * 26
            shape(c, [(x0 - 18, -96 + abs(i - 3) * 8), (x0 + 6, -150 + abs(i - 3) * 12), (x0 + 22, -96 + abs(i - 3) * 8)], hc, shadow=False)
    elif hs == 'graybob':
        ell(c, 0, -32, 106, 88, hc, 180, 360)
        ell(c, 0, -128, 40, 32, hc)
        rrect(c, -116, -44, 34, 120, 16, hc, shadow=False)
        rrect(c, 82, -44, 34, 120, 16, hc, shadow=False)
    elif hs == 'pony':
        ell(c, 0, -34, 101, 84, hc, 180, 360)
        shape(c, [(-100, -34), (-20, -110), (30, -60), (-92, 0)], hc, shadow=False)
    elif hs == 'buns':
        ell(c, 0, -34, 100, 82, hc, 180, 360)
        shape(c, [(-98, -34), (-30, -70), (-100, 30)], hc, shadow=False)
    if S.group is not None:
        group_end(c, hc)
    if p.get('beard'):
        bp = ell_pts(0, 6, 98, 112, 0, 180) + [(-62, 22), (-30, 26), (0, 18), (30, 26), (62, 22)]
        group_begin(); shape(c, bp, hc); group_end(c, hc)
    face(c, expr, p)
    g = p.get('glasses')
    if g == 'square':
        for sx in (-1, 1):
            c.save()
            path(c, rr_pts(sx * 38 - 30, -24, 60, 46, 12))
            c.set_line_width(6)
            c.set_source_rgba(*col(P['ink']))
            c.stroke()
            c.restore()
        stroke(c, [(-8, -6), (8, -6)], 6, P['ink'])
    if g == 'round':
        for sx in (-1, 1):
            stroke(c, arcp(sx * 38, 0, 27, 0, 360, 16), 5, P['woodD'])
        stroke(c, [(-11, -2), (11, -2)], 5, P['woodD'])
    if hs == 'bandana':
        for sx in (-1, 1):
            stroke(c, arcp(sx * 92, 50, 13, 0, 360, 12), 5, P['mustard'])
    if p.get('phones'):
        stroke(c, arcp(0, -6, 120, 195, 345, 12), 18, P['navy'])
        for sx in (-1, 1):
            rrect(c, sx * 118 - 20, -28, 40, 76, 18, P['navy'])
            rrect(c, sx * 118 - 9, -16, 18, 52, 9, P['mint'], shadow=False, amp=1)
    c.restore()


def arm(c, x0, y0, x1, y1, w, sleeve, skin, sf=0.62):
    L = math.hypot(x1 - x0, y1 - y0)
    a = math.atan2(y1 - y0, x1 - x0)
    c.save()
    c.translate(x0, y0)
    c.rotate(a)
    rrect(c, 0, -w / 2, L, w, w / 2, skin)
    rrect(c, -14, -w / 2 - 5, L * sf, w + 10, w / 2, sleeve)
    c.restore()


def hand(c, x, y, r, skin):
    ell(c, x, y, r, r * 1.1, skin)


# people
OWNER = dict(skin=SK[1], hair='bandana', hc=hx('2B1E1A'), shirt=P['paper'], top='stripes', apron=P['green'])
CLIENT = dict(skin=SK[2], hair='buns', hc=hx('6B3F2A'), shirt=hx('9FB9BE'), top='cape')
GUY = dict(skin=SK[3], hair='curly', hc=hx('1F1717'), shirt=P['shirtG'], phones=True)
DENT = dict(skin=SK[4], hair='pony', hc=hx('2A1D18'), shirt=P['paper'], top='coat', mask=True)
BARB = dict(skin=SK[5], hair='spiky', hc=hx('1C1414'), shirt=P['plaid'], top='plaid', beard=True, glasses='square')
ASES = dict(skin=SK[2], hair='graybob', hc=hx('CFCBC8'), shirt=P['mustard'], top='cardigan', glasses='round')


# ---------- devices / UI ----------
def phone(c, cx, cy, w, h, fn, t, ang=0):
    c.save()
    c.translate(cx, cy)
    c.rotate(math.radians(ang))
    rrect(c, -w / 2, -h / 2, w, h, w * .13, P['ink'])
    m = w * .05
    sx, sy, sw, sh = -w / 2 + m, -h / 2 + m * 1.5, w - 2 * m, h - m * 3
    rrect(c, sx, sy, sw, sh, w * .08, P['paper'], shadow=False, amp=1)
    c.save()
    path(c, rr_pts(sx, sy, sw, sh, w * .08))
    c.clip()
    S.clean = True
    fn(c, sx, sy, sw, sh, t)
    S.clean = False
    c.restore()
    rrect(c, -w * .12, -h / 2 + m * .4, w * .24, m * .7, m * .35, hx('1E1819'), shadow=False, amp=.5)
    c.restore()


def scr_ring(c, x, y, w, h, t):
    rect(c, x - 5, y - 5, w + 10, h + 10, P['coral'], shadow=False, amp=1)
    cx, cy = x + w / 2, y + h * .42
    ell(c, cx, cy, w * .2, w * .2, P['paper'], shadow=False)
    shape(c, [(cx - w * .09, cy - w * .06), (cx - w * .03, cy - w * .1), (cx + w * .01, cy - w * .03), (cx - w * .02, cy),
              (cx + w * .03, cy + w * .05), (cx + w * .06, cy + w * .02), (cx + w * .1, cy + w * .07), (cx + w * .05, cy + w * .1),
              (cx - w * .06, cy + w * .02)], P['coral'], shadow=False, amp=.6)
    ph = (S.boil % 3)
    for i in range(3):
        rr = w * (.26 + i * .08 + ph * .02)
        stroke(c, arcp(cx, cy, rr, -60, 60, 8), 7, P['paper'], a=.8 - i * .2)
        stroke(c, arcp(cx, cy, rr, 120, 240, 8), 7, P['paper'], a=.8 - i * .2)


AG_TIMES = ['9:00', '10:00', '11:00', '12:00', '13:00', '14:00']
AG_BLOCKS = [(0, 1, 'coral', 'Corte · Ana', 6.8), (1, 1.5, 'teal', 'Tinte · Lupita', 7.15),
             (3, 1, 'mustard', 'Peinado · Sofi', 7.5), (4, 1, 'mint', 'Manicura · Dani', 7.85)]


def scr_agenda(c, x, y, w, h, t):
    u = w / 100
    rect(c, x - 5, y - 5, w + 10, h * .15, P['teal'], shadow=False, amp=1)
    txt(c, 'Agenda de hoy', x + w / 2, y + h * .085, u * 8, P['white'])
    ry0, rh = y + h * .18, h * .135
    for i, tm in enumerate(AG_TIMES):
        yy = ry0 + i * rh
        txt(c, tm, x + u * 3, yy + rh * .2, u * 6, P['grayD'], 'NunitoBold', 'l')
        stroke(c, [(x + u * 23, yy), (x + w - u * 3, yy)], 2, P['gray'])
    for row, span, cc, lab, td in AG_BLOCKS:
        pr = prog(t, td, 0.35)
        if pr <= 0:
            continue
        yo = -(1 - eob(pr)) * h * .35
        bx, by = x + u * 24, ry0 + row * rh + rh * .08 + yo
        rrect(c, bx, by, u * 72, span * rh - rh * .16, 12, P[cc])
        fg = P['ink'] if cc in ('mustard', 'mint') else P['white']
        txt(c, lab, bx + u * 4, by + (span * rh - rh * .16) / 2, u * 7.2, fg, 'NunitoBlack', 'l')


def mini_cal(c, x, y, w, h):
    rect(c, x, y, w, h, P['paper'], shadow=False, amp=1)
    rect(c, x, y, w, h * .18, P['teal'], shadow=False, amp=1)
    cols = ['coral', 'teal2', 'mustard', 'mint']
    for i in range(4):
        rrect(c, x + w * .1 + (i % 2) * w * .1, y + h * (.26 + i * .18), w * (.62 - (i % 2) * .1), h * .13, 6, P[cols[i]], shadow=False, amp=1)


# booking flow layout (relative to screen)
BK_ROWS = ['Corte de cabello', 'Tinte', 'Peinado', 'Manicura']
BK_CHIPS = ['10:00', '11:30', '13:00', '16:00', '17:30', '18:30']
T_TAP1, T_CARD2, T_TAP2, T_TAP3, T_CARD3 = 10.45, 10.95, 11.65, 12.1, 12.3


def scr_book(c, x, y, w, h, t):
    u = w / 100
    rect(c, x - 5, y - 5, w + 10, h + 10, P['paper'], shadow=False, amp=1)
    txt(c, 'Elige un servicio', x + w / 2, y + h * .1, u * 7.5, P['ink'])
    for i, nm in enumerate(BK_ROWS):
        ry = y + h * (.18 + i * .14)
        sel = (i == 0 and t >= T_TAP1)
        rrect(c, x + u * 6, ry, u * 88, h * .11, 16, P['teal'] if sel else P['white'])
        txt(c, nm, x + u * 12, ry + h * .055, u * 6.4, P['white'] if sel else P['ink'], 'NunitoBlack', 'l')
    pr = eoc(prog(t, T_CARD2, .3))
    if pr > 0:
        ox = (1 - pr) * w * 1.05
        X = x + ox
        rect(c, X - 5, y - 5, w + 10, h + 10, P['paper'], amp=1)
        txt(c, '¿Con quién?', X + w / 2, y + h * .08, u * 7, P['ink'])
        for i, (nm, sk, hc) in enumerate([('Mariana', SK[1], hx('2B1E1A')), ('Luis', SK[3], hx('1F1717')), ('Sofi', SK[2], hx('6B3F2A'))]):
            ax = X + w * (.2 + i * .3)
            ay = y + h * .19
            if i == 0:
                ell(c, ax, ay, u * 11, u * 11, P['teal'], shadow=False)
            ell(c, ax, ay, u * 9, u * 9, sk, shadow=False)
            ell(c, ax, ay - u * 3.5, u * 9, u * 6, hc, 180, 360, shadow=False)
            for sx in (-1, 1):
                stroke(c, arcp(ax + sx * u * 3, ay + u * 1, u * 1.6, 200, 340, 5), 3, P['ink'])
            txt(c, nm, ax, ay + u * 15, u * 5, P['ink'], 'NunitoBold')
        txt(c, '¿A qué hora?', X + w / 2, y + h * .4, u * 7, P['ink'])
        for i, ch in enumerate(BK_CHIPS):
            cx_ = X + w * (.27 + (i % 2) * .46)
            cy_ = y + h * (.5 + (i // 2) * .1)
            sel = (i == 1 and t >= T_TAP2)
            rrect(c, cx_ - u * 19, cy_ - h * .037, u * 38, h * .074, 30, P['coral'] if sel else P['white'])
            txt(c, ch, cx_, cy_, u * 6.4, P['white'] if sel else P['ink'])
        bs = 0.93 if T_TAP3 <= t < T_TAP3 + .15 else 1
        c.save()
        c.translate(X + w / 2, y + h * .86)
        c.scale(bs, bs)
        rrect(c, -u * 40, -h * .045, u * 80, h * .09, 40, P['teal'])
        txt(c, 'Confirmar', 0, 0, u * 7, P['white'])
        c.restore()
    if t >= T_CARD3:
        rect(c, x - 5, y - 5, w + 10, h + 10, P['tealL'], amp=1)
        s = eob(prog(t, T_CARD3, .3), 2.4)
        cx_, cy_ = x + w / 2, y + h * .36
        c.save()
        c.translate(cx_, cy_)
        c.scale(max(s, .01), max(s, .01))
        ell(c, 0, 0, u * 24, u * 24, P['coral'])
        stroke(c, [(-u * 11, 0), (-u * 3, u * 9), (u * 12, -u * 9)], u * 5, P['white'])
        c.restore()
        a = prog(t, T_CARD3 + .15, .25)
        txt(c, '¡Cita confirmada!', x + w / 2, y + h * .6, u * 8.2, P['ink'], a=a)
        txt(c, 'Corte de cabello', x + w / 2, y + h * .68, u * 6, P['teal'], 'NunitoBold', a=a)
        txt(c, 'con Mariana · 11:30', x + w / 2, y + h * .74, u * 6, P['teal'], 'NunitoBold', a=a)


def finger(c, fx, fy, press, skin, sleeve):
    c.save()
    c.translate(fx, fy)
    s = .92 if press else 1
    c.scale(s, s)
    c.rotate(math.radians(-14))
    rect(c, -55, 250, 190, 400, sleeve)
    rrect(c, -48, 95, 150, 190, 60, skin)
    rrect(c, -22, -10, 46, 160, 23, skin)
    rrect(c, 40, 80, 40, 90, 20, skin, shadow=False)
    rrect(c, -14, -2, 30, 34, 12, hx('F2D5C8'), shadow=False, amp=.5, a=.6)
    c.restore()


def ripple(c, x, y, t, t0):
    p = prog(t, t0, .35)
    if 0 < p < 1:
        stroke(c, arcp(x, y, 30 + 60 * p, 0, 360, 18), 8, P['coral'], a=1 - p)




def begin_frame(fi, textura=True, desat=0.0):
    """Llamar al inicio de cada cuadro: fija el boil (cada BOIL cuadros), la textura y la desaturación."""
    S.boil = fi // BOIL
    S.k = 0
    S.tex = textura
    S.desat = desat
    S.clean = False


# ---------- isotipo papercut ----------
import json as _json
ISO = [[[162.405, 37.465], [159.02985595486044, 38.470446094444675], [155.67181263731123, 39.55689246155284], [152.20206909045825, 40.16075170914502], [148.7407759265236, 40.85110688881717], [145.2237152849975, 41.14105138860012], [141.70995534492926, 41.47480535860848], [138.2014516993058, 41.861941932027754], [134.67113415855442, 41.874999999999986], [131.14055556082462, 41.874999999999986], [127.60997696309482, 41.874999999999986], [124.07939836536505, 41.874999999999986], [120.54881976763525, 41.874999999999986], [117.01824116990547, 41.874999999999986], [113.48766257217568, 41.874999999999986], [109.95708397444588, 41.874999999999986], [106.42650537671611, 41.874999999999986], [102.89592677898631, 41.874999999999986], [99.36595517441675, 41.85536179302332], [95.83926539452524, 42.0], [92.31138664522753, 42.08008906838178], [88.80117166659842, 42.41976566668033], [85.32522864104244, 43.0139817087166], [81.88256086845215, 43.7728829568334], [78.41905383452922, 44.40766492633182], [75.06189705643399, 45.49766882419849], [71.71577238831541, 46.61506014914123], [68.56362425579103, 48.20191538698868], [65.39475202943068, 49.755519025873284], [62.32142880355126, 51.48142841358516], [59.43507361907394, 53.511552883792675], [56.594663442468175, 55.60548270832673], [54.00077061368987, 57.999229386310134], [51.50427454572307, 60.49572545427693], [49.0850364526738, 63.06543279443596], [47.02790955398809, 65.9329538218936], [45.07554393686049, 68.8742000928522], [43.28781489156552, 71.91080230923855], [41.69401661111352, 75.0590531565602], [41.76812751122979, 76.88996432969338], [43.83636237647882, 74.03236514822542], [46.33085659596045, 71.53884619555481], [49.07624247478426, 69.32205571916397], [52.01582179861569, 67.37177266471984], [55.15451973207825, 65.75846895003617], [58.32211174912619, 64.20403977031457], [61.65837049823084, 63.05165180070767], [65.00874715710555, 61.96290068229467], [68.43151497210582, 61.101436406694624], [71.9041693886791, 60.482999346717015], [75.36603297453104, 59.81607604305627], [78.87894308858004, 59.494211382284], [82.3642925617049, 58.985428297531776], [85.89111498047326, 58.848710801562135], [89.41325802293804, 58.62499999999999], [92.943136900444, 58.66000000000001], [96.46107887006633, 58.386556845197354], [99.99142642327304, 58.37500000000001], [103.52200502100283, 58.37500000000001], [107.0525836187326, 58.37500000000001], [110.58316221646238, 58.37500000000001], [114.11374081419217, 58.37500000000001], [117.64431941192198, 58.37500000000001], [121.17087797441182, 58.28449464307059], [124.6860826862278, 57.97255669255087], [128.2038945468542, 57.69868843625168], [131.66441386333238, 57.045540672800236], [135.13822322263152, 56.432355355473696], [138.54117278298978, 55.50182470944328], [141.8915195459375, 54.389713745299986], [145.2252241525923, 53.23090137285941], [148.37535191575793, 51.639831080436196], [151.43019519425982, 49.87967507567374], [154.36238248680752, 47.913579908970895], [157.0713451585737, 45.65436245411222], [159.56374081680374, 43.15483998090491], [161.61690028832015, 40.28609329949969]], [[136.86999999999998, 86.42499999999995], [133.44073957793543, 87.23396333506065], [130.00372428507202, 88.10910617158271], [126.51760460132921, 88.76218326378734], [122.99984876414868, 89.2000241977362], [119.47768038687735, 89.61767835357473], [115.9439513239556, 89.875], [112.39622949792286, 89.875], [108.84850767189012, 89.875], [105.30078584585738, 89.875], [101.75306401982463, 89.875], [98.20534219379189, 89.875], [94.65762036775915, 89.875], [91.11039834188625, 89.85000000000002], [87.56651937243134, 89.99233922510271], [84.02815785963676, 90.19549474245811], [80.5051575781133, 90.6043810906264], [77.02725083999592, 91.29563986560062], [73.56436103883193, 92.04697890912706], [70.17374563321141, 93.08440139737232], [66.85146665232287, 94.3172373407921], [63.6751357251437, 95.89392942292525], [60.53464787335093, 97.53921127598946], [57.62065703519416, 99.55830065325246], [54.781968859269845, 101.68570366695492], [52.090049406169776, 103.98995059383023], [49.68211267537575, 106.59419014161848], [47.528337129719894, 109.4088482348127], [45.560094433827324, 112.3601552443716], [43.749389255392266, 115.40752238459945], [42.187471106349896, 118.59140171855789], [40.85179445277097, 121.86939233509077], [39.725439572525886, 125.2330013358566], [38.86638160825166, 128.6675574742136], [38.01717038218826, 132.10691348176442], [37.37079174112471, 135.58880161797055], [38.86441416464108, 134.4237057354966], [40.112884670444934, 131.10528832388763], [41.715749728855336, 127.94875045190776], [43.59861796327389, 124.94320887753838], [45.73199611503718, 122.11071891067003], [48.19300525522022, 119.55699474477977], [50.722663853422716, 117.07014925485112], [53.561011972429135, 114.94851185874818], [56.562194734535204, 113.05925329091549], [59.61973407244512, 111.27231700812416], [62.93859845968919, 110.03210455451189], [66.22269855675914, 108.69873646183707], [69.65835177571755, 107.81832964485652], [73.10431881306957, 106.98330898990893], [76.61358057941263, 106.46637033047045], [80.13905018971477, 106.07387598482282], [83.68002773860884, 105.875], [87.22774956464157, 105.875], [90.77547139067431, 105.875], [94.32126763771434, 105.81429858898285], [97.85779674964002, 105.54637626002882], [101.39652080410166, 105.35827833567187], [104.91937783131146, 104.95144977349503], [108.43202405430998, 104.47859518913799], [111.90564090318465, 103.7626461832357], [115.34377320167798, 102.89124535966442], [118.68050424878395, 101.72613779063238], [121.92976612049209, 100.31261693975397], [124.99251958441792, 98.529189032726], [127.96965268789957, 96.60927784968034], [130.63627309094852, 94.27007967996532], [133.2510036309713, 91.87399636902872], [135.6190778589308, 89.23324064413]], [[76.5, 134.05999999999997], [73.02994710741024, 134.47901057851794], [69.62562114922278, 135.28982607821763], [66.27251627184687, 136.297794793009], [62.97897568591638, 137.48672778050678], [59.75854509042224, 138.85055655298044], [56.69512534941845, 140.53731476239545], [53.78046560978869, 142.48050200973523], [50.98434911112275, 144.58689467554672], [48.311413935447405, 146.84858606455262], [45.903488278119404, 149.38938965235076], [43.738122728914654, 152.14062798827018], [41.65839551509669, 154.9582418895637], [39.95659229181807, 158.01616866958065], [38.669617124342075, 161.26682148643104], [37.47212175415378, 164.5558695182694], [36.68998351348, 167.96885304075002], [36.20067598739737, 171.43027385506974], [39.045534019004, 172.62682136076015], [42.53759416501284, 172.4574811669974], [45.94570627074679, 171.6630304950207], [49.13120209088055, 170.24443341899098], [51.975576468354106, 168.21246029588633], [54.33385392571336, 165.64139128571566], [56.058540846025075, 162.59895991149025], [57.29081540805452, 159.32557684982962], [58.12019298562084, 155.92788219421135], [59.10740741078897, 152.57060184128449], [60.413488199996415, 149.32161772728088], [62.137485954618256, 146.2757559490908], [64.17912823274945, 143.43280882642108], [66.61326974088564, 140.91579183838522], [69.26641929477769, 138.63383487955116], [72.24579292703407, 136.80201939502362], [75.44986110847012, 135.3967245381375]]]
_xs = [p[0] for pc in ISO for p in pc]; _ys = [p[1] for pc in ISO for p in pc]
ISO_C = ((min(_xs) + max(_xs)) / 2, (min(_ys) + max(_ys)) / 2)
ISO_SZ = max(max(_xs) - min(_xs), max(_ys) - min(_ys))
ISO_COL = hx('0091AE')


def isotipo(c, x, y, size, t=None, t0=0.0, step=0.18):
    """Dibuja el isotipo en papel recortado. Si t se da, las piezas entran una por una."""
    k = size / ISO_SZ
    c.save()
    c.translate(x, y)
    for i, pc in enumerate(ISO):
        s, oy, rot = 1, 0, 0
        if t is not None:
            p = prog(t, t0 + i * step, .32)
            if p <= 0:
                continue
            e = eob(p, 2)
            s, oy, rot = e, (1 - eoc(p)) * -260, (1 - e) * -25
        pts = [((px - ISO_C[0]) * k, (py - ISO_C[1]) * k) for px, py in pc]
        cx_ = sum(p[0] for p in pts) / len(pts); cy_ = sum(p[1] for p in pts) / len(pts)
        c.save()
        c.translate(cx_, cy_ + oy)
        c.rotate(math.radians(rot + [-1.5, 1, -2][i]))
        c.scale(s, s)
        local = [(px - cx_, py - cy_) for px, py in pts]
        jp = jag(local, amp=max(0.8, size / 520), seg=10 ** 6)
        sh = size / 160
        c.save(); c.translate(sh * 1.6, sh * 2.2); path(c, jp); c.set_source_rgba(0, 0, 0, .16); c.fill(); c.restore()
        c.save(); c.translate(sh * .55, sh * .75); path(c, jp); c.set_source_rgba(*col(hx('006E84'))); c.fill(); c.restore()
        path(c, jp); c.set_source_rgba(*col(ISO_COL)); c.fill()
        if S.tex:
            c.save(); path(c, jp); c.clip(); grain(c, .5); c.restore()
        c.restore()
    c.restore()


