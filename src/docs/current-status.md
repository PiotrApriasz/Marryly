# Marryly — status prac

Ten dokument jest celowo krótki. Służy jako indeks dla kolejnych prac, a szczegóły funkcjonalne znajdują się w `docs/features/`.

| Obszar | Status | Dokument |
| --- | --- | --- |
| Prywatne albumy i galeria udostępniona linkiem | Gotowe; selektor i widok albumu mają customowy układ dwóch ekranów, pełnoekranowe ładowanie przed pokazaniem właściwego hero, hero zachowujące proporcje zdjęcia, pełnoszeroką galerię masonry, postery filmów generowane w przeglądarce, selekcję, pobieranie ZIP oraz stopkę autorską. | [private-shared-gallery.md](features/private-shared-gallery.md) |
| Kolejność mediów w albumach | Gotowe; albumy admina, zwykłe i linkowe są globalnie sortowane w backendzie od najstarszej do najnowszej daty wykonania, przed paginacją. | [guest-gallery.md](features/guest-gallery.md) |
| Masowy upload mediów w panelu admina i upload gościa | Gotowe; admin i gość korzystają ze wspólnej trwałej kolejki do 800 pozycji, z obsługą zdjęć i filmów, postępem, wznowieniem po odświeżeniu i ponawianiem błędów. | [admin-bulk-upload.md](features/admin-bulk-upload.md) |
| Usuwanie mediów z albumów | Gotowe; galeria admina reużywa masonry i preview do 2560 px; podgląd ukrywa menu; usuwanie całej zawartości ma potwierdzenie i postęp. | [album-media-deletion.md](features/album-media-deletion.md) |

## Ostatnia weryfikacja

Po wdrożeniu globalnej chronologii albumów pomyślnie uruchomiono 20 testów i build backendu oraz lint i produkcyjny build frontendu.
