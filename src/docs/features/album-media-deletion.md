# Usuwanie mediów z albumów

## Panel administracyjny

Widok „Zarządzaj mediami” (`/admin/albums/:albumId`) używa dokładnie wariantu `PhotoGalleryGrid variant="masonry"` z albumu udostępnianego gościom (`SharedGalleryAlbumPage`), wraz z jego komponentami `MasonryGrid`, `MediaLightbox` i `InfiniteLoadMore`.

- Zdjęcia zachowują naturalne proporcje, bez kwadratowego kadrowania, w identycznym responsywnym układzie 2/3/4 kolumn i z tymi samymi odstępami.
- Kafelki zdjęć pobierają `previewBlobUrl` (podgląd do 2560 px), zamiast miniatury 480 px. Oryginał jest używany jako fallback przy braku preview oraz w podglądzie pełnoekranowym i przy pobieraniu. Filmy zachowują poster.
- Sekcja galerii używa tych samych klas `shared-gallery-album-photos-screen` i `shared-gallery-album-photos-content`, z pełną szerokością, tłem i marginesami jak w galerii gości; znajduje się poza ograniczającym szerokość kontenerem panelu.
- Media są doczytywane po 50 elementów w globalnej kolejności od najstarszej do najnowszej daty wykonania, z datą dodania jako zastępstwem. Backend sortuje cały album przed podziałem na strony; frontend tylko dopisuje odpowiedzi, bez przestawiania kafelków. Szczegóły są w [guest-gallery.md](guest-gallery.md).
- Ładowanie korzysta z tego samego `PageState` i spinnera; kafelki nie mają metadanych, statusów ani indywidualnych przycisków usuwania. W panelu admina mają dodatkowo pole zaznaczenia.
- Wspólny `MediaLightbox` renderuje podgląd portalem bezpośrednio w `document.body`, poza warstwami galerii. Pasek menu jest ukryty przez cały czas podglądu; tło pozostaje nieaktywne i nie przewija się. Zamknięcie przywraca menu, przewijanie oraz fokus na zdjęciu.

Upload, licznik mediów i zarządzanie zaznaczeniem pozostają narzędziami panelu nad galerią. Dane są nadal pobierane endpointami administratora.

## Zaznaczanie i usuwanie

- Przycisk „Zaznacz wszystko” pobiera identyfikatory wszystkich zdjęć i filmów w albumie, także jeszcze niedoczytanych, niezatwierdzonych i z błędem przetwarzania. Nie pobiera przy tym plików zdjęć ani filmów.
- Zaznaczenie jest migawką zawartości albumu w chwili pobrania identyfikatorów. Później dodane pliki nie trafiają automatycznie do wyboru ani do usuwania.
- Każde zdjęcie i film można zaznaczyć lub odznaczyć osobnym polem w lewym górnym rogu kafelka. Kliknięcie samego zdjęcia nadal otwiera podgląd.
- Podgląd pełnoekranowy ma takie samo pole dla aktualnego medium. Wybór jest wspólny dla siatki i podglądu, zachowuje się przy przechodzeniu między mediami i doczytywaniu kolejnych stron.
- Panel pokazuje liczbę zaznaczonych pozycji oraz pozwala wyczyścić wybór; po zaznaczeniu całego albumu przycisk zmienia się na „Odznacz wszystko”.
- Gdy wybór nie jest pusty, u dołu ekranu pojawia się pasek „Dodaj do albumu” i kosz z liczbą pozycji. W podglądzie dostępne są ich kompaktowe warianty. Po odznaczeniu ostatniej pozycji akcje znikają.
- Kosz otwiera dwie jawne akcje. „Usuń z tego albumu” usuwa wyłącznie przypisanie, zachowując rekord i wszystkie pliki; blokuje usunięcie ostatniego przypisania komunikatem `MEDIA_LAST_ALBUM`. „Usuń trwale ze wszystkich” usuwa oryginał, podgląd, miniaturę i rekord, przez co medium znika ze wszystkich albumów.
- Trwałe usuwanie wymaga dodatkowego potwierdzenia z liczbą pozycji, albumem źródłowym i ostrzeżeniem o usunięciu ze wszystkich albumów. Panel nie ma osobnej akcji usuwania całego albumu mediów bez wcześniejszego zaznaczenia.
- Album pozostaje. Nadal można go usunąć osobną akcją, gdy jest pusty; album systemowy „Od gości” pozostaje chroniony przed usunięciem.
- Akcja jest dostępna także dla zawartości albumu „Od gości”, z uwzględnieniem starszych mediów bez `albumId`.
- W czasie operacji widoczny jest postęp. Zmiana wyboru i dodawanie plików w tym widoku są zablokowane.
- Usuwanie jest niedostępne podczas odczytywania lokalnej kolejki uploadu oraz gdy są w niej oczekujące lub aktywne pliki tego albumu.
- Po sukcesie i po błędzie odświeżane są zawartość i lista albumów, liczniki panelu oraz cache zwykłej i udostępnionej galerii.

## API i większe albumy

Endpoint administratora `GET /panel/albums/{albumId}/media/ids` zwraca `{ mediaIds }` dla całego albumu. `POST /panel/albums/{albumId}/media/delete` przyjmuje `{ mediaIds }` z 1–25 identyfikatorami i zwraca `{ deletedCount }`. Frontend dzieli migawkę wyboru na partie po 25 pozycji. Potwierdzone partie usuwa również z lokalnego zaznaczenia.

Usunięcie wyłącznie przypisań używa `POST /panel/albums/{albumId}/media/remove` z `{ mediaIds }` i odpowiedzią `{ processedCount }`. Obsługę wielu albumów, zgodność starych dokumentów i zapis ETag opisuje [album-media-membership.md](album-media-membership.md).

Backend sprawdza sesję administratora i istnienie albumu w jego wydarzeniu. Wszystkie istniejące rekordy partii muszą należeć do właściwego wydarzenia i albumu oraz być zdjęciem lub filmem; cała partia jest walidowana przed pierwszym usunięciem pliku. Odczyt i usuwanie rekordów korzystają z partycji `eventId`. Duplikaty są pomijane, a nieistniejące identyfikatory pozwalają bezpiecznie ponowić żądanie. Zwykłe endpointy gościa i dostęp przez capability-link pozostają osobnymi ścieżkami; opcje zarządzania nie pojawiają się w galerii gości.

Usunięcie plików poprzedza usunięcie rekordu. Błąd zatrzymuje operację; część wcześniej przetworzonych mediów może już być usunięta. Panel informuje o częściowym wykonaniu i odczytuje aktualne identyfikatory, aby pozostawić zaznaczone tylko istniejące pozycje. Gdy ten odczyt też się nie uda, zachowuje pozostały wybór do ponowienia. Usuwanie nie jest transakcją między Blob Storage a Cosmos DB.

Strona musi pozostać otwarta do zakończenia. Opuszczenie widoku przerywa kolejne żądania; rozpoczęta partia może już częściowo lub całkowicie się wykonać. Operacja nie blokuje uploadów z innych kart, urządzeń ani sesji gości, ale usuwa tylko identyfikatory zapisane w wyborze.

Dotychczasowy `DELETE /panel/albums/{albumId}/media` pozostaje w backendzie dla kompatybilności; aktualny panel go nie wywołuje.

## Weryfikacja

Testy w `Marryly.Tests/AlbumMediaDeletionTests.cs` obejmują usuwanie wybranych zdjęć i filmów, pozostawienie niezaznaczonych i później dodanych plików, ochronę innych albumów i wydarzeń, walidację całej partii, starsze rekordy albumu gości, brakujące i powtórzone identyfikatory, limity partii i ponowienie po błędzie Blob Storage. Zachowane są testy dotychczasowego usuwania pojedynczego i całej zawartości. `AlbumMediaOrderingTests.cs` sprawdza również pełną listę identyfikatorów ponad rozmiar strony, w tym media niepubliczne i z błędem.

```bash
dotnet test backend/Marryly/Marryly.Tests/Marryly.Tests.csproj
dotnet build backend/Marryly/Marryly.sln --no-restore
cd frontend/marryly-app/web && npm run lint && npm run build
```

Weryfikacja lokalna: 43 testy backendu oraz build backendu, lint i produkcyjny build frontendu zakończone powodzeniem z lokalnym SDK .NET 9.

W przeglądarce sprawdzono rzeczywisty `AdminAlbumPage` z lokalnym API i syntetycznymi obrazami: „Zaznacz wszystko” wybrało 54 pozycje przy 50 wczytanych, „Odznacz wszystko” wyczyściło wybór, a zaznaczenie było wspólne dla siatki i podglądu. Kosz znikał po odznaczeniu ostatniej pozycji. Usunięcie dwóch pozycji w testowym API zostawiło 52 pozostałe. Podgląd zachował ukryte menu i przywracał galerię po zamknięciu.
