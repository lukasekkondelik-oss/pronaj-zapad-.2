# Podklady pro právníka: GDPR

**Nejde o právní poradenství.** Návrhy k posouzení právníkem a ke schválení klientkou.

## A) Záznam o činnostech zpracování (čl. 30 GDPR), návrh

**Správce:** ALFA ESTATE V&S Partners s.r.o., IČO 10799796, … (adresu sídla potvrdit).
**Kontakt:** alfaestate@alfaestate.cz

| Činnost | Subjekty a údaje | Účel a právní základ | Příjemci / zpracovatelé | Doba uchování | Přenos mimo EU |
|---|---|---|---|---|---|
| Podklady od majitelů (formulář s fotkami) | majitelé: jméno, telefon, e-mail, adresa a popis nemovitosti, fotografie | vyřízení nabídky spolupráce, kroky před uzavřením smlouvy (čl. 6/1/b) | Supabase (EU), Vercel, Make, Google | 90 dní od poslední změny stavu (zamítnuté 30 dní, rozpracované 1 den) | ověřit u Vercel, Make, Google (standardní smluvní doložky) |
| Poptávky zájemců | zájemci: jméno, telefon, e-mail, vybraná nabídka, zpráva | vyřízení poptávky (čl. 6/1/b) | Make, Google (Gmail, Sheets), Vercel | **doplnit konkrétní lhůtu** pro tabulku a schránku | jako výše |
| Zabezpečení formulářů | IP adresa (jen jako hash), časy | oprávněný zájem, ochrana před zneužitím (čl. 6/1/f) | Cloudflare Turnstile, Vercel | hash IP: 1 hodina až 1 den | Cloudflare |
| Přihlášení do administrace | makléř: e-mail, přihlašovací údaje | oprávněný zájem, zabezpečení | Supabase | po dobu pracovního vztahu | – |

## B) Smlouva o zpracování (čl. 28), šablona, návrh k doplnění
Je třeba **mezi realitní kanceláří (správce) a provozovatelem webu (zpracovatel)**, pokud provozovatel nemá k datům přístup jen náhodně (má ho: administrace, Make, Supabase). Vzor osnovy:
1. Předmět, doba trvání, povaha a účel zpracování.
2. Druhy osobních údajů a kategorie subjektů (viz tabulka A).
3. Zpracování jen na pokyn správce; důvěrnost osob s přístupem.
4. Zabezpečení (šifrování přenosu, omezení přístupu, mazání po lhůtách, oddělené účty).
5. Podzpracovatelé: Vercel, Supabase, Make, Google, Cloudflare. Souhlas správce a povinnost informovat o změně.
6. Pomoc správci při žádostech subjektů a při incidentech (oznámení bez zbytečného odkladu).
7. Vrácení nebo výmaz údajů po skončení spolupráce.
8. Audit a součinnost.

## C) Ověřit před spuštěním
- Uzavřené zpracovatelské smlouvy (DPA) se službami Vercel, Supabase, Make, Google, Cloudflare a jejich doložky pro přenos mimo EU.
- Sjednotit sídlo (V. Meerwalda 57/8 vs. Majakovského 707/29) v zásadách a patičce.
- Tvrzení „žádné předávání do třetích zemí“ na hlavním webu alfaestate.cz neplatí, pokud se používají výše uvedené služby. Zásady na tomto webu to uvádějí věcně.
- Konkrétní lhůta uchování poptávek v Google tabulce a Gmailu (návrh: 12 měsíců, poté ruční nebo automatický výmaz).
