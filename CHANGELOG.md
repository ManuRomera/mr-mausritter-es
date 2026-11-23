# Historial de cambios

## 0.3.2

- Ficha resumida más pequeña: la cabecera de la hoja se reduce entera manteniendo su estilo (también con pieles de otros módulos), se oculta el transfondo, la ventana pasa a 460 px de ancho y la lista de huecos va en una columna con letra menor. Al volver a la ficha completa recupera su tamaño.
- *EN:* Smaller quick sheet: the sheet header is scaled down as a whole keeping its style (also with other modules' skins), background is hidden, the window becomes 460 px wide and the slot list is a single smaller column. The full sheet restores its size.

## 0.3.1

- Ficha resumida: la cuadrícula de inventario se sustituye por una lista de huecos (patas, cuerpo y mochila 1-6) con el objeto que hay en cada uno, su daño y sus usos. Pulsar el nombre lo tira como en la cuadrícula; el lápiz abre su ficha. Agallas y Banco ya no aparecen; lo que no está en ningún hueco sale en «Sin colocar».
- *EN:* Quick sheet: the inventory grid becomes a list of slots (paws, body, pack 1-6) showing each item with damage and uses; click a name to roll it, the pencil opens its sheet. Grit and Bank are hidden; items in no slot are listed as "Not placed".

## 0.3.0

- **Ficha resumida** ya no abre otra ventana: transforma la propia hoja del personaje. Oculta signo, pelaje, apariencia, retrato, nivel, descripción y Notas, junta FUE/DES/VOL, PG, Pepitas y Agallas en una franja y deja el inventario a la vista. Conserva el estilo en modo claro, oscuro y alto contraste, y todo sigue siendo editable y tirable. El icono de la cabecera alterna entre resumida y completa y cada personaje la recuerda en tu navegador.
- *EN:* **Quick sheet** no longer opens a separate window: it compacts the character sheet itself (hides sign, coat, look, portrait, level, description and Notes; stats, HP, pips and grit in one strip; inventory stays). Same style in light, dark and high-contrast modes, still fully editable and rollable. The header icon toggles it and each character remembers it per browser.

## 0.2.4

- Corregido: al abrir la pestaña Notas de la ficha aparecía un gran hueco en blanco arriba (el ancla de ayuda del módulo se estiraba).
- *EN:* Fixed a large blank gap at the top of the character sheet when opening the Notes tab.

## 0.2.3

- Declara la compatibilidad verificada con Foundry 13 y Mausritter 0.6.1: la versión ya no aparece en rojo («compatibilidad desconocida») en la lista de módulos.
- *EN:* Declares verified compatibility with Foundry 13 and Mausritter 0.6.1, so the version badge is no longer red ("unknown compatibility").

## 0.2.2

- La cabecera de las fichas muestra siempre solo iconos (también los de Foundry y otros módulos); el nombre aparece al pasar el ratón. El botón de cerrar vuelve a verse siempre. Se retira el ajuste «Cabecera solo con iconos».
- *EN:* Sheet headers now always show icons only (including Foundry's and other modules' buttons), with the name on hover, so Close is always visible. The "Icon-only header" setting is removed.

## 0.2.1

- Modo oscuro completo: se genera desde el CSS del propio sistema (`tools/oscuro.py`) y cubre fichas, hojas de objeto, diálogos, pestañas, casillas y tarjetas del chat. Los iconos oficiales de Mausritter se invierten para verse sobre fondo oscuro.
- Iconos: las acciones del módulo pasan a la cabecera de la ventana (Ficha resumida, Inventario, Catálogo y Accesibilidad justo antes de Cerrar), con ayuda emergente; botones y diálogos llevan icono.
- Corregido: el botón de cerrar de los diálogos podía perder su icono por el CSS del módulo.
- *EN:* Full dark mode generated from the system stylesheet (sheets, dialogs, tabs, checkboxes, chat cards; official icons inverted). Module actions moved to icon buttons in the window header, Accessibility next to Close. Fixed dialog close icons broken by module CSS.

## 0.2.0

- Integra Mausritter Damage Helper en los ajustes y el chat del módulo.
- Aplica armadura, PG y FUE desde las tiradas, con Agallas como variante.
- Añade salvaciones vinculadas a cada golpe y gasto de usos opcional.
- Evita duplicados al actualizar tokens vinculados y al convivir con el módulo independiente.
- Estrena la presentación de GitHub y la instalación mediante manifiesto.

## 0.1.0

- Amplía la interfaz en español e incorpora traducciones de compendios mediante Babele.
- Añade accesibilidad, ficha resumida e inventario en lista.
- Incluye 80 objetos y condiciones de Reservoir Mice y Requesón en Waterdeep.
