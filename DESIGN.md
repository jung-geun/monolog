# Monolog Design System

Monolog is a read-only publishing workspace modeled on VS Code. It uses authentic theme roles and file icons without pretending to be a terminal, Git client, or remote SSH session. The document remains the primary content; editor controls must perform real blog actions.

## Color themes

The theme catalog in `src/styles/colors.ts` is the source of truth for exact colors, upstream references, and license notices.

| Preference | Appearance |
| --- | --- |
| `one-dark-pro-mix` | One Dark Pro Mix; initial operator default |
| `dark-modern` | VS Code Dark Modern |
| `light-modern` | VS Code Light Modern |
| `system` | Dark Modern or Light Modern, following the device live |

`CONFIG.blog.theme` selects the operator default. A valid visitor preference in `monolog.colorTheme` overrides it. Invalid defaults fall back to Mix; unavailable local storage does not prevent switching for the current visit. The old binary `scheme` cookie is not a preference source.

`_document.tsx` emits the catalog CSS and an early bootstrap before application rendering. Only the HTML root owns `data-color-theme`, `data-theme` (dark/light compatibility), and `data-theme-preference`. Never add stale server-rendered theme attributes to descendant wrappers. `useColorTheme()` subscribes to visitor, storage, and system changes; `useScheme()` is derived, read-only compatibility for binary third-party renderers.

### Token contracts

| Consumer | Contract |
| --- | --- |
| Emotion / CSS | `theme.colors.editor.*` references `--editor-*` CSS variables |
| Canvas / Three.js | `theme.colorTheme.editor.*` supplies real hex colors, not `var(...)` |
| Tailwind | `--c-*` RGB tuples feed semantic utilities through `@theme inline` |
| Prism / Markdown | `--syntax-*` follows the selected named theme |
| Notion renderer | Shared `--fg-color`, `--bg-color`, and `--theme-colors-*` |

`editor.bg` is the document/editor canvas; `editor.bg2` is chrome/sidebar; `editor.bg3` is an elevated/hover surface. `--c-card` maps to the editor and `--c-chrome` to chrome. Keep borders, active tabs, selections, inputs, syntax, and diagrams in the same named theme. Do not branch on dark/light to hard-code a second surface palette.

## Typography and icons

- `--font-ui`: native sans UI stack for title bar, activity controls, Explorer, tabs, settings, lists, and Quick Pick. Compact 11–13px control text.
- `--font-sans`: Pretendard reading text and article titles. Article text remains 15–16px with generous line height; it is not a monospaced source editor.
- `--font-mono`: JetBrains Mono for code, real source line numbers, frontmatter, and technical metadata.
- `WorkbenchIcon` uses the existing `react-icons/vsc` Codicons for operations and custom editors.
- `FileIcon` uses an unmodified subset of Material Icon Theme 5.39.0. SVGs and MIT attribution live under `public/icons/material/`.
- No Unicode approximations for file/control icons. Content-authored emoji and Notion colors remain content, not chrome decoration.

## Workspace structure

`RootLayout` supplies the theme. `EditorShell` composes `RouteChromeProvider` and `WorkbenchProvider`, then the shell, Settings, and Quick Pick inside those contexts.

| Region | Behavior |
| --- | --- |
| Title bar | Browser history, Command Center, real layout/settings controls |
| Activity bar | Switches Explorer / Search / Knowledge without replacing the document |
| Primary sidebar | Independently scrollable; resizable from 180–420px using pointer or keyboard |
| Explorer | Open Editors, recent/open posts, categories, nested series, configured projects, public files |
| Editor tabs | Active state, transient italic preview, pin, close/reopen, reorder, touch-friendly actions |
| Document toolbar | Breadcrumbs, Preview / Source / Split, reading mode, Outline/panel toggles, Markdown actions |
| Secondary sidebar | Collapsible Outline and Series using real document anchors |
| Bottom panel | References and Comments; no fake Problems, Output, or terminal console |
| Status bar | Document kind, view/reading position, actual local-tab-storage state; no fake branch, SSH, IP, or sync claims |

Desktop (>960px) fixes the shell to the viewport. `.page-content` is the primary document scroller; split mode uses independent preview/source roots. `getReadingScrollRoot()` coordinates progress, outline, Top, and history restoration. Chrome and sidebars must not scroll with the article. Return navigation restores the stored document position; anchor navigation targets the real Notion block ID.

Mobile (≤960px) uses natural window scrolling and a primary drawer closed on initial load. Do not force a desktop-sized canvas or nested article scroll box onto a phone. Split mode uses Preview/Source pane buttons. Heading Quick Pick switches to visible Preview before jumping when source would hide the target. Outline/Series and the bottom panel become natural document sections. Lists use `minmax(0, 1fr)` and shrinkable text to avoid long-title overflow.

## Tabs and storage

- Explorer single click opens/replaces one transient preview; double click or **Keep open** pins it. Ordinary article navigation is permanent.
- Only pinned tabs and the closed-post list are persisted after affirmative consent. Never persist a preview, article body, or search history through the tab-storage feature.
- Welcome retains the stable `readme` identity; saved legacy `README.md` labels can be restored.
- Reordering never navigates. Modified link clicks retain browser behavior. `Alt/Option+W` and `Alt/Option+Shift+T` are app shortcuts; browser `Cmd/Ctrl+W` and `Cmd/Ctrl+Shift+T` are not intercepted.
- Storage denial/revocation must leave the in-memory session and reading available. Theme preference is separate from tab-history consent.

## Document design

The first response contains the actual SSR article. Do not make preview rendering depend on client editor loading.

- Compact breadcrumbs precede the title. Frontmatter is collapsed by default; the title and summary precede a reduced cover.
- Preview uses the existing Notion renderer and code-copy behavior. Source lazily fetches the actual `/{slug}.md` export, highlights it read-only, and displays actual line numbers.
- Source requests cancel on unmount/route changes. Errors remain visible with Retry and the original export link; never substitute a fabricated source.
- Split synchronization aligns matching heading text only. Exported Markdown is explicitly not an exact Notion block-to-line map.
- Reading mode hides primary/secondary sidebars and the panel without changing the route.
- References distinguish direct links/mentions, same-category articles, and AI-inferred similarity. Missing data is not an invented relationship.
- Comments mount lazily and remain mounted after first opening while panel tabs are switched. Changing the document resets the panel content.
- About uses the same document workspace and retains its activity, contribution, technology, and contact widgets in collapsible sections.

## Welcome, Search, and knowledge

Welcome is a compact Start / Recent / Series surface with real publication data, not a marketing hero. Graph and Ontology are custom editors rather than fake Markdown files.

Quick Pick opens with `Cmd/Ctrl+K`; `Cmd/Ctrl+Shift+P` starts command mode. `>` filters real commands, including individual named themes. `@` searches the current document's actual headings. Default search finds files, tags, and categories. Arrows/Enter/Escape work; focus returns to the opener. The surrounding page is not blurred.

Search Sidebar and the shareable `/search?q=...` Search Editor share the same matcher. Supported fields are title, summary, tags, and category, including `tag:"kolla ansible"` and `category:"Computer Science"`. Do not label summary matching as full-body search. Keyboard arrows focus real result links; Enter opens, Escape clears/exits. Sort multilingual server-rendered lists with an explicit locale.

Graph retains actual topology, 3D interaction, layer controls, and configured embedding search. Ontology shows loading separately from unavailable or empty data, with a link to the knowledge graph rather than a backend command.

## Surfaces, motion, and accessibility

- Flat 1px boundaries and role-based surfaces; no gradients, ambient glow, or decorative card rails. Modest shadows are reserved for floating menus/dialogs/drawers, not every content row.
- Small radii on controls/Quick Pick; no dashboard-style oversized cards around articles.
- Keep visible keyboard focus, named icon buttons, actual checked/pressed/selected states, native checkbox geometry, dialog focus containment, and a skip-to-document link.
- Source line numbers are not implied preview line numbers. Do not add a minimap that cannot map to the actual document.
- Keep existing content visible during routing. Entry motion is skipped for history, anchors, and revisited documents. `prefers-reduced-motion` disables decorative movement and uses immediate heading navigation.
- Notion author colors are scoped to content; they must not override workspace theme roles.

## Advertising boundary

The only manual display slot is `googleAdsense.config.slots.postBottom`, after article content. Empty IDs render nothing. Do not put ad slots in the activity bar, tabs, Explorer, Outline, or panel controls.

AdSense Auto ads are account-controlled and cannot be made workspace-safe by an undocumented attribute or CSS removal of served ads. Operators must review Excluded areas for in-page placements and overlay formats separately in AdSense. The source does not guarantee or claim to have applied those account settings. See `docs/USAGE.md`.

## Change verification

For theme/layout work, exercise the real application at desktop and mobile widths: named themes and reload, System changes, no hydration mismatch, keyboard search, preview→pin→reorder/close/reopen, consent revocation, article/source/split, anchor/history scroll, panel switching, and graph geometry. Tests protect state and parsing boundaries; they do not replace visual browser proof.
