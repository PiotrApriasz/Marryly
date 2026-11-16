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

### Zapis ZIP zgodny z HTTP

W .NET 9 `ZipArchive` zapisuje część nagłówków synchronicznie, także przy zamykaniu archiwum. Bezpośredni zapis do odpowiedzi Kestrela kończył się wyjątkiem `Synchronous operations are disallowed`, zarówno dla ZIP-a galerii linkowej, jak i panelu admina.

Wspólny mechanizm najpierw kończy archiwum w osobnym pliku tymczasowym, a następnie przewija plik i kopiuje go do odpowiedzi wyłącznie przez `CopyToAsync`. Nie trzyma całego ZIP-a w pamięci serwera. Plik ma losową nazwę i `DeleteOnClose`, więc jest usuwany po sukcesie, błędzie i anulowaniu. Przed otwarciem oryginałów oraz przed wysyłką sprawdzany jest token anulowania. Serwer potrzebuje wolnego miejsca tymczasowego odpowiadającego rozmiarowi ZIP-a; błąd odczytu oryginału lub przygotowania archiwum występuje przed wysłaniem bajtów do klienta.

Odpowiedź błędu czyści wcześniejszy status i nagłówki odpowiedzi ASP.NET, w tym `Content-Type`, `Content-Disposition` i `Content-Length`. Zapobiega to wtórnemu wyjątkowi o wielokrotnym `Content-Type`. Gdy transfer już się rozpoczął, middleware przerywa go i zachowuje pierwotny wyjątek; nie dopisuje JSON-a do częściowego archiwum.

### Ograniczenia

Archiwum powstaje w jednym żądaniu, jak istniejące pobieranie gościa. Przeglądarka odbiera cały ZIP jako Blob przed zapisaniem, więc bardzo duże zbiory są ograniczone pamięcią przeglądarki i czasem obsługi żądania. Nie ma kolejki generowania archiwów w tle ani dzielenia pobrania na części.

## Weryfikacja

48 testów backendu przechodzi. Nowe scenariusze obejmują wybór 151 mediów ponad wielkość strony, zdjęcia i filmy, oryginały niepubliczne i z błędem, pominięcie późniejszych uploadów, starszy album gości, przypisanie do kilku albumów, błędne i obce identyfikatory, puste zaznaczenie, zgodność bajtów wpisów ZIP z oryginałami, powtarzające się nazwy, kolejny odczyt i zamykanie strumieni oraz anulowanie.

W przeglądarce sprawdzono rzeczywisty panel z syntetycznymi danymi i lokalnym API: przy 50 wczytanych pozycjach wybór wszystkich 54 pobrał ZIP z dokładnie 54 poprawnymi, niepowtórzonymi wpisami. Wybrane pozycje pozostały zaznaczone. Sprawdzono także kontrolki mobilnego lightboxa. Build backendu oraz lint i produkcyjny build frontendu przechodzą.

Po naprawie zapisu ZIP przechodzą 52 testy backendu i build rozwiązania. Testy regresyjne odtwarzały wyjątek przed poprawką; po zmianie weryfikują poprawny ZIP na nieprzewijalnym strumieniu blokującym synchroniczny zapis i flush, dla obu poziomów kompresji i pustego archiwum. Sprawdzają też zgodność oryginalnych bajtów oraz brak częściowej odpowiedzi po anulowaniu przed rozpoczęciem i po błędzie odczytu kolejnego oryginału. Frontend nie był zmieniany.

Osobna lokalna próba z rzeczywistym adapterem HTTP zainstalowanego pakietu Azure Functions potwierdziła zastąpienie nagłówków ZIP-a pojedynczym `Content-Type: application/problem+json`, status `500` i poprawny JSON błędu. Sprawdzono również, że middleware przerywa rozpoczętą odpowiedź i ponownie zgłasza pierwotny wyjątek bez dopisywania JSON-a. Próby używały syntetycznych danych, bez połączenia z Cosmos DB i Blob Storage.
