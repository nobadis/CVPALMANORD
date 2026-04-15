#!/usr/bin/env python3
import hashlib
import os
import re
import shutil
import sys
from collections import deque
from pathlib import Path
from urllib.parse import urljoin, urlparse, urldefrag

import requests
from bs4 import BeautifulSoup


START_URL = "https://cvpalmanord.es/"
OUTPUT_DIR = Path("site")
MAX_PAGES = 200
TIMEOUT = 20


def is_same_domain(url: str, base_netloc: str) -> bool:
    parsed = urlparse(url)
    return parsed.netloc in ("", base_netloc)


def clean_url(url: str) -> str:
    return urldefrag(url)[0]


def should_crawl_page(url: str, base_netloc: str) -> bool:
    parsed = urlparse(url)
    if parsed.netloc not in ("", base_netloc):
        return False
    if parsed.query:
        return False

    path = parsed.path.lower()
    blocked_prefixes = (
        "/wp-json",
        "/feed",
        "/comments",
        "/xmlrpc.php",
        "/wp-admin",
        "/wp-login.php",
    )
    blocked_suffixes = (".xml", ".php")

    if any(path.startswith(prefix) for prefix in blocked_prefixes):
        return False
    if path.endswith(blocked_suffixes):
        return False
    return True


def url_to_output_path(url: str) -> Path:
    parsed = urlparse(url)
    path = parsed.path or "/"

    if path.endswith("/"):
        return OUTPUT_DIR / path.lstrip("/") / "index.html"

    if not os.path.splitext(path)[1]:
        return OUTPUT_DIR / path.lstrip("/") / "index.html"

    return OUTPUT_DIR / path.lstrip("/")


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def safe_asset_filename(url: str) -> str:
    parsed = urlparse(url)
    name = os.path.basename(parsed.path)
    if not name:
        name = "asset"
    if parsed.query:
        digest = hashlib.md5(parsed.query.encode("utf-8")).hexdigest()[:8]
        root, ext = os.path.splitext(name)
        name = f"{root}.{digest}{ext}"
    return name


def asset_output_path(url: str) -> Path:
    parsed = urlparse(url)
    path = parsed.path
    if not path or path.endswith("/"):
        name = safe_asset_filename(url)
        return OUTPUT_DIR / "assets" / name

    rel = path.lstrip("/")
    if parsed.query:
        folder = os.path.dirname(rel)
        name = safe_asset_filename(url)
        return OUTPUT_DIR / folder / name
    return OUTPUT_DIR / rel


def should_download_asset(url: str) -> bool:
    parsed = urlparse(url)
    path = parsed.path.lower()
    return any(
        path.endswith(ext)
        for ext in (
            ".css",
            ".js",
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".svg",
            ".webp",
            ".ico",
            ".woff",
            ".woff2",
            ".ttf",
            ".eot",
            ".mp4",
            ".webm",
            ".pdf",
        )
    )


def rewrite_and_collect(html: str, page_url: str, base_netloc: str):
    soup = BeautifulSoup(html, "html.parser")
    page_assets = set()
    page_links = set()

    attr_map = {
        "a": ["href"],
        "link": ["href"],
        "script": ["src"],
        "img": ["src", "srcset"],
        "source": ["src", "srcset"],
        "video": ["src", "poster"],
    }

    for tag, attrs in attr_map.items():
        for node in soup.find_all(tag):
            for attr in attrs:
                value = node.get(attr)
                if not value:
                    continue

                if attr == "srcset":
                    parts = []
                    for entry in value.split(","):
                        bits = entry.strip().split()
                        if not bits:
                            continue
                        raw = bits[0]
                        abs_url = clean_url(urljoin(page_url, raw))
                        new_url = raw
                        if is_same_domain(abs_url, base_netloc):
                            if should_download_asset(abs_url):
                                page_assets.add(abs_url)
                                new_url = "/" + str(asset_output_path(abs_url).relative_to(OUTPUT_DIR))
                            else:
                                page_links.add(abs_url)
                                new_url = "/" + str(url_to_output_path(abs_url).relative_to(OUTPUT_DIR))
                        rest = " ".join(bits[1:])
                        parts.append(f"{new_url} {rest}".strip())
                    node[attr] = ", ".join(parts)
                    continue

                abs_url = clean_url(urljoin(page_url, value))
                if not is_same_domain(abs_url, base_netloc):
                    continue

                if tag == "a" and not should_download_asset(abs_url):
                    page_links.add(abs_url)
                    node[attr] = "/" + str(url_to_output_path(abs_url).relative_to(OUTPUT_DIR))
                else:
                    if should_download_asset(abs_url):
                        page_assets.add(abs_url)
                        node[attr] = "/" + str(asset_output_path(abs_url).relative_to(OUTPUT_DIR))
                    else:
                        page_links.add(abs_url)
                        node[attr] = "/" + str(url_to_output_path(abs_url).relative_to(OUTPUT_DIR))

    for node in soup.find_all(style=True):
        style_value = node.get("style", "")
        urls = re.findall(r'url\((.*?)\)', style_value)
        for u in urls:
            clean = u.strip(" '\"")
            abs_url = clean_url(urljoin(page_url, clean))
            if is_same_domain(abs_url, base_netloc) and should_download_asset(abs_url):
                page_assets.add(abs_url)
                local = "/" + str(asset_output_path(abs_url).relative_to(OUTPUT_DIR))
                style_value = style_value.replace(u, f'"{local}"')
        node["style"] = style_value

    return str(soup), page_assets, page_links


def download(url: str, session: requests.Session) -> requests.Response | None:
    try:
        response = session.get(url, timeout=TIMEOUT)
        response.raise_for_status()
        return response
    except Exception as exc:
        print(f"[WARN] {url}: {exc}")
        return None


def main():
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 static-site-cloner"})

    start = clean_url(START_URL)
    netloc = urlparse(start).netloc
    queue = deque([start])
    seen_pages = set()
    seen_assets = set()

    while queue and len(seen_pages) < MAX_PAGES:
        page_url = queue.popleft()
        if page_url in seen_pages:
            continue
        seen_pages.add(page_url)
        print(f"[PAGE] {page_url}")

        response = download(page_url, session)
        if not response:
            continue

        content_type = response.headers.get("Content-Type", "")
        if "text/html" not in content_type and not page_url.endswith((".html", "/")):
            asset_path = asset_output_path(page_url)
            ensure_parent(asset_path)
            asset_path.write_bytes(response.content)
            continue

        rewritten_html, assets, links = rewrite_and_collect(response.text, page_url, netloc)
        output_path = url_to_output_path(page_url)
        ensure_parent(output_path)
        output_path.write_text(rewritten_html, encoding="utf-8")

        for link in links:
            if should_crawl_page(link, netloc) and link not in seen_pages:
                queue.append(link)

        for asset in assets:
            if asset in seen_assets:
                continue
            seen_assets.add(asset)
            print(f"  [ASSET] {asset}")
            resp = download(asset, session)
            if not resp:
                continue
            out = asset_output_path(asset)
            ensure_parent(out)
            out.write_bytes(resp.content)

    print(f"[DONE] Pages: {len(seen_pages)} Assets: {len(seen_assets)}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
