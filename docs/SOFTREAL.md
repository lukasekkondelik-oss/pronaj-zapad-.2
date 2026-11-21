# Napojení na Softreal (webhook „Softreal WP plugin“)

**Stav: návod od Softrealu máme (`docs/softreal-navod-od-dodavatele.md`), implementace se nezačala.** Dřívější návrh
(web si pravidelně stahuje celý export, soubor `tools/softreal_mapping.json`, scénář C v Make) je tímto **zrušen**: Softreal
umí sám zavolat web, když se nabídka změní, takže **scénář C ani vyšší tarif Make nejsou potřeba**.

## Jak to funguje (podle návodu)
1. Realitní makléř změní nabídku ve Softrealu (nová, úprava, stažení, změna stavu).
2. Softreal zavolá **GET** na adresu našeho webhooku: `…/api/softreal?channel_id=…&secret=…&softrealAction=add|delete|list&id=…`.
   Webhook **nenese data nabídky**, jen oznámení „nabídka X se změnila“.
3. Náš web si data stáhne sám ze Softrealu jako XML (detail nabídky, makléř, fotky), uloží je a odpoví JSONem
   (`{"message":"OK","url":"…"}`) do 60 s. Softreal čeká jednu nabídku po druhé a v jednom běhu dělá max. 100 nabídek / 60 fotek,
   proto musí webhook odpovídat rychle a fotky se zpracovávají ve frontě.
4. Web je statický, takže po změně se **znovu sestaví** (Vercel Deploy Hook) a nabídka se objeví na webu.

## Navržená architektura
```
Softreal ──GET──► /api/softreal (Vercel funkce)
                    │ ověří secret (hash_equals), ignoruje parametr system (bere SOFTREAL_URL z nastavení)
                    │ add:    stáhne detail + makléře (XML), upsert do Supabase (tabulka listings),
                    │         zařadí fotky do fronty (listing_photos, stav pending), označí web jako „změněný“
                    │ delete: nabídku skryje, fotky smaže, odpoví OK i když ji nenajde
                    │ list:   vrátí softreal_id všech nabídek, které web drží
                    ▼
        /api/softreal-sync (cron každých 5 min, + hned po odpovědi webhooku)
                    │ zpracuje frontu fotek: stáhne raw=1, ověří md5 (Softreal-File-Checksum),
                    │ zmenší (sharp: 1600 px a miniatura), uloží do veřejného bucketu Supabase Storage
                    │ když nic nečeká a web je „změněný“ → zavolá Vercel Deploy Hook (sloučí více změn do jednoho buildu)
                    ▼
        tools/build.py čte nabídky ze Supabase (jen zveřejněné) a vygeneruje statické stránky
```
Proč takhle: Supabase je jediný zdroj pravdy a fronta, webhook zůstává rychlý, žádný Make scénář, žádné další poplatky
(kromě Vercel Pro, který potřebujeme tak jako tak: cron jednou za 5 min a komerční provoz).

## Co je potřeba udělat
### A) Vy / jednatel Softrealu / klientka
1. **Vygenerovat secret** (jen písmena a číslice, 32+ znaků, např. `openssl rand -hex 24`). Uložit do správce hesel. Do chatu ho neposílejte.
2. **Poslat jednateli Softrealu** adresu webhooku a secret (nejlépe bezpečným kanálem). Zatím na ostré doméně nejsme,
   adresa je `https://pronaj-zapad-2.vercel.app/api/softreal`, po koupi domény se změní na `https://<doména>/api/softreal`
   (v Softrealu jde upravit u „Adresa webu N“, kanál `channel_id = 1000 + N` zůstává).
3. **Dostat od něj:** `softrealUrl` (např. `https://s1.system.softreal.cz/…`) a `channel_id`.
4. V Softrealu **přiřadit k tomuto kanálu nabídky**, které mají být na webu (to je řízení, co web zobrazí).
5. Po nasazení spustit v Softrealu ruční export všech přiřazených nabídek (první naplnění).
6. Rozhodnout otevřené body níže.

### B) Já (po bodech 1–4)
1. Supabase migrace: tabulky `listings`, `listing_photos`, `sync_state`; veřejný bucket `listing-photos`; práva (anon nesmí nic, web čte jen přes build).
2. `api/softreal.js` + `lib/softreal.js`: ověření, akce add / delete / list, stažení a zpracování XML (`fast-xml-parser`), upsert, stabilní adresa stránky, odpověď podle návodu (včetně `silent: true` pro nabídky, které na web nepatří).
3. Fronta fotek + cron `/api/softreal-sync`: stažení, kontrola md5, zmenšení (`sharp`), uložení, mazání fotek smazaných nabídek; debounce a Deploy Hook.
4. `tools/build.py`: načítání ze Supabase místo souboru, štítky Rezervováno / Pronajato, cena na dotaz, kontakt makléře.
5. Mapování polí (tabulka níže) doladit podle stránky `{softrealUrl}/softreal/publicExportNemovitosti/doc` a skutečného vzorku XML.
6. Testy: napodobenina Softrealu (detail, makléř, fotky s md5) a kompletní průchod add / změna / delete / list; kontrola, že secret nikdy nejde do logu.
7. Ostrý test podle návodu (bod 7), kontrola v přehledu exportů v Softrealu a ladění odpovědí.

### Otevřené body k rozhodnutí
- **Které druhy nemovitostí zobrazit:** navrhuji jen pronájmy (`bus_type_id = 2`) a druhy byt, dům, chata. Ostatní vrátíme jako `silent: true`.
- **Nabídka bez ceny** (`price = 0`): zobrazit „Cena na dotaz“, nebo skrýt? Navrhuji zobrazit.
- **Rezervace a pronajaté:** `sr_status` 0 aktivní (zobrazit), 1 rezervace (zobrazit se štítkem), 3 prodáno / pronajato (ponechat X dní se štítkem Pronajato nebo předat do „Realizovaných obchodů“?), 2 archiv a 4 příprava (skrýt).
- **Adresa nemovitosti:** zobrazit jen město a část města (bez ulice), kvůli soukromí majitele.
- **Vercel Pro** (cron každých 5 minut, komerční provoz): ověřit a rozhodnout, kdo platí.
- **Adresa stránky nabídky:** vytvoří se jednou z názvu a ID a pak se už nemění, i když makléř přejmenuje inzerát (adresu ukládá Softreal jako odkaz na nabídku).

## Mapování polí (návrh, upřesní se podle `doc` a vzorku)
| Náš údaj | Softreal |
|---|---|
| `id` | `job_number` (stabilní číslo, ne `export_id`) |
| titulek, popis | `caption`, `public_description` (volitelně `_en`, `_de`) |
| pronájem vs. prodej | `bus_type_id`: 1 prodej, **2 pronájem** |
| druh | `main_category_id`: 4 byt, 6 dům, 10 chata / chalupa (další viz návod) |
| nájemné | `price` podle `price_unit_id`: 3 za měsíc (základ), 4 za m² / měsíc, 5 za rok; `price_currency_id`: 1 CZK, 2 EUR; `price_note` |
| město, část, kraj | `location`, `city_part`, `region` (okres), `region_id` (**Karlovarský kraj = 51**), `district_id` (Cheb 3402, Karlovy Vary 3403, Sokolov 3409) |
| souřadnice | `x_coord` = šířka, `y_coord` = délka (na webu zatím nezobrazovat přesné) |
| dispozice, plocha, patro, kauce, poplatky, PENB, volné od | `xitems` (tagy zjistíme z `doc` a vzorku) |
| vybavení | `equiped`: 1 nezařízený, 2 částečně zařízený, 3 zařízený |
| vlastnosti (balkon, sklep, výtah…) | `checkboxes` s hodnotou 1 (název z `property_label`) |
| fotky | `images`, řazení podle `sequence_order`, stažení `file?…&export_id=<export_id fotky>&raw=1` + kontrola md5 |
| makléř | `users_detail` (`firstname`, `surname`, `phone_main`, `email`); když chybí, použije se výchozí kontakt |
| stav | `sr_status`: 0 aktivní, 1 rezervace, 2 archiv, 3 prodáno / pronajato, 4 příprava |

## Pojistky a bezpečnost
- Secret se porovnává `hash_equals` (časově konstantně); špatný secret = HTTP 403 a konec.
- Parametr `system` se **nepoužívá** ke stahování (SSRF). Stahujeme jen z `SOFTREAL_URL` uloženého v nastavení.
- Neloguje se celá adresa požadavku (je v ní secret). **Pozor:** Vercel zaznamenává adresy požadavků včetně parametrů do svých logů, proto secret občas obměnit
  (v Softrealu a ve Vercelu zároveň) a logy nepředávat dál.
- Nabídka, kterou nelze zpracovat, nesmí shodit ostatní. Chyba pro uživatele Softrealu: HTTP 200 + `{"message":"popis"}`.
- Smazání a změna stavu jsou idempotentní (stejné `add` může přijít opakovaně).
- Build při prázdném zdroji nesmí smazat web: pokud databáze nabídek vrátí chybu, nasazuje se dál předchozí verze.
- `silent: true` pro nabídky, které nepatří na web; Softreal je z kanálu vyřadí.

## Proměnné prostředí (přibudou)
`SOFTREAL_URL` (softrealUrl), `SOFTREAL_CHANNEL_ID`, `SOFTREAL_SECRET`, `DEPLOY_HOOK_URL`; stávající `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
Nic z toho se nikdy neukládá do repozitáře.

## Odhad práce a nákladů
Implementace a testy zhruba **12–18 hodin**. Doplňkové náklady: Vercel Pro (potřeba tak jako tak). Supabase zdarma stačí
(fotky po zmenšení zhruba desítky MB na desítku nabídek). Scénář C v Make a jeho tarif odpadá.

## Záložní plán
Pokud by webhook v praxi nešel, jde vrátit ruční administraci nabídek (Supabase), která je v historii gitu v commitu `b5e023d`.
