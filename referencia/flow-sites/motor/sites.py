"""Utilería de Flow Sites en papel recortado: la página web y lo que pasa con ella.
Tamaño nativo grande (para usarse como protagonista en una escena 1080 × 1920)."""
import math
import papercut_style as ps
from papercut_style import P, hx, rect, rrect, ell, shape, stroke, txt

GRIS, GRIS_D, GRIS_L = hx('C9C3BD'), hx('9C958F'), hx('E6E1DC')


def ventana(c, w, h, barra, url, url_col=None):
    """Ventana de navegador: papel blanco con barra de pestaña y dirección."""
    rrect(c, -w / 2, -h / 2, w, h, 26, P['white'])
    rrect(c, -w / 2, -h / 2, w, 64, 26, barra, shadow=False)
    rect(c, -w / 2, -h / 2 + 34, w, 30, barra, shadow=False, amp=.6)
    for k, col in enumerate([P['coral'], P['mustard'], P['mint']]):
        ell(c, -w / 2 + 34 + k * 30, -h / 2 + 32, 9, 9, col, shadow=False, amp=.4)
    rrect(c, -w / 2 + 140, -h / 2 + 14, w - 180, 36, 18, P['paper'], shadow=False)
    txt(c, url, -w / 2 + 160, -h / 2 + 33, 20, url_col or P['grayD'], font='NunitoBold', align='l')


def pagina_vieja(c):
    """La página olvidada: gris, imagen rota, «en construcción» y polvo."""
    w, h = 620, 470
    ventana(c, w, h, GRIS, 'minegocio.webcindario.com')
    rect(c, -270, -150, 250, 170, GRIS_L, shadow=False)
    stroke(c, [(-260, -140), (-30, 10)], 4, GRIS_D)
    stroke(c, [(-30, -140), (-260, 10)], 4, GRIS_D)
    txt(c, 'Bienvenidos', 140, -120, 34, GRIS_D, align='c')
    for k, ww in enumerate([230, 190, 210]):
        stroke(c, [(20, -70 + k * 30), (20 + ww, -70 + k * 30)], 9, GRIS_L)
    # cinta de «en construcción»
    shape(c, [(-300, 80), (300, 40), (300, 100), (-300, 140)], P['mustard'])
    for k in range(9):
        x = -280 + k * 66
        shape(c, [(x, 80 - k * 4.6 + 10), (x + 26, 78 - k * 4.6 + 8), (x + 6, 136 - k * 4.6 - 6), (x - 20, 138 - k * 4.6 - 4)], P['ink'], shadow=False, a=.85)
    txt(c, 'Última actualización: 2019', 0, 190, 22, GRIS_D, font='NunitoBold')


def pagina_flow(c):
    """La página conectada: portada, servicios y el bloque «Agenda tu cita»."""
    w, h = 620, 470
    ventana(c, w, h, P['teal'], 'tunegocio.com', P['teal'])
    rrect(c, -280, -150, 560, 150, 18, P['coralL'], shadow=False)
    txt(c, 'Estética Mariana', -250, -100, 40, P['ink'], align='l')
    txt(c, 'Cortes · color · uñas', -250, -56, 24, P['coralD'], font='NunitoBold', align='l')
    ell(c, 196, -76, 56, 56, P['coral'], shadow=False)
    ell(c, 196, -86, 22, 22, P['paper'], shadow=False)
    shape(c, [(160, -40), (176, -60), (216, -60), (232, -40)], P['paper'], shadow=False)
    for k, col in enumerate([P['mint'], P['sky'], P['yellowL']]):
        x = -280 + k * 190
        rrect(c, x, 22, 170, 92, 14, col, shadow=False)
        stroke(c, [(x + 18, 54), (x + 120, 54)], 8, P['white'])
        stroke(c, [(x + 18, 80), (x + 90, 80)], 8, P['white'])
    rrect(c, -150, 138, 300, 64, 32, P['coral'])
    txt(c, 'Agenda tu cita', 0, 171, 28, P['white'])


def formulario(c):
    """Formulario de contacto lleno, a punto de enviarse."""
    rrect(c, -220, -230, 440, 460, 24, P['white'])
    txt(c, 'Contáctanos', -180, -180, 36, P['teal'], align='l')
    for k, (lab, val) in enumerate([('Nombre', 'Lupita Ramírez'), ('Teléfono', '477 123 4567'), ('Correo', 'lupita@correo.com')]):
        y = -130 + k * 96
        txt(c, lab, -180, y, 20, P['grayD'], font='NunitoBold', align='l')
        rrect(c, -180, y + 14, 360, 52, 12, P['paper'], shadow=False)
        txt(c, val, -164, y + 41, 24, P['ink'], font='NunitoBold', align='l')
    rrect(c, -180, 160, 360, 60, 30, P['teal'])
    txt(c, 'Enviar', 0, 191, 28, P['white'])


def lista_clientes(c):
    """La lista de clientes en Flow; el último renglón es el que acaba de llegar."""
    rrect(c, -260, -230, 520, 460, 24, P['white'])
    rrect(c, -260, -230, 520, 74, 24, P['teal'], shadow=False)
    rect(c, -260, -190, 520, 34, P['teal'], shadow=False, amp=.6)
    txt(c, 'Clientes', -220, -192, 34, P['white'], align='l')
    filas = [('Ana López', P['pink2']), ('Carmen Ruiz', P['sky']), ('Sofía Díaz', P['yellowL'])]
    for k, (nom, col) in enumerate(filas):
        y = -120 + k * 76
        ell(c, -200, y + 26, 22, 22, col, shadow=False)
        txt(c, nom, -164, y + 28, 26, P['ink'], font='NunitoBold', align='l')
        stroke(c, [(-230, y + 62), (230, y + 62)], 2, P['gray'])
    y = -120 + 3 * 76
    rrect(c, -244, y - 6, 488, 70, 16, P['mintL'], shadow=False)
    ell(c, -200, y + 28, 22, 22, P['coral'], shadow=False)
    txt(c, 'Lupita Ramírez', -164, y + 30, 26, P['ink'], align='l')
    rrect(c, 120, y + 10, 100, 38, 19, P['mint'], shadow=False)
    txt(c, 'Nuevo', 170, y + 30, 20, hx('1F4F45'))
    txt(c, 'Llegó de: tu página · Contáctanos', 0, 200, 20, P['grayD'], font='NunitoBold')


def agenda_dia(c):
    """Agenda del día con la línea roja de la hora y la cita que acaba de caer."""
    rrect(c, -260, -260, 520, 520, 24, P['white'])
    txt(c, 'Martes 14', -220, -208, 34, P['teal'], align='l')
    for k, hr in enumerate(['10:00', '11:00', '12:00', '13:00', '14:00']):
        y = -150 + k * 80
        txt(c, hr, -220, y, 20, P['grayD'], font='NunitoBold', align='l')
        stroke(c, [(-140, y), (230, y)], 2, P['gray'])
    rrect(c, -126, -140, 340, 64, 12, P['sky'], shadow=False)
    txt(c, 'Corte · Ana', -106, -106, 22, P['ink'], font='NunitoBold', align='l')
    rrect(c, -126, 100, 340, 64, 12, P['yellowL'], shadow=False)
    txt(c, 'Uñas · Sofía', -106, 134, 22, P['ink'], font='NunitoBold', align='l')
    stroke(c, [(-150, 34), (236, 34)], 4, P['red'])
    ell(c, -150, 34, 8, 8, P['red'], shadow=False)
    # la cita nueva (pieza aparte en la escena, aquí solo su hueco)
    rrect(c, -126, -60, 340, 64, 12, P['paper'], shadow=False)


def cita_nueva(c):
    rrect(c, -170, -34, 340, 68, 12, P['coral'])
    txt(c, 'Color · Lupita', -150, 2, 26, P['white'], align='l')


def correo_confirmar(c):
    rrect(c, -200, -130, 400, 260, 20, P['white'])
    shape(c, [(-200, -110), (0, 10), (200, -110), (200, -130), (-200, -130)], P['tealL'], shadow=False)
    txt(c, 'Confirma tu cita', 0, 52, 28, P['ink'])
    rrect(c, -110, 80, 220, 40, 20, P['teal'], shadow=False)
    txt(c, 'Confirmar', 0, 101, 22, P['white'])


SITES = [('Página vieja', pagina_vieja, 'Gris y polvosa · la cinta se mece'),
         ('Página Flow', pagina_flow, 'Pop grande · el botón late'),
         ('Formulario', formulario, 'Campos se llenan uno por uno'),
         ('Lista de clientes', lista_clientes, 'El renglón nuevo entra deslizando'),
         ('Agenda del día', agenda_dia, 'La línea roja avanza'),
         ('Cita nueva', cita_nueva, 'Cae en su hueco de la agenda'),
         ('Correo de confirmación', correo_confirmar, 'Vuela y se abre')]
