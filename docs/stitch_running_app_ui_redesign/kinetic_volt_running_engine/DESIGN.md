---
name: Kinetic Volt Running Engine
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c7c8af'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#91927c'
  outline-variant: '#464835'
  surface-tint: '#bfd037'
  primary: '#ffffff'
  on-primary: '#2e3300'
  primary-container: '#dbed52'
  on-primary-container: '#606a00'
  inverse-primary: '#5a6400'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#ffffff'
  on-tertiary: '#32302e'
  tertiary-container: '#e7e1de'
  on-tertiary-container: '#676461'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dbed52'
  primary-fixed-dim: '#bfd037'
  on-primary-fixed: '#1a1e00'
  on-primary-fixed-variant: '#434b00'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#e7e1de'
  tertiary-fixed-dim: '#cac6c2'
  on-tertiary-fixed: '#1d1b1a'
  on-tertiary-fixed-variant: '#494644'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-hero:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
  display-hero-mobile:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  stat-metric:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  label-md:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system targets urban runners, endurance athletes, and modern performance-focused individuals who demand instant, legible telemetry under rigorous physical motion. The aesthetic fuses technical precision with athletic aggression: high-contrast dark environments punctuated by high-visibility volt lime accents. 

The design language synthesizes High-Contrast Sports Modernism with Dark Mode Telemetry. Visuals prioritize glanceability while running in direct sunlight or mid-stride at dusk. Elements leverage pitch-black canvas depths, charcoal container cards with rounded corners, and a central circular trigger system designed for high ergonomic touch success.

## Colors

The palette is engineered around an OLED-optimized dark stack paired with high-luminance chartreuse neon:

- **Primary (`#EAFC5F`):** Kinetic Volt / Chartreuse. Used strictly for core kinetic actions (Start/Pause run), primary status indicators, active tabs, live GPS telemetry pings, and milestone badges.
- **Secondary (`#FFFFFF`):** Pure White. Reserved for primary metrics, numeric telemetry displays (distance, speed, heart rate), and core headings.
- **Tertiary (`#353331` / `#2B2B2B`):** Warm Carbon & Graphite. Applied to elevated card containers, floating telemetry pills, input backdrops, and active chip toggles.
- **Neutral (`#141414` base, `#000000` canvas, `#999999` muted):** Canvas tones that provide absolute separation. `#999999` is strictly designated for secondary metadata, units (`km`, `kcal`, `avg speed`), inactive icons, and timestamp descriptors.

Map overlays utilize a desaturated dark-mode vector cartography palette (`#1E1E1E` roads, `#141414` landmass, `#0B0B0B` terrain contours) allowing the `#EAFC5F` path tracking line and current position indicator to pop with zero distraction.

## Typography

Typography prioritizes rapid recognition at glance speeds under erratic camera and physical movement. 

- **Display & Metrics (`Space Grotesk`):** Technical, angular, and athletic. Employs tabular numeric figures for real-time running stats (`stat-metric`, `display-hero`), ensuring numbers do not jitter during live cadence and distance updates.
- **Body & Secondary Copy (`Plus Jakarta Sans`):** Clean, rounded, geometric humanist sans-serif providing optimal legibility for menus, calendar log entries, and settings descriptions.
- **Labels & Units (`label-caps`):** Rendered with uppercase styling, slight positive tracking (`+0.05em`), and paired with `#999999` muted color to offset the bright stat readouts.

## Layout & Spacing

Layouts are designed around a mobile-first 4-column dynamic grid with edge-to-edge full bleed support for dark interactive map interfaces.

- **Screen Padding:** Standard mobile views enforce an outer margin of `1.25rem` (20px), leaving sufficient lateral breathing room while running on handheld devices.
- **Card Hierarchy & Padding:** Metrics cards use `1rem` internal padding for compact modular placement, while primary modal sheets leverage `1.5rem`.
- **Thumb-Zone Architecture:** Primary interactions (session activation, sport switching, telemetry toggles) are weighted to the bottom 40% of the viewport. Floating bottom navigation uses a pill-shaped elevated container docked above the system home indicator with an internal gutter of `0.5rem`.
- **Multi-device Behavior:** On larger viewports or tablet dashboards, metrics shift to a 2-column or 3-column masonry grid while retaining identical telemetry card aspect ratios.

## Elevation & Depth

Visual depth is achieved through high-contrast tonal layering rather than fuzzy drop shadows:

- **Level 0 (Canvas Base):** Pure `#000000` or deep dark-mode map tiles.
- **Level 1 (Docked Containers & Surfaces):** `#141414` and `#1E1E1E` surface fills with an ultra-subtle border stroke (`1px solid rgba(255, 255, 255, 0.08)`).
- **Level 2 (Telemetry Cards & Modules):** `#222222` to `#2B2B2B` with a soft top edge highlight (`1px solid rgba(255, 255, 255, 0.12)`) and a targeted ambient drop shadow (`0 8px 24px rgba(0, 0, 0, 0.6)`).
- **Level 3 (Floating Active Telemetry & Controls):** Primary circular action triggers (`#EAFC5F`) emit a focused atmospheric neon glow (`0 0 28px rgba(234, 252, 95, 0.35)`), creating clear visual priority over the dark base map.

## Shapes

The interface embraces bold, geometric roundedness balanced by full circular controls:

- **Cards and Metric Blocks:** Standard `rounded-lg` (16px / `1rem`) corner radii, conveying smooth, modern automotive-inspired ergonomics.
- **Sheet Containers & Modals:** `rounded-xl` (24px / `1.5rem`) top boundaries to dock over live maps.
- **Interactive Action Triggers:** Circular/Pill (`9999px`) shapes for navigation bars, category filter chips, and primary floating action buttons (FABs).
- **Calendar & History Nodes:** Square cards softened with `0.5rem` (8px) radii to balance data-dense tabular logs.

## Components

### Action Triggers & Buttons
- **Primary Hero Action Button:** A massive circular control (64px to 72px diameter) bathed in `#EAFC5F` with black iconography (`#000000`). Used exclusively for "Play / Start Run" and "Pause Workout". Features a dynamic glow pulse when the workout is armed.
- **Secondary Action Buttons:** Pill-shaped capsules with `#FFFFFF` background, black text, and medium font-weight for onboarding confirmations ("Continue with Email", "Schedule Workout").
- **Ghost/Icon Action Triggers:** Circular `#222222` discs (44px) with centered white/grey vector icons for auxiliary map tools (Music, Recenter GPS, Layer toggles).

### Metric & Telemetry Cards
- **Dual Stat Pods:** Horizontal grid pairs styled in `#1E1E1E` or `#2B2B2B` with rounded corners. Large `stat-metric` numbers in pure `#FFFFFF` placed above uppercase muted grey unit labels (`#999999`).
- **Live Workout HUD:** Compact floating pill cards displaying real-time speed, heart rate, and cadence anchored directly beneath the top safe area.

### Chips & Filter Toggles
- **Sport Selector Pills:** Enclosed in a dark pill track (`#1E1E1E`). Inactive chips display muted grey text; active chips highlight in solid `#EAFC5F` with dark text or an inset volt dot indicator.
- **Date/Scope Segmented Controls:** Low-profile tabs (`Week`, `Month`, `Year`, `All`) with a sliding `#353331` backing pill.

### Lists & Activity Rows
- **Workout History Items:** Dark row cards (`#1E1E1E`) separated by `0.5rem` vertical spacing. Includes date badge on the left (`#FFFFFF` text on `#2B2B2B`), workout type title, duration/calorie stats, and an inline navigation chevron.
- **Settings & Integration Lists:** Borderless items with high-contrast icon badges (Apple Health, Siri, Heart Rate monitors) and `#FFFFFF` title copy.

### Input Fields & Controls
- **Form Inputs:** Fully rounded capsules (`9999px`) or `0.75rem` rounded rectangles filled with `#222222`, thin interior padding, white user-entered text, and subtle icon prefixes (mail, lock). Focus state activates an `#EAFC5F` stroke.
- **Radio & Check Selectors:** Custom radio controls featuring an outer dark grey ring that fills with an `#EAFC5F` volt center disk upon selection.