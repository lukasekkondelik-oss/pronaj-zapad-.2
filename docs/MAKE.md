# Zpracování poptávek a automatické e-maily (Make)

Web posílá každý odeslaný formulář jako JSON metodou POST na jedinou adresu (`FORM_ENDPOINT` v `tools/build.py`),
tedy na **Custom webhook** v Make. Make poptávku zpracuje, uloží, rozešle e-maily a upozorní tým.

## Datový formát (webhook)
Společná pole: `projekt` (identifikátor webu, tady `pronajemzapad`, aby šel scénář použít i pro další weby), `formular` (`majitel` | `zajemce`), `jmeno`, `telefon`, `email`, `souhlas`, `zdroj` (cesta stránky), `odeslano` (ISO čas).

| `formular` | Odkud | Další pole |
|---|---|---|
| `majitel` | úvodní stránka, stránky měst | `typ`, `dispozice`, `mesto`, `od`, `plocha`, `najemne`, `popis`, `pomoc` |
| `zajemce` | detail nabídky | `nabidka_id` (ID ze Softrealu), `nabidka`, `nabidka_url`, `kontakt` (jméno makléře), `zprava` |

Pole `web` je honeypot proti spamu: web ho při vyplnění neodešle vůbec, v Make přesto ponechte filtr „web je prázdné“.

## Scénář v Make (dohodnutý rozsah)
Poptávky se ukládají **jen do Google Sheets** a chodí e-mailem. Žádné CRM, žádné úkoly, žádné připomínky.

1. **Webhooks → Custom webhook** (datová struktura podle tabulky výše, zapněte validaci).
2. **Filtr**: `souhlas` je vyplněné a `email` je platný e-mail.
3. **Google Sheets → Add a Row**: `odeslano`, `formular`, `jmeno`, `telefon`, `email`, `souhlas`, `zdroj`, nemovitost nebo nabídka a zpráva (jeden list, sloupce podle polí). Sloupce `souhlas` a `odeslano` jsou doklad souhlasu pro GDPR.
4. **E-mail týmu: „Nová poptávka“** na alfaestate@alfaestate.cz. U `zajemce` navíc kopie makléři podle `kontakt`.
5. **Informační e-mail odesílateli** (potvrzení, že poptávku přijali). Text podle `formular`, viz níže.
6. **Ošetření chyb:** na chybu v kterémkoli kroku nastavte upozornění e-mailem, jinak se poptávka může ztratit.

## Texty automatických e-mailů (návrh)
**Majiteli (informační e-mail)**: *Předmět:* Děkujeme za vaši nabídku nemovitosti
> Dobrý den {{jmeno}}, děkujeme, že jste nám poslal(a) nabídku nemovitosti ({{typ}}, {{mesto}}). Ozveme se vám nejpozději v nejbližší pracovní den (Po–Pá 9:00–17:00). Pokud je to naléhavé, zavolejte na 603 382 392. ALFA ESTATE V&S Partners s.r.o.

**Zájemci (informační e-mail)**: *Předmět:* Poptávka prohlídky: {{nabidka}}
> Dobrý den {{jmeno}}, děkujeme za zájem o nabídku „{{nabidka}}“ ({{nabidka_url}}). Brzy se vám ozveme a domluvíme prohlídku. Kontaktní osoba: {{kontakt jméno + telefon}}.

**E-mail týmu „Nová poptávka“**: předmět `Nová poptávka: majitel, {{mesto}}, {{typ}}` nebo `Nová poptávka: prohlídka, {{nabidka}}`; tělo = všechna pole formuláře + telefon a e-mail na jedno kliknutí.

## Co zajistit mimo Make
- **Odesílání z domény alfaestate.cz**: nastavte SPF, DKIM a DMARC, jinak budou e-maily padat do spamu. Odesílejte přes Gmail / Microsoft 365 modul nebo SMTP firmy.
- **Právní text**: potvrzovací e-mail neobsahuje marketing. Pokud chcete posílat newslettery, je potřeba samostatný souhlas.
- **Limity Make**: bezplatný tarif má omezený počet operací, pro provoz s desítkami poptávek měsíčně zvažte placený tarif.

## Nastavení webu
V `tools/build.py` nastavte `FORM_ENDPOINT = "https://hook.eu2.make.com/…"` (URL z modulu Custom webhook) a znovu nasaďte.

## Další scénáře (finální nabídka)
- **Pravidelná kontrola Softrealu:** každých 30 minut stáhnout export, porovnat otisk (hash) s minulým během a při změně zavolat Vercel Deploy Hook. Díky tomu stažená nabídka zmizí i z webu. Doplňte až po ověření exportu (`docs/SOFTREAL.md`).
- **Podklady od majitele (formulář s fotkami):** podklady se uloží do administrace a serverová funkce pošle do Make jen upozornění (adresa webhooku je jen na serveru, ne v prohlížeči). Pole: `projekt`, `formular` (`majitel`), `podklady_id`, `odkaz` (do administrace), `jmeno`, `telefon`, `email`, `typ`, `dispozice`, `mesto`, `plocha`, `najemne`, `od`, `popis`, `pomoc`, `pocet_fotek`, `souhlas`, `zdroj`, `odeslano`. Scénář: řádek v Google Sheets, e-mail makléřce s odkazem, potvrzení majiteli. Fotky se do Make neposílají, zůstávají v neveřejném úložišti.

## Dohodnuté nastavení (19. 11. 2026)
- **Odesílání i příjem e-mailů:** jen `alfaestate@alfaestate.info`. Gmail propojení v Make se vytváří tímto účtem.
- **Tabulka poptávek:** jedna Google tabulka [Poptávky – Pronájmy Západ](https://docs.google.com/spreadsheets/d/16zshsxj3ZuDZIwlW6ZCWmI2SNxqTXl6OK3QIi4p9D9g/edit) (vlastník `alfaestate@alfaestate.info`), jeden list pro oba typy poptávek. Sloupec „Formulář“ rozlišuje `majitel` a `zajemce`.
- **Sloupce:** Odesláno, Formulář, Web, Jméno, Telefon, E-mail, Typ nemovitosti, Dispozice, Město, Plocha, Nájemné, K dispozici od, Popis / zpráva, Zájem o pomoc, Nabídka, Odkaz na nabídku, Kontaktní makléř, ID podkladů, Odkaz do administrace, Počet fotek, Stránka odeslání, Souhlas, Stav vyřízení, Poznámka.
- **Make:** tým *My Team*. Stávající scénář „ALFA ESTATE – poptávka z webu → e-mail makléřům“ (nepoužitý, jiný formát dat) se nemění, nové scénáře A a B vzniknou vedle něj.

## Hotové scénáře (19. 11. 2026, tým *My Team*, zóna eu1)
| Scénář | ID | Webhook | Kdo ho volá |
|---|---|---|---|
| A: Mám zájem o prohlídku | 8675366 | „Pronájmy Západ – Mám zájem (zájemce)“ | formulář pod nabídkou |
| B: Podklady od majitele | 8675367 | „Pronájmy Západ – Podklady od majitele“ | serverová funkce `api/podklady` (proměnná `MAKE_WEBHOOK_URL`) |

**Adresy webhooků se do repozitáře nevkládají.** Jsou v Make (Scenarios → webhook) a nastavují se jen jako proměnné prostředí / v nastavení webu.

Oba scénáře dělají totéž: e-mail makléři na `alfaestate@alfaestate.info`, potvrzení odesílateli, řádek do tabulky. Pořadí kroků je záměrné (e-maily dřív než tabulka), takže chyba zápisu neodepře makléři upozornění. Neplatný e-mail nebo chybějící souhlas se zahodí.

### Poučení z nasazení
- E-mailový modul je `google-email:sendAnEmail` ve **verzi 4** (starší `ActionSendEmail` verze 2 s tímto propojením nefunguje).
- Zápis do Sheets vyžaduje `valueInputOption: RAW`. Díky tomu se texty od návštěvníků vloží jako prostý text a **nemůže se z nich v tabulce stát vzorec** (otestováno s textem `=1+1`).
- Texty od návštěvníků se v e-mailech escapují (`escapeHTML`), aby šlo do upozornění vložit HTML.
- List v tabulce se jmenuje **„Untitled“**. Přejmenování listu rozbije zápis, dokud se v modulu „Add a Row“ nezmění název listu.
- Tarif Make nyní povoluje **2 aktivní scénáře**. Další (kontrola Softrealu) vyžaduje vyšší tarif.
