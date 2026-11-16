# Galeria gości

## Cel

Zwykła galeria dostępna po sesji gościa pokazuje media z albumu w uporządkowanej, prostej siatce. Jest niezależna od galerii udostępnianej linkiem, która pozostaje widokiem masonry.

## Kolejność i układ

- Każdy album — zwykły, linkowy oraz w panelu admina — ma globalną kolejność od najstarszej do najnowszej daty wykonania (`capturedAt`). Jeśli starszy rekord nie ma tej daty, używane jest `uploadedAt`. Upload zapisuje w `capturedAt` datę z metadanych albo datę modyfikacji pliku, gdy nie ma daty wykonania.
- Przy identycznej dacie rozstrzyga rosnące `uploadedAt`, a następnie `id` porównywane porządkowo. Kolejność zwracania dokumentów przez bazę nie zmienia kolejności zdjęć z tym samym czasem.
- Backend pobiera metadane całego właściwego albumu i sortuje je przed wydzieleniem strony. Już pierwsza partia zawiera najstarsze media z całego albumu. Frontend zachowuje kolejność odpowiedzi i tylko dopisuje kolejne partie.
- Zwykły widok albumu używa standardowej, row-major siatki równych kafelków, więc kolejność jest czytelna od lewej do prawej i z góry na dół.
- Układ masonry jest używany w galerii dostępnej przez capability link oraz w panelu admina, który odtwarza jej pełnoszeroki układ i podglądy w większej rozdzielczości. Zwykły album z sesją gościa zachowuje standardową siatkę.
- W masonry kolejne media trafiają do najkrótszej kolumny, więc pozycja wizualna nie odpowiada równym chronologicznym rzędom. Lista mediów i przechodzenie między nimi w podglądzie pozostają chronologiczne.
- Widok albumu w panelu admina używa `PhotoGalleryGrid variant="masonry"`, tak jak `SharedGalleryAlbumPage`, bez metadanych oraz indywidualnych przycisków usuwania. Nadal pobiera media osobnymi endpointami administratora; szczegóły zarządzania są w [album-media-deletion.md](album-media-deletion.md).
- Wspólny podgląd pełnoekranowy jest renderowany portalem poza kontenerem galerii i ukrywa pasek menu do zamknięcia zdjęcia lub filmu. Tło jest wtedy nieaktywne, a po zamknięciu wraca wcześniejszy fokus i możliwość przewijania.

## Płynne doczytywanie i podglądy

Zwykły album gościa, album linkowy i panel admina korzystają ze wspólnego doczytywania oraz `GalleryImage` w `PhotoGalleryGrid`.

- `InfiniteLoadMore` rozpoczyna pobieranie kolejnej partii około dwóch wysokości widocznego obszaru przed końcem siatki, z minimalnym wyprzedzeniem 1200 px. W albumie linkowym obserwuje jego własny kontener przewijania; w pozostałych widokach — okno przeglądarki. Dzięki temu margines wyprzedzenia nie jest obcinany przez wewnętrzny scroll galerii linkowej.
- Po dopisaniu partii ponownie sprawdzana jest odległość od końca. Krótkie partie mogą uzupełniać bufor bez wymuszania wyjścia i powrotu do końca galerii. Blokada żądań w hooku i zapamiętanie liczby pozycji zapobiegają równoległym pobraniom oraz automatycznej pętli przy braku nowych mediów. Gdy siatka wypełni bufor, kolejne strony czekają na dalsze przewijanie.
- W masonry mała miniatura jest rozmytym podkładem dla większego preview. Preview pojawia się płynnie dopiero po pobraniu i zdekodowaniu. Przeglądarka nadal używa lazy loadingu; galeria nie pobiera z góry oryginałów całego albumu. W zwykłej siatce głównym obrazem pozostaje miniatura.
- Kafelki rezerwują miejsce od razu z proporcji metadanych (kwadrat w zwykłej siatce). Zdjęcie, miniatura i wideo są pozycjonowane wewnątrz tego miejsca, więc pojawienie się obrazu nie zmienia wysokości kafelka. Starsze rekordy bez wymiarów mają stały fallback: kwadrat dla zdjęcia i 16:9 dla filmu.
- Przy błędzie większego preview dostępna miniatura staje się ostrym obrazem zastępczym. Preferencja ograniczenia animacji wyłącza przejścia obrazów i ich powiększanie po najechaniu.
- Błąd kolejnej partii pozostawia siatkę, podgląd i zaznaczenia. Komunikat pojawia się przy przycisku doczytywania, który pozwala ponowić żądanie. Automatyczne pobieranie zatrzymuje się do ponowienia; udana próba usuwa komunikat. Błąd pierwszej partii nadal pokazuje stan błędu strony.

Zmiany dotyczą renderowania i momentu pobrania. Endpointy, globalna kolejność mediów, tokeny paginacji, sesje i capability-linki zachowują dotychczasowy kontrakt.

## Podgląd na telefonie

Wspólny `MediaLightbox` obsługuje galerię gościa, albumy linkowe i panel administratora. Korzysta z `yet-another-react-lightbox` z pluginami Zoom i Video. Zastępuje wcześniejszy statyczny podgląd, którego boczne marginesy po 64 px zmniejszały zdjęcie do 262 px na ekranie o szerokości 390 px.

- Zdjęcie jest dopasowane do całego dostępnego ekranu przeglądarki, bez stałych marginesów i bez przycinania. Zachowuje proporcje również po obrocie telefonu; wolne miejsce wynikające z proporcji ma czarne tło.
- Przesunięcie palcem zmienia medium. Dwa palce i podwójne stuknięcie powiększają zdjęcie; powiększony obraz można przesuwać. Na komputerze działają dwuklik, przyciski zoomu i klawiatura.
- Przesunięcie w dół zamyka podgląd. Dostępne są także przycisk zamknięcia i Escape.
- Strzałki na ekranach poniżej 640 px są na dole, dzięki czemu nie zasłaniają boków zdjęcia. Kontrolki uwzględniają safe area, a akcje zaznaczeń administratora mieszczą się nad dolną nawigacją.
- Podgląd i pobieranie nadal używają oryginału, z dotychczasowym fallbackiem URL. Biblioteka utrzymuje podglądy dwóch sąsiednich pozycji w obu kierunkach; film odtwarzany jest inline i zatrzymuje się po przejściu dalej.
- Na granicy partii jest dodatkowy slajd ładowania, więc gest i klawiatura doczytują kolejne media tak samo jak strzałka. Pierwsze nowe zdjęcie zastępuje ten slajd. Cofnięcie w trakcie pobierania zachowuje wybraną pozycję. Gdy żądanie nie doda mediów i podgląd nadal jest otwarty, slajd pozwala ponowić próbę.
- Portal biblioteki blokuje przewijanie i interakcje z tłem, przywraca fokus po zamknięciu oraz współpracuje z modalami akcji administratora. Obsługuje preferencję ograniczenia animacji.

Zmiana nie modyfikuje endpointów, sesji gościa ani przekazywania parametru `view`.

## Podgląd na komputerze

Wspólny `MediaLightbox` rozpoznaje główne urządzenie wskazujące przez `(hover: hover) and (pointer: fine)`. Dla obsługi myszą ustawia `animation.swipe = 0` i `animation.navigation = 0`, więc strzałki ekranowe, klawiatura oraz zakończenie przeciągania zmieniają zdjęcie natychmiast. Animacje otwierania, zamykania i zoomu zachowują dotychczasową konfigurację.

Urządzenia z głównym sterowaniem dotykowym zachowują domyślne animacje przejść, gesty przesuwania i zoom. Wybór nie zależy od szerokości ekranu: wąskie okno komputera nadal ma natychmiastowe przejścia, a duży ekran dotykowy zachowuje animacje. Hook `useMediaQuery` subskrybuje zmianę możliwości urządzenia wskazującego, również podczas otwartego podglądu. Preferencję ograniczenia animacji nadal obsługuje biblioteka.

## Paginacja i koszt odczytu

`GetAlbumMediaPageAsync` zwraca własny token kontynuacji wskazujący ostatnią trójkę `(capturedAt ?? uploadedAt, uploadedAt, id)`, powiązaną z `eventId` i `albumId`. Kolejna strona obejmuje media po tej trójce, nawet jeśli wcześniej pokazane rekordy usunięto. Token nie przyznaje dostępu: endpoint nadal sprawdza sesję lub capability-link, a zapytanie nadal filtruje album, wydarzenie, zatwierdzenie i status `ready`.

Niepoprawny token lub token innego albumu/wydarzenia daje `400 ALBUM_MEDIA_CONTINUATION_INVALID`. Tokeny Cosmos z poprzedniego sortowania wymagają odświeżenia albumu. Zdjęcia dodane w trakcie oglądania z datą wcześniejszą od bieżącego kursora pojawią się po odświeżeniu.

Panel admina zachowuje kontrakt `page/pageSize`, ale strony są wydzielane z tej samej globalnie posortowanej listy. Może nadal pokazywać media niezatwierdzone i z błędem, dostępne wyłącznie administratorowi.

Sortowanie w backendzie obejmuje jedynie dokumenty metadanych, bez pobierania plików z Blob Storage. Jest zgodne ze starszymi rekordami bez `capturedAt` i nie wymaga migracji ani nowego indeksu Cosmos. Każde żądanie strony odczytuje metadane całego albumu; koszt jest proporcjonalny do jego wielkości. Przy dużo większych zbiorach można przenieść tę samą kolejność do indeksowanego, znormalizowanego klucza w bazie.

## Weryfikacja

Po rozdzieleniu przejść dla myszy i dotyku przechodzą `npm run lint` i `npm run build`. Lokalny test rzeczywistego albumu linkowego w Chrome przed poprawką odtwarzał 500 ms animacji na komputerze. Po zmianie kliknięcia strzałek i klawiatura nie uruchamiają animacji karuzeli ani w oknie 1440 × 900, ani w wąskim oknie 390 × 844 z myszą. W emulacji telefonu 390 × 844 i dużego ekranu dotykowego 1200 × 900 zachowane są przejścia 500 ms oraz animowane gesty przesuwania. We wszystkich wariantach sprawdzono też zoom i zamknięcie podglądu. Próby używały syntetycznych zdjęć i nie obejmowały fizycznych urządzeń ani Safari.

Po zmianie doczytywania przechodzą `npm run lint` i `npm run build`. W rzeczywistej trasie albumu linkowego, na syntetycznym albumie 120 zdjęć, sprawdzono Chrome 390 × 844 oraz 1440 × 900. Przy opóźnieniu API o 600 ms kolejna partia zaczynała się pobierać 1400 px przed końcem. Zatrzymane odpowiedzi większych obrazów pokazały rozmyte miniatury; zwolnienie odpowiedzi nie zmieniło pozycji ani rozmiarów kafelków, także rekordu bez wymiarów. Zweryfikowano zachowanie scrolla i zaznaczeń, fallback do miniatury po błędzie preview, pojedyncze żądanie danej strony, brak pobierania całego albumu na ekranie hero, zachowanie galerii po błędzie kolejnej partii, brak pętli ponowień, ręczne ponowienie, koniec albumu i parametr `view` we wszystkich żądaniach.

Osobno sprawdzono rzeczywiste trasy zwykłego albumu gościa i albumu admina z syntetycznymi sesjami oraz albumami po 100 zdjęć. Przy przewijaniu dokumentu oba widoki pobrały kolejną partię 1400 px przed końcem, zachowały nagłówek sesji, wysłały pojedyncze żądanie kolejnej strony i zakończyły paginację po ostatniej partii. Podgląd nadal otwierał oryginały. Próby nie korzystały z produkcyjnego API ani danych użytkowników.

Po zmianie podglądu przechodzą `npm run lint` i `npm run build`. W Chrome z emulacją telefonu 390 × 844 sprawdzono rozmiar pionowego zdjęcia 390 × 585, pinch dwoma palcami, zoom i przesuwanie, gest zmiany zdjęcia przez granicę paginacji, cofnięcie podczas pobierania, ponowienie nieudanego pobrania, zaznaczanie, modal nad podglądem, Escape, kontrolki wideo, URL pobierania, powrót fokusu i przewijania, obrót ekranu oraz zamknięcie przesunięciem w dół. Osobno sprawdzono dwuklik na desktopie oraz rzeczywistą trasę albumu linkowego z lokalnymi danymi testowymi, zachowanie `view` i przekierowanie niezalogowanego gościa z chronionej galerii. Testy nie obejmują fizycznego urządzenia ani Safari na iOS.

`AlbumMediaOrderingTests` sprawdza 151 mediów z odwrotną kolejnością dat wykonania i uploadu, kolejne strony admina i gościa, brak daty wykonania, identyczne daty, usunięcie wcześniejszych elementów podczas paginacji, granice wydarzeń/albumów, ukryte i błędne media, starsze rekordy gości oraz błędne i obce tokeny. Filtry uwzględniają też przynależność do wielu albumów opisaną w [album-media-membership.md](album-media-membership.md). Łącznie z testami usuwania i przypisań przechodzą 43 testy backendu.

Uruchom `dotnet test backend/Marryly/Marryly.Tests/Marryly.Tests.csproj`, build backendu oraz lint i build frontendu. Przy weryfikacji ręcznej wgraj najstarsze zdjęcie na końcu i sprawdź, że po odświeżeniu jest pierwsze, również gdy album przekracza 50 elementów.
