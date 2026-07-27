import json
import re
import shutil
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

BASE = "https://maharram.ru"
ROOT = Path(r"C:\dev\self\portfolio\pages-static").resolve()
EXPECTED = Path(r"C:\dev\self\portfolio\pages-static").resolve()
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"

if ROOT != EXPECTED or not str(ROOT).lower().endswith("pages-static"):
    raise SystemExit(f"Unsafe output root: {ROOT}")

ROOT.mkdir(parents=True, exist_ok=True)

HEADERS = {"User-Agent": UA, "Accept": "*/*"}
asset_queue: list[str] = []
seen_assets: set[str] = set()
downloaded: set[str] = set()
errors: list[tuple[str, str]] = []
route_html: dict[str, str] = {}


def safe_remove(rel: str) -> None:
    target = (ROOT / rel).resolve()
    if ROOT not in target.parents and target != ROOT:
        raise RuntimeError(f"Unsafe remove target: {target}")
    if target.is_dir():
        shutil.rmtree(target)
    elif target.exists():
        target.unlink()


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.urls: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        for key in ("href", "src", "poster"):
            value = values.get(key)
            if value:
                self.urls.append(value)
        srcset = values.get("srcset")
        if srcset:
            for part in srcset.split(","):
                value = part.strip().split(" ")[0]
                if value:
                    self.urls.append(value)


CSS_URL_RE = re.compile(r"url\(([^)]+)\)")
SRC_RE = re.compile(r"""(?:src|href|poster)=["']((?:/_next/|/media/|/favicon\.svg|/apple-touch-icon\.svg)[^"'<>) ]+)""")
WEBPACK_MAP_RE = re.compile(r"d\.u=function\(t\)\{return\"static/chunks/\"\+t\+\"\.\"\+\(\{(?P<map>.*?)\}\)\[t\]\+\"\.js\"\}", re.S)
WEBPACK_PAIR_RE = re.compile(r"([0-9]+):\"([0-9a-f]{8,})\"")

STATIC_RUNTIME = r'''<script id="static-pages-runtime">
(() => {
  const originalFetch = window.fetch ? window.fetch.bind(window) : null;
  const cache = new Map();
  const offlineMessage = "\u0414\u0435\u043c\u043e-\u0432\u0435\u0440\u0441\u0438\u044f \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0431\u0435\u0437 \u0441\u0435\u0440\u0432\u0435\u0440\u043d\u043e\u0439 \u0431\u0430\u0437\u044b. \u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043d\u0430 vadimmaharram@mail.ru \u0438\u043b\u0438 \u0432 Telegram.";
  function apiUrl(input) {
    try {
      const value = typeof input === "string" ? input : input.url;
      const parsed = new URL(value, window.location.href);
      return parsed.origin === window.location.origin && parsed.pathname.startsWith("/api/v1/") ? parsed : null;
    } catch {
      return null;
    }
  }
  function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
  async function loadJson(path) {
    if (!originalFetch) throw new Error("Fetch unavailable");
    if (!cache.has(path)) {
      cache.set(path, originalFetch(path, { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error(`Static data ${path} failed`);
        return response.json();
      }));
    }
    return cache.get(path);
  }
  if (originalFetch) {
    window.fetch = async (input, init = {}) => {
      const parsed = apiUrl(input);
      if (!parsed) return originalFetch(input, init);
      const method = String(init.method || (typeof input === "object" && input.method) || "GET").toUpperCase();
      if (method !== "GET" && parsed.pathname.includes("contact-requests")) return jsonResponse({ ok: true, static: true }, 201);
      if (method !== "GET" && parsed.pathname.includes("stylist-chat")) {
        return jsonResponse({
          session_id: "static-demo",
          message: { id: 0, role: "assistant", content: offlineMessage, created_at: new Date().toISOString(), metadata: {} },
          context: null,
          generation_job: null
        });
      }
      if (parsed.pathname === "/api/v1/site-settings/" || parsed.pathname === "/api/v1/site-settings") {
        return jsonResponse(await loadJson("/data/live-site-settings.json"));
      }
      if (parsed.pathname === "/api/v1/projects/" || parsed.pathname === "/api/v1/projects") {
        let projects = await loadJson("/data/live-projects.json");
        if (parsed.searchParams.get("featured_only") === "true") {
          projects = projects.filter((project) => project.is_featured && project.is_published !== false);
        }
        return jsonResponse(projects);
      }
      const projectMatch = parsed.pathname.match(/^\/api\/v1\/projects\/([^/]+)\/?$/);
      if (projectMatch) {
        const slug = decodeURIComponent(projectMatch[1]);
        const projects = await loadJson("/data/live-projects.json");
        const project = projects.find((item) => item.slug === slug);
        return project ? jsonResponse(project) : jsonResponse({ detail: "Not found" }, 404);
      }
      if (parsed.pathname === "/api/v1/reviews/" || parsed.pathname === "/api/v1/reviews") {
        const reviews = await loadJson("/data/live-reviews.json");
        const offset = Math.max(0, Number.parseInt(parsed.searchParams.get("offset") || "0", 10) || 0);
        const limit = Math.max(1, Number.parseInt(parsed.searchParams.get("limit") || "3", 10) || 3);
        return jsonResponse({ items: reviews.slice(offset, offset + limit), total: reviews.length, offset, limit });
      }
      return originalFetch(input, init);
    };
  }
  document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    const href = anchor.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    let parsed;
    try { parsed = new URL(href, window.location.href); } catch { return; }
    if (parsed.origin !== window.location.origin) return;
    if (parsed.pathname === window.location.pathname && parsed.hash) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(parsed.pathname + parsed.search + parsed.hash);
  }, true);
})();
</script>'''


def request_bytes(url: str, tries: int = 2) -> tuple[bytes, str]:
    last: Exception | None = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as response:
                return response.read(), response.headers.get_content_type()
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(0.4 * (attempt + 1))
    raise RuntimeError(str(last))


def absolute_url(value: str, base: str = BASE + "/") -> str:
    return urllib.parse.urljoin(base, value)


def is_local_asset(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme and parsed.netloc and parsed.netloc != "maharram.ru":
        return False
    path = parsed.path
    if any(marker in path for marker in ("+", ",", ".concat", "%23", "\"", "'")):
        return False
    if path.startswith("/_next/static/chunks/") and not path.endswith(".js"):
        return False
    return path.startswith("/_next/") or path.startswith("/media/") or path in ("/favicon.svg", "/apple-touch-icon.svg")


def relative_path(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    path = urllib.parse.unquote(parsed.path)
    return path.lstrip("/") or "index.html"


def write_file(rel: str, data: bytes) -> None:
    target = (ROOT / rel).resolve()
    if ROOT not in target.parents and target != ROOT:
        raise RuntimeError(f"Unsafe target: {target}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)


def enqueue(url: str, source: str | None = None) -> None:
    full = absolute_url(url, source or BASE + "/")
    parsed = urllib.parse.urlparse(full)
    clean = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))
    if is_local_asset(clean) and clean not in seen_assets:
        seen_assets.add(clean)
        asset_queue.append(clean)


def parse_refs(text: str, source_url: str, content_type: str) -> None:
    refs: set[str] = set()
    if content_type == "text/html" or "<html" in text[:500].lower():
        parser = LinkParser()
        parser.feed(text)
        refs.update(parser.urls)
        refs.update(match.group(1) for match in SRC_RE.finditer(text))
    if content_type in ("text/css", "application/javascript", "text/javascript") or source_url.endswith((".css", ".js")):
        for match in CSS_URL_RE.finditer(text):
            raw = match.group(1).strip().strip("\"'")
            if raw and not raw.startswith(("data:", "#")):
                refs.add(raw)
    if source_url.endswith(".js") and "/webpack-" in source_url:
        webpack_match = WEBPACK_MAP_RE.search(text)
        if webpack_match:
            for chunk_id, chunk_hash in WEBPACK_PAIR_RE.findall(webpack_match.group("map")):
                refs.add(f"/_next/static/chunks/{chunk_id}.{chunk_hash}.js")
    for ref in refs:
        enqueue(ref, source_url)


def inject_runtime(html: str) -> str:
    if 'id="static-pages-runtime"' in html:
        html = re.sub(r'<script id="static-pages-runtime">.*?</script>', "", html, flags=re.S)
    if "</body>" in html:
        return html.replace("</body>", STATIC_RUNTIME + "</body>", 1)
    return html + STATIC_RUNTIME


def fetch_json(path: str):
    data, _ = request_bytes(BASE + path, tries=3)
    return json.loads(data.decode("utf-8"))


def dump_json(rel: str, payload) -> None:
    write_file(rel, json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"))


def queue_project_media(project: dict) -> None:
    for key in ("cover_image", "preview_video_url"):
        value = project.get(key)
        if isinstance(value, str) and value:
            enqueue(value)
    for item in project.get("media_items") or []:
        value = item.get("url")
        if isinstance(value, str) and value:
            enqueue(value)


def main() -> None:
    for rel in (
        "_next",
        "media",
        "projects",
        "api",
        "assets",
        "data",
        "index.html",
        "404.html",
        "project.html",
        "robots.txt",
        "sitemap.xml",
        "update-from-live.py",
    ):
        safe_remove(rel)

    settings = fetch_json("/api/v1/site-settings/")
    projects = fetch_json("/api/v1/projects/?featured_only=true")
    reviews_page = fetch_json("/api/v1/reviews/?offset=0&limit=100")
    reviews = reviews_page.get("items", reviews_page if isinstance(reviews_page, list) else [])

    for project in projects:
        queue_project_media(project)

    routes = [("/", "index.html")]
    for project in projects:
        slug = project.get("slug")
        if slug:
            routes.append((f"/projects/{urllib.parse.quote(slug)}/", f"projects/{slug}/index.html"))

    for path, rel in routes:
        url = BASE + path
        data, _ = request_bytes(url, tries=3)
        html = inject_runtime(data.decode("utf-8"))
        route_html[path] = html
        write_file(rel, html.encode("utf-8"))
        parse_refs(html, url, "text/html")

    dump_json("data/live-site-settings.json", settings)
    dump_json("data/live-projects.json", projects)
    dump_json("data/live-reviews.json", reviews)
    dump_json("data/site-settings.json", settings)
    dump_json("data/projects.json", projects)
    dump_json("data/reviews.json", reviews)
    dump_json("api/v1/site-settings/index.html", settings)
    dump_json("api/v1/projects/index.html", projects)
    dump_json("api/v1/reviews/index.html", {"items": reviews[:3], "total": len(reviews), "offset": 0, "limit": 3})
    for project in projects:
        slug = project.get("slug")
        if slug:
            dump_json(f"api/v1/projects/{slug}/index.html", project)

    while asset_queue:
        url = asset_queue.pop(0)
        if url in downloaded:
            continue
        downloaded.add(url)
        try:
            data, content_type = request_bytes(url)
            rel = relative_path(url)
            write_file(rel, data)
            if content_type in ("text/css", "application/javascript", "text/javascript") or rel.endswith((".css", ".js")):
                parse_refs(data.decode("utf-8", "replace"), url, content_type)
        except Exception as exc:  # noqa: BLE001
            errors.append((url, str(exc)))

    write_file(".nojekyll", b"")
    write_file("CNAME", b"maharram.ru\n")
    write_file("robots.txt", b"User-agent: *\nAllow: /\nSitemap: https://maharram.ru/sitemap.xml\n")
    sitemap_urls = ["https://maharram.ru/"] + [
        f"https://maharram.ru/projects/{project['slug']}/" for project in projects if project.get("slug")
    ]
    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{url}</loc></url>\n" for url in sitemap_urls)
        + "</urlset>\n"
    )
    write_file("sitemap.xml", sitemap.encode("utf-8"))
    write_file("404.html", route_html["/"].encode("utf-8"))

    print(json.dumps({
        "routes": len(routes),
        "projects": len(projects),
        "reviews": len(reviews),
        "assets": len(downloaded),
        "errors": errors[:20],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
