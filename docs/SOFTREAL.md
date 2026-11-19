# Napojení na Softreal

**Stav: zpracování exportu (JSON i XML) je hotové a řízené konfigurací, chybí jen skutečný vzorek exportu.** Veřejně se nepodařilo dohledat dokumentaci,
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
- Chyba stažení, nebo nedokončený `parse()` → build skončí a hosting ponechá předchozí funkční web.
- Export s 0 použitelnými nabídkami → build skončí. Pokud opravdu žádné nabídky nejsou, nastavte `ALLOW_EMPTY=1`.
- Adresa stránky se skládá z názvu a ID. Změní-li makléř název v Softrealu, změní se i adresa. Pokud to bude vadit, přidáme přesměrování.

## Záložní plán
Pokud export nebude možný, dá se vrátit původní ruční administrace nabídek (Supabase). Je v historii gitu
v commitu `b5e023d` (`static/admin/`, `supabase/schema.sql`).

## Jak se zpracování dokončí, až přijde vzorek
`parse()` už umí JSON i XML a nic v kódu se psát nemusí. Co kde v exportu leží, určuje soubor `tools/softreal_mapping.json`:
1. Zkopírujte `tools/softreal_mapping.example.json` jako `tools/softreal_mapping.json`.
2. Podle vzorku upravte cesty (`items_path` = kde je seznam nabídek, `fields` = kde je které pole, `filter` = ponechat jen pronájmy, `value_map` = překlad hodnot, `photos_path`, `features_path`). Číselná pole mají předponu `number:`. Cesty jsou s tečkami, atributy XML mají předponu `@`.
3. Spusťte `SOFTREAL_FEED_URL=… python3 tools/build.py` a zkontrolujte varování o přeskočených záznamech.
4. Testy: `python3 tests/softreal.test.py` (běží i v CI).

Bez souboru `softreal_mapping.json` build s nastaveným `SOFTREAL_FEED_URL` skončí chybou, takže se omylem nenasadí prázdný web.
Ověření (token, jméno a heslo) se doplní v `fetch_raw()` podle toho, co Softreal skutečně vyžaduje.

## Automatická aktualizace (scénář C v Make, připraveno k nasazení)
Nabídky jsou součástí statického webu, takže po změně v Softrealu je nutné web znovu sestavit. Postup:
1. Ve Vercelu: Project → Settings → Git → **Deploy Hooks** → vytvořit hook (např. „softreal-sync“), zkopírovat URL.
2. V Make nový scénář C: **Schedule** (např. každých 30 minut) → **HTTP: Make a request** na `SOFTREAL_FEED_URL`
   → **Tools: Get/Set variable** s otiskem (hash) obsahu uloženým v Data store → pokud se hash změnil, **HTTP: POST** na Deploy Hook.
3. Díky otisku se web nesestavuje zbytečně a nevyčerpá se limit sestavení ve Vercelu.
Poznámka: bezplatný tarif Make dovolí jen 2 aktivní scénáře (A a B už běží), pro scénář C je potřeba vyšší tarif
(alternativa bez Make: GitHub Actions s `schedule:` volající Deploy Hook, bez dalšího poplatku).
