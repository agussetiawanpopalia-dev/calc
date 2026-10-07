# Design Guidelines: Money Calculator

_Generated: October 7, 2026_

## Design Style

**iOS Glassmorphism (Liquid Glass)** - A refined iOS-first aesthetic combining translucent glass materials, soft shadows, system-native typography, and subtle lighting effects. The design prioritizes clarity, depth, and a calm, trustworthy financial experience.

### Core Philosophy
- **Calm & trustworthy**: Financial apps need to feel secure and non-anxious
- **iOS-native**: Following Apple's Human Interface Guidelines with SF Pro typography and system behaviors
- **Depth without noise**: Glass materials used strategically for floating surfaces only
- **Mobile-first**: Optimized for touch with 44pt+ targets and safe area awareness

## Color Palette

### Light Mode (System)
- **Canvas (Background)**: `#f2f2f7` (systemGroupedBackground) - Soft gray-blue backdrop
- **Card/Surface**: `#ffffff` - Pure white for primary content surfaces
- **Ink (Text Primary)**: `#1c1c1e` - Near-black for maximum readability
- **Ink-2 (Text Secondary)**: `#6e6e73` - Medium gray for supporting text
- **Ink-3 (Text Tertiary)**: `#aeaeb2` - Light gray for placeholders, hints
- **Hairline (Borders)**: `rgba(60, 60, 67, 0.14)` - Ultra-subtle separation

### Dark Mode (System)
- **Canvas**: `#000000` - True black for OLED-friendly backdrop
- **Card/Surface**: `#1c1c1e` - System gray for elevated surfaces
- **Ink (Primary)**: `#f5f5f7` - Off-white for comfortable reading
- **Ink-2 (Secondary)**: `#98989e` - Muted gray
- **Ink-3 (Tertiary)**: `#636366` - Darker tertiary
- **Hairline**: `rgba(255, 255, 255, 0.14)` - Subtle light dividers

### Accent & Semantic Colors
- **Accent (Primary)**: `#007aff` (light) / `#0a84ff` (dark) - System blue, used for actions, links, progress
- **Green (Success)**: `#34c759` / `#30d158` - Positive, food budgets, savings
- **Orange (Warning)**: `#ff9f0a` (both modes) - Warnings, near-limits, overspend indicators
- **Orange-Ink (Accessible)**: `#c8730a` (light) / `#ff9f0a` (dark) - Readable orange text on tinted chips
- **Red (Danger/Error)**: `#ff3b30` / `#ff453a` - Errors, over-budget, destructive actions

### Color Psychology
- **System blue** conveys trust, professionalism, and actionability
- **Calm grays** reduce financial anxiety while maintaining hierarchy
- **Green** provides positive reinforcement for good budgeting habits
- **Orange/Red** used sparingly as gentle warnings without creating panic

## Typography System

### Font Families
- **Primary Font**: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", "Segoe UI", system-ui, sans-serif` - System-native stack for optimal readability and performance

### Font Hierarchy
| Element | Size | Weight | Tracking | Line Height | Usage |
|---|---|---|---|---|---|
| Display (Amount) | 34-40px | 700 (bold) | -0.02em | 1 | Large currency amounts (dashboard budget, totals) |
| H1 (Page Title) | 28px | 700 (bold) | tight | 1.15 | Page headers |
| H2 (Section Title) | 13px | 600 (semibold) | 0.06em | 1.4 | Uppercase section labels |
| Card Title | 17px | 600 (semibold) | normal | 1.3 | Card headings, item names |
| Body Text | 16-17px | 400-500 | -0.01em | 1.6 | Primary content, inputs |
| Small Text | 13-14px | 400-500 | normal | 1.5 | Metadata, hints, captions |
| Micro Text | 10-12px | 500-600 | normal | 1.4 | Tab labels, badges, chips |

### Typography Guidelines
- **Letter spacing**: -0.01em on body for modern iOS feel; 0.06em for uppercase labels
- **Line length**: Keep content concise; cards rarely exceed ~40-60 characters per line
- **Tabular numbers**: Use for all monetary values (`tabular-nums` class) to ensure aligned digits
- **Avoid long paragraphs**: Prefer scannable lists and compact layouts

## Layout Principles

### Grid System
- **Max container width**: `max-w-2xl` (672px) - Comfortable reading on mobile, scales to desktop
- **Horizontal padding**: `px-4` (16px) on mobile, with safe areas respected
- **Vertical rhythm**: Spacing between major sections is `mt-4`, `mt-6` for clear hierarchy
- **Cards**: Self-contained blocks with internal padding (typically `p-4` to `p-5`)

### Spacing Scale (Tailwind-based)
- **xs**: 4px (`gap-1`)
- **sm**: 8px (`gap-2`)
- **md**: 12-16px (`gap-3`, `p-4`)
- **lg**: 20px (`p-5`, `gap-5`)
- **xl**: 24px (`gap-6`)
- **2xl**: 32px (`mt-8`)

### Responsive Behavior
- **Mobile-first**: Base styles target small screens
- **Breakpoint**: Uses max-width constraints rather than complex breakpoints
- **Safe areas**: All bottom padding uses `pb-safe` (`env(safe-area-inset-bottom)`) and top uses `pt-safe`
- **Tab bar**: Fixed bottom with safe area padding; content has `pb-safe` to avoid overlap

## Glass Material System

### Material Hierarchy (Strategic Use)
The design uses glass materials **only** for floating surfaces where depth/context is needed. Regular content uses solid cards for maximum legibility.

| Material | CSS Class | Use Case | Characteristics |
|---|---|---|---|
| Thin Glass | `.material.material-thin` | Toolbars, floating controls, minimal overlays | Subtle translucency (60% white/black), light blur (24px) |
| Regular Glass | `.material.material-regular` | Cards that need depth over busy backgrounds | Medium translucency (78% white/76% dark), 24px blur, subtle sheen |
| Thick Glass | `.material.material-thick` | Sheets, tab bar, bottom sheets | Higher opacity (94% white/92% dark), stronger blur (40px), subtle noise texture |

### Glass Properties
- **Backdrop blur**: `blur(24px)` saturate(180%) for thin/regular; `blur(40px)` saturate(200%) for thick
- **Edge highlight**: `inset 0 0 0 0.5px var(--glass-edge)` for iOS-style edge definition
- **Top highlight**: Subtle inner top glow for light reflection
- **Sheen gradient**: Liquid-glass light reflection `linear-gradient(135deg, var(--glass-sheen) 0%, transparent 46%)`
- **Noise texture**: Subtle fractal noise on thick materials to reduce banding on large surfaces

### When NOT to use glass
- Content cards in lists (use `.card` with solid background for maximum text contrast)
- Forms and inputs (solid backgrounds for clarity)
- Dashboard summary cards (regular content) - the app uses `.card` class, not glass for these

## Component Styling

### Cards
- **Class**: `.card` for solid content cards; `.material.material-regular` for glass cards
- **Border radius**: `20px` (`var(--radius-card)`)
- **Background**: Solid `var(--color-card)` with subtle top sheen gradient in dark/light modes
- **Shadow**: Soft iOS shadow `0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.07)` (adjusted for dark mode)
- **Usage**: Lists, summaries, grouped content

### Buttons
| Variant | Background | Text | Shadow/Style | Usage |
|---|---|---|---|---|
| `primary` | `var(--color-accent)` | `white` | `shadow-[0_6px_20px_rgba(0,122,255,0.28)]` | Primary actions (Save, Add, Verify) |
| `secondary` | `var(--color-card)` | `var(--color-accent)` | Hairline border | Secondary actions |
| `quiet` | `transparent` | `var(--color-accent)` | None | Low-emphasis actions |
| `danger` | `var(--color-red)` | `white` | None | Destructive actions (Delete) |

- **Height**: `min-h-[50px]` (44pt minimum)
- **Border radius**: Full pill `rounded-full`
- **Font**: 17px semibold
- **Press effect**: Scale down to 0.97 with opacity fade (150ms ease-ios)

### Inputs & Form Fields
- **Input class**: `.input` - White/dark card background with 14px border radius
- **Padding**: `13px 16px` (touch-friendly)
- **Font size**: 17px (iOS standard)
- **Focus state**: Accent blue border + subtle blue glow `0 0 0 3px rgba(0,122,255,0.18)`
- **Placeholder**: `var(--color-ink-3)` (tertiary text)
- **Field labels**: 15px medium, `var(--color-ink-2)`, with 6px margin below
- **Select dropdown**: Custom chevron icon, right-aligned

### Interactive Elements
- **Press feedback**: `.press` class provides `scale(0.97)` + opacity 0.9 on active (160ms cubic-bezier)
- **Hover lift**: On pointer devices, cards and material-regular lift `translateY(-3px)` with enhanced shadow (400ms)
- **Icon buttons**: 44x44px minimum (h-11 w-11), circular, subtle text color
- **Chips**: Pill-shaped, colored backgrounds with alpha mixing, 12px font semibold
- **Progress bars**: 8px height (`h-2`), rounded-full, smooth width transition (500ms ease-ios)
- **Segmented control**: Pill container with hairline, selected state has white card background + subtle shadow

## Motion & Micro-interactions

### Easing Curves
- **iOS standard**: `cubic-bezier(0.32, 0.72, 0, 1)` (`--ease-ios`) - Natural, springy iOS feel
- **Usage**: All transitions, animations, and sheet movements

### Timing Guidelines
| Animation | Duration | Purpose |
|---|---|---|
| Press feedback | 160ms | Immediate tactile response to taps |
| Fade in | 280ms | Backdrop fades, overlays appear |
| Rise in | 320ms | Content entering with slight upward motion |
| Sheet in | 420ms | Bottom sheets slide up smoothly |
| Hover lift | 400ms | Subtle elevation on desktop hover |
| Progress update | 500ms | Smooth progress bar fills |

### Key Animations
- **Sheet slide-up**: `translateY(100%) ? translateY(0)` with 420ms ease-ios
- **Fade backdrop**: `opacity: 0 ? 1` with 280ms ease-ios
- **Rise**: `opacity: 0, translateY(8px) ? opacity: 1, translateY(0)` with 320ms ease-ios
- **Press**: GPU-accelerated scale + opacity (transform/opacity only for performance)

### Accessibility
- **Reduced motion**: All animations/transitions disabled (`animation-duration: 0.001ms !important`) when `prefers-reduced-motion: reduce` is set
- **Focus visible**: 2px accent outline with 2px offset for keyboard navigation
- **High contrast**: Uses system colors that respect OS contrast settings

## Navigation & Structure

### Tab Bar
- **Position**: Fixed bottom, centered with max-width `max-w-md` (448px)
- **Style**: Thick glass material (`.material-thick`) with rounded-full corners
- **Height**: `var(--tabbar-height)` (64px) + safe area
- **Active state**: Accent blue (`var(--color-accent)`) with 2pt stroke on icon, bold font
- **Inactive state**: Secondary text color with 1.75pt stroke
- **Labels**: 10px text, truncated to prevent wrapping
- **Press feedback**: Subtle scale on tap

### Page Headers
- **Composition**: Title, optional subtitle, optional right action (chip/button)
- **Title**: H1 style (28px bold) for main pages
- **Subtitle**: 13-14px secondary text
- **Right element**: Often a Chip (days left indicator) or MonthNav

### Bottom Sheets
- **Material**: Thick glass, full-width with max-width `max-w-lg` (512px)
- **Behavior**: Slide up from bottom with drag-to-dismiss
- **Grabber**: Horizontal bar indicator for affordance (8x36px pill)
- **Close affordance**: X button in header + tap outside backdrop + Escape key
- **Content scroll**: Inner container scrolls with `overscroll-contain` and safe bottom padding
- **Dismiss threshold**: 28% of panel height

## Design Patterns

### Lists & Grouping
- **Separated items**: Use `divide-y divide-[var(--color-hair)]` for clean visual separation
- **Compact rows**: 52-56px min height for list items, with 12-16px padding
- **Right-aligned values**: Currency amounts right-aligned with tabular numbers
- **Left content**: Title + metadata in vertical stack with truncation

### Progress Visualization
- **Progress bars**: Used for budget usage, food consumption
- **Color thresholds**: 
  - Normal: Accent/Green (< 85-90%)
  - Warning: Orange (85-90% to 100%)
  - Over: Red (> 100%)
- **Smooth transitions**: 500ms ease-ios for polished feel

### Empty States
- **Card-based**: Centered text in a card (`EmptyState` component)
- **Title**: 16px medium primary text
- **Hint**: 14px secondary text below
- **Usage**: No data scenarios (empty expenses, recent transactions)

### Chips & Badges
- **Neutral**: Hairline background, secondary text
- **Accent**: Blue-tinted with alpha, accent text
- **Green**: Success-tinted, green text
- **Orange**: Warning-tinted, orange-ink text (accessible)
- **Red**: Error-tinted, red text
- **Usage**: Status indicators, tags, overspend targets

## Visual Principles

### Depth & Hierarchy
1. **Canvas** (base) - Background layer with subtle gradient backdrop
2. **Cards** (content) - Solid elevation for primary content
3. **Floating surfaces** (contextual) - Glass materials for nav, sheets, overlays
4. **Interactive feedback** - Press/hover states provide tactile depth

### Spacing & Breathing Room
- Generous padding around content (16px horizontal minimum)
- Clear vertical separation between sections (24-32px spacing)
- Internal card padding of 16-20px for readability
- Hairline dividers are whisper-thin to avoid visual clutter

### Balance & Restraint
- Glass is used sparingly (only floating elements) to maintain legibility
- Single accent color (system blue) keeps palette cohesive
- Semantic colors used only when meaningful (warnings, errors, success)
- Subtle shadows and glows, never heavy or overwhelming
- Calm aesthetic suitable for daily financial check-ins

## Accessibility Considerations

- **Color contrast**: All text meets WCAG AA standards with system colors
- **Touch targets**: Minimum 44x44pt for all interactive elements
- **Keyboard navigation**: Focus visible styles on all focusable elements
- **Reduced motion**: Respects OS preference for reduced animations
- **Screen readers**: Proper ARIA labels on icon buttons, aria-current on active nav, aria-modal on sheets
- **Dynamic type**: Uses system font stack that respects user font size settings
- **Dark mode**: Full support via prefers-color-scheme for eye comfort

## Implementation Notes

- **CSS variables**: All colors, spacing, radii, and timing defined as CSS custom properties for theme consistency
- **Liquid glass**: Subtle radial gradient app backdrop adds ambient color without competing with content
- **Performance**: Animations use transform/opacity only (GPU-accelerated), backdrop-filter with appropriate blur values
- **Cross-platform**: WebKit-prefixed backdrop-filter for Safari compatibility
- **Native feel**: System font stack, iOS easing curves, standard iOS spacing patterns

## Design Highlights

1. **Strategic glass usage** - Glass materials only where they explain depth (tab bar, sheets, nav), keeping content areas highly legible
2. **Calm financial UX** - Soft color palette and gentle motion reduce anxiety around money tracking
3. **iOS authenticity** - SF Pro, system colors, standard spacing, iOS sheet physics feel native
4. **Responsive to system preferences** - Automatic light/dark mode with appropriate contrast
5. **Touch-optimized** - Generous hit targets, smooth press feedback, safe area support
6. **Information hierarchy** - Clear typographic scale makes financial data scannable at a glance
7. **Subtle delight** - Liquid glass sheen, gentle hover lifts, smooth transitions without being distracting
