"""Texty právních stránek: zásady ochrany osobních údajů a zásady cookies.

Změníte-li zpracování údajů (nový nástroj, nová lhůta, nový zpracovatel), upravte i tyto texty a docs/GDPR.md.
"""

EFFECTIVE = "19. 11. 2026"


def privacy_html(co, e):
    """Základ: zásady realitní kanceláře na alfaestate.cz (úvod, právní základy, doba uchování, práva, kontakt),
    rozšířené o to, jak funguje tento web: konkrétní formuláře, fotografie, zpracovatelé, předání mimo EU,
    automatické mazání, analytika. Viz docs/GDPR.md."""
    seat, street, zipc, city, district = e(co["seat"]), e(co["street"]), co["zip"], e(co["city"]), e(co["district"])
    return f'''<section><div class="wrap"><div class="prose legal">
<p class="crumbs" style="color:var(--muted)"><a href="/">Pronájmy Západ</a> › Ochrana osobních údajů</p>
<h1 style="font-size:2.4rem">Zásady ochrany osobních údajů</h1>
<p>Společnost ALFA ESTATE V&amp;S Partners s. r. o. zpracovává osobní údaje v souladu s Nařízením Evropského parlamentu a Rady (EU) 2016/679 (GDPR) a zákonem č. 110/2019 Sb., o zpracování osobních údajů. Tyto zásady popisují, jak se údaje zpracovávají na webu Pronájmy Západ.</p>

<h2>1. Správce osobních údajů</h2>
<p><b>{e(co["name"])}</b><br>Sídlo: {seat}<br>Provozovna: {street}, {zipc} {city} – {district}<br>IČO: {co["ico"]}<br>Zapsaná v obchodním rejstříku vedeném u Krajského soudu v Plzni<br>E-mail: <a href="mailto:{co["email"]}">{co["email"]}</a><br>Telefon: {co["phones"][0][0]}</p>
<p>Web Pronájmy Západ provozuje realitní kancelář. Obecné informace o realitní kanceláři najdete na <a href="https://alfaestate.cz" rel="noopener">alfaestate.cz</a>.</p>

<h2>2. Jaké osobní údaje zpracováváme, proč a jak dlouho</h2>
<div class="tw"><table class="facts-t lt">
<thead><tr><th>Situace</th><th>Údaje</th><th>Účel a právní základ</th><th>Doba uchování</th></tr></thead>
<tbody>
<tr><td><b>Nabídnete nám nemovitost</b> (formulář pro majitele)</td><td>Jméno, telefon, e-mail. Typ, dispozice, město, plocha, požadované nájemné, termín, popis nemovitosti, zájem o služby. Fotografie nemovitosti.</td><td>Vyřízení vaší nabídky, domluva spolupráce a příprava inzerce. Právní základ: oprávněný zájem, resp. kroky před uzavřením smlouvy na vaši žádost (čl. 6 odst. 1 písm. f) a b) GDPR).</td><td>Neveřejná databáze a úložiště, automatické smazání včetně fotografií: nezpracované podklady po 90 dnech od posledního pohybu, převzaté po 90 dnech od převzetí, zamítnuté po 30 dnech, nedokončená odeslání po 1 dni. Údaje, které si realitní kancelář převezme do své evidence k poskytnutí realitních služeb, se dále řídí smlouvou a zákonnými povinnostmi (např. účetní doklady po dobu 10 let).</td></tr>
<tr><td><b>Požádáte o prohlídku</b> (formulář „Mám zájem“ u nabídky)</td><td>Jméno, telefon, e-mail, vaše zpráva a nabídka, o kterou máte zájem.</td><td>Vyřízení poptávky a komunikace s vámi, domluva prohlídky. Právní základ: oprávněný zájem, resp. kroky před uzavřením smlouvy (čl. 6 odst. 1 písm. f) a b)).</td><td>Údaje z nezávazné poptávky zpracováváme po dobu nezbytnou k jejímu vyřízení.</td></tr>
<tr><td><b>Potvrzení o přijetí</b></td><td>Váš e-mail a jméno.</td><td>Automatický e-mail, že jsme vaši poptávku obdrželi. Součást vyřízení poptávky.</td><td>Jako e-mail v naší schránce, po dobu nezbytnou k vyřízení poptávky.</td></tr>
<tr><td><b>Poskytnutí realitních služeb</b></td><td>Údaje nezbytné pro zprostředkování prodeje, koupě nebo pronájmu nemovitosti.</td><td>Plnění smlouvy. Zákonné povinnosti, zejména účetní a daňové (právní povinnost).</td><td>Po dobu trvání smlouvy a po dobu stanovenou právními předpisy.</td></tr>
<tr><td><b>Ochrana formulářů před zneužitím</b></td><td>Ověření Cloudflare Turnstile, nevratný otisk (hash) IP adresy, čas odeslání.</td><td>Ochrana webu před spamem a zneužitím. Právní základ: oprávněný zájem na zabezpečení služby (čl. 6 odst. 1 písm. f).</td><td>Otisk IP adresy 1 den. Provozní záznamy hostingu krátkodobě podle nastavení poskytovatele.</td></tr>
<tr><td><b>Návštěva webu</b></td><td>Technické údaje (IP adresa, typ prohlížeče, čas přístupu), které zpracovává hosting při doručení stránky.</td><td>Provoz a bezpečnost webu. Právní základ: oprávněný zájem (čl. 6 odst. 1 písm. f).</td><td>Krátkodobě v provozních záznamech.</td></tr>
<tr><td><b>Analýza návštěvnosti</b></td><td>Cookies, viz <a href="/cookies/">zásady používání cookies</a>.</td><td>Tento web analytiku v tuto chvíli nepoužívá. Pokud ji zavedeme, bude to pouze na základě vašeho souhlasu (cookies).</td><td>Podle zásad cookies, souhlas lze kdykoli odvolat.</td></tr>
</tbody></table></div>
<p>Osobní údaje uchováváme pouze po dobu nezbytně nutnou k naplnění uvedených účelů, nejdéle po dobu stanovenou právními předpisy. Údaje z formulářů nám poskytujete dobrovolně, bez jména, telefonu a e-mailu vám ale nemůžeme odpovědět. Zaškrtnutím políčka ve formuláři potvrzujete, že jste se s těmito zásadami seznámil(a). Zpracování nestojí na vašem souhlasu. Údaje nepoužíváme k reklamě, neprodáváme je a neprovádíme s nimi automatizované rozhodování ani profilování.</p>

<h2>3. Fotografie nemovitosti</h2>
<p>Nahrávejte prosím jen fotografie nemovitosti, na kterých nejsou osoby, doklady, registrační značky ani jiné osobní údaje třetích osob. Odesláním potvrzujete, že máte právo fotografie poskytnout. Fotografie jsou uložené v neveřejném úložišti a vidí je jen pověření pracovníci realitní kanceláře. Na webu je zveřejníme až po domluvě s vámi.</p>

<h2>4. Příjemci a zpracovatelé</h2>
<p>Osobní údaje můžeme předat zpracovatelům, kteří pro nás zajišťují provoz webu, e-mailové a IT služby, účetnictví či právní servis, vždy na základě smlouvy a při zachování odpovídající úrovně ochrany. Provoz tohoto webu zajišťují zejména:</p>
<div class="tw"><table class="facts-t lt">
<thead><tr><th>Zpracovatel</th><th>K čemu slouží</th><th>Kde se zpracovává</th></tr></thead>
<tbody>
<tr><td>Vercel Inc.</td><td>Hosting webu a serverové funkce, které přijímají odeslané formuláře.</td><td>Funkce běží v EU (Dublin, Irsko). Společnost sídlí v USA.</td></tr>
<tr><td>Supabase Inc.</td><td>Databáze podkladů od majitelů a neveřejné úložiště fotografií.</td><td>EU (Irsko). Společnost sídlí v USA.</td></tr>
<tr><td>Make (Celonis)</td><td>Automatizace: předání poptávky do e-mailu a tabulky.</td><td>Datové centrum v EU.</td></tr>
<tr><td>Google (Gmail, Google Sheets)</td><td>Odesílání a příjem e-mailů, tabulka s poptávkami.</td><td>Podle nastavení účtu Google, společnost sídlí v USA.</td></tr>
<tr><td>Cloudflare, Inc.</td><td>Ověření Turnstile u formulářů proti robotům.</td><td>Celosvětová síť, společnost sídlí v USA.</td></tr>
</tbody></table></div>
<p>K údajům mají přístup také pověření pracovníci realitní kanceláře a informační systémy, které realitní kancelář používá při zprostředkování (včetně realitního software), vždy jen v rozsahu nezbytném pro jejich činnost.</p>

<h2>5. Předání údajů mimo EU</h2>
<p>Údaje z formulářů se ukládají na serverech v EU. Někteří zpracovatelé jsou ale americké společnosti. Předání údajů je v takovém případě zajištěno rozhodnutím Evropské komise o odpovídající ochraně (rámec EU–USA Data Privacy Framework), případně standardními smluvními doložkami.</p>

<h2>6. Vaše práva</h2>
<p>V souvislosti se zpracováním máte právo:</p>
<ul>
<li>na přístup ke svým osobním údajům,</li>
<li>na opravu nebo výmaz údajů,</li>
<li>na omezení zpracování a vznesení námitky,</li>
<li>na přenositelnost údajů,</li>
<li>kdykoli odvolat udělený souhlas (týká se případných volitelných cookies),</li>
<li>podat stížnost u Úřadu pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7, <a href="https://www.uoou.cz" rel="noopener">uoou.cz</a>.</li>
</ul>
<p>Žádost nám pošlete na <a href="mailto:{co["email"]}">{co["email"]}</a>. Odpovíme nejpozději do jednoho měsíce. Pomůže nám, když uvedete jméno a e-mail, které jste ve formuláři použil(a).</p>

<h2>7. Jak údaje chráníme</h2>
<p>Web a formuláře používají šifrované spojení (HTTPS). Podklady od majitelů a fotografie jsou v neveřejné databázi a úložišti, přístupné jen přihlášeným pracovníkům realitní kanceláře. Formuláře jsou chráněné proti zneužití a údaje se po uvedených lhůtách automaticky mažou.</p>

<h2>8. Děti</h2>
<p>Web je určen dospělým osobám. Vědomě neshromažďujeme údaje osob mladších 18 let.</p>

<h2>9. Cookies</h2>
<p>Informace o cookies a podobných technologiích najdete v <a href="/cookies/">zásadách používání cookies</a>.</p>

<h2>10. Kontakt a změny zásad</h2>
<p>S jakýmkoli dotazem ohledně zpracování osobních údajů se na nás můžete obrátit na e-mailu <a href="mailto:{co["email"]}">{co["email"]}</a>. Zásady můžeme aktualizovat, aktuální znění je vždy na této stránce.</p>
<p><b>Účinné od: {EFFECTIVE}</b></p>
</div></div></section>'''


def cookies_html(co, e, consent_on, ga_id):
    if consent_on:
        table = f'''<div class="tw"><table class="facts-t lt">
<thead><tr><th>Název</th><th>Poskytovatel</th><th>Účel</th><th>Kategorie</th><th>Doba</th></tr></thead>
<tbody>
<tr><td><code>pz_consent</code> (úložiště prohlížeče)</td><td>Tento web</td><td>Uchová vaše rozhodnutí o cookies, aby se lišta nezobrazovala při každé návštěvě.</td><td>Nezbytné</td><td>Do změny nebo smazání</td></tr>
<tr><td><code>_ga</code>, <code>_ga_{e(ga_id.replace("G-", ""))}</code></td><td>Google LLC</td><td>Měření návštěvnosti webu (kolik lidí web navštěvuje, které stránky čtou). Data nejsou použita k reklamě.</td><td>Analytické (jen se souhlasem)</td><td>Až 2 roky</td></tr>
</tbody></table></div>
<p>Analytické cookies se načtou <b>až po vašem souhlasu</b>. Do té doby se žádné soubory Google nestahují. Souhlas můžete kdykoli změnit nebo odvolat přes odkaz <a href="#" data-cookie-settings>Nastavení cookies</a> v patičce stránky.</p>'''
        analytics = "Analytické cookies používáme jen pro měření návštěvnosti, a to pouze s vaším souhlasem."
    else:
        table = '''<p>V tuto chvíli web <b>nepoužívá žádné analytické ani marketingové cookies</b> a nenačítá žádné reklamní nebo sledovací nástroje. Proto vás nežádáme o souhlas lištou.</p>'''
        analytics = "Analytické ani marketingové cookies v tuto chvíli nepoužíváme. Pokud je někdy zavedeme, použijeme je až po vašem souhlasu a tyto zásady aktualizujeme."
    return f'''<section><div class="wrap"><div class="prose legal">
<p class="crumbs" style="color:var(--muted)"><a href="/">Pronájmy Západ</a> › Cookies</p>
<h1 style="font-size:2.4rem">Zásady používání cookies</h1>
<p><b>Účinné od {EFFECTIVE}.</b> Správcem je {e(co["name"])}, IČO {co["ico"]}. Obecné zásady zpracování osobních údajů najdete v <a href="/ochrana-osobnich-udaju/">zásadách ochrany osobních údajů</a>.</p>

<h2>Co jsou cookies</h2>
<p>Cookies jsou malé soubory, které si web ukládá ve vašem prohlížeči. Podobně fungují i jiné technologie, například úložiště prohlížeče (localStorage). V těchto zásadách je souhrnně nazýváme cookies.</p>

<h2>Které cookies používáme</h2>
{table}
<p>{analytics}</p>

<h2>Nezbytné technologie u formulářů</h2>
<p>Formuláře na webu chrání proti robotům služba Cloudflare Turnstile. Slouží výhradně k odlišení člověka od robota a je pro bezpečné fungování formulářů nezbytná. Při ověření může Cloudflare uložit technické údaje v prohlížeči. Nepoužívá je k reklamě ani k vytváření profilu návštěvníka. K ověření se používá jen při zobrazení formuláře.</p>

<h2>Přihlášení pracovníků</h2>
<p>Pracovníci realitní kanceláře, kteří zpracovávají podklady od majitelů, se přihlašují do neveřejné administrace. Přihlášení si uchovává v prohlížeči technické údaje o relaci. Veřejných návštěvníků se to netýká.</p>

<h2>Reklamní a sledovací cookies</h2>
<p>Web nepoužívá reklamní ani sledovací cookies třetích stran a nevkládá obsah z cizích služeb (mapy, videa, sociální sítě), který by je mohl nastavovat.</p>

<h2>Jak cookies spravovat</h2>
<p>Cookies můžete kdykoli smazat nebo zakázat v nastavení svého prohlížeče. Nezbytné technologie nelze vypnout, aniž by přestaly fungovat formuláře.</p>
</div></div></section>'''
