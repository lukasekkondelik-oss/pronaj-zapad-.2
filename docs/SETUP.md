# Nasazení

Web je statický. `tools/build.py` při každém buildu stáhne nabídky ze Softrealu a vygeneruje stránky do `dist/`.
Zdroje: `static/` (CSS, JS, obrázky), `data/references.json` (Realizované obchody), `tools/` (generátor).

## Netlify
1. Importujte repozitář. Nastavení načte `netlify.toml` (build `python3 tools/build.py`, publish `dist`, Python 3.11).
2. **Environment variables:**
   - `SOFTREAL_FEED_URL`, `SOFTREAL_TOKEN` (až budou známé, viz `docs/SOFTREAL.md`),
   - `ALLOW_EMPTY=1` jen pokud je prázdný seznam nabídek záměr.
3. **Build hooks → Add build hook**: URL se použije v Make pro pravidelné přegenerování (viz `docs/MAKE.md`).
4. V `tools/build.py` nastavte `DOMAIN` (skutečná doména) a `FORM_ENDPOINT` (adresa webhooku v Make).

Vercel funguje obdobně (`vercel.json`, Deploy Hooks). Pozor: kód musí zůstat kompatibilní s Pythonem 3.11.

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
Formulář majitele s fotkami a administrace podkladů (Supabase, neveřejné úložiště, stavy, mazání po 90 dnech).
