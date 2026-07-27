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
