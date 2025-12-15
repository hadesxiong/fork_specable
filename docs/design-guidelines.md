# Specable Design Guidelines

This document outlines the design system and visual guidelines for Specable. All new features and components should follow these conventions to maintain consistency.

## Colour Palette

### Primary Colour (Purple)

Purple is the brand colour used for interactive elements, highlights, and accents.

| Token | Hex | Usage |
|-------|-----|-------|
| `purple-400` | `#c084fc` | Primary text, active indicators, hover states |
| `purple-500` | `#a855f7` | Selection backgrounds, focus rings |
| `purple-600` | `#9333ea` | Active/pressed button backgrounds |
| `purple-500/20` | `rgba(168, 85, 247, 0.2)` | Subtle backgrounds, badges, selected items |
| `purple-500/30` | `rgba(168, 85, 247, 0.3)` | Hover backgrounds on selected items |

CSS custom properties are defined in `src/index.css`:
```css
--color-primary-400: #c084fc;
--color-primary-500: #a855f7;
--color-primary-600: #9333ea;
```

### Background Colours (Zinc)

The application uses a dark theme with zinc tones for backgrounds.

| Token | Hex | Usage |
|-------|-----|-------|
| `zinc-950` | `#09090b` | Main application background, editor background |
| `zinc-900` | `#18181b` | Panel backgrounds, modals, header, status bar |
| `zinc-900/50` | `rgba(24, 24, 27, 0.5)` | Semi-transparent overlays, tab bars |
| `zinc-800` | `#27272a` | Borders, dividers, input backgrounds |
| `zinc-800/50` | `rgba(39, 39, 42, 0.5)` | Subtle hover backgrounds |
| `zinc-700` | `#3f3f46` | Hover states for secondary elements |

### Text Colours

| Token | Hex | Usage |
|-------|-----|-------|
| `zinc-100` | `#f4f4f5` | Primary headings, important text |
| `zinc-200` | `#e4e4e7` | Primary body text |
| `zinc-300` | `#d4d4d8` | Secondary text |
| `zinc-400` | `#a1a1aa` | Muted text, labels |
| `zinc-500` | `#71717a` | Placeholder text, disabled states |
| `zinc-600` | `#52525b` | Very muted text, subtle labels |

### Semantic Colours

| Colour | Hex | Usage |
|--------|-----|-------|
| `emerald-400` | `#34d399` | Success states, valid indicators |
| `red-400` | `#f87171` | Error states, required indicators |
| `amber-400` | `#fbbf24` | Warning states |
| `amber-500` | `#f59e0b` | Unsaved changes indicator |

### Syntax Highlighting Colours

Used in the CodeMirror editor (defined in `src/components/Editor/theme.ts`):

| Colour | Hex | Usage |
|--------|-----|-------|
| `purple-400` | `#c084fc` | Keywords, booleans, null, tags |
| `green-300` | `#86efac` | Strings |
| `amber-300` | `#fcd34d` | Numbers, functions |
| `blue-300` | `#93c5fd` | Properties, attributes |
| `cyan-300` | `#67e8f9` | Variables, types |

## Typography

### Font Families

```css
--font-sans: "Geist Variable", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "Geist Mono Variable", "SF Mono", Menlo, Monaco, "Courier New", monospace;
```

- **Geist Variable**: Used for all UI text (labels, buttons, body text)
- **Geist Mono Variable**: Used for code, keyboard shortcuts, file names

### Font Sizes

| Class | Size | Usage |
|-------|------|-------|
| `text-xl` | 1.25rem | Application title |
| `text-lg` | 1.125rem | Modal headings, large labels |
| `text-sm` | 0.875rem | Body text, button labels |
| `text-xs` | 0.75rem | Small labels, badges, status text |
| `text-[10px]` | 10px | Very small badges (e.g., BETA tag) |

### Font Weights

| Weight | Usage |
|--------|-------|
| `font-bold` | Application title, emphasis |
| `font-medium` | Section headings, button labels, badges |
| Regular (400) | Body text, descriptions |

### Letter Spacing

- `tracking-tight`: Application title
- `tracking-wide`: Category labels, uppercase text

## Component Patterns

### Buttons

#### Primary Action Button
```tsx
<button className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors">
  Action
</button>
```

#### Toggle Button (Active)
```tsx
<button className="p-2 rounded-md bg-purple-500/20 text-purple-400">
  <Icon className="w-4 h-4" />
</button>
```

#### Toggle Button (Inactive)
```tsx
<button className="p-2 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50">
  <Icon className="w-4 h-4" />
</button>
```

#### Filter/Segmented Control
```tsx
<button className={`px-2 py-1 text-xs rounded-md transition-colors ${
  isActive
    ? 'bg-purple-600 text-white'
    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
}`}>
  Filter
</button>
```

### Badges

#### Status Badge
```tsx
<span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-400 rounded">
  BETA
</span>
```

#### Version Badge
```tsx
<span className="px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400 rounded">
  v0.1.0
</span>
```

### Modals

Modals follow a consistent structure:

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  {/* Backdrop */}
  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

  {/* Modal content */}
  <div className="relative w-[640px] max-w-[90vw] max-h-[85vh] bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 overflow-hidden">
    {/* Header */}
    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
      <h2 className="text-lg font-medium text-zinc-100">Title</h2>
      <button className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
        <X className="w-4 h-4" />
      </button>
    </div>

    {/* Content */}
    <div className="overflow-y-auto p-6 max-h-[calc(85vh-65px)]">
      {/* ... */}
    </div>
  </div>
</div>
```

### Keyboard Shortcuts

```tsx
<kbd className="px-2 py-1 text-xs rounded-md font-mono bg-zinc-800 text-zinc-500">
  Ctrl+K
</kbd>
```

Selected/highlighted variant:
```tsx
<kbd className="px-2 py-1 text-xs rounded-md font-mono bg-purple-500/30 text-purple-300">
  Ctrl+K
</kbd>
```

### Panels

#### Panel Header
```tsx
<div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
  <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
    Panel Title
  </span>
</div>
```

#### Tab Bar
```tsx
<div className="flex border-b border-zinc-800 bg-zinc-900/50">
  <button className={`px-3 py-2 text-xs font-medium transition-colors ${
    isActive
      ? 'text-purple-400 border-b-2 border-purple-400 -mb-px'
      : 'text-zinc-500 hover:text-zinc-300'
  }`}>
    Tab
  </button>
</div>
```

### Status Indicators

#### Validation States
```tsx
// Valid
<span className="flex items-center gap-1.5 text-emerald-400">
  <CheckCircle className="w-3 h-3" />
  Valid
</span>

// Error
<span className="flex items-center gap-1.5 text-red-400">
  <AlertCircle className="w-3 h-3" />
  {errorCount}
</span>

// Warning
<span className="flex items-center gap-1.5 text-amber-400">
  <AlertTriangle className="w-3 h-3" />
  {warningCount}
</span>

// Loading
<span className="flex items-center gap-1.5 text-purple-400">
  <Loader2 className="w-3 h-3 animate-spin" />
  Validating...
</span>
```

### Form Inputs

```tsx
<input
  className="w-full px-4 py-3.5 bg-transparent text-zinc-200 text-sm outline-none border-b border-zinc-800 placeholder-zinc-600"
  placeholder="Type here..."
/>
```

### List Items (Command Palette Style)

```tsx
<div className={`mx-1 px-3 py-2.5 flex items-center justify-between cursor-pointer rounded-lg transition-colors ${
  isSelected
    ? 'bg-purple-500/20 text-zinc-100'
    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
}`}>
  {/* Content */}
</div>
```

## Layout Guidelines

### Spacing Scale

Use Tailwind's default spacing scale:
- `gap-1`, `gap-1.5`: Tight spacing (icons with text)
- `gap-2`, `gap-3`: Standard spacing
- `gap-4`, `gap-6`: Section spacing
- `gap-8`: Large section spacing

### Panel Widths

- Outline panel default: 220px
- Preview panel default: 350px
- Minimum panel width: 150px

### Border Radius

| Class | Usage |
|-------|-------|
| `rounded` | Small elements, badges |
| `rounded-md` | Buttons, inputs |
| `rounded-lg` | Cards, list items |
| `rounded-xl` | Modals, popovers |

### Borders

- Standard border: `border border-zinc-800`
- Subtle border: `border border-zinc-700/50`
- Panel dividers: `w-px bg-zinc-800` (vertical), `h-px bg-zinc-800` (horizontal)
- Resizable dividers: `hover:bg-purple-500 cursor-col-resize`

## Icons

The application uses [Lucide React](https://lucide.dev/) for icons.

### Standard Sizes
- `w-3 h-3`: Small inline icons (status bar)
- `w-4 h-4`: Standard UI icons (buttons, navigation)
- `w-5 h-5`: Larger interactive icons

### Icon Colours
Icons should inherit text colour via `currentColor`. Set colour on the parent element:
```tsx
<button className="text-zinc-500 hover:text-zinc-300">
  <Icon className="w-4 h-4" />
</button>
```

## Accessibility

### ARIA Attributes

Always include appropriate ARIA attributes:
```tsx
<button
  aria-label="Toggle Outline"
  aria-pressed={showOutline}
>
  <PanelLeft className="w-4 h-4" aria-hidden="true" />
</button>

<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">Modal Title</h2>
</div>
```

### Focus States

Focus states use the primary colour:
```css
:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}
```

### Keyboard Navigation

All interactive elements must be keyboard accessible. Use `tabIndex` and keyboard event handlers appropriately.

## Transitions

Standard transition for interactive elements:
```tsx
className="transition-colors" // For colour changes
className="transition-all"    // For multiple property changes
```

Default duration is 150ms (set globally in `src/index.css`).

## Scrollbars

Custom scrollbar styling is applied globally:
- Track: transparent
- Thumb: `zinc-800`, hover `zinc-700`
- Width/height: 8px
- Border radius: 4px

## Dark Theme Only

Specable is designed exclusively for dark mode. There is no light theme variant. All colour choices should be made with dark backgrounds in mind.

## File Naming

- Component files: `PascalCase.tsx`
- Utility/service files: `kebab-case.ts`
- Style files: `kebab-case.css`
