# Fase 1 — Sistema de Diseño Food Store

**Fecha:** 2026-06-27
**Autor:** Brainstorming
**Estado:** Aprobado

---

## Resumen

Establecer la base visual de Food Store: paleta de colores neón, tipografía bold, sombras con glow, y un set de componentes primitivos reutilizables (Button, Input, Card, Badge, Modal, Select, Toggle). Todo construido sobre Tailwind CSS v3, sin librerías externas de UI.

---

## 1. Paleta de Colores

Extensión del `tailwind.config.js` existente. Los `brand-*` actuales se reemplazan por la nueva escala naranja neón. Se agregan `neon-*` como acentos secundarios y `surface-*` para fondos oscuros consistentes.

```js
colors: {
  brand: {
    50:  "#FFF0E6",
    100: "#FFD4B3",
    200: "#FFB380",
    300: "#FF8C4A",
    400: "#FF6B00",  // naranja eléctrico (primary)
    500: "#E85D00",
    600: "#CC5200",
    700: "#A84300",
    800: "#803200",
    900: "#592400",
  },
  neon: {
    fuchsia: "#FF00FF",
    violet:  "#8B5CF6",
    cyan:    "#06B6D4",
  },
  surface: {
    dark:   "#0A0A0B",   // fondo base dark mode
    card:   "#18181B",   // tarjetas dark
    border: "#27272A",   // bordes dark
    light:  "#FAFAFA",   // fondo base light
    cardL:  "#FFFFFF",
  },
}
```

### Dark mode

- Fondo global dark: `surface.dark` (#0A0A0B) — más negro que gray-950
- Tarjetas dark: `surface.card` (#18181B) — contraste sutil con el fondo
- Bordes dark: `surface.border` (#27272A)
- El gradiente actual `from-gray-950 via-gray-900 to-gray-950` se simplifica a `bg-surface-dark` (mejor performance)

---

## 2. Tipografía

- **Body:** Inter (400, 500, 600) — se mantiene
- **Headings:** Clash Display (600, 700) — reemplaza Playfair Display
- **Tracking:** headings grandes → `tracking-tight`; botones/chips → `tracking-wide`
- Actualizar `fontFamily.display` en `tailwind.config.js` con Clash Display
- Importar Clash Display desde Google Fonts en `index.html`

---

## 3. Sombras (Glow Neón)

```js
boxShadow: {
  'neon-sm':  '0 0 8px rgba(255, 107, 0, 0.3)',
  'neon-md':  '0 0 16px rgba(255, 107, 0, 0.4)',
  'neon-lg':  '0 0 32px rgba(255, 107, 0, 0.5)',
  'neon-fuchsia': '0 0 16px rgba(255, 0, 255, 0.4)',
}
```

Aplicaciones:
- `neon-sm`: hover de botones primarios, focus de inputs
- `neon-md`: hover de cards interactivas
- `neon-lg`: modales activos, badges "online"
- `neon-fuchsia`: badges de promoción, estado "EN_PREP"

Se agrega `borderRadius.4xl: "2rem"` para modales grandes.

---

## 4. Componentes Primitivos

Carpeta nueva: `frontend/src/components/ui/`. Cada componente usa `cn()` (clsx + tailwind-merge) para componer clases condicionalmente.

### 4.1 Button

```tsx
<Button variant="solid|outline|ghost|danger" size="sm|md|lg" loading disabled icon={ReactNode}>
```

- `solid`: bg-brand-400 + hover glow neon-sm + texto white
- `outline`: border-brand-400 + text-brand-400 + hover bg-brand-50 dark:bg-transparent
- `ghost`: text-brand-400 + hover bg-brand-50/50
- `danger`: bg-red-600 + hover bg-red-700
- Estados: `loading` muestra spinner, `disabled` opacidad 50 + cursor not-allowed
- `active:scale-95` en todas las variantes
- `size` varía padding y font-size
- `icon`: ReactNode opcional para mostrar un SVG a la izquierda del texto (si no hay children, se renderiza solo el icono)

### 4.2 Input

```tsx
<Input label="Email" error="Mensaje de error" helperText="Ayuda" prefixIcon={<Icon />} />
```

- Label: text-sm font-medium text-brand-900 dark:text-brand-300
- Input: border + rounded-lg + focus ring brand-400 + dark bg surface-card
- Error: border-red-500 + text-red-600 abajo
- Helper: text-xs text-slate-500

### 4.3 Card

```tsx
<Card variant="default|interactive|neon" padding="sm|md|lg">
```

- `default`: bg-white dark:bg-surface-card + border border-gray-200 dark:border-surface-border + rounded-xl + shadow-sm
- `interactive`: lo mismo + hover:-translate-y-0.5 + hover:shadow-neon-sm + hover:border-brand-400
- `neon`: border-brand-400 + shadow-neon-sm

### 4.4 Badge

```tsx
<Badge variant="solid|outline|dot" color="brand|fuchsia|violet|green|red|amber">
```

- `solid`: bg del color + text white
- `outline`: border del color + text del color + bg transparent
- `dot`: un pequeño círculo del color + texto al lado
- Colores mapean a: brand → brand-500, fuchsia → neon.fuchsia, violet → neon.violet, green → green-600, red → red-600, amber → amber-500

### 4.5 Modal

```tsx
<Modal isOpen title="Título" onClose size="sm|md|lg">
```

- Overlay: fixed inset-0 + bg-black/50 + backdrop-blur-sm
- Content: rounded-2xl + bg-white dark:bg-surface-card + shadow-2xl + animación scale-in
- Header: border-b + title con text-lg font-display + botón X variant ghost size sm
- Body: overflow-y-auto + padding
- Size controla max-width: sm=sm, md=lg, lg=2xl
- **Migración:** reemplaza al `Modal` existente en `components/Modal.tsx`. La nueva interfaz cambia — los usos actuales deben pasar `size` explícitamente. No hay `children` wrapper extra.

### 4.6 Select

```tsx
<Select label="Estado" options={[{value, label}]} error placeholder />
```

- Mismo estilo visual que Input
- Native select element (por simplicidad y accesibilidad) estilizado con Tailwind

### 4.7 Toggle (Switch)

```tsx
<Toggle label="Modo oscuro" checked onChange />
```

- Track: w-10 h-6 rounded-full + bg-gray-300 dark:bg-surface-border + transition
- Thumb: w-5 h-5 rounded-full + bg-white + shadow + translate-x cuando checked
- Checked: track bg-brand-400 + thumb translate-x-4

---

## 5. Archivos a modificar/crear

### Modificar:
- `frontend/tailwind.config.js` — colores, sombras, borderRadius, fontFamily
- `frontend/index.html` — importar Clash Display
- `frontend/src/styles.css` — agregar @font-face o @import de Clash Display; actualizar body bg

### Crear:
- `frontend/src/lib/utils.ts` — función `cn()` con clsx + tailwind-merge
- `frontend/src/components/ui/Button.tsx`
- `frontend/src/components/ui/Input.tsx`
- `frontend/src/components/ui/Card.tsx`
- `frontend/src/components/ui/Badge.tsx`
- `frontend/src/components/ui/Modal.tsx` (reemplaza el Modal existente)
- `frontend/src/components/ui/Select.tsx`
- `frontend/src/components/ui/Toggle.tsx`

### Dependencias a agregar:
- `clsx`
- `tailwind-merge`

---

## 6. No incluido en Fase 1

- Migración de páginas a los nuevos componentes (Fase 2+)
- Reemplazo de emojis por SVGs (se hará por página en cada fase)
- Animaciones de entrada/página (posterior)
- Icon system (se decide más adelante)

---

## 7. Criterios de éxito

- Los componentes primitivos existen y se renderizan correctamente en todas las variantes
- El dark mode funciona con los nuevos colores surface
- Los tokens de Tailwind están disponibles globalmente
- No hay regresiones visuales en el modo claro
- `cn()` funciona correctamente componiendo clases
