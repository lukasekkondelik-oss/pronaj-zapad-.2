# Napojení na Softreal

**Stav: kostra hotová, formát exportu zatím neznáme.** Veřejně se nepodařilo dohledat dokumentaci,
proto je `parse()` v `tools/softreal.py` záměrně nedokončený a build s nastaveným `SOFTREAL_FEED_URL` skončí
srozumitelnou chybou. Vše ostatní kolem (stažení, kontrola záznamů, ochrana před prázdným exportem, tvorba stránek) je hotové.

## Co potřebujeme zjistit (u klientky nebo podpory Softrealu)
1. Jaký export Softreal nabízí (API, XML pro portály, jiný) a zda je v jejich tarifu zdarma. **Případný poplatek hradí klient.**
2. Přístup: adresa exportu a způsob ověření (token, jméno a heslo, IP omezení).
3. Vzorek reálného exportu s alespoň třemi nabídkami (jinak nejde napsat zpracování).
4. Jak export označuje: stažené / pronajaté nabídky (zmizí z exportu, nebo mají příznak), pronájem vs. prodej (potřebujeme jen pronájmy), makléře u nabídky.
5. Odkazy na fotky: veřejné `https://` adresy, jejich velikost a trvalost.
6. Jak často lze export číst (limity).

## Co `parse()` musí vrátit
Seznam nabídek v tomto tvaru (povinné: `id`, `title`, `type`, `city`, `rent_czk`):

| Pole | Poznámka |
|---|---|
| `id` | stabilní ID ze Softrealu (z něj se skládá adresa stránky) |
| `title`, `type`, `disposition`, `city`, `district` | texty; `type` např. Byt, Rodinný dům |
| `area_m2`, `floor`, `rent_czk`, `fees_czk`, `deposit_czk` | čísla / text |
| `available_from` | `YYYY-MM-DD` |
| `furnished` | `ano` / `castecne` / `ne` |
| `energy_class`, `description`, `features[]` | volitelné |
| `photos[]` | `https://` adresy, nebo `{url, alt}` |
| `contact_name`, `contact_phone` | makléř u nabídky, jinak se použije Soňa Petříková |
| `published_at`, `updated_at` | ISO datum |

Vše ostatní provede `normalize()`: zahodí neúplné záznamy (s varováním), zruší fotky bez `https://`, doplní adresu stránky.

## Pojistky
- Chyba stažení, nebo nedokončený `parse()` → build skončí a Netlify ponechá předchozí funkční web.
- Export s 0 použitelnými nabídkami → build skončí. Pokud opravdu žádné nabídky nejsou, nastavte `ALLOW_EMPTY=1`.
- Adresa stránky se skládá z názvu a ID. Změní-li makléř název v Softrealu, změní se i adresa. Pokud to bude vadit, přidáme přesměrování.

## Záložní plán
Pokud export nebude možný, dá se vrátit původní ruční administrace nabídek (Supabase). Je v historii gitu
v commitu `b5e023d` (`static/admin/`, `supabase/schema.sql`).
