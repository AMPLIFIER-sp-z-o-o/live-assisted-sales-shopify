# AMPER Live Assisted Sales - aplikacja Shopify

[English](README.md) | **Polski**

AMPER Live Assisted Sales łączy Twój sklep Shopify z platformą [AMPER](https://live-assisted-sales.com), dzięki której możesz obserwować odwiedzających w czasie rzeczywistym, rozmawiać z nimi na czacie i zwiększać sprzedaż.

- **widzisz w czasie rzeczywistym, ilu odwiedzających jest w sklepie** - co oglądają, czego szukają, co mają w koszyku i jakie zamówienia złożyli,
- **wiesz, komu pomóc najpierw** - każda wizyta otrzymuje ocenę prawdopodobieństwa zakupu (niska / średnia / wysoka),
- **rozmawiasz z klientami przez czat** - dymek czatu w sklepie, podpowiedzi AI, polecanie produktów oraz dodawanie ich do koszyka bez opuszczania rozmowy,
- **szanujesz wybory swoich klientów dotyczące prywatności** - integracja respektuje ustawienia zgód na pliki cookie w Twoim sklepie Shopify (Customer Privacy); odwiedzający, którzy nie wyrazili zgody na analitykę, nie są śledzeni w przeglądarce.

Do korzystania z aplikacji wymagane jest konto w usłudze AMPER Live Assisted Sales - po połączeniu sklepu wszystkie funkcje są dostępne od razu. Konto jest bezpłatne, a przez pierwsze 7 dni możesz korzystać z okresu próbnego.

## Czego potrzebujesz

- sklepu na Shopify (dowolny plan; do testów wystarczy darmowy sklep deweloperski),
- dostępu do panelu administracyjnego sklepu z uprawnieniami do instalowania aplikacji i edycji ustawień szablonu,
- dostępu do internetu umożliwiającego komunikację z platformą AMPER.

Niczego nie trzeba pobierać - aplikację instalujesz bezpośrednio z konta AMPER LAS.

## Instalacja krok po kroku

1. Zaloguj się (lub załóż konto) na [live-assisted-sales.com](https://live-assisted-sales.com).
2. W konsoli otwórz **Moje sklepy** i kliknij **Dodaj sklep**. W rozwiniętym formularzu znajdź sekcję **Masz sklep na Shopify?**, wpisz adres swojego sklepu (np. `twoj-sklep.myshopify.com`) i kliknij **Połącz przez Shopify**.
3. Shopify otworzy panel administracyjny Twojego sklepu i poprosi o zatwierdzenie instalacji aplikacji. Przejrzyj uprawnienia i kliknij **Zainstaluj**.
4. Wrócisz na live-assisted-sales.com. Potwierdź przyciskiem **Połącz ten sklep** - klucze API, webhooki zamówień i piksel analityczny skonfigurują się automatycznie, niczego nie kopiujesz ani nie wklejasz.
5. Ostatni przełącznik: na stronie potwierdzenia kliknij **Otwórz edytor szablonu** (albo wejdź w **Sklep online → Szablony → Dostosuj** w panelu Shopify), otwórz panel **Elementy aplikacji** (App embeds), włącz **AMPER Live Assisted Sales** i zapisz szablon.
6. Gotowe. Dymek czatu pojawia się w sklepie, a w konsoli na live-assisted-sales.com widzisz ruch w czasie rzeczywistym. Zamówienia zapisują się automatycznie, nawet u odwiedzających z blokerami reklam.

Instalację możesz też zacząć bezpośrednim odnośnikiem: `https://live-assisted-sales.com/integrations/shopify/install/?shop=twoj-sklep.myshopify.com` (podmień adres na własny).

## Częste pytania

**Czy aplikacja spowolni mój sklep?**
Nie. Widżet ładuje się asynchronicznie i nie blokuje ładowania strony, zdarzenia z przeglądarki są wysyłane w tle, a zdarzenia sprzedażowe (zamówienia, rozpoczęcia płatności) wędrują między Shopify a platformą AMPER bezpośrednio między serwerami - nie zależą od przeglądarki odwiedzającego.

**Czy muszę pilnować aktualizacji?**
Nie. Nowe wersje dystrybuuje Shopify automatycznie - w panelu sklepu niczego nie instalujesz ani nie aktualizujesz.

**Jak wstrzymać wysyłanie danych?**
Na stronie ustawień sklepu w konsoli odznacz **Integracja włączona**. Odinstalowanie aplikacji w panelu Shopify (**Ustawienia → Aplikacje i kanały sprzedaży**) także zatrzymuje wszystko - historia zostaje w konsoli, a ponowne połączenie sklepu włącza integrację z powrotem.

**Czy mogę ukryć sam dymek czatu?**
Tak. W edytorze motywu (**Sklep online → Szablony → Dostosuj → Osadzenia aplikacji → AMPER Live Assisted Sales**) odznacz **Show the chat bubble** - dymek zniknie, a śledzenie odwiedzających i konsola na żywo będą dalej działać.

**Co z danymi moich klientów?**
Integracja respektuje ustawienia zgód na pliki cookie w Twoim sklepie Shopify (Customer Privacy) - bez zgody na analitykę żadne dane o zachowaniu nie są zbierane w przeglądarce. Szczegółowe informacje znajdziesz w naszym [Regulaminie](https://live-assisted-sales.com/terms/) oraz [Polityce prywatności](https://live-assisted-sales.com/privacy/).

## Pomoc

Coś nie działa albo masz pytanie? Napisz do nas: [support@ampliapps.com](mailto:support@ampliapps.com).

---

Dokumentacja techniczna (środowisko deweloperskie, testy, wydawanie wersji, architektura integracji): [DEVELOPMENT.md](DEVELOPMENT.md).
