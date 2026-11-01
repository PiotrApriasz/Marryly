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

## Paginacja i koszt odczytu

`GetAlbumMediaPageAsync` zwraca własny token kontynuacji wskazujący ostatnią trójkę `(capturedAt ?? uploadedAt, uploadedAt, id)`, powiązaną z `eventId` i `albumId`. Kolejna strona obejmuje media po tej trójce, nawet jeśli wcześniej pokazane rekordy usunięto. Token nie przyznaje dostępu: endpoint nadal sprawdza sesję lub capability-link, a zapytanie nadal filtruje album, wydarzenie, zatwierdzenie i status `ready`.

Niepoprawny token lub token innego albumu/wydarzenia daje `400 ALBUM_MEDIA_CONTINUATION_INVALID`. Tokeny Cosmos z poprzedniego sortowania wymagają odświeżenia albumu. Zdjęcia dodane w trakcie oglądania z datą wcześniejszą od bieżącego kursora pojawią się po odświeżeniu.

Panel admina zachowuje kontrakt `page/pageSize`, ale strony są wydzielane z tej samej globalnie posortowanej listy. Może nadal pokazywać media niezatwierdzone i z błędem, dostępne wyłącznie administratorowi.

Sortowanie w backendzie obejmuje jedynie dokumenty metadanych, bez pobierania plików z Blob Storage. Jest zgodne ze starszymi rekordami bez `capturedAt` i nie wymaga migracji ani nowego indeksu Cosmos. Każde żądanie strony odczytuje metadane całego albumu; koszt jest proporcjonalny do jego wielkości. Przy dużo większych zbiorach można przenieść tę samą kolejność do indeksowanego, znormalizowanego klucza w bazie.

## Weryfikacja

`AlbumMediaOrderingTests` sprawdza 151 mediów z odwrotną kolejnością dat wykonania i uploadu, kolejne strony admina i gościa, brak daty wykonania, identyczne daty, usunięcie wcześniejszych elementów podczas paginacji, granice wydarzeń/albumów, ukryte i błędne media, starsze rekordy gości oraz błędne i obce tokeny. Łącznie z testami usuwania przechodzi 20 testów backendu.

Uruchom `dotnet test backend/Marryly/Marryly.Tests/Marryly.Tests.csproj`, build backendu oraz lint i build frontendu. Przy weryfikacji ręcznej wgraj najstarsze zdjęcie na końcu i sprawdź, że po odświeżeniu jest pierwsze, również gdy album przekracza 50 elementów.
