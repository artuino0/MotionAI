"""preview.py — previo rápido de una campaña de FlowPublicidad.pen en una página HTML.

    python3 preview.py FlowPublicidad.pen "Ejemplo Chattito" salida.html [--escala 0.33]

Renderiza a baja resolución, corta un clip por escena y arma una página con:
reproductor general (con voz), línea de tiempo (escenas, frases y entradas de piezas)
y una tarjeta por escena con su propio reproductor y la lista de piezas.
"""
import argparse, base64, json, os, subprocess, shutil, html
from pen2video import Doc, Renderer, render_campaign

import tempfile
TMP = os.path.join(tempfile.gettempdir(), 'flow_preview_tmp')


def b64(path, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(open(path, 'rb').read()).decode())


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *args], check=True)


def caja(ch, comp, m):
    """Rectángulo aproximado de la pieza en coordenadas de la escena (para seleccionarla en el monitor)."""
    num = lambda v: v if isinstance(v, (int, float)) else None
    w = num(ch.get('width')) or num((comp or {}).get('width')) or 0
    h = num(ch.get('height')) or num((comp or {}).get('height')) or 0
    k = m.get('escala') or 1
    return [round(ch.get('x', 0), 1), round(ch.get('y', 0), 1), round(w * k, 1), round(h * k, 1)]


def piezas(doc, R, scene):
    out = []
    for ch in scene.get('children', []):
        m = dict(ch.get('metadata') or {})
        comp = doc.byid.get(ch.get('ref')) if ch.get('type') == 'ref' else None
        cm = (comp or {}).get('metadata') or {}
        if cm.get('type') == 'fondo':
            tipo = 'fondo'
        elif cm.get('actor'):
            tipo = cm['actor']
        else:
            tipo = cm.get('type', ch.get('type'))
        en = R.at(m.get('en')) if m.get('en') is not None else None
        sale = R.at(m.get('sale_en')) if m.get('sale_en') is not None else None
        texto = None
        if ch.get('descendants'):
            texto = ' / '.join(v.get('content', '') for v in ch['descendants'].values() if 'content' in v)
        extra, marcas = [], []
        ETQ = {'mode': 'estado', 'gaze': 'mirada', 'happy_at': 'salto', 'expr': 'gesto', 'n_keys': 'clave'}
        for k in ('mode', 'gaze', 'happy_at', 'expr', 'n_keys'):
            if k in m:
                extra.append(k)
                for v in (m[k] if isinstance(m[k], list) else [m[k]]):
                    t, val = (v[0], v[1] if len(v) > 1 else None) if isinstance(v, list) else (v, None)
                    try:
                        tt = R.at(t)
                    except Exception:
                        continue
                    if tt is None or tt < scene['metadata']['inicio'] + .01:
                        continue
                    marcas.append([round(tt, 2), ETQ[k] + ('' if val is None else ' → %s' % val)])
        out.append({'nombre': ch.get('name', ''), 'tipo': tipo, 'entra': m.get('entra') or ('aparece' if en is not None else 'fija'),
                    'en': en, 'en_txt': str(m.get('en')) if m.get('en') is not None else None, 'dur': m.get('dur', .35 if m.get('entra') else None),
                    'sale': m.get('sale'), 'sale_en': sale, 'texto': texto, 'extra': extra, 'marcas': marcas,
                    'id': ch.get('id'), 'comp': (comp or {}).get('name'), 'box': caja(ch, comp, m)})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pen'); ap.add_argument('campana'); ap.add_argument('salida')
    ap.add_argument('--escala', type=float, default=1 / 3)
    ap.add_argument('--reusar', action='store_true', help='no vuelve a renderizar; solo rearma la página')
    a = ap.parse_args()
    tmp_full = os.path.join(TMP, 'completo_raw.mp4')
    reusar = a.reusar and os.path.exists(tmp_full)
    if not reusar:
        shutil.rmtree(TMP, ignore_errors=True); os.makedirs(TMP)
    shutil.rmtree(os.path.join(TMP, 'tira'), ignore_errors=True)
    doc = Doc(a.pen)
    camp, cm = doc.campaign(a.campana)
    R = Renderer(doc, cm)
    scenes = doc.scenes(a.campana)
    full = os.path.join(TMP, 'completo.mp4')
    if not reusar:
      render_campaign(a.pen, a.campana, tmp_full, frames_dir=os.path.join(TMP, 'f'), escala=a.escala, crf=27)
    # cuadro clave cada medio segundo: se puede arrastrar sin trabarse
    ffmpeg('-i', tmp_full, '-c:v', 'libx264', '-profile:v', 'main', '-level', '3.1', '-pix_fmt', 'yuv420p', '-crf', '27', '-g', '12',
           '-keyint_min', '12', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-movflags', '+faststart', full)
    # respaldo WebM por si el navegador no reproduce el MP4 (algunos visores incrustados)
    webm = os.path.join(TMP, 'completo.webm')
    ffmpeg('-i', full, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '42', '-g', '12', '-deadline', 'good', '-cpu-used', '5', '-row-mt', '1',
           '-c:a', 'libopus', '-b:a', '96k', webm)
    data = {'campana': cm.get('nombre'), 'duracion': cm.get('duracion'), 'formato': cm.get('formato', 'tiktok'),
            'offset': cm.get('offset', 0), 'audio': cm.get('audio'), 'frases': cm.get('frases', []),
            'video': b64(full, 'video/mp4'), 'video_webm': b64(webm, 'video/webm'), 'escenas': []}
    for i, sc in enumerate(scenes):
        sm = sc['metadata']
        poster = os.path.join(TMP, 'poster_%02d.jpg' % i)
        ffmpeg('-ss', str(sm['inicio'] + (sm['fin'] - sm['inicio']) * .6), '-i', full, '-frames:v', '1', '-vf', 'scale=180:-2', '-q:v', '5', poster)
        frs = [[j + 1, f[0], f[1], f[2]] for j, f in enumerate(cm.get('frases', [])) if f[0] < sm['fin'] and f[1] > sm['inicio']]
        data['escenas'].append({'nombre': sc['name'], 'id': sc.get('id'), 'w': sc.get('width', 1080), 'h': sc.get('height', 1920), 'inicio': sm['inicio'], 'fin': sm['fin'], 'desat': sm.get('desat', 0),
                                'poster': b64(poster, 'image/jpeg'),
                                'piezas': piezas(doc, R, sc), 'frases': frs})
    # tira de cuadros (2 por segundo) para la pista de video
    tdir = os.path.join(TMP, 'tira'); os.makedirs(tdir, exist_ok=True)
    ffmpeg('-i', full, '-vf', 'fps=2,scale=72:-2', '-q:v', '7', os.path.join(tdir, '%04d.jpg'))
    data['tira'] = [b64(os.path.join(tdir, f), 'image/jpeg') for f in sorted(os.listdir(tdir))]
    # forma de onda de la voz (50 valores por segundo, 0-100)
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', full, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], capture_output=True).stdout
    import numpy as np
    w = np.abs(np.frombuffer(pcm, dtype=np.int16).astype(np.float32))
    n = 160
    w = w[:len(w) // n * n].reshape(-1, n).max(axis=1) if len(w) >= n else np.zeros(1)
    data['onda'] = (np.sqrt(w / max(w.max(), 1)) * 100).astype(int).tolist()
    tpl = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preview_template.html')).read()
    out = tpl.replace('__TITULO__', html.escape(cm.get('nombre', 'Campaña'))).replace('__DATA__', json.dumps(data, ensure_ascii=False))
    open(a.salida, 'w').write(out)
    print('ok', a.salida, round(os.path.getsize(a.salida) / 1e6, 2), 'MB')


if __name__ == '__main__':
    main()
