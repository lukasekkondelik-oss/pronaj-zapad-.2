# Nasazení a správa nabídek

Web je statický. Nabídky leží v Supabase, `tools/build.py` je při každém buildu stáhne
a vygeneruje z nich statické stránky (`/nabidky/`, `/nabidky/<slug>/`, sitemap, llms.txt, schema).
Admin je statická stránka `/admin/` s přihlášením.

```
admin (/admin/) ──► Supabase (DB + fotky) ──webhook──► Netlify build hook ──► build.py ──► nové statické stránky
```

## 1. Supabase (jednorázově, ~10 minut)
1. Založte projekt na supabase.com (region EU, Frankfurt).
2. **SQL Editor** → vložte celý obsah `supabase/schema.sql` → Run. Vytvoří tabulku, pravidla přístupu (RLS) a bucket na fotky.
3. **Authentication → Providers → Email**: vypněte **Allow new users to sign up** (jinak by se mohl registrovat kdokoli a editovat nabídky).
4. **Authentication → Users → Add user**: vytvořte účty pro sebe a lidi z realitky (e-mail + heslo, zaškrtněte Auto Confirm).
5. **Project Settings → API**: zkopírujte `Project URL` a `anon public` klíč. Anon klíč je veřejný z design důvodu, data chrání RLS. **Nikdy** nepoužívejte `service_role` klíč.

## 2. Netlify
1. Importujte repozitář. Nastavení se načte z `netlify.toml` (build `python3 tools/build.py`, publish `dist`).
2. **Site settings → Environment variables**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
3. **Build & deploy → Build hooks → Add build hook**: zkopírujte URL.
4. V `tools/build.py` nastavte `DOMAIN` na skutečnou doménu a `FORM_ENDPOINT` na webhook pro formuláře (např. n8n).

Vercel funguje stejně (`vercel.json`, Environment Variables, **Deploy Hooks**).

## 3. Automatické přegenerování po uložení nabídky
Supabase → **Database → Webhooks → Create**: tabulka `listings`, události Insert + Update + Delete,
typ HTTP Request, metoda POST, URL = build hook z Netlify. Po každém uložení v adminu se web do 1–2 minut přegeneruje.

## 3b. Pokud jste už dřív spustili schema.sql
Spusťte jednorázově `supabase/migration_rented.sql` (přidá stav „Pronajato“ a datum pronájmu).

## 4. Každodenní práce
Otevřete `https://VAŠE-DOMÉNA/admin/`, přihlaste se, **+ Nová nabídka**, vyplňte, nahrajte fotky, stav „Zveřejněno“, Uložit.
Stavy: **K pronájmu** (veřejná nabídka), **Pronajato** (přesune se do části „Realizované obchody“ na `/nabidky/`, detail zůstává pro SEO a ukazuje, že je pronajato), **Koncept** a **Archiv** (na webu se nezobrazují). V seznamu je tlačítko „Označit jako pronajato“ / „Vrátit k pronájmu“. Smazání odstraní i fotky.

Zpracování poptávek a automatické e-maily: viz `docs/MAKE.md`.

## Lokální náhled
```
USE_SAMPLE=1 python3 tools/build.py   # ukázková data
python3 -m http.server -d dist 8000
```
Se skutečnými daty: `SUPABASE_URL=… SUPABASE_ANON_KEY=… python3 tools/build.py`.

## Co hlídat
- Přesná ulice se na webu **nezobrazuje** (pole „Ulice (interní)“ se nevypisuje).
- Fotky se při nahrání zmenší na max. 1600 px; na webu se používají přímo z Supabase Storage.
- Pokud build selže na načtení dat, Netlify ponechá předchozí funkční verzi webu.
