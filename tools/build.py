#!/usr/bin/env python3
"""Vygeneruje statický web do kořene repozitáře. Spuštění: python3 tools/build.py

Změna domény, kontaktů nebo textů = úprava konstant níže a nové spuštění.
"""
import json, html, pathlib, datetime, os, re, shutil, unicodedata, urllib.request, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "dist"
STATIC = ROOT / "static"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
LISTINGS = []
DOMAIN = "https://pronajemzapad.cz"          # TODO: nahradit skutečnou doménou
FORM_ENDPOINT = ""                            # TODO: URL formulářového backendu (n8n webhook, Formspree…); prázdné = mailto
MAIN_SITE = "https://alfaestate.cz"
TODAY = datetime.date.today().isoformat()

CO = dict(
    name="ALFA ESTATE V&S Partners s.r.o.", ico="10799796",
    street="Majakovského 707/29", zip="360 05", city="Karlovy Vary", district="Rybáře",
    seat="V. Meerwalda 57/8, 360 06 Karlovy Vary – Dvory",
    email="alfaestate@alfaestate.cz",
    phones=[("603 382 392", "+420603382392", "Soňa Petříková"), ("776 686 776", "+420776686776", "Vít Čirik")],
)
E = html.escape

ICON = {
 "check": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/></svg>',
 "doc": '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></svg>',
 "cam": '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
 "key": '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3M14 9l2 2"/></svg>',
 "home": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M10 20v-6h4v6"/></svg>',
 "chat": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
 "pen": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v4h4"/></svg>',
 "user": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
 "image": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m4 18 5-5 4 4 3-3 4 4"/></svg>',
}
ROOF = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 20 20 7l15 13"/><path d="M10 18v15h20V18M17 33V24h6v9"/></svg>'
SKYLINE = '''<svg class="sky" viewBox="0 0 800 260" fill="currentColor" aria-hidden="true"><path d="M0 260V170h40v-30h50v40h30V120l40-30 40 30v60h40V140h60v-50l20-24 20 24v50h50V110h50V70l30-30 30 30v40h40v60h50V130h60v130z"/><path opacity=".6" d="M0 260v-60h60v-20h40v30h50v-40h70v50h60v-30h80v40h60v-60h70v70h80v-50h70v70z"/></svg>'''

# ---------- FAQ (jeden zdroj pro HTML i FAQPage JSON-LD) ----------
FAQ = [
 ("Je zveřejnění inzerátu na portálu opravdu zdarma?",
  "Ano. Vložení a zveřejnění inzerátu je pro majitele zdarma. Doplňkové služby, například profesionální fotografie, zajištění prohlídek nebo příprava nájemní smlouvy, se sjednávají předem a jen podle toho, co skutečně potřebujete."),
 ("Musím využít kompletní služby realitní kanceláře?",
  "Ne. Můžete začít pouhým zveřejněním nabídky a ostatní služby si přidat později. Rozsah spolupráce určujete vy."),
 ("Zajistíte také fotografie a text inzerátu?",
  "Ano, pomůžeme s přípravou textu i fotografií, aby nabídka dobře vynikla. Rozsah a případnou cenu doladíme předem, než se do čehokoli pustíme."),
 ("Jaké nemovitosti pronajímáte a ve kterých lokalitách?",
  "Zaměřujeme se na pronájem bytů a domů v Karlovarském kraji, především v Karlových Varech, Chebu, Sokolově, Mariánských Lázních a Ostrově. Jiná lokalita nebo typ nemovitosti? Napište nám, rádi se podíváme."),
 ("Co budu potřebovat k zahájení pronájmu?",
  "Stačí základní informace o nemovitosti, vaše kontakty a od kdy je volná. Pro uzavření smlouvy pak typicky potřebujeme doklad o vlastnictví a v případě, že se na vaši nemovitost vztahuje povinnost, také průkaz energetické náročnosti budovy (PENB). Vše vám rádi vysvětlíme."),
 ("Pomůžete mi s nájemní smlouvou?",
  "Ano, pomůžeme s přípravou nájemní smlouvy včetně předávacího protokolu. Smlouvu sestavujeme tak, aby odpovídala platné legislativě a vaší konkrétní situaci."),
 ("Jak vysokou jistotu (kauci) mohu po nájemníkovi chtít?",
  "Podle občanského zákoníku může jistota činit nejvýše trojnásobek měsíčního nájemného (bez plateb za služby). Jak ji správně ošetřit ve smlouvě, vám poradíme."),
 ("Jak rychle se ozvete po odeslání formuláře?",
  "Standardně se ozýváme v pracovní dny v době 9:00–17:00. Pokud je vaše věc naléhavá, zavolejte nám přímo na 603 382 392."),
]

PLACES = {
 "karlovy-vary": dict(name="Karlovy Vary", loc="v Karlových Varech", sub="Sídlo naší kanceláře",
   title="Pronájem bytu a domu v Karlových Varech pro majitele",
   desc="Pronajímáte byt nebo dům v Karlových Varech? Zveřejnění nabídky zdarma, pomoc s fotkami, prohlídkami i nájemní smlouvou. Místní realitní kancelář ALFA ESTATE.",
   intro="Karlovy Vary jsou naší domovskou adresou. Kancelář máme v Rybářích a trh v okolí známe z každodenní praxe. Pomůžeme vám nastavit nájemné, připravit nabídku a najít vhodného nájemníka.",
   body=["Poptávka v lázeňském městě má svá specifika: různé čtvrti (Rybáře, Drahovice, Tuhnice, Doubí, Dvory, Stará Role a další) oslovují odlišné zájemce a podle toho je třeba nemovitost prezentovat. Hned na začátku s vámi proto probereme, komu je váš byt nebo dům nejvíc určen.",
         "Zveřejnění nabídky na portálu je zdarma. Fotografie, prohlídky, komunikaci se zájemci i nájemní smlouvu zajistíme podle domluvy."],
   faq=[("Kde sídlíte v Karlových Varech?", "Naše provozovna je na adrese Majakovského 707/29, 360 05 Karlovy Vary – Rybáře. Po telefonické domluvě se rádi sejdeme osobně.")]),
 "cheb": dict(name="Cheb", loc="v Chebu", sub="Západ kraje u hranic",
   title="Pronájem bytu a domu v Chebu pro majitele",
   desc="Pronajímáte nemovitost v Chebu? Zveřejníme vaši nabídku zdarma a pomůžeme s prohlídkami, texty, fotografiemi i nájemní smlouvou. ALFA ESTATE, Karlovarský kraj.",
   intro="Cheb leží na západním okraji kraje, blízko hranice s Německem. Pomůžeme vám s pronájmem bytu nebo domu tak, abyste se mohli věnovat svým věcem a nabídka za vás pracovala.",
   body=["Každá lokalita má jiné zájemce. Při přípravě inzerátu proto spolu probereme, komu je nemovitost určena, a podle toho zvolíme text, fotografie i nastavení nájemného.",
         "Zveřejnění nabídky je zdarma. Doplňkové služby (fotografie, prohlídky, smlouva) sjednáváme předem a podle vašich potřeb."],
   faq=[("Působíte i mimo Karlovy Vary?", "Ano, pronájmy zajišťujeme v celém Karlovarském kraji, včetně Chebu. Na prohlídku nemovitosti za vámi přijedeme.")]),
 "sokolov": dict(name="Sokolov", loc="v Sokolově", sub="Průmyslové centrum kraje",
   title="Pronájem bytu a domu v Sokolově pro majitele",
   desc="Pronajímáte byt nebo dům v Sokolově? Nabídku zveřejníme zdarma, pomůžeme s prohlídkami, fotografiemi i nájemní smlouvou. ALFA ESTATE, Karlovarský kraj.",
   intro="Sokolov je jedním z největších měst kraje a často se tu pronajímá nemovitost zaměstnancům z okolních firem i místním rodinám. Pomůžeme vám najít nájemníka, který odpovídá vašim představám.",
   body=["Při přípravě nabídky společně určíme, komu je byt nebo dům nejvíc určen, a podle toho nastavíme prezentaci i cenu. Realistické nájemné je základ rychlé a bezproblémové spolupráce.",
         "Zveřejnění nabídky je zdarma. Prohlídky, komunikaci se zájemci i smlouvu můžeme převzít, pokud si to přejete."],
   faq=[("Přijedete se na nemovitost podívat osobně?", "Ano. Nemovitost si prohlédneme, nafotíme a společně doladíme, jak ji nabídnout.")]),
 "marianske-lazne": dict(name="Mariánské Lázně", loc="v Mariánských Lázních", sub="Lázeňské město",
   title="Pronájem bytu a domu v Mariánských Lázních pro majitele",
   desc="Pronajímáte nemovitost v Mariánských Lázních? Zveřejnění zdarma, pomoc s fotkami, prohlídkami a nájemní smlouvou. Regionální portál ALFA ESTATE.",
   intro="Mariánské Lázně mají specifický trh: lázeňský charakter města přitahuje různé typy nájemníků. Pomůžeme vám nabídku nastavit tak, aby oslovila ty správné.",
   body=["Než nabídku zveřejníme, probereme s vámi, zda je pro vaši nemovitost nejvhodnější dlouhodobý pronájem, a nastavíme podmínky tak, aby vám vyhovovaly.",
         "Zveřejnění nabídky je zdarma. Fotografie, prohlídky i nájemní smlouvu zajistíme podle domluvy."],
   faq=[("Zajišťujete i krátkodobé pronájmy?", "Zaměřujeme se především na dlouhodobý pronájem bydlení. Pokud uvažujete o jiném řešení, napište nám a probereme možnosti individuálně.")]),
 "ostrov": dict(name="Ostrov", loc="v Ostrově", sub="Blízko Karlových Varů",
   title="Pronájem bytu a domu v Ostrově pro majitele",
   desc="Pronajímáte byt nebo dům v Ostrově u Karlových Varů? Nabídku zveřejníme zdarma a pomůžeme s prohlídkami i nájemní smlouvou. ALFA ESTATE.",
   intro="Ostrov leží nedaleko Karlových Varů a pro mnoho nájemníků je vyhledávanou alternativou k bydlení přímo ve velkém městě. Pomůžeme vám dobře nabídku zacílit.",
   body=["Při přípravě nabídky vyzdvihneme to, co je pro nájemníky důležité: dostupnost, vybavení, dispozici i okolí. Vše probereme s vámi předem.",
         "Zveřejnění nabídky je zdarma. Doplňkové služby sjednáváme jen podle vašich potřeb."],
   faq=[("Jak dlouho trvá, než nabídku zveřejníte?", "Jakmile máme základní informace a podklady, zveřejnění připravíme co nejdříve. Konkrétní termín vám sdělíme při prvním kontaktu.")]),
}

def url(path): return DOMAIN + path

def faq_html(items):
    return "".join(f"<details><summary>{E(q)}</summary><p>{E(a)}</p></details>" for q, a in items)

def form_html(idp="f", place=None):
    opts = lambda xs: "".join(f'<option>{E(x)}</option>' for x in xs)
    city = place["name"] if place else ""
    O_TYP, O_DISP, O_POMOC = opts(["Byt","Rodinný dům","Chata / rekreační objekt","Komerční prostor","Jiné"]), opts(["Garsonka","1+kk","1+1","2+kk","2+1","3+kk","3+1","4+kk a větší","Jiná"]), opts(["Jen zveřejnění nabídky","Zveřejnění + fotografie a text","Prohlídky a komunikace se zájemci","Nájemní smlouva","Kompletní servis","Zatím nevím, poraďte mi"])
    return f'''<form class="form" data-lead data-endpoint="{E(FORM_ENDPOINT)}" id="{idp}-form" novalidate>
<h3>Moje nemovitost</h3>
<div class="row"><div><label for="{idp}-typ">Typ nemovitosti</label><select id="{idp}-typ" name="typ" required><option value="">Vyberte typ</option>{O_TYP}</select></div>
<div><label for="{idp}-disp">Dispozice</label><select id="{idp}-disp" name="dispozice"><option value="">Vyberte dispozici</option>{O_DISP}</select></div></div>
<div class="row"><div><label for="{idp}-mesto">Město / obec</label><input id="{idp}-mesto" name="mesto" value="{E(city)}" placeholder="Např. Karlovy Vary" required autocomplete="address-level2"></div>
<div><label for="{idp}-od">K dispozici od</label><input id="{idp}-od" name="od" type="date"></div></div>
<div class="row"><div><label for="{idp}-plocha">Plocha (m²)</label><input id="{idp}-plocha" name="plocha" inputmode="numeric" placeholder="Např. 60"></div>
<div><label for="{idp}-najem">Požadované nájemné (Kč/měs.)</label><input id="{idp}-najem" name="najemne" inputmode="numeric" placeholder="Např. 15 000"></div></div>
<div class="row one"><div><label for="{idp}-popis">Krátký popis nemovitosti</label><textarea id="{idp}-popis" name="popis" placeholder="Základní informace o nemovitosti, stav, vybavení…"></textarea></div></div>
<div class="row one"><div><label for="{idp}-pomoc">O jakou pomoc máte zájem?</label><select id="{idp}-pomoc" name="pomoc"><option value="">Vyberte možnost</option>{O_POMOC}</select></div></div>
<div class="row"><div><label for="{idp}-jmeno">Jméno a příjmení</label><input id="{idp}-jmeno" name="jmeno" placeholder="Vaše jméno" required autocomplete="name"></div>
<div><label for="{idp}-tel">Telefon</label><input id="{idp}-tel" name="telefon" type="tel" placeholder="Např. 603 382 392" required autocomplete="tel"></div></div>
<div class="row one"><div><label for="{idp}-email">E-mail</label><input id="{idp}-email" name="email" type="email" placeholder="Váš e-mail" required autocomplete="email"></div></div>
<div class="hp" aria-hidden="true"><label>Web<input name="web" tabindex="-1" autocomplete="off"></label></div>
<label class="consent"><input type="checkbox" name="souhlas" required> <span>Souhlasím se zpracováním osobních údajů pro účely vyřízení mé poptávky. <a href="/ochrana-osobnich-udaju/">Více informací</a></span></label>
<button class="btn" type="submit">Odeslat nabídku →</button>
<p class="msg" role="status" aria-live="polite"></p>
</form>'''

def header(active=""):
    return f'''<a class="skip" href="#obsah">Přeskočit na obsah</a>
<header class="hdr"><div class="wrap">
<a class="brand" href="/" aria-label="Pronájmy Západ – úvodní strana">{ROOF}<span><b>Pronájmy Západ</b><small>Karlovarský kraj</small></span></a>
<button class="burger" aria-expanded="false" aria-controls="nav">Menu</button>
<nav class="nav" id="nav" aria-label="Hlavní navigace">
<a href="/nabidky/">Nabídky</a><a href="/#jak-to-funguje">Pro majitele</a><a href="/#lokality">Lokality</a><a href="/#faq">Časté dotazy</a>
<a class="btn sm" href="/#formular">Vložit nabídku zdarma</a></nav></div></header>'''

def footer():
    ph = "".join(f'<li><a href="tel:{t}">{n}</a><br><small>{w}</small></li>' for n, t, w in CO["phones"])
    pl = "".join(f'<li><a href="/pronajem-{s}/">Pronájem {E(p["name"])}</a></li>' for s, p in PLACES.items())
    return f'''<footer class="ftr"><div class="wrap">
<div class="cols">
<div><a class="brand" href="/">{ROOF}<span><b>Pronájmy Západ</b><small>Karlovarský kraj</small></span></a>
<p style="margin-top:18px">Regionální portál pronájmů pro majitele nemovitostí. Provozuje realitní kancelář <a href="{MAIN_SITE}" rel="noopener">ALFA ESTATE V&amp;S Partners</a>, certifikovanou realitní kancelář v Karlových Varech. Člen Realitní komory ČR.</p></div>
<div><h4>Lokality</h4><ul><li><a href="/nabidky/">Aktuální nabídky</a></li>{pl}</ul></div>
<div><h4>Kontakt</h4><ul>
<li>{E(CO["street"])}, {E(CO["district"])}<br>{CO["zip"]} {CO["city"]}</li>{ph}
<li><a href="mailto:{CO["email"]}">{CO["email"]}</a></li><li>IČO: {CO["ico"]}</li></ul></div>
<div><h4>Otevírací doba</h4><ul><li>Po – Pá: 9:00 – 17:00</li><li>Sobota: dle dohody</li><li>Neděle: zavřeno</li>
<li><a class="btn sm" href="/#formular" style="color:var(--navy);margin-top:8px">Nabídnout nemovitost</a></li>
<li><a href="{MAIN_SITE}" rel="noopener">Hlavní web ALFA ESTATE →</a></li></ul></div>
</div>
<div class="legal"><span>© {datetime.date.today().year} {E(CO["name"])} · IČO {CO["ico"]} · Sídlo: {E(CO["seat"])}</span>
<span><a href="/ochrana-osobnich-udaju/">Ochrana osobních údajů</a> · <a href="{MAIN_SITE}" rel="noopener">alfaestate.cz</a></span></div>
</div></footer><script src="/assets/main.js" defer></script>'''

ORG = {
 "@type": ["RealEstateAgent", "LocalBusiness"], "@id": DOMAIN + "/#org",
 "name": "ALFA ESTATE V&S Partners s.r.o.", "alternateName": "Pronájmy Západ",
 "url": MAIN_SITE + "/", "logo": DOMAIN + "/assets/favicon.svg",
 "taxID": CO["ico"], "vatID": None,
 "telephone": "+420603382392", "email": CO["email"],
 "address": {"@type": "PostalAddress", "streetAddress": CO["street"], "addressLocality": "Karlovy Vary", "postalCode": "36005", "addressRegion": "Karlovarský kraj", "addressCountry": "CZ"},
 "openingHoursSpecification": [{"@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "09:00", "closes": "17:00"}],
 "areaServed": [{"@type": "AdministrativeArea", "name": "Karlovarský kraj"}],
 "memberOf": {"@type": "Organization", "name": "Realitní komora České republiky"},
 "contactPoint": [{"@type": "ContactPoint", "telephone": "+420603382392", "contactType": "customer service", "areaServed": "CZ", "availableLanguage": "cs"}],
 "employee": [{"@type": "Person", "name": "Soňa Petříková", "telephone": "+420603382392"}, {"@type": "Person", "name": "Vít Čirik", "telephone": "+420776686776"}],
}
ORG = {k: v for k, v in ORG.items() if v is not None}

def service(path, name, area):
    return {"@type": "Service", "@id": url(path) + "#service", "name": name, "serviceType": "Zprostředkování pronájmu nemovitostí pro majitele",
            "provider": {"@id": DOMAIN + "/#org"}, "areaServed": area,
            "offers": {"@type": "Offer", "description": "Zveřejnění nabídky pro majitele zdarma, doplňkové služby dle dohody.", "price": "0", "priceCurrency": "CZK"}}

def page(path, title, desc, body, graph, og_title=None):
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)
    return f'''<!doctype html>
<html lang="cs"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{url(path)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta name="theme-color" content="#0f1a2a">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website"><meta property="og:locale" content="cs_CZ">
<meta property="og:site_name" content="Pronájmy Západ"><meta property="og:title" content="{E(og_title or title)}">
<meta property="og:description" content="{E(desc)}"><meta property="og:url" content="{url(path)}">
<meta property="og:image" content="{DOMAIN}/assets/og.png"><meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/style.css">
<script type="application/ld+json">{ld}</script>
</head><body>
{header()}
<main id="obsah">{body}</main>
{footer()}
</body></html>'''

def write(path, content):
    p = OUT / path.strip("/") / "index.html" if path != "/" else OUT / "index.html"
    p.parent.mkdir(parents=True, exist_ok=True); p.write_text(content, encoding="utf-8")

# ---------- HOMEPAGE ----------
def home():
    ticks = [("home","Realistické nastavení nájemného","Díky znalosti místního trhu."),
             ("image","Kvalitní fotografie a poutavé texty","Vaše nabídka lépe vynikne."),
             ("chat","Komunikace se zájemci a prohlídky","Ušetříme vám čas a vyřídíme telefonáty."),
             ("pen","Pomoc s nájemní smlouvou","Využijte naše odborné zázemí."),
             ("user","Osobní odborník po celou dobu spolupráce","Známé prostředí, férové a lidské jednání.")]
    tk = "".join(f'<li>{ICON[i]}<div><b>{t}</b><span>{d}</span></div></li>' for i,t,d in ticks)
    places = "".join(f'<a class="place" href="/pronajem-{s}/"><b>{E(p["name"])}</b><span>{E(p["sub"])}</span></a>' for s,p in PLACES.items())
    body = f'''
<section class="hero dark" aria-labelledby="h1">{SKYLINE}<div class="wrap">
<span class="eyebrow">Regionální portál pronájmů · Karlovarský kraj</span>
<h1 id="h1">Váš byt si zaslouží <em>správného nájemníka.</em></h1>
<p class="lead">Pronajímáte byt nebo dům v Karlovarském kraji? Zveřejněte u nás svou nabídku bez poplatku. S přípravou inzerátu, prohlídkami i nájemní smlouvou vám můžeme pomoci.</p>
<div class="cta"><a class="btn" href="#formular">Chci nabídnout nemovitost →</a><a class="btn ghost" href="#jak-to-funguje">Jak spolupráce probíhá</a></div>
</div></section>
<div class="trust"><div class="wrap"><ul>
<li>{ICON["check"]}Inzerce pro majitele zdarma</li><li>{ICON["check"]}Osobní přístup v celém kraji</li><li>{ICON["check"]}Odborné zázemí ALFA ESTATE</li></ul></div></div>

<section id="pro-majitele"><div class="wrap">
<div class="head"><div><span class="eyebrow">Pro majitele nemovitostí</span><h2>Pronajímejte jednodušeji. Se zkušeným partnerem.</h2></div>
<p>Pomůžeme vám s přípravou inzerátu, odpovíme na telefonáty zájemců, zajistíme prohlídky a v případě potřeby i nájemní smlouvu. Vy se můžete soustředit na to podstatné.</p></div>
<div class="grid3">
<article class="card">{ICON["doc"]}<div class="n">01</div><h3>Zveřejnění nabídky</h3><p>Vložte základní informace o své nemovitosti. Inzerci zveřejníme zdarma.</p></article>
<article class="card">{ICON["cam"]}<div class="n">02</div><h3>Profesionální prezentace</h3><p>Připravíme poutavé fotografie a text, který osloví vhodné zájemce.</p></article>
<article class="card">{ICON["key"]}<div class="n">03</div><h3>Servis až do předání</h3><p>Postaráme se o komunikaci se zájemci, prohlídky a na přání i o nájemní smlouvu.</p></article>
</div></div></section>

<section class="alt" id="jak-to-funguje"><div class="wrap split">
<div><span class="eyebrow">Jak to funguje</span><h2>Od první zprávy k novému nájemníkovi.</h2>
<p style="color:var(--muted)">Jednoduchý proces, při kterém vás provedeme krok za krokem. Vše přizpůsobíme vašim potřebám.</p>
<a class="btn" href="#formular">Přidat svou nemovitost →</a></div>
<ol class="steps">
<li><div><b>Vyplníte krátký formulář</b><span>Stačí pár základních informací o nemovitosti.</span></div></li>
<li><div><b>Ozveme se a doladíme detaily</b><span>Probereme s vámi možnosti a zodpovíme dotazy.</span></div></li>
<li><div><b>Připravíme a zveřejníme nabídku</b><span>Postaráme se o text, fotografie a prezentaci.</span></div></li>
<li><div><b>Podle dohody zajistíme další servis</b><span>Například komunikaci se zájemci, prohlídky či nájemní smlouvu.</span></div></li>
</ol></div></section>

<section><div class="wrap split">
<div><span class="eyebrow">Co získáte</span><h2>Více než jen místo pro inzerát.</h2><ul class="ticks">{tk}</ul>
<p class="note"><b>Transparentně:</b> vložení a zveřejnění inzerátu je pro majitele zdarma. Doplňkové služby (např. fotografie, prohlídky, nájemní smlouva) se sjednávají předem podle vašich potřeb.</p></div>
<div class="panel"><div class="rule"></div><h2>Známe místní trh. A záleží nám na každé nabídce.</h2>
<p>Pronájmy Západ provozuje realitní kancelář <a href="{MAIN_SITE}" rel="noopener"><b>ALFA ESTATE</b></a>, která dlouhodobě působí v Karlovarském kraji. Spojujeme znalost regionu, profesionální přístup a osobní péči o každou nemovitost.</p>
<div class="facts"><div><b>16+ let</b>na realitním trhu Karlovarského kraje</div><div><b>Certifikovaná</b>realitní kancelář</div><div><b>Člen RK ČR</b>Realitní komory České republiky</div></div>
<p><a href="{MAIN_SITE}" rel="noopener">Více o realitní kanceláři na alfaestate.cz →</a></p></div>
</div></section>

{latest_block()}
<section class="alt" id="lokality"><div class="wrap">
<div class="head"><div><span class="eyebrow">Lokality</span><h2>Pronájmy v celém Karlovarském kraji.</h2></div><p>Vyberte město a zjistěte, jak vám pomůžeme s pronájmem právě tam.</p></div>
<div class="places">{places}</div></div></section>

<section class="formsec" id="formular"><div class="wrap fgrid">
<div><span class="eyebrow">Kontakt a formulář</span><h2>Vložte svůj pronájem zdarma.</h2>
<p style="color:var(--muted)">Vyplňte formulář a my se vám brzy ozveme. Rádi s vámi vše probereme osobně.</p>
<ul class="contact-lines">
{"".join(f'<li><a href="tel:{t}">{n}</a><small>{w}</small></li>' for n,t,w in CO["phones"])}
<li><a href="mailto:{CO["email"]}">{CO["email"]}</a></li>
<li><small>{CO["street"]}, {CO["zip"]} {CO["city"]} – {CO["district"]}<br>Po – Pá 9:00 – 17:00</small></li></ul></div>
{form_html("h")}</div></section>

<section id="faq"><div class="wrap faq">
<div><span class="eyebrow">Časté dotazy</span><h2>Na co se majitelé ptají?</h2></div>
<div>{faq_html(FAQ)}</div></div></section>'''
    graph = [ORG,
      {"@type": "WebSite", "@id": DOMAIN + "/#website", "url": DOMAIN + "/", "name": "Pronájmy Západ", "inLanguage": "cs", "publisher": {"@id": DOMAIN + "/#org"}},
      {"@type": "WebPage", "@id": DOMAIN + "/#webpage", "url": DOMAIN + "/", "name": "Pronájmy Západ – pronájem nemovitostí v Karlovarském kraji pro majitele", "isPartOf": {"@id": DOMAIN + "/#website"}, "about": {"@id": DOMAIN + "/#org"}, "inLanguage": "cs", "dateModified": TODAY},
      service("/", "Pronájem nemovitostí pro majitele v Karlovarském kraji", {"@type": "AdministrativeArea", "name": "Karlovarský kraj"}),
      {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]}]
    write("/", page("/", "Pronájem nemovitostí v Karlovarském kraji pro majitele | Pronájmy Západ",
        "Pronajímáte byt nebo dům v Karlovarském kraji? Zveřejnění nabídky zdarma, pomoc s fotkami, prohlídkami i nájemní smlouvou. Provozuje realitní kancelář ALFA ESTATE.", body, graph))

# ---------- MĚSTA ----------
def place_pages():
    for s, p in PLACES.items():
        path = f"/pronajem-{s}/"
        others = "".join(f'<a class="place" href="/pronajem-{o}/"><b>{E(q["name"])}</b><span>{E(q["sub"])}</span></a>' for o, q in PLACES.items() if o != s)
        faq = FAQ[:3] + p["faq"]
        body = f'''
<section class="hero dark" style="padding:64px 0 72px">{SKYLINE}<div class="wrap">
<p class="crumbs"><a href="/">Pronájmy Západ</a> › Pronájem {E(p["name"])}</p>
<h1 style="font-size:clamp(2rem,4.4vw,3.2rem);max-width:20ch">Pronájem nemovitosti {E(p["loc"])}</h1>
<p class="lead">{E(p["intro"])}</p>
<div class="cta"><a class="btn" href="#formular">Chci nabídnout nemovitost →</a><a class="btn ghost" href="tel:+420603382392">Zavolat 603 382 392</a></div></div></section>
<section><div class="wrap"><div class="prose"><h2>Jak vám pomůžeme {E(p["loc"])}</h2>
{"".join(f"<p>{E(x)}</p>" for x in p["body"])}
<ul class="ticks">{"".join(f'<li>{ICON[i]}<div><b>{t}</b></div></li>' for i,t in [("pen","Zveřejnění nabídky zdarma"),("image","Fotografie a poutavý text"),("chat","Prohlídky a komunikace se zájemci"),("home","Nájemní smlouva a předání")])}</ul>
<p class="note">Zveřejnění je pro majitele zdarma. Doplňkové služby se sjednávají předem. Zavolejte na <a href="tel:+420603382392">603 382 392</a> nebo vyplňte formulář níže.</p></div></div></section>
{city_block(p["name"])}
<section class="formsec" id="formular"><div class="wrap fgrid"><div><span class="eyebrow">Formulář</span><h2>Vložte pronájem {E(p["loc"])}.</h2><p style="color:var(--muted)">Vyplňte základní údaje a ozveme se vám.</p></div>{form_html("p", p)}</div></section>
<section class="alt"><div class="wrap"><h2>Časté dotazy</h2><div class="prose" style="max-width:820px">{faq_html(faq)}</div></div></section>
<section><div class="wrap"><h2>Další lokality</h2><div class="places" style="grid-template-columns:repeat(4,1fr)">{others}</div></div></section>'''
        area = {"@type": "City", "name": p["name"]}
        graph = [ORG,
          {"@type": "WebPage", "@id": url(path) + "#webpage", "url": url(path), "name": p["title"], "isPartOf": {"@id": DOMAIN + "/#website"}, "inLanguage": "cs", "dateModified": TODAY},
          {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Pronájmy Západ", "item": DOMAIN + "/"}, {"@type": "ListItem", "position": 2, "name": f"Pronájem {p['name']}", "item": url(path)}]},
          service(path, f"Pronájem nemovitostí {p['loc']} pro majitele", area),
          {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}]
        write(path, page(path, p["title"] + " | Pronájmy Západ", p["desc"], body, graph))

def privacy():
    path = "/ochrana-osobnich-udaju/"
    body = f'''<section><div class="wrap"><div class="prose"><p class="crumbs" style="color:var(--muted)"><a href="/">Pronájmy Západ</a> › Ochrana osobních údajů</p>
<h1 style="font-size:2.4rem">Ochrana osobních údajů</h1>
<p><b>Správce:</b> {E(CO["name"])}, IČO {CO["ico"]}, sídlo {E(CO["seat"])}. Provozovna: {CO["street"]}, {CO["zip"]} {CO["city"]} – {CO["district"]}. Kontakt: <a href="mailto:{CO["email"]}">{CO["email"]}</a>, <a href="tel:+420603382392">603 382 392</a>.</p>
<h2>Jaké údaje zpracováváme a proč</h2>
<p>Údaje z formuláře (jméno, telefon, e-mail a informace o nemovitosti) zpracováváme za účelem vyřízení vaší poptávky a případného uzavření smlouvy o zprostředkování. Právním základem je provedení opatření před uzavřením smlouvy na vaši žádost a náš oprávněný zájem na vyřízení dotazu.</p>
<h2>Jak dlouho údaje uchováváme</h2>
<p>Po dobu nezbytnou pro vyřízení poptávky a následně po dobu, kterou ukládá zákon nebo jejíž uchování je nezbytné k ochraně našich právních nároků.</p>
<h2>Vaše práva</h2>
<p>Máte právo na přístup k údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost a právo vznést námitku. Máte také právo podat stížnost u Úřadu pro ochranu osobních údajů (<a href="https://www.uoou.cz" rel="noopener">uoou.cz</a>).</p>
<h2>Cookies</h2>
<p>Tento web nepoužívá analytické ani marketingové cookies.</p>
<p><small>Text je vstupní návrh a před spuštěním by ho měl zkontrolovat právník nebo pověřená osoba správce.</small></p></div></div></section>'''
    graph = [ORG, {"@type": "WebPage", "@id": url(path) + "#webpage", "url": url(path), "name": "Ochrana osobních údajů", "inLanguage": "cs"}]
    html_ = page(path, "Ochrana osobních údajů | Pronájmy Západ", "Informace o zpracování osobních údajů na webu Pronájmy Západ.", body, graph).replace('content="index,follow,max-image-preview:large,max-snippet:-1"', 'content="noindex,follow"')
    write(path, html_)

def not_found():
    body = '<section><div class="wrap"><div class="prose"><h1>Stránka nenalezena</h1><p>Tuhle adresu neznáme. Vraťte se na <a href="/">úvodní stranu</a> nebo nám zavolejte na <a href="tel:+420603382392">603 382 392</a>.</p></div></div></section>'
    h = page("/404.html", "Stránka nenalezena | Pronájmy Západ", "Stránka nenalezena.", body, [ORG]).replace('content="index,follow,max-image-preview:large,max-snippet:-1"', 'content="noindex"')
    (OUT / "404.html").write_text(h, encoding="utf-8")

def static_files():
    paths = ["/", "/nabidky/"] + [f"/pronajem-{s}/" for s in PLACES] + [f"/nabidky/{l['slug']}/" for l in LISTINGS]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
        f"<url><loc>{url(p)}</loc><lastmod>{TODAY}</lastmod><priority>{'1.0' if p=='/' else '0.8'}</priority></url>\n" for p in paths) + "</urlset>\n"
    (OUT / "sitemap.xml").write_text(sm, encoding="utf-8")
    bots = ["GPTBot","OAI-SearchBot","ChatGPT-User","ClaudeBot","Claude-SearchBot","Claude-User","PerplexityBot","Perplexity-User","Google-Extended","Applebot-Extended","CCBot"]
    rb = "User-agent: *\nAllow: /\n\n" + "".join(f"User-agent: {b}\nAllow: /\n\n" for b in bots) + f"Sitemap: {DOMAIN}/sitemap.xml\n"
    (OUT / "robots.txt").write_text(rb, encoding="utf-8")
    ll = f"""# Pronájmy Západ

> Regionální portál pro majitele nemovitostí, kteří chtějí pronajmout byt nebo dům v Karlovarském kraji. Zveřejnění nabídky je pro majitele zdarma; doplňkové služby (fotografie, prohlídky, nájemní smlouva) se sjednávají předem. Portál provozuje realitní kancelář ALFA ESTATE V&S Partners s.r.o. (IČO {CO["ico"]}), Karlovy Vary, člen Realitní komory ČR.

## Hlavní stránky
- [Úvod – pronájem pro majitele]({DOMAIN}/): co nabízíme, jak spolupráce probíhá, formulář a časté dotazy
- [Aktuální nabídky pronájmů]({DOMAIN}/nabidky/): byty a domy k pronájmu v Karlovarském kraji
""" + "".join(f"- [Pronájem {p['name']}]({url(f'/pronajem-{s}/')}): {p['desc']}\n" for s, p in PLACES.items()) + f"""
## Aktuální nabídky
""" + ("".join(f"- [{l['title']}]({url('/nabidky/'+l['slug']+'/')}): {l['type']} {l.get('disposition') or ''}, {l['city']}, {czk(l['rent_czk'])}/měsíc\n" for l in LISTINGS) or "- Aktuálně žádné nabídky.\n") + f"""
## Fakta
- Oblast působnosti: Karlovarský kraj (Karlovy Vary, Cheb, Sokolov, Mariánské Lázně, Ostrov a okolí)
- Provozovna: {CO["street"]}, {CO["zip"]} {CO["city"]} – {CO["district"]}
- Telefon: 603 382 392 (Soňa Petříková), 776 686 776 (Vít Čirik)
- E-mail: {CO["email"]}
- Otevírací doba: Po–Pá 9:00–17:00, sobota dle dohody
- Hlavní web realitní kanceláře: {MAIN_SITE}/
"""
    (OUT / "llms.txt").write_text(ll, encoding="utf-8")

# ---------- NABÍDKY ----------
CONTACTS = {"sona": ("Soňa Petříková", "603 382 392", "+420603382392"), "vit": ("Vít Čirik", "776 686 776", "+420776686776")}
FURNISHED = {"ano": "Zařízeno", "castecne": "Částečně zařízeno", "ne": "Nezařízeno"}
SCHEMA_TYPE = {"Byt": "Apartment", "Rodinný dům": "House"}

def czk(n):
    return f"{int(n):,}".replace(",", " ") + " Kč"

def short_date(d):
    y, m, dd = d[:10].split("-")
    return f"{int(dd)}. {int(m)}. {y}"

def photo_url(path):
    return f"{SUPABASE_URL}/storage/v1/object/public/listings/{urllib.parse.quote(path)}" if SUPABASE_URL else "/assets/placeholder.svg"

def photos_of(l):
    return [{"url": photo_url(p["path"]), "alt": p.get("alt") or l["title"]} for p in (l.get("photos") or []) if p.get("path")]

def load_listings():
    """Supabase REST (anon klíč vidí jen zveřejněné nabídky). Bez konfigurace: prázdný seznam,
    nebo ukázková data při USE_SAMPLE=1."""
    if os.environ.get("USE_SAMPLE") == "1":
        return json.loads((ROOT / "tools" / "sample_listings.json").read_text(encoding="utf-8"))
    if not (SUPABASE_URL and SUPABASE_ANON_KEY):
        print("SUPABASE_URL / SUPABASE_ANON_KEY nenastaveno – nabídky budou prázdné.")
        return []
    q = f"{SUPABASE_URL}/rest/v1/listings?select=*&status=eq.published&order=published_at.desc"
    req = urllib.request.Request(q, headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {SUPABASE_ANON_KEY}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))

def card(l):
    ph = photos_of(l)
    img = (f'<img src="{E(ph[0]["url"])}" alt="{E(ph[0]["alt"])}" loading="lazy" width="640" height="440">' if ph
           else f'<div class="noimg">{ICON["image"]}</div>')
    meta = " · ".join(x for x in [l.get("disposition"), f'{l["area_m2"]} m²' if l.get("area_m2") else None] if x)
    where = l["city"] + (f' – {l["district"]}' if l.get("district") else "")
    return (f'<a class="lcard" href="/nabidky/{E(l["slug"])}/" data-city="{E(l["city"])}" data-type="{E(l["type"])}" '
            f'data-disp="{E(l.get("disposition") or "")}" data-rent="{int(l["rent_czk"])}">'
            f'<div class="lphoto">{img}</div><div class="lbody"><span class="lwhere">{E(where)}</span>'
            f'<h3>{E(l["title"])}</h3><span class="lmeta">{E(l["type"])}{" · " + E(meta) if meta else ""}</span>'
            f'<b class="lprice">{czk(l["rent_czk"])}<small> / měsíc</small></b></div></a>')

def latest_block():
    if not LISTINGS: return ""
    return ('<section id="nabidky"><div class="wrap"><div class="head"><div><span class="eyebrow">Aktuální nabídky</span><h2>Byty a domy k pronájmu.</h2></div>'
            '<p>Nemovitosti, které právě nabízíme v Karlovarském kraji.</p></div>'
            f'<div class="lgrid">{"".join(card(l) for l in LISTINGS[:3])}</div>'
            '<p style="margin-top:28px"><a class="btn" href="/nabidky/">Všechny nabídky →</a></p></div></section>')

def city_block(city):
    items = [l for l in LISTINGS if l["city"].lower() == city.lower()]
    if not items: return ""
    return (f'<section class="alt"><div class="wrap"><h2>Aktuální nabídky: {E(city)}</h2><div class="lgrid">{"".join(card(l) for l in items)}</div></div></section>')

def listings_page():
    path = "/nabidky/"
    cities = sorted({l["city"] for l in LISTINGS}); types = sorted({l["type"] for l in LISTINGS})
    disps = sorted({l["disposition"] for l in LISTINGS if l.get("disposition")})
    opt = lambda xs, ph: f'<option value="">{ph}</option>' + "".join(f'<option>{E(x)}</option>' for x in xs)
    if LISTINGS:
        inner = f'''<form class="filters" data-filters aria-label="Filtr nabídek">
<div><label for="fc">Město</label><select id="fc" data-f="city">{opt(cities,"Všechna")}</select></div>
<div><label for="ft">Typ</label><select id="ft" data-f="type">{opt(types,"Všechny")}</select></div>
<div><label for="fd">Dispozice</label><select id="fd" data-f="disp">{opt(disps,"Všechny")}</select></div>
<div><label for="fr">Nájemné do (Kč)</label><input id="fr" data-f="rent" inputmode="numeric" placeholder="Např. 18000"></div>
</form><p class="count" data-count aria-live="polite"></p>
<div class="lgrid" data-list>{"".join(card(l) for l in LISTINGS)}</div>
<p class="empty" data-empty hidden>Pro zvolený filtr nic nemáme. Zkuste ho upravit, nebo nám zavolejte na <a href="tel:+420603382392">603 382 392</a>.</p>'''
    else:
        inner = '<div class="note" style="max-width:640px"><b>Aktuálně nemáme žádné volné nabídky.</b> Hledáte byt nebo dům v Karlovarském kraji? Zavolejte nám na <a href="tel:+420603382392">603 382 392</a> nebo napište na <a href="mailto:alfaestate@alfaestate.cz">alfaestate@alfaestate.cz</a>. Nové nabídky přibývají průběžně.</div>'
    body = f'''<section class="hero dark" style="padding:56px 0 64px">{SKYLINE}<div class="wrap">
<p class="crumbs"><a href="/">Pronájmy Západ</a> › Nabídky</p>
<h1 style="font-size:clamp(2rem,4.4vw,3.2rem);max-width:22ch">Nabídky pronájmu v Karlovarském kraji</h1>
<p class="lead">Aktuální byty a domy k pronájmu. Ke každé nabídce rádi domluvíme prohlídku.</p></div></section>
<section><div class="wrap">{inner}</div></section>
<section class="alt"><div class="wrap split"><div><span class="eyebrow">Pro majitele</span><h2>Pronajímáte vlastní nemovitost?</h2><p style="color:var(--muted)">Zveřejnění nabídky je pro majitele zdarma.</p></div><div><a class="btn" href="/#formular">Chci nabídnout nemovitost →</a></div></div></section>'''
    graph = [ORG,
      {"@type": ["CollectionPage"], "@id": url(path) + "#webpage", "url": url(path), "name": "Nabídky pronájmu v Karlovarském kraji", "isPartOf": {"@id": DOMAIN + "/#website"}, "inLanguage": "cs", "dateModified": TODAY},
      {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Pronájmy Západ", "item": DOMAIN + "/"}, {"@type": "ListItem", "position": 2, "name": "Nabídky", "item": url(path)}]},
      {"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": url(f"/nabidky/{l['slug']}/"), "name": l["title"]} for i, l in enumerate(LISTINGS)]}]
    write(path, page(path, "Nabídky pronájmu bytů a domů v Karlovarském kraji | Pronájmy Západ",
        "Aktuální nabídky pronájmu bytů a domů v Karlovarském kraji: Karlovy Vary, Cheb, Sokolov, Mariánské Lázně a okolí. Prohlídky domluvíme rychle.", body, graph))

def listing_page(l):
    path = f"/nabidky/{l['slug']}/"
    ph = photos_of(l)
    name, phone, tel = CONTACTS.get(l.get("contact") or "sona", CONTACTS["sona"])
    where = l["city"] + (f' – {l["district"]}' if l.get("district") else "")
    facts = [("Typ", l["type"]), ("Dispozice", l.get("disposition")), ("Plocha", f'{l["area_m2"]} m²' if l.get("area_m2") else None),
             ("Podlaží", l.get("floor")), ("Lokalita", where), ("Vybavení", FURNISHED.get(l.get("furnished"))),
             ("Energetická třída (PENB)", l.get("energy_class")), ("Dostupné od", short_date(l["available_from"]) if l.get("available_from") else "ihned / dle dohody")]
    facts = "".join(f"<tr><th>{E(k)}</th><td>{E(str(v))}</td></tr>" for k, v in facts if v)
    money = [("Nájemné", czk(l["rent_czk"]) + " / měsíc")]
    if l.get("fees_czk"): money.append(("Zálohy na služby a energie", czk(l["fees_czk"]) + " / měsíc"))
    if l.get("deposit_czk"): money.append(("Jistota (kauce)", czk(l["deposit_czk"])))
    money = "".join(f"<tr><th>{E(k)}</th><td>{E(v)}</td></tr>" for k, v in money)
    desc_paras = [x.strip() for x in (l.get("description") or "").split("\n\n") if x.strip()]
    desc_html = "".join(f"<p>{E(x).replace(chr(10), '<br>')}</p>" for x in desc_paras)
    feats = "".join(f"<li>{E(f)}</li>" for f in (l.get("features") or []))
    gallery = ""
    if ph:
        thumbs = "".join(f'<a href="{E(x["url"])}" target="_blank" rel="noopener"><img src="{E(x["url"])}" alt="{E(x["alt"])}" loading="lazy" width="320" height="220"></a>' for x in ph[1:])
        gallery = f'<div class="gal"><a class="main" href="{E(ph[0]["url"])}" target="_blank" rel="noopener"><img src="{E(ph[0]["url"])}" alt="{E(ph[0]["alt"])}" width="1200" height="800" fetchpriority="high"></a>{thumbs}</div>'
    else:
        gallery = f'<div class="gal"><div class="noimg big">{ICON["image"]}<span>Fotografie připravujeme</span></div></div>'
    intro_bits = [l["type"] + (f' {l["disposition"]}' if l.get("disposition") else ""), where]
    short = f'{" · ".join(intro_bits)}. Nájemné {czk(l["rent_czk"])} měsíčně.'
    inquiry = f'''<form class="form" data-lead data-subject="Zájem o nabídku: {E(l["title"])}" data-endpoint="{E(FORM_ENDPOINT)}" novalidate>
<h3>Mám zájem o prohlídku</h3><input type="hidden" name="nabidka" value="{E(l["title"])} ({E(url(path))})">
<div class="row one"><div><label for="q-jmeno">Jméno a příjmení</label><input id="q-jmeno" name="jmeno" required autocomplete="name"></div></div>
<div class="row"><div><label for="q-tel">Telefon</label><input id="q-tel" name="telefon" type="tel" required autocomplete="tel"></div><div><label for="q-email">E-mail</label><input id="q-email" name="email" type="email" required autocomplete="email"></div></div>
<div class="row one"><div><label for="q-zprava">Zpráva</label><textarea id="q-zprava" name="zprava" placeholder="Např. kdy byste se mohli přijít podívat"></textarea></div></div>
<div class="hp" aria-hidden="true"><label>Web<input name="web" tabindex="-1" autocomplete="off"></label></div>
<label class="consent"><input type="checkbox" name="souhlas" required> <span>Souhlasím se zpracováním osobních údajů pro účely vyřízení poptávky. <a href="/ochrana-osobnich-udaju/">Více informací</a></span></label>
<button class="btn" type="submit">Odeslat poptávku →</button><p class="msg" role="status" aria-live="polite"></p></form>'''
    body = f'''<section style="padding:36px 0 84px"><div class="wrap">
<p class="crumbs" style="color:var(--muted)"><a href="/">Pronájmy Západ</a> › <a href="/nabidky/">Nabídky</a> › {E(l["title"])}</p>
<h1 style="font-size:clamp(1.8rem,3.6vw,2.7rem)">{E(l["title"])}</h1>
<p style="color:var(--muted);font-size:1.05rem">{E(where)} · <b style="color:var(--navy)">{czk(l["rent_czk"])} / měsíc</b></p>
{gallery}
<div class="dgrid"><div>
<h2 style="font-size:1.6rem">Popis nemovitosti</h2>{desc_html or f"<p>{E(short)}</p>"}
{f'<h2 style="font-size:1.6rem;margin-top:1.4em">Vybavení a výhody</h2><ul class="tags">{feats}</ul>' if feats else ""}
<h2 style="font-size:1.6rem;margin-top:1.4em">Parametry</h2><table class="facts-t">{facts}</table>
<h2 style="font-size:1.6rem;margin-top:1.4em">Cena</h2><table class="facts-t">{money}</table>
<p class="note" style="margin-top:22px">Přesnou adresu sdělíme při domluvě prohlídky. Zprostředkování pronájmu zajišťuje {E(CO["name"].rstrip("."))}.</p>
</div><aside class="side"><div class="agent"><span class="eyebrow">Váš kontakt</span><b>{E(name)}</b>
<a href="tel:{tel}">{phone}</a><a href="mailto:{CO["email"]}">{CO["email"]}</a><small>Po – Pá 9:00 – 17:00</small></div>{inquiry}</aside></div></div></section>'''
    absimgs = [x["url"] for x in ph]
    about = {"@type": SCHEMA_TYPE.get(l["type"], "Accommodation"), "name": l["title"],
             "address": {"@type": "PostalAddress", "addressLocality": l["city"], "addressRegion": "Karlovarský kraj", "addressCountry": "CZ"}}
    if l.get("area_m2"): about["floorSize"] = {"@type": "QuantitativeValue", "value": l["area_m2"], "unitCode": "MTK"}
    if l.get("disposition"): about["description"] = f'Dispozice {l["disposition"]}'
    offer = {"@type": "Offer", "price": l["rent_czk"], "priceCurrency": "CZK", "availability": "https://schema.org/InStock", "seller": {"@id": DOMAIN + "/#org"},
             "priceSpecification": {"@type": "UnitPriceSpecification", "price": l["rent_czk"], "priceCurrency": "CZK", "unitCode": "MON", "unitText": "měsíc"}}
    if l.get("available_from"): offer["availabilityStarts"] = l["available_from"][:10]
    listing = {"@type": "RealEstateListing", "@id": url(path) + "#listing", "url": url(path), "name": l["title"],
               "description": " ".join(desc_paras)[:500] or short, "inLanguage": "cs", "offers": offer, "about": about}
    if l.get("published_at"): listing["datePosted"] = l["published_at"][:10]
    if absimgs: listing["image"] = absimgs
    graph = [ORG, listing,
      {"@type": "WebPage", "@id": url(path) + "#webpage", "url": url(path), "name": l["title"], "isPartOf": {"@id": DOMAIN + "/#website"}, "inLanguage": "cs", "dateModified": (l.get("updated_at") or TODAY)[:10], "mainEntity": {"@id": url(path) + "#listing"}},
      {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Pronájmy Západ", "item": DOMAIN + "/"}, {"@type": "ListItem", "position": 2, "name": "Nabídky", "item": url("/nabidky/")}, {"@type": "ListItem", "position": 3, "name": l["title"], "item": url(path)}]}]
    desc = f'{short} {desc_paras[0][:120] if desc_paras else ""}'.strip()
    h = page(path, f'{l["title"]} | Pronájem {l["city"]}', desc[:300], body, graph)
    if absimgs: h = h.replace(f'<meta property="og:image" content="{DOMAIN}/assets/og.png">', f'<meta property="og:image" content="{E(absimgs[0])}">')
    write(path, h)

def admin_config():
    d = OUT / "admin"; d.mkdir(parents=True, exist_ok=True)
    (d / "config.js").write_text("window.PZ_CONFIG = " + json.dumps({"url": SUPABASE_URL, "anonKey": SUPABASE_ANON_KEY}) + ";\n", encoding="utf-8")

def slugify(t):
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")

if __name__ == "__main__":
    if OUT.exists(): shutil.rmtree(OUT)
    shutil.copytree(STATIC, OUT)
    LISTINGS = load_listings()
    for l in LISTINGS:
        l["slug"] = slugify(l["slug"]) or slugify(l["title"])
    home(); place_pages(); privacy(); not_found(); listings_page()
    for l in LISTINGS: listing_page(l)
    static_files(); admin_config()
    print(f"hotovo, nabídek: {len(LISTINGS)}")

