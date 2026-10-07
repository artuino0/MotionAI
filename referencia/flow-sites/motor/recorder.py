"""Graba lo que dibuja el motor de papel como formas vectoriales (en vez de rasterizar).

Uso:
    with Recorder() as rec:
        ps.person(ctx, ...)      # cualquier dibujo del motor
    rec.items  -> lista de piezas en coordenadas del dispositivo
"""
import math
import cairo
import papercut_style as ps

_orig = {}


from shapely.geometry import Polygon
from shapely.ops import unary_union


class RecCtx(cairo.Context):
    """Contexto que recuerda los recortes (clip) activos en coordenadas del dispositivo."""
    def __init__(self, surface):
        super().__init__()
        self._clips = [None]

    def save(self):
        self._clips.append(self._clips[-1])
        super().save()

    def restore(self):
        if len(self._clips) > 1:
            self._clips.pop()
        super().restore()

    def clip(self):
        pts, poly = [], []
        for kind, p in self.copy_path_flat():
            if kind == cairo.PATH_MOVE_TO:
                if len(pts) > 2: poly.append(pts)
                pts = [self.user_to_device(*p)]
            elif kind == cairo.PATH_LINE_TO:
                pts.append(self.user_to_device(*p))
        if len(pts) > 2: poly.append(pts)
        g = unary_union([Polygon(p).buffer(0) for p in poly]) if poly else None
        cur = self._clips[-1]
        self._clips[-1] = g if cur is None else (cur.intersection(g) if g is not None else cur)
        super().clip()

    @property
    def cur_clip(self):
        return self._clips[-1]


def new_ctx(w=10, h=10):
    return RecCtx(cairo.ImageSurface(cairo.FORMAT_ARGB32, w, h))


def _apply_clip(subs, clip):
    if clip is None:
        return subs
    out = []
    for sp in subs:
        if len(sp) < 3:
            continue
        g = Polygon(sp).buffer(0).intersection(clip)
        for geom in getattr(g, 'geoms', [g]):
            if geom.is_empty or geom.geom_type != 'Polygon':
                continue
            out.append(list(geom.exterior.coords)[:-1])
    return out


class Recorder:
    def __init__(self):
        self.items = []
        self._group = None

    # --- reemplazos -------------------------------------------------------
    def _fillpts(self, c, pts, color, a=1.0, shadow=True):
        dev = [c.user_to_device(*p) for p in pts]
        subs = _apply_clip([dev], getattr(c, 'cur_clip', None))
        if not subs:
            return
        if self._group is not None:
            self._group.extend(subs)
            return
        self.items.append(dict(kind='fill', subpaths=subs, color=tuple(ps.col(color)[:3]), a=a, shadow=bool(shadow),
                               paper=bool(ps.S.tex) and not ps.S.clean))

    def _group_begin(self):
        self._group = []
        ps.S.group = []

    def _group_end(self, c, color, shadow=True):
        subs, self._group = self._group, None
        ps.S.group = None
        if subs:
            self.items.append(dict(kind='fill', subpaths=subs, color=tuple(ps.col(color)[:3]), a=1.0, shadow=bool(shadow),
                                   paper=bool(ps.S.tex) and not ps.S.clean))

    def _stroke(self, c, pts, w, color, a=1.0):
        dev = [c.user_to_device(*p) for p in pts]
        dx, dy = c.user_to_device_distance(w, 0)
        self.items.append(dict(kind='stroke', pts=dev, width=math.hypot(dx, dy), color=tuple(ps.col(color)[:3]), a=a))

    def _txt(self, c, s, x, y, size, color, font='NunitoBlack', align='c', a=1.0):
        w = ps.tw(c, s, size, font)
        xx = x - w / 2 if align == 'c' else (x if align == 'l' else x - w)
        bx, by = c.user_to_device(xx, y + size * 0.36)
        dx, dy = c.user_to_device_distance(size, 0)
        wx, wy = c.user_to_device_distance(w, 0)
        self.items.append(dict(kind='text', text=s, x=bx, baseline=by, size=math.hypot(dx, dy), width=math.hypot(wx, wy),
                               color=tuple(ps.col(color)[:3]), a=a, weight='900' if 'Black' in font else '700'))
        return w

    def _grain(self, c, alpha=.55):
        pass

    # --- contexto ----------------------------------------------------------
    def __enter__(self):
        for name in ('fillpts', 'group_begin', 'group_end', 'stroke', 'txt', 'grain'):
            _orig[name] = getattr(ps, name)
        ps.fillpts = self._fillpts
        ps.group_begin = self._group_begin
        ps.group_end = self._group_end
        ps.stroke = self._stroke
        ps.txt = self._txt
        ps.grain = self._grain
        # los módulos que importaron estas funciones por nombre también se parchean
        import sys
        self._patched = []
        for mod in list(sys.modules.values()):
            if mod is None or mod is ps:
                continue
            for name in ('group_begin', 'group_end', 'stroke', 'txt'):
                if getattr(mod, name, None) is _orig[name]:
                    setattr(mod, name, getattr(ps, name))
                    self._patched.append((mod, name))
        return self

    def __exit__(self, *exc):
        for name, fn in _orig.items():
            setattr(ps, name, fn)
        for mod, name in self._patched:
            setattr(mod, name, _orig[name])
        return False


def bbox(items, pad=0):
    xs, ys = [], []
    for it in items:
        if it['kind'] == 'fill':
            for sp in it['subpaths']:
                xs += [p[0] for p in sp]; ys += [p[1] for p in sp]
        elif it['kind'] == 'stroke':
            xs += [p[0] for p in it['pts']]; ys += [p[1] for p in it['pts']]
        else:
            xs += [it['x'], it['x'] + it['width']]; ys += [it['baseline'] - it['size'], it['baseline']]
    return min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad
