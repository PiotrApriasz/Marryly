# Pobieranie zaznaczonych mediów przez admina

## Obsługa

Po zaznaczeniu przynajmniej jednego medium w albumie admina pojawia się „Pobierz zaznaczone”. Akcja jest dostępna obok dodawania do albumu i kosza, również w podglądzie pełnoekranowym. Na telefonie pasek używa ikon z etykietami dostępności; kontrolki podglądu pozostają rozdzielone od pobierania pojedynczego pliku i zamykania.

- Pobierany jest jeden ZIP z oryginałami wszystkich wskazanych zdjęć i filmów, bez preview i miniatur.
- „Zaznacz wszystko” obejmuje cały album, także pozycje jeszcze niewczytane w siatce. Pobieranie przekazuje migawkę pełnej listy identyfikatorów, bez limitu 25 używanego przy zmianach mediów. Późniejsze uploady nie są automatycznie dołączane.
- Nazwa archiwum to `<slug>-wybrane-media.zip`. Wpisy mają unikalne numery i bezpieczne nazwy zachowujące rozszerzenia oryginałów.
- W trakcie przygotowania widoczne są spinner i komunikat, aby pozostawić stronę otwartą. Zmiana wyboru i inne akcje są zablokowane. Błąd jest pokazywany przy pasku, także nad lightboxem, i pozwala ponowić próbę.
- Po pobraniu wybór, pozycja galerii i podgląd pozostają zachowane. Nie są zmieniane żadne przypisania, pliki ani liczniki albumów. Opuszczenie widoku anuluje żądanie po stronie przeglądarki.

## API i wspólny mechanizm

`POST /panel/albums/{albumId}/media/download` przyjmuje `{ mediaIds: [...] }` i zwraca `application/zip`. Wymaga sesji administratora i istniejącego albumu w jego wydarzeniu. Każdy unikalny identyfikator musi wskazywać zdjęcie lub film przypisane do tego albumu, także przez `albumIds` lub starszy fallback `albumId`. Brakujące media i obce identyfikatory dają `400 DOWNLOAD_MEDIA_INVALID` przed rozpoczęciem odczytu plików; pusty wybór daje `400 DOWNLOAD_MEDIA_REQUIRED`.

Admin może pobierać oryginały również mediów niezatwierdzonych i z błędem przetwarzania. Galerie gości zachowują dotychczasowe filtry i kontrolę dostępu: ich ZIP obejmuje wyłącznie gotowe, zatwierdzone zdjęcia z dozwolonego albumu linkowego. Endpoint admina nie używa capability-linków.

`MediaZipArchive` współdzieli zapis archiwum z galerią linkową: oryginały czyta kolejno i zamyka każdy strumień przed następnym. ZIP admina zapisuje już skompresowane zdjęcia i filmy bez dodatkowej kompresji. Frontend korzysta ze wspólnego zapisywania Blob do pliku, a `AdminApiClient.postBlob` zachowuje nagłówek sesji admina i istniejącą obsługę błędów autoryzacji.

Archiwum powstaje w jednym żądaniu, jak istniejące pobieranie gościa. Przeglądarka odbiera cały ZIP jako Blob przed zapisaniem, więc bardzo duże zbiory są ograniczone pamięcią przeglądarki i czasem obsługi żądania. Nie ma kolejki generowania archiwów w tle ani dzielenia pobrania na części.

## Weryfikacja

48 testów backendu przechodzi. Nowe scenariusze obejmują wybór 151 mediów ponad wielkość strony, zdjęcia i filmy, oryginały niepubliczne i z błędem, pominięcie późniejszych uploadów, starszy album gości, przypisanie do kilku albumów, błędne i obce identyfikatory, puste zaznaczenie, zgodność bajtów wpisów ZIP z oryginałami, powtarzające się nazwy, kolejny odczyt i zamykanie strumieni oraz anulowanie.

W przeglądarce sprawdzono rzeczywisty panel z syntetycznymi danymi i lokalnym API: przy 50 wczytanych pozycjach wybór wszystkich 54 pobrał ZIP z dokładnie 54 poprawnymi, niepowtórzonymi wpisami. Wybrane pozycje pozostały zaznaczone. Sprawdzono także kontrolki mobilnego lightboxa. Build backendu oraz lint i produkcyjny build frontendu przechodzą.
