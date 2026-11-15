# Marryly — status prac

Ten dokument jest celowo krótki. Służy jako indeks dla kolejnych prac, a szczegóły funkcjonalne znajdują się w `docs/features/`.

| Obszar | Status | Dokument |
| --- | --- | --- |
| Prywatne albumy i galeria udostępniona linkiem | Gotowe; selektor i widok albumu mają customowy układ dwóch ekranów, pełnoekranowe ładowanie przed pokazaniem właściwego hero, hero zachowujące proporcje zdjęcia, pełnoszeroką galerię masonry, postery filmów generowane w przeglądarce, selekcję, pobieranie ZIP oraz stopkę autorską. | [private-shared-gallery.md](features/private-shared-gallery.md) |
| Kolejność mediów w albumach | Gotowe; albumy admina, zwykłe i linkowe są globalnie sortowane w backendzie od najstarszej do najnowszej daty wykonania, przed paginacją. | [guest-gallery.md](features/guest-gallery.md) |
| Podgląd zdjęć na telefonie | Gotowe; pełny ekran przeglądarki bez bocznych marginesów, gesty zmiany zdjęć, pinch i double tap, przesuwanie powiększenia oraz doczytywanie gestem. | [guest-gallery.md](features/guest-gallery.md#podgląd-na-telefonie) |
| Masowy upload mediów w panelu admina i upload gościa | Gotowe; admin i gość korzystają ze wspólnej trwałej kolejki do 800 pozycji, z obsługą zdjęć i filmów, postępem, wznowieniem po odświeżeniu i ponawianiem błędów. | [admin-bulk-upload.md](features/admin-bulk-upload.md) |
| Usuwanie mediów z albumów | Gotowe; admin zaznacza zdjęcia i filmy w siatce i podglądzie lub cały album; kosz usuwa wyłącznie zaznaczone po potwierdzeniu. | [album-media-deletion.md](features/album-media-deletion.md) |
| Media w wielu albumach | Gotowe; zaznaczone zdjęcia i filmy można dodać do kolejnego albumu bez kopii plików; osobne akcje usuwają przypisanie lub trwale ze wszystkich albumów. | [album-media-membership.md](features/album-media-membership.md) |
| Pobieranie zaznaczeń w panelu admina | Gotowe; ZIP z oryginałami zdjęć i filmów, także dla całego albumu przez „Zaznacz wszystko”; dostępne w siatce i podglądzie. | [admin-media-download.md](features/admin-media-download.md) |

## Ostatnia weryfikacja

Po dodaniu pobierania zaznaczeń przechodzi 48 testów i build backendu oraz lint i produkcyjny build frontendu. W przeglądarce zweryfikowano pobrany ZIP dla 54 pozycji przy 50 wczytanych oraz mobilne kontrolki podglądu.

Po zmianie mobilnego podglądu przechodzą lint i build frontendu oraz sprawdzenie gestów, paginacji, zaznaczeń i modalów w emulacji telefonu w Chrome. Szczegóły w [guest-gallery.md](features/guest-gallery.md#weryfikacja).
