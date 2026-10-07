"""Flow Core · TikTok 9:16 · ~51 s · usa papercut_style sin modificarlo."""
import os, math, random, cairo
import papercut_style as ps
from papercut_style import P, hx, SK, rect, rrect, ell, shape, stroke, arcp, txt, tw, tag, prog, eob, eoc, person, isotipo

W, H, FPS = ps.W, ps.H, ps.FPS
DUR = 51.0
NF = int(DUR * FPS)
OUT = os.environ.get('OUT', '/home/claude/fc_frames')
OFF = 0.3          # la voz entra a los 0.3 s (gancho inmediato)
CX = 500           # centro desplazado: deja libres ~140 px a la derecha (iconos de TikTok)
SUB_Y = 1380       # subtítulos arriba de la descripción de TikTok

SEG = [(0.1, 1.965, 'Tu negocio no cabe en un molde.'), (2.416, 5.258, 'Flow Core es el sistema que se arma a su medida.'),
       (5.75, 7.902, 'No es un programa hecho para un solo giro.'), (8.385, 9.202, 'Es una base'),
       (9.343, 11.204, 'que tú construyes con lo que necesitas:'), (11.563, 12.446, 'tus clientes,'),
       (12.627, 13.402, 'tus ventas,'), (13.574, 14.43, 'tu inventario,'), (14.631, 15.351, 'tus citas,'),
       (15.57, 16.374, 'tu facturación.'), (16.926, 18.229, 'Cada parte es un módulo.'),
       (18.565, 19.596, 'Los que ya existen,'), (19.761, 20.396, 'los usas.'), (20.736, 21.598, 'Los que te faltan,'),
       (21.803, 22.586, 'los creas tú,'), (22.909, 25.413, 'con tus propios campos y tus propias reglas.'),
       (25.679, 26.512, 'Sin programar.'), (27.041, 28.843, 'Y como todo está en el mismo lugar,'),
       (29.195, 30.1, 'todo se conecta.'), (30.508, 31.64, 'Lo que pasa en un área,'),
       (31.77, 33.027, 'se refleja en las demás.'), (33.602, 34.309, 'Un taller,'),
       (34.507, 37.53, 'una clínica y una distribuidora trabajan distinto.'), (37.999, 38.741, 'Con Flow Core,'),
       (39.074, 41.677, 'cada uno tiene un sistema que se parece a su negocio,'), (41.975, 43.191, 'no al de alguien más.'),
       (43.829, 44.511, 'Flow Core.'), (45.067, 46.0, 'Todo tu negocio,'), (46.289, 47.462, 'en un solo flujo.')]
SEG = [(a + OFF, b + OFF, s) for a, b, s in SEG]


def T(i):  # inicio de la frase i (0-based) en tiempo de video
    return SEG[i][0]


# ---------- módulos (tiles) ----------
MOD = {
    'clientes': ('Clientes', P['coral'], P['white']),
    'ventas': ('Ventas', P['mustard'], P['ink']),
    'inventario': ('Inventario', P['teal2'], P['white']),
    'citas': ('Citas', P['mint'], P['ink']),
    'facturacion': ('Facturación', P['sky'], P['ink']),
    'mimodulo': ('Mi módulo', P['teal'], P['white']),
}


def icon(c, kind, col):
    if kind == 'clientes':
        ell(c, 26, -28, 20, 20, col); ell(c, 26, 22, 32, 30, col, 180, 360)
        ell(c, -16, -20, 24, 24, col); ell(c, -16, 38, 40, 36, col, 180, 360)
    elif kind == 'ventas':
        stroke(c, arcp(0, -22, 22, 180, 360, 10), 8, col)
        rrect(c, -42, -24, 84, 70, 10, col)
    elif kind == 'inventario':
        for bx, by in [(-46, 2), (6, 2), (-20, -44)]:
            rect(c, bx, by, 42, 42, col)
            rect(c, bx + 16, by, 10, 14, P['grayD'], shadow=False, amp=.5, a=.5)
    elif kind == 'citas':
        rrect(c, -46, -40, 92, 84, 10, col)
        rect(c, -46, -40, 92, 22, P['ink'], shadow=False, amp=.6, a=.75)
        for sx in (-1, 1):
            rrect(c, sx * 24 - 5, -52, 10, 22, 5, P['ink'], shadow=False, amp=.4)
        for i in range(3):
            for j in range(2):
                rect(c, -32 + i * 24, -8 + j * 22, 14, 12, P['grayD'], shadow=False, amp=.4, a=.5)
    elif kind == 'facturacion':
        pts = [(-36, -48), (36, -48), (36, 40)]
        for i in range(6):
            pts.append((36 - (i + .5) * 12, 48 if i % 2 == 0 else 38))
        pts.append((-36, 40))
        shape(c, pts, col)
        for j in range(4):
            stroke(c, [(-22, -30 + j * 16), (22 - (j % 2) * 14, -30 + j * 16)], 5, P['grayD'], a=.6)
    elif kind == 'mimodulo':
        rect(c, -9, -40, 18, 80, col); rect(c, -40, -9, 80, 18, col)


def tile(c, x, y, kind, s=1.0, rot=0, check=0.0, a=1.0):
    if s <= .02:
        return
    lab, bg, fg = MOD[kind]
    c.save(); c.translate(x, y); c.rotate(math.radians(rot)); c.scale(s, s)
    rrect(c, -125, -105, 250, 210, 24, bg, a=a)
    c.save(); c.translate(0, -22); icon(c, kind, P['paper']); c.restore()
    txt(c, lab, 0, 72, 34 if len(lab) < 11 else 31, fg)
    if check > .02:
        c.save(); c.translate(100, -82); c.scale(check, check)
        ell(c, 0, 0, 30, 30, P['coral']); stroke(c, [(-13, 0), (-3, 11), (14, -10)], 8, P['white'])
        c.restore()
    c.restore()


def dashed_rect(c, x, y, w, h, col, dash=26):
    per = 2 * (w + h)
    n = int(per / dash)
    for i in range(0, n, 2):
        d0, d1 = i * dash, (i + 1) * dash
        def pt(d):
            d %= per
            if d < w: return (x + d, y)
            d -= w
            if d < h: return (x + w, y + d)
            d -= h
            if d < w: return (x + w - d, y + h)
            d -= w
            return (x, y + h - d)
        stroke(c, [pt(d0), pt(d1)], 6, col)


def perim_point(x, y, w, h, f):
    per = 2 * (w + h); d = (f % 1) * per
    if d < w: return (x + d, y)
    d -= w
    if d < h: return (x + w, y + d)
    d -= h
    if d < w: return (x + w - d, y + h)
    d -= w
    return (x, y + h - d)


def scissors(c, x, y, ang, op):
    c.save(); c.translate(x, y); c.rotate(ang)
    for sgn in (-1, 1):
        c.save(); c.rotate(math.radians(sgn * op))
        shape(c, [(0, -7), (110, 0), (0, 7)], P['grayD'], amp=1)
        stroke(c, arcp(-26, sgn * 16, 17, 0, 360, 12), 8, P['coral'])
        c.restore()
    c.restore()


def storefront(c, x, y, s=1.0, rot=0):
    c.save(); c.translate(x, y); c.rotate(math.radians(rot)); c.scale(s, s)
    rect(c, -150, -60, 300, 220, P['coralL'])
    rect(c, -110, 20, 90, 140, P['teal'])
    ell(c, -35, 92, 7, 7, P['mustard'], shadow=False, amp=.4)
    rect(c, 10, 10, 110, 80, P['sky'])
    rect(c, 18, 18, 30, 64, P['paper'], a=.45, shadow=False, amp=.6)
    for i in range(6):
        cc = P['coral'] if i % 2 == 0 else P['paper']
        shape(c, [(-165 + i * 55, -120), (-110 + i * 55, -120), (-110 + i * 55, -66), (-137 + i * 55, -50), (-165 + i * 55, -66)], cc)
    rrect(c, -95, -190, 190, 62, 12, P['mustard'])
    txt(c, 'Mi negocio', 0, -159, 34, P['ink'])
    c.restore()


def cap(c, x, y, s, col):
    c.save(); c.translate(x, y); c.scale(s, s)
    ell(c, 0, -40, 102, 78, col, 180, 360)
    rrect(c, -10, -52, 150, 26, 12, col)
    ell(c, 0, -118, 10, 8, P['paper'], shadow=False, amp=.4)
    c.restore()


MECH = dict(skin=SK[0], hair='curly', hc=hx('1F1717'), shirt=hx('9AA8B2'), apron=hx('2F5D8A'))
DIST = dict(skin=SK[5], hair='pony', hc=hx('2A1D18'), shirt=P['mustard'])


# ---------- escenas ----------
def sc_mold(c, t):
    ps.wall(c, P['pink'], P['pink2'], P['paper'])
    brk = prog(t, T(1), .7)
    # tablero con hueco cuadrado
    if brk < 1:
        e = eoc(brk)
        for side in (-1, 1):
            c.save()
            c.translate(CX + side * (140 + e * 520), 980 + e * e * 500)
            c.rotate(side * e * .9)
            rrect(c, -140 if side < 0 else -140, -150, 280, 300, 18, P['grayD'])
            rect(c, (60 if side < 0 else -140), -110, 80, 220, hx('5F5856'), shadow=False)
            c.restore()
        tag(c, CX, 1170, ['Molde'], 48, P['grayD'], P['white'], ang=-2, sc=1 - brk)
    # el negocio intenta entrar y rebota
    if t < T(1):
        ph = (t % 1.25) / 1.25
        y = 560 + 300 * math.sin(math.pi * min(ph * 1.6, 1)) * (1 if ph < .62 else .4)
        rot = [0, 18, -14, 9][int(t / 1.25) % 4]
        storefront(c, CX, y, .95, rot + math.sin(t * 20) * (4 if ph > .45 else 0))
    else:
        p = eob(prog(t, T(1) + .2, .5), 1.6)
        storefront(c, CX, 560 + 360 * p, .95 + .1 * p, 0)
        isotipo(c, CX, 330, 230, t=t, t0=T(1) + .45, step=.12)
        pw = eob(prog(t, T(1) + .95, .3), 2)
        if pw > .02:
            c.save(); c.translate(CX, 590); c.scale(pw, pw)
            txt(c, 'Flow Core', 0, 0, 130, P['teal']); c.restore()
        tag(c, CX, 1200, ['A tu medida'], 62, P['coral'], P['white'], ang=-2, sc=eob(prog(t, T(1) + 1.9, .3), 2))


def sc_program(c, t):
    ps.S.desat = .3
    ps.wall(c, P['pink'], P['pink2'], P['paper'], .7)
    p = eob(prog(t, 5.8, .3), 1.6)
    c.save(); c.translate(CX, 650); c.scale(p, p)
    rrect(c, -300, -230, 600, 460, 22, P['gray'])
    rect(c, -300, -230, 600, 64, P['grayD'], shadow=False)
    for i in range(3):
        ell(c, -260 + i * 36, -198, 10, 10, P['paper'], shadow=False, amp=.5)
    storefront(c, 0, 80, .7)
    c.restore()
    ps.S.desat = 0
    tag(c, CX, 400, ['Un solo giro'], 54, P['grayD'], P['white'], ang=2, sc=eob(prog(t, 6.3, .3), 2))
    for k, (ix, iy, kind) in enumerate([(150, 1060, 'w'), (500, 1100, 'd'), (850, 1060, 'b')]):
        pp = eob(prog(t, 6.6 + k * .25, .3), 2)
        if pp <= .02: continue
        c.save(); c.translate(ix if ix < 850 else 820, iy); c.scale(pp, pp)
        ell(c, 0, 0, 70, 70, P['paper'])
        if kind == 'w':
            c.save(); c.rotate(.7); rrect(c, -12, -45, 24, 90, 10, P['grayD']); ell(c, 0, -48, 24, 20, P['grayD']); c.restore()
        elif kind == 'd':
            shape(c, [(-30, -26), (-12, -36), (0, -26), (12, -36), (30, -26), (24, 6), (16, 36), (6, 10), (-6, 10), (-16, 36), (-24, 6)], P['sky'])
        else:
            for bx, by in [(-34, 0), (2, 0), (-16, -34)]:
                rect(c, bx, by, 32, 32, P['wood'])
        c.restore()
    x = eob(prog(t, T(2) + 1.65, .25), 2.4)
    if x > .02:
        c.save(); c.translate(CX, 650); c.scale(x, x)
        for r in (45, -45):
            c.save(); c.rotate(math.radians(r)); rrect(c, -330, -30, 660, 60, 20, P['red']); c.restore()
        c.restore()


TILE_POS = {'clientes': (CX - 280, 1100), 'ventas': (CX, 1100), 'inventario': (CX + 280, 1100),
            'citas': (CX - 140, 880), 'facturacion': (CX + 140, 880)}
ORDER = ['clientes', 'ventas', 'inventario', 'citas', 'facturacion']
NEW_POS = (CX, 660)


def sc_build(c, t, fi):
    ps.wall(c, P['cream'], hx('F3E6D3'), P['pink2'], .8)
    ps.bunting(c, -6, [P['coral'], P['mustard'], P['teal2'], P['mint'], P['sky']])
    person(c, 130, 600, .78, ps.OWNER, 'happy')
    bp = eob(prog(t, T(3), .35), 1.6)
    c.save(); c.translate(CX, 1255 + (1 - bp) * 400)
    rrect(c, -430, -40, 860, 84, 20, P['teal'])
    txt(c, 'Tu base', 0, 2, 44, P['white'])
    c.restore()
    for k, kind in enumerate(ORDER):
        p = prog(t, T(5 + k), .35)
        if p <= 0: continue
        x, y = TILE_POS[kind]
        e = eob(p, 1.8)
        yy = y - (1 - e) * 700
        wig = math.sin(t * 14 + k) * 3 if T(10) <= t < T(10) + .8 else 0
        ch = eob(prog(t, T(12) + k * .12, .25), 2.2)
        tile(c, x, yy, kind, 1, [-2, 1.5, -1, 2, -1.5][k] + wig, check=ch)
    # módulo nuevo: hueco punteado + tijeras + relleno
    if t >= T(13):
        nx, ny = NEW_POS
        filled = prog(t, T(13) + 1.5, .3)
        if filled < 1:
            rrect(c, nx - 125, ny - 105, 250, 210, 24, P['paper'], a=.85 - .6 * filled)
            dashed_rect(c, nx - 125, ny - 105, 250, 210, P['teal'])
            txt(c, '+', nx, ny - 8, 90, P['teal'], a=1 - filled)
        if filled > 0:
            tile(c, nx, ny, 'mimodulo', eob(filled, 2.4))
            gp = prog(t, T(13) + 1.5, .6)
            if 0 < gp < 1:
                for k in range(8):
                    a = k * math.pi / 4
                    d = 150 + 90 * gp
                    ell(c, nx + math.cos(a) * d, ny + math.sin(a) * d * .85, 12 * (1 - gp) + 2, 12 * (1 - gp) + 2, P['mustard'], shadow=False)
        cs = prog(t, T(13) + .35, 1.15)
        if 0 < cs < 1:
            sx, sy = perim_point(nx - 125, ny - 105, 250, 210, cs)
            scissors(c, sx, sy, cs * 2 * math.pi, 14 if (fi // 2) % 2 == 0 else 3)
    tag(c, CX, 420, ['Cada parte es un módulo'], 52, P['teal'], P['white'], ang=-2,
        sc=eob(prog(t, T(10), .3), 2) * (1 - prog(t, T(13) - .2, .2)))


def sc_card(c, t):
    ps.wall(c, P['mintL'], hx('CBE8DC'), P['paper'])
    p = eob(prog(t, 23.5, .3), 1.6)
    p = max(p, .01)
    p = max(p, .01)
    c.save(); c.translate(CX, 720); c.scale(p, p)
    rrect(c, -380, -450, 760, 900, 30, P['paper'])
    rect(c, -380, -450, 760, 110, P['teal'], shadow=False)
    txt(c, 'Mi módulo', 0, -395, 58, P['white'])
    ps.S.clean = True
    txt(c, 'Campos', -330, -290, 44, P['ink'], align='l')
    for i, f in enumerate(['Nombre', 'Fecha', 'Estado']):
        q = eob(prog(t, T(15) + .5 + i * .4, .25), 2)
        if q <= .02: continue
        c.save(); c.translate(0, -195 + i * 110); c.scale(q, q)
        rrect(c, -330, -40, 660, 80, 18, P['tealL'])
        txt(c, f, -300, 0, 38, P['teal'], align='l')
        stroke(c, [(-60, 18), (290, 18)], 4, P['grayD'], a=.5)
        c.restore()
    q = prog(t, T(15) + 1.6, .2)
    if q > 0:
        txt(c, 'Reglas', -330, 160, 44, P['ink'], align='l', a=q)
    for i, (lab, cc) in enumerate([('Cuando…', P['mustard']), ('Entonces…', P['coral'])]):
        q = eob(prog(t, T(15) + 1.8 + i * .35, .25), 2)
        if q <= .02: continue
        c.save(); c.translate(-170 + i * 340, 270); c.scale(q, q)
        rrect(c, -145, -48, 290, 96, 40, cc)
        txt(c, lab, 0, 0, 40, P['ink'] if i == 0 else P['white'])
        c.restore()
        if i == 1:
            c.save(); c.translate(0, 270)
            shape(c, [(-24, -9), (4, -9), (4, -22), (28, 0), (4, 22), (4, 9), (-24, 9)], P['teal'], amp=1)
            c.restore()
    ps.S.clean = False
    c.restore()
    tag(c, CX, 1250, ['Sin programar'], 70, P['coral'], P['white'], ang=-3, sc=eob(prog(t, T(16), .3), 2.2))


RING = ['clientes', 'ventas', 'inventario', 'citas', 'facturacion', 'mimodulo']
RC = (CX, 680)
RR = 350


def ring_pos(k):
    a = math.radians(-90 + k * 60)
    return RC[0] + RR * math.cos(a), RC[1] + RR * math.sin(a)


def strip(c, x0, y0, x1, y1, f, col, w=12):
    if f <= 0: return
    x1, y1 = x0 + (x1 - x0) * f, y0 + (y1 - y0) * f
    L = math.hypot(x1 - x0, y1 - y0); a = math.atan2(y1 - y0, x1 - x0)
    c.save(); c.translate(x0, y0); c.rotate(a)
    rect(c, 0, -w / 2, L, w, col, amp=1.2, seg=60)
    c.restore()


def sc_connect(c, t):
    ps.wall(c, P['cream'], hx('F6ECDC'), P['pink2'], .6)
    for k in range(6):
        x, y = ring_pos(k)
        strip(c, RC[0], RC[1], x, y, eoc(prog(t, T(17) + .1 + k * .18, .35)), P['teal2'])
    for k in range(6):
        x0, y0 = ring_pos(k); x1, y1 = ring_pos((k + 1) % 6)
        strip(c, x0, y0, x1, y1, eoc(prog(t, T(18) + k * .08, .3)), P['mustard'], 9)
    t0 = T(19)                   # ventas pulsa
    tA, tB = t0 + .45, t0 + .85  # punto viaja ventas -> Flow
    tC = tB + .35                # Flow pulsa y transmite
    tD = tC + .45                # llegan a los demás y pulsan
    vx, vy = ring_pos(1)
    # puntos: se dibujan antes que el contenedor, así quedan detrás
    if tA <= t < tB:
        f = (t - tA) / (tB - tA)
        ell(c, vx + (RC[0] - vx) * f, vy + (RC[1] - vy) * f, 20, 20, P['coral'])
    if tC <= t < tD:
        f = (t - tC) / (tD - tC)
        for k in range(6):
            if k == 1: continue
            x, y = ring_pos(k)
            ell(c, RC[0] + (x - RC[0]) * f, RC[1] + (y - RC[1]) * f, 19, 19, P['coral'])
    fs = 1.0
    if tB <= t < tC + .1:
        q = (t - tB) / (tC + .1 - tB)
        fs = 1 + .16 * math.sin(math.pi * q)
        ell(c, RC[0], RC[1], 125 * fs + 30, 125 * fs + 30, P['coral'], a=.3, shadow=False)
    ell(c, RC[0], RC[1], 125 * fs, 125 * fs, P['paper'])
    isotipo(c, RC[0] + 4, RC[1], 112 * fs)
    for k, kind in enumerate(RING):
        x, y = ring_pos(k)
        sc = .62 * eob(prog(t, 27.1 + k * .07, .3), 1.8)
        st = t0 if kind == 'ventas' else tD
        if st <= t < st + .45:
            q = (t - st) / .45
            sc *= 1 + .25 * math.sin(math.pi * q)
            ell(c, x, y, 120, 120, P['coral'], a=.35 * math.sin(math.pi * q), shadow=False)
        tile(c, x, y, kind, sc)
    tag(c, CX, 1215, ['Todo conectado'], 58, P['teal'], P['white'], ang=2, sc=eob(prog(t, T(18), .3), 2))


BIZ = [('Taller', MECH, ['clientes', 'inventario', 'facturacion'], P['sky'], 'w'),
       ('Clínica', ps.DENT, ['citas', 'clientes', 'facturacion'], P['mintL'], 'd'),
       ('Distribuidora', DIST, ['inventario', 'ventas', 'facturacion'], P['yellowL'], 'b')]


def sc_biz(c, t):
    ps.wall(c, P['pink'], P['pink2'], P['paper'], .8)
    FX, FW, FH = 60, 870, 360
    ys = [140, 505, 870]
    starts = [T(21), T(22) + .3, T(22) + 1.4]
    tstarts = [T(23) + .1, T(24) + .4, T(24) + 1.4]
    for k, (lab, who, mods, inner, ic) in enumerate(BIZ):
        p = prog(t, starts[k], .32)
        if p <= 0: continue
        e = eob(p, 1.4)
        ox = (1 - e) * 1100 * (-1 if k != 1 else 1)
        c.save(); c.translate(FX + ox + FW / 2, ys[k] + FH / 2); c.rotate(math.radians([-1.2, 1, -1][k])); c.translate(-FW / 2, -FH / 2)
        rrect(c, 0, 0, FW, FH, 22, P['woodD'])
        rrect(c, 20, 20, FW - 40, FH - 40, 14, inner, shadow=False)
        c.save(); ps.path(c, ps.rr_pts(20, 20, FW - 40, FH - 40, 14)); c.clip()
        if ic == 'w':
            c.save(); c.translate(70, 80); c.rotate(.8); rrect(c, -10, -40, 20, 80, 8, P['grayD']); ell(c, 0, -42, 20, 17, P['grayD']); c.restore()
        elif ic == 'd':
            rect(c, 52, 55, 18, 54, P['red']); rect(c, 34, 73, 54, 18, P['red'])
        else:
            for bx, by in [(40, 80), (80, 80), (60, 44)]:
                rect(c, bx, by, 38, 36, P['wood'])
        person(c, 175, 185, .7, who, 'happy')
        if who is MECH:
            cap(c, 175, 185, .7, hx('2F5D8A'))
        for j, m in enumerate(mods):
            q = eob(prog(t, tstarts[k] + j * .14, .3), 2)
            tile(c, 375 + j * 175, 190, m, .63 * q, [-3, 2, -2][j])
        c.restore()
        c.restore()
        tag(c, FX + 150, ys[k] + 18, [lab], 40, P['teal'], P['white'], ang=-3, sc=eob(prog(t, starts[k] + .2, .28), 2))
    tag(c, CX, 92, ['Se parece a tu negocio'], 46, P['coral'], P['white'], ang=2, sc=eob(prog(t, T(24) + .9, .3), 2))


CONF = []
_r = random.Random(11)
for i in range(80):
    CONF.append(dict(x=_r.uniform(0, 900), d=_r.uniform(0, 1.6), v=_r.uniform(380, 620), rot=_r.uniform(0, 6.28),
                     vr=_r.uniform(-5, 5), cc=_r.choice(['coral', 'teal', 'mustard', 'mint', 'sky', 'teal2']),
                     sh=_r.choice('rtc'), sz=_r.uniform(14, 26)))


def sc_close(c, t):
    CX = 540
    ps.wall(c, P['cream'], hx('F6ECDC'), P['pink2'], .6)
    isotipo(c, CX, 470, 330, t=t, t0=T(26) - .05, step=.14)
    pw = eob(prog(t, T(26) + .45, .3), 2)
    if pw > .02:
        c.save(); c.translate(CX, 790)
        s = min(1, 860 / tw(c, 'Flow Core', 160)) * pw
        c.scale(s, s)
        c.save(); c.translate(5, 7); txt(c, 'Flow Core', 0, 0, 160, (0, 0, 0), a=.12); c.restore()
        txt(c, 'Flow Core', 0, 0, 160, P['teal']); c.restore()
    tag(c, CX, 1030, ['Todo tu negocio,'], 60, P['coral'], P['white'], ang=-2, sc=eob(prog(t, T(27), .3), 2))
    tag(c, CX, 1150, ['en un solo flujo.'], 60, P['teal'], P['white'], ang=1.5, sc=eob(prog(t, T(28), .3), 2))
    if t >= 47.6:
        for q in CONF:
            tt = t - 47.6 - q['d']
            if tt < 0: continue
            y = -60 + tt * q['v']
            if y > H + 60: continue
            x = q['x'] + math.sin(tt * 2 + q['rot']) * 30
            c.save(); c.translate(x, y); c.rotate(q['rot'] + tt * q['vr'])
            z = q['sz']
            if q['sh'] == 'r': rect(c, -z / 2, -z * .3, z, z * .6, P[q['cc']], amp=1)
            elif q['sh'] == 't': shape(c, [(-z / 2, z / 2), (z / 2, z / 2), (0, -z / 2)], P[q['cc']], amp=1)
            else: ell(c, 0, 0, z * .4, z * .4, P[q['cc']], amp=.6)
            c.restore()


SUBS = []
for i, (a, b, s) in enumerate(SEG):
    nxt = SEG[i + 1][0] if i + 1 < len(SEG) else 99
    if nxt - b < 0.5: b = nxt - .02
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
    if t < 5.8: sc_mold(c, t)
    elif t < 8.55: sc_program(c, t)
    elif t < 23.5: sc_build(c, t, fi)
    elif t < 27.1: sc_card(c, t)
    elif t < 33.65: sc_connect(c, t)
    elif t < 43.8: sc_biz(c, t)
    else: sc_close(c, t)
    ps.S.desat = 0
    subtitles(c, t)
    surf.write_to_png(f'{OUT}/f{fi:04d}.png')


if __name__ == '__main__':
    import sys
    os.makedirs(OUT, exist_ok=True)
    if len(sys.argv) > 1:
        for x in sys.argv[1:]:
            render(int(float(x) * FPS))
    else:
        a0, a1 = int(os.environ.get('A', 0)), int(os.environ.get('B', NF))
        for fi in range(a0, a1):
            if os.environ.get('SKIP') and os.path.exists(f'{OUT}/f{fi:04d}.png'):
                continue
            render(fi)
