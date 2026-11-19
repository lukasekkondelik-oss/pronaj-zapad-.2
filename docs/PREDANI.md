# Předávací dokument

Souhrn pro předání provozu. Hodnoty s `…` se doplní při předání. **Hesla a klíče sem nepište**, patří do správce hesel.

## Z čeho web stojí a kdo to platí
| Služba | K čemu | Účet / vlastník | Tarif a limity |
|---|---|---|---|
| Vercel | hosting webu a funkcí, denní mazání | … | **Pro tarif je nutný pro komerční provoz**, ověřit |
| Supabase | databáze podkladů, fotky, přihlášení do administrace (EU, Irsko) | … | zdarma stačí; projekt se při neaktivitě 7 dní pozastavuje, viz níže |
| Make | e-maily o poptávkách, potvrzení zájemci, zápis do tabulky | … | zdarma: 2 aktivní scénáře, omezený počet operací. Scénář C (Softreal) vyžaduje vyšší tarif |
| Cloudflare Turnstile | ochrana formulářů před boty | … | zdarma |
| Google (tabulka, Gmail) | záloha poptávek, odesílání | alfaestate@alfaestate.info | – |
| Doména | adresa webu | … | cca … Kč/rok |
| Softreal | zdroj nabídek | klientka | případný poplatek za export hradí klientka |

## Kde co je
- Kód: GitHub repozitář (větev `main` se nasazuje na Vercel). Sestavení: `python3 tools/build.py`.
- Nastavení (proměnné prostředí) ve Vercelu: viz `docs/SETUP.md`. Make: `docs/MAKE.md`. Softreal: `docs/SOFTREAL.md`. GDPR: `docs/GDPR.md`.
- Administrace: `/admin/`. Účty se zakládají jen v Supabase (Authentication → Users), veřejná registrace je vypnutá.

## Provoz: co hlídat
- **Supabase pozastavení:** zdarma tarif pozastaví projekt po týdnu bez aktivity. Pravidelné mazání (cron) i formuláře aktivitu tvoří, ale při dlouhé pauze zkontrolujte Dashboard. Pro jistotu lze přejít na Pro.
- **Make:** pokud scénáře skončí chybou, Make pošle upozornění. Neúspěšné běhy: Make → Scenarios → History. Nedoručené podklady jsou i tak v administraci (označení „e-mail neodešel“).
- **Dostupnost:** doporučuji bezplatný hlídač (např. UptimeRobot) na úvodní stranu a `/api/poptavka` (očekává odpověď 405 na GET).
- **Certifikát a doména:** obnovení domény každý rok, Vercel spravuje HTTPS sám.

## Při výpadku
| Co nejede | Co to znamená | Co dělat |
|---|---|---|
| Formulář podkladů hlásí chybu | funkce nebo Supabase | Vercel → Logs; Supabase Dashboard (pozastaveno?) |
| Poptávka nepřišla e-mailem | Make | Make History; zájemce má kontakt na telefonu uvedený na webu |
| Nabídky na webu zastaralé | sestavení nebylo spuštěno | Vercel → Redeploy; zkontrolovat export Softrealu |
| Chrome hlásí „Nebezpečné“ | nová subdoména vercel.app | po připojení vlastní domény zmizí; případně žádost o přehodnocení v Google Search Console |

## Náklady (orientačně, doplnit podle aktuálních ceníků)
Vercel Pro, doména, případně Make vyšší tarif a Supabase Pro. Zdarma: Turnstile, Google.

## Zbývá před spuštěním
Viz Notion „Plán postupu v2“ (aktuální stav úkolů).
