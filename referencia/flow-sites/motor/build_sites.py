"""Agrega a FlowPublicidad.pen la utilería de Sites y la campaña «Flow Sites» (TikTok, ~30 s).

    python3 build_sites.py FlowPublicidad.pen salida.pen

Reemplaza «Maestros · Sites» y los frames de la campaña si ya existen.
"""
import json, os, sys, copy
sys.argv = sys.argv[:1] + ['/dev/null'] + sys.argv[1:]
import build_flowpublicidad as B
sys.argv = sys.argv[:1] + sys.argv[2:]
import pen_builder as PB, random as _r
PB._rng = _r.Random()
from pen_builder import text, RES
import sites as S

CAMP = 'Flow Sites'
OFF = 0.25          # la voz entra a los 0.25 s del video
VOZ = [(0.0, 2.97, '¿Tienes página web… pero nadie la actualiza?'),
       (3.42, 6.25, '¿Y los mensajes que te dejan ahí… se te pierden?'),
       (6.71, 9.82, 'Con Flow Sites, tu página está conectada a tu negocio.'),
       (10.22, 13.20, 'Cuando un cliente te deja sus datos, aparecen solitos en tu lista de clientes.'),
       (13.62, 16.70, 'Cuando alguien agenda una cita, cae directo en tu agenda…'),
       (17.00, 18.78, '…y le llega un correo para confirmarla.'),
       (19.16, 23.83, 'Vincula tu dominio, publica cuando quieras y mira cuántas personas te visitan.'),
       (24.17, 25.82, 'Pruébalo gratis quince días.'),
       (26.22, 29.07, 'Flow, tu negocio en un solo flujo.')]
FRASES = [[round(a + OFF, 2), round(b + OFF, 2), t] for a, b, t in VOZ]
DUR = 29.6


def main():
    src, out = sys.argv[1], sys.argv[2]
    d = json.load(open(src))
    d['children'] = [f for f in d['children'] if not (f.get('name', '') == 'Maestros · Sites'
                     or f.get('name', '').startswith('Campaña · ' + CAMP)
                     or ((f.get('metadata') or {}).get('campana') == CAMP))]
    # --- utilería de Sites ---
    lib = [B.comp(n, fn, {'type': 'pieza', 'nota': nota}, anchor=(0, 0)) for n, fn, nota in S.SITES]
    import papercut_style as ps
    lib.append(B.comp('Conexión', lambda c: (ps.stroke(c, [(0, 0), (110, 70), (220, 140)], 7, ps.P['teal'], a=.85),
                                              ps.ell(c, 110, 70, 15, 15, ps.P['coral'])),
                      {'type': 'actor', 'actor': 'conexion', 'p0': [10, 10], 'p1': [230, 150], 'bolitas': 1, 'periodo': 1.4,
                       'nota': 'La línea se tiende y las bolitas viajan por ella'}, anchor=(0, 0)))
    col1 = [f for f in d['children'] if f.get('x') == 2400]
    my = max(f['y'] + f['height'] for f in col1) + 160 if col1 else 0
    mae = B.maestros('Sites', lib, 2400, my)
    mae['name'] = 'Maestros · Sites'
    # --- índice de componentes por nombre ---
    by = {}

    def idx(n):
        if n.get('reusable'):
            by.setdefault(n['name'], n)
        for k in n.get('children', []) or []:
            idx(k)
    for f in d['children'] + [mae]:
        idx(f)
    # precio: la prueba ahora es de 15 días
    pr = by.get('Etiqueta · Precio')
    if pr:
        for k in pr['children']:
            if k.get('type') == 'text' and '30 días' in k.get('content', ''):
                k['content'] = k['content'].replace('30 días', '15 días')

    def conexion(p0, p1, bolitas=1, **anim):
        comp = by['Conexión']
        x0, y0 = min(p0[0], p1[0]) - 20, min(p0[1], p1[1]) - 20
        r = {'type': 'ref', 'id': B.nid(), 'ref': comp['id'], 'name': 'Conexión', 'x': x0, 'y': y0,
             'width': abs(p1[0] - p0[0]) + 40, 'height': abs(p1[1] - p0[1]) + 40,
             'metadata': dict(type='anim', p0=[p0[0] - x0, p0[1] - y0], p1=[p1[0] - x0, p1[1] - y0], bolitas=bolitas, **anim)}
        return r

    def at(name, cx, cy, texto=None, escala=None, nombre=None, **anim):
        comp = by[name]
        ax, ay = (comp.get('metadata') or {}).get('anchor', [comp['width'] / 2, comp['height'] / 2])
        k = escala or 1
        r = {'type': 'ref', 'id': B.nid(), 'ref': comp['id'], 'name': nombre or name, 'x': round(cx - ax * k), 'y': round(cy - ay * k)}
        meta = dict(anim)
        if escala:
            meta['escala'] = escala
        if meta:
            r['metadata'] = dict(type='anim', **meta)
        if texto:
            tx = [t for t in comp['children'] if t['type'] == 'text']
            r['descendants'] = {t['id']: {'content': v} for t, v in zip(tx, texto)}
        return r

    X0 = 7200
    camp = {'type': 'frame', 'id': B.nid(), 'name': 'Campaña · ' + CAMP, 'x': X0, 'y': 0, 'width': 7400, 'height': 200,
            'layout': 'none', 'fill': '#3A2E30', 'children': [
                text('Título campaña', 'Campaña · Flow Sites (29.6 s)', 40, 40, 44, '#FFFBF3'),
                text('Nota campaña', 'Voz: recursos/voz_sites.mp3 (ElevenLabs) · TikTok · cierre: «Flow, tu negocio en un solo flujo.»',
                     40, 110, 20, '#BFE3E8', '700')],
            'metadata': {'type': 'campana', 'nombre': CAMP, 'audio': RES + 'voz_sites.mp3', 'offset': OFF, 'duracion': DUR,
                         'formato': 'tiktok', 'frases': FRASES, 'sin_subtitulo': [9]}}
    t = [f[0] for f in FRASES]

    def escena(i, nombre, ini, fin, kids, desat=0):
        m = {'type': 'escena', 'campana': CAMP, 'inicio': ini, 'fin': fin}
        if desat:
            m['desat'] = desat
        return {'type': 'frame', 'id': B.nid(), 'name': 'Escena %02d · %s' % (i, nombre), 'x': X0 + (i - 1) * 1240, 'y': 300,
                'width': 1080, 'height': 1920, 'layout': 'none', 'clip': True, 'metadata': m, 'children': kids}

    corte = lambda k: round((FRASES[k - 1][1] + FRASES[k][0]) / 2, 2)   # a la mitad de la pausa entre frases
    esc = [
        escena(1, 'Problema', 0, corte(2), [
            at('Fondo · Rosa', 540, 960),
            at('Página vieja', 540, 470, entra='pop', en=0.15, dur=.35),
            at('Telaraña', 330, 330, escala=.75, entra='pop', en='f1+1.4'),
            at('Personaje M · Mariana · Estrés', 270, 900, entra='sube', en=0.5, dur=.45),
            at('Sobre', 700, 880, escala=1.2, entra='cae', en='f2', sale='cae', sale_en='f2+1.5'),
            at('Sobre', 840, 1030, escala=1.1, entra='cae', en='f2+0.25', sale='cae', sale_en='f2+1.7'),
            at('Sobre', 660, 1150, escala=1.0, entra='cae', en='f2+0.5', sale='cae', sale_en='f2+1.9'),
            at('Etiqueta · Problema', 640, 790, texto=['Mensajes perdidos'], entra='pop', en='f2+1.3', dur=.3)], desat=.5),
        escena(2, 'Conectada', corte(2), corte(3), [
            at('Fondo · Menta', 540, 960), at('Banderines', 0, 0),
            conexion((470, 780), (300, 1000), bolitas=1, en='f3+0.8'),
            conexion((610, 780), (780, 1000), bolitas=2, en='f3+1.0'),
            at('Página Flow', 540, 560, entra='pop', en='f3', dur=.4),
            at('Módulo · Clientes', 290, 1110, texto=['Prospectos'], nombre='Módulo · Prospectos', entra='pop', en='f3+0.7'),
            at('Módulo · Citas', 790, 1110, entra='pop', en='f3+0.9')]),
        escena(3, 'Datos', corte(3), corte(4), [
            at('Fondo · Crema', 540, 960),
            at('Formulario', 300, 560, escala=.9, entra='desliza-izq', en='f4', dur=.45),
            at('Sobre', 560, 760, escala=.8, entra='desliza-izq', en='f4+1.0', sale='pop', sale_en='f4+1.6'),
            at('Lista de clientes', 680, 1040, escala=.85, entra='pop', en='f4+1.5', dur=.4),
            at('Palomita', 880, 870, entra='pop', en='f4+2.3')]),
        escena(4, 'Agenda', corte(4), corte(6), [
            at('Fondo · Menta', 540, 960),
            at('Agenda del día', 560, 620, entra='pop', en='f5', dur=.4),
            at('Cita nueva', 604, 592, entra='cae', en='f5+1.2', dur=.45),
            at('Personaje S · Lupita', 190, 1010, entra='sube', en='f5+0.3'),
            at('Correo de confirmación', 640, 1110, escala=.8, entra='desliza-der', en='f6', dur=.45),
            at('Palomita', 785, 1012, entra='pop', en='f6+1.0')]),
        escena(5, 'Dominio', corte(6), corte(7), [
            at('Fondo · Crema', 540, 960),
            at('Página Flow', 540, 560, escala=.85, entra='pop', en='f7', dur=.4),
            at('Etiqueta · URL', 540, 270, texto=['tunegocio.com'], entra='pop', en='f7+0.2'),
            at('Etiqueta · Mostaza', 760, 820, texto=['¡Publicada!'], entra='pop', en='f7+1.4'),
            at('Gráfica · Tendencia', 540, 1080, escala=1.25, entra='dibuja', en='f7+2.3', dur=1.6)]),
        escena(6, 'Cierre', corte(7), DUR, [
            at('Fondo · Menta', 540, 960), at('Banderines', 0, 0),
            at('Isotipo Flow', 540, 620, escala=.8, entra='cae', en='f8', dur=.45),
            at('Etiqueta · Precio', 540, 1040, texto=['Pruébalo gratis', '15 días'], entra='pop', en='f8+0.3', sale='pop', sale_en='f9-0.1'),
            at('Marca · Flow', 540, 990, entra='pop', en='f9', dur=.35),
            at('Etiqueta · Beneficio', 540, 1170, texto=['tu negocio en un solo flujo'], nombre='Etiqueta · Cierre',
               bg='#FF7A66', fg='#FFFFFF', entra='pop', en='f9+0.5', dur=.3),
            at('Confeti', 540, 560, entra='pop', en='f9+0.2')]),
    ]
    d['children'] += [mae, camp] + esc
    json.dump(d, open(out, 'w'), ensure_ascii=False)
    print('ok', out, len(lib), 'piezas nuevas,', len(esc), 'escenas')


if __name__ == '__main__':
    main()
