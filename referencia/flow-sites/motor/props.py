"""Utilería en papel recortado. Cada función dibuja centrada en (0, 0) y cabe en ~360 × 170."""
import math
import papercut_style as ps
from papercut_style import P, hx, rect, rrect, ell, shape, stroke, txt

WOOD, WOODD, KRAFT, KRAFTD = P['wood'], P['woodD'], hx('D9A86C'), hx('B98450')
GREEN, GREEND, LEAF = hx('4E9A5B'), hx('2F6F45'), hx('7CC47F')


def caja(c):
    rect(c, -80, -55, 160, 120, KRAFT)
    rect(c, -80, -55, 160, 30, KRAFTD, shadow=False)
    rect(c, -16, -55, 32, 64, P['yellowL'], shadow=False, amp=.8)
    stroke(c, [(-60, 40), (-30, 40)], 4, KRAFTD)


def cajas_apiladas(c):
    for x, y, w in [(-95, -5, 110), (15, -5, 110), (-40, -105, 110)]:
        rect(c, x, y, w, 90, KRAFT)
        rect(c, x, y, w, 22, KRAFTD, shadow=False)
        rect(c, x + w / 2 - 12, y, 24, 46, P['yellowL'], shadow=False, amp=.6)


def cruz_roja(c):
    rrect(c, -75, -75, 150, 150, 26, P['white'])
    rect(c, -18, -55, 36, 110, P['red'], shadow=False)
    rect(c, -55, -18, 110, 36, P['red'], shadow=False)


def llave_hex(c):
    """Llave española (de boca) con cabeza hexagonal."""
    c.save(); c.rotate(math.radians(-30))
    rrect(c, -95, -13, 150, 26, 12, P['grayD'])
    hexa = [(70 + 40 * math.cos(math.radians(a)), 40 * math.sin(math.radians(a))) for a in range(0, 360, 60)]
    ps.group_begin()
    shape(c, hexa, P['grayD'])
    ell(c, -100, 0, 30, 30, P['grayD'])
    ps.group_end(c, P['grayD'])
    shape(c, [(70 + 22 * math.cos(math.radians(a)), 22 * math.sin(math.radians(a))) for a in range(0, 360, 60)], P['cream'], shadow=False)
    shape(c, [(-130, -12), (-100, -12), (-100, 12), (-130, 12)], P['cream'], shadow=False)
    c.restore()


def muela(c):
    shape(c, [(-55, -50), (-25, -66), (0, -52), (25, -66), (55, -50), (50, 0), (36, 70), (14, 18), (-14, 18), (-36, 70), (-50, 0)], hx('E4ECF2'))
    shape(c, [(-30, -40), (-12, -48), (-8, -30), (-26, -24)], P['sky'], shadow=False, a=.7)


def poste_barberia(c):
    rrect(c, -30, -80, 60, 160, 10, P['white'])
    for k in range(4):
        y = -70 + k * 40
        shape(c, [(-30, y), (30, y - 22), (30, y), (-30, y + 22)], P['red'] if k % 2 == 0 else P['sky'], shadow=False)
    rrect(c, -40, -96, 80, 20, 8, P['grayD'])
    rrect(c, -40, 76, 80, 20, 8, P['grayD'])


def carpeta(c):
    shape(c, [(-90, -50), (-30, -50), (-15, -66), (40, -66), (40, -50), (90, -50), (90, 60), (-90, 60)], P['mustard'])
    rect(c, -75, -38, 150, 10, P['white'], shadow=False)
    rect(c, -90, -30, 180, 90, hx('F2C55C'))


def celular(c):
    rrect(c, -48, -85, 96, 170, 16, P['ink'])
    rrect(c, -40, -74, 80, 148, 10, P['paper'], shadow=False)
    rect(c, -40, -74, 80, 24, P['teal'], shadow=False, amp=.6)
    for k, col in enumerate([P['coral'], P['mint'], P['mustard']]):
        rrect(c, -32, -40 + k * 34, 64, 24, 6, col, shadow=False, amp=.6)


def laptop(c):
    rrect(c, -110, -80, 220, 140, 10, P['ink'])
    rect(c, -98, -68, 196, 116, P['paper'], shadow=False)
    rect(c, -98, -68, 196, 22, P['teal'], shadow=False, amp=.6)
    for k, col in enumerate([P['coral'], P['teal2'], P['mustard']]):
        rrect(c, -86 + k * 62, -34, 50, 64, 6, col, shadow=False, amp=.6)
    shape(c, [(-140, 60), (140, 60), (125, 82), (-125, 82)], P['grayD'])


def calendario(c):
    rrect(c, -80, -70, 160, 145, 12, P['white'])
    rect(c, -80, -70, 160, 36, P['coral'], shadow=False, amp=.8)
    for sx in (-1, 1):
        rrect(c, sx * 40 - 7, -84, 14, 30, 7, P['ink'], shadow=False)
    for i in range(4):
        for j in range(3):
            col = P['teal'] if (i, j) == (2, 1) else P['gray']
            rect(c, -60 + i * 32, -20 + j * 28, 20, 18, col, shadow=False, amp=.5)


def sobre(c):
    rect(c, -90, -55, 180, 115, hx('F1E6D2'))
    shape(c, [(-90, -55), (0, 15), (90, -55)], hx('E3D3B8'), shadow=False)
    ell(c, 60, 30, 18, 18, P['coral'], shadow=False)


def foco(c):
    ell(c, 0, -20, 58, 62, P['mustard'])
    rect(c, -26, 34, 52, 16, P['grayD'])
    rect(c, -22, 52, 44, 12, P['grayD'], shadow=False)
    stroke(c, [(-14, -10), (-4, 14), (6, -6), (14, 14)], 5, hx('C98A1B'))
    for a in (-150, -90, -30):
        r = math.radians(a)
        stroke(c, [(80 * math.cos(r), -20 + 80 * math.sin(r)), (100 * math.cos(r), -20 + 100 * math.sin(r))], 7, P['mustard'])


def lupa(c):
    c.save(); c.rotate(math.radians(35))
    rrect(c, 40, -12, 90, 24, 12, P['woodD'])
    c.restore()
    ell(c, -15, -10, 62, 62, P['grayD'])
    ell(c, -15, -10, 48, 48, P['sky'], shadow=False)
    ell(c, -32, -28, 12, 8, P['white'], shadow=False, a=.8)


def billete(c):
    for k in (1, 0):
        c.save(); c.translate(k * 18, -k * 14); c.rotate(math.radians(-6 + k * 8))
        rrect(c, -100, -48, 200, 96, 10, hx('8CC9A2'))
        ell(c, 0, 0, 30, 30, hx('5FAE80'), shadow=False)
        txt(c, '$', 0, 0, 36, P['white'])
        c.restore()


def monedas(c):
    for x, y in [(-50, 20), (10, 30), (60, 10), (-10, -20)]:
        ell(c, x, y, 40, 40, P['mustard'])
        ell(c, x, y, 28, 28, hx('F2C55C'), shadow=False)
        txt(c, '$', x, y, 26, hx('B5821A'))


def carrito(c):
    shape(c, [(-90, -50), (90, -50), (70, 30), (-70, 30)], P['coral'])
    for k in range(3):
        stroke(c, [(-70 + k * 50, -40), (-55 + k * 40, 22)], 4, P['white'], a=.7)
    stroke(c, [(-90, -50), (-110, -75), (-130, -75)], 8, P['grayD'])
    for x in (-50, 50):
        ell(c, x, 58, 18, 18, P['ink'])


def bolsa_mandado(c):
    stroke(c, [(-40, -50), (-40, -80), (40, -80), (40, -50)], 9, KRAFTD)
    shape(c, [(-80, -50), (80, -50), (68, 75), (-68, 75)], KRAFT)
    for x, col in [(-30, GREEN), (5, P['red']), (34, LEAF)]:
        ell(c, x, -55, 22, 26, col)


def regalo(c):
    rect(c, -75, -30, 150, 105, P['teal2'])
    rect(c, -85, -55, 170, 32, P['teal'])
    rect(c, -14, -55, 28, 130, P['coral'], shadow=False)
    for sx in (-1, 1):
        ell(c, sx * 26, -68, 26, 16, P['coral'])


def corazon(c):
    pts = []
    for k in range(40):
        t = 2 * math.pi * k / 40
        pts.append((4.2 * 16 * math.sin(t) ** 3, -4.2 * (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))))
    shape(c, pts, P['coral'])
    ell(c, -30, -30, 14, 9, P['white'], shadow=False, a=.6)


def taza_cafe(c):
    ps.group_begin()
    rrect(c, -60, -50, 120, 110, 18, P['teal2'])
    ell(c, 66, 4, 30, 32, P['teal2'])
    ps.group_end(c, P['teal2'])
    ell(c, 66, 4, 16, 18, P['paper'], shadow=False)
    ell(c, 0, -46, 56, 12, hx('7A4A2E'), shadow=False)
    for x in (-20, 10):
        stroke(c, [(x, -70), (x + 8, -85), (x, -100)], 6, P['grayD'], a=.5)


def planta(c):
    for a, l, col in [(-60, 95, GREEN), (-20, 110, LEAF), (20, 105, GREEN), (60, 90, LEAF), (0, 80, GREEND)]:
        r = math.radians(a - 90)
        tx, ty = l * math.cos(r), -10 + l * math.sin(r)
        nx, ny = -math.sin(r) * 16, math.cos(r) * 16
        shape(c, [(0, -10), (tx * .5 + nx, ty * .5 + ny), (tx, ty), (tx * .5 - nx, ty * .5 - ny)], col)
    shape(c, [(-55, -10), (55, -10), (42, 80), (-42, 80)], P['coral'])
    rect(c, -62, -18, 124, 20, P['coralD'])


def cactus(c):
    ps.group_begin()
    rrect(c, -22, -90, 44, 150, 22, GREEN)
    rrect(c, -62, -40, 30, 60, 15, GREEN)
    rrect(c, -40, 2, 30, 18, 6, GREEN)
    rrect(c, 32, -60, 30, 60, 15, GREEN)
    rrect(c, 12, -18, 30, 18, 6, GREEN)
    ps.group_end(c, GREEN)
    shape(c, [(-50, 50), (50, 50), (40, 95), (-40, 95)], P['mustard'])
    ell(c, 0, -96, 12, 12, P['coral'], shadow=False)


def lechuga(c):
    for k, (r, col) in enumerate([(75, GREEND), (62, GREEN), (48, LEAF), (30, hx('B9E3A8'))]):
        pts = [((r + (8 if j % 2 else 0)) * math.cos(2 * math.pi * j / 18), (r + (8 if j % 2 else 0)) * .8 * math.sin(2 * math.pi * j / 18) + 4)
               for j in range(18)]
        shape(c, pts, col, shadow=k == 0)


def zanahorias(c):
    for k, (x, rot) in enumerate([(-45, -14), (5, 4), (55, 18)]):
        c.save(); c.translate(x, 10); c.rotate(math.radians(rot))
        shape(c, [(-20, -45), (20, -45), (0, 70)], hx('F08A3C'))
        for a in (-25, 0, 25):
            r = math.radians(a - 90)
            shape(c, [(-5, -45), (5, -45), (50 * math.cos(r), -45 + 50 * math.sin(r))], GREEN)
        c.restore()


def jitomates(c):
    for x, y, r in [(-48, 20, 48), (40, 26, 44), (-2, -30, 42)]:
        ell(c, x, y, r, r * .92, P['red'])
        shape(c, [(x - 16, y - r * .85), (x, y - r * .7 - 10), (x + 16, y - r * .85), (x, y - r * .8)], GREEN, shadow=False)
        ell(c, x - r * .4, y - r * .3, 8, 5, P['white'], shadow=False, a=.5)


def huevos(c):
    rect(c, -120, 10, 240, 60, hx('C9AE86'))
    for x in (-80, -27, 27, 80):
        ell(c, x, -2, 30, 38, hx('FFF6E8'))
    for x in (-80, -27, 27, 80):
        ell(c, x, 30, 24, 14, hx('B0946C'), shadow=False)


def leche(c):
    shape(c, [(-50, -40), (0, -80), (50, -40), (50, 85), (-50, 85)], P['white'])
    shape(c, [(-50, -40), (0, -80), (50, -40)], P['sky'], shadow=False)
    rect(c, -50, 10, 100, 40, P['sky'], shadow=False, amp=.8)
    txt(c, 'LECHE', 0, 30, 22, P['teal'])
    rect(c, -12, -92, 24, 16, P['teal'], shadow=False)


def pan(c):
    ell(c, 0, 10, 105, 60, hx('D9A066'))
    for x in (-50, 0, 50):
        stroke(c, [(x - 18, -10), (x + 18, 30)], 8, hx('F2CC8F'))


def manzanas(c):
    for x, col in [(-45, P['red']), (45, hx('9BCB5C'))]:
        ell(c, x, 15, 50, 46, col)
        stroke(c, [(x, -28), (x + 5, -48)], 6, P['woodD'])
        shape(c, [(x + 6, -40), (x + 34, -52), (x + 16, -30)], GREEN, shadow=False)


PROPS = [('Caja', caja, 'Cae y rebota en la mesa'), ('Cajas apiladas', cajas_apiladas, 'Caen una por una · 0.15 s'),
         ('Cruz roja', cruz_roja, 'Pop con rebote · clínica'), ('Llave hexagonal', llave_hex, 'Gira un cuarto al entrar · taller'),
         ('Muela', muela, 'Pop con rebote · dentista'), ('Poste de barbería', poste_barberia, 'Las franjas suben en bucle'),
         ('Carpeta', carpeta, 'Se abre y asoma la hoja · asesoría'), ('Celular', celular, 'Vibra o desliza desde abajo'),
         ('Laptop', laptop, 'La pantalla se enciende al entrar'), ('Calendario', calendario, 'El día se marca con pop'),
         ('Sobre', sobre, 'Desliza y se abre la solapa'), ('Foco', foco, 'Se prende con destellos · idea'),
         ('Lupa', lupa, 'Recorre la escena buscando'), ('Billetes', billete, 'Caen en abanico'),
         ('Monedas', monedas, 'Caen y tintinean · 0.08 s c/u'), ('Carrito', carrito, 'Rueda desde la izquierda'),
         ('Bolsa del mandado', bolsa_mandado, 'Cae y asoman las verduras'), ('Regalo', regalo, 'El moño salta al abrir'),
         ('Corazón', corazon, 'Late dos veces · 14 de febrero'), ('Taza de café', taza_cafe, 'El vapor sube en bucle'),
         ('Planta', planta, 'Las hojas se mecen'), ('Cactus', cactus, 'Pop · decoración mexicana'),
         ('Lechuga', lechuga, 'Capas que crecen desde el centro'), ('Zanahorias', zanahorias, 'Caen una por una'),
         ('Jitomates', jitomates, 'Ruedan y se acomodan'), ('Huevos', huevos, 'Asoman del cartón uno por uno'),
         ('Leche', leche, 'Cae y se asienta'), ('Pan', pan, 'Pop con rebote'), ('Manzanas', manzanas, 'Caen y rebotan')]
