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
