"""Construye FlowPublicidad.pen (biblioteca de identidad publicitaria de Flow)."""
import json, os, sys, copy, math, re
import cairo
import papercut_style as ps
import chattito_tiktok as C
import flowcore_tiktok as FC
from pen_builder import *
from papercut_style import hx

OUT = sys.argv[1] if len(sys.argv) > 1 else '/mnt/user-data/outputs/FlowPublicidad/FlowPublicidad.pen'
MG = '/mnt/user-data/uploads/DisenosPencil/MotionGraphics.pen'
P = ps.P
SEED = [1]


def iso_vec(c, x, y, size):
    """Isotipo en piezas de papel, versión que el grabador puede capturar."""
    k = size / ps.ISO_SZ
    for i, pc in enumerate(ps.ISO):
        pts = [(x + (px - ps.ISO_C[0]) * k, y + (py - ps.ISO_C[1]) * k) for px, py in pc]
        sh = size / 160
        ps.shape(c, [(px + sh * .55, py + sh * .75) for px, py in pts], hx('006E84'), amp=max(.8, size / 520), seg=10 ** 6)
        ps.shape(c, pts, ps.ISO_COL, amp=max(.8, size / 520), seg=10 ** 6, shadow=False)


def comp(name, fn, meta, anchor=None, pad=10):
    SEED[0] += 1
    return component(name, record(fn), meta, pad=pad, seed=SEED[0], anchor=anchor)


# ------------------------------------------------------------------ 01 · papel
def papel():
    cs = []
    tags = [('Etiqueta · Problema', ['Citas perdidas.'], 64, P['coral'], P['white'], -3, True),
            ('Etiqueta · Beneficio', ['Reservas en línea 24/7'], 60, P['teal'], P['white'], -2, True),
            ('Etiqueta · Mostaza', ['Sin doble reserva'], 52, P['mustard'], P['ink'], 2, True),
            ('Etiqueta · Precio', ['Desde $299 al mes', '30 días de prueba'], 60, P['coral'], P['white'], -2, True),
            ('Etiqueta · URL', ['flow.dydasoftware.com/agenda'], 44, P['white'], P['teal'], 1.5, True),
            ('Etiqueta · Menta', ['+12%'], 52, P['mint'], hx('1F4F45'), 3, False),
            ('Subtítulo', ['Tu negocio, a una pregunta de distancia.'], 48, P['paper'], P['ink'], 0, False)]
    for name, lines, size, bg, fg, ang, tape in tags:
        font = 'NunitoBold' if name == 'Subtítulo' else 'NunitoBlack'
        meta = {'type': 'etiqueta', 'size': size, 'bg': hexc(bg), 'fg': hexc(fg), 'ang': ang, 'tape': tape, 'font': font}
        cs.append(comp(name, lambda c, l=lines, s=size, b=bg, f=fg, a=ang, t=tape, fo=font:
                       ps.tag(c, 0, 0, l, s, b, f, ang=a, tape=t, font=fo, pad=(30, 16) if fo == 'NunitoBold' else (34, 22)),
                       meta, anchor=(0, 0)))
    cs.append(comp('Globo · Pregunta', lambda c: C.bubble(c, 0, 0, ['¿Cuánto vendí', 'esta semana?'], 1, size=40),
                   {'type': 'globo', 'size': 40, 'tail': 'l', 'q': True}, anchor=(0, 0)))
    cs.append(comp('Globo · Pregúntale', lambda c: C.bubble(c, 0, 0, ['Pregúntale', 'a Chattito'], 1, tail='r', size=46),
                   {'type': 'globo', 'size': 46, 'tail': 'r', 'q': True}, anchor=(0, 0)))

    def typing(c):
        C.group_begin()
        ps.rrect(c, -110, -50, 220, 100, 40, P['white'])
        ps.shape(c, [(-90, 20), (-140, 60), (-60, 40)], P['white'])
        C.group_end(c, P['white'])
        for k, dx in enumerate((-50, 0, 50)):
            ps.ell(c, dx, -10 if k == 1 else 0, 13, 13, P['ink'], shadow=False, amp=.4, a=1 if k == 1 else .35)
    cs.append(comp('Globo · Escribiendo', typing, {'type': 'actor', 'actor': 'globo_escribiendo'}, anchor=(0, 0)))

    def palomita(c):
        ps.ell(c, 0, 0, 46, 46, P['coral'])
        ps.stroke(c, [(-20, 0), (-5, 16), (22, -16)], 11, P['white'])
    cs.append(comp('Palomita', palomita, {'type': 'pieza'}, anchor=(0, 0)))

    def piedra(c):
        ps.ell(c, 0, 0, 120, 56, P['tealL'])
        ps.ell(c, 0, -4, 30, 30, P['teal'], shadow=False)
        ps.txt(c, '1', 0, -4, 34, P['white'])
    cs.append(comp('Piedra de paso', piedra, {'type': 'pieza'}, anchor=(0, 0)))
    for kind in ['clientes', 'ventas', 'inventario', 'citas', 'facturacion', 'mimodulo']:
        cs.append(comp('Módulo · ' + FC.MOD[kind][0], lambda c, k=kind: FC.tile(c, 0, 0, k, 1), {'type': 'pieza'}, anchor=(0, 0)))
    cs.append(comp('Isotipo Flow', lambda c: iso_vec(c, 0, 0, 330), {'type': 'actor', 'actor': 'isotipo', 'size': 330}, anchor=(0, 0)))

    def wordmark(c):
        ps.txt(c, 'Flow', 0, 0, 150, P['teal'])
    cs.append(comp('Marca · Flow', wordmark, {'type': 'pieza'}, anchor=(0, 0)))

    def confeti(c):
        b = C.Burst(0, 0, 26, 3, spread=260)
        b.draw(c, .35)
    cs.append(comp('Confeti', confeti, {'type': 'actor', 'actor': 'confeti', 'n': 90}, anchor=(0, 0)))
    cs.append(comp('Banderines', lambda c: ps.bunting(c, -6, [P['coral'], P['mustard'], P['teal2'], P['mint'], P['sky']]),
                   {'type': 'pieza'}, anchor=(0, 0), pad=0))
    return cs


# ------------------------------------------------------------------ 03 · elenco
CAST = [('Mariana', 'duena', ps.OWNER, 'Dueña de estética'), ('Lupita', 'clienta', ps.CLIENT, 'Clienta'),
        ('Luis', 'cliente', ps.GUY, 'Cliente'), ('Dra. Sofía', 'dentista', ps.DENT, 'Dentista'),
        ('Beto', 'barbero', ps.BARB, 'Barbero'), ('Doña Carmen', 'asesora', ps.ASES, 'Asesora'),
        ('Toño', 'mecanico', FC.MECH, 'Mecánico'), ('Rosa', 'distribuidora', FC.DIST, 'Distribuidora')]


def elenco():
    cs = []
    for s, tag in [(1.0, 'M'), (.55, 'S')]:
        for name, key, p, rol in CAST:
            def f(c, p=p, key=key, s=s):
                ps.person(c, 0, 0, s, p, 'happy')
                if key == 'mecanico':
                    FC.cap(c, 0, 0, s, hx('2F5D8A'))
            cs.append(comp(f'Personaje {tag} · {name}', f, {'type': 'actor', 'actor': 'persona', 'preset': key, 'expr': 'happy',
                                                            's': s, 'rol': rol}, anchor=(0, 0)))
    for e, lab in [('calm', 'Tranquila'), ('stress', 'Estrés')]:
        cs.append(comp(f'Personaje M · Mariana · {lab}', lambda c, e=e: ps.person(c, 0, 0, 1.0, ps.OWNER, e),
                       {'type': 'actor', 'actor': 'persona', 'preset': 'duena', 'expr': e, 's': 1.0}, anchor=(0, 0)))
    return cs


def chattitos():
    cs = []
    states = [('Normal', dict(mode='neutral', t=1.0)), ('Feliz', dict(mode='happy', t=1.0)),
              ('Mira izquierda', dict(mode='neutral', t=1.0, gaze=-1)), ('Mira derecha', dict(mode='neutral', t=1.0, gaze=1)),
              ('Escribiendo', dict(mode='typing', t=.55)), ('Rebosante', dict(mode='happy', t=.8, elated=True))]
    for s, tag in [(.62, 'M'), (1.05, 'L'), (.4, 'S')]:
        for name, kw in states:
            meta = {'type': 'actor', 'actor': 'chattito', 's': s, 'mode': kw['mode'], 'gaze': kw.get('gaze', 0),
                    'elated': kw.get('elated', False)}
            cs.append(comp(f'Chattito {tag} · {name}', lambda c, kw=kw, s=s: C.chattito(c, 0, 0, s, **kw), meta, anchor=(0, 0)))
    return cs


def fit(fn, maxw=360, maxh=150):
    """Escala la pieza para que quepa en una tarjeta de 438 × 240."""
    x0, y0, x1, y1 = bbox(record(fn))
    k = min(1.0, maxw / (x1 - x0), maxh / (y1 - y0))
    if k >= .999:
        return fn

    def g(c):
        c.save(); c.scale(k, k); fn(c); c.restore()
    return g


def utileria():
    import props
    cs = []
    extra = [('Etiqueta de precio', lambda c: C.biz(c, 'tag', 0, 0, 1.3), 'Pop con rebote · tienda'),
             ('Libreta', lambda c: C.biz(c, 'note', 0, 0, 1.1), 'La que se tacha en la escena de problema'),
             ('Reloj', lambda c: ps.clock(c, 0, 0, 70, 2.1, 5.4), 'Manecillas giran rápido (problema) o lento (calma)'),
             ('Tijeras', lambda c: FC.scissors(c, 0, 0, -.5, 16), 'Abren y cierran mientras recortan'),
             ('Tiendita', lambda c: FC.storefront(c, 0, 0, .62), 'Rebota contra el molde · Flow Core')]
    for name, f, note in props.PROPS + extra:
        cs.append(comp(name, fit(f), {'type': 'pieza', 'nota': note}, anchor=(0, 0)))
    cs.append(comp('Manual', fit(lambda c: C.manual(c, 0, -60, 3, .55, -.05)),
                   {'type': 'actor', 'actor': 'manual', 'n': 3, 's': .55, 'nota': 'Se desdobla página por página'}, anchor=(0, -60)))
    cs.append(comp('Mesa vichy', lambda c: ps.gingham(c, 0, 0, 1080, 300, P['paper'], P['pink2']), {'type': 'pieza'}, anchor=(0, 0)))
    return cs


# ------------------------------------------------------------------ 02 · gráficas (desde MotionGraphics.pen)
def reid(n, urlfix):
    n = copy.deepcopy(n)

    def walk(m):
        m['id'] = nid()
        for key in ('fill', 'stroke'):
            v = m.get(key)
            vs = v if isinstance(v, list) else [v]
            for f in vs:
                if isinstance(f, dict) and f.get('type') == 'image':
                    f['url'] = urlfix(f['url'])
        for ch in m.get('children', []) or []:
            walk(ch)
    walk(n)
    return n


def graficas():
    d = json.load(open(MG))
    frames = {f['id']: f for f in d['children']}

    def urlfix(u):
        base = u.split('/')[-1]
        return RES + base
    cs = []
    for fid in ['ALuUx', 'HabeV']:
        for ch in frames[fid]['children']:
            nm = ch.get('name', '')
            if not re.match(r'^\d\d · ', nm):
                continue
            if fid == 'HabeV' and not nm.startswith(('03', '04')):
                continue
            c = reid(ch, urlfix)
            c['reusable'] = True
            c['rotation'] = 0
            c['name'] = 'Gráfica · ' + nm.split(' · ', 1)[1]
            # quita índice y nota de movimiento: el componente es la gráfica, no la ficha
            mov = next((k.get('content') for k in c['children'] if k.get('name') == 'Movimiento'), None)
            kids = [k for k in c['children'] if k.get('name') not in ('Índice', 'Movimiento')]
            # sin el papel de la tarjeta: la tarjeta la pone la presentación (evita tarjeta dentro de tarjeta)
            while kids and kids[0].get('name') in ('Filo', 'Papel'):
                kids.pop(0)
            c['children'] = kids
            c['metadata'] = {'type': 'pieza', 'origen': 'MotionGraphics.pen · ' + nm, 'nota': mov}
            cs.append(c)
    return cs


# ------------------------------------------------------------------ 05 · fondos
FONDOS = [('Fondo · Crema', 'cream', 'F3E6D3', 'pink2', .6), ('Fondo · Menta', 'mintL', 'CBE8DC', 'paper', 1.0),
          ('Fondo · Rosa', 'pink', 'EDB3B1', 'paper', 1.0)]


def fondos(res_dir):
    cs = []
    for name, base, stripe, dot, da in FONDOS:
        fn = 'fondo_' + name.split(' · ')[1].lower() + '_vertical.png'
        s = cairo.ImageSurface(cairo.FORMAT_RGB24, 1080, 1920); c = cairo.Context(s)
        ps.begin_frame(0, textura=True)
        ps.wall(c, P[base], hx(stripe), P[dot], da)
        s.write_to_png(os.path.join(res_dir, fn))
        cs.append({'type': 'frame', 'id': nid(), 'name': name, 'reusable': True, 'layout': 'none', 'clip': True,
                   'width': 1080, 'height': 1920, 'fill': {'type': 'image', 'url': RES + fn, 'mode': 'cover'},
                   'metadata': {'type': 'fondo', 'base': base, 'stripe': stripe, 'dot': dot, 'dot_a': da}, 'children': []})
    return cs


# ------------------------------------------------------------------ 00 · identidad
def identidad():
    ch = header('Flow · Identidad publicitaria', 'Una sola fuente: lo que está aquí es lo que se anima en los videos.',
                'FLOW · PAPEL RECORTADO · 12 FPS')
    pal = [('Turquesa', P['teal']), ('Coral', P['coral']), ('Mostaza', P['mustard']), ('Menta', P['mint']), ('Cielo', P['sky']),
           ('Crema', P['cream']), ('Rosa palo', P['pink']), ('Tinta', P['ink'])]
    ch.append(text('Sección paleta', 'PALETA', 60, 236, 14, '#8D8582', '800', ls=2))
    for i, (n, col) in enumerate(pal):
        sw = component('Muestra ' + n, record(lambda c, col=col: ps.rrect(c, 0, 0, 120, 120, 16, col)), {'type': 'pieza'}, seed=900 + i)
        sw.pop('reusable'); sw['x'], sw['y'] = 60 + i * 150, 270
        ch += [sw, text('Hex ' + n, hexc(col), 64 + i * 150, 410, 16, '#3A2E30', '800'), text('Nombre ' + n, n, 64 + i * 150, 432, 14, '#8D8582', '700')]
    ch.append(text('Sección tipografía', 'TIPOGRAFÍA', 60, 500, 14, '#8D8582', '800', ls=2))
    ch += [text('Muestra Black', 'Nunito Black · titulares y etiquetas', 60, 530, 40, '#006E84', '900'),
           text('Muestra Bold', 'Nunito Bold · subtítulos y textos de apoyo', 60, 590, 30, '#3A2E30', '700')]
    ch.append(text('Sección reglas', 'CÓMO SE CONSTRUYE UN VIDEO DESDE ESTE ARCHIVO', 60, 670, 14, '#8D8582', '800', ls=2))
    steps = ['1. Cada video es un grupo de frames «Escena» de 1080 × 1920 (o 1920 × 1080).',
             '2. Las escenas se arman con instancias de los componentes de este archivo.',
             '3. Cada pieza de la escena lleva su entrada en metadata: tipo (pop, cae, desliza, crece), segundo o frase, y duración.',
             '4. pen2video.py lee el archivo, redibuja cada pieza con el motor de papel y saca el MP4 con la voz.',
             '5. Si algo no existe, se diseña una vez como componente y queda para siempre.']
    for k, s in enumerate(steps):
        ch.append(text('Regla %d' % (k + 1), s, 60, 704 + k * 40, 20, '#3A2E30', '700'))
    iso = comp('Isotipo identidad', lambda c: iso_vec(c, 0, 0, 260), {'type': 'pieza'})
    iso.pop('reusable'); iso['x'], iso['y'] = 1440, 250
    ch.append(iso)
    ch.append(text('Marca', 'Flow', 1460, 560, 120, '#006E84'))
    chat = comp('Chattito identidad', lambda c: C.chattito(c, 0, 0, .62, 'happy', t=1.0), {'type': 'pieza'})
    chat.pop('reusable'); chat['x'], chat['y'] = 1500, 760
    ch.append(chat)
    return section('00 · Identidad', ch, 1920, 1080, fill_url='fondo_crema_1920.png')


def ejemplo(lib, x0):
    """Campaña de ejemplo armada solo con instancias de la biblioteca."""
    by = {}

    def idx(n):
        by[n.get('name')] = n
        for k in n.get('children', []) or []:
            idx(k)
    for n in lib:
        idx(n)

    def at(name, cx, cy, texto=None, **anim):
        comp = by[name]
        ax, ay = comp['metadata'].get('anchor', [comp['width'] / 2, comp['height'] / 2])
        r = {'type': 'ref', 'id': nid(), 'ref': comp['id'], 'name': name, 'x': round(cx - ax), 'y': round(cy - ay)}
        if anim:
            r['metadata'] = dict(type='anim', **anim)
        if texto:
            tx = [k for k in comp['children'] if k['type'] == 'text']
            r['descendants'] = {t['id']: {'content': v} for t, v in zip(tx, texto)}
        return r
    frases = [[0.43, 3.59, 'Nadie debería aprenderse un sistema para poder usarlo.'],
              [4.08, 5.97, 'Chattito es el asistente de Flow.'],
              [6.36, 9.10, 'Vive dentro de tu sistema y conoce tu negocio.']]
    camp = {'type': 'frame', 'id': nid(), 'name': 'Campaña · Ejemplo Chattito', 'x': x0, 'y': 0, 'width': 2400, 'height': 200,
            'layout': 'none', 'fill': '#3A2E30', 'children': [
                text('Título campaña', 'Campaña · Ejemplo Chattito (9 s)', 40, 40, 44, '#FFFBF3'),
                text('Nota campaña', 'Voz: recursos/voz_chattito.mp3 · formato TikTok · las escenas de abajo se animan con pen2video.py', 40, 110, 20, '#BFE3E8', '700')],
            'metadata': {'type': 'campana', 'nombre': 'Ejemplo Chattito', 'audio': RES + 'voz_chattito.mp3', 'offset': 0.3,
                         'duracion': 9.3, 'formato': 'tiktok', 'frases': frases}}
    s1 = {'type': 'frame', 'id': nid(), 'name': 'Escena 01 · Problema', 'x': x0, 'y': 300, 'width': 1080, 'height': 1920,
          'layout': 'none', 'clip': True, 'metadata': {'type': 'escena', 'campana': 'Ejemplo Chattito', 'inicio': 0, 'fin': 3.85, 'desat': .5},
          'children': [at('Fondo · Rosa', 540, 960), at('Reloj', 820, 230),
                       at('Personaje M · Mariana · Estrés', 300, 760),
                       at('Mesa vichy', 0, 1080),
                       at('Manual', 560, 1010, n_keys=[[0.4, 1.5], [3.8, 19]]),
                       at('Etiqueta · Problema', 600, 330, texto=['¿Otro manual?'], entra='pop', en=2.0, dur=.3)]}
    s2 = {'type': 'frame', 'id': nid(), 'name': 'Escena 02 · Chattito', 'x': x0 + 1240, 'y': 300, 'width': 1080, 'height': 1920,
          'layout': 'none', 'clip': True, 'metadata': {'type': 'escena', 'campana': 'Ejemplo Chattito', 'inicio': 3.85, 'fin': 9.3},
          'children': [at('Fondo · Menta', 540, 960), at('Banderines', 0, 0),
                       at('Personaje M · Mariana', 260, 760),
                       at('Chattito M · Feliz', 790, 560, entra='cae', en='f2', dur=.45, mode=[[0, 'happy'], ['f3+0.8', 'neutral']],
                          gaze=[['f3+0.8', -1]], happy_at=['f2+0.45']),
                       at('Etiqueta · Beneficio', 540, 300, texto=['El asistente de Flow'], entra='pop', en='f2+0.5', dur=.3, sale='pop', sale_en='f3-0.2'),
                       at('Módulo · Clientes', 600, 960, entra='pop', en='f3+0.6'),
                       at('Módulo · Ventas', 860, 960, entra='pop', en='f3+0.85'),
                       at('Módulo · Inventario', 730, 1180, entra='pop', en='f3+1.1'),
                       at('Etiqueta · Beneficio', 540, 300, texto=['Conoce tu negocio'], entra='pop', en='f3+1.4', dur=.3)]}
    return [camp, s1, s2]



# ------------------------------------------------------------------ presentación tipo MotionGraphics
NOTAS = {
    'etiqueta': 'Pop con rebote · 0.30 s · cinta en las esquinas',
    'globo': 'Pop desde la colita · 0.32 s',
    'chattito': 'Mirada con resorte · ojos 250 ms · saltito 0.6 s',
    'persona': 'Cae o desliza · contornos vivos cada 3 cuadros',
    'isotipo': 'Cae pieza por pieza · 0.14 s',
    'confeti': 'Ráfaga con gravedad · ~2 s',
    'manual': 'Se desdobla página por página',
    'globo_escribiendo': 'Ola de puntos · ciclo 1.4 s',
    'fondo': 'Rayas con contorno vivo · no se anima por partes',
    'pieza': 'Pop con rebote · 0.30 s',
}


def nota(c):
    m = c.get('metadata') or {}
    if m.get('nota'):
        return m['nota']
    return NOTAS.get(m.get('actor') or m.get('type'), NOTAS['pieza'])


def bunting_nodes(seed=0, cols=None):
    cols = cols or [P['coral'], P['mustard'], P['teal2'], P['mint'], P['sky']]
    out = []
    for i in range(15):
        x = i * 128 + 10
        y = -8 + 20 * math.sin(math.pi * (x + 54) / 1920)
        items = record(lambda c, x=x, y=y, i=i: ps.shape(c, [(x, y), (x + 108, y), (x + 54, y + 86)], cols[i % len(cols)]))
        x0, y0, _, _ = bbox(items, 6)
        fr = component('Banderín %d' % (i + 1), items, {'type': 'pieza'}, pad=6, seed=3000 + seed * 20 + i)
        fr.pop('reusable'); fr.pop('metadata')
        fr['x'], fr['y'] = round(x0, 1), round(y0, 1)
        out.append(fr)
    return out


def paper_card(name, w, h, rot, seed, color=None):
    color = color or P['paper']
    base = []
    r = 18
    for cx, cy, a0 in [(w - r, r, -90), (w - r, h - r, 0), (r, h - r, 90), (r, r, 180)]:
        for i in range(7):
            a = math.radians(a0 + i * 15)
            base.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    rim = jag_list(base, 2.6, 7, seed * 7 + 3)
    pap = jag_list(base, 1.3, 40, seed)
    return {'type': 'frame', 'id': nid(), 'name': name, 'layout': 'none', 'width': round(w), 'height': round(h), 'rotation': rot,
            'children': [path_node('Filo', [rim], 0, 0, '#FFFFFAEB', SHADOW), path_node('Papel', [pap], 0, 0, [hexc(color), dict(GRAIN)])]}


def instance(comp, x, y):
    return {'type': 'ref', 'id': nid(), 'ref': comp['id'], 'name': comp['name'], 'x': round(x), 'y': round(y)}


def frame_head(title, sub, eyebrow, seed):
    return bunting_nodes(seed) + [text('Eyebrow', eyebrow, 60, 118, 15, '#8D8582', '800', ls=2.5),
                                  text('Título principal', title, 58, 140, 62, '#006E84'),
                                  text('Subtítulo', sub, 62, 220, 18, '#3A2E30', '700')]


def present(prefix, title, sub, eyebrow, fondo, items, start_index=1, seed=0, minw=300):
    """items: lista de (componente, etiqueta) → frames 1920×1080 con tarjetas de papel empacadas en filas."""
    frames, page, cards = [], [], []
    X0, X1, Y0, Y1, G = 48, 1872, 272, 1050, 24
    x, y, rowh, row = X0, Y0, 0, []
    k = start_index

    def flush_row():
        for card in row:
            card['height'] = rowh
            for ch in card['children']:
                if ch.get('name') == 'Movimiento':
                    ch['y'] = rowh - 32
            # vuelve a cortar el papel con la altura final
            pc = paper_card(card['name'], card['width'], rowh, card['rotation'], card['_seed'])
            card['children'][:2] = pc['children']
    pages = [[]]
    for comp, label in items:
        cw = max(comp['width'] + 64, minw)
        ch = comp['height'] + 112
        if x + cw > X1 and row:
            flush_row(); x = X0; y += rowh + G; rowh = 0; row = []
        if y + ch > Y1 and pages[-1]:
            if row:
                flush_row()
            pages.append([]); x, y, rowh, row = X0, Y0, 0, []
        sd = 5000 + seed * 100 + k
        card = paper_card('%02d · %s' % (k, label), cw, ch, [.5, -.4, .3, -.6][k % 4], sd)
        card['_seed'] = sd
        card['x'], card['y'] = x, y
        card['children'] += [text('Índice', '%02d · %s' % (k, label.upper()), 22, 18, 12, '#8D8582', '800', ls=1.8),
                             instance(comp, (cw - comp['width']) / 2, 52),
                             text('Movimiento', nota(comp), 22, ch - 32, 12, '#006E84', '700')]
        pages[-1].append(card); row.append(card)
        x += cw + G; rowh = max(rowh, ch); k += 1
    if row:
        flush_row()
    n = len(pages)
    for i, cards in enumerate(pages):
        for cd in cards:
            cd.pop('_seed', None)
        t = title if n == 1 else '%s %d/%d' % (title, i + 1, n)
        fr = {'type': 'frame', 'id': nid(), 'name': '%s %s' % (prefix, t), 'layout': 'none', 'clip': True, 'width': 1920, 'height': 1080,
              'fill': {'type': 'image', 'url': RES + fondo, 'mode': 'cover'}, 'children': frame_head(t, sub, eyebrow, seed + i) + cards}
        frames.append(fr)
    return frames


def grid12(prefix, title, sub, eyebrow, fondo, comps, seed=0):
    """Rejilla fija 4 × 3 de tarjetas de 438 × 240, como en MotionGraphics. Pagina de 12 en 12."""
    pages = [comps[i:i + 12] for i in range(0, len(comps), 12)]
    out = []
    for p, chunk in enumerate(pages):
        cards = []
        for k, comp in enumerate(chunk):
            i = p * 12 + k + 1; col = k % 4; row = k // 4
            nm = comp['name'].split(' · ', 1)[-1]
            cd = paper_card('%02d · %s' % (i, nm), 438, 240, [.6, -.5, .4, -.7][(i + row) % 4], 9000 + seed * 50 + i)
            cd['x'], cd['y'] = 48 + col * 462, 272 + row * 262
            ix = (438 - comp['width']) / 2 if comp['width'] < 438 else 0
            iy = 40 + (166 - comp['height']) / 2 if comp['height'] < 240 else 0
            cd['children'] += [instance(comp, ix, iy), text('Índice', '%02d · %s' % (i, nm.upper()), 22, 18, 12, '#8D8582', '800', ls=1.8),
                               text('Movimiento', nota(comp), 22, 210, 12, '#006E84', '700')]
            cards.append(cd)
        t = title if len(pages) == 1 else '%s %d/%d' % (title, p + 1, len(pages))
        out.append({'type': 'frame', 'id': nid(), 'name': '%s %s' % (prefix, t), 'layout': 'none', 'clip': True, 'width': 1920, 'height': 1080,
                    'fill': {'type': 'image', 'url': RES + fondo, 'mode': 'cover'}, 'children': frame_head(t, sub, eyebrow, seed + p) + cards})
    return out


def maestros(title, comps, x, y, cols=1800):
    body, h = grid(comps, 60, 150, cols)
    fr = {'type': 'frame', 'id': nid(), 'name': 'Maestros · ' + title, 'layout': 'none', 'clip': False, 'width': 1920, 'height': h + 220,
          'fill': '#EFE7DA', 'x': x, 'y': y,
          'children': [text('Título', 'Maestros · ' + title, 60, 50, 40, '#3A2E30'),
                       text('Nota', 'Componentes originales. Edita aquí y se actualizan en todas las tarjetas y escenas.', 62, 104, 16, '#8D8582', '700')] + body}
    return fr


def build(res_dir):
    os.makedirs(res_dir, exist_ok=True)
    top = []
    pap, gra, ele, cha, uti, fon = papel(), graficas(), elenco(), chattitos(), utileria(), fondos(res_dir)
    # --- maestros (columna derecha) ---
    my = 0
    for title, comps in [('Papel', pap), ('Gráficas', gra), ('Elenco', ele), ('Chattito', cha), ('Utilería', uti), ('Fondos', fon)]:
        fr = maestros(title, comps, 2400, my)
        top.append(fr)
        my += fr['height'] + 160
    # --- presentación (columna izquierda, frames 1920×1080 como en MotionGraphics) ---
    pres = []
    idn = identidad()
    for k in idn['children']:
        k['y'] += 66
        if k.get('name') == 'Chattito identidad':
            k['x'], k['y'] = 1700, 770
        if k.get('name') == 'Marca':
            k['x'], k['y'] = 1440, 560
        if k.get('name') == 'Isotipo identidad':
            k['y'] = 280
    idn['children'] = bunting_nodes(9) + idn['children']
    idn['name'] = '00 · Identidad'
    pres.append(idn)
    lbl = lambda c: c['name'].split(' · ', 1)[-1] if ' · ' in c['name'] else c['name']
    pres += present('01 ·', 'Papel', 'Etiquetas, globos, módulos y marca. Cambia el texto y el video lo respeta.',
                    'FLOW · PAPEL RECORTADO · PIEZAS', 'fondo_crema_1920.png', [(c, c['name']) for c in pap], seed=1)
    pres += grid12('02 ·', 'Gráficas de papel', 'Datos que se arman con piezas: cada barra, rebanada y punto es un recorte que entra con rebote.',
                   'FLOW · PAPEL RECORTADO · GRÁFICAS', 'fondo_menta_1920.png',
                   [c for c in gra if not c['name'].endswith(('Cifra de papel', 'Barras de papel'))], seed=2)
    ele_s = [c for c in ele if c['name'].startswith('Personaje S')]
    pres += present('03 ·', 'Elenco de papel', 'Personajes en tamaño S. En «Maestros · Elenco» también están en tamaño M y con expresiones.',
                    'FLOW · PAPEL RECORTADO · ELENCO', 'fondo_rosa_1920.png',
                    [(c, c['name'].split(' · ', 1)[1] + ' · ' + c['metadata']['rol']) for c in ele_s], seed=3, minw=432)
    cha_m = [c for c in cha if c['name'].startswith('Chattito M')]
    pres += present('04 ·', 'Chattito', 'Estados oficiales (geometría de chattito.pen). Tamaños M, L y S en «Maestros · Chattito».',
                    'FLOW · PAPEL RECORTADO · CHATTITO', 'fondo_menta_1920.png', [(c, c['name'].split(' · ', 1)[1]) for c in cha_m], seed=4, minw=592)
    pres += grid12('05 ·', 'Utilería', 'Objetos para armar escenas: negocios, oficina, mandado y temporada.', 'FLOW · PAPEL RECORTADO · UTILERÍA',
                   'fondo_crema_1920.png', [c for c in uti if c['name'] != 'Mesa vichy'], seed=5)
    # fondos: vista reducida con imagen
    fcards = []
    for i, f in enumerate(fon):
        cd = paper_card('%02d · %s' % (i + 1, f['name']), 330, 640, [.5, -.4, .3][i], 7000 + i)
        cd['x'], cd['y'] = 48 + i * 360, 272
        cd['children'] += [text('Índice', '%02d · %s' % (i + 1, f['name'].upper()), 22, 18, 12, '#8D8582', '800', ls=1.8),
                           {'type': 'rectangle', 'id': nid(), 'name': 'Vista', 'x': 30, 'y': 52, 'width': 270, 'height': 480, 'cornerRadius': 8,
                            'fill': f['fill']},
                           text('Movimiento', NOTAS['fondo'], 22, 548, 12, '#006E84', '700', w=290),
                           text('Tamaño', '1080 × 1920 · maestro en «Maestros · Fondos»', 22, 590, 12, '#8D8582', '700', w=290)]
        fcards.append(cd)
    mesa = [c for c in uti if c['name'] == 'Mesa vichy'][0]
    md = paper_card('04 · Mesa vichy', 744, 420, -.4, 7100) | {'x': 48 + 3 * 360, 'y': 272, 'clip': True}
    md['children'] += [text('Índice', '04 · MESA VICHY', 22, 18, 12, '#8D8582', '800', ls=1.8), instance(mesa, 30, 60),
                       text('Movimiento', 'Primer plano de mesa · va sobre el fondo', 22, 388, 12, '#006E84', '700')]
    pres.append({'type': 'frame', 'id': nid(), 'name': '06 · Fondos', 'layout': 'none', 'clip': True, 'width': 1920, 'height': 1080,
                 'fill': {'type': 'image', 'url': RES + 'fondo_rosa_1920.png', 'mode': 'cover'},
                 'children': frame_head('Fondos', 'Papel tapiz vertical para TikTok y Reels. En video las rayas hierven con el resto.',
                                        'FLOW · PAPEL RECORTADO · FONDOS', 6) + fcards + [md]})
    y = 0
    for fr in pres:
        fr['x'], fr['y'] = 0, y
        y += 1080 + 120
    top = pres + top
    top += ejemplo(top, 4600)
    return {'version': '2.20', 'children': top}


if __name__ == '__main__':
    res = os.path.join(os.path.dirname(OUT), 'recursos')
    doc = build(res)
    json.dump(doc, open(OUT, 'w'), ensure_ascii=False)
    print('ok', OUT, os.path.getsize(OUT), len(doc['children']), 'frames')
