"""Zdroj nabídek: Softreal.

STAV: kostra. Formát exportu ze Softrealu (API / XML) zatím není znám, proto `parse()` záměrně
končí chybou, dokud se nedoplní podle skutečné dokumentace nebo vzorku (viz docs/SOFTREAL.md).
Vše ostatní (stažení, kontrola, ochrana před prázdným exportem, normalizace) je hotové.

Výstup `load()` je seznam nabídek v jednotném tvaru, který používá build.py:
  id, title, type, disposition, city, district, area_m2, floor, rent_czk, fees_czk, deposit_czk,
  available_from (YYYY-MM-DD), furnished (ano|castecne|ne), energy_class, description,
  features [str], photos [url | {url, alt}], contact_name, contact_phone (obojí volitelné),
  published_at, updated_at (ISO)
"""
import os, re, unicodedata, urllib.request

REQUIRED = ("id", "title", "type", "city", "rent_czk")


class FeedError(Exception):
    """Export nejde stáhnout nebo zpracovat. Build se má zastavit a ponechat předchozí verzi webu."""


def slugify(t):
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def fetch_raw():
    url = os.environ.get("SOFTREAL_FEED_URL", "").strip()
    if not url.startswith("https://"):
        raise FeedError("SOFTREAL_FEED_URL musí být nastavená a začínat https://")
    headers = {"User-Agent": "pronajmy-zapad-build/1.0"}
    token = os.environ.get("SOFTREAL_TOKEN", "").strip()
    if token:
        headers["Authorization"] = "Bearer " + token  # TODO: způsob ověření podle dokumentace Softrealu
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as r:
            return r.read()
    except Exception as e:  # síť, HTTP chyba, timeout
        raise FeedError(f"Stažení exportu selhalo: {e}")


def parse(raw):
    """TODO: převést export Softrealu (bytes) na seznam slovníků v tvaru výše."""
    raise NotImplementedError("Formát exportu Softrealu zatím není implementován, viz docs/SOFTREAL.md")


def _photo(p):
    p = p if isinstance(p, dict) else {"url": p}
    u = str(p.get("url") or "").strip()
    return {"url": u, "alt": p.get("alt") or ""} if u.startswith("https://") else None


def normalize(items):
    """Zahodí nepoužitelné záznamy (s varováním), ověří typy, sestaví slug z názvu a ID."""
    out, seen = [], set()
    for it in items:
        miss = [k for k in REQUIRED if not it.get(k)]
        try:
            rent = int(it.get("rent_czk") or 0)
        except (TypeError, ValueError):
            rent = 0
        if miss or rent <= 0 or str(it["id"]) in seen:
            print(f"VAROVÁNÍ: záznam {it.get('id')!r} přeskočen (chybí: {miss or 'nájemné'})")
            continue
        seen.add(str(it["id"]))
        l = dict(it)
        l["id"], l["rent_czk"] = str(it["id"]), rent
        l["slug"] = f"{slugify(l['title'])[:60].strip('-')}-{slugify(l['id'])}".strip("-")
        l["photos"] = [p for p in map(_photo, it.get("photos") or []) if p]
        l["features"] = [str(f) for f in (it.get("features") or [])]
        out.append(l)
    return sorted(out, key=lambda l: l.get("published_at") or "", reverse=True)


def load(allow_empty=False):
    listings = normalize(parse(fetch_raw()))
    if not listings and not allow_empty:
        raise FeedError("Export vrátil 0 použitelných nabídek. Build se zastavuje, aby web nezůstal prázdný "
                        "kvůli chybě exportu. Pokud je to záměr, nastavte ALLOW_EMPTY=1.")
    return listings
