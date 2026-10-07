"""Ejemplo: escena nueva de 4 s con el motor de estilo, sin tocar el comercial original."""
import os, cairo, papercut_style as ps

W, H, FPS = ps.W, ps.H, ps.FPS
os.makedirs('frames_ejemplo', exist_ok=True)

for fi in range(int(4 * FPS)):
    t = fi / FPS
    ps.begin_frame(fi, textura=True)
    surf = cairo.ImageSurface(cairo.FORMAT_RGB24, W, H)
    c = cairo.Context(surf)
    ps.wall(c, ps.P['mintL'], ps.hx('CBE8DC'), ps.P['paper'])
    ps.bunting(c, -6, [ps.P['coral'], ps.P['mustard'], ps.P['teal2'], ps.P['mint'], ps.P['sky']])
    ps.person(c, 540, 620, 1.3, ps.BARB, 'happy')
    ps.tag(c, 540, 1300, ['Tu negocio, organizado'], 64, ps.P['teal'], ps.P['white'],
           ang=-2, sc=ps.eob(ps.prog(t, 0.8, .3), 2))
    ps.isotipo(c, 540, 1600, 160, t=t, t0=1.5)
    surf.write_to_png(f'frames_ejemplo/f{fi:04d}.png')

# MP4:  ffmpeg -framerate 12 -i frames_ejemplo/f%04d.png -vf fps=24,format=yuv420p ejemplo.mp4
