# GDPR: provozní přehled

Texty pro veřejnost jsou v `tools/legal.py` (zásady ochrany osobních údajů a cookies). Tento dokument je interní:
kde jsou údaje, co udělat při žádosti návštěvníka a co ještě zbývá ověřit. **Texty by měl před spuštěním projít právník.**

## Kde se osobní údaje nacházejí
| Místo | Co | Doba | Kdo má přístup |
|---|---|---|---|
| Supabase, tabulka `submissions` a úložiště `submissions` | Podklady od majitelů včetně fotek | Nová a V řešení 90 dní, Převzato 90 dní, Zamítnuto 30 dní od poslední změny stavu, nedokončená odeslání 1 den (denní cron `api/cleanup`) | Přihlášení pracovníci v `/admin/` |
| Supabase, tabulka `inquiry_events` | Nevratný otisk IP adresy (omezení spamu) | 1 den | Jen serverová funkce |
| Google tabulka „Poptávky – Pronájmy Západ“ | Řádek za každou poptávku obou typů | Po dobu vyřízení, **mazání je ruční** (viz níže) | Účet `alfaestate@alfaestate.info` |
| Gmail `alfaestate@alfaestate.info` | Upozornění makléři a potvrzení odesílateli | Po dobu vyřízení, **mazání je ruční** | Účet `alfaestate@alfaestate.info` |
| Make, historie běhů | Data zpracovaná scénářem, na omezenou dobu podle tarifu | Podle tarifu Make | Účet Make |
| Vercel, provozní záznamy | Technické záznamy a chybová hlášení funkcí | Podle nastavení Vercelu | Účet Vercel |

## Ruční úklid poptávek (Google tabulka a Gmail)
Zásady slibují uchování „po dobu nezbytnou k vyřízení poptávky“. Žádné automatické mazání tu není, proto je potřeba
**pravidelný úklid** (doporučení: jednou za čtvrtletí):
1. V tabulce smazat řádky, které mají ve sloupci „Stav vyřízení“ hodnotu vyřízeno a jsou starší než zvolená lhůta (doporučení nejvýše 12 měsíců).
2. V Gmailu vyhledat a smazat staré zprávy „Nová poptávka“, „Nové podklady od majitele“ a „Děkujeme za …“.
3. Sloupec „Souhlas“ v tabulce znamená, že odesílatel potvrdil seznámení se zásadami (nejde o souhlas jako právní základ).

## Žádost návštěvníka (přístup, oprava, výmaz)
Žádosti chodí na `alfaestate@alfaestate.cz`, lhůta na odpověď je **1 měsíc**. Prohledat:
1. **Supabase:** `select * from submissions where email = '…'` (výmaz včetně fotek přes administraci tlačítkem Smazat).
2. **Google tabulka:** hledat e-mail a telefon.
3. **Gmail:** hledat e-mail osoby.
4. **Make:** historie běhů scénářů A a B (vyprší sama podle tarifu).
Údaje, které realitní kancelář převzala do své evidence k plnění smlouvy, mají vlastní lhůty (smlouva, účetnictví).

## Zpracovatelé: co ověřit
Pro každého musí existovat smlouva o zpracování osobních údajů (DPA). U většiny velkých poskytovatelů se přijímá v nastavení účtu nebo je součástí obchodních podmínek, ale ověřte to u:
- Vercel (hosting; funkce nastavené na region `dub1`, Dublin, v `vercel.json`),
- Supabase (databáze a fotky, region EU Irsko),
- Make (scénáře, zóna eu1),
- Google (Gmail, Sheets; platí smlouva účtu `alfaestate.info`),
- Cloudflare (Turnstile).

**Dodavatel webu:** pokud máte přístup k datům (Supabase, Make, Vercel, administrace), jste zpracovatel a realitní kancelář s vámi potřebuje **smlouvu o zpracování osobních údajů**.

## Incident (únik, ztráta, zneužití)
Do 72 hodin od zjištění nahlásit Úřadu pro ochranu osobních údajů, pokud hrozí riziko pro osoby, a případně informovat dotčené osoby. Postup: odpojit přístup (změnit hesla, otočit klíče `SUPABASE_SERVICE_KEY` a Turnstile), zaznamenat co, kdy a koho se týká.

## Záznamy o činnostech zpracování (čl. 30 GDPR)
Realitní kancelář zpracovává údaje pravidelně, proto by měla vést záznam. Podklady pro něj jsou v tabulce výše a v zásadách.

## Co je potřeba rozhodnout nebo ověřit
- **Sídlo:** výpis ze živnostenského rejstříku uvádí sídlo V. Meerwalda 57/8, Karlovy Vary – Dvory (provozovna Majakovského 707/29). Zásady na alfaestate.cz uvádějí jako sídlo Majakovského. Ověřte aktuální sídlo v obchodním rejstříku (justice.cz) a sjednoťte oba weby.
- **Zásady na alfaestate.cz** tvrdí, že údaje se nepředávají do třetích zemí. Pokud kancelář používá Google, Microsoft nebo jiné americké služby, tvrzení neplatí. Zásady tohoto webu to uvádějí přesně.
- **Konkrétní lhůta** pro poptávky v tabulce a Gmailu (zásady říkají „po dobu nezbytnou“, konkrétní horní hranice je pro kontrolu přesvědčivější).
- Právní kontrola textů a smlouvy se zpracovateli.
- Analytika: zatím žádná. Jakmile bude, nastavte na Vercelu `GA_MEASUREMENT_ID`, nasaďte web a automaticky se objeví cookie lišta a odkaz „Nastavení cookies“ v patičce. Nezapomeňte přepsat `tools/legal.py`, pokud nástroj není Google Analytics 4.
