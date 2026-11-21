# Zpracování webhooku ze Softrealu (export „Softreal WP plugin“)

Zdroj v Softrealu: `controllers/components/exporter_wordpress.php` (volání webu),
`controllers/public_exporters/public_export_nemovitosti_controller.php` (XML s daty),
`controllers/components/exporter_nemovitosti_wrapper.php` (obsah XML nabídky).


## 0. Co si vyměníme

Od tebe potřebujeme:
- **Adresu webhooku** – URL skriptu na webu, který bude Softreal volat (např. `https://tvujweb.cz/api/softreal`).
- **Secret** – heslo, kterým se Softreal tvému webu prokazuje. Jen písmena a číslice (v URL se neurlencoduje, viz
  bod 1), ideálně 32 a víc znaků.

My je zadáme do Softrealu u exportu „Softreal WP plugin“ jako **Adresa webu N** a **Exportní heslo N** a pošleme ti:
- URL Softrealu kanceláře (`softrealUrl`, např. `https://s1.system.softreal.cz/mojenemovitostumore`), odkud se
  stahují data nabídek,
- `channel_id` kanálu tvého webu.


## 1. Princip

Každý web zadaný v Softrealu (Adresa webu N + Exportní heslo N) je samostatný kanál s `channel_id = 1000 + N` (název
kanálu = doména webu).

Webhook nepřenáší data nabídky, jen webu oznámí „nabídka X se změnila“ – data si web sám stáhne ze Softrealu jako XML.

Softreal volá adresu webu přes **GET**:

```
https://tvujweb.cz/api/softreal?system=<base64 URL Softrealu>&channel_id=1002&secret=<exportní heslo>&softrealAction=add&id=14811
```

| Parametr | Význam |
|---|---|
| `softrealAction` | `add` (nová i upravená nabídka), `delete`, `list` |
| `id` | ID nabídky v Softrealu (číslo) |
| `channel_id` | kanál tohohle webu (1001, 1002, …) |
| `secret` | exportní heslo z nastavení Softrealu |
| `system` | base64 URL instance Softrealu, např. `https://s1.system.softreal.cz/mojenemovitostumore` |
| `status` | jen u `delete` – aktuální stav nabídky (kódy jako `sr_status`, viz bod 6) |

Pozor:
- **Parametry se neurlencodují.** Exportní heslo dej jen z písmen a číslic. Base64 v `system` může obsahovat `+`,
  které PHP v `$_GET` změní na mezeru – před dekódováním `str_replace(' ', '+', …)`, nebo `system` vůbec nepoužívej
  (viz bod 2).
- Pokud adresa webu v Softrealu už obsahuje `?`, parametry se připojí přes `&`.
- Koncové `/` adresy Softreal odřízne (`https://tvujweb.cz/api/softreal/` volá jako `https://tvujweb.cz/api/softreal?…`)
  a adrese bez `http(s)://` doplní `http://` – handler musí fungovat i bez koncového lomítka.
- Softreal čeká na odpověď max 60 s, odpověď smí mít max 500 kB. Nabídky volá jednu po druhé a po 30 s (nebo po
  nabídkách s celkem 60 fotkami, nejvýš 100 nabídek) další nezačne, zbytek pošle v dalším běhu – **odpovídej rychle**,
  těžkou práci (fotky) dělej ve frontě.
- Softreal nekontroluje SSL certifikát webu a sleduje přesměrování.

## 2. Zabezpečení (první věc v handleru)

1. **Ověř `secret`** proti heslu uloženému na webu pro daný `channel_id` (`hash_equals()`). Nesedí → HTTP 403 a konec.
2. **Neber `system` naslepo.** URL Softrealu je vždy z domény *.softreal.cz (`system` s tím porovnej), nejlépe ji
   měj na webu uloženou (bod 0).
   Jinak ti kdokoli podstrčí vlastní „Softreal“ s falešnými nabídkami nebo tě donutí stahovat z libovolné adresy (SSRF).
3. `id` a `channel_id` přetypuj na int.
4. Neloguj celou URL požadavku – obsahuje `secret`.

## 3. `softrealAction=add` – založení / aktualizace nabídky

Stejná akce přichází pro novou nabídku, úpravu i změnu stavu → **upsert podle Softreal ID** (stejné ID může přijít
opakovaně).

### a) Detail nabídky

```
{softrealUrl}/softreal/publicExportNemovitosti/detail?wp=1&channel_id={channel_id}&nocache=1&export_id={id}
```

- XML `database > data > row`. Když `row` chybí, nabídka v Softrealu není přiřazená k tomuhle kanálu → vrať chybu.
- Hlavní pole v `row` (co znamenají kódy, viz bod 6):
  - `job_number` – ID nabídky (stejné jako `id` z webhooku), `export_id` je totéž s prefixem (`softreal_xyz14811`)
  - `user_id` – ID makléře (pro bod b), `user_export_id` je totéž s prefixem
  - `job_number_prefix` – `N` ČR, `F` zahraničí, `D`/`DF` developerský projekt
  - `bus_type_id` (prodej/pronájem), `main_category_id` (druh nemovitosti)
  - `price` (0 = cena se nezobrazuje), `price_currency_id`, `price_unit_id`, `price_note`
  - `caption`, `caption_en/de/bg/ru/es`, `public_description`, `public_description_en/de/bg/ru/es`
  - `country_id` (jen zahraničí), `region` (u ČR název okresu), `location` (obec), `street`; kódy lokality v ČR
    `region_id`, `district_id`, `city_id`, `citypart_id`, `street_id`
  - `x_coord` = **zeměpisná šířka (lat)**, `y_coord` = **délka (lng)**
  - `last_refresh_time` – `YmdHis` poslední změny
- `xitems/data/row` – ostatní parametry nabídky: `property_name` (tag), `property_label` (český název),
  `property_value`. U parametru s číselníkem přijde hned za ním řádek `<tag>_name` s textem hodnoty (u vícenásobného
  výběru ne, viz bod 6). `property_name` je tag parametru v Softrealu bez přípony `_obligate`; některé standardní
  parametry přijdou navíc ještě jednou s prefixem `sr_` (formát nemovitosti.cz, např. `sr_building_condition`),
  parametry jen pro jednu kancelář mají její prefix (např. `mnum_`, `mnum-df_`). S `&lang=en` přijdou
  i `property_label_en` / `property_value_en` (tam, kde existuje překlad).
- **Stav nabídky** v `xitems`:
  - `sr_status`: 0 aktivní, 1 rezervace, 2 archiv, 3 prodáno, 4 příprava
  - `sr_extra_info`: 2 aktivní, 1 rezervace, 0 prodáno
  - Standardně se exportují aktivní, rezervované i prodané – rozhodni, co z toho web zobrazí.
- `checkboxes/data/row` – zaškrtávací parametry (`property_name`, `property_label`, `property_value` 0/1).
- `videos/data/row/path` – absolutní URL videa.
- `images/data/row` a `feature_images/data/row` – fotky (viz c).

### b) Makléř

```
{softrealUrl}/softreal/publicExportNemovitosti/users_detail?wp=1&channel_id={channel_id}&export_id={user_id}
```

Vrátí `firstname`, `surname`, `degree`, `phone_main`, `email`, `photo` (base64). Bez přístupového hashe jen makléře
se zapnutým zobrazením na webu (jinak prázdné `data`) – kvůli chybějícímu makléři neshazuj celý import. Pro ID 0 a 1
přijde místo XML jen text.

### c) Fotky

Každý řádek v `images` má `sequence_order`, `export_id`, `caption`, `media_id` (`feature_images` místo `media_id`
`type`). Stažení:

```
{softrealUrl}/softreal/publicExportNemovitosti/file?wp=1&channel_id={channel_id}&export_id={export_id fotky}&raw=1
```

- S `raw=1` přijde rovnou binární obrázek a hlavička `Softreal-File-Checksum` (md5) – ověř celistvost.
  Bez `raw=1` přijde XML s obrázkem v `binary_data` (base64).
- Pro `feature_images` cesta `file/feature?…` – může to být i video (`.mp4` v `export_id`, `Content-Type: video/mp4`).
- `export_id` fotky je stabilní klíč (podtržítko v názvu souboru je nahrazené `1U1`) → porovnej se stávajícími:
  nové stáhni, chybějící smaž, nezměněné nech.
- **Stahování dej do fronty a zpracuj cronem**, v requestu webhooku se nevejdeš do limitu.

### d) Odpověď

Jen JSON, nic jiného (PHP warning před JSONem odpověď rozbije).

```json
{"message": "OK", "url": "https://tvujweb.cz/nabidka/123"}
```

- `url` se uloží v Softrealu jako odkaz na nabídku. Místo `"message": "OK"` stačí i `"ok": true`.
- **Chyba, kterou má uživatel vidět v Softrealu:** HTTP 200 + `{"message": "Popis chyby"}`. Při jiném HTTP kódu dej
  text do klíče `error` (jinak Softreal ukáže jen obecné „Neautorizováno“, „Nenalezeno“, „Chyba serveru“ apod.).
- **Prázdná / nevalidní odpověď** (HTTP 200 bez `message` i `ok`, nebo žádná odpověď do 60 s): Softreal to hned zkusí
  ještě 3×, pak zapíše „Web neodpovídá“.
- `"silent": true` – Softreal nabídku z kanálu vyřadí. Hodí se pro nabídky, které na web nepatří (jiná země apod.).
- Volitelně `"trace": "…"` – ladicí výpis, Softreal ho ukáže při ručním exportu.
- Volitelně `"translationUrl"` – když web umí překládat. Adresa se zástupci `__column__` (`title` / `description`)
  a `__langCode__`; Softreal si pak stáhne překlady, které u něj chybí (`_en`, `_de`, `_pl`, `_bg`, `_hr`, `_sr`,
  `_es`), a čeká odpověď `{"translation": "…"}`.

## 4. `softrealAction=delete`

Přijde `id` (a případně `status`). Nabídku smaž / skryj a uvolni fotky. Odpověz `{"message": "OK"}` **i když ji
nenajdeš** – jinak to Softreal bude zkoušet znovu.

## 5. `softrealAction=list`

Vrať všechny nabídky, které web od Softrealu aktuálně má (statistiky, limity, kontrola nabídek, které na webu být
nemají). Softreal čte z položek klíč `softreal_id`:

```json
{"message": "OK", "list": [{"softreal_id": 14811}, {"softreal_id": 14812}]}
```

## 6. Číselníky – co znamenají kódy v XML

Na zobrazení nabídky číselník většinou nepotřebuješ – u parametrů v `xitems` přijde text hodnoty v řádku `<tag>_name`.
Potřebný je na filtry vyhledávání na webu (seznam všech hodnot), u vícenásobného výběru (hodnota je JSON pole kódů,
např. `["1","3"]`, a řádek `_name` nepřijde) a u základních polí v `row`, ke kterým text nepřichází.

### a) Parametry v `xitems` a `checkboxes`

Veřejná stránka Softrealu kanceláře:

```
{softrealUrl}/softreal/publicExportNemovitosti/doc
```

Tabulka po šablonách (druh nabídky, např. „Prodej bytu“), u každého parametru: český název, tag, typ (`selectbox`,
`checkbox`, `number`, `varchar`, `text`, …) a u číselníků seznam `kód: text`. Tag na stránce odpovídá `property_name`
v XML (v XML bez přípony `_obligate`).

- Radši používej parametry bez prefixu `sr_` – odpovídají přímo stránce `doc`. `sr_` položky jsou kvůli formátu
  nemovitosti.cz a některé mají vlastní kódy (např. `sr_heating`); výjimka je stav nabídky (`sr_status`,
  `sr_extra_info`, kódy v bodě 3a).
- Stránka zatím ukazuje jen šablony nabídek v ČR (N). Parametry zahraničních nabídek a projektů jsou většinou stejné,
  co chybí (např. kódy zemí), pošleme na vyžádání.

### b) Základní pole v `row`

Vychází z formátu nemovitosti.cz:

| Pole | Kódy |
|---|---|
| `bus_type_id` | 1 prodej, 2 pronájem |
| `main_category_id` | 1 zemědělský objekt, 2 komerční objekt, 3 pozemek, 4 byt, 5 historický objekt, 6 dům, 7 hotel / restaurace, 8 nájemní dům, 9 komerční prostory, 10 chata / chalupa, 11 ostatní (garáž apod.) |
| `price_currency_id` | 1 CZK, 2 EUR (jiná měna → pole chybí) |
| `price_unit_id` | 1 za nemovitost, 2 za m², 3 za měsíc, 4 za m²/měsíc, 5 za rok, 6 za m²/rok (jiná jednotka → pole chybí) |
| `job_number_prefix` | `N` nabídka v ČR, `F` zahraniční nabídka, `D` developerský projekt, `DF` zahraniční projekt |

- **Lokalita v ČR** – kódy RÚIAN (veřejné číselníky ČÚZK): `region_id` kraj (např. 116 Jihomoravský), `district_id`
  okres (např. 3702 Brno-město; Praha podle obvodu 3101–3110 = Praha 1–10), `city_id` obec (např. 582786 Brno),
  `citypart_id` část obce, `street_id` ulice, `book_id` katastrální území. Text přichází v `location`, `city_part`,
  `street` a `region` (název okresu).
- **Země** (`country_id`, jen zahraničí) – vlastní číselník Softrealu (ne ISO), název země je v `xitems` v řádku
  `foreign_locality_country_name`.
- Úplný číselník nemovitosti.cz (kraje, okresy, `sr_` položky) je v příloze `priloha-nemovitosti.cz-ciselniky.xls`,
  list „Ciselniky xml položek“. U parametrů v `xitems` ale platí stránka `doc` – Softreal má v některých číselnících
  hodnoty navíc (např. stav objektu 10 = V rekonstrukci).

## 7. Test

1. Zavolej URL z bodu 1 ručně (curl / prohlížeč) s platným heslem a ID nabídky přiřazené ke kanálu tvého webu.
2. V Softrealu přiřaď nabídku ke kanálu (název = doména webu) a spusť export – výsledek a hlášku uvidíš u nabídky
   v přehledu exportů.
3. Na webu loguj každý příchozí požadavek (bez `secret`) a výsledek, jinak se chyby exportu ladí špatně.
