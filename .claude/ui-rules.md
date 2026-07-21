# Zammad UI Theme Rules

## Target

Legacy UI at /#dashboard - pure SCSS/CSS overrides only, no libraries, no JS changes.

## Colour Palette

Primary: #1e293b (dark navy)
Secondary: #334155 (slate)
Accent: #3b82f6 (blue)
Accent hover: #2563eb
Background: #f8fafc (light grey-white)
Sidebar bg: #1e293b
Sidebar text: #94a3b8
Sidebar active: #3b82f6
Text primary: #0f172a
Text secondary: #64748b
Border: #e2e8f0
Success: #10b981
Warning: #f59e0b
Danger: #ef4444
White: #ffffff

## Typography

Font: system-ui, -apple-system, sans-serif (no imports)
Base: 14px / 1.5
Weights: 400 regular, 500 medium, 600 semibold

## Spacing & Shape

Border radius: 8px cards, 6px buttons, 4px inputs
Shadows: 0 1px 3px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.08)
Transitions: all 150ms ease

## Key UI Priorities

1. "+ New Ticket" button must be VERY visible - large, blue, top of sidebar
2. Sidebar: dark navy, collapsible, clear icons and labels
3. Dashboard cards: white, rounded, subtle shadow
4. Top navbar: white, clean, minimal
5. Ticket list: clear rows, hover states, priority colour coding

## File to edit

app/assets/stylesheets/zammad/theme/custom-theme.scss (create if not exists)
Import at end of: app/assets/stylesheets/application.scss or main entry file

## Rules

- Override only, never delete original files
- No !important unless absolutely necessary
- Test by hard refresh Ctrl+Shift+R
