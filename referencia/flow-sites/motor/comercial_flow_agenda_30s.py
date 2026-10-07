import cairo, math, random, os, sys

W, H = 1080, 1920
FPS = 12
DUR = 30.0
NF = int(FPS * DUR)
BOIL = 3
OUT = '/home/claude/flow/frames'


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
)
SK = [hx('8A5A3F'), hx('C68E68'), hx('E8B996'), hx('6B4330'), hx('D9A27C'), hx('A8704E')]


class St:
    boil = 0
    k = 0
    desat = 0.0
    tex = False
    clean = False


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
        for hx_, hy in [(-86, -24), (86, -24)]:
            ell(c, hx_, hy, 26, 30, hc)
        ell(c, 0, -32, 104, 86, P['red'], 180, 360)
        for dx, dy in [(-60, -60), (-20, -90), (25, -70), (65, -55), (-35, -45), (5, -50), (50, -95)]:
            ell(c, dx, dy, 7, 7, P['paper'], shadow=False, amp=.4)
        shape(c, [(52, -108), (96, -150), (100, -112)], P['red'])
        shape(c, [(52, -108), (30, -158), (78, -136)], P['red'])
    elif hs == 'curly':
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
    if p.get('beard'):
        bp = ell_pts(0, 6, 98, 112, 0, 180) + [(-62, 22), (-30, 26), (0, 18), (30, 26), (62, 22)]
        shape(c, bp, hc)
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


# ---------- scenes ----------
def scene1(c, t, fi):
    S.desat = 0.55
    z = 1 + 0.12 * eoc(prog(t, 1.2, 1.8))
    c.save()
    c.translate(540, 1150)
    c.scale(z, z)
    c.translate(-540, -1150)
    wall(c, P['pink'], P['pink2'], P['paper'], .7)
    clock(c, 180, 250, 82, t * 9, t * .9)
    rect(c, 50, 470, 300, 24, P['wood'])
    for i, cc in enumerate(['mint', 'coral', 'teal2', 'mustard']):
        rrect(c, 75 + i * 68, 470 - 70 - (i % 2) * 20, 46, 70 + (i % 2) * 20, 10, P[cc])
    rrect(c, 560, 300, 420, 600, 200, P['woodD'])
    rrect(c, 588, 328, 364, 544, 180, P['sky'])
    rect(c, 640, 400, 30, 300, P['paper'], a=.45, shadow=False, amp=1)
    person(c, 760, 790, .95, CLIENT, 'calm')
    person(c, 320, 650, 1.0, OWNER, 'stress')
    hx_, hy_ = 640, 700
    arm(c, 450, 800, hx_, hy_, 62, P['paper'], OWNER['skin'])
    # scissors
    op = 14 if (fi // 2) % 2 == 0 else 2
    c.save()
    c.translate(hx_ + 10, hy_ - 20)
    for sgn in (-1, 1):
        c.save()
        c.rotate(math.radians(-60 + sgn * op))
        shape(c, [(0, -6), (95, 0), (0, 6)], P['grayD'], amp=1)
        stroke(c, arcp(-22, sgn * 14, 14, 0, 360, 12), 7, P['coral'])
        c.restore()
    c.restore()
    hand(c, hx_, hy_, 34, OWNER['skin'])
    # table
    gingham(c, -20, 1060, W + 40, H - 1000, P['paper'], P['pink2'])
    # notebook
    c.save()
    c.translate(330, 1280)
    c.rotate(math.radians(-6))
    rrect(c, -240, -170, 480, 340, 16, P['coralD'])
    for px in (-222, 4):
        rect(c, px, -152, 218, 304, P['paper'])
        for j in range(6):
            stroke(c, [(px + 16, -110 + j * 46), (px + 202, -110 + j * 46)], 2, P['gray'])
    entries = [(-206, -128, '10:00 Ana'), (-206, -82, '10:00 Paty'), (-206, -36, '11:30 Lupe'), (-206, 10, '¿12:00?'),
               (20, -128, '9:30 Dani'), (20, -82, '9:30 Mary'), (20, -36, '13:00 ¿?'), (20, 10, '13:00 Sofi')]
    for ex, ey, s in entries:
        txt(c, s, ex, ey, 28, P['ink'], 'NunitoBold', 'l')
    for (x0, y0, x1, y1) in [(-210, -82, -60, -76), (-210, 10, -110, 4), (16, -82, 170, -88), (16, -36, 140, -30)]:
        stroke(c, [(x0, y0), ((x0 + x1) / 2, y0 - 8), (x1, y1)], 6, P['red'])
    for (sx_, sy_) in [(-120, 70), (110, 80), (150, -120)]:
        stroke(c, [(sx_ - 22, sy_ - 22), (sx_ + 22, sy_ + 22)], 7, P['red'])
        stroke(c, [(sx_ + 22, sy_ - 22), (sx_ - 22, sy_ + 22)], 7, P['red'])
    stroke(c, [(-200, 120), (-160, 104), (-120, 126), (-80, 102), (-40, 124)], 6, P['red'])
    c.restore()
    # phone jumping
    jx = math.sin(fi * 2.3) * 10
    jy = -abs(math.sin(fi * 1.7)) * 26
    ja = -8 + math.sin(fi * 2.9) * 9
    for i in range(2):
        a_ = 1 if (fi % 2) == 0 else .4
        stroke(c, [(690 - i * 22, 1180 + i * 20), (670 - i * 22, 1220 + i * 20)], 7, P['ink'], a=a_)
        stroke(c, [(950 + i * 22, 1180 + i * 20), (970 + i * 22, 1220 + i * 20)], 7, P['ink'], a=a_)
    phone(c, 820 + jx, 1270 + jy, 210, 390, scr_ring, t, ja)
    cnt = min(9, 2 + int(max(0, t - 1) * 1.8))
    ell(c, 912 + jx, 1085 + jy, 30, 30, P['red'])
    txt(c, str(cnt), 912 + jx, 1085 + jy, 34, P['white'])
    # bubbles
    bpos = [(690, 990), (900, 950), (760, 900), (960, 860), (700, 820), (880, 790)]
    for i, (bx, by) in enumerate(bpos):
        p = prog(t, 3.3 + i * .28, .25)
        if p <= 0:
            continue
        s = eob(p, 2)
        c.save()
        c.translate(bx, by)
        c.scale(s, s)
        rrect(c, -80, -36, 160, 72, 30, P['white'])
        shape(c, [(-40, 30), (-62, 58), (-14, 34)], P['white'], shadow=False)
        for d in range(3):
            ell(c, -34 + d * 34, 0, 10, 10, P['grayD'], shadow=False, amp=.5)
        c.restore()
    c.restore()
    S.desat = 0
    tag(c, 520, 175, ['Citas perdidas.'], 64, P['coral'], P['white'], ang=-3, sc=eob(prog(t, 3.6, .3), 2))
    tag(c, 580, 300, ['Horarios encimados.'], 64, P['coral'], P['white'], ang=2.5, sc=eob(prog(t, 4.1, .3), 2))


def scene2(c, t, fi):
    wall(c, P['pink'], P['pink2'], P['paper'])
    bunting(c, -6, [P['coral'], P['mustard'], P['teal2'], P['mint'], P['sky']])
    clock(c, 150, 330, 70, (t - 5.4) * 1.2 + 1, .4)
    rrect(c, 820, 230, 200, 160, 10, P['woodD'])
    rect(c, 840, 250, 160, 120, P['sky'], shadow=False)
    for i, sk in enumerate([SK[1], SK[3], SK[2]]):
        ell(c, 870 + i * 50, 320, 20, 22, sk, shadow=False, amp=1)
    person(c, 540, 470, 1.3, OWNER, 'happy')
    arm(c, 365, 700, 318, 1215, 78, P['paper'], OWNER['skin'], .5)
    arm(c, 715, 700, 762, 1215, 78, P['paper'], OWNER['skin'], .5)
    phone(c, 540, 1050, 470, 820, scr_agenda, t, -2)
    hand(c, 310, 1210, 44, OWNER['skin'])
    hand(c, 770, 1200, 44, OWNER['skin'])
    tag(c, 540, 1478, ['Reservas en línea 24/7'], 60, P['teal'], P['white'], ang=-2, sc=eob(prog(t, 8.6, .3), 2))


def scene3(c, t, fi):
    wall(c, P['mintL'], hx('CBE8DC'), P['paper'])
    person(c, 540, 250, 1.0, GUY, 'happy')
    PX, PY, PW, PH = 540, 960, 600, 1000
    arm(c, 402, 420, 262, 1150, 74, P['shirtG'], GUY['skin'], .45)
    phone(c, PX, PY, PW, PH, scr_book, t)
    hand(c, 255, 1150, 46, GUY['skin'])
    m = PW * .05
    sx, sy, sw, sh = PX - PW / 2 + m, PY - PH / 2 + m * 1.5, PW - 2 * m, PH - m * 3
    targets = [
        (10.0, sx + sw * .9, PY + PH * .9),
        (10.3, sx + sw * .72, sy + sh * .235),
        (10.6, sx + sw * .72, sy + sh * .235),
        (11.45, sx + sw * .73, sy + sh * .5),
        (11.75, sx + sw * .73, sy + sh * .5),
        (11.98, sx + sw * .55, sy + sh * .86),
        (12.25, sx + sw * .55, sy + sh * .86),
        (12.7, sx + sw * 1.0, PY + PH * 1.1),
    ]
    if targets[0][0] <= t <= targets[-1][0]:
        for (t0, x0, y0), (t1, x1, y1) in zip(targets, targets[1:]):
            if t0 <= t <= t1:
                e = eoc((t - t0) / (t1 - t0))
                fx, fy = x0 + (x1 - x0) * e, y0 + (y1 - y0) * e
                break
        press = any(tp <= t < tp + .15 for tp in (T_TAP1, T_TAP2, T_TAP3))
        finger(c, fx, fy, press, hx('C68E68'), P['coral'])
    for tp, (rx, ry) in [(T_TAP1, (sx + sw * .72, sy + sh * .235)), (T_TAP2, (sx + sw * .73, sy + sh * .5)), (T_TAP3, (sx + sw * .55, sy + sh * .86))]:
        ripple(c, rx, ry, t, tp)
    # chain tags
    labs = [('Servicio', P['paper'], P['teal'], 13.1), ('Horario', P['paper'], P['teal'], 13.45), ('Confirmado', P['coral'], P['white'], 13.8)]
    sz = 46
    ws = [tag_w(c, [l], sz) for l, *_ in labs]
    gap = 70
    tot = sum(ws) + gap * 2
    x = 540 - tot / 2
    for i, (l, bg, fg, t0) in enumerate(labs):
        cx_ = x + ws[i] / 2
        tag(c, cx_, 1478, [l], sz, bg, fg, ang=(-2 + i * 2), sc=eob(prog(t, t0, .28), 2), tape=False)
        if i > 0:
            pa = eob(prog(t, t0 - .05, .25), 2)
            if pa > .02:
                ax = x - gap / 2
                c.save()
                c.translate(ax, 1478)
                c.scale(pa, pa)
                shape(c, [(-24, -9), (4, -9), (4, -22), (28, 0), (4, 22), (4, 9), (-24, 9)], P['teal'], amp=1)
                c.restore()
        x += ws[i] + gap


def frame_box(c, x, y, w, h, inner):
    rrect(c, x, y, w, h, 22, P['woodD'])
    rrect(c, x + 20, y + 20, w - 40, h - 40, 14, inner, shadow=False)


def scene4(c, t, fi):
    wall(c, P['cream'], hx('F3E6D3'), P['pink2'], .8)
    FX, FW, FH = 60, 960, 400
    ys = [150, 600, 1050]
    starts = [15.1, 16.5, 18.4]
    inners = [P['sky'], P['yellowL'], P['coralL']]
    for k in range(3):
        p = prog(t, starts[k], .32)
        if p <= 0:
            continue
        e = eob(p, 1.4)
        dirx = -1 if k != 1 else 1
        ox = (1 - e) * 1100 * dirx
        x, y = FX + ox, ys[k]
        c.save()
        c.translate(x + FW / 2, y + FH / 2)
        c.rotate(math.radians([-1.5, 1.2, -1][k]))
        c.translate(-FW / 2, -FH / 2)
        frame_box(c, 0, 0, FW, FH, inners[k])
        c.save()
        path(c, rr_pts(20, 20, FW - 40, FH - 40, 14))
        c.clip()
        if k == 0:
            tc = (FW - 170, 120)
            shape(c, [(tc[0] - 50, tc[1] - 40), (tc[0] - 20, tc[1] - 55), (tc[0], tc[1] - 40), (tc[0] + 20, tc[1] - 55), (tc[0] + 50, tc[1] - 40),
                      (tc[0] + 40, tc[1] + 10), (tc[0] + 28, tc[1] + 60), (tc[0] + 10, tc[1] + 20), (tc[0] - 10, tc[1] + 20), (tc[0] - 28, tc[1] + 60), (tc[0] - 40, tc[1] + 10)], P['white'])
            person(c, 260, 190, .8, DENT, 'happy')
            c.save()
            c.translate(270, 330)
            rrect(c, -150, -100, 300, 200, 22, P['ink'])
            mini_cal(c, -132, -84, 264, 168)
            c.restore()
            hand(c, 128, 360, 30, DENT['skin'])
            hand(c, 412, 360, 30, DENT['skin'])
        if k == 1:
            for i in range(5):
                rect(c, 120, 60 + i * 60, 46, 30, P['red'] if i % 2 == 0 else P['paper'], amp=1)
            rrect(c, 110, 40, 66, 20, 8, P['grayD'])
            rrect(c, 110, 350, 66, 20, 8, P['grayD'])
            c.save()
            c.translate(300, 120)
            c.rotate(math.radians(20))
            for sgn in (-1, 1):
                c.save()
                c.rotate(math.radians(sgn * 12))
                shape(c, [(0, -6), (110, 0), (0, 6)], P['grayD'], amp=1)
                stroke(c, arcp(-24, sgn * 14, 15, 0, 360, 12), 7, P['ink'])
                c.restore()
            c.restore()
            person(c, FW - 280, 190, .8, BARB, 'happy')
            phone(c, FW - 470, 300, 150, 270, lambda cc, X, Y, Ww, Hh, tt: mini_cal(cc, X, Y, Ww, Hh), t, 8)
            hand(c, FW - 440, 380, 30, BARB['skin'])
        if k == 2:
            rrect(c, FW - 250, 70, 150, 110, 10, P['mustard'])
            rect(c, FW - 235, 50, 120, 40, P['paper'])
            rect(c, FW - 225, 40, 120, 30, P['white'])
            person(c, 230, 190, .8, ASES, 'happy')
            c.save()
            c.translate(340, 300)
            rrect(c, -150, -100, 300, 190, 14, P['ink'])
            mini_cal(c, -134, -86, 268, 160)
            shape(c, [(-190, 90), (190, 90), (215, 125), (-215, 125)], P['grayD'])
            c.restore()
        c.restore()
        c.restore()
    banners = [('Sin doble reserva', P['coral'], P['white'], (FW - 120, ys[0] + FH - 18), -3),
               ('Tu página de reservas', P['teal'], P['white'], (FX + 330, ys[1] + FH - 18), 2),
               ('Tu equipo organizado', P['mustard'], P['ink'], (FW - 150, ys[2] + FH - 18), -2)]
    for k, (l, bg, fg, (bx, by), ang) in enumerate(banners):
        tag(c, bx, by, [l], 50, bg, fg, ang=ang, sc=eob(prog(t, starts[k] + .28, .28), 2))


def mascot(c, x, y, s):
    c.save()
    c.translate(x, y)
    c.scale(s, s)
    rrect(c, -150, -130, 300, 270, 44, P['teal'])
    rrect(c, -150, -130, 300, 70, 30, P['coral'], shadow=False)
    for sx in (-1, 1):
        rrect(c, sx * 75 - 14, -168, 28, 66, 14, P['mustard'])
    rrect(c, -116, -44, 232, 156, 20, P['paper'], shadow=False)
    for sx in (-1, 1):
        stroke(c, arcp(sx * 42, 22, 15, 200, 340, 8), 8, P['ink'])
        ell(c, sx * 72, 52, 15, 9, P['cheek'], a=.9, shadow=False, amp=.6)
    ell(c, 0, 50, 24, 22, P['mouth'], 0, 180, shadow=False, amp=.6)
    c.restore()


CONF = []
_r = random.Random(7)
for i in range(80):
    CONF.append(dict(x=_r.uniform(0, W), d=_r.uniform(0, 1.8), v=_r.uniform(380, 640), rot=_r.uniform(0, 6.28), vr=_r.uniform(-5, 5),
                     cc=_r.choice(['coral', 'teal', 'mustard', 'mint', 'sky', 'teal2']), sh=_r.choice(['r', 't', 'c']), sz=_r.uniform(14, 26)))


def scene5(c, t, fi):
    wall(c, P['cream'], hx('F6ECDC'), P['pink2'], .6)
    isotipo(c, 540, 500, 360, t=t, t0=20.62, step=.14)
    pw = prog(t, 21.05, .3)
    oy = (1 - eob(pw, 2)) * 60
    if pw <= 0:
        oy = 5000
    # wordmark
    c.save()
    c.translate(540, 830 + oy)
    ww = tw(c, 'Flow Agenda', 150)
    s = min(1, 940 / ww)
    c.scale(s, s)
    c.save()
    c.translate(5, 7)
    txt(c, 'Flow Agenda', 0, 0, 150, (0, 0, 0), a=.12)
    c.restore()
    txt(c, 'Flow Agenda', 0, 0, 150, P['teal'])
    c.restore()
    tag(c, 540, 1060, ['Desde $299 al mes', '30 días de prueba'], 60, P['coral'], P['white'], ang=-2, sc=eob(prog(t, 21.8, .3), 2))
    tag(c, 540, 1260, ['flow.dydasoftware.com/agenda'], 44, P['white'], P['teal'], ang=1.5, sc=eob(prog(t, 23.5, .3), 2))
    # peeking characters
    for who, x0, s_, t0, base in [(OWNER, 200, .72, 25.9, 1610), (BARB, 880, .72, 26.2, 1620), (GUY, 540, .66, 26.5, 1700)]:
        pp = eoc(prog(t, t0, .4))
        if pp <= 0:
            continue
        y = 2120 - (2120 - base) * pp
        sgn = 1 if x0 < 540 else -1
        if x0 == 540:
            sgn = 1
        wave = math.sin(t * 9) * 0.35
        shx, shy = x0 + sgn * 120 * s_, y + 160 * s_
        hxp = shx + sgn * 90 * s_ + math.sin(wave) * 80 * s_
        hyp = y - 150 * s_
        arm(c, shx, shy, hxp, hyp, 60 * s_, who['shirt'], who['skin'], .45)
        person(c, x0, y, s_, who, 'happy')
        hand(c, hxp, hyp, 34 * s_, who['skin'])
    # confetti
    if t >= 25.6:
        for q in CONF:
            tt = t - 25.6 - q['d']
            if tt < 0:
                continue
            y = -60 + tt * q['v']
            if y > H + 60:
                continue
            x = q['x'] + math.sin(tt * 2 + q['rot']) * 30
            c.save()
            c.translate(x, y)
            c.rotate(q['rot'] + tt * q['vr'])
            z = q['sz']
            if q['sh'] == 'r':
                rect(c, -z / 2, -z * .3, z, z * .6, P[q['cc']], amp=1)
            elif q['sh'] == 't':
                shape(c, [(-z / 2, z / 2), (z / 2, z / 2), (0, -z / 2)], P[q['cc']], amp=1)
            else:
                ell(c, 0, 0, z * .4, z * .4, P[q['cc']], amp=.6)
            c.restore()


# ---------- subtitles ----------
SUBS = [(1.2, 2.95, '¿Tu agenda vive en una libreta…'), (3.27, 5.25, '…y en mil mensajes sin contestar?'),
        (5.66, 6.62, 'Con Flow Agenda,'), (6.76, 8.34, 'tus clientes reservan solos,'), (8.58, 9.5, 'a cualquier hora.'),
        (9.81, 12.06, 'Eligen el servicio, el horario…'), (12.33, 12.86, 'y listo.'), (13.09, 14.9, 'Sin llamadas, sin esperas.'),
        (15.1, 16.32, 'Sin citas dobles.'), (16.53, 18.3, 'Con tu propia página'), (18.41, 20.44, 'y todo tu día en un solo lugar.'),
        (20.72, 21.6, 'Flow Agenda.'), (21.83, 23.4, 'Pruébalo 30 días gratis.')]
SUBS2 = []
for i, (a, b, s) in enumerate(SUBS):
    nxt = SUBS[i + 1][0] if i + 1 < len(SUBS) else 99
    if nxt - b < 0.5:
        b = nxt - 0.02
    SUBS2.append((a, b, s))


def subtitles(c, t):
    for a, b, s in SUBS2:
        if a <= t < b:
            size = 50
            w = tw(c, s, size, 'NunitoBold')
            lines = [s]
            if w > 900:
                words = s.split(' ')
                best = None
                for k in range(1, len(words)):
                    l1, l2 = ' '.join(words[:k]), ' '.join(words[k:])
                    m = max(tw(c, l1, size, 'NunitoBold'), tw(c, l2, size, 'NunitoBold'))
                    if best is None or m < best[0]:
                        best = (m, [l1, l2])
                lines = best[1]
            tag(c, 540, 1610, lines, size, P['paper'], P['ink'], tape=False, font='NunitoBold', pad=(30, 16))


def render(fi):
    t = fi / FPS
    S.boil = fi // BOIL
    S.k = 0
    S.desat = 0
    surf = cairo.ImageSurface(cairo.FORMAT_RGB24, W, H)
    c = cairo.Context(surf)
    if t < 5.4:
        scene1(c, t, fi)
    elif t < 9.6:
        scene2(c, t, fi)
    elif t < 15.0:
        scene3(c, t, fi)
    elif t < 20.6:
        scene4(c, t, fi)
    else:
        scene5(c, t, fi)
    S.desat = 0
    subtitles(c, t)
    surf.write_to_png(f'{OUT}/f{fi:04d}.png')


# ---------- isotipo papercut ----------
import json as _json
ISO = _json.load(open('/home/claude/flow/iso.json'))
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


START = os.environ.get('START')
S.tex = os.environ.get('TEX') == '1'
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if len(sys.argv) > 1:
        for tt in sys.argv[1:]:
            render(int(float(tt) * FPS))
    else:
        a0 = int(os.environ.get('A', 0)); a1 = int(os.environ.get('B', NF))
        for fi in range(a0, a1):
            if os.path.exists(f'{OUT}/f{fi:04d}.png') and os.environ.get('SKIP'):
                continue
            render(fi)
