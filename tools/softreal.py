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


MAPPING_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "softreal_mapping.json")


def _xml_to_obj(el):
    """XML element -> dict/str. Opakující se značky se stanou seznamem, atributy mají předponu @."""
    kids = list(el)
    if not kids and not el.attrib:
        return (el.text or "").strip()
    d = {"@" + k: v for k, v in el.attrib.items()}
    for k in kids:
        tag = k.tag.split("}")[-1]
        v = _xml_to_obj(k)
        if tag in d:
            if not isinstance(d[tag], list):
                d[tag] = [d[tag]]
            d[tag].append(v)
        else:
            d[tag] = v
    txt = (el.text or "").strip()
    if txt and not kids:
        d["#text"] = txt
    return d


def _get(obj, path):
    """Hodnota podle cesty s tečkami (a.b.c). Seznam v cestě se prochází a výsledky se spojí. '' = celý objekt."""
    if path in ("", None):
        return obj
    cur = [obj]
    for part in str(path).split("."):
        nxt = []
        for c in cur:
            if isinstance(c, list):
                c = [x for x in c]
                for x in c:
                    if isinstance(x, dict) and part in x:
                        nxt.append(x[part])
            elif isinstance(c, dict) and part in c:
                nxt.append(c[part])
        cur = nxt
        if not cur:
            return None
    flat = []
    for c in cur:
        flat.extend(c if isinstance(c, list) else [c])
    return flat[0] if len(flat) == 1 else flat


def _num(v):
    if v is None or v == "":
        return None
    m = re.sub(r"[^0-9,.\-]", "", str(v).replace(" ", "").replace("\xa0", "")).replace(",", ".")
    try:
        f = float(m)
    except ValueError:
        return None
    return int(f) if f == int(f) else f


def _as_list(v):
    if v is None or v == "":
        return []
    return v if isinstance(v, list) else [v]


def _text(v):
    if isinstance(v, dict):
        v = v.get("#text", "")
    return str(v).strip() if v is not None else ""


def parse(raw, mapping=None):
    """Export Softrealu (JSON nebo XML, bytes) -> seznam nabídek v kanonickém tvaru.

    Co kde v exportu leží určuje soubor tools/softreal_mapping.json (viz docs/SOFTREAL.md):
      items_path          cesta k seznamu nabídek
      filter              {"path": ..., "in": [...]} nebo {"path": ..., "equals": ...}; ponechá jen pronájmy
      fields              kanonické pole -> cesta; číselná pole: "number:cesta"
      value_map           {pole: {"hodnota v exportu": "hodnota na webu"}}
      photos_path, photo_url_key   seznam fotek (řetězce nebo objekty s adresou pod klíčem)
      features_path       seznam vlastností
    """
    if mapping is None:
        if not os.path.exists(MAPPING_FILE):
            raise NotImplementedError("Chybí tools/softreal_mapping.json (formát exportu Softrealu zatím není znám), viz docs/SOFTREAL.md")
        import json
        with open(MAPPING_FILE, encoding="utf-8") as f:
            mapping = json.load(f)
    import json
    head = raw.lstrip()[:1]
    try:
        if head in (b"{", b"["):
            data = json.loads(raw.decode("utf-8-sig"))
        else:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(raw)
            data = {root.tag.split("}")[-1]: _xml_to_obj(root)}
    except Exception as e:
        raise FeedError(f"Export nejde přečíst (ani JSON, ani XML): {e}")
    items = _as_list(_get(data, mapping.get("items_path", "")))
    flt = mapping.get("filter")
    vmap = mapping.get("value_map", {})
    out = []
    for it in items:
        if flt:
            v = _text(_get(it, flt["path"]))
            if "equals" in flt and v != str(flt["equals"]):
                continue
            if "in" in flt and v not in [str(x) for x in flt["in"]]:
                continue
        rec = {}
        for k, path in mapping.get("fields", {}).items():
            numeric = str(path).startswith("number:")
            val = _get(it, path[7:] if numeric else path)
            val = _num(_text(val)) if numeric else _text(val)
            if k in vmap and val in vmap[k]:
                val = vmap[k][val]
            if val not in (None, ""):
                rec[k] = val
        key = mapping.get("photo_url_key", "url")
        photos = []
        for ph in _as_list(_get(it, mapping.get("photos_path", "photos"))):
            photos.append(_text(ph.get(key)) if isinstance(ph, dict) else _text(ph))
        rec["photos"] = [u for u in photos if u]
        rec["features"] = [t for t in map(_text, _as_list(_get(it, mapping.get("features_path", "features")))) if t]
        out.append(rec)
    return out


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
