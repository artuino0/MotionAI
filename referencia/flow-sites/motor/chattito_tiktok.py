"""Chattito · TikTok 9:16 · 37 s · usa papercut_style sin modificarlo."""
import os, math, random, cairo
import papercut_style as ps
from papercut_style import (P, hx, SK, rect, rrect, ell, shape, stroke, arcp, txt, tw, tag, prog, eob, eoc,
                            person, isotipo, group_begin, group_end)

W, H, FPS = ps.W, ps.H, ps.FPS
DUR = 37.0
NF = int(DUR * FPS)
OUT = os.environ.get('OUT', '/home/claude/ch_frames')
OFF = 0.3
CX = 500
SUB_Y = 1380

C_TEAL = hx('0091AD')
C_FACE = hx('EDF2F8')
C_ANT = hx('FF7A59')
C_EYE = hx('1E1A1B')
UI_BG = hx('F4F6F9')
UI_LINE = hx('E3E8EE')
UI_TXT = hx('2B3440')
UI_SUB = hx('7A8594')

SEG = [(0.13, 3.29, 'Nadie debería aprenderse un sistema para poder usarlo.'),
       (3.78, 5.67, 'Chattito es el asistente de Flow.'),
       (6.06, 8.80, 'Vive dentro de tu sistema y conoce tu negocio.'),
       (9.20, 11.97, 'Le preguntas como le preguntarías a alguien de tu equipo:'),
       (12.40, 13.81, 'cuánto vendiste esta semana,'),
       (14.10, 15.53, 'qué clientes tienes pendientes,'),
       (15.80, 16.90, 'cómo va tu inventario.'),
       (17.28, 19.47, 'Y te responde con tus propios datos.'),
       (19.81, 21.30, 'Si no sabes cómo hacer algo,'),
       (21.45, 22.76, 'te guía paso a paso.'),
       (23.12, 24.79, 'Y si necesitas un módulo nuevo,'),
       (24.96, 25.88, 'te ayuda a armarlo.'),
       (26.27, 27.22, 'Sin manuales.'),
       (27.53, 28.85, 'Sin buscar entre menús.'),
       (29.22, 30.29, 'Solo preguntas.'),
       (30.68, 31.12, 'Chattito.'),
       (31.57, 32.55, 'Tu negocio,'),
       (32.72, 33.85, 'a una pregunta de distancia.')]
SEG = [(a + OFF, b + OFF, s) for a, b, s in SEG]


def T(i):
    return SEG[i][0]


# ---------------------------------------------------------------- Chattito (geometría y movimiento oficiales)
import re as _re


def _svg_points(d, step=12):
    toks = _re.findall(r'[MmLlCcQqZz]|-?\d*\.?\d+(?:e-?\d+)?', d)
    pts, i, cur, cmd, start = [], 0, (0.0, 0.0), None, (0.0, 0.0)

    def num():
        nonlocal i
        v = float(toks[i]); i += 1; return v
    while i < len(toks):
        if _re.match(r'[A-Za-z]', toks[i]):
            cmd = toks[i]; i += 1
            if cmd in 'Zz':
                cur = start; continue
        rel = cmd.islower()
        ox, oy = cur if rel else (0, 0)
        C = cmd.upper()
        if C == 'M':
            cur = (ox + num(), oy + num()); start = cur; pts.append(cur); cmd = 'l' if rel else 'L'
        elif C == 'L':
            cur = (ox + num(), oy + num()); pts.append(cur)
        elif C == 'C':
            p1 = (ox + num(), oy + num()); p2 = (ox + num(), oy + num()); p3 = (ox + num(), oy + num())
            p0 = cur
            for k in range(1, step + 1):
                u = k / step; v = 1 - u
                pts.append((v**3*p0[0]+3*v*v*u*p1[0]+3*v*u*u*p2[0]+u**3*p3[0], v**3*p0[1]+3*v*v*u*p1[1]+3*v*u*u*p2[1]+u**3*p3[1]))
            cur = p3
        elif C == 'Q':
            p1 = (ox + num(), oy + num()); p2 = (ox + num(), oy + num()); p0 = cur
            for k in range(1, step + 1):
                u = k / step; v = 1 - u
                pts.append((v*v*p0[0]+2*v*u*p1[0]+u*u*p2[0], v*v*p0[1]+2*v*u*p1[1]+u*u*p2[1]))
            cur = p2
    return pts


def _xf(pts, tx=0, ty=0, rot=0, sx=1, sy=1):
    m = cairo.Matrix(sx, 0, 0, sy, 0, 0).multiply(cairo.Matrix.init_rotate(math.radians(rot))).multiply(cairo.Matrix(1, 0, 0, 1, tx, ty))
    return [m.transform_point(*p) for p in pts]


_ANT_D = ('M8.925 0c-5.075 0-8.925 3.95-8.925 9.1 0 4.225 2.74999 7.75 6.25 8.65-0.55 0.525-0.75 1.27499-0.75 2.09999'
          'l0 10.77501 6.95 0 0-10.77501c0-0.825-0.29999-1.55-0.725-2.09999 3.75-1.1 6.175-4.45001 6.175-8.65 0-5.15-4.02501-9.1-8.975-9.1z')
ANT = [_xf(_svg_points(_ANT_D), 71.341797, 55.838191, -15), _xf(_svg_points(_ANT_D), 120.926333, 51, 15)]
BODY = _xf(_svg_points('M59.525 0l-25.42499 0c-19.45001 0-34.10001 15.325-34.10001 33.975l0 18.85c0 17.95001 12.25 28.84999 29.10001 28.84999'
                       'l35.39999 0c16.825 0 28.75-11.97499 28.75-28.84999l0-18.85c0-20.225-14.64999-33.975-33.725-33.975z'), 53.375, 75.05, 0, 1.10455769, 1.00397933)
FACE = _xf(_svg_points('M55.27501 0l-35.20002 0c-13.2 0-20.07499 9.075-20.07499 21.60001l0 2.84999c0 14.425 7.875 21.95 20.65 21.94999'
                       'l34.675 0c12.025 0 19.95001-7.87499 19.95001-21.94999l0-2.84999c0-12.87501-7.05-21.60001-20-21.60001z'), 62.325, 96.625, 0, 1.1291939, 0.99137952)
HAPPY = [_xf(_svg_points('M1 7q6-10 12 0', 8), 74.5, 114.5), _xf(_svg_points('M1 7q6-10 12 0', 8), 119.5, 114.5)]
EYES = [(81.6082, 120.2192), (126.3399, 120.3399)]
DOTS = [88.825, 104.825, 120.825]
O_HEAD = (104.825, 157.05)
O_ANT = (104.825, 80.0)
O_FACE = (104.825, 119.625)
O_LID = (104.0, 120.0)
ANCHOR = (104.825, 120.0)


def _circle(cx, cy, r, n=14):
    return [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)]


def _about(o, rot=0, sx=1, sy=1, tx=0, ty=0):
    """Transformación CSS con transform-origin: escala, rota y traslada alrededor de o."""
    return (cairo.Matrix(1, 0, 0, 1, -o[0], -o[1]).multiply(cairo.Matrix(sx, 0, 0, sy, 0, 0))
            .multiply(cairo.Matrix.init_rotate(math.radians(rot))).multiply(cairo.Matrix(1, 0, 0, 1, o[0] + tx, o[1] + ty)))


def _io(x):
    x = max(0.0, min(1.0, x))
    return .5 - .5 * math.cos(math.pi * x)


# resorte de la mirada (rigidez 170, amortiguación 22)
_SPR = [0.0]
_p = _v = 0.0
for _ in range(600):
    _v += (170 * (1 - _p) - 22 * _v) / 120
    _p += _v / 120
    _SPR.append(_p)


def spring(dt):
    if dt <= 0:
        return 0.0
    i = dt * 120
    if i >= len(_SPR) - 1:
        return 1.0
    j = int(i)
    return _SPR[j] + (_SPR[j + 1] - _SPR[j]) * (i - j)


def gaze_track(t, keys, v0=0.0):
    """keys: [(tiempo, mirada -1..1)] con el resorte oficial."""
    v, prev = v0, v0
    for tk, val in keys:
        v += (val - prev) * spring(t - tk)
        prev = val
    return v


def mode_alpha(t, keys, mode, fade=.25):
    """Opacidad de un modo de ojos (neutral, happy, typing) con la transición oficial de 250 ms."""
    if isinstance(keys, str):
        return 1.0 if keys == mode else 0.0
    a = 1.0 if keys[0][1] == mode else 0.0
    for tk, m in keys[1:]:
        target = 1.0 if m == mode else 0.0
        f = _io((t - tk) / fade)
        if t >= tk:
            a = a + (target - a) * f
    return a


_br = random.Random(4)
BLINKS = []
_tb = 1.3
while _tb < 60:
    BLINKS.append(_tb)
    if _br.random() < .2:
        BLINKS.append(_tb + .16 + .16)
    _tb += _br.uniform(3, 6)


def _blink(t, d=.16):
    for tb in BLINKS:
        if tb <= t < tb + d:
            return 1 - .9 * math.sin(math.pi * (t - tb) / d)
    return 1.0


def _happy(t, triggers, dur=.6):
    """Saltito oficial: comprime, salta 8, estira y regresa; las antenas giran ±12° dos ciclos."""
    for t0 in triggers:
        u = (t - t0) / dur
        if 0 <= u < 1:
            ks = [(0, 1, 1, 0), (.18, 1.05, .95, 0), (.48, .95, 1.05, -8), (.78, 1.05, .95, 0), (1, 1, 1, 0)]
            for (a0, *v0), (a1, *v1) in zip(ks, ks[1:]):
                if a0 <= u <= a1:
                    f = _io((u - a0) / (a1 - a0))
                    sx, sy, ty = [p + (q - p) * f for p, q in zip(v0, v1)]
                    break
            seg = u * 8
            n = int(seg)
            r0 = math.sin(n * math.pi / 2) * 12 if 0 < n < 8 else 0
            r1 = math.sin((n + 1) * math.pi / 2) * 12 if n + 1 < 8 else 0
            return sx, sy, ty, r0 + (r1 - r0) * _io(seg - n)
    return 1, 1, 0, 0


def chattito(c, x, y, s, mode='neutral', rot=0.0, t=0.0, gaze=0.0, happy_at=(), elated=False, shadow=True, acc=None, **_):
    """Chattito en papel con la geometría de chattito.pen y los movimientos del laboratorio de animación.
    mode: 'neutral' | 'happy' | 'typing' o una lista [(t, modo)] para transiciones de 250 ms."""
    k = 3.28 * s
    base = (cairo.Matrix(1, 0, 0, 1, -ANCHOR[0], -ANCHOR[1]).multiply(cairo.Matrix(k, 0, 0, k, 0, 0))
            .multiply(cairo.Matrix.init_rotate(rot)).multiply(cairo.Matrix(1, 0, 0, 1, x, y)))
    breath = cairo.Matrix(1, 0, 0, 1, 0, -3 * (.5 - .5 * math.cos(2 * math.pi * t / 3.5)))
    joy = cairo.Matrix()
    head_rot, pup, face_t = gaze * 5, (gaze * 4, 0.0), gaze
    ant_rot = 0.0
    if elated:
        ph = (t % 3.2) / 3.2 * 2 * math.pi
        joy = _about(O_HEAD, rot=math.sin(ph) * 4, tx=math.sin(ph) * 5, ty=-(1 - math.cos(ph)) / 2 * 26)
        turn = math.sin(ph * 2)
        head_rot, face_t = turn * 5, turn
        pup = (math.sin(ph * 3) * .8 * 4, math.sin(ph * 2) * -.6 * 4)
        ant_rot = math.sin(ph * 4) * 6
    hsx, hsy, hty, hrot = _happy(t, happy_at)
    jump = _about(O_HEAD, sx=hsx, sy=hsy, ty=hty)
    ant_rot += hrot
    head = _about(O_HEAD, rot=head_rot)
    outer = head.multiply(jump).multiply(joy).multiply(breath).multiply(base)
    face_m = _about(O_FACE, sx=1 - abs(face_t) * 9 / 85, tx=face_t * 4.5)
    lid = _about(O_LID, sy=_blink(t))
    pup_m = cairo.Matrix(1, 0, 0, 1, *pup)

    def mp(pts, m):
        return [m.transform_point(*p) for p in pts]
    ant_m = _about(O_ANT, rot=ant_rot).multiply(outer)
    if acc not in ('bruja', 'santa', 'corona', 'charro'):          # los sombreros tapan las antenas
        group_begin()
        for a in ANT:
            shape(c, mp(a, ant_m), C_ANT, amp=.9, seg=60)
        group_end(c, C_ANT, shadow=shadow)
    shape(c, mp(BODY, outer), C_TEAL, amp=1.1, seg=80, shadow=shadow)
    shape(c, mp(FACE, face_m.multiply(outer)), C_FACE, amp=.9, seg=80, shadow=False)
    eye_m = pup_m.multiply(lid).multiply(outer)
    an = mode_alpha(t, mode, 'neutral')
    ah = mode_alpha(t, mode, 'happy')
    at = mode_alpha(t, mode, 'typing')
    if an > .02:
        for ex, ey in EYES:
            shape(c, mp(_circle(ex, ey, 6.34), eye_m), C_EYE, amp=.5, shadow=False, a=an)
    if ah > .02:
        for hp in HAPPY:
            stroke(c, mp(hp, eye_m), 3 * k, C_EYE, a=ah)
    if at > .02:
        T_ = 1.4
        for i, dx in enumerate(DOTS):
            u = ((t - i * T_ / 3) % T_) / T_
            if u < 1 / 6:
                e = _io(u * 6)
            elif u < 1 / 3:
                e = 1 - _io((u - 1 / 6) * 6)
            else:
                e = 0.0
            op = .35 + .65 * e
            shape(c, mp(_circle(dx, 119.625 - 6 * e, 5), outer), C_EYE, amp=.4, shadow=False, a=at * op)
    if acc:
        accesorio(c, acc, lambda pts: mp(pts, outer), t, shadow, MA=lambda pts: mp(pts, ant_m))


def _flor(cx, cy, r, lobes=18, k=.74):
    return [(cx + (r if i % 2 == 0 else r * k) * math.cos(2 * math.pi * i / (2 * lobes)),
             cy + (r if i % 2 == 0 else r * k) * math.sin(2 * math.pi * i / (2 * lobes))) for i in range(2 * lobes)]


def corazon_pts(cx, cy, r, n=28):
    return [(cx + r / 16 * 16 * math.sin(a) ** 3, cy - r / 16 * (13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a)))
            for a in [2 * math.pi * k / n for k in range(n)]]


def accesorio(c, acc, M, t=0.0, shadow=True, MA=None):
    """Accesorios de temporada sobre la cabeza de Chattito (coordenadas de chattito.pen).
    'cempasuchil': corona de flores · 'bruja': sombrero de bruja. Chattito sigue sin manos."""
    from papercut_style import P
    if acc == 'cempasuchil':
        for lx, ly, a in [(56, 84, 200), (153, 84, -20)]:
            ang = math.radians(a)
            leaf = [(lx + 13 * math.cos(ang) * u - 5 * math.sin(ang) * math.sin(math.pi * u),
                     ly + 13 * math.sin(ang) * u + 5 * math.cos(ang) * math.sin(math.pi * u)) for u in [i / 8 for i in range(9)]]
            leaf += [(lx + 13 * math.cos(ang) * u + 5 * math.sin(ang) * math.sin(math.pi * u),
                      ly + 13 * math.sin(ang) * u - 5 * math.cos(ang) * math.sin(math.pi * u)) for u in [i / 8 for i in range(8, -1, -1)]]
            shape(c, M(leaf), P['verdemx'], amp=.5, shadow=shadow)
        for i, (fx, fy, r) in enumerate([(64, 82, 11), (84, 76, 12.5), (104.8, 73, 13.5), (125.5, 76, 12.5), (145.5, 82, 11)]):
            sw = math.sin(2 * math.pi * (t / 3.5) + i) * .6
            shape(c, M(_flor(fx, fy + sw, r)), P['cempa'], amp=.5, seg=60, shadow=shadow)
            shape(c, M(_flor(fx, fy + sw, r * .62, 12, .7)), P['cempaD'], amp=.4, seg=60, shadow=False)
            shape(c, M(_circle(fx, fy + sw, r * .22, 10)), hx('8A4B12'), amp=.3, shadow=False)
    elif acc == 'bruja':
        shape(c, M([(56, 81), (70, 72), (104.8, 69), (140, 72), (154, 81), (140, 88), (104.8, 90), (70, 88)]), P['bruja'], amp=.6, seg=60, shadow=shadow)
        cone = [(74, 78), (84, 44), (98, 22), (120, 6), (136, 2), (128, 14), (118, 30), (124, 50), (136, 78)]
        shape(c, M(cone), P['bruja'], amp=.6, seg=60, shadow=shadow)
        shape(c, M([(77, 66), (133, 66), (136, 77), (74, 77)]), P['calabaza'], amp=.4, shadow=False)
        shape(c, M([(98, 64), (110, 64), (110, 79), (98, 79)]), P['llama'], amp=.4, shadow=False)
        shape(c, M([(101, 67.5), (107, 67.5), (107, 75.5), (101, 75.5)]), P['calabaza'], amp=.3, shadow=False)
    elif acc == 'santa':
        shape(c, M([(60, 74), (78, 42), (106, 24), (140, 26), (164, 46), (170, 62), (160, 66), (146, 48), (126, 44), (150, 76)]), P['red'], amp=.6, seg=60, shadow=shadow)
        shape(c, M(_circle(166, 64, 9, 16)), P['white'], amp=.6, shadow=shadow)
        shape(c, M([(52, 70), (80, 64), (130, 64), (158, 70), (160, 84), (130, 80), (80, 80), (50, 84)]), P['white'], amp=.6, seg=60, shadow=shadow)
    elif acc == 'corona':
        pts = [(68, 82), (66, 56), (80, 68), (92, 46), (104.8, 64), (118, 46), (130, 68), (144, 56), (142, 82)]
        shape(c, M(pts), P['mustard'], amp=.5, seg=60, shadow=shadow)
        shape(c, M([(67, 74), (143, 74), (142, 82), (68, 82)]), hx('D99A1E'), amp=.4, shadow=False)
        for jx, col in [(86, P['red']), (104.8, P['teal2']), (124, P['red'])]:
            shape(c, M(_circle(jx, 78, 3.4, 10)), col, amp=.3, shadow=False)
        for jx, jy in [(66, 56), (92, 46), (118, 46), (144, 56)]:
            shape(c, M(_circle(jx, jy, 3.2, 10)), P['white'], amp=.3, shadow=False)
    elif acc == 'corazones':
        for i, (hx_, hy) in enumerate([(82.3, 61), (127.2, 61)]):
            beat = 1 + .08 * max(0, math.sin(2 * math.pi * (t / 1.2) - i * .6))
            shape(c, (MA or M)(corazon_pts(hx_, hy, 10.5 * beat)), P['red'], amp=.5, seg=60, shadow=shadow)
            shape(c, (MA or M)(_circle(hx_ - 4, hy - 4, 2.4, 8)), P['white'], amp=.2, shadow=False, a=.8)
    elif acc == 'charro':
        PAL, PALD = hx('E2BE7E'), hx('B98B4A')
        shape(c, M([(20, 76), (32, 66), (60, 72), (104.8, 74), (150, 72), (178, 66), (190, 76), (170, 86), (104.8, 90), (40, 86)]), PAL, amp=.6, seg=60, shadow=shadow)
        shape(c, M([(80, 74), (82, 50), (92, 36), (104.8, 32), (118, 36), (128, 50), (130, 74)]), PAL, amp=.6, seg=60, shadow=shadow)
        shape(c, M([(81, 62), (129, 62), (130, 72), (80, 72)]), PALD, amp=.4, shadow=False)
        for k in range(6):
            x = 84 + k * 8
            shape(c, M([(x, 62), (x + 4, 67), (x, 72)]), P['mustard'], amp=.2, shadow=False)
    elif acc == 'flor':
        for a in range(0, 360, 72):
            r = math.radians(a)
            shape(c, M(_circle(146 + 11 * math.cos(r), 82 + 11 * math.sin(r), 9, 14)), P['rosamx'], amp=.4, shadow=shadow)
        shape(c, M(_circle(146, 82, 7, 12)), P['mustard'], amp=.3, shadow=False)
    elif acc == 'etiqueta_oferta':
        stroke(c, M([(127.2, 62), (140, 70), (160, 74)]), 1.2 * 3.28 * .62, P['ink'])
        tag_pts = [(156, 66), (172, 62), (190, 74), (184, 100), (160, 104), (150, 80)]
        shape(c, M(tag_pts), P['coral'], amp=.5, shadow=shadow)
        shape(c, M(_circle(160, 74, 2.6, 8)), P['white'], amp=.2, shadow=False)
        shape(c, M(_circle(166, 84, 3.2, 8)), P['white'], amp=.2, shadow=False)
        shape(c, M(_circle(178, 94, 3.2, 8)), P['white'], amp=.2, shadow=False)
        stroke(c, M([(181, 80), (163, 98)]), 1.0 * 3.28 * .62 * 1.4, P['white'])


# ---------------------------------------------------------------- interfaz de Flow en papel (1440 x 1000)
def ui_icon(c, kind, x, y, col, s=1.0):
    c.save(); c.translate(x, y); c.scale(s, s)
    if kind == 'grid':
        for i in range(2):
            for j in range(2):
                c.save(); ps.path(c, ps.rr_pts(-8 + i * 9, -8 + j * 9, 7, 7, 2)); c.set_line_width(1.8)
                c.set_source_rgba(*col, 1); c.stroke(); c.restore()
    else:
        c.save(); ps.path(c, ps.rr_pts(-8, -8, 16, 16, 4)); c.set_line_width(1.8)
        c.set_source_rgba(*col, 1); c.stroke(); c.restore()
    c.restore()


def ui_text(c, s, x, y, size, col, bold=False):
    txt(c, s, x, y, size, col, 'NunitoBlack' if bold else 'NunitoBold', 'l')


def ui_check(c, x, y, on=True):
    if on:
        rrect(c, x - 9, y - 9, 18, 18, 4, P['coral'], shadow=False, amp=.5)
        stroke(c, [(x - 4.5, y), (x - 1, y + 3.5), (x + 5, y - 3.5)], 2, P['white'])
    else:
        rrect(c, x - 9, y - 9, 18, 18, 4, P['white'], shadow=False, amp=.5)
        c.save(); ps.path(c, ps.rr_pts(x - 9, y - 9, 18, 18, 4)); c.set_line_width(1.2)
        c.set_source_rgba(*UI_LINE, 1); c.stroke(); c.restore()


def draw_ui(c, t, chat_on=True):
    rect(c, 0, 0, 1440, 1000, UI_BG, amp=1.2, shadow=False)
    # header
    rect(c, 0, 0, 1440, 56, P['white'], amp=1)
    rrect(c, 24, 14, 28, 28, 7, C_TEAL, amp=.6, shadow=False)
    for k, (yy, ww) in enumerate([(22, 14), (28, 11), (34, 7)]):
        stroke(c, [(31, yy + 2), (31 + ww, yy - 1)], 3, P['white'])
    ui_text(c, 'Flow', 62, 28, 19, UI_TXT, True)
    rrect(c, 108, 18, 78, 21, 10, hx('EEF1F5'), shadow=False, amp=.6)
    ui_text(c, 'Acme S.A.', 117, 28.5, 11, UI_SUB)
    for k, kind in enumerate(['chat', 'bell', 'sun']):
        cx_ = 1068 + k * 48
        if kind == 'chat':
            stroke(c, arcp(cx_, 28, 9, 0, 330, 12), 1.8, UI_SUB)
        elif kind == 'bell':
            stroke(c, arcp(cx_, 30, 8, 180, 360, 10) + [(cx_ + 9, 35), (cx_ - 9, 35), (cx_ - 8, 30)], 1.8, UI_SUB)
        else:
            stroke(c, arcp(cx_, 28, 5, 0, 360, 10), 1.8, UI_SUB)
            for a in range(0, 360, 45):
                r = math.radians(a)
                stroke(c, [(cx_ + 8 * math.cos(r), 28 + 8 * math.sin(r)), (cx_ + 10.5 * math.cos(r), 28 + 10.5 * math.sin(r))], 1.6, UI_SUB)
    if chat_on:
        chattito(c, 1212, 30, .066, [(0, 'neutral'), (5.15, 'happy')], t=t, shadow=False,
                 gaze=gaze_track(t, [(4.55, -1), (4.85, 1), (5.15, 0)]), happy_at=(5.15,))
    stroke(c, [(1244, 16), (1244, 40)], 1, UI_LINE)
    ell(c, 1276, 28, 15, 15, hx('E6F3F6'), shadow=False, amp=.5)
    txt(c, 'AR', 1276, 28, 11, C_TEAL, 'NunitoBlack')
    ui_text(c, 'Arturo Muñoz', 1299, 28, 13, UI_TXT)
    # sidebar
    rect(c, 0, 56, 240, 944, P['white'], amp=1)
    ui_text(c, 'MENÚ', 16, 83, 11, UI_SUB, True)
    items = [('GENERAL', None), ('Dashboard', 'grid'), ('ENTIDADES', None), ('Clientes', 'i'), ('Facturas', 'i'),
             ('Productos', 'i'), ('Pedidos', 'i'), ('Proveedores', 'i'), ('ADMINISTRACIÓN', None), ('Módulos', 'grid'),
             ('Roles y Permisos', 'i'), ('Configuración', 'i')]
    y = 143
    for lab, ic in items:
        if ic is None:
            y += 6
            ui_text(c, lab, 22, y, 10, UI_SUB, True)
            y += 30
            continue
        act = lab == 'Módulos'
        if act:
            rrect(c, 10, y - 17, 220, 35, 6, hx('E6F3F6'), shadow=False, amp=.6)
            rect(c, 10, y - 17, 3, 35, C_TEAL, shadow=False, amp=.3)
        ui_icon(c, ic, 30, y, C_TEAL if act else UI_SUB)
        ui_text(c, lab, 49, y, 14, C_TEAL if act else UI_TXT, act)
        y += 36
    # page header
    rect(c, 240, 56, 1200, 113, P['white'], amp=1, shadow=False)
    ui_text(c, 'Inicio  ›  Módulos  ›  Cotizaciones', 268, 84, 12.5, UI_SUB)
    ui_text(c, 'Cotizaciones', 268, 113, 25, UI_TXT, True)
    rrect(c, 432, 103, 88, 20, 10, hx('EEF1F5'), shadow=False, amp=.5)
    ui_text(c, '/cotizaciones', 440, 113, 10.5, UI_SUB)
    ui_text(c, 'Configura cómo se exploran los registros de este módulo.', 268, 141, 12.5, UI_SUB)
    rrect(c, 1151, 95, 92, 35, 6, P['white'], amp=.6)
    txt(c, 'Cancelar', 1197, 112, 13, UI_TXT, 'NunitoBold')
    rrect(c, 1254, 95, 158, 35, 6, P['coral'], amp=.6)
    txt(c, 'Guardar diseño', 1333, 112, 13, P['white'], 'NunitoBlack')
    # pasos
    labs = ['Información básica', 'Campos', 'Diseño del detalle', 'Diseño del listado']
    xs = [284, 511, 669, 888]
    for k, (lx, lab) in enumerate(zip(xs, labs)):
        ell(c, lx, 214, 12, 12, P['coral'], shadow=False, amp=.5)
        if k < 3:
            stroke(c, [(lx - 5, 214), (lx - 1, 218), (lx + 5, 210)], 2, P['white'])
            nx = xs[k + 1]
            stroke(c, [(lx + 18 + tw(c, lab, 13, 'NunitoBold') + 10, 214), (nx - 20, 214)], 1.5, P['coral'] if k < 2 else UI_LINE)
        else:
            txt(c, '4', lx, 214, 12, P['white'], 'NunitoBlack')
        ui_text(c, lab, lx + 20, 214, 13, UI_TXT, k == 3)
    # selector de vistas
    rrect(c, 272, 248, 1136, 64, 10, P['white'], amp=.8)
    rrect(c, 278, 252, 372, 56, 8, hx('E9F4F6'), shadow=False, amp=.6)
    for k, (tt, ss, chip) in enumerate([('Tabla', 'Columnas y filtros', 'Siempre activa'), ('Kanban', 'Organiza por estado', 'Desactivada'),
                                        ('Calendario', 'Agenda por fecha', 'Desactivada')]):
        bx = 300 + k * 376
        ui_icon(c, 'i', bx + 2, 280, C_TEAL if k == 0 else UI_SUB)
        ui_text(c, tt, bx + 22, 272, 14, UI_TXT, True)
        ui_text(c, ss, bx + 22, 290, 11, UI_SUB)
        cw = tw(c, chip, 11, 'NunitoBold') + 18
        rrect(c, bx + 330 - cw, 269, cw, 22, 11, hx('DDF0F3') if k == 0 else hx('EEF1F5'), shadow=False, amp=.5)
        txt(c, chip, bx + 330 - cw / 2, 280, 11, C_TEAL if k == 0 else UI_SUB, 'NunitoBold')
    # columnas
    rrect(c, 272, 331, 548, 650, 10, P['white'], amp=.8)
    ui_text(c, 'Columnas de la tabla', 292, 361, 16, UI_TXT, True)
    ui_text(c, 'Arrastra para ordenar. Desmarca para ocultar.', 292, 381, 11.5, UI_SUB)
    rrect(c, 731, 359, 69, 20, 10, hx('E6F3F6'), shadow=False, amp=.5)
    txt(c, '4 visibles', 765, 369, 10.5, C_TEAL, 'NunitoBold')
    stroke(c, [(292, 405), (800, 405)], 1, UI_LINE)
    rows = [('Folio', 'Número automático', 1), ('Cliente', 'Relación', 1), ('Estado', 'Selección', 1), ('Total', 'Moneda', 1),
            ('Fecha de emisión', 'Fecha', 0), ('Notas internas', 'Texto largo', 0)]
    for k, (a, b, on) in enumerate(rows):
        yy = 445 + k * 49
        for d in range(3):
            ell(c, 300, yy - 6 + d * 6, 1.6, 1.6, UI_SUB, shadow=False, amp=.2)
            ell(c, 305, yy - 6 + d * 6, 1.6, 1.6, UI_SUB, shadow=False, amp=.2)
        ui_check(c, 329, yy, on)
        ui_text(c, a, 350, yy - 7, 13.5, UI_TXT if on else UI_SUB, True)
        ui_text(c, b, 350, yy + 11, 11, UI_SUB)
        if k == 1:
            rrect(c, 673, yy - 12, 127, 25, 5, hx('E9F4F6'), shadow=False, amp=.5)
            txt(c, 'Mostrar: Nombre', 728, yy, 11, C_TEAL, 'NunitoBold')
            stroke(c, [(780, yy - 2), (783.5, yy + 1.5), (787, yy - 2)], 1.6, C_TEAL)
        if k == 5:
            ui_text(c, 'Oculta', 766, yy, 11, UI_SUB)
        stroke(c, [(292, yy + 25), (800, yy + 25)], 1, UI_LINE)
    ui_text(c, 'Filtros disponibles', 292, 750, 16, UI_TXT, True)
    ui_text(c, 'Aparecerán encima del listado para todos los usuarios.', 292, 770, 11.5, UI_SUB)
    for k, (lab, on) in enumerate([('Estado', 1), ('Cliente', 1), ('Fecha de emisión', 0)]):
        bx = [292, 387, 483][k]
        bw = [86, 86, 147][k]
        rrect(c, bx, 789, bw, 34, 6, hx('E9F4F6') if on else P['white'], shadow=False, amp=.5)
        ui_check(c, bx + 18, 806, on)
        ui_text(c, lab, bx + 34, 806, 12.5, UI_TXT)
    ui_text(c, 'Orden por defecto', 292, 850, 16, UI_TXT, True)
    for bx, bw, lab in [(292, 270, 'Folio'), (572, 226, 'Mayor a menor')]:
        rrect(c, bx, 868, bw, 40, 6, P['white'], shadow=False, amp=.5)
        c.save(); ps.path(c, ps.rr_pts(bx, 868, bw, 40, 6)); c.set_line_width(1); c.set_source_rgba(*UI_LINE, 1); c.stroke(); c.restore()
        ui_text(c, lab, bx + 12, 888, 13, UI_TXT)
        stroke(c, [(bx + bw - 25, 885), (bx + bw - 20, 890), (bx + bw - 15, 885)], 1.6, UI_SUB)
    ui_text(c, 'Se aplica al abrir la vista. Cada usuario puede cambiarlo después.', 292, 925, 10.5, UI_SUB)
    # vista previa
    ui_text(c, 'Vista previa', 844, 341, 16, UI_TXT, True)
    ui_text(c, 'Así se verá el listado para tu equipo.', 844, 361, 11.5, UI_SUB)
    rrect(c, 844, 381, 564, 420, 10, P['white'], amp=.8)
    ui_text(c, 'Cotizaciones', 860, 411, 15, UI_TXT, True)
    rrect(c, 1312, 395, 80, 31, 5, P['coral'], shadow=False, amp=.5)
    txt(c, '+ Nueva', 1352, 410.5, 12, P['white'], 'NunitoBlack')
    stroke(c, [(844, 439), (1408, 439)], 1, UI_LINE)
    rrect(c, 860, 452, 250, 34, 5, P['white'], shadow=False, amp=.5)
    c.save(); ps.path(c, ps.rr_pts(860, 452, 250, 34, 5)); c.set_line_width(1); c.set_source_rgba(*UI_LINE, 1); c.stroke(); c.restore()
    ui_text(c, 'Buscar cotización…', 892, 469, 12, UI_SUB)
    stroke(c, arcp(877, 467, 6, 0, 360, 10), 1.6, UI_SUB)
    rrect(c, 1120, 452, 98, 34, 5, hx('E9F4F6'), shadow=False, amp=.5)
    ui_text(c, 'Estado', 1148, 469, 12, C_TEAL, True)
    stroke(c, [(1194, 467), (1198, 471), (1202, 467)], 1.6, C_TEAL)
    rect(c, 844, 498, 564, 43, hx('F5F7FA'), shadow=False, amp=.4)
    for lab, cx_ in [('Folio', 860), ('Cliente', 959), ('Estado', 1118), ('Total', 1231)]:
        ui_text(c, lab, cx_, 520, 11, UI_TXT, True)
    data = [('COT-0042', 'Acme Industrial', 'Enviada', '$ 18,750'), ('COT-0041', 'Norte Logística', 'Borrador', '$ 8,200'),
            ('COT-0040', 'Grupo Andina', 'Aprobada', '$ 42,500'), ('COT-0039', 'Vista Norte', 'Enviada', '$ 12,300')]
    for k, row in enumerate(data):
        yy = 568 + k * 54
        for j, (v, cx_) in enumerate(zip(row, [860, 959, 1118, 1231])):
            ui_text(c, v, cx_, yy, 12.5, UI_TXT, j == 0)
        stroke(c, [(844, yy + 27), (1408, yy + 27)], 1, UI_LINE)
    ui_text(c, '1–4 de 42 registros', 860, 779, 11, UI_SUB)
    ui_text(c, '1    2    3', 1322, 779, 12, UI_TXT)
    stroke(c, [(1312, 774), (1308, 779), (1312, 784)], 1.6, UI_TXT)
    stroke(c, [(1384, 774), (1388, 779), (1384, 784)], 1.6, UI_TXT)
    rrect(c, 844, 813, 564, 40, 8, hx('EEF4F7'), shadow=False, amp=.6)
    ui_text(c, 'La vista previa refleja los cambios antes de guardar.', 880, 833, 11.5, UI_SUB)


# ---------------------------------------------------------------- utilería
def manual(c, x, y, n, s=1.0, rot=0.0):
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s)
    full = int(n)
    fr = n - full
    for k in range(full + (1 if fr > 0 else 0)):
        y0 = 60 + k * 46
        h = 46 if k < full else 46 * fr
        xo0 = (k % 2) * 46 - 23
        xo1 = ((k + 1) % 2) * 46 - 23
        xo1 = xo0 + (xo1 - xo0) * (h / 46)
        pts = [(-150 + xo0, y0), (150 + xo0, y0), (150 + xo1, y0 + h), (-150 + xo1, y0 + h)]
        shape(c, pts, P['paper'] if k % 2 == 0 else P['cream'], amp=1.4)
        if h > 30:
            for j in range(2):
                yy = y0 + 15 + j * 14
                xm = xo0 + (xo1 - xo0) * ((yy - y0) / max(h, 1))
                stroke(c, [(-120 + xm, yy), (60 + xm - j * 50, yy)], 4, P['gray'])
    rrect(c, -175, -80, 350, 150, 14, P['coralD'])
    rect(c, -165, 52, 330, 16, P['paper'], shadow=False, amp=1)
    rrect(c, -110, -52, 220, 70, 8, P['paper'], shadow=False)
    txt(c, 'MANUAL', 0, -26, 38, P['ink'])
    txt(c, 'Tomo 1 de 12', 0, 4, 20, P['grayD'], 'NunitoBold')
    c.restore()


def biz(c, kind, x, y, s=1.0, rot=0.0):
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s)
    if kind == 'box':
        rect(c, -70, -50, 140, 110, P['wood'])
        rect(c, -70, -50, 140, 26, P['woodD'], shadow=False)
        rect(c, -14, -50, 28, 60, P['yellowL'], shadow=False, amp=.8)
    elif kind == 'tag':
        shape(c, [(-75, -40), (40, -40), (80, 0), (40, 40), (-75, 40)], P['mustard'])
        ell(c, 42, 0, 9, 9, P['paper'], shadow=False, amp=.4)
        txt(c, '$', -20, 0, 50, P['ink'])
    else:
        rrect(c, -60, -75, 120, 150, 10, P['coral'])
        rect(c, -40, -55, 86, 110, P['paper'], shadow=False)
        for j in range(4):
            stroke(c, [(-28, -32 + j * 24), (34, -32 + j * 24)], 4, P['gray'])
    c.restore()


def bubble(c, x, y, lines, s=1.0, tail='l', size=38, bg=None, fg=None, q=True):
    if s <= .02:
        return
    bg = bg or P['white']
    fg = fg or P['ink']
    c.save(); c.translate(x, y); c.scale(s, s)
    wmax = max(tw(c, l, size) for l in lines) if lines else 0
    pad = 34
    qw = 64 if q else 0
    w = wmax + pad * 2 + qw
    h = len(lines) * size * 1.25 + 44
    tx = -w / 2 + 50 if tail == 'l' else w / 2 - 50
    group_begin()
    rrect(c, -w / 2, -h / 2, w, h, 34, bg)
    shape(c, [(tx - 22, h / 2 - 6), (tx - (34 if tail == 'l' else -34), h / 2 + 40), (tx + 22, h / 2 - 6)], bg)
    group_end(c, bg)
    if q:
        ell(c, -w / 2 + pad + 24, 0, 26, 26, P['coral'], shadow=False)
        txt(c, '?', -w / 2 + pad + 24, 0, 36, P['white'])
    yy = -(len(lines) - 1) * size * 1.25 / 2
    for l in lines:
        txt(c, l, -w / 2 + pad + qw, yy, size, fg, 'NunitoBlack', 'l')
        yy += size * 1.25
    c.restore()


class Burst:
    def __init__(self, cx, cy, n, seed, spread=520):
        r = random.Random(seed)
        self.p = [dict(x=cx + r.uniform(-120, 120), y=cy + r.uniform(-120, 120), vx=r.uniform(-1, 1) * spread,
                       vy=r.uniform(-1.2, .2) * spread, rot=r.uniform(0, 6.28), vr=r.uniform(-8, 8),
                       cc=r.choice(['coral', 'teal', 'mustard', 'mint', 'sky', 'teal2', 'paper']),
                       sh=r.choice('rtc'), sz=r.uniform(16, 30)) for _ in range(n)]

    def draw(self, c, dt):
        if dt < 0:
            return
        for q in self.p:
            x = q['x'] + q['vx'] * dt
            y = q['y'] + q['vy'] * dt + 900 * dt * dt
            if y > H + 50:
                continue
            c.save(); c.translate(x, y); c.rotate(q['rot'] + q['vr'] * dt)
            z = q['sz']
            if q['sh'] == 'r':
                rect(c, -z / 2, -z * .3, z, z * .6, P[q['cc']], amp=1)
            elif q['sh'] == 't':
                shape(c, [(-z / 2, z / 2), (z / 2, z / 2), (0, -z / 2)], P[q['cc']], amp=1)
            else:
                ell(c, 0, 0, z * .4, z * .4, P[q['cc']], amp=.6)
            c.restore()


B_MAN = Burst(330, 560, 70, 3)
B_MEN = Burst(700, 820, 70, 5)

DESK_Y = 1080


def desk(c):
    ps.gingham(c, -20, DESK_Y, W + 40, H - DESK_Y + 20, P['paper'], P['pink2'])


# ---------------------------------------------------------------- escenas
def sc1(c, t):
    """0–3.85 · el manual que no se acaba."""
    ps.S.desat = .5
    ps.wall(c, P['pink'], P['pink2'], P['paper'], .7)
    ps.clock(c, 820, 230, 70, t * 6, t * .6)
    person(c, 300, 760, 1.0, ps.OWNER, 'stress')
    desk(c)
    n = min(22, 1.5 + max(0, t - .4) * 5.2)
    manual(c, 560, 1010, n, .95, -.05)
    if 2.6 <= t < 3.6:
        p = (t - 2.6) / 1.0
        for k in range(3):
            q = cl(p * 1.4 - k * .2)
            if q <= 0:
                continue
            ell(c, 380 + q * 120 + k * 10, 800 - q * 140 - k * 40, 22 + q * 26, 16 + q * 18, P['white'], a=1 - q, shadow=False)
    ps.S.desat = 0


def cl(v):
    return max(0.0, min(1.0, v))


MON_W = 940
MON_K = MON_W / 1440
MON_X = CX - MON_W / 2
MON_Y = 380
ICON = (MON_X + 1212 * MON_K, MON_Y + 30 * MON_K)


def sc2a(c, t):
    """3.85–6.15 · la pantalla de Flow; Chattito vive en el encabezado y sale."""
    ps.wall(c, P['mintL'], hx('CBE8DC'), P['paper'])
    z = 1 + 4.2 * eoc(prog(t, 4.25, 1.1))
    fx, fy = ICON
    tx = fx + (CX - fx) * eoc(prog(t, 4.25, 1.1))
    ty = fy + (760 - fy) * eoc(prog(t, 4.25, 1.1))
    pop = prog(t, 5.35, .55)
    fall = eoc(prog(t, 5.45, .65))
    c.save()
    c.translate(tx, ty + fall * 1400)
    c.rotate(fall * .35)
    c.scale(z, z)
    c.translate(-fx, -fy)
    # monitor
    rrect(c, MON_X - 26, MON_Y - 26, MON_W + 52, 1000 * MON_K + 52, 30, P['ink'])
    shape(c, [(CX - 70, MON_Y + 1000 * MON_K + 26), (CX + 70, MON_Y + 1000 * MON_K + 26), (CX + 100, MON_Y + 1000 * MON_K + 150),
              (CX - 100, MON_Y + 1000 * MON_K + 150)], hx('4A3F41'))
    rrect(c, CX - 210, MON_Y + 1000 * MON_K + 140, 420, 34, 14, P['ink'])
    c.save()
    c.translate(MON_X, MON_Y)
    c.scale(MON_K, MON_K)
    c.rectangle(0, 0, 1440, 1000)
    c.clip()
    draw_ui(c, t, chat_on=pop <= 0)
    c.restore()
    c.restore()
    if pop > 0:
        e = eob(pop, 1.6)
        sx = .066 * MON_K * z
        s = sx + (.95 - sx) * e
        x = tx + (CX - tx) * e
        y = ty + (720 - ty) * e
        chattito(c, x, y, s, 'happy', rot=(1 - e) * -.6, t=t, happy_at=(5.95,))
    tag(c, CX, 1180, ['El asistente de Flow'], 56, P['teal'], P['white'], ang=-2, sc=eob(prog(t, 5.6, .3), 2))


def sc2b(c, t):
    """6.15–9.3 · Chattito junto a ella; el manual se pliega; su negocio alrededor."""
    ps.wall(c, P['pink'], P['pink2'], P['paper'])
    ps.bunting(c, -6, [P['coral'], P['mustard'], P['teal2'], P['mint'], P['sky']])
    person(c, 260, 760, 1.0, ps.OWNER, 'happy' if t > 6.9 else 'calm')
    land = eob(prog(t, 6.15, .45), 1.4)
    cy_ = -300 + (840 + 300) * land
    desk(c)
    fold = prog(t, 6.45, .7)
    n = 9 * (1 - eoc(fold))
    gone = prog(t, 7.15, .35)
    if gone < 1:
        manual(c, 300, 1010, n, .9 * (1 - eoc(gone)) + .001, -.05 + gone * 3)
    for k, (kind, ang, r) in enumerate([('box', 200, 250), ('tag', 290, 240), ('note', 340, 260)]):
        p = eob(prog(t, 7.6 + k * .3, .35), 2)
        if p <= .02:
            continue
        a = math.radians(ang + (t - 7.6) * 18)
        bx = 690 + math.cos(a) * r
        by = 760 + math.sin(a) * r * .8
        biz(c, kind, bx, by, .9 * p, math.sin(t * 2 + k) * .15)
    chattito(c, 700, cy_, .62, [(0, 'happy'), (7.4, 'neutral')], t=t, happy_at=(6.55,),
             gaze=gaze_track(t, [(7.4, 1), (8.2, -1)]))
    tag(c, CX, 330, ['Conoce tu negocio'], 56, P['teal'], P['white'], ang=2, sc=eob(prog(t, 8.0, .3), 2))


QS = [('¿Cuánto vendí', 'esta semana?'), ('¿Qué clientes tengo', 'pendientes?'), ('¿Cómo va mi', 'inventario?')]


def sc3(c, t):
    """9.3–17.4 · le preguntas como a alguien de tu equipo."""
    ps.wall(c, P['mintL'], hx('CBE8DC'), P['paper'])
    person(c, 210, 930, .95, ps.OWNER, 'happy')
    for k in range(3):
        p = eob(prog(t, T(4 + k) - .05, .32), 1.8)
        bubble(c, 450 + (k % 2) * 40, 300 + k * 205, list(QS[k]), p, tail='l', size=40)
    modes = [(0, 'happy'), (10.4, 'neutral'), (T(4) - .1, 'typing')]
    ps.rect(c, -20, 1150, W + 40, H, P['mint'], amp=2, seg=120)
    chattito(c, 770, 1040, .55, modes, t=t, happy_at=(9.55,), gaze=gaze_track(t, [(10.4, -1), (T(6) + .6, 0)]))
    if t < T(4) - .2:
        tag(c, CX, 520, ['Como a alguien', 'de tu equipo'], 58, P['coral'], P['white'], ang=-2, sc=eob(prog(t, 10.0, .3), 2))


def card(c, kind, x, y, s, rot, t, t0):
    if s <= .02:
        return
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s)
    rrect(c, -130, -125, 260, 250, 20, P['paper'])
    title = {'chart': 'Ventas', 'list': 'Pendientes', 'inv': 'Inventario'}[kind]
    txt(c, title, 0, -92, 30, P['teal'])
    ps.S.clean = True
    if kind == 'chart':
        hs = [50, 80, 70, 120]
        for k, h in enumerate(hs):
            g = eoc(prog(t, t0 + .2 + k * .1, .3))
            rrect(c, -90 + k * 47, 95 - h * g, 34, h * g + .1, 6, P['teal'] if k < 3 else P['coral'], shadow=False, amp=.6)
        stroke(c, [(-95, 98), (100, 98)], 4, P['grayD'])
    elif kind == 'list':
        for k in range(3):
            yy = -40 + k * 48
            g = eob(prog(t, t0 + .25 + k * .12, .25), 2.2)
            if g > .02:
                c.save(); c.translate(-80, yy); c.scale(g, g)
                ell(c, 0, 0, 16, 16, P['coral'], shadow=False)
                stroke(c, [(-7, 0), (-2, 6), (8, -6)], 4.5, P['white'])
                c.restore()
            rrect(c, -50, yy - 9, 140 - k * 20, 18, 9, P['gray'], shadow=False, amp=.6)
    else:
        c.save(); c.scale(.8, .8); c.translate(0, 10)
        rect(c, -70, -50, 140, 110, P['wood'], shadow=False)
        rect(c, -70, -50, 140, 26, P['woodD'], shadow=False)
        rect(c, -14, -50, 28, 60, P['yellowL'], shadow=False, amp=.8)
        c.restore()
        txt(c, '128 pzas', 0, 95, 30, P['ink'])
    ps.S.clean = False
    c.restore()


def sc4(c, t):
    """17.4–19.95 · te responde con tus propios datos."""
    ps.wall(c, P['cream'], hx('F3E6D3'), P['pink2'], .8)
    ps.bunting(c, -6, [P['coral'], P['mustard'], P['teal2'], P['mint'], P['sky']])
    t0s = [17.6, 18.05, 18.5]
    pos = [(230, 640, -.08), (CX, 560, 0), (770, 640, .08)]
    for k, kind in enumerate(['chart', 'list', 'inv']):
        p = eob(prog(t, t0s[k], .35), 1.8)
        x, y, r = pos[k]
        card(c, kind, x, y + (1 - p) * 500, .95 * p, r, t, t0s[k])
    chattito(c, CX, 1060, .62, 'happy', t=t, happy_at=(17.6, 18.05, 18.5),
             gaze=gaze_track(t, [(17.65, -1), (18.1, 0), (18.55, 1)]))
    tag(c, CX, 230, ['Tus propios datos'], 58, P['teal'], P['white'], ang=-2, sc=eob(prog(t, 18.3, .3), 2))


STONES = [(330, 1180), (590, 1030), (360, 870), (620, 710), (850, 545)]
HOPS = [20.35, 21.6, 22.05, 22.5, 22.95]


def sc5(c, t):
    """19.95–23.25 · te guía paso a paso."""
    ps.wall(c, P['cream'], hx('F6ECDC'), P['pink2'], .6)
    for k, (sx, sy) in enumerate(STONES):
        p = eob(prog(t, HOPS[k] + .12, .25), 2.2)
        if p <= .02:
            continue
        c.save(); c.translate(sx, sy); c.scale(p, p)
        ell(c, 0, 0, 120, 56, P['tealL'])
        ell(c, 0, -4, 30, 30, P['teal'], shadow=False)
        txt(c, str(k + 1), 0, -4, 34, P['white'])
        c.restore()
    # Chattito salta de piedra en piedra
    idx = 0
    for k in range(len(HOPS)):
        if t >= HOPS[k]:
            idx = k
    x, y = STONES[idx]
    if idx + 1 < len(HOPS) and t >= HOPS[idx + 1] - .35:
        f = cl((t - (HOPS[idx + 1] - .35)) / .35)
        nx, ny = STONES[idx + 1]
        x, y = x + (nx - x) * f, y + (ny - y) * f - math.sin(math.pi * f) * 110
    chattito(c, x, y - 120, .48, [(0, 'neutral'), (21.5, 'happy')], t=t, gaze=gaze_track(t, [(20.0, 1), (21.5, 0)]))
    # ella lo sigue
    oi = max(0, idx - 1) if t > 21.3 else 0
    ox, oy = STONES[oi]
    if t > 21.3 and idx >= 1 and t < HOPS[idx] + .4:
        pass
    person(c, ox - 235, oy - 170, .5, ps.OWNER, 'stress' if t < 21.4 else 'happy')
    if t < 21.4:
        bubble(c, 170, 880, [], eob(prog(t, 20.2, .3), 2), q=True)


BLOCKS = [('head', -320, -500, 23.85), ('f1', 700, -100, 24.2), ('f2', -700, 60, 24.5), ('f3', 600, 300, 24.8), ('btn', 0, 800, 25.1)]


def sc6(c, t):
    """23.25–26.38 · te ayuda a armar un módulo nuevo."""
    ps.wall(c, P['pink'], P['pink2'], P['paper'])
    bx, by = 430, 720
    p0 = eob(prog(t, 23.45, .35), 1.6)
    if p0 > .02:
        c.save(); c.translate(bx, by); c.scale(p0, p0)
        rrect(c, -260, -330, 520, 660, 26, P['paper'])
        ps.dashed = None
        c.restore()
    for kind, dx, dy, t0 in BLOCKS:
        p = prog(t, t0, .4)
        if p <= 0:
            continue
        e = eob(p, 1.3)
        ox, oy = dx * (1 - e), dy * (1 - e)
        rot = (1 - e) * (.6 if dx > 0 else -.6)
        c.save(); c.translate(bx + ox, by + oy); c.rotate(rot)
        if kind == 'head':
            rrect(c, -260, -330, 520, 110, 26, P['teal'])
            txt(c, 'Mi módulo', 0, -275, 52, P['white'])
        elif kind == 'btn':
            rrect(c, -170, 200, 340, 86, 43, P['coral'])
            txt(c, 'Guardar', 0, 243, 42, P['white'])
        else:
            i = int(kind[1]) - 1
            yy = -170 + i * 120
            rrect(c, -220, yy, 440, 86, 18, [P['mustard'], P['mint'], P['sky']][i])
            txt(c, ['Nombre', 'Fecha', 'Estado'][i], -190, yy + 43, 38, P['ink'], 'NunitoBlack', 'l')
        c.restore()
    done = prog(t, 25.5, .3)
    if done > 0:
        c.save(); c.translate(bx + 250, by - 320); s = eob(done, 2.4); c.scale(s, s)
        ell(c, 0, 0, 46, 46, P['coral'])
        stroke(c, [(-20, 0), (-5, 16), (22, -16)], 11, P['white'])
        c.restore()
        gp = prog(t, 25.5, .6)
        if gp < 1:
            for k in range(10):
                a = k * math.pi / 5
                d = 380 + 120 * gp
                ell(c, bx + math.cos(a) * d * .8, by + math.sin(a) * d, 14 * (1 - gp) + 2, 14 * (1 - gp) + 2, P['mustard'], shadow=False)
    # Chattito empuja la siguiente pieza
    tgt = None
    for kind, dx, dy, t0 in BLOCKS:
        if t0 - .2 <= t < t0 + .4:
            tgt = (dx, dy)
    cxp, cyp = 790, 1150
    chattito(c, cxp, cyp, .5, [(0, 'neutral'), (25.45, 'happy')], t=t, happy_at=(25.5,),
             gaze=gaze_track(t, [(23.3, -1), (25.45, 0)]))


def menus(c, x, y, s):
    c.save(); c.translate(x, y); c.scale(s, s)
    for k in range(4):
        ox, oy = k * 70 - 100, k * 90 - 140
        rrect(c, ox - 150, oy - 30, 300, 230, 16, P['white'])
        for j in range(4):
            rrect(c, ox - 125, oy - 10 + j * 50, 190 - (j % 2) * 40, 26, 8, P['gray'], shadow=False, amp=.6)
            stroke(c, [(ox + 100, oy - 6 + j * 50), (ox + 112, oy + 3 + j * 50), (ox + 100, oy + 12 + j * 50)], 4, P['grayD'])
    c.restore()


def sc7(c, t):
    """26.38–30.8 · sin manuales, sin menús, solo preguntas."""
    ps.wall(c, P['cream'], hx('F3E6D3'), P['pink2'], .8)
    if t < T(12) + .25:
        manual(c, 300, 430, 5, .85, -.08)
    else:
        B_MAN.draw(c, t - T(12) - .25)
    if t < T(13) + .3:
        menus(c, 690, 820, .9)
    else:
        B_MEN.draw(c, t - T(13) - .3)
    p = eob(prog(t, T(14), .35), 2)
    bubble(c, CX, 640, ['Pregúntale', 'a Chattito'], 1.15 * p, tail='r', size=46)
    q = eob(prog(t, T(14) + .2, .4), 1.6)
    if q > .02:
        chattito(c, 690, 980 + (1 - q) * 700, .5, 'happy', t=t, happy_at=(T(14) + .65,), gaze=gaze_track(t, [(T(14) + .3, -1)]))


CONF = Burst(540, -200, 90, 9, spread=380)


def sc8(c, t):
    """30.8–37 · cierre."""
    X = 540
    ps.wall(c, P['cream'], hx('F6ECDC'), P['pink2'], .6)
    p = eob(prog(t, 30.85, .45), 1.6)
    chattito(c, X, 560 + (1 - p) * -900, 1.05, 'happy', t=t, happy_at=(31.35,), elated=t > 32.0)
    pw = eob(prog(t, T(15), .3), 2)
    if pw > .02:
        c.save(); c.translate(X, 900); s = min(1, 900 / tw(c, 'Chattito', 160)) * pw; c.scale(s, s)
        c.save(); c.translate(5, 7); txt(c, 'Chattito', 0, 0, 160, (0, 0, 0), a=.12); c.restore()
        txt(c, 'Chattito', 0, 0, 160, C_TEAL)
        c.restore()
    tag(c, X, 1050, ['El asistente de Flow'], 54, P['coral'], P['white'], ang=-2, sc=eob(prog(t, T(15) + .45, .3), 2))
    if t >= 34.3:
        CONF.draw(c, t - 34.3)


SUBS = []
for i, (a, b, s) in enumerate(SEG):
    nxt = SEG[i + 1][0] if i + 1 < len(SEG) else 99
    if nxt - b < 0.5:
        b = nxt - .02
    SUBS.append((a, b, s))


def subtitles(c, t):
    for a, b, s in SUBS:
        if a <= t < b:
            size = 48
            lines = [s]
            if tw(c, s, size, 'NunitoBold') > 800:
                ws = s.split(' ')
                best = min(((max(tw(c, ' '.join(ws[:k]), size, 'NunitoBold'), tw(c, ' '.join(ws[k:]), size, 'NunitoBold')),
                             [' '.join(ws[:k]), ' '.join(ws[k:])]) for k in range(1, len(ws))), key=lambda z: z[0])
                lines = best[1]
            tag(c, CX, SUB_Y, lines, size, P['paper'], P['ink'], tape=False, font='NunitoBold', pad=(30, 16))


def render(fi):
    t = fi / FPS
    ps.begin_frame(fi, textura=os.environ.get('TEX', '1') == '1')
    surf = cairo.ImageSurface(cairo.FORMAT_RGB24, W, H)
    c = cairo.Context(surf)
    if t < 3.85: sc1(c, t)
    elif t < 6.15: sc2a(c, t)
    elif t < 9.3: sc2b(c, t)
    elif t < 17.4: sc3(c, t)
    elif t < 19.95: sc4(c, t)
    elif t < 23.25: sc5(c, t)
    elif t < 26.38: sc6(c, t)
    elif t < 30.8: sc7(c, t)
    else: sc8(c, t)
    ps.S.desat = 0
    subtitles(c, t)
    surf.write_to_png(f'{OUT}/f{fi:04d}.png')


if __name__ == '__main__':
    import sys
    os.makedirs(OUT, exist_ok=True)
    if len(sys.argv) > 1:
        for x in sys.argv[1:]:
            render(int(round(float(x) * FPS)))
    else:
        a0, a1 = int(os.environ.get('A', 0)), int(os.environ.get('B', NF))
        for fi in range(a0, a1):
            if os.environ.get('SKIP') and os.path.exists(f'{OUT}/f{fi:04d}.png'):
                continue
            render(fi)
