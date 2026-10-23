# Zpracování poptávek a automatické e-maily (Make)

Web posílá každý odeslaný formulář jako JSON metodou POST na jedinou adresu (`FORM_ENDPOINT` v `tools/build.py`),
tedy na **Custom webhook** v Make. Make poptávku zpracuje, uloží, rozešle e-maily a upozorní tým.

## Datový formát (webhook)
Společná pole: `formular` (`majitel` | `zajemce`), `jmeno`, `telefon`, `email`, `souhlas`, `zdroj` (cesta stránky), `odeslano` (ISO čas).

| `formular` | Odkud | Další pole |
|---|---|---|
| `majitel` | úvodní stránka, stránky měst | `typ`, `dispozice`, `mesto`, `od`, `plocha`, `najemne`, `popis`, `pomoc` |
| `zajemce` | detail nabídky | `nabidka_id`, `nabidka`, `nabidka_url`, `kontakt` (`sona` / `vit`), `zprava` |

Pole `web` je honeypot proti spamu: web ho při vyplnění neodešle vůbec, v Make přesto ponechte filtr „web je prázdné“.

## Scénář v Make (navržený)
1. **Webhooks → Custom webhook** (datová struktura podle tabulky výše, zapněte validaci).
2. **Filtr**: `souhlas` je vyplněné a `email` je platný e-mail.
3. **Uložení poptávky**: Google Sheets / Airtable / CRM. Ukládejte i `souhlas` a `odeslano` (doklad souhlasu pro GDPR).
4. **Router** podle `formular`:
   - **majitel**
     - interní e-mail na alfaestate@alfaestate.cz s přehledem nemovitosti,
     - potvrzovací e-mail odesílateli,
     - úkol / upozornění pro obchodníka (ClickUp, Slack nebo e-mail).
   - **zajemce**
     - interní e-mail kontaktní osobě podle `kontakt` (Soňa 603 382 392 / Vít 776 686 776) s odkazem `nabidka_url`,
     - potvrzovací e-mail zájemci,
     - záznam v tabulce poptávek u dané nabídky.
5. **Volitelně:** připomenutí obchodníkovi, pokud poptávka není do 24 h označená jako vyřízená.
6. **Ošetření chyb:** na chybu v kterémkoli kroku nastavte upozornění (jinak se poptávka může ztratit).

## Texty automatických e-mailů (návrh)
**Majiteli (potvrzení)**: *Předmět:* Děkujeme za vaši nabídku nemovitosti
> Dobrý den {{jmeno}}, děkujeme, že jste nám poslal(a) nabídku nemovitosti ({{typ}}, {{mesto}}). Ozveme se vám nejpozději v nejbližší pracovní den (Po–Pá 9:00–17:00). Pokud je to naléhavé, zavolejte na 603 382 392. ALFA ESTATE V&S Partners s.r.o.

**Zájemci (potvrzení)**: *Předmět:* Poptávka prohlídky: {{nabidka}}
> Dobrý den {{jmeno}}, děkujeme za zájem o nabídku „{{nabidka}}“ ({{nabidka_url}}). Brzy se vám ozveme a domluvíme prohlídku. Kontaktní osoba: {{kontakt jméno + telefon}}.

**Interní upozornění**: předmět `[Web] Nový majitel: {{mesto}}, {{typ}}` nebo `[Web] Zájem o prohlídku: {{nabidka}}`; tělo = všechna pole formuláře + telefon a e-mail na jedno kliknutí.

## Co zajistit mimo Make
- **Odesílání z domény alfaestate.cz**: nastavte SPF, DKIM a DMARC, jinak budou e-maily padat do spamu. Odesílejte přes Gmail / Microsoft 365 modul nebo SMTP firmy.
- **Právní text**: potvrzovací e-mail neobsahuje marketing. Pokud chcete posílat newslettery, je potřeba samostatný souhlas.
- **Limity Make**: bezplatný tarif má omezený počet operací, pro provoz s desítkami poptávek měsíčně zvažte placený tarif.

## Nastavení webu
V `tools/build.py` nastavte `FORM_ENDPOINT = "https://hook.eu2.make.com/…"` (URL z modulu Custom webhook) a znovu nasaďte.
