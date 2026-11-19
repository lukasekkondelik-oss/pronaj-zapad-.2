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
5. V `tools/build.py` nastavte `DOMAIN` (skutečná doména).
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

## Formulář majitele s fotkami a administrace podkladů

### Jak to funguje
Formulář „Mám zájem“ pod nabídkou jde přes `api/poptavka` (Turnstile, honeypot, časová past, max. 5 odeslání za hodinu z jedné IP, záznamy se mažou po 1 dni). Adresy webhooků Make tak nejsou veřejné a nikdo je nemůže zneužít k rozesílání e-mailů.

Postup u majitele:
1. Majitel vyplní formulář a přidá fotky. V prohlížeči se zmenší na max. 1600 px (JPEG).
2. Funkce `api/podklady.js` (logika v `lib/core.js`) ověří antispam (Cloudflare Turnstile, honeypot, časová past, limit 5 odeslání za hodinu z jedné IP), uloží údaje do Supabase a přijme fotky jednu po druhé (kontroluje, že jde opravdu o JPEG do 2 MB).
3. Po dokončení pošle upozornění do Make (e-mail makléřce s odkazem na podklady, potvrzení majiteli, řádek v Google Sheets). Když Make nefunguje, podklady se uloží stejně a v administraci svítí „e-mail neodešel“.
4. Makléřka podklady zpracuje v `/admin/` (stavy Nová / V řešení / Převzato / Zamítnuto, poznámka, stažení fotek v ZIP).
5. Denní cron `api/cleanup.js` maže: nedokončené po 1 dni, Nová, V řešení a Převzato po 90 dnech, Zamítnuto po 30 dnech od poslední změny stavu. Lhůty jsou v `RETENTION_DAYS` v `lib/core.js` (a pro zobrazení v `static/admin/admin.js`).

### Nastavení Supabase (jednorázově)
1. Projekt v regionu EU. V **SQL Editoru** spusťte celý `supabase/schema.sql`.
2. **Authentication → Providers → Email**: vypněte *Allow new users to sign up*.
3. **Authentication → Users → Add user**: účty pro makléřku a pro vás (e-mail + heslo, Auto Confirm).
4. **Project Settings → API**: `Project URL`, `anon public` klíč a `service_role` klíč.
   **`service_role` klíč patří jen do proměnných prostředí na serveru, nikdy do kódu ani do prohlížeče.**

### Cloudflare Turnstile
Dashboard → Turnstile → Add site (doména webu). Získáte *Site Key* (veřejný) a *Secret Key*.

### Proměnné prostředí (Vercel → Settings → Environment Variables)
| Proměnná | Kde se používá | Poznámka |
|---|---|---|
| `SUPABASE_URL` | build + funkce | adresa projektu |
| `SUPABASE_ANON_KEY` | build (administrace) | veřejný klíč |
| `SUPABASE_SERVICE_KEY` | jen funkce | **tajný** |
| `TURNSTILE_SITE_KEY` | build (formulář) | veřejný |
| `TURNSTILE_SECRET` | jen funkce | tajný, bez něj funkce odmítne vše |
| `MAKE_WEBHOOK_URL` | jen funkce | webhook scénáře **B** (podklady od majitele) |
| `MAKE_WEBHOOK_URL_ZAJEMCE` | jen funkce | webhook scénáře **A** (Mám zájem), volá ho `api/poptavka` |
| `IP_SALT` | jen funkce | libovolný dlouhý náhodný řetězec |
| `CRON_SECRET` | jen funkce | libovolný dlouhý náhodný řetězec, Vercel ho posílá cronu automaticky |
| `PUBLIC_URL` | jen funkce | např. `https://pronajemzapad.cz` (odkaz v e-mailu) |
| `GA_MEASUREMENT_ID` | build | **volitelné**: Google Analytics 4 (G-XXXXXXX). Bez něj web nenastavuje žádné volitelné cookies a lišta se nezobrazuje. S ním se zapne cookie lišta a analytika se načte až po souhlasu. |

Po změně proměnných pro build je potřeba nové nasazení.

### Zabezpečení administrace (kde se zadává heslo)
- Heslo se nikdy neukládá u nás ani v repozitáři. Přihlášení zpracovává Supabase Auth (heslo se ukládá jen jako otisk) a posílá se šifrovaně (HTTPS).
- Administrace **nenačítá žádné skripty z cizích serverů**. Knihovny jsou uložené ve `static/admin/vendor/` (verze a zdroj v `README.md` tamtéž).
- Prohlížeč dostane pro `/admin/` hlavičku **Content-Security-Policy** (`vercel.json`): skripty jen z vlastního webu, spojení jen na vlastní web a `*.supabase.co`, stránku nelze vložit do cizího rámu.
- Veřejná registrace je v Supabase vypnutá, účty zakládá jen správce.
- Doporučení: každý uživatel má unikátní silné heslo, nejlépe ve správci hesel. Zapomenuté heslo se zatím nastavuje v Supabase (Authentication → Users).

### Ověření po prvním nasazení
```
curl -i -X POST https://VAŠE-DOMÉNA/api/podklady -H 'Content-Type: application/json' -d '{}'
```
Očekává se odpověď `400` nebo `422` s JSON (ne `404` ani přesměrování). Web používá adresy s lomítkem na konci,
takže je třeba ověřit, že tím není dotčena adresa funkce. Dále: odeslat zkušební formulář s fotkou, zkontrolovat řádek
v Supabase, e-mail z Make a zobrazení v `/admin/`.

### Testy serverové části
```
node --test tests/api.test.js
```
Používají mock Supabase, Make i Turnstile (`tests/mock-supabase.js`), nepotřebují internet.
