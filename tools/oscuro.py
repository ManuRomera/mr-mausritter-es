#!/usr/bin/env python3
"""Genera styles/oscuro.css: el modo oscuro completo de Mausritter a partir de la hoja de estilos del propio sistema.
Cada regla con colores se repite bajo `:root.mrm-dark` con los colores cambiados por su papel
(fondos claros → superficies oscuras, paneles negros → pardo oscuro, texto → claro, bordes → ocre).
Mismo método que mr-mothership-es/tools/oscuro.py. Rehacer si el sistema cambia su CSS.
Uso: python3 tools/oscuro.py [ruta a systems/mausritter/styles/mausritter.css]"""
import re, sys, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/Volumes/Datos_Dock/FoundryVTT/Data/systems/mausritter/styles/mausritter.css')
PRE = ':root.mrm-dark'
# paleta cálida, la misma de los tokens --mrm-* de mesa.css
FONDO, PANEL, SUPERFICIE, REALCE = '#201e1a', '#2c2821', '#36312a', '#433c32'
TINTA, TENUE, LINEA, LINEA_SUAVE = '#fff2d9', '#cbbfa6', '#a79270', '#5a5040'
NOMBRES = {'white': '#ffffff', 'black': '#000000', 'grey': '#808080', 'gray': '#808080', 'lightgrey': '#d3d3d3',
           'lightgray': '#d3d3d3', 'red': '#ff0000', 'darkred': '#8b0000', 'silver': '#c0c0c0'}
COLOR = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(?:' + '|'.join(NOMBRES) + r')\b', re.I)


def rgb(c):
    c = c.lower()
    c = NOMBRES.get(c, c)
    if c.startswith('#'):
        h = c[1:]
        if len(h) in (3, 4): h = ''.join(x * 2 for x in h[:3])
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)), (int(h[6:8], 16) / 255 if len(h) == 8 else 1.0)
    n = [float(x) for x in re.findall(r'[\d.]+', c)]
    return tuple(int(x) for x in n[:3]), (n[3] if len(n) > 3 else 1.0)


def nuevo(c, papel):
    t, a = rgb(c)
    if a == 0: return c
    L, croma = (0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]) / 255, max(t) - min(t)
    if croma > 60:  # rojos con intención: se aclaran si son oscuros para leerse sobre fondo oscuro
        return '#ff8a7a' if L < 0.45 else c
    if papel == 'fondo':
        v = FONDO if L >= 0.85 else PANEL if L >= 0.55 else SUPERFICIE if L >= 0.25 else REALCE
    elif papel == 'texto':
        v = TENUE if 0.3 <= L < 0.7 else TINTA
    else:
        v = LINEA_SUAVE if L >= 0.7 else LINEA
    if a < 1:
        r, g, b = (int(v[i:i + 2], 16) for i in (1, 3, 5))
        return f'rgba({r}, {g}, {b}, {a})'
    return v


def papel(prop):
    if prop.startswith('background'): return 'fondo'
    if prop in ('color', 'caret-color', '-webkit-text-fill-color'): return 'texto'
    if prop.startswith(('border', 'outline')) or prop in ('fill', 'stroke'): return 'borde'
    return None


def reglas(css):
    """(at-regla, selectores, declaraciones); entra en @container/@media y salta @keyframes/@font-face."""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    i = 0
    while i < len(css):
        j = css.find('{', i)
        if j < 0: return
        cab = css[i:j].strip()
        prof, k = 1, j + 1
        while prof and k < len(css):
            prof += {'{': 1, '}': -1}.get(css[k], 0)
            k += 1
        cuerpo = css[j + 1:k - 1]
        if cab.startswith('@'):
            if cab.startswith(('@container', '@media')):
                for _, s, d in reglas(cuerpo): yield cab, s, d
        else:
            yield None, cab, cuerpo
        i = k


salida = []
for at, sel, cuerpo in reglas(re.sub(r'^@import[^;]*;', '', SRC.read_text(), flags=re.M)):
    decl = []
    for d in cuerpo.split(';'):
        if ':' not in d: continue
        prop, val = (x.strip() for x in d.split(':', 1))
        p = papel(prop.lower())
        if not p or 'url(' in val or not COLOR.search(val): continue
        decl.append(f'{prop}: {COLOR.sub(lambda m: nuevo(m.group(0), p), val.replace("!important", "").strip())} !important')
    if not decl: continue
    sels = ', '.join(f'{PRE} {s.strip()}' for s in sel.split(',') if s.strip() and not s.strip().startswith(':root'))
    if not sels: continue
    bloque = f'{sels} {{ {"; ".join(decl)}; }}'
    salida.append(f'{at} {{ {bloque} }}' if at else bloque)

M = ':is(.mausritter, .mrm-native)'
BASE = f"""
/* base de ventanas: el sistema fuerza theme-light en sus hojas */
{PRE} .mausritter.sheet .window-content, {PRE} .mausritter.sheet form, {PRE} .mrm-native .window-content {{ background: {FONDO} !important; color: {TINTA} !important; }}
{PRE} .mausritter.sheet .window-header, {PRE} .mrm-native .window-header {{ background: #141210 !important; color: {TINTA} !important; border-bottom: 1px solid {LINEA_SUAVE} !important; }}
{PRE} {M} :is(input, textarea, select):not([type=radio], [type=checkbox]) {{ background-color: {PANEL} !important; color: {TINTA} !important; border-color: {LINEA_SUAVE} !important; }}
{PRE} {M} :is(input, textarea)::placeholder {{ color: #8f846f !important; }}
{PRE} {M} select {{ color-scheme: dark; }}
{PRE} {M} :is(button, .dialog-button):not(.header-control) {{ background: {SUPERFICIE} !important; color: {TINTA} !important; border-color: {LINEA_SUAVE} !important; }}
{PRE} {M} :is(button, .dialog-button):not(.header-control):hover {{ background: {REALCE} !important; }}
{PRE} {M} .tabs .item {{ color: {TENUE} !important; }}
{PRE} {M} .tabs .item.active {{ color: {TINTA} !important; }}
/* estilos en línea de las plantillas del sistema */
{PRE} {M} [style*="color: rgb(22,22,22)"], {PRE} {M} [style*="color: rgb(22, 22, 22)"] {{ color: {TINTA} !important; }}
{PRE} {M} [style*="color: grey"] {{ color: {TENUE} !important; }}
{PRE} {M} [style*="solid rgb(22, 22, 22)"] {{ border-color: {LINEA} !important; }}
/* cartas de objeto: el color propio del objeto queda como tinte bajo un velo oscuro */
{PRE} .mausritter .item-card {{ box-shadow: inset 0 0 0 999px rgba(32, 30, 26, .86) !important; border-color: {LINEA} !important; }}
{PRE} .mausritter .item-card :is(.item-card-title, .item-card-tag, .item-card-desc, .item-card-clear, .item-card-clear-text, .item-card-damage) {{ color: {TINTA} !important; }}
/* iconos oficiales (dibujo negro sobre carta blanca): se invierten; el arte en color conserva sus colores */
{PRE} {M} img[src*="systems/mausritter/images/icons/"], {PRE} .chat-message img[src*="systems/mausritter/images/icons/"] {{ filter: invert(.92) sepia(.25) hue-rotate(-10deg); }}
/* casillas y puntos de elección dibujados a mano: el nativo oscuro apenas distingue activado de desactivado */
{PRE} {M} :is(input[type=radio], input[type=checkbox]) {{ -webkit-appearance: none; appearance: none; width: 18px; height: 18px; min-width: 18px; margin: 0 .2em; flex: none; background: {PANEL} !important; border: 2px solid {LINEA} !important; box-shadow: none; cursor: pointer; }}
{PRE} {M} input[type=radio] {{ border-radius: 50% !important; }}
{PRE} {M} input[type=checkbox] {{ border-radius: 4px !important; }}
{PRE} {M} input[type=radio]:checked {{ background: radial-gradient(circle, {TINTA} 0 42%, {PANEL} 46%) !important; border-color: {TINTA} !important; }}
{PRE} {M} input[type=checkbox]:checked {{ background: {TINTA} !important; border-color: {TINTA} !important; box-shadow: inset 0 0 0 3px {PANEL} !important; }}
/* chat */
{PRE} .chat-message {{ background: #1a1815 !important; border-color: {LINEA_SUAVE} !important; color: {TINTA} !important; }}
{PRE} .chat-message :is(.message-header, .message-sender, .message-metadata, .message-metadata a, .message-content, .flavor-text, h1, h2, h3, h4, h5, p, li, strong, em) {{ color: {TINTA} !important; }}
{PRE} .chat-message :is(.dice-roll, .dice-result, .dice-formula, .dice-total, .dice-tooltip, .part-header, .table-draw .table-results li) {{ background: {PANEL} !important; color: {TINTA} !important; border-color: {LINEA_SUAVE} !important; }}
{PRE} .chat-message :is(a.inline-roll, a.content-link) {{ background: {SUPERFICIE} !important; color: {TINTA} !important; border-color: {LINEA_SUAVE} !important; }}
"""
(R / 'styles/oscuro.css').write_text('/* Generado por tools/oscuro.py a partir de systems/mausritter/styles/mausritter.css: no editar a mano */\n'
                                     + '\n'.join(salida) + BASE)
print(len(salida), 'reglas')
