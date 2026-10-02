# maharram.ru GitHub Pages mirror

This folder is a static mirror of the current `https://maharram.ru/` frontend for GitHub Pages.

Included:

- live Next.js HTML for `/` and `/projects/{slug}/`;
- downloaded `_next` CSS/JS/font assets;
- downloaded `/media/uploads/...` project images and videos;
- static API shims under `api/v1/`;
- editable data copies under `data/`;
- `CNAME`, `.nojekyll`, `robots.txt`, `sitemap.xml`.

To refresh the mirror from the live site:

```powershell
python C:\dev\self\portfolio\pages-static\sync-live-mirror.py
```

Upload the contents of this folder to the repository root for GitHub Pages.

## Dental CRM Showcase

The home-page dental project uses `project-previews/dental-crm.js`, a native Web Component with isolated styles, local fonts and fictional sample data. It has no iframe, database calls or external runtime dependencies. The project description and demo URL still come from the existing project data.

The five scenes support automatic playback, manual navigation, order details and local filtering. Playback pauses when the component is outside the viewport or the document is hidden. Reduced-motion users get manual playback by default.

Canonical source assets are in `apps/frontend/public/project-previews/` in the parent portfolio source checkout; the React integration is in `apps/frontend/src/widgets/home-showcase/ui/DentalCrmPreview.tsx`. Keep these assets and this folder's `project-previews/` copy in sync when editing. No local application build is required to edit the preview.

The home-page HTML and its versioned Next.js page chunk contain the matching component mount. Other projects keep their existing gallery. Do not replace these artifacts with an older mirror.

Run the offline integrity checks with Node.js:

```powershell
node scripts/check-dental-preview.cjs
```

## Calls / LLM Showcase

All seven animated project previews share `project-previews/preview-styles.js`.
Shadow-root stylesheets are retained across renders. An inline paint gate keeps
content hidden and unfocusable until every required stylesheet has loaded, with
a bounded loading placeholder and an explicit retry state on network errors.
The loading placeholder uses JS-driven Web Animations for its spinner, dots,
indeterminate progress sweep and skeleton highlights. Animations stop on load,
error, unmount or backgrounding, and respect reduced-motion preferences.
This prevents unstyled, oversized SVG icons on cold loads and project changes.
Animation clocks start only after the styled content is visible.
Keep the shared helper synchronized with the canonical source assets.

Each animated preview starts with its collapsed project description and existing
demo or website link, above the diagrams and animated scenes. The Calls / LLM
preview has the same top description disclosure, without an invented demo link.

```powershell
node scripts/check-preview-styles.cjs
```

The `calls` home-page project uses `project-previews/calls-llm.js`. The animated flow follows the existing project diagram: telephony, LLM speech analysis, API transfer and an Arbis customer profile. Six analysis fields appear progressively before the new call is saved in the sample card. Three fictional conversations, stage selection, history, pause and replay are available locally without network calls or persistent writes.

The source assets and React wrapper follow the same locations as the dental preview, named `calls-*` and `CallsLlmPreview.tsx`. The project description and Python/PHP stack are unchanged. Existing galleries and the dental preview are preserved.

```powershell
node scripts/check-calls-preview.cjs
```

## Work Schedule / CRM Showcase

The `work-schedule-crm` project uses the native `shifts-crm-preview` component. It recreates six screenshot views: crew schedule, employee directory, site search, vacations, yearly archive and activity log. Tabs, crew selection, filtering, personal employee access, sample leave and CSV exports work with fictional local data. Playback pauses offscreen, in hidden tabs and for reduced-motion preferences.

The demo link is `https://shifts.maharram.ru/`. Source assets are in `apps/frontend/public/project-previews/shifts-*` with `ShiftsCrmPreview.tsx` as the React wrapper. Existing project galleries are retained on the project detail page. No application build is required for this static update.

```powershell
node scripts/check-shifts-preview.cjs
```

## Eicom / Radio Components Showcase

The `radio-components` project uses `eicom-shop-preview`. Nine connected feature tabs select animated explanations on hover, focus or tap: product 360, reward points, delivery, partner APIs, query optimization, bug fixes, CRM synchronization, an AI assistant and the customer account. Playback loops the selected feature and pauses offscreen or in a hidden document; reduced-motion users get completed diagrams and manual playback.

The 360 viewer uses 24 distinct photographs from `https://eicom.ru/product/D2D-1000/`, stored locally in `project-previews/eicom-assets/spin-d2d-1000/`. It supports automatic rotation, pointer dragging, an angle slider and step controls. No external viewer, iframe or runtime request is required. The assistant demonstrates product selection, specification questions, checkout guidance and order status with fictional local conversations. No AI call or order submission takes place.

The previous whole-site page tour is replaced with focused improvement diagrams, following the TM Electronics showcase. The account is one compact preview of orders, reward points, promo codes and BOM matching, not a separate navigation system. Keep `eicom-shop.js`, `eicom-shop.css`, `eicom-improvements.js` and `eicom-improvements.css` synchronized with `apps/frontend/public/project-previews/`. No application build is required.

```powershell
node scripts/check-eicom-preview.cjs
```

## Furniture / 1C Support Showcase

The `furniture` project uses `furniture-1c-preview`. Five connected task blocks
select animated explanations on hover, keyboard focus or tap: exchange with
the Bitrix store, Google Sheets, order-closing automation, a delivery service
and Yandex Maps inside 1C. The project describes support for the client's
existing system, not development from scratch.

Scenes use fictional local orders, a schematic map and the existing furniture
store screenshot. No real orders, maps, delivery or exchange APIs are called.
The description disclosure and "Visit website" link to `https://imodern.ru/`
remain above the task map. The website URL is editable through `live_url` in project JSON.
Playback pauses offscreen and in hidden tabs, and respects reduced motion.

Keep `furniture-1c.js`, `furniture-1c.css` and `furniture-host.css` synchronized
with `apps/frontend/public/project-previews/`. The source React wrapper is
`Furniture1cPreview.tsx`. No local application build is needed.

```powershell
node scripts/check-furniture-preview.cjs
```

## Paints / 1C Support Showcase

The `paints` project reuses the five-task 1C support component with
`project="paints"`. Its header, store screenshot, product catalog, sample orders
and delivery contents belong to the paint retailer; the furniture profile is
unchanged. Hover, focus or tap selects the detailed animated explanation below.
The work covers Bitrix, Google Sheets, order-closing automation, delivery and
Yandex Maps. No live API requests or database writes are made.

The versioned shared module (`furniture-1c.js?v=6`) prevents the new mount from
using a cached furniture-only implementation. The description disclosure stays
at the top alongside a "Visit website" link to `https://vertical.ru/`.
`check-furniture-preview.cjs` validates both
project profiles and the corresponding static data.

## Shared Diagram Heading

All seven web-project previews display "What was delivered" ("Что было сделано")
above their task blocks. `project-diagram.js` and `project-diagram.css` render
the shared distribution line and downward arrows, matching each preview's
palette, column count and responsive breakpoints. Project actions and description
disclosures remain above it; the existing lower connectors are unchanged.
The shared stylesheet participates in the preview's loading gate.

Preview module URLs are versioned to avoid cached versions without the shared controls.
Keep both shared assets and all preview modules synchronized with the canonical
frontend public directory. Run `node scripts/check-diagram-preview.cjs` alongside
the existing checks. No local application build is required.

The description disclosure uses one shared summary, with a left-hand chevron
that rotates when opened. Furniture and Paints no longer display the separate
support label. TM Electronics, Furniture and Paints apply their backgrounds to
the enclosing full-width project section, not just its inner article.
