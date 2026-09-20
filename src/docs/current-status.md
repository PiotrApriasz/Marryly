# Marryly — status prac

Ten dokument jest celowo krótki. Służy jako indeks dla kolejnych prac, a szczegóły funkcjonalne znajdują się w `docs/features/`.

| Obszar | Status | Dokument |
| --- | --- | --- |
| Prywatne albumy i galeria udostępniona linkiem | Gotowe; selektor i widok albumu mają customowy układ dwóch ekranów, selekcję zdjęć, pobieranie ZIP oraz stopkę autorską. | [private-shared-gallery.md](features/private-shared-gallery.md) |
| Masowy upload zdjęć w panelu admina i upload gościa | Gotowe; admin i gość korzystają ze wspólnej trwałej kolejki do 500 pozycji, z postępem, wznowieniem po odświeżeniu i ponawianiem błędów. | [admin-bulk-upload.md](features/admin-bulk-upload.md) |

## Ostatnia weryfikacja

Po wdrożeniu masowego uploadu pomyślnie uruchomiono build backendu oraz lint i produkcyjny build frontendu. Przy kolejnych zmianach uruchom weryfikację odpowiednią do zmienionej części projektu.
