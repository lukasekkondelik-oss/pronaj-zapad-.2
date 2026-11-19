import json, sys, pathlib, unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tools"))
import softreal

MAP = json.load(open(pathlib.Path(__file__).resolve().parent.parent / "tools" / "softreal_mapping.example.json", encoding="utf-8"))

XML = """<?xml version="1.0" encoding="utf-8"?>
<export><nemovitosti>
 <nemovitost><id>A1</id><typ_nabidky>pronájem</typ_nabidky><nazev>Byt 2+kk Cheb</nazev><typ_nemovitosti>Byt</typ_nemovitosti><mesto>Cheb</mesto>
  <cena>14 500 Kč</cena><plocha>52,5</plocha><vybaveni>vybaveno</vybaveni>
  <fotky><foto><url>https://x.cz/1.jpg</url></foto><foto><url>http://x.cz/2.jpg</url></foto></fotky>
  <vlastnosti><vlastnost>Balkon</vlastnost><vlastnost>Sklep</vlastnost></vlastnosti>
  <makler><jmeno>Soňa P.</jmeno><telefon>603382392</telefon></makler></nemovitost>
 <nemovitost><id>A2</id><typ_nabidky>prodej</typ_nabidky><nazev>Prodej domu</nazev><typ_nemovitosti>Dům</typ_nemovitosti><mesto>Sokolov</mesto><cena>3000000</cena></nemovitost>
 <nemovitost><id>A3</id><typ_nabidky>pronájem</typ_nabidky><nazev>Dům Ostrov</nazev><typ_nemovitosti>Dům</typ_nemovitosti><mesto>Ostrov</mesto><cena>25000</cena></nemovitost>
</nemovitosti></export>""".encode()

JSONF = json.dumps({"export": {"nemovitosti": {"nemovitost": [
  {"id": 7, "typ_nabidky": "pronájem", "nazev": "Byt", "typ_nemovitosti": "Byt", "mesto": "Karlovy Vary", "cena": 12000, "fotky": {"foto": [{"url": "https://x.cz/a.jpg"}]}},
  {"id": 8, "typ_nabidky": "pronájem", "nazev": "Bez ceny", "typ_nemovitosti": "Byt", "mesto": "Cheb"}]}}}).encode()


class T(unittest.TestCase):
    def test_xml(self):
        r = softreal.normalize(softreal.parse(XML, MAP))
        self.assertEqual(len(r), 2)                       # prodej odfiltrován
        a = next(x for x in r if x["id"] == "A1")
        self.assertEqual((a["rent_czk"], a["area_m2"], a["furnished"]), (14500, 52.5, "ano"))
        self.assertEqual([p["url"] for p in a["photos"]], ["https://x.cz/1.jpg"])  # http fotka zahozena
        self.assertEqual(a["features"], ["Balkon", "Sklep"])
        self.assertEqual(a["contact_phone"], "603382392")

    def test_json_drops_invalid(self):
        r = softreal.normalize(softreal.parse(JSONF, MAP))
        self.assertEqual([x["id"] for x in r], ["7"])    # záznam bez ceny zahozen

    def test_garbage(self):
        with self.assertRaises(softreal.FeedError):
            softreal.parse(b"<<nonsense", MAP)

    def test_no_mapping_file(self):
        old = softreal.MAPPING_FILE; softreal.MAPPING_FILE = "/nonexistent.json"
        try:
            with self.assertRaises(NotImplementedError):
                softreal.parse(XML)
        finally:
            softreal.MAPPING_FILE = old


if __name__ == "__main__":
    unittest.main()
