"""Kit de temporada en papel recortado: Día de Muertos y Halloween.
Cada función dibuja centrada en (0, 0) y cabe en ~360 × 170 (como props.py)."""
import math
import papercut_style as ps
from papercut_style import P, hx, rect, rrect, ell, shape, stroke, txt

PICADO = [P['rosamx'], P['cempa'], P['morado'], P['verdemx'], P['azulmx']]


def flor(cx, cy, r, lobes=18, k=.74):
    return [(cx + (r if i % 2 == 0 else r * k) * math.cos(2 * math.pi * i / (2 * lobes)),
             cy + (r if i % 2 == 0 else r * k) * math.sin(2 * math.pi * i / (2 * lobes))) for i in range(2 * lobes)]


def circ(cx, cy, r, n=16):
    return [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)]


def hoja(x, y, L, W, ang):
    a = math.radians(ang)
    up = [(x + L * u * math.cos(a) - W * math.sin(math.pi * u) * math.sin(a), y + L * u * math.sin(a) + W * math.sin(math.pi * u) * math.cos(a)) for u in [i / 10 for i in range(11)]]
    dn = [(x + L * u * math.cos(a) + W * math.sin(math.pi * u) * math.sin(a), y + L * u * math.sin(a) - W * math.sin(math.pi * u) * math.cos(a)) for u in [i / 10 for i in range(10, -1, -1)]]
    return up + dn


def marigold(c, x, y, r, shadow=True):
    shape(c, flor(x, y, r), P['cempa'], amp=.9, seg=60, shadow=shadow)
    shape(c, flor(x, y, r * .66, 14, .7), P['cempaD'], amp=.7, seg=60, shadow=False)
    shape(c, flor(x, y, r * .34, 10, .7), P['cempa'], amp=.5, seg=60, shadow=False)


# ================================================================== Día de Muertos
def banderita_picado(c, x, y, w, h, color, motivo):
    """Una hoja de papel picado: borde inferior en picos y calados claros (los cortes)."""
    pts = [(x, y), (x + w, y), (x + w, y + h)]
    n = 7
    for i in range(n, -1, -1):
        pts.append((x + w * i / n, y + h + (8 if i % 2 else 0)))
    shape(c, pts, color, amp=1.4)
    cx, cy = x + w / 2, y + h * .48
    hole = dict(shadow=False, a=.55, amp=.6)
    if motivo == 0:      # flor
        for k in range(6):
            a = 2 * math.pi * k / 6
            shape(c, circ(cx + 15 * math.cos(a), cy + 15 * math.sin(a), 7, 10), P['white'], **hole)
        shape(c, circ(cx, cy, 6, 10), P['white'], **hole)
    elif motivo == 1:    # calaverita
        shape(c, [(cx - 18, cy - 4), (cx - 14, cy - 18), (cx, cy - 23), (cx + 14, cy - 18), (cx + 18, cy - 4), (cx + 10, cy + 8), (cx + 8, cy + 18),
                  (cx - 8, cy + 18), (cx - 10, cy + 8)], P['white'], **hole)
        for ex in (-8, 8):
            shape(c, circ(cx + ex, cy - 6, 5, 10), color, shadow=False, amp=.4)
        shape(c, [(cx - 3, cy + 6), (cx + 3, cy + 6), (cx, cy + 1)], color, shadow=False, amp=.3)
    else:                # corazón
        shape(c, [(cx, cy + 18), (cx - 20, cy - 2), (cx - 18, cy - 15), (cx - 8, cy - 18), (cx, cy - 10), (cx + 8, cy - 18), (cx + 18, cy - 15), (cx + 20, cy - 2)],
              P['white'], **hole)
    for k in range(5):   # puntitos del borde
        shape(c, circ(x + w * (k + .5) / 5, y + 12, 3.2, 8), P['white'], **hole)
        shape(c, circ(x + w * (k + .5) / 5, y + h - 12, 3.2, 8), P['white'], **hole)


def papel_picado(c):
    stroke(c, [(-190, -70), (-95, -62), (0, -58), (95, -62), (190, -70)], 3, P['ink'], a=.6)
    for i in range(5):
        x = -185 + i * 76
        y = -66 + 4 * math.sin(math.pi * (i + .5) / 5) * 2
        banderita_picado(c, x, y, 66, 108, PICADO[i % 5], i % 3)


def cempasuchil(c):
    shape(c, hoja(-10, 70, 70, 14, -120), P['verdemx'])
    stroke(c, [(0, 80), (2, 40), (0, 10)], 7, P['verdemx'])
    shape(c, hoja(2, 55, 58, 13, -30), P['verdemx'])
    marigold(c, 0, -15, 52)


def ramo_cempasuchil(c):
    for x, a in [(-60, -100), (0, -90), (60, -80)]:
        stroke(c, [(0, 80), (x * .6, 20), (x, -10)], 6, P['verdemx'])
    shape(c, hoja(-10, 60, 70, 14, -150), P['verdemx'])
    shape(c, hoja(10, 60, 70, 14, -30), P['verdemx'])
    for x, y, r in [(-70, -14, 38), (70, -10, 38), (0, -34, 44), (-34, 18, 32), (36, 20, 32)]:
        marigold(c, x, y, r)
    shape(c, [(-30, 50), (30, 50), (22, 88), (-22, 88)], P['rosamx'])
    shape(c, [(-30, 50), (30, 50), (28, 60), (-28, 60)], hx('B8306A'), shadow=False)


def veladora(c):
    ell(c, 0, 82, 50, 10, hx('CBB8A0'), a=.6, shadow=False)
    rrect(c, -44, -20, 88, 104, 10, hx('F2E3C9'))
    rrect(c, -44, 10, 88, 44, 4, P['rosamx'], shadow=False)
    shape(c, circ(0, 32, 12, 12), P['cempa'], shadow=False, amp=.6)
    rrect(c, -34, -32, 68, 18, 6, P['vela'])
    stroke(c, [(0, -32), (0, -44)], 3, P['ink'])
    shape(c, [(0, -96), (12, -70), (14, -56), (0, -44), (-14, -56), (-12, -70)], P['llama'], amp=.8)
    shape(c, [(0, -78), (6, -62), (0, -50), (-6, -62)], P['cempa'], shadow=False, amp=.5)


def calaverita(c):
    """Calaverita de azúcar: alegre, de colores, como las de dulce del mercado."""
    shape(c, [(-62, -18), (-58, -54), (-34, -78), (0, -86), (34, -78), (58, -54), (62, -18), (52, 14), (36, 26), (36, 58), (-36, 58), (-36, 26), (-52, 14)],
          P['hueso'])
    for ex, col in [(-26, P['azulmx']), (26, P['rosamx'])]:
        shape(c, flor(ex, -14, 22, 9, .78), col, shadow=False, amp=.7)
        shape(c, circ(ex, -14, 12, 14), P['ink'], shadow=False, amp=.5)
        shape(c, circ(ex + 4, -18, 4, 8), P['white'], shadow=False, amp=.3)
    shape(c, [(0, 20), (-9, 6), (-6, 0), (0, 4), (6, 0), (9, 6)], P['morado'], shadow=False)
    for k in range(-3, 4):
        stroke(c, [(k * 9, 36), (k * 9, 52)], 2.5, hx('C8B9A2'))
    stroke(c, [(-30, 36), (30, 36)], 3, hx('C8B9A2'))
    shape(c, flor(0, -58, 14, 8, .6), P['cempa'], shadow=False, amp=.5)
    shape(c, circ(0, -58, 5, 10), P['verdemx'], shadow=False, amp=.3)
    for x, y in [(-44, -50), (44, -50), (-48, 6), (48, 6)]:
        shape(c, circ(x, y, 5, 10), P['verdemx'] if x < 0 else P['cempa'], shadow=False, amp=.3)


def pan_de_muerto(c):
    ell(c, 0, 18, 104, 56, P['pan'])
    ell(c, 0, 4, 92, 40, hx('E09E57'), shadow=False)
    for ang in (-32, 32):
        a = math.radians(ang)
        dx, dy = math.cos(a), math.sin(a) * .45
        pts = [(-78 * dx + t * 156 * dx, -78 * dy + t * 156 * dy - 4) for t in [0, 1]]
        stroke(c, pts, 16, P['panD'])
        for t in (.2, .4, .6, .8):
            ell(c, pts[0][0] + (pts[1][0] - pts[0][0]) * t, pts[0][1] + (pts[1][1] - pts[0][1]) * t, 10, 9, P['panD'], shadow=False, amp=.5)
    ell(c, 0, -10, 20, 18, P['panD'])
    for k in range(26):
        x = -80 + (k * 37) % 160
        y = -20 + (k * 23) % 50
        rect(c, x, y, 4, 4, P['white'], shadow=False, amp=.3, a=.85)


def ofrenda(c):
    """Altar de tres escalones con mantel; fotos y veladoras se ponen encima como piezas aparte."""
    for i, (w, y) in enumerate([(340, 40), (250, -10), (160, -60)]):
        rect(c, -w / 2, y, w, 52, P['vela'])
        shape(c, [(-w / 2, y), (w / 2, y), (w / 2, y + 16)] + [(w / 2 - k * w / 12, y + 16 + (8 if k % 2 else 0)) for k in range(13)],
              PICADO[i * 2 % 5], shadow=False)
    for x in (-150, -110, 110, 150):
        shape(c, circ(x, 30, 9, 10), P['llama'], shadow=False, amp=.4)
        rect(c, x - 7, 30, 14, 12, P['vela'], shadow=False)
    for x in (-95, 95):
        marigold(c, x, -20, 16)
    marigold(c, -60, -66, 13); marigold(c, 60, -66, 13)
    rrect(c, -26, -104, 52, 44, 4, P['panD'])
    rrect(c, -20, -98, 40, 32, 2, P['moradoL'], shadow=False)


def retrato(c):
    rrect(c, -62, -80, 124, 152, 10, P['panD'])
    rrect(c, -48, -66, 96, 124, 4, P['moradoL'], shadow=False)
    ell(c, 0, -22, 22, 24, P['morado'], shadow=False, a=.55)
    shape(c, [(-38, 58), (-34, 22), (-16, 8), (16, 8), (34, 22), (38, 58)], P['morado'], shadow=False, a=.55)
    for x, y in [(-58, -76), (58, -76)]:
        marigold(c, x, y, 18)


def petalos(c):
    import random
    r = random.Random(4)
    for k in range(26):
        x, y = -170 + k * 13 + r.uniform(-8, 8), 40 * math.sin(k * .45) + r.uniform(-14, 14)
        a = r.uniform(0, 360)
        shape(c, hoja(x, y, 18, 7, a), P['cempa'] if k % 4 else P['cempaD'], amp=.4)


def calaverita_literaria(c):
    shape(c, [(-120, -76), (120, -82), (126, 78), (-116, 84)], P['paper'])
    txt(c, 'Calaverita', 2, -46, 34, P['morado'])
    for k, w in enumerate([190, 160, 180, 120]):
        stroke(c, [(-95, -8 + k * 22), (-95 + w, -8 + k * 22)], 5, hx('C9BFB4'))
    for x, y, col in [(-108, -70, P['rosamx']), (110, -74, P['cempa'])]:
        shape(c, flor(x, y, 14, 9, .7), col, shadow=False, amp=.4)


MUERTOS = [('Papel picado', papel_picado, 'Ondea suave · cada hoja con su fase'),
           ('Cempasúchil', cempasuchil, 'Crece desde el tallo y gira 10°'),
           ('Ramo de cempasúchil', ramo_cempasuchil, 'Flores aparecen una por una · 0.08 s'),
           ('Veladora', veladora, 'La llama titila en cada hervor'),
           ('Calaverita de azúcar', calaverita, 'Pop con rebote, sonríe de lado'),
           ('Pan de muerto', pan_de_muerto, 'Cae en la mesa y suelta azúcar'),
           ('Ofrenda', ofrenda, 'Escalones suben de abajo hacia arriba'),
           ('Retrato', retrato, 'Se recarga en la ofrenda · sin rostro'),
           ('Pétalos', petalos, 'Camino de pétalos que se dibuja de izq. a der.'),
           ('Calaverita literaria', calaverita_literaria, 'Hoja se desliza; el texto lo pone la voz')]


# ================================================================== Halloween
def calabaza(c):
    for x, w, col in [(-56, 54, P['calabazaD']), (56, 54, P['calabazaD']), (-26, 52, P['calabaza']), (26, 52, P['calabaza']), (0, 48, P['calabaza'])]:
        ell(c, x, 10, w, 70, col)
    rrect(c, -9, -78, 18, 28, 5, hx('5E7A3A'))
    shape(c, hoja(8, -66, 40, 10, -20), P['verdemx'])
    for ex in (-30, 30):
        shape(c, [(ex - 16, 0), (ex + 16, 0), (ex, -24)], P['llama'], shadow=False)
    shape(c, [(-6, 16), (6, 16), (0, 6)], P['llama'], shadow=False)
    shape(c, [(-48, 28), (-30, 36), (-20, 30), (-10, 44), (10, 44), (20, 30), (30, 36), (48, 28), (36, 52), (0, 60), (-36, 52)], P['llama'], shadow=False)


def fantasma(c):
    pts = [(-56, 70), (-60, -20), (-46, -62), (-14, -84), (20, -82), (48, -60), (60, -20), (58, 70)]
    pts += [(58 - k * 114 / 6, 70 + (14 if k % 2 else 0)) for k in range(1, 6)]
    shape(c, pts, P['white'])
    for ex in (-20, 20):
        ell(c, ex, -26, 9, 13, P['ink'], shadow=False)
    ell(c, 0, 4, 10, 8, P['ink'], shadow=False)
    for ex in (-36, 36):
        ell(c, ex, -6, 9, 5, P['cheek'], shadow=False, a=.7)


def murcielago(c):
    def wing(sg):
        top = [(sg * 20, -14), (sg * 60, -46), (sg * 110, -52), (sg * 160, -30)]
        bot = [(sg * 150, 0), (sg * 126, -6), (sg * 112, 18), (sg * 88, 4), (sg * 66, 26), (sg * 44, 10), (sg * 20, 18)]
        return top + bot
    shape(c, wing(1), P['sombra'])
    shape(c, wing(-1), P['sombra'])
    ell(c, 0, 2, 30, 34, P['sombra'])
    shape(c, [(-22, -20), (-18, -52), (-4, -28), (4, -28), (18, -52), (22, -20)], P['sombra'])
    for ex in (-10, 10):
        ell(c, ex, -4, 6, 7, P['llama'], shadow=False)
    shape(c, [(-6, 14), (-2, 22), (2, 14)], P['white'], shadow=False, amp=.3)


def telarana(c):
    ox, oy = -150, -80
    for a in range(0, 91, 18):
        r = math.radians(a)
        stroke(c, [(ox, oy), (ox + 240 * math.cos(r), oy + 170 * math.sin(r))], 2.5, hx('B9B0CC'))
    for R in (50, 100, 150, 200):
        pts = []
        for a in range(0, 91, 18):
            r = math.radians(a)
            pts.append((ox + R * 1.15 * math.cos(r), oy + R * .82 * math.sin(r)))
        stroke(c, pts, 2.5, hx('B9B0CC'))
    stroke(c, [(70, -80), (70, 10)], 2, hx('B9B0CC'))
    ell(c, 70, 30, 18, 20, P['sombra'])
    for s in (-1, 1):
        for k in range(4):
            stroke(c, [(70 + s * 14, 22 + k * 7), (70 + s * 32, 12 + k * 12), (70 + s * 38, 30 + k * 10)], 3, P['sombra'])
    for ex in (-6, 6):
        ell(c, 70 + ex, 26, 4, 5, P['white'], shadow=False)


def sombrero_bruja(c):
    ell(c, 0, 50, 150, 26, P['bruja'])
    shape(c, [(-62, 50), (-40, -10), (-14, -60), (24, -92), (60, -100), (40, -76), (22, -40), (30, 0), (62, 50)], P['bruja'])
    shape(c, [(-56, 22), (56, 22), (60, 46), (-60, 46)], P['calabaza'], shadow=False)
    rect(c, -16, 20, 32, 28, P['llama'], shadow=False)
    rect(c, -8, 27, 16, 14, P['calabaza'], shadow=False)


def caldero(c):
    for k, (x, y, r) in enumerate([(-30, -60, 16), (10, -76, 12), (36, -56, 18), (-4, -96, 9)]):
        shape(c, circ(x, y, r, 14), P['limo'], a=.9)
    ell(c, 0, -34, 96, 18, hx('6FB53C'))
    ell(c, 0, 18, 104, 66, P['sombra'])
    ell(c, 0, -36, 100, 14, P['noche2'], shadow=False)
    for x in (-70, 70):
        stroke(c, [(x, 80), (x * 1.15, 96)], 12, P['sombra'])
    shape(c, [(-108, -40), (-90, -40), (-90, -28), (-108, -28)], P['sombra'])


def dulces(c):
    import random
    r = random.Random(7)
    cols = [P['calabaza'], P['bruja'], P['limo'], P['rosamx'], P['llama']]
    for k in range(7):
        x, y = -140 + k * 46, r.uniform(-30, 30)
        ang = r.uniform(-.5, .5)
        col = cols[k % 5]
        ca, sa = math.cos(ang), math.sin(ang)
        T = lambda px, py: (x + px * ca - py * sa, y + px * sa + py * ca)
        shape(c, [T(-36, -14), T(-20, 0), T(-36, 14)], col)
        shape(c, [T(36, -14), T(20, 0), T(36, 14)], col)
        shape(c, [T(px, py) for px, py in circ(0, 0, 18, 14)], col)
        stroke(c, [T(-8, -12), T(8, 12)], 4, P['white'], a=.7)


def luna(c):
    shape(c, circ(0, 0, 80, 28), hx('FBEFC8'))
    for x, y, r in [(-26, -18, 16), (24, 10, 22), (-8, 40, 10), (34, -36, 9)]:
        shape(c, circ(x, y, r, 14), hx('EDD9A3'), shadow=False)


def gato_negro(c):
    stroke(c, [(40, 70), (90, 60), (100, 20), (84, -2)], 14, P['sombra'])
    ell(c, 0, 30, 54, 50, P['sombra'])
    shape(c, circ(0, -40, 40, 18), P['sombra'])
    shape(c, [(-36, -56), (-32, -96), (-10, -72)], P['sombra'])
    shape(c, [(36, -56), (32, -96), (10, -72)], P['sombra'])
    for ex in (-15, 15):
        ell(c, ex, -42, 9, 11, P['limo'], shadow=False)
        ell(c, ex, -42, 3, 9, P['sombra'], shadow=False)
    shape(c, [(-5, -26), (5, -26), (0, -20)], P['rosamx'], shadow=False)


def escoba(c):
    c.save(); c.rotate(math.radians(-24))
    rrect(c, -150, -7, 220, 14, 6, P['wood'])
    shape(c, [(60, -20), (150, -48), (170, 0), (150, 48), (60, 20)], P['mustard'])
    for k in range(-3, 4):
        stroke(c, [(80, k * 4), (158, k * 12)], 2.5, hx('C9902A'))
    rect(c, 52, -22, 18, 44, P['bruja'], shadow=False)
    c.restore()


HALLOWEEN = [('Calabaza', calabaza, 'Cae y rebota; la cara se enciende'),
             ('Fantasma', fantasma, 'Flota arriba y abajo · 2 s'),
             ('Murciélago', murcielago, 'Cruza volando, alas cada 2 hervores'),
             ('Telaraña', telarana, 'Esquina; la araña baja por su hilo'),
             ('Sombrero de bruja', sombrero_bruja, 'Cae girando 20° y se asienta'),
             ('Caldero', caldero, 'Burbujas suben y revientan'),
             ('Dulces', dulces, 'Llueven en abanico'),
             ('Luna llena', luna, 'Sube por el fondo, lenta'),
             ('Gato negro', gato_negro, 'Parpadea y mueve la cola'),
             ('Escoba', escoba, 'Desliza en diagonal')]


# ================================================================== utilidades extra
def corazon(cx, cy, r, n=30):
    return [(cx + r * math.sin(a) ** 3, cy - r / 16 * (13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a)))
            for a in [2 * math.pi * k / n for k in range(n)]]


def estrella(cx, cy, R, r, n=5, rot=-90):
    return [(cx + (R if k % 2 == 0 else r) * math.cos(math.radians(rot + 180 * k / n)),
             cy + (R if k % 2 == 0 else r) * math.sin(math.radians(rot + 180 * k / n))) for k in range(2 * n)]


ROJO, VERDE, ORO, ORO_D = hx('D9433E'), hx('2F8A5B'), hx('EDB43E'), hx('C98F1E')
VERDE_MX, ROJO_MX = hx('1F7A4D'), hx('C8303A')


# ================================================================== Buen Fin
def etiqueta_descuento(c):
    shape(c, [(-110, -40), (60, -60), (120, 0), (70, 60), (-100, 50)], P['coral'])
    shape(c, circ(80, 0, 10, 12), P['paper'], shadow=False)
    txt(c, '-50%', -16, 2, 54, P['white'])


def bolsas_compras(c):
    for x, col, h in [(-70, P['teal'], 120), (40, P['mustard'], 140), (110, P['coral'], 100)]:
        stroke(c, [(x - 22, 80 - h), (x - 20, 80 - h - 30), (x + 20, 80 - h - 30), (x + 22, 80 - h)], 6, P['ink'])
        shape(c, [(x - 44, 80 - h), (x + 44, 80 - h), (x + 52, 80), (x - 52, 80)], col)


def megafono(c):
    shape(c, [(-60, -26), (60, -70), (60, 70), (-60, 26)], P['coral'])
    rrect(c, -100, -30, 44, 60, 10, P['ink'])
    rrect(c, -90, 20, 22, 54, 8, P['grayD'])
    ell(c, 60, 0, 14, 70, P['coralD'])
    for k, a in enumerate((-30, 0, 30)):
        r = math.radians(a)
        stroke(c, [(90 + 10 * math.cos(r), 40 * math.sin(r)), (124 + 26 * math.cos(r), 70 * math.sin(r))], 7, P['mustard'])


def cupon(c):
    pts = [(-130, -60), (130, -60), (130, -20)] + [(130 - 8 * ((k + 1) % 2), -20 + k * 8) for k in range(6)] + [(130, 60), (-130, 60), (-130, 20)]
    pts += [(-130 + 8 * ((k + 1) % 2), 20 - k * 8) for k in range(6)]
    shape(c, pts, P['yellowL'])
    for k in range(9):
        rect(c, -70 + 0, -50 + k * 12, 3, 6, P['grayD'], shadow=False, amp=.2)
    txt(c, 'CUPÓN', 30, -20, 34, P['coral'])
    txt(c, '2×1', 30, 26, 40, P['ink'])
    txt(c, '%', -102, 4, 44, P['teal'])


def cronometro(c):
    rrect(c, -14, -100, 28, 20, 6, P['grayD'])
    ell(c, 0, 10, 86, 86, P['coral'])
    ell(c, 0, 10, 68, 68, P['white'], shadow=False)
    for k in range(12):
        a = 2 * math.pi * k / 12
        stroke(c, [(56 * math.sin(a), 10 - 56 * math.cos(a)), (62 * math.sin(a), 10 - 62 * math.cos(a))], 3, P['ink'])
    stroke(c, [(0, 10), (0, -40)], 6, P['ink'])
    stroke(c, [(0, 10), (34, 26)], 6, P['coral'])


def ticket(c):
    pts = [(-70, -90), (70, -90), (70, 80)] + [(70 - k * 14, 80 + (10 if k % 2 else 0)) for k in range(1, 11)]
    shape(c, pts, P['white'])
    txt(c, 'TICKET', 0, -62, 22, P['ink'])
    for k in range(5):
        stroke(c, [(-50, -30 + k * 20), (10, -30 + k * 20)], 4, hx('C9BFB4'))
        stroke(c, [(28, -30 + k * 20), (50, -30 + k * 20)], 4, hx('C9BFB4'))
    stroke(c, [(-50, 72), (50, 72)], 5, P['coral'])


def tarjeta_pago(c):
    rrect(c, -120, -70, 240, 140, 16, P['teal'])
    rect(c, -120, -40, 240, 26, P['ink'], shadow=False)
    rrect(c, -96, 4, 42, 30, 6, P['mustard'], shadow=False)
    for k in range(4):
        rrect(c, -96 + k * 50, 46, 40, 10, 4, P['tealL'], shadow=False, a=.8)
    ell(c, 74, 22, 18, 18, P['coral'], shadow=False, a=.9)
    ell(c, 96, 22, 18, 18, P['mustard'], shadow=False, a=.9)


def sello_oferta(c):
    shape(c, estrella(0, 0, 92, 74, 16), P['coral'])
    shape(c, circ(0, 0, 62, 28), P['mustard'], shadow=False)
    txt(c, 'OFERTA', 0, 0, 30, P['ink'])


def caja_envio(c):
    rect(c, -90, -40, 180, 120, hx('D9A86C'))
    shape(c, [(-90, -40), (-60, -80), (120, -80), (90, -40)], hx('E8BE86'))
    shape(c, [(90, -40), (120, -80), (120, 40), (90, 80)], hx('B98450'))
    rect(c, -60, -10, 80, 50, P['white'], shadow=False)
    for k in range(4):
        stroke(c, [(-50 + k * 6, -2), (-50 + k * 6, 30)], 3, P['ink'])
    stroke(c, [(-20, 4), (14, 4)], 4, hx('C9BFB4'))


BUENFIN = [('Etiqueta de descuento', etiqueta_descuento, 'Cae girando y se clava · 0.35 s'),
           ('Bolsas de compras', bolsas_compras, 'Saltan una tras otra'),
           ('Megáfono', megafono, 'Ondas salen en 3 golpes'),
           ('Cupón', cupon, 'Se desliza y se corta por la línea'),
           ('Cronómetro', cronometro, 'Manecilla corre: ¡se acaba!'),
           ('Ticket', ticket, 'Sale de abajo como de la impresora'),
           ('Tarjeta de pago', tarjeta_pago, 'Desliza y gira 8° · genérica, sin números'),
           ('Sello de oferta', sello_oferta, 'Pop y gira lento'),
           ('Caja de envío', caja_envio, 'Cae y rebota · cierra solapas')]


# ================================================================== Navidad
def arbol(c):
    rect(c, -16, 70, 32, 26, P['wood'])
    for k, (w, y) in enumerate([(170, 80), (130, 20), (90, -40)]):
        shape(c, [(-w / 2, y), (0, y - 90), (w / 2, y)], VERDE)
    for x, y, col in [(-40, 50, ROJO), (30, 60, ORO), (-10, 0, P['sky']), (24, -14, ROJO), (-22, -52, ORO), (50, 30, P['sky'])]:
        shape(c, circ(x, y, 8, 12), col, shadow=False)
    shape(c, estrella(0, -138, 24, 10), ORO)


def esfera(c):
    stroke(c, [(0, -96), (0, -70)], 3, P['ink'])
    rrect(c, -14, -74, 28, 18, 4, ORO)
    shape(c, circ(0, 10, 72, 30), ROJO)
    shape(c, [(-70, -4), (70, -4), (70, 18), (-70, 18)], ORO, shadow=False, a=.95)
    for x in (-40, 0, 40):
        shape(c, estrella(x, 7, 9, 4), P['white'], shadow=False)
    shape(c, circ(-28, -26, 10, 12), P['white'], shadow=False, a=.6)


def nochebuena(c):
    for k in range(6):
        a = math.radians(k * 60 + 30)
        shape(c, hoja(0, 0, 90, 22, k * 60 + 30), VERDE)
    for k in range(6):
        shape(c, hoja(0, 0, 76, 24, k * 60), ROJO)
    for k in range(5):
        a = 2 * math.pi * k / 5
        shape(c, circ(10 * math.cos(a), 10 * math.sin(a), 6, 10), ORO, shadow=False)


def pinata(c):
    stroke(c, [(0, -120), (0, -60)], 3, P['ink'])
    shape(c, circ(0, 0, 54, 24), hx('F2C14E'))
    cols = [P['rosamx'], P['azulmx'], P['cempa'], P['verdemx'], P['morado'], ROJO, P['rosamx']]
    for k in range(7):
        a = math.radians(-90 + k * 51.4)
        tip = (150 * math.cos(a), 150 * math.sin(a) * .8)
        b1 = (46 * math.cos(a - .4), 46 * math.sin(a - .4)); b2 = (46 * math.cos(a + .4), 46 * math.sin(a + .4))
        shape(c, [b1, tip, b2], cols[k])
        for q in (.85, 1.0):
            pass
    shape(c, circ(0, 0, 40, 20), P['rosamx'], shadow=False)
    shape(c, estrella(0, 0, 26, 12), hx('F2C14E'), shadow=False)


def ponche(c):
    shape(c, [(-80, -30), (80, -30), (70, 60), (40, 84), (-40, 84), (-70, 60)], hx('C8693A'))
    shape(c, [(-74, -30), (74, -30), (70, -14), (-70, -14)], hx('E89A4A'), shadow=False)
    for x, col in [(-40, P['cempa']), (0, ROJO), (40, hx('E2C36B'))]:
        shape(c, circ(x, -26, 14, 12), col, shadow=False)
    stroke(c, [(56, -60), (30, -20)], 6, P['wood'])
    for k, x in enumerate((-24, 6, 34)):
        stroke(c, [(x, -50), (x + 6, -74), (x - 2, -96)], 4, P['white'], a=.6)


def baston(c):
    pts = [(14 * math.cos(a) * 1 + 0, 0) for a in []]
    path = [(30, 90), (30, -40)] + [(30 - 40 + 40 * math.cos(math.radians(a)), -40 - 40 * math.sin(math.radians(a))) for a in range(0, 181, 20)]
    stroke(c, path, 28, P['white'])
    for k in range(7):
        y = 80 - k * 20
        shape(c, [(16, y), (44, y - 12), (44, y - 4), (16, y + 8)], ROJO, shadow=False)
    for a in (30, 90, 150):
        r = math.radians(a)
        x, y = -10 + 40 * math.cos(r), -40 - 40 * math.sin(r)
        shape(c, circ(x, y, 9, 10), ROJO, shadow=False)


def bota(c):
    shape(c, [(-40, -90), (40, -90), (40, 30), (100, 40), (110, 80), (70, 96), (-40, 96)], ROJO)
    rect(c, -50, -100, 100, 34, P['white'])
    shape(c, estrella(-2, 30, 16, 7), ORO, shadow=False)
    ell(c, 88, 72, 14, 12, P['white'], shadow=False, a=.8)


def estrella_navidad(c):
    shape(c, estrella(0, 0, 90, 38), ORO)
    shape(c, estrella(0, 0, 50, 22), hx('F7D27A'), shadow=False)
    for a in (20, 160, 250):
        r = math.radians(a)
        shape(c, estrella(120 * math.cos(r), 80 * math.sin(r), 14, 6), P['white'], a=.9)


def campana(c, cinta=ROJO):
    shape(c, [(-70, 50), (-56, 30), (-50, -20), (-30, -60), (0, -70), (30, -60), (50, -20), (56, 30), (70, 50)], ORO)
    ell(c, 0, 56, 18, 16, ORO_D)
    rect(c, -68, 34, 136, 16, ORO_D, shadow=False)
    shape(c, [(-30, -68), (-80, -94), (-70, -60)], cinta)
    shape(c, [(30, -68), (80, -94), (70, -60)], cinta)
    shape(c, circ(0, -70, 14, 12), cinta)


NAVIDAD = [('Árbol de Navidad', arbol, 'Crece de abajo; la estrella cae al final'),
           ('Esfera', esfera, 'Cuelga y se mece · 2 s'),
           ('Nochebuena', nochebuena, 'Hojas abren una por una'),
           ('Piñata de picos', pinata, 'Se balancea; puede reventar en confeti'),
           ('Ponche', ponche, 'Vapor sube en hilos'),
           ('Bastón de dulce', baston, 'Pop y gira 15°'),
           ('Bota navideña', bota, 'Cae al borde y se columpia'),
           ('Estrella', estrella_navidad, 'Brilla: destellos aparecen y se van'),
           ('Campana', campana, 'Repica: balanceo 3 veces')]


# ================================================================== Día de Reyes
def rosca(c):
    ell(c, 0, 10, 150, 70, P['pan'])
    ell(c, 0, 10, 80, 30, P['paper'], shadow=False)
    ell(c, 0, 10, 150, 70, P['pan'], a=0, shadow=False)
    for k in range(8):
        a = 2 * math.pi * k / 8
        x, y = 115 * math.cos(a), 10 + 52 * math.sin(a)
        rrect(c, x - 22, y - 9, 44, 18, 8, [hx('F2C14E'), ROJO, VERDE, hx('F2C14E')][k % 4], shadow=False)
    for k in range(10):
        a = 2 * math.pi * (k + .5) / 10
        x, y = 115 * math.cos(a), 10 + 52 * math.sin(a)
        shape(c, circ(x, y, 6, 10), P['white'], shadow=False, a=.9)


def corona_reyes(c):
    shape(c, [(-90, 60), (-96, -40), (-50, 0), (-24, -70), (0, -14), (24, -70), (50, 0), (96, -40), (90, 60)], ORO)
    rect(c, -90, 32, 180, 28, ORO_D, shadow=False)
    for x, col in [(-50, ROJO), (0, P['teal2']), (50, ROJO)]:
        shape(c, circ(x, 46, 9, 12), col, shadow=False)
    for x, y in [(-96, -40), (-24, -70), (24, -70), (96, -40)]:
        shape(c, circ(x, y, 9, 12), P['white'])


def chocolate(c):
    shape(c, [(-60, -40), (60, -40), (50, 70), (-50, 70)], P['coral'])
    ell(c, 0, -40, 60, 12, hx('6B3A24'))
    stroke(c, [(60, -20), (88, -6), (86, 30), (54, 40)], 10, P['coral'])
    for k in range(4):
        rect(c, -46 + k * 26, 6, 18, 6, P['white'], shadow=False, a=.8)
    for x in (-20, 14):
        stroke(c, [(x, -60), (x + 8, -84), (x, -104)], 4, P['white'], a=.6)


def tamal(c):
    shape(c, [(-110, 10), (-70, -30), (70, -34), (120, 0), (70, 40), (-70, 44)], hx('E8D49A'))
    shape(c, [(-60, -14), (60, -18), (66, 20), (-60, 26)], hx('F4E6B4'), shadow=False)
    for k in range(5):
        stroke(c, [(-50 + k * 25, -14), (-46 + k * 25, 22)], 2.5, hx('C9B377'))
    stroke(c, [(-104, 10), (-120, 4)], 4, hx('C9B377'))


def zapatito(c):
    shape(c, [(-90, 30), (-80, -10), (-40, -20), (-10, -60), (20, -60), (30, -10), (100, 10), (110, 50), (-86, 50)], P['navy'])
    rect(c, -90, 44, 200, 14, P['ink'])
    shape(c, [(-30, -60), (50, -100), (70, -60), (10, -30)], P['white'])
    stroke(c, [(10, -76), (50, -90)], 3, hx('C9BFB4'))
    stroke(c, [(14, -64), (46, -78)], 3, hx('C9BFB4'))


def carta_reyes(c):
    rect(c, -110, -70, 220, 140, P['paper'])
    shape(c, [(-110, -70), (0, 10), (110, -70)], hx('EADBC8'), shadow=False)
    shape(c, circ(0, 10, 16, 14), ROJO, shadow=False)
    txt(c, 'Queridos Reyes', 0, 50, 22, P['morado'])


def trompo(c):
    shape(c, [(-60, -40), (60, -40), (40, 30), (0, 70), (-40, 30)], ROJO)
    for k, col in enumerate([P['white'], VERDE, P['white']]):
        y = -26 + k * 18
        shape(c, [(-58 + k * 6, y), (58 - k * 6, y), (55 - k * 7, y + 8), (-55 + k * 7, y + 8)], col, shadow=False)
    ell(c, 0, -46, 26, 10, P['wood'])
    stroke(c, [(0, 70), (0, 96)], 6, P['grayD'])


def balero(c):
    stroke(c, [(-20, -90), (-10, -20), (30, 10), (60, 0)], 3, P['ink'])
    rrect(c, -36, -110, 30, 140, 14, P['wood'])
    ell(c, 70, 20, 50, 46, ROJO)
    ell(c, 70, 20, 50, 16, P['mustard'], shadow=False)
    ell(c, 70, 20, 12, 12, P['ink'], shadow=False)


def estrella_oriente(c):
    shape(c, [(-160, 50), (-30, -16), (-20, 6)], ORO, a=.55, shadow=False)
    shape(c, [(-150, 70), (-26, 4), (-34, 20)], ORO, a=.35, shadow=False)
    shape(c, estrella(30, -10, 70, 28, 8, -90), ORO)
    shape(c, circ(30, -10, 18, 14), P['white'], shadow=False)


REYES = [('Rosca de Reyes', rosca, 'Cae en la mesa; el ate brilla'),
         ('Corona', corona_reyes, 'Baja girando y se asienta'),
         ('Chocolate caliente', chocolate, 'Vapor sube; taza tiembla al tomar'),
         ('Tamal', tamal, 'Llega el 2 de febrero: pop'),
         ('Zapatito con carta', zapatito, 'La carta se asoma y vuelve'),
         ('Carta a los Reyes', carta_reyes, 'Se abre la solapa'),
         ('Trompo', trompo, 'Gira con vaivén'),
         ('Balero', balero, 'La bola salta y entra'),
         ('Estrella de oriente', estrella_oriente, 'Cruza con su cola de luz')]


# ================================================================== 14 de febrero
ROSA, ROSA_D, ROSA_L = hx('E85C7A'), hx('C23E5E'), hx('F9D6DA')


def globo_corazon(c):
    stroke(c, [(0, 70), (-10, 100), (6, 130)], 3, P['ink'])
    shape(c, corazon(0, -10, 80), ROJO)
    shape(c, [(-8, 70), (8, 70), (0, 80)], ROJO_MX)
    shape(c, hoja(-40, -50, 26, 8, -40), P['white'], shadow=False, a=.55)


def rosa(c):
    stroke(c, [(0, 100), (4, 40), (0, -10)], 7, VERDE)
    shape(c, hoja(2, 60, 48, 13, -20), VERDE)
    shape(c, hoja(0, 36, 48, 13, 200), VERDE)
    shape(c, [(-38, -30), (-40, -70), (-14, -58), (0, -84), (14, -58), (40, -70), (38, -30), (0, -6)], ROJO)
    shape(c, [(-20, -50), (0, -64), (20, -50), (12, -34), (-12, -34)], ROJO_MX, shadow=False)


def ramo_rosas(c):
    shape(c, [(-90, -20), (90, -20), (20, 100), (-20, 100)], hx('F7E9EC'))
    for x, y in [(-50, -40), (0, -60), (50, -40), (-24, -10), (26, -12)]:
        shape(c, corazon(x, y, 24, 20), ROJO)
        shape(c, circ(x, y - 4, 9, 10), ROJO_MX, shadow=False)
    shape(c, [(-24, 40), (24, 40), (40, 70), (0, 56), (-40, 70)], ROSA)


def carta_amor(c):
    rect(c, -110, -70, 220, 140, P['white'])
    shape(c, [(-110, -70), (0, 14), (110, -70)], ROSA_L, shadow=False)
    shape(c, corazon(0, 10, 22), ROJO, shadow=False)


def caja_chocolates(c):
    shape(c, corazon(0, -6, 110), ROJO)
    shape(c, corazon(0, -6, 88), hx('6B3A24'), shadow=False)
    for x, y in [(-40, -40), (0, -24), (40, -40), (-20, 14), (20, 14), (0, 50)]:
        shape(c, circ(x, y, 14, 12), hx('8A4E30'), shadow=False)
        shape(c, circ(x - 3, y - 4, 4, 8), hx('B07650'), shadow=False)


def osito(c):
    ell(c, 0, 50, 60, 52, hx('B07650'))
    for x in (-50, 50):
        ell(c, x, 92, 22, 16, hx('B07650'))
    for x in (-44, 44):
        ell(c, x, -78, 18, 18, hx('B07650'))
    ell(c, 0, -40, 54, 48, hx('B07650'))
    ell(c, 0, -26, 22, 16, hx('E2C29E'), shadow=False)
    ell(c, 0, -34, 7, 5, P['ink'], shadow=False)
    for x in (-18, 18):
        ell(c, x, -52, 5, 6, P['ink'], shadow=False)
    shape(c, corazon(0, 46, 28), ROJO)


def flecha_cupido(c):
    stroke(c, [(-150, 40), (130, -30)], 6, P['wood'])
    shape(c, [(130, -30), (100, -46), (108, -24), (96, -10)], P['grayD'])
    for k in range(3):
        x, y = -150 + k * 12, 40 - k * 3
        shape(c, [(x, y), (x - 20, y - 18), (x + 6, y - 6)], ROSA, shadow=False)
        shape(c, [(x, y), (x - 16, y + 18), (x + 8, y + 2)], ROSA, shadow=False)
    shape(c, corazon(-10, 0, 46), ROJO)


def corazones(c):
    for x, y, r, col in [(-90, 20, 44, ROSA), (0, -10, 64, ROJO), (90, 24, 40, ROSA_L), (40, 70, 22, ROSA), (-40, -70, 20, ROSA_L)]:
        shape(c, corazon(x, y, r), col)


def taza_amor(c):
    rrect(c, -60, -60, 120, 130, 14, P['white'])
    stroke(c, [(60, -30), (92, -20), (92, 24), (60, 36)], 12, P['white'])
    shape(c, corazon(0, 4, 30), ROJO, shadow=False)
    for x in (-18, 18):
        stroke(c, [(x, -70), (x + 8, -92), (x, -112)], 4, P['grayD'], a=.5)


FEBRERO = [('Globo de corazón', globo_corazon, 'Sube flotando y se mece'),
           ('Rosa', rosa, 'Crece y abre'),
           ('Ramo de rosas', ramo_rosas, 'Sube desde abajo · rosas pop'),
           ('Carta de amor', carta_amor, 'Se abre y sale el corazón'),
           ('Caja de chocolates', caja_chocolates, 'Tapa se levanta'),
           ('Osito', osito, 'Saltito y abraza el corazón'),
           ('Flecha de Cupido', flecha_cupido, 'Cruza y se clava'),
           ('Corazones', corazones, 'Laten en cadena · 1.2 s'),
           ('Taza de amor', taza_amor, 'Vapor en forma de hilos')]


# ================================================================== 10 de mayo
LILA, LILA_D = hx('C9A7E0'), hx('9C74BE')


def flor_simple(c, x, y, r, col, centro=None):
    for a in range(0, 360, 60):
        q = math.radians(a)
        shape(c, circ(x + r * .8 * math.cos(q), y + r * .8 * math.sin(q), r * .62, 12), col)
    shape(c, circ(x, y, r * .5, 12), centro or P['mustard'], shadow=False)


def ramo_flores(c):
    for x in (-50, -10, 30, 60):
        stroke(c, [(0, 90), (x, -10)], 5, VERDE)
    shape(c, hoja(-10, 40, 60, 14, -150), VERDE)
    shape(c, hoja(10, 40, 60, 14, -30), VERDE)
    for x, y, r, col in [(-60, -30, 30, P['rosamx']), (0, -56, 34, LILA), (56, -30, 30, P['coral']), (-24, 0, 26, P['mustard']), (30, 4, 26, P['rosamx'])]:
        flor_simple(c, x, y, r, col)
    shape(c, [(-36, 50), (36, 50), (24, 100), (-24, 100)], P['sky'])


def tarjeta_mama(c):
    shape(c, [(-120, -76), (0, -86), (0, 84), (-116, 80)], P['paper'])
    shape(c, [(0, -86), (120, -76), (116, 80), (0, 84)], LILA)
    txt(c, 'Mamá', -58, 0, 38, P['rosamx'])
    shape(c, corazon(60, -4, 34), P['rosamx'], shadow=False)


def pastel(c):
    rect(c, -100, 10, 200, 70, P['coralL'])
    rect(c, -76, -50, 152, 62, P['pink'])
    shape(c, [(-100, 10)] + [(-100 + k * 20, 10 + (16 if k % 2 else 0)) for k in range(11)] + [(100, 10)], P['white'], shadow=False)
    shape(c, [(-76, -50)] + [(-76 + k * 15.2, -50 + (12 if k % 2 else 0)) for k in range(11)] + [(76, -50)], P['white'], shadow=False)
    for x in (-40, 0, 40):
        rect(c, x - 5, -96, 10, 44, P['sky'])
        shape(c, [(x, -116), (x + 7, -100), (x, -94), (x - 7, -100)], P['llama'])


def taza_mama(c):
    rrect(c, -60, -60, 120, 130, 14, LILA)
    stroke(c, [(60, -30), (92, -20), (92, 24), (60, 36)], 12, LILA)
    txt(c, 'MAMÁ', 0, 4, 30, P['white'])
    shape(c, corazon(0, 42, 12), P['rosamx'], shadow=False)


def perfume(c):
    rrect(c, -64, -30, 128, 120, 26, hx('F4C6D6'))
    rrect(c, -46, -10, 92, 80, 18, hx('FBE3EB'), shadow=False)
    rect(c, -20, -64, 40, 36, P['mustard'])
    ell(c, 0, -84, 26, 20, LILA_D)
    shape(c, hoja(-36, 40, 30, 8, -60), P['white'], shadow=False, a=.6)


def guitarra(c):
    c.save(); c.rotate(math.radians(-30))
    rrect(c, -8, -150, 16, 120, 4, P['woodD'])
    rrect(c, -18, -176, 36, 34, 8, P['ink'])
    ell(c, 0, 10, 62, 56, P['wood'])
    ell(c, 0, -40, 48, 44, P['wood'])
    ell(c, 0, -8, 18, 18, P['ink'], shadow=False)
    rect(c, -24, 40, 48, 8, P['ink'], shadow=False)
    for k in (-6, -2, 2, 6):
        stroke(c, [(k, -150), (k, 44)], 1.4, P['white'], a=.8)
    c.restore()


def bandeja(c):
    shape(c, [(-140, 40), (140, 40), (120, 70), (-120, 70)], P['wood'])
    rrect(c, -110, 0, 60, 40, 12, P['white'])
    shape(c, circ(-80, 4, 22, 14), hx('E8B03A'), shadow=False)
    rrect(c, -30, -26, 40, 66, 8, P['cempa'])
    rrect(c, 30, -6, 64, 46, 10, P['white'])
    stroke(c, [(94, 6), (110, 14), (94, 30)], 6, P['white'])
    flor_simple(c, 0, -60, 16, P['rosamx'])
    stroke(c, [(0, -44), (-10, -26)], 3, VERDE)


def maceta(c):
    shape(c, [(-60, 20), (60, 20), (48, 100), (-48, 100)], P['coral'])
    rect(c, -68, 10, 136, 20, P['coralD'])
    for x in (-30, 0, 30):
        stroke(c, [(x * .4, 14), (x, -40)], 5, VERDE)
    for x, y, col in [(-34, -50, P['rosamx']), (0, -74, LILA), (34, -50, P['mustard'])]:
        flor_simple(c, x, y, 22, col, centro=P['white'])


MAYO = [('Ramo de flores', ramo_flores, 'Flores abren de una en una'),
        ('Tarjeta para mamá', tarjeta_mama, 'Se abre como libro'),
        ('Pastel', pastel, 'Velitas se encienden en cadena'),
        ('Taza de mamá', taza_mama, 'Pop · vapor sube'),
        ('Perfume', perfume, 'Brilla y suelta destellos'),
        ('Guitarra', guitarra, 'Serenata: vibra al compás'),
        ('Desayuno en bandeja', bandeja, 'Desliza desde la orilla'),
        ('Maceta con flores', maceta, 'Crece la planta'),
        ('Corazones para mamá', corazones, 'Laten en cadena · 1.2 s')]


# ================================================================== 16 de septiembre (sin escudo ni bandera: solo los colores)
def banderines_tricolor(c):
    stroke(c, [(-190, -60), (0, -40), (190, -60)], 3, P['ink'], a=.6)
    for i in range(7):
        x = -165 + i * 55
        y = -60 + 20 * math.sin(math.pi * (i + .5) / 7)
        shape(c, [(x - 24, y), (x + 24, y), (x, y + 64)], [VERDE_MX, P['white'], ROJO_MX][i % 3])


def sombrero_charro(c):
    PAL, PALD = hx('E2BE7E'), hx('B98B4A')
    shape(c, [(-170, 40), (-150, 14), (-90, 30), (0, 34), (90, 30), (150, 14), (170, 40), (130, 62), (0, 70), (-130, 62)], PAL)
    shape(c, [(-56, 34), (-52, -30), (-30, -70), (0, -78), (30, -70), (52, -30), (56, 34)], PAL)
    rect(c, -54, 4, 108, 24, PALD, shadow=False)
    for k in range(9):
        shape(c, [(-48 + k * 12, 6), (-42 + k * 12, 16), (-48 + k * 12, 26)], P['mustard'], shadow=False)


def pozole(c):
    shape(c, [(-110, -10), (110, -10), (90, 60), (50, 80), (-50, 80), (-90, 60)], ROJO_MX)
    ell(c, 0, -10, 110, 22, hx('B24A2A'))
    for x, y in [(-60, -14), (-30, -6), (0, -16), (30, -8), (60, -14), (-14, -2), (44, -2)]:
        shape(c, circ(x, y, 7, 10), P['white'], shadow=False)
    for x, y in [(-44, -20), (20, -22)]:
        shape(c, hoja(x, y, 24, 8, -20), P['verdemx'], shadow=False)
    shape(c, [(70, -26), (96, -28), (90, -14)], P['white'], shadow=False)


def chiles_nogada(c):
    ell(c, 0, 30, 150, 46, P['white'])
    shape(c, [(-110, 20), (-60, -20), (40, -26), (110, -6), (120, 20), (60, 40), (-60, 44)], hx('3E7A3A'))
    ell(c, 0, 4, 100, 26, hx('F4EEDC'), shadow=False)
    for x, y in [(-60, -2), (-30, 10), (0, -6), (30, 8), (60, 0), (14, 16), (-14, -12)]:
        shape(c, circ(x, y, 5, 8), ROJO_MX, shadow=False)
    for x, y in [(-44, 12), (40, -4)]:
        shape(c, hoja(x, y, 16, 6, 30), VERDE, shadow=False)
    stroke(c, [(110, -6), (140, -24)], 6, hx('5E7A3A'))


def elote(c):
    c.save(); c.rotate(math.radians(-20))
    shape(c, hoja(-30, 70, 90, 30, -100), VERDE)
    shape(c, hoja(30, 70, 90, 30, -80), VERDE)
    rrect(c, -34, -90, 68, 170, 34, hx('F2C94E'))
    for r in range(8):
        for k in range(3):
            shape(c, circ(-16 + k * 16, -70 + r * 20, 6, 8), hx('E0A92A'), shadow=False, a=.8)
    stroke(c, [(0, 80), (0, 130)], 10, P['wood'])
    c.restore()


def matraca(c):
    """Matraca de madera (sin franjas: no debe parecer bandera)."""
    rrect(c, -10, -30, 20, 130, 6, P['woodD'])
    rrect(c, -4, -66, 136, 48, 8, P['wood'])
    rect(c, 10, -56, 110, 8, P['woodD'], shadow=False)
    shape(c, [(26 * math.cos(math.radians(a)) * (1 if k % 2 else .78), -42 + 26 * math.sin(math.radians(a)) * (1 if k % 2 else .78))
              for k, a in enumerate(range(0, 360, 30))], P['grayD'])
    shape(c, circ(0, -42, 7, 10), P['ink'], shadow=False)
    shape(c, [(128, -62), (160, -90), (154, -52)], VERDE_MX)
    shape(c, [(128, -28), (164, -18), (146, -2)], ROJO_MX)


def cohetes(c):
    for x, y, r, col in [(-80, -20, 60, VERDE_MX), (40, -50, 70, ROJO_MX), (90, 40, 46, P['mustard'])]:
        for k in range(12):
            a = 2 * math.pi * k / 12
            stroke(c, [(x + r * .3 * math.cos(a), y + r * .3 * math.sin(a)), (x + r * math.cos(a), y + r * math.sin(a))], 5, col)
        shape(c, circ(x, y, 8, 10), P['white'], shadow=False)


def campana_dolores(c):
    campana(c, cinta=VERDE_MX)
    shape(c, [(-30, -68), (-80, -94), (-56, -80)], P['white'], shadow=False)
    shape(c, [(30, -68), (80, -94), (56, -80)], ROJO_MX, shadow=False)


def rehilete(c):
    stroke(c, [(0, 0), (0, 130)], 7, P['wood'])
    for k, col in enumerate([VERDE_MX, P['white'], ROJO_MX, P['white']]):
        a = math.radians(k * 90)
        p1 = (0, 0)
        p2 = (80 * math.cos(a), 80 * math.sin(a))
        p3 = (60 * math.cos(a + 1.1), 60 * math.sin(a + 1.1))
        shape(c, [p1, p2, p3], col)
    shape(c, circ(0, 0, 8, 10), P['mustard'], shadow=False)


SEPTIEMBRE = [('Banderines tricolor', banderines_tricolor, 'Ondean · solo los colores, sin escudo'),
              ('Sombrero de charro', sombrero_charro, 'Cae girando y se asienta'),
              ('Pozole', pozole, 'Vapor sube; rábanos pop'),
              ('Chiles en nogada', chiles_nogada, 'Granada cae en lluvia'),
              ('Elote', elote, 'Pop con rebote'),
              ('Matraca', matraca, 'Gira y suena: vibra rápido'),
              ('Cohetes', cohetes, 'Estallan en secuencia'),
              ('Campana de Dolores', campana_dolores, 'Repica: el «Grito»'),
              ('Rehilete', rehilete, 'Gira sin parar')]
