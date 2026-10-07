"""pen2video.py — convierte las escenas de FlowPublicidad.pen en video con el motor de papel.

Uso:
    python3 pen2video.py FlowPublicidad.pen "Flow Agenda" salida.mp4 [--desde 0 --hasta 30] [--cuadros 2.5,6.0]

Convenciones en el .pen
- Campaña: frame de primer nivel con metadata {"type":"campana","nombre":..., "audio":"recursos/voz.mp3",
  "offset":0.3, "duracion":30, "formato":"tiktok"|"reels"|"horizontal", "frases":[[ini,fin,"texto"],...]}
- Escena: frame de primer nivel (1080x1920) con metadata {"type":"escena","campana":..., "inicio":s, "fin":s}
- Cada hijo de la escena (instancia o pieza) puede llevar en metadata:
    {"type":"anim", "entra":"pop|cae|sube|desliza-izq|desliza-der|crece|corta", "en":6.8 | "f3" | "f3+0.2",
     "dur":0.35, "sale":"pop|cae|corta", "sale_en":..., más parámetros del actor (mode, gaze, happy_at, expr...)}
- Componentes con metadata "actor" se dibujan con el motor (Chattito, personajes, isotipo, confeti, manual).
- Las piezas de papel se redibujan desde su geometría con contornos vivos (cambian cada 3 cuadros).
"""
import json, math, os, re, sys, random, subprocess, argparse
import cairo, io
import papercut_style as ps
import chattito_tiktok as C

P = ps.P
W, H = 1080, 1920
FPS = 12


# ------------------------------------------------------------------ utilidades
def hex2(c):
    c = c.lstrip('#')
    r, g, b = (int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))
    a = int(c[6:8], 16) / 255 if len(c) >= 8 else 1.0
    return (r, g, b), a


_TOK = re.compile(r'[MmLlHhVvCcQqZz]|-?\d*\.?\d+(?:e-?\d+)?')


def parse_path(d, step=8):
    """SVG path -> lista de subtrazos (listas de puntos) y si cada uno está cerrado."""
    toks = _TOK.findall(d)
    subs, cur_sp, i, cur, start, cmd = [], None, 0, (0.0, 0.0), (0.0, 0.0), None

    def num():
        nonlocal i
        v = float(toks[i]); i += 1; return v
    while i < len(toks):
        if re.match('[A-Za-z]', toks[i]):
            cmd = toks[i]; i += 1
            if cmd in 'Zz':
                if cur_sp:
                    subs.append((cur_sp, True)); cur_sp = None
                cur = start
                continue
        rel = cmd.islower(); C_ = cmd.upper()
        ox, oy = cur if rel else (0, 0)
        if C_ == 'M':
            if cur_sp:
                subs.append((cur_sp, False))
            cur = (ox + num(), oy + num()); start = cur; cur_sp = [cur]; cmd = 'l' if rel else 'L'
        elif C_ == 'L':
            cur = (ox + num(), oy + num()); cur_sp.append(cur)
        elif C_ == 'H':
            cur = ((cur[0] if rel else 0) + num(), cur[1]); cur_sp.append(cur)
        elif C_ == 'V':
            cur = (cur[0], (cur[1] if rel else 0) + num()); cur_sp.append(cur)
        elif C_ == 'C':
            p1 = (ox + num(), oy + num()); p2 = (ox + num(), oy + num()); p3 = (ox + num(), oy + num()); p0 = cur
            for k in range(1, step + 1):
                u = k / step; v = 1 - u
                cur_sp.append((v**3*p0[0]+3*v*v*u*p1[0]+3*v*u*u*p2[0]+u**3*p3[0], v**3*p0[1]+3*v*v*u*p1[1]+3*v*u*u*p2[1]+u**3*p3[1]))
            cur = p3
        elif C_ == 'Q':
            p1 = (ox + num(), oy + num()); p2 = (ox + num(), oy + num()); p0 = cur
            for k in range(1, step + 1):
                u = k / step; v = 1 - u
                cur_sp.append((v*v*p0[0]+2*v*u*p1[0]+u*u*p2[0], v*v*p0[1]+2*v*u*p1[1]+u*u*p2[1]))
            cur = p2
        else:
            i += 1
    if cur_sp:
        subs.append((cur_sp, False))
    return subs


def ease(kind, x):
    x = max(0.0, min(1.0, x))
    if kind == 'back':
        return ps.eob(x, 1.8)
    return ps.eoc(x)


# ------------------------------------------------------------------ documento
class Doc:
    def __init__(self, path):
        self.path = path
        self.base = os.path.dirname(os.path.abspath(path))
        self.d = json.load(open(path))
        self.byid = {}
        for n in self.d['children']:
            self._index(n)
        self._img = {}
        self._geo = {}

    def _index(self, n):
        self.byid[n['id']] = n
        for ch in n.get('children', []) or []:
            self._index(ch)

    def image(self, url):
        if url not in self._img:
            p = os.path.join(self.base, url)
            self._img[url] = cairo.ImageSurface.create_from_png(p) if os.path.exists(p) else None
        return self._img[url]

    def geometry(self, node):
        k = node['id']
        if k not in self._geo:
            self._geo[k] = parse_path(node.get('geometry', ''))
        return self._geo[k]

    def campaign(self, name):
        for n in self.d['children']:
            m = n.get('metadata') or {}
            if m.get('type') == 'campana' and m.get('nombre') == name:
                return n, m
        raise SystemExit('No encontré la campaña «%s» en el archivo.' % name)

    def scenes(self, name):
        out = [n for n in self.d['children'] if (n.get('metadata') or {}).get('type') == 'escena'
               and n['metadata'].get('campana') == name]
        return sorted(out, key=lambda n: n['metadata']['inicio'])


# ------------------------------------------------------------------ render
class Renderer:
    def __init__(self, doc, camp_meta):
        self.doc = doc
        self.cm = camp_meta
        self.frases = camp_meta.get('frases', [])
        self.ocultas = camp_meta.get('sin_subtitulo', [])   # números de frase (1, 2…) que no llevan subtítulo

    def at(self, v):
        """Convierte "f3", "f3+0.2" o un número a segundos del video."""
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return float(v)
        m = re.match(r'f(\d+)([+-][\d.]+)?$', str(v).strip())
        if m:
            return self.frases[int(m.group(1)) - 1][0] + float(m.group(2) or 0)
        return float(v)

    # --- animación de entrada / salida -----------------------------------------
    def anim(self, meta, t, w, h):
        """Devuelve (visible, dx, dy, sx, sy, piv) para la animación del nodo."""
        e_kind = meta.get('entra')
        t0 = self.at(meta.get('en', 0))
        dur = float(meta.get('dur', .35))
        dx = dy = 0.0; sx = sy = 1.0
        if t0 is not None and t < t0:
            return False, 0, 0, 1, 1
        if e_kind:
            p = (t - t0) / dur if dur > 0 else 1
            if e_kind == 'pop':
                s = ease('back', p) if p < 1 else 1; sx = sy = max(s, .01)
            elif e_kind == 'cae':
                dy = -(1 - ease('back', p)) * 900
            elif e_kind == 'sube':
                dy = (1 - ease('back', p)) * 900
            elif e_kind == 'desliza-izq':
                dx = -(1 - ease('back', p)) * 1100
            elif e_kind == 'desliza-der':
                dx = (1 - ease('back', p)) * 1100
            elif e_kind == 'crece':
                sy = max(ease('cubic', p), .01)
        s_kind = meta.get('sale')
        if s_kind:
            t1 = self.at(meta.get('sale_en'))
            if t >= t1 + dur:
                return False, 0, 0, 1, 1
            if t >= t1:
                p = (t - t1) / dur
                if s_kind == 'pop':
                    sx = sy = max(1 - ease('cubic', p), .01)
                elif s_kind == 'cae':
                    dy += ease('cubic', p) ** 2 * 1500
                elif s_kind == 'corta':
                    return False, 0, 0, 1, 1
        return True, dx, dy, sx, sy

    # --- nodos ----------------------------------------------------------------
    def draw_node(self, c, n, t, meta_over=None, root=False):
        if n.get('enabled') is False:
            return
        typ = n['type']
        inst_meta = dict(n.get('metadata') or {})
        comp = None
        if typ == 'ref':
            comp = self.doc.byid.get(n['ref'])
            if comp is None:
                return
        base = comp or n
        cmeta = dict((base.get('metadata') or {}))
        if comp is not None:
            # la metadata de la instancia (animación y parámetros) manda sobre la del componente
            cmeta.update({k: v for k, v in inst_meta.items() if k != 'type'})
        elif inst_meta.get('type') == 'anim':
            cmeta = inst_meta
        if meta_over:
            cmeta.update(meta_over)
        w = n.get('width', base.get('width', 0)) or 0
        h = n.get('height', base.get('height', 0)) or 0
        if not isinstance(w, (int, float)): w = base.get('width', 0)
        if not isinstance(h, (int, float)): h = base.get('height', 0)
        vis, dx, dy, sx, sy = self.anim(cmeta, t, w, h)
        if not vis:
            return
        c.save()
        c.translate(n.get('x', 0) + dx, n.get('y', 0) + dy)
        rot = n.get('rotation', base.get('rotation', 0)) or 0
        if rot:
            c.rotate(-math.radians(rot))
        esc = cmeta.get('escala')          # tamaño en la escena: 'escala': 2.5 agranda desde la esquina del nodo
        if esc and esc != 1:
            c.scale(esc, esc)
        if cmeta.get('entra') == 'dibuja':  # se revela de izquierda a derecha, como si se fuera dibujando
            t0 = self.at(cmeta.get('en', 0)) or 0
            pr = ease('cubic', min(1, max(0, (t - t0) / float(cmeta.get('dur', 1.2)))))
            c.rectangle(-40, -40, (w + 40) * pr + 40, h + 80)
            c.clip()
        if sx != 1 or sy != 1:
            piv = cmeta.get('anchor') or [w / 2, h / 2]
            if cmeta.get('entra') == 'crece':
                piv = [w / 2, h]
            c.translate(*piv); c.scale(sx, sy); c.translate(-piv[0], -piv[1])
        kind = cmeta.get('type')
        if kind == 'actor' or kind in ('etiqueta', 'globo'):
            self.draw_special(c, base, n, cmeta, t)
        elif typ in ('frame', 'ref', 'group'):
            self.draw_container(c, base, n, t)
        elif typ == 'path':
            self.draw_path(c, n, t)
        elif typ == 'text':
            self.draw_text(c, n)
        elif typ in ('rectangle', 'ellipse'):
            self.draw_shape(c, n)
        elif typ == 'icon':
            self.draw_icon(c, n)
        c.restore()

    def overrides(self, inst):
        return (inst.get('descendants') or {}) if inst.get('type') == 'ref' else {}

    def draw_container(self, c, base, inst, t):
        w, h = base.get('width', 0), base.get('height', 0)
        if not isinstance(w, (int, float)) or not isinstance(h, (int, float)) or (self.lay(base) in ('vertical', 'horizontal') and not (w and h)):
            mw, mh = self.measure(c, dict(base, width=w if isinstance(w, (int, float)) and w else None,
                                          height=h if isinstance(h, (int, float)) and h else None))
            w, h = (w if isinstance(w, (int, float)) and w else mw), (h if isinstance(h, (int, float)) and h else mh)
        meta = base.get('metadata') or {}
        if meta.get('type') == 'fondo':
            pc = lambda v: P[v] if v in P else ps.hx(v)
            ps.wall(c, pc(meta['base']), pc(meta['stripe']), pc(meta['dot']), meta.get('dot_a', .9))
        else:
            self.paint_fill(c, base.get('fill'), w, h, base.get('cornerRadius', 0))
        if base.get('clip'):
            c.save(); c.rectangle(0, 0, w, h); c.clip()
        ov = self.overrides(inst)
        kids = []
        for ch in base.get('children', []) or []:
            o = ov.get(ch['id'])
            kids.append(dict(ch, **o) if o else ch)
        if self.lay(base) in ('vertical', 'horizontal'):
            kids = self.flex(c, dict(base, layout=self.lay(base)), kids, w, h)
        for node in kids:
            self.draw_node(c, node, t)
        if base.get('clip'):
            c.restore()

    @staticmethod
    def lay(n):
        # en Pencil un frame sin «layout» es horizontal
        return n.get('layout', 'horizontal') if n.get('type') == 'frame' else n.get('layout', 'none')

    # --- distribución automática (flex de Pencil, versión simple) ---------------
    def measure(self, c, n, pw=None, ph=None):
        typ = n['type']
        if typ == 'ref':
            b = self.doc.byid.get(n['ref'], {})
            return self.measure(c, dict(b, **{k: v for k, v in n.items() if k in ('width', 'height')}), pw, ph)
        w, h = n.get('width'), n.get('height')
        if typ == 'text':
            size = n.get('fontSize', 16)
            font = 'NunitoBlack' if str(n.get('fontWeight', '700')) in ('800', '900') else 'NunitoBold'
            lines = str(n.get('content', '')).split('\n')
            tw_ = max(ps.tw(c, l, size, font) for l in lines)
            th = size * n.get('lineHeight', 1.36) * len(lines)
            return (tw_ if not isinstance(w, (int, float)) or n.get('textGrowth') in (None, 'auto') else w), th
        if typ == 'frame' and self.lay(n) in ('vertical', 'horizontal') and (not isinstance(w, (int, float)) or not isinstance(h, (int, float))):
            pad = self._pad(n)
            sizes = [self.measure(c, k) for k in n.get('children', []) if k.get('layoutPosition') != 'absolute']
            g = n.get('gap', 0) or 0
            if self.lay(n) == 'vertical':
                fw = max([s[0] for s in sizes] or [0]) + pad[1] + pad[3]
                fh = sum(s[1] for s in sizes) + g * max(0, len(sizes) - 1) + pad[0] + pad[2]
            else:
                fw = sum(s[0] for s in sizes) + g * max(0, len(sizes) - 1) + pad[1] + pad[3]
                fh = max([s[1] for s in sizes] or [0]) + pad[0] + pad[2]
            w = w if isinstance(w, (int, float)) else (pw if w == 'fill_container' and pw else fw)
            h = h if isinstance(h, (int, float)) else (ph if h == 'fill_container' and ph else fh)
            return w, h
        w = w if isinstance(w, (int, float)) else (pw or 0)
        h = h if isinstance(h, (int, float)) else (ph or 0)
        return w, h

    @staticmethod
    def _pad(n):
        p = n.get('padding', 0) or 0
        if isinstance(p, (int, float)):
            return [p, p, p, p]
        if len(p) == 2:
            return [p[0], p[1], p[0], p[1]]
        return list(p)

    def flex(self, c, base, kids, w, h):
        pad = self._pad(base)
        vert = base['layout'] == 'vertical'
        g = base.get('gap', 0) or 0
        inner_w, inner_h = w - pad[1] - pad[3], h - pad[0] - pad[2]
        flow = [k for k in kids if k.get('layoutPosition') != 'absolute']
        sizes = []
        for k in flow:
            kw, kh = self.measure(c, k, inner_w if (k.get('width') == 'fill_container') else None,
                                  inner_h if (k.get('height') == 'fill_container') else None)
            sizes.append([kw, kh])
        main = sum(s[1] if vert else s[0] for s in sizes) + g * max(0, len(sizes) - 1)
        avail = inner_h if vert else inner_w
        jc = base.get('justifyContent', 'start')
        pos = 0; gap = g
        if jc == 'center':
            pos = (avail - main) / 2
        elif jc == 'end':
            pos = avail - main
        elif jc == 'space_between' and len(sizes) > 1:
            gap = (avail - main + g * (len(sizes) - 1)) / (len(sizes) - 1)
        ai = base.get('alignItems', 'start')
        out = []
        for k, (kw, kh) in zip(flow, sizes):
            cross_avail = inner_w if vert else inner_h
            cs = kw if vert else kh
            off = (cross_avail - cs) / 2 if ai == 'center' else (cross_avail - cs if ai == 'end' else 0)
            if vert:
                x, y = pad[3] + off, pad[0] + pos; pos += kh + gap
            else:
                x, y = pad[3] + pos, pad[0] + off; pos += kw + gap
            nk = dict(k, x=x, y=y)
            if k.get('width') == 'fill_container' or not isinstance(k.get('width', 0), (int, float)):
                nk['width'] = kw
            if k.get('height') == 'fill_container' or not isinstance(k.get('height', 0), (int, float)):
                nk['height'] = kh
            out.append(nk)
        return out + [k for k in kids if k.get('layoutPosition') == 'absolute']

    def paint_fill(self, c, fill, w, h, r=0):
        if not fill:
            return
        for f in (fill if isinstance(fill, list) else [fill]):
            if isinstance(f, str):
                rgb, a = hex2(f)
                c.save(); c.rectangle(0, 0, w, h); c.set_source_rgba(*ps.col(rgb, a)); c.fill(); c.restore()
            elif isinstance(f, dict) and f.get('type') == 'image':
                self.paint_image(c, f, w, h)

    def paint_image(self, c, f, w, h):
        if 'grano' in f.get('url', ''):
            c.save(); c.rectangle(0, 0, w, h); c.clip(); ps.grain(c, .6); c.restore()
            return
        img = self.doc.image(f['url'])
        if img is None or not w or not h:
            return
        iw, ih = img.get_width(), img.get_height()
        mode = f.get('mode', 'cover')
        s = (max if mode == 'cover' else min)(w / iw, h / ih)
        c.save(); c.rectangle(0, 0, w, h); c.clip()
        c.translate((w - iw * s) / 2, (h - ih * s) / 2); c.scale(s, s)
        c.set_source_surface(img, 0, 0); c.paint_with_alpha(f.get('opacity', 1))
        c.restore()

    def draw_path(self, c, n, t):
        subs = self.doc.geometry(n)
        if not subs:
            return
        vb = n.get('viewBox')
        w, h = n.get('width', 1), n.get('height', 1)
        c.save()
        if vb and vb[2] and vb[3]:
            c.scale(w / vb[2], h / vb[3]); c.translate(-vb[0], -vb[1])
        # contornos vivos: cada 3 cuadros los vértices se mueven un poco
        rnd = random.Random(hash(n['id']) * 31 + ps.S.boil)
        amp = 1.4 if n.get('name') == 'Filo' else .9
        jit = [[(x + rnd.uniform(-amp, amp), y + rnd.uniform(-amp, amp)) for x, y in sp] for sp, closed in subs]
        fill = n.get('fill')
        if n.get('stroke') and not fill:
            rgb, a = hex2(n['stroke'] if isinstance(n['stroke'], str) else '#000000')
            for sp in jit:
                c.move_to(*sp[0]); [c.line_to(*p) for p in sp[1:]]
            c.set_line_width(n.get('strokeWidth', 1)); c.set_line_cap(cairo.LINE_CAP_ROUND); c.set_line_join(cairo.LINE_JOIN_ROUND)
            c.set_source_rgba(*ps.col(rgb, a)); c.stroke(); c.restore()
            return

        def trace():
            for sp in jit:
                c.move_to(*sp[0]); [c.line_to(*p) for p in sp[1:]]; c.close_path()
        eff = n.get('effect')
        if eff and (eff if isinstance(eff, dict) else eff[0]).get('type') == 'shadow':
            for ddx, ddy, al in [(7.5, 10.5, .06), (5, 7, .08), (2.5, 3.5, .06)]:
                c.save(); c.translate(ddx, ddy); trace(); c.set_source_rgba(0, 0, 0, al); c.fill(); c.restore()
        fills = fill if isinstance(fill, list) else [fill]
        for f in fills:
            if isinstance(f, str):
                rgb, a = hex2(f)
                trace(); c.set_source_rgba(*ps.col(rgb, a)); c.fill()
            elif isinstance(f, dict) and f.get('type') == 'image' and 'grano' in f.get('url', '') and ps.S.tex:
                c.save(); trace(); c.clip(); ps.grain(c, .6); c.restore()
            elif isinstance(f, dict) and f.get('type') == 'color':
                rgb, a = hex2(f['color'])
                trace(); c.set_source_rgba(*ps.col(rgb, a)); c.fill()
        c.restore()

    def draw_text(self, c, n):
        rgb, a = hex2(n.get('fill', '#000000') if isinstance(n.get('fill'), str) else '#000000')
        size = n.get('fontSize', 16)
        font = 'NunitoBlack' if str(n.get('fontWeight', '700')) in ('800', '900') else 'NunitoBold'
        lh = n.get('lineHeight', 1.36)
        for k, line in enumerate(str(n.get('content', '')).split('\n')):
            base_y = size * (lh - 1) / 2 + 0.93 * size + k * size * lh
            c.select_font_face(font); c.set_font_size(size)
            c.move_to(0, base_y); c.set_source_rgba(*ps.col(rgb, a)); c.show_text(line)

    _icon_cache = {}

    def draw_icon(self, c, n):
        import cairosvg
        name = n.get('icon', '')
        w, h = n.get('width', 24), n.get('height', 24)
        fill = n.get('fill', '#000000')
        col = fill if isinstance(fill, str) else '#000000'
        key = (name, int(w), int(h), col)
        if key not in self._icon_cache:
            p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'iconos', name + '.svg')
            if not os.path.exists(p):
                self._icon_cache[key] = None
            else:
                svg = open(p).read().replace('currentColor', col[:7])
                png = cairosvg.svg2png(bytestring=svg.encode(), output_width=int(w * 2), output_height=int(h * 2))
                self._icon_cache[key] = cairo.ImageSurface.create_from_png(io.BytesIO(png))
        img = self._icon_cache[key]
        if img is not None:
            c.save(); c.scale(.5, .5); c.set_source_surface(img, 0, 0); c.paint(); c.restore()

    def draw_shape(self, c, n):
        w, h = n.get('width', 0), n.get('height', 0)
        fill = n.get('fill')
        if isinstance(fill, dict) and fill.get('type') == 'image':
            self.paint_image(c, fill, w, h); return
        if n['type'] == 'ellipse':
            c.save(); c.translate(w / 2, h / 2); c.scale(max(w, .1) / 2, max(h, .1) / 2); c.arc(0, 0, 1, 0, 2 * math.pi); c.restore()
        else:
            c.rectangle(0, 0, w, h)
        if isinstance(fill, str):
            rgb, a = hex2(fill); c.set_source_rgba(*ps.col(rgb, a)); c.fill()
        else:
            c.new_path()

    # --- actores del motor ----------------------------------------------------
    def texts(self, base, inst):
        ov = self.overrides(inst)
        out = []
        for ch in base.get('children', []):
            if ch['type'] == 'text':
                o = ov.get(ch['id']) or {}
                out.append((ch.get('y', 0), o.get('content', ch.get('content', ''))))
        out.sort()
        return [s for _, s in out]

    def draw_special(self, c, base, inst, m, t):
        ax, ay = m.get('anchor', [base.get('width', 0) / 2, base.get('height', 0) / 2])
        kind, actor = m.get('type'), m.get('actor')
        if kind == 'etiqueta':
            lines = self.texts(base, inst)
            fnt = m.get('font', 'NunitoBlack')
            ps.tag(c, ax, ay, lines, m['size'], hex2(m['bg'])[0], hex2(m['fg'])[0], ang=m.get('ang', 0), tape=m.get('tape', True),
                   font=fnt, pad=(30, 16) if fnt == 'NunitoBold' else (34, 22))
        elif kind == 'globo':
            lines = self.texts(base, inst)
            lines = [l for l in lines if l != '?']
            C.bubble(c, ax, ay, lines, 1, tail=m.get('tail', 'l'), size=m.get('size', 40), q=m.get('q', True))
        elif actor == 'chattito':
            mode = m.get('mode', 'neutral')
            gaze = m.get('gaze', 0)
            if isinstance(gaze, list):
                gaze = C.gaze_track(t, [(self.at(a), v) for a, v in gaze])
            if isinstance(mode, list):
                mode = [(self.at(a), v) for a, v in mode]
            C.chattito(c, ax, ay, m.get('s', .62), mode, t=t, gaze=gaze,
                       happy_at=tuple(self.at(a) for a in m.get('happy_at', [])), elated=m.get('elated', False), acc=m.get('acc'))
        elif actor == 'conexion':
            # línea de papel que se tiende de p0 a p1 y bolitas que viajan por ella
            p0, p1 = m.get('p0', [0, 0]), m.get('p1', [base.get('width', 100), base.get('height', 100)])
            t0 = self.at(m.get('en', 0)) or 0
            g = ease('cubic', min(1, max(0, (t - t0) / .45)))
            if g > 0:
                pe = (p0[0] + (p1[0] - p0[0]) * g, p0[1] + (p1[1] - p0[1]) * g)
                n = 14
                pts = [(p0[0] + (pe[0] - p0[0]) * k / n, p0[1] + (pe[1] - p0[1]) * k / n) for k in range(n + 1)]
                ps.stroke(c, pts, m.get('grosor', 7), hex2(m.get('color', '#006E84'))[0], a=.85)
            nb, per = int(m.get('bolitas', 1)), float(m.get('periodo', 1.4))
            tb = t - t0 - .45
            if tb > 0:
                cols = [P['coral'], P['mustard'], P['teal2']]
                for k in range(nb):
                    u = (tb / per - k / max(nb, 1)) % 1.0 if tb >= k * per / max(nb, 1) else None
                    if u is None:
                        continue
                    x, y = p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u
                    r = 15 * (1 - max(0, u - .85) / .15 * .6)
                    ps.ell(c, x, y, r, r, cols[k % 3], amp=.5)
        elif actor == 'persona':
            import flowcore_tiktok as FC
            presets = {'duena': ps.OWNER, 'clienta': ps.CLIENT, 'cliente': ps.GUY, 'dentista': ps.DENT, 'barbero': ps.BARB,
                       'asesora': ps.ASES, 'mecanico': FC.MECH, 'distribuidora': FC.DIST}
            expr = m.get('expr', 'happy')
            if isinstance(expr, list):
                cur = expr[0][1]
                for a, v in expr:
                    if t >= self.at(a):
                        cur = v
                expr = cur
            ps.S.desat = m.get('desat', 0)
            ps.person(c, ax, ay, m.get('s', 1.0), presets[m['preset']], expr)
            if m['preset'] == 'mecanico':
                FC.cap(c, ax, ay, m.get('s', 1.0), ps.hx('2F5D8A'))
            ps.S.desat = 0
        elif actor == 'isotipo':
            t0 = self.at(m.get('en', 0))
            ps.isotipo(c, ax, ay, m.get('size', 330), t=t, t0=t0, step=.14)
        elif actor == 'confeti':
            t0 = self.at(m.get('en', 0))
            C.Burst(ax, ay, m.get('n', 90), m.get('seed', 9), spread=m.get('spread', 380)).draw(c, t - t0)
        elif actor == 'manual':
            n = m.get('n', 6)
            if 'n_keys' in m:
                ks = [(self.at(a), v) for a, v in m['n_keys']]
                n = ks[0][1]
                for (a0, v0), (a1, v1) in zip(ks, ks[1:]):
                    if a0 <= t < a1:
                        n = v0 + (v1 - v0) * (t - a0) / (a1 - a0)
                    elif t >= a1:
                        n = v1
            C.manual(c, ax, ay, n, m.get('s', 1.0), m.get('rot', -.05))
        elif actor == 'globo_escribiendo':
            C.group_begin()
            ps.rrect(c, ax - 110, ay - 50, 220, 100, 40, P['white'])
            ps.shape(c, [(ax - 90, ay + 20), (ax - 140, ay + 60), (ax - 60, ay + 40)], P['white'])
            C.group_end(c, P['white'])
            for k, ddx in enumerate((-50, 0, 50)):
                u = ((t - k * 1.4 / 3) % 1.4) / 1.4
                e = C._io(u * 6) if u < 1 / 6 else (1 - C._io((u - 1 / 6) * 6) if u < 1 / 3 else 0)
                ps.ell(c, ax + ddx, ay - 10 * e, 13, 13, P['ink'], shadow=False, amp=.4, a=.35 + .65 * e)

    # --- subtítulos -------------------------------------------------------------
    def subtitles(self, c, t, cx, y):
        fr = self.frases
        ocultas = set(getattr(self, 'ocultas', ()) or ())
        for i, (a, b, s) in enumerate(fr):
            if i + 1 in ocultas:      # frase que ya va en un letrero de la escena
                continue
            nxt = fr[i + 1][0] if i + 1 < len(fr) else 1e9
            if nxt - b < .5:
                b = nxt - .02
            if a <= t < b:
                size = 48
                lines = partir(c, s, size)
                ps.tag(c, cx, y, lines, size, P['paper'], P['ink'], tape=False, font='NunitoBold', pad=(30, 16))


def partir(c, s, size, ancho=720):
    """Parte un subtítulo en 1, 2 o 3 renglones parejos que no pasen de `ancho`. Un salto de línea en el texto manda."""
    if '\n' in s:
        return [l.strip() for l in s.split('\n') if l.strip()]
    W = lambda x: ps.tw(c, x, size, 'NunitoBold')
    if W(s) <= ancho + 80:
        return [s]
    ws = s.split(' ')
    j = lambda a, b: ' '.join(ws[a:b])
    dos = min(((max(W(j(0, k)), W(j(k, None))), [j(0, k), j(k, None)]) for k in range(1, len(ws))), key=lambda z: z[0])
    if dos[0] <= ancho or len(ws) < 3:
        return dos[1]
    tres = min(((max(W(j(0, a)), W(j(a, b)), W(j(b, None))), [j(0, a), j(a, b), j(b, None)])
                for a in range(1, len(ws) - 1) for b in range(a + 1, len(ws))), key=lambda z: z[0])
    return tres[1]


def render_campaign(pen, name, out, desde=None, hasta=None, solo=None, frames_dir=None, escala=1.0, crf=20):
    import tempfile
    frames_dir = frames_dir or os.path.join(tempfile.gettempdir(), 'flow_p2v_frames')
    doc = Doc(pen)
    camp, cm = doc.campaign(name)
    R = Renderer(doc, cm)
    scenes = doc.scenes(name)
    dur = cm.get('duracion', max(s['metadata']['fin'] for s in scenes))
    fmt = cm.get('formato', 'tiktok')
    sub_x, sub_y = {'tiktok': (500, 1380), 'reels': (540, 1610), 'horizontal': (960, 960)}.get(fmt, (540, 1610))
    os.makedirs(frames_dir, exist_ok=True)
    nf = int(dur * FPS)
    rng = range(int((desde or 0) * FPS), int((hasta or dur) * FPS)) if solo is None else [int(round(x * FPS)) for x in solo]
    for fi in rng:
        t = fi / FPS
        ps.begin_frame(fi, textura=True)
        sc = next((s for s in scenes if s['metadata']['inicio'] <= t < s['metadata']['fin']), None)
        sw, sh = (sc['width'], sc['height']) if sc else (1080, 1920)
        surf = cairo.ImageSurface(cairo.FORMAT_RGB24, int(round(sw * escala / 2)) * 2, int(round(sh * escala / 2)) * 2)
        c = cairo.Context(surf)
        c.scale(escala, escala)
        c.set_source_rgb(*P['cream']); c.paint()
        if sc:
            sm = sc['metadata']
            ps.S.desat = sm.get('desat', 0)
            node = dict(sc, x=0, y=0, metadata={})
            R.draw_container(c, node, node, t)
            ps.S.desat = 0
        R.subtitles(c, t, sub_x, sub_y)
        surf.write_to_png(f'{frames_dir}/f{fi:04d}.png')
    if solo is None and out:
        audio = cm.get('audio')
        cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-framerate', str(FPS), '-start_number', str(rng[0]),
               '-i', f'{frames_dir}/f%04d.png']
        if audio and os.path.exists(os.path.join(doc.base, audio)):
            cmd += ['-i', os.path.join(doc.base, audio), '-filter_complex',
                    f"[0:v]fps=24,format=yuv420p[v];[1:a]adelay={int(cm.get('offset', 0) * 1000)},apad[a]", '-map', '[v]', '-map', '[a]',
                    '-c:a', 'aac', '-b:a', '192k']
        else:
            cmd += ['-vf', 'fps=24,format=yuv420p']
        cmd += ['-c:v', 'libx264', '-crf', str(crf), '-t', str(len(rng) / FPS), '-movflags', '+faststart', out]
        subprocess.run(cmd, check=True)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('pen'); ap.add_argument('campana'); ap.add_argument('salida', nargs='?')
    ap.add_argument('--desde', type=float); ap.add_argument('--hasta', type=float)
    ap.add_argument('--cuadros', type=str, help='lista de segundos a renderizar como PNG, p. ej. 2.5,6')
    ap.add_argument('--dir', default=None)
    a = ap.parse_args()
    solo = [float(x) for x in a.cuadros.split(',')] if a.cuadros else None
    render_campaign(a.pen, a.campana, a.salida, a.desde, a.hasta, solo, a.dir)
