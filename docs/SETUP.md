# Nasazení

Web je statický. `tools/build.py` při každém buildu stáhne nabídky ze Softrealu a vygeneruje stránky do `dist/`.
Zdroje: `static/` (CSS, JS, obrázky), `data/references.json` (Realizované obchody), `tools/` (generátor).

## Vercel
1. Importujte repozitář jako nový projekt. Nastavení načte `vercel.json` (framework žádný, build `python3 tools/build.py`, výstup `dist`).
2. **Settings → Environment Variables:**
   - `SOFTREAL_FEED_URL`, `SOFTREAL_TOKEN` (až budou známé, viz `docs/SOFTREAL.md`),
   - `ALLOW_EMPTY=1` jen pokud je prázdný seznam nabídek záměr.
3. **Settings → Git → Deploy Hooks → Create Hook** (větev, ze které se staví): URL se použije v Make pro pravidelné přegenerování (viz `docs/MAKE.md`).
4. **Production Branch:** nastavte větev, ze které má běžet ostrý web. Ostatní větve dostanou náhledovou adresu (preview).
5. V `tools/build.py` nastavte `DOMAIN` (skutečná doména) a `FORM_ENDPOINT` (adresa webhooku v Make).
6. **Plán:** bezplatný plán Hobby je podle podmínek Vercelu jen pro nekomerční použití. Web klienta patří na plán Pro, nebo na účet klienta.

Při selhání buildu (nedostupný Softreal, prázdný export) zůstává nasazená předchozí funkční verze.

## Přepnutí na Netlify (později, kdyby bylo potřeba)
Web je hostingově neutrální: výstup je statický adresář `dist/` a build je `python3 tools/build.py`.
1. Importujte repozitář do Netlify, nastavení načte `netlify.toml` (je připravený).
2. Zkopírujte proměnné prostředí z Vercelu a vytvořte **Build hook**. URL vyměňte v Make místo Vercel Deploy Hooku.
3. Serverovou funkci pro nahrávání fotek (až bude hotová) je potřeba přesunout do `netlify/functions/`. Logika je ve sdíleném modulu, mění se jen tenký adaptér, proto se při psaní funkce drží tato struktura.
4. Přepište DNS na Netlify a odpojte doménu ve Vercelu.

## Realizované obchody
Upravte `data/references.json` (až 6 položek), fotky dejte do `static/references/`:
```json
[{"city": "Karlovy Vary", "type": "Byt", "disposition": "2+kk", "text": "Krátký popis", "rented": "září 2026", "photo": "kv-2kk.jpg", "alt": "Obývací pokoj"}]
```
Sekce se na webu zobrazí, jakmile je v souboru aspoň jedna položka.

## Lokální náhled
```
USE_SAMPLE=1 python3 tools/build.py      # ukázkové nabídky a reference
python3 -m http.server -d dist 8000
```

## Co teprve přijde
Formulář majitele s fotkami a administrace podkladů (Supabase, neveřejné úložiště, serverová funkce na Vercelu, stavy, mazání po 90 dnech).
