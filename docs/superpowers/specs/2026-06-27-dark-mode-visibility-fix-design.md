# Dark Mode Visibility Fix

## Objective

Fix visibility of icons and text in dark mode across 7 frontend files by adding missing `dark:` variants. No structural changes.

## Files to modify

### `pages/LoginPage.tsx`
- Line 50: `text-orange-500` → `text-orange-500 dark:text-orange-300`

### `components/SidebarCart.tsx`
- Line 32: `text-slate-500` → `text-slate-500 dark:text-gray-300`
- Line 46: `text-slate-500` → `text-slate-500 dark:text-gray-300`
- Line 61: `text-slate-500` → `text-slate-500 dark:text-gray-300`
- Line 91: `text-slate-400` → `text-slate-400 dark:text-gray-400`

### `pages/CarritoPage.tsx`
- Line 130: `text-slate-500` → `text-slate-500 dark:text-gray-300`
- Line 173: `text-red-500` → `text-red-500 dark:text-red-400`

### `components/ui/Input.tsx`
- Line 31: `text-slate-400` → `text-slate-400 dark:text-gray-400`
- Line 48: `text-red-600` → `text-red-600 dark:text-red-400`
- Line 49: `text-slate-500` → `text-slate-500 dark:text-gray-400`

### `components/ui/Select.tsx`
- Line 52: `text-red-600` → `text-red-600 dark:text-red-400`

### `pages/ProductosClientePage.tsx`
- Line 233: `text-brand-500` → `text-brand-500 dark:text-brand-300`

## Total
12 changes, 7 files. Zero structural changes.
