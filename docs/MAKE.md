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

## Scénář v Make (dohodnutý rozsah)
Poptávky se ukládají **jen do Google Sheets** a chodí e-mailem. Žádné CRM, žádné úkoly, žádné připomínky.

1. **Webhooks → Custom webhook** (datová struktura podle tabulky výše, zapněte validaci).
2. **Filtr**: `souhlas` je vyplněné a `email` je platný e-mail.
3. **Google Sheets → Add a Row**: `odeslano`, `formular`, `jmeno`, `telefon`, `email`, `souhlas`, `zdroj`, nemovitost nebo nabídka a zpráva (jeden list, sloupce podle polí). Sloupce `souhlas` a `odeslano` jsou doklad souhlasu pro GDPR.
4. **E-mail týmu: „Nová poptávka“** na alfaestate@alfaestate.cz. U `zajemce` navíc kopie kontaktní osobě podle `kontakt` (Soňa / Vít).
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
