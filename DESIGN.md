# Monolog Design System (DESIGN.md)

This document establishes the official design system for **Monolog**, a calm technical notebook built with Next.js and Notion. It serves as the single source of truth for design tokens, typography rules, layout surfaces, component styling, responsive behavior, and UI consistency.

---

## 1. Purpose & Reference Adaptation

### System Identity
Monolog is designed as a **calm technical notebook**. It combines an integrated developer editor shell (title bar, activity bar, file tree, tab bar, status bar) with paper-like reading surfaces for articles and documentation.
### Adaptation of Reference Specifications
This design system adapts key architectural principles from technical workspace design specifications (such as Notion/editor references) while maintaining strict identity boundaries:

- **Paper-Like Reading Surfaces**: High-contrast, clean reading areas with subtle background surface depth.
- **VS Code-Inspired Surface Hierarchy & Syntax Accents**: Chrome surfaces, cards, and hairline borders adopt a restrained VS Code Dark/Light Modern palette (`#005fb8` light / `#0078d4` dark signal blue). Functional semantic accents use syntax-derived hues (signal blue, cs teal, paper amber, research purple, grass green) for content-type signaling while preserving paper-like reading surfaces.
- **Hairline Depth**: Visual elevation is achieved exclusively through subtle background surface contrast and `1px solid` hairline borders (`#e5e5e5` light / `#2b2b2b` dark).
- **Dual Typographic Hierarchy**: Pretendard (Sans) for reading prose and titles; JetBrains Mono (Mono) for editor chrome, code, frontmatter, dates, and technical metadata.
- **Editor Chrome Integrity**: Preserves the functional IDE shell aesthetic across navigation and page inspection.

### Anti-Patterns & Strict Exclusions
- **No Gradients**: CSS gradients (`linear-gradient`, `radial-gradient`) are strictly prohibited across all chrome, cards, buttons, and backgrounds.
- **Controlled Semantic Content Accents**: Category badges and post card accents map intentionally to functional content-type signals (Docs -> blue, Computer Science -> teal, Paper -> amber, Research -> purple). Random or arbitrary multi-color rainbow schemes remain strictly prohibited.
- **No Heavy Shadows**: Drop shadows (`shadow-lg`, `shadow-2xl`) are banned. Surface hierarchy uses hairline borders (`border-hairline`) and background token shifts (`bg-card`, `bg-elevated`, `bg-sunken`).
- **No Decorative Accent Artifacts**: Floating glow blurs, ambient light rings, and decorative ribbons are prohibited.
- **No Notion Brand Identity Claims**: Monolog consumes Notion data via API, but its UI chrome remains an independent technical notebook without Notion logos, brand claims, or proprietary icons.

---

## 2. Exact Light & Dark Semantic Tokens

### Source Files
1. `src/layouts/RootLayout/ThemeProvider/Global/index.tsx` — CSS Custom Properties & Prism theme overrides.
2. `src/styles/colors.ts` — Emotion Theme `editorLight` and `editorDark` JavaScript objects.
3. `src/styles/globals.css` — Tailwind v4 `@theme inline` semantic utility mappings.
4. `src/styles/variables.ts` — Static layout dimensions and breakpoints.

---

### Light Mode Token Specifications

| Token Name | CSS Variable (`--c-*`) | RGB Tuple | Hex Equivalent | Emotion `editorLight` Key | Purpose / Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ink** | `--c-ink` | `31 31 31` | `#1f1f1f` | `fg` | Primary body text, high-contrast headings |
| **Chrome** | `--c-chrome` | `248 248 248` | `#f8f8f8` | `bg` | Shell background, activity bar, title bar |
| **Card** | `--c-card` | `255 255 255` | `#ffffff` | `bg2` | Reading card surfaces, main content body |
| **Elevated** | `--c-elevated` | `242 242 242` | `#f2f2f2` | `bg3` | Floating menus, series badges, popups |
| **Sunken** | `--c-sunken` | `242 242 242` | `#f2f2f2` | `bg3` / `gutter` | Code block backgrounds, search inputs |
| **Hairline** | `--c-hairline` | `229 229 229` | `#e5e5e5` | `line` | `1px` structural borders, dividers |
| **Mute** | `--c-mute` | `110 118 129` | `#6e7681` | `fg3` | Secondary metadata, dates, counts |
| **Soft** | `--c-soft` | `134 134 134` | `#868686` | `fg4` | Tertiary text, summaries, captions |
| **Strong** | `--c-strong` | `31 31 31` | `#1f1f1f` | `fg` | Primary bold text, main headings |
| **Signal Base** | `--c-signal` | `0 95 184` | `#005fb8` | `accent` / `accent2` | Primary blue signal, active state, link hover |
| **Signal 50** | `--c-signal-50` | `220 238 255` | `#dceeff` | `accentSoft` | Badge backgrounds, active tab hover bg |
| **Signal 200** | `--c-signal-200` | `77 143 209` | `#4d8fd1` | — | Mid-tone signal highlight |
| **Signal 900** | `--c-signal-900` | `0 79 158` | `#004f9e` | `accent3` | Badge text color, dark blue accent text |

*Note: `--c-cs` (teal `#267f99`), `--c-paper` (amber `#795e26`), `--c-research` (purple `#af00db`), and `--c-grass` (green activity scale) provide functional semantic color aliases for content-type signaling.*


---

### Dark Mode Token Specifications

| Token Name | CSS Variable (`--c-*`) | RGB Tuple | Hex Equivalent | Emotion `editorDark` Key | Purpose / Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ink** | `--c-ink` | `225 225 225` | `#e1e1e1` | `fg` | Primary body text, high-contrast headings |
| **Chrome** | `--c-chrome` | `24 24 24` | `#181818` | `bg` | Shell background, activity bar, title bar |
| **Card** | `--c-card` | `31 31 31` | `#1f1f1f` | `bg2` | Reading card surfaces, main content body |
| **Elevated** | `--c-elevated` | `37 37 37` | `#252525` | `bg3` | Floating menus, series badges, popups |
| **Sunken** | `--c-sunken` | `32 32 32` | `#202020` | `gutter` | Code block backgrounds, search inputs |
| **Hairline** | `--c-hairline` | `43 43 43` | `#2b2b2b` | `line` | `1px` structural borders, dividers |
| **Mute** | `--c-mute` | `157 157 157` | `#9d9d9d` | `fg3` | Secondary metadata, dates, counts |
| **Soft** | `--c-soft` | `179 179 179` | `#b3b3b3` | `fg4` | Tertiary text, summaries, captions (passes WCAG AAA on `#1f1f1f`) |
| **Strong** | `--c-strong` | `225 225 225` | `#e1e1e1` | `fg` | Primary bold text, main headings |
| **Signal Base** | `--c-signal` | `0 120 212` | `#0078d4` | `accent` / `accent2` | Primary blue signal, active state, link hover |
| **Signal 50** | `--c-signal-50` | `6 54 92` | `#06365c` | `accentSoft` | Badge backgrounds, active tab hover bg |
| **Signal 200** | `--c-signal-200` | `77 170 252` | `#4daafc` | `accent3` | Mid-tone signal highlight |
| **Signal 900** | `--c-signal-900` | `215 235 255` | `#d7ebff` | — | High-contrast light signal text and highlight |


---

### Documented Notion & Semantic Text Gray Scale

`Global/index.tsx` declares `--fg-color`, `--bg-color`, and `--theme-colors-gray1` through `gray12` to ensure seamless compatibility with Notion block rendering:

| Token | Light Mode Hex | Dark Mode Hex | Usage |
| :--- | :--- | :--- | :--- |
| `--fg-color` | `#1f1f1f` | `#e1e1e1` | Global body text color |
| `--bg-color` | `#ffffff` | `#1f1f1f` | Main page background |
| `--theme-colors-gray1` | `#f8f8f8` | `#181818` | App chrome background |
| `--theme-colors-gray2` | `#fafafa` | `#1c1c1c` | Ultra-soft background tint |
| `--theme-colors-gray3` | `#f2f2f2` | `#202020` | Secondary surface fill |
| `--theme-colors-gray4` | `#e5e5e5` | `#2b2b2b` | Hairline border stroke |
| `--theme-colors-gray5` | `#cecece` | `#3c3c3c` | Secondary border stroke |
| `--theme-colors-gray6` | `#cecece` | `#3c3c3c` | Disabled control stroke |
| `--theme-colors-gray7` | `#868686` | `#9d9d9d` | Soft text / placeholder |
| `--theme-colors-gray8` | `#868686` | `#9d9d9d` | Muted text |
| `--theme-colors-gray9` | `#6e7681` | `#9d9d9d` | Mute text / comments |
| `--theme-colors-gray10` | `#3b3b3b` | `#b3b3b3` | Sub-heading text |
| `--theme-colors-gray11` | `#3b3b3b` | `#cccccc` | Secondary strong text |
| `--theme-colors-gray12` | `#1f1f1f` | `#e1e1e1` | Primary strong text |


---

## 3. Typography Roles

Monolog enforces a strict dual-font policy configured in `src/styles/globals.css` and Next.js font assets:

```css
--font-sans: "Pretendard Variable", Pretendard, system-ui, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, monospace;
```

### Sans Reading Hierarchy (`font-sans`)
Reserved exclusively for natural language content, reading prose, section titles, and user narrative:
- **Hero Title (`H1`)**: `text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-strong leading-tight`
- **Post Title (`H1`)**: `clamp(28px, 3.5vw, 40px) font-bold text-strong leading-1.25 tracking-tight`
- **Section Heading (`H2`)**: `text-base font-semibold text-strong`
- **Card Title (`H3`)**: `text-base font-semibold text-strong leading-snug`
- **Body & Summaries**: `text-sm sm:text-base text-soft leading-relaxed`
- **Tag Label**: `font-sans font-medium text-strong`

### Mono Technical Hierarchy (`font-mono`)
Reserved for editor chrome, technical metadata, structured code, navigation indicators, and counts:
- **Editor Chrome (TitleBar/TabBar/StatusBar)**: `font-mono text-xs text-mute`
- **Frontmatter Block**: `font-mono text-[13px] leading-1.6 text-mute` (keys in `text-signal`)
- **Category Badge**: `font-mono text-[10px] font-medium uppercase px-2 py-0.5 rounded-md bg-signal-50 text-signal-900`
- **Metadata & Dates**: `font-mono text-xs text-mute`
- **Tag Prefixes & Counts**: `font-mono text-mute` (e.g. `#tag 12`)
- **Code & Syntax**: `font-mono text-xs/sm` inside `code`, `pre`, `.notion-code`

---

## 4. Spacing, Radii & Elevation Scales

### Spacing Scale
- `4px` (`gap-1`, `mb-1`) — Micro element spacing
- `8px` (`gap-2`, `mb-2`) — Compact element inline gap
- `12px` (`gap-3`, `p-3`, `mb-3`) — Standard item gap & card padding
- `16px` (`p-4`, `mb-4`) — Card internal padding & section spacing
- `24px` (`mb-6`, `p-6`) — Section margin & block separation
- `28px` (`mb-7`, `titlebar: 28px`) — Layout header spacing & titlebar height
- `32px` (`mb-8`, `tabbar: 32px`) — Section margin & tabbar height
- `40px` (`mb-10`, `padding: 40px`) — Major feed block spacing & article top padding
- `56px` (`gutter: 56px`) — Editor line number gutter width (retained in technical chrome / page detail layout)
- `64px` (`padding-bottom: 64px`) — Article bottom content padding

### Border Radius Scale
- `4px` (`rounded-md`): Inline code spans, micro tag badges
- `6px` (`rounded-md`): Category badges (`px-2 py-0.5`)
- `8px` (`rounded-lg`): Series icon containers (`h-9 w-9`)
- `12px` (`rounded-[12px]`): Feed post cards, series cards, hero thumbnail container
- `16px` (`rounded-[16px]`): Floating search modal, dialog overlays

### Elevation & Depth System
Monolog uses **zero drop-shadows** for layout cards and panels. Surface elevation is expressed through token layering and hairline borders:

```
[Level 0: Chrome]     --c-chrome (#f8f8f8 / #181818) -> App Shell outer container
  [Level 1: Card]     --c-card   (#ffffff / #1f1f1f) -> Feed cards, post content area (Border: --c-hairline)
    [Level 2: Elevated] --c-elevated (#f2f2f2 / #252525) -> Popup menus, series icons (Border: --c-hairline)
    [Level -1: Sunken]  --c-sunken (#f2f2f2 / #202020) -> Code blocks, line gutters, search inputs
```


---

## 5. App-Shell vs. Reading-Surface Distinction

The application clearly separates **App-Shell Chrome** from **Reading Surfaces**:

```
+-----------------------------------------------------------------------------+
| APP-SHELL: TitleBar (28px height | font-mono | bg-chrome | border-b hairline)|
+--------------+--------------------------------------------------------------+
| ActivityBar  | APP-SHELL: TabBar (32px height | font-mono | bg-chrome)       |
| (44px width  +--------------------------------------------------------------+
| font-mono    | READING SURFACE: Scroll Area (.scroll-area)                  |
| bg-chrome)   | +-----------------------------------------------+------------+ |
|              | | Main Body (.body)                             | RightRail  | |
|              | | font-sans | max-w-[760px]                    | (240px)    | |
|              | | bg-card / paper-like surface                  | TOC/Meta   | |
|              | | Frontmatter + Notion Content                  | font-mono  | |
|              | +-----------------------------------------------+------------+ |
+--------------+--------------------------------------------------------------+
| APP-SHELL: StatusBar (22px height | font-mono | bg-chrome | neutral blue dot)|
+-----------------------------------------------------------------------------+
```

### App-Shell Chrome (`EditorShell`, `TitleBar`, `ActivityBar`, `FileTree`, `TabBar`, `StatusBar`)
- **Fixed Viewport Layout**: `position: fixed; inset: 0; overflow: hidden;`
- **Font**: Exclusively `font-mono` (JetBrains Mono).
- **Background**: `bg-chrome` (`#f8f8f8` light / `#181818` dark).
- **Borders**: Hairline borders (`border-hairline`) dividing toolbars, tabs, and status regions.

### Reading Surface (`PostDetail`, `RecentPostsCompact`, `HomeHero`, `NotionRenderer`)
- **Scrollable Surface**: `.scroll-area` with smooth vertical scrolling.
- **Grid Layout**: `grid-template-columns: 1fr 240px` (Content Body, Right Rail TOC). Active Feed and PostDetail reading surfaces remove the line number gutter while editor shell retains technical chrome.
- **Font**: Exclusively `font-sans` (Pretendard) for body text and post titles.
- **Background**: `bg-card` (`#ffffff` light / `#1f1f1f` dark) providing a paper-like reading canvas.

---

## 6. Concrete Active Component Rules

### 1. `HomeHero` (`src/routes/Feed/HomeHero.tsx`)
- **Top Metadata**: `font-mono text-xs text-mute mb-3` (`CONFIG.profile.name · since YYYY`).
- **Main Heading (`H1`)**: `font-sans text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-strong leading-tight` (unadorned H1: `"a technical notebook<br />kept in the open."`).
- **Bio Paragraph**: `mt-4 font-sans text-sm sm:text-base text-soft leading-relaxed max-w-2xl`.

### 2. `RecentPostsCompact` (`src/routes/Feed/RecentPostsCompact.tsx`)
- **Card Container**: `rounded-[12px] border border-hairline bg-card overflow-hidden transition-colors hover:border-*/45 hover:bg-card/85` (hover border mapped per category).
- **Left Accent Strip**: `grid-cols-[6px_1fr]` or `grid-cols-[6px_1fr_auto]`. Strip: `bg-hairline group-hover:bg-* transition-colors` (hover strip mapped per category).
- **Category Badge**: `font-mono text-[10px] font-medium px-2 py-0.5 rounded-md bg-*-50 text-*-900 dark:text-*-200` (mapped per category: Docs -> signal blue, Computer Science/cs -> teal, Paper/논문 -> amber, Research -> purple).
- **Title (`H3`)**: `font-sans text-base font-semibold text-strong leading-snug line-clamp-2 mb-1 group-hover:text-* transition-colors`.
- **Summary**: `font-sans text-xs sm:text-sm text-soft leading-relaxed line-clamp-2 mb-2`.
- **Date & Arrow**: `font-mono text-xs text-mute`, arrow transitions `group-hover:text-*`.


### 3. `FeaturedSeriesGrid` (`src/routes/Feed/FeaturedSeriesGrid.tsx`)
- **Grid**: `grid grid-cols-1 sm:grid-cols-2 gap-3`.
- **Series Card**: `flex items-center gap-3 rounded-[12px] border border-hairline bg-card p-3 transition-colors hover:border-signal/45 hover:bg-card/85`. Odd final series cards span both desktop columns (`sm:col-span-2`).
- **Icon Box**: `grid h-9 w-9 shrink-0 place-items-center rounded-lg font-mono text-sm font-medium bg-elevated text-mute group-hover:bg-signal-50 group-hover:text-signal-900 transition-colors` containing `§`.
- **Title & Count**: Title in `font-sans text-sm font-medium text-strong truncate group-hover:text-signal`, count in `font-mono text-xs text-mute`.

### 4. `TagCloud` (`src/components/TagCloud.tsx`)
- **Tag Container**: `flex flex-wrap gap-x-3 gap-y-2 items-baseline`.
- **Dynamic Scale**: Font size dynamically scaled from `11px` to `18px`, opacity scaled from `0.55` to `1.0` based on post count.
- **Formatting**: `#` prefix in `font-mono text-mute group-hover:text-signal/70`, tag name in `font-sans font-medium text-strong group-hover:text-signal`, post count in `font-mono text-[10px] text-mute`.

### 5. `Frontmatter` (`src/components/Frontmatter/index.tsx`)
- **Wrapper**: `font-mono text-[13px] text-mute mb-6 leading-1.6` delimited by `---` lines.
- **Key Highlight**: `.key { color: var(--color-signal); }` (e.g. `title`, `date`, `category`, `tags`, `read`).

### 6. `NotionRenderer` (`src/routes/Detail/components/NotionRenderer/index.tsx`)
- **Container**: `.notion-content` overrides `react-notion-x` defaults. Overrides `.notion-page` padding to `0 !important`.
- **Code Block Overrides (`Global/index.tsx`)**:
  - Background: `#f2f2f2` light / `#202020` dark; Border: `1px solid #e5e5e5` light / `#2b2b2b` dark.
  - Syntax Highlighting: Prism follows VS Code Light+/Dark+ roles: keywords `#af00db` / `#c586c0`, strings `#a31515` / `#ce9178`, functions `#795e26` / `#dcdcaa`, types `#267f99` / `#4ec9b0`, numbers `#098658` / `#b5cea8`, and comments `#008000` / `#6a9955`.


### 7. `PostDetail` (`src/routes/Detail/PostDetail/index.tsx`)
- **Top Indicator**: `ReadingProgress` fixed bar at top of reading surface.
- **Hero Thumbnail**: 16:9 aspect ratio (`aspect-ratio: 16/9`), `rounded-[12px]`, `border border-hairline`, `bg-card`.
- **Post Title**: `font-sans text-[clamp(28px,3.5vw,40px)] font-bold text-strong leading-1.25 tracking-tight mb-7`.
- **Content Grid**: 2 columns (`1fr` max-width 760px body, `240px` RightRail TOC). Reading surfaces remove the line number gutter.

### 8. `StatusBar` (`src/layouts/RootLayout/EditorChrome/StatusBar.tsx`)
- **Dimensions**: Fixed bottom chrome bar (`height: 22px`, `font-mono text-[11px]`).
- **Status Indicator**: Neutral sunken background (`bg3`: `#f2f2f2` / `#252525`) with compact signal blue dot (`background: accent`, box-shadow glow, keyframe pulse animation) and readable foreground status text displaying `ssh pieroot@log · <IP>`.

- **Breadcrumb Strip**: Route items (`main`, `Reading`, `Markdown`) with active item highlighted in bold.

## 7. Responsive Rules

Monolog defines a single unified mobile breakpoint in `src/styles/variables.ts`:

```ts
export const variables = {
  breakpoint: 960, // Desktop >= 960px, Mobile < 960px
  // Chrome metrics
  activityBarWidth: 44,
  titleBarHeight: 28,
  tabBarHeight: 32,
  statusBarHeight: 22,
  gutterWidth: 56,
  fileTreeWidth: 240,
}
```

1. **Content Grid Collapse**: The 2-column post detail grid (`1fr 240px`) collapses to a single column (`1fr`).
   - RightRail TOC (`240px`) hides.
   - Body padding reduces from `40px 56px 64px` to `24px 20px 60px`.
2. **FileTree Drawer Overlay**: On mobile, the FileTree pane transforms into a sliding drawer overlay (`left: 44px`, `z-index: 20`).
   - Backdrop overlay appears (`background: rgba(0, 0, 0, 0.45)`, `z-index: 15`).
   - Backdrop click closes the drawer (`setFileTreeOpen(false)`).
3. **Hero Title Scaling**: `text-3xl` on mobile scaling to `text-5xl` on desktop (`sm:text-4xl md:text-5xl`).
4. **Series Grid Column Collapse**: `grid-cols-1` on mobile, `sm:grid-cols-2` above `640px`.
---

## 8. Interaction & Accessibility Rules

### State Transformations
- **Hover Transitions**: All interactive cards, series buttons, and links specify `transition-colors duration-150`.
- **Card Hover**: Border changes from `border-hairline` to category hover accent (`hover:border-signal/45`, `hover:border-cs/45`, etc.); background shifts to `hover:bg-card/85`.
- **Left Strip Hover**: Color transitions from `bg-hairline` to category group hover accent (`group-hover:bg-signal`, `group-hover:bg-cs`, etc.).
- **Text Hover**: Headings and arrows transition to category group hover text accent (`group-hover:text-signal`, `group-hover:text-cs`, etc.).


### Accessibility & Semantics
- **Focus Rings**: Interactive inputs and buttons use high-contrast signal focus rings (`focus:ring-2 focus:ring-signal focus:outline-none`) without intrusive shadows.
- **ARAI Attributes**: Drawer backdrops use `aria-hidden="true"`; modals use `aria-modal="true"`.
- **Semantic Structure**: Strictly formatted heading hierarchy (`H1` for post/hero title, `H2` for feed section titles, `H3` for card titles).

---

## 9. System Semantic Accents vs. Decorative Notion Colors

Monolog separates **purposeful VS Code-derived system accents** from **author-defined Notion colors**:

```
+-----------------------------------------------------------------------------+
| SYSTEM SEMANTIC ACCENTS (App Level)                                         |
| - Blue: focus, links, default Docs fallback                                 |
| - Teal: Computer Science and infrastructure                                 |
| - Amber: papers and paper reviews                                           |
| - Purple: research                                                          |
| - Green: writing activity only                                              |
| - RULE: One accent per content item; color communicates its type, never mood|
+-----------------------------------------------------------------------------+
                                     |
                                  MUST NOT
                                  OVERLAP
                                     |
+-----------------------------------------------------------------------------+
| DECORATIVE NOTION BLOCK COLORS (Content Level)                              |
| - Rendered exclusively inside .notion-content (e.g. Callout/Quote blocks)   |
| - Authors may select inline text highlights or callout box background colors|
| - RULE: Must NEVER bleed out into UI chrome or unrelated content categories |
+-----------------------------------------------------------------------------+
```

---

## 10. Implementation Boundaries

### Technology Stack Assignment
- **Tailwind CSS (v4)**: Primary choice for component JSX utility classes (`src/routes/Feed/*`, `src/components/*`). Consumes `@theme inline` variables from `globals.css`. Relies on `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));` for dark utilities.
- **Emotion Styled-Components**: Used for editor shell layout wrappers (`EditorShell`, `StatusBar`, `PostDetail`), global style injection (`Global/index.tsx`), and deep Notion renderer overrides (`NotionRenderer`).
- **CSS Variables (`var(--c-*)`)**: Root state injected in `Global/index.tsx`. Tailwind and Emotion both reference these exact custom properties to guarantee theme synchronization.
- **Theme Synchronization**: `ThemeProvider` (`src/layouts/RootLayout/ThemeProvider/index.tsx`) renders a `display: contents` wrapper element with `data-theme={scheme}` around `<Global />` and application children. This wrapper adds no layout box to the DOM box tree and serves as the authoritative Tailwind dark-variant contract targeting its descendants.
- **Global Reset & Utility Protection**: Global CSS resets in `Global/index.tsx` for `a` and `button` use non-destructive baselines (`color: inherit; text-decoration: none; background: none; border: none; font: inherit; cursor: pointer;`) that preserve Tailwind utilities without overriding component-level styling.

## 11. Explicit DO / DON'T Consistency Checklist

| Category | DO | DON'T |
| :--- | :--- | :--- |
| **Surfaces & Borders** | Use hairline 1px borders (`border-hairline`) to separate cards, panels, and chrome. | **DON'T** use drop shadows (`shadow-lg`, `shadow-2xl`) or blurred ambient glow filters. |
| **Color Accents** | Use VS Code Dark/Light Modern inspired core palette (`#005fb8` / `#0078d4` signal blue) with syntax-derived functional accents. | **DON'T** use CSS gradients (`linear-gradient`) anywhere in UI chrome, cards, or backgrounds. |
| **Categories & Tags** | Map functional category accents (Docs -> blue, Computer Science -> teal, Paper -> amber, Research -> purple) using literal Tailwind class pairs (`bg-*-50 text-*-900 dark:text-*-200`). | **DON'T** use arbitrary multi-color "rainbow" tags or unmapped decorative pills. |

| **Typography** | Use Pretendard for reading content and JetBrains Mono for editor chrome & metadata. | **DON'T** use mono fonts for article body prose, or sans fonts for code/line numbers/status bar. |
| **Editor Chrome** | Maintain fixed toolbars (TitleBar, ActivityBar, TabBar, StatusBar) with mono text. | **DON'T** remove editor chrome components or replace mono status text with decorative widgets. |
| **Notion Integration** | Restrict Notion block styling to `.notion-content` container. | **DON'T** let Notion inline colors bleed into app shell, card borders, tag clouds, or site header. |

---

## 12. Update Procedure When Changing Tokens or Components

When modifying tokens, layout dimensions, or adding new components, follow this exact step-by-step procedure:

1. **Update Root CSS Variables (`Global/index.tsx`)**:
   - Add or modify RGB tuples in both `LIGHT_VARS` and `DARK_VARS`.
   - If gray scale colors change, update `--theme-colors-gray1` through `gray12`.
2. **Update Emotion Theme Objects (`src/styles/colors.ts`)**:
   - Update `editorLight` and `editorDark` JavaScript hex mappings to match the CSS variables.
3. **Update Tailwind Mappings (`src/styles/globals.css`)**:
   - If a new semantic token was added, declare `--color-<token>: rgb(var(--c-<token>) / 1);` under `@theme inline`.
   - Ensure the `@custom-variant dark` directive remains intact for `[data-theme="dark"]` attribute mapping.
4. **Verify Global-Reset / Dark-Attribute Contract**:
   - Confirm `ThemeProvider` renders the `data-theme={scheme}` wrapper with `style={{ display: "contents" }}` so Tailwind dark variants (`dark:*`) target its descendants without introducing an extra layout box.
   - Verify global CSS resets for `a`, `button`, `input`, etc. in `Global/index.tsx` use non-destructive baselines (`color: inherit`, `text-decoration: none`, `background: none`) so Tailwind utility overrides (`hover:text-signal`, `bg-card`, `border-hairline`, etc.) remain uncorrupted.
5. **Update Structural Dimensions (`src/styles/variables.ts`)**:
   - If chrome height/width or breakpoints change, update `variables.ts`.
6. **Component Implementation Verification**:
   - Ensure JSX components use Tailwind utilities (`bg-card`, `border-hairline`, `text-strong`, `text-signal`).
   - Verify both **Light Mode** and **Dark Mode** rendering across all active components (`HomeHero`, `RecentPostsCompact`, `FeaturedSeriesGrid`, `TagCloud`, `PostDetail`, `Frontmatter`, `NotionRenderer`, `StatusBar`).
