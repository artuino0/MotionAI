"""Agrega el kit de temporadas (Muertos, Halloween, Buen Fin, Navidad, Reyes, 14 feb, 10 mayo, 16 sep) a un FlowPublicidad.pen existente,
sin tocar lo que ya tiene (respeta ediciones manuales).

    python3 build_temporada.py FlowPublicidad.pen salida.pen recursos/

Crea: presentación 07–14 (una por temporada) en rejilla 4×3, «Maestros · Temporada · …»
con utilería, Chattito con accesorio (M y L), etiquetas y fondos verticales.
Si el archivo ya tiene un kit de temporada, lo reemplaza (frames cuyo nombre empieza con 07 ·, 08 · o Maestros · Temporada).
"""
import json, os, sys, math
import cairo
sys.argv = sys.argv[:1] + ['/dev/null'] + sys.argv[1:]   # build_flowpublicidad lee argv[1]
import build_flowpublicidad as B
sys.argv = sys.argv[:1] + sys.argv[2:]
import papercut_style as ps
import chattito_tiktok as C
import temporada as T
from pen_builder import component, record, bbox, text, RES
import pen_builder as PB, random as _r
PB._rng = _r.Random()          # ids nuevos: no repetir la secuencia del archivo original
from papercut_style import P, hx

TEMPORADAS = {
    'muertos': dict(
        titulo='Temporada · Día de Muertos',
        sub='Papel picado, cempasúchil y ofrenda. Con respeto: se celebra a quien recordamos, sin escudo ni bandera.',
        eyebrow='FLOW · PAPEL RECORTADO · 1 Y 2 DE NOVIEMBRE',
        props=T.MUERTOS, acc='cempasuchil', acc_nom='Cempasúchil',
        fondo=('Fondo · Muertos', 'rosamxL', 'F2B3CA', 'cempa', .55, 'fondo_muertos'),
        etiquetas=[('Etiqueta · Día de Muertos', ['Día de Muertos'], 50, P['morado'], P['white'], -2),
                   ('Etiqueta · Ofrenda', ['Para los que siempre', 'nos acompañan'], 48, P['cempa'], P['ink'], 2)],
        titulo_col='#7B4A9E', txt_col='#3A2E30', sub_col='#3A2E30'),
    'halloween': dict(
        titulo='Temporada · Halloween',
        sub='Calabazas, fantasmas y dulces. Noche morada con piezas de papel claras; Chattito se pone sombrero.',
        eyebrow='FLOW · PAPEL RECORTADO · 31 DE OCTUBRE',
        props=T.HALLOWEEN, acc='bruja', acc_nom='Bruja',
        fondo=('Fondo · Halloween', 'noche2', '46396A', 'calabaza', .5, 'fondo_halloween'),
        etiquetas=[('Etiqueta · Halloween', ['Halloween'], 60, P['calabaza'], P['sombra'], -2),
                   ('Etiqueta · Dulce o truco', ['¿Dulce o truco?'], 52, P['bruja'], P['white'], 2)],
        titulo_col='#F2782E', txt_col='#F4EEDC', sub_col='#F4EEDC', banderines=[P['calabaza'], P['bruja'], P['limo'], P['llama']]),
    'buenfin': dict(
        titulo='Temporada · Buen Fin',
        sub='Descuentos, cupones y bolsas de compras. Ideal para promos de Flow con prisa: el cronómetro corre.',
        eyebrow='FLOW · PAPEL RECORTADO · FIN DE SEMANA DE NOVIEMBRE',
        props=T.BUENFIN, acc='etiqueta_oferta', acc_nom='Oferta',
        fondo=('Fondo · Buen Fin', 'FFE08A', 'F7D06A', 'coral', .35, 'fondo_buenfin'),
        etiquetas=[('Etiqueta · Buen Fin', ['Buen Fin'], 60, P['coral'], P['white'], -2),
                   ('Etiqueta · Hasta 50%', ['¡Hasta 50%', 'menos!'], 46, P['mustard'], P['ink'], 2)],
        banderines=[P['coral'], P['teal2'], P['mustard'], P['ink']],
        titulo_col='#E5604F', sub_col='#3A2E30'),
    'navidad': dict(
        titulo='Temporada · Navidad',
        sub='Árbol, nochebuena, piñata y ponche: una Navidad mexicana. Chattito se pone gorro.',
        eyebrow='FLOW · PAPEL RECORTADO · DICIEMBRE',
        props=T.NAVIDAD, acc='santa', acc_nom='Navideño',
        fondo=('Fondo · Navidad', '2F6B4F', '377A5A', 'white', .35, 'fondo_navidad'),
        etiquetas=[('Etiqueta · Feliz Navidad', ['Feliz Navidad'], 58, T.ROJO, P['white'], -2),
                   ('Etiqueta · Felices fiestas', ['Felices fiestas'], 50, P['paper'], T.VERDE, 2)],
        banderines=[T.ROJO, T.ORO, P['white'], T.VERDE],
        titulo_col='#EDB43E', sub_col='#FBF3E4'),
    'reyes': dict(
        titulo='Temporada · Día de Reyes',
        sub='Rosca, chocolate caliente y juguetes de siempre. Y si te sale el muñeco, tamales el 2 de febrero.',
        eyebrow='FLOW · PAPEL RECORTADO · 6 DE ENERO',
        props=T.REYES, acc='corona', acc_nom='Rey',
        fondo=('Fondo · Reyes', 'F7E3B8', 'EFD39A', 'morado', .35, 'fondo_reyes'),
        etiquetas=[('Etiqueta · Día de Reyes', ['Día de Reyes'], 58, P['morado'], P['white'], -2),
                   ('Etiqueta · Muñeco', ['¿Te salió', 'el muñeco?'], 44, T.ORO, P['ink'], 2)],
        banderines=[P['morado'], T.ORO, P['azulmx'], T.ROJO],
        titulo_col='#7B4A9E', sub_col='#3A2E30'),
    'febrero': dict(
        titulo='Temporada · 14 de febrero',
        sub='Amor y amistad: corazones, rosas y chocolates. A Chattito le laten las antenas.',
        eyebrow='FLOW · PAPEL RECORTADO · 14 DE FEBRERO',
        props=T.FEBRERO, acc='corazones', acc_nom='Enamorado',
        fondo=('Fondo · Febrero', 'F9D6DA', 'F2BFC5', 'red', .3, 'fondo_febrero'),
        etiquetas=[('Etiqueta · 14 de febrero', ['Feliz', '14 de febrero'], 42, T.ROJO, P['white'], -2),
                   ('Etiqueta · Amor y amistad', ['Amor y amistad'], 44, P['white'], T.ROSA_D, 2)],
        banderines=[T.ROJO, T.ROSA, P['white'], T.ROSA_L],
        titulo_col='#C23E5E', sub_col='#3A2E30'),
    'mayo': dict(
        titulo='Temporada · 10 de mayo',
        sub='Día de las Madres: flores, pastel, serenata y desayuno en la cama.',
        eyebrow='FLOW · PAPEL RECORTADO · 10 DE MAYO',
        props=T.MAYO, acc='flor', acc_nom='Flor',
        fondo=('Fondo · Mayo', 'EDE3F3', 'E0D1EC', 'rosamx', .35, 'fondo_mayo'),
        etiquetas=[('Etiqueta · Día de las Madres', ['Feliz Día', 'de las Madres'], 44, P['rosamx'], P['white'], -2),
                   ('Etiqueta · Gracias mamá', ['Gracias, mamá'], 50, T.LILA, P['ink'], 2)],
        banderines=[P['rosamx'], T.LILA, P['mustard'], P['sky']],
        titulo_col='#C2457E', sub_col='#3A2E30'),
    'septiembre': dict(
        titulo='Temporada · 16 de septiembre',
        sub='Fiestas patrias con los colores y la comida de siempre. Nunca el escudo ni la bandera oficial.',
        eyebrow='FLOW · PAPEL RECORTADO · 15 Y 16 DE SEPTIEMBRE',
        props=T.SEPTIEMBRE, acc='charro', acc_nom='Charro',
        fondo=('Fondo · Septiembre', 'FBF3E4', 'EFE2CC', '1F7A4D', .3, 'fondo_septiembre'),
        etiquetas=[('Etiqueta · Viva México', ['¡Viva México!'], 58, T.VERDE_MX, P['white'], -2),
                   ('Etiqueta · Fiestas patrias', ['Fiestas patrias'], 50, T.ROJO_MX, P['white'], 2)],
        banderines=[T.VERDE_MX, P['white'], T.ROJO_MX],
        titulo_col='#1F7A4D', sub_col='#3A2E30'),
}
ORDEN = ['muertos', 'halloween', 'buenfin', 'navidad', 'reyes', 'febrero', 'mayo', 'septiembre']

ESTADOS = [('Normal', dict(mode='neutral', t=1.0)), ('Feliz', dict(mode='happy', t=1.0)),
           ('Escribiendo', dict(mode='typing', t=.55)), ('Mira izquierda', dict(mode='neutral', t=1.0, gaze=-1))]


def pinta_fondo(res_dir, base, name, stripe, dot, da):
    pc = lambda v: P[v] if v in P else hx(v)
    for w, h, suf in [(1080, 1920, '_vertical.png'), (1920, 1080, '_1920.png')]:
        ps.W, ps.H = w, h
        s = cairo.ImageSurface(cairo.FORMAT_RGB24, w, h); c = cairo.Context(s)
        ps.begin_frame(0, textura=True)
        ps.wall(c, pc(base), pc(stripe), pc(dot), da)
        s.write_to_png(os.path.join(res_dir, name + suf))
    ps.W, ps.H = 1080, 1920


def picado_nodes(seed):
    """Papel picado a lo ancho del frame 1920 (reemplaza a los banderines en la temporada de Muertos)."""
    out = []
    for i in range(14):
        x = 14 + i * 136
        y = -14 + 16 * math.sin(math.pi * (x + 60) / 1920)
        items = record(lambda c, x=x, y=y, i=i: T.banderita_picado(c, x, y, 118, 104, T.PICADO[i % 5], i % 3))
        x0, y0, _, _ = bbox(items, 6)
        fr = component('Papel picado %d' % (i + 1), items, {'type': 'pieza'}, pad=6, seed=4400 + seed * 20 + i)
        fr.pop('reusable'); fr.pop('metadata')
        fr['x'], fr['y'] = round(x0, 1), round(y0, 1)
        out.append(fr)
    return out


def kit(key, res_dir, seed):
    K = TEMPORADAS[key]
    comps = []
    for name, fn, note in K['props']:
        comps.append(B.comp(name, B.fit(fn), {'type': 'pieza', 'nota': note, 'temporada': key}, anchor=(0, 0)))
    for name, lines, size, bg, fg, ang in K['etiquetas']:
        meta = {'type': 'etiqueta', 'size': size, 'bg': B.hexc(bg), 'fg': B.hexc(fg), 'ang': ang, 'tape': True, 'font': 'NunitoBlack',
                'temporada': key}
        comps.append(B.comp(name, lambda c, l=lines, s=size, b=bg, f=fg, a=ang: ps.tag(c, 0, 0, l, s, b, f, ang=a, tape=True), meta, anchor=(0, 0)))
    chs = []
    for s, tag in [(.62, 'M'), (1.05, 'L'), (.4, 'S')]:
        for nom, kw in ESTADOS if tag == 'M' else ESTADOS[1:2]:
            meta = {'type': 'actor', 'actor': 'chattito', 's': s, 'mode': kw['mode'], 'gaze': kw.get('gaze', 0), 'elated': False,
                    'acc': K['acc'], 'temporada': key,
                    'nota': 'Movimientos oficiales · accesorio fijo a la cabeza'}
            chs.append(B.comp('Chattito %s · %s · %s' % (tag, K['acc_nom'], nom),
                              lambda c, kw=kw, s=s: C.chattito(c, 0, 0, s, acc=K['acc'], **kw), meta, anchor=(0, 0)))
    nm, base, stripe, dot, da, fn = K['fondo']
    pinta_fondo(res_dir, base, fn, stripe, dot, da)
    fondo = {'type': 'frame', 'id': B.nid(), 'name': nm, 'reusable': True, 'layout': 'none', 'clip': True, 'width': 1080, 'height': 1920,
             'fill': {'type': 'image', 'url': RES + fn + '_vertical.png', 'mode': 'cover'},
             'metadata': {'type': 'fondo', 'base': base, 'stripe': stripe, 'dot': dot, 'dot_a': da, 'temporada': key}, 'children': []}
    # presentación: 10 piezas + Chattito M feliz + etiqueta principal = 12 tarjetas
    vitrina = (comps[:len(K['props'])] + [chs[-1]] + comps[len(K['props']):])[:12]   # Chattito S · Feliz cabe en la tarjeta
    pres = B.grid12('%02d ·' % (7 + ORDEN.index(key)), K['titulo'], K['sub'], K['eyebrow'], fn + '_1920.png', vitrina, seed=seed)
    for fr in pres:
        kids = fr['children']
        if key == 'muertos':
            kids = [k for k in kids if not k['name'].startswith('Banderín')]
            kids = picado_nodes(seed) + kids
        else:
            kids = [k for k in kids if not k['name'].startswith('Banderín')]
            kids = B.bunting_nodes(seed, K['banderines']) + kids
        for k in kids:
            if k.get('name') == 'Título principal':
                k['fill'] = K['titulo_col']
            elif k.get('name') in ('Subtítulo', 'Eyebrow') and k.get('type') == 'text':
                k['fill'] = K['sub_col']
        fr['children'] = kids
    return pres, comps + chs + [fondo]


def main():
    src, out, res_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(res_dir, exist_ok=True)
    d = json.load(open(src))
    import re
    d['children'] = [f for f in d['children'] if not (re.match(r'^\d\d · Temporada · ', f.get('name', '')) or f.get('name', '').startswith('Maestros · Temporada'))]
    sel = sys.argv[4].split(',') if len(sys.argv) > 4 else ORDEN
    kits = [(k,) + kit(k, res_dir, 70 + 10 * ORDEN.index(k)) for k in ORDEN if k in sel]
    # debajo de la última presentación (x = 0) y del último maestro (x = 2400)
    col0 = [f for f in d['children'] if f.get('x', 0) == 0]
    y = max(f['y'] + f['height'] for f in col0) + 120 if col0 else 0
    for _, pres, _ in kits:
        for fr in pres:
            fr['x'], fr['y'] = 0, y
            y += 1080 + 120
    col1 = [f for f in d['children'] if f.get('x') == 2400]
    my = max(f['y'] + f['height'] for f in col1) + 160 if col1 else 0
    maes = []
    for k, pres, lib in kits:
        m = B.maestros('Temporada · ' + TEMPORADAS[k]['titulo'].split(' · ', 1)[1], lib, 2400, my)
        my += m['height'] + 160
        maes.append(m)
    d['children'] += [fr for _, pres, _ in kits for fr in pres] + maes
    # ids únicos (6 caracteres aleatorios: avisa si alguno chocara)
    seen, dup = set(), []

    def walk(n):
        if 'id' in n:
            (dup.append(n['id']) if n['id'] in seen else seen.add(n['id']))
        for ch in n.get('children', []) or []:
            walk(ch)
    for f in d['children']:
        walk(f)
    assert not dup, 'ids repetidos: %s (vuelve a correr)' % dup[:5]
    json.dump(d, open(out, 'w'), ensure_ascii=False)
    print('ok', out, round(os.path.getsize(out) / 1e6, 2), 'MB', sum(len(l) for _, _, l in kits), 'componentes')


if __name__ == '__main__':
    main()
