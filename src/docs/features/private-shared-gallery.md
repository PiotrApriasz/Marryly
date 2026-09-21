# Prywatne albumy dostępne z linku

## Cel

Galeria umożliwia niezależne udostępnianie wybranych albumów osobom bez sesji gościa. Pełny link jest mechanizmem dostępu typu capability: daje dostęp tylko do albumów wymienionych w parametrze URL.

## Model dostępu

Album ma dwa niezależne ustawienia:

- `isVisible` — widoczność w zwykłej galerii dla zalogowanego gościa;
- `isLinkAccessible` — możliwość udostępnienia przez specjalny link.

Po włączeniu dostępu linkowego album dostaje stały `shareCode`: 10 małych znaków alfanumerycznych, bez litery `x`. Parametr `view` zawiera jeden lub więcej kodów połączonych przez `x`, np. `?view=abc123def4xghj567k89m`.

Parser odrzuca niepoprawną długość, niedozwolone znaki, wielkie litery i powtórzone kody. Serwer zwraca tylko albumy, które są jednocześnie wskazane przez `view` i mają włączone `isLinkAccessible`. Zwykłe endpointy galerii zachowują ochronę sesją gościa i nie ujawniają albumów wyłącznie linkowych.

## Panel administracyjny

- Formularz albumu ma osobny przełącznik „Dostępny przez link”, niezależny od „Widoczny publicznie”.
- Lista albumów sygnalizuje dostęp linkowy.
- Strona `/admin/gallery-share-links` pozwala wybrać albumy z aktywnym dostępem, dodać opis, wygenerować URL, skopiować go i zachować w katalogu.
- Katalog zapisuje dokumenty `galleryShareLink` w kontenerze Cosmos `EventData` wraz z `albumIds`, `url`, opisem oraz datą utworzenia.
- Usunięcie wpisu z katalogu usuwa tylko zapis administracyjny; wcześniej skopiowany link nadal działa.

## Wejście dla odbiorcy linku

- `/?view=…` omija standardową ochronę routingu i otwiera selektor udostępnionych albumów.
- Przy jednym albumie użytkownik przechodzi od razu do jego zawartości.
- Widok albumu działa pod `/shared-gallery/:shareCode?view=…`; parametr `view` zostaje zachowany przy przejściach i paginacji.
- Anonimowe endpointy są wydzielone pod `/app/gallery/shared`, aby nie osłabiać reguł zwykłej galerii.

## Wygląd selektora albumów

Selektor otwierany przez `?view=…` ma własny, dwuekranowy widok bez navbaru:

- ekran powitalny z napisem „Alicja & Piotr” oraz `src/assets/gallery-main-photo.jpg`;
- przycisk prowadzący płynnie do listy albumów; sekcje ekranu korzystają z pionowego scroll snap;
- to samo zdjęcie na drugim ekranie jest wycentrowanym, przyciemnionym i delikatnie rozmytym tłem pod półprzezroczystymi kartami;
- osobne warstwy zdjęcia karty i tła ograniczają koszt animacji; widok obsługuje `prefers-reduced-motion`.
- pod listą albumów znajduje się minimalistyczna stopka „Made by Piotr Apriasz, approved by Alicja Biel”.

## Wygląd pojedynczego albumu

Pojedynczy album linkowy ma ten sam dwuekranowy charakter co selektor albumów:

- pierwszy ekran pokazuje nazwę albumu oraz losowe zdjęcie wybrane spośród wszystkich zatwierdzonych i gotowych zdjęć tego albumu;
- przy braku zdjęć ekran pokazuje neutralny placeholder, a przyciski pobierania pozostają nieaktywne;
- przycisk „Zobacz zdjęcia” prowadzi płynnie do sekcji ze zdjęciami, a ekrany albumu korzystają z pionowego scroll snap;
- drugi ekran ma jednolite tło papierowe, bez zdjęciowego tła, oraz minimalistyczne kontrolki inspirowane lightboxem;
- zdjęcia w albumie są wyświetlane w pełnoszerokim, responsywnym układzie masonry: zdjęcia zachowują naturalne proporcje i są niezależnie układane w wyrównanych kolumnach bez przycinania;
- kafelki w tym widoku pobierają wygenerowany preview (maksymalnie 2560 px), a nie miniaturę 480 px; oryginały są nadal używane wyłącznie w lightboxie i przy pobieraniu;
- automatyczne doczytywanie kolejnej strony wymaga ponownego dojścia użytkownika do końca galerii po poprzednim pobraniu; dopisanie zdjęć nie wywołuje programowego przewijania ani nie zmienia pozycji użytkownika w trakcie przeglądania;
- kontrolki pozwalają wejść w tryb zaznaczania zdjęć i pobrać wszystkie zdjęcia albumu;
- filmy pozostają widoczne i dostępne w lightboxie, ale nie są zaznaczane ani pobierane w ZIP-ach;
- po uploadzie filmu przeglądarka pobiera pojedynczą klatkę, tworzy z niej poster JPEG i przesyła go do endpointu HTTP; poster jest trwale zapisany w Blob Storage i przekazywany przez grid do elementu wideo, bez kolejki i FFmpeg; panel albumów pozwala utworzyć postery dla filmów wgranych wcześniej, przetwarzając je kolejno w otwartej karcie administratora;
- zaznaczenia są zachowywane podczas paginacji, a floating button pobiera zaznaczone zdjęcia i po sukcesie zamyka tryb zaznaczania;
- pod galerią znajduje się minimalistyczna stopka „Made by Piotr Apriasz, approved by Alicja Biel”.

Pobieranie korzysta z capability-linku i jest realizowane przez endpointy `/app/gallery/shared/{shareCode}/download`: żądanie GET tworzy ZIP ze wszystkimi zdjęciami, a żądanie POST przyjmuje `mediaIds` i tworzy ZIP tylko dla wskazanych zdjęć. Backend ponownie sprawdza parametr `view`, kod albumu, przynależność mediów oraz `approved=true`, `status=ready` i typ `photo`.

## Weryfikacja po zmianach

Ręcznie sprawdź link z jednym albumem, link z wieloma albumami, błędny `view`, długą listę albumów oraz zwykłe przewijanie w desktopowym i mobilnym viewportcie. Dla pojedynczego albumu sprawdź także losowanie hero z pełnego zbioru, pusty album, pobranie wszystkich zdjęć, pobranie zaznaczeń z wielu stron, odrzucenie filmu lub zdjęcia spoza albumu w żądaniu ZIP oraz działanie dla długiej nazwy albumu i `prefers-reduced-motion`.

Po zmianach uruchom właściwą część zestawu:

```bash
dotnet build backend/Marryly/Marryly.sln --no-restore
cd frontend/marryly-app/web && npm run lint
cd frontend/marryly-app/web && npm run build
```
