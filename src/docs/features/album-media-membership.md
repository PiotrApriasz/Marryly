# Wspólne media w wielu albumach

## Zachowanie panelu

Administrator zaznacza zdjęcia i filmy w siatce lub podglądzie, również przez „Zaznacz wszystko”, i wybiera „Dodaj do albumu”. Okno pokazuje pozostałe istniejące albumy wydarzenia, w tym ukryte i dostępne linkiem. Wybór jednego albumu i zatwierdzenie dodaje przypisania; media pozostają w albumie źródłowym. Album docelowy zachowuje własne ustawienia dostępu. Nie jest tworzony nowy album ani zmieniane zatwierdzenie mediów.

- Akcje są dostępne w pływającym pasku nad siatką i jako ikony w podglądzie. Obok działa [pobieranie zaznaczonych mediów w ZIP](admin-media-download.md). Wybór albumu działa również nad lightboxem; Escape zamyka okno i przywraca fokus do podglądu.
- Ponowne dodanie do tego samego albumu nie tworzy duplikatów. Po dodaniu zaznaczenie pozostaje, aby można było dodać je do następnego albumu.
- Dodawanie i usuwanie obejmuje migawkę zaznaczonych identyfikatorów, dzieloną na partie po 25. Nie obejmuje plików dodanych po zaznaczeniu wszystkiego. W czasie operacji wybór jest zablokowany i widoczny jest postęp.
- Puste okno wyboru informuje, że należy najpierw utworzyć drugi album. Album źródłowy nie jest oferowany jako docelowy.
- Błąd może oznaczać częściowe wykonanie. Operację można ponowić bez powielania przypisań. Brakujące media są pomijane; po dodawaniu panel sygnalizuje pominięcie, jeśli wystąpiło.
- Liczniki albumów, cache admina i galerii są odświeżane. Dodawanie nie przeładowuje źródłowej siatki ani nie zamyka podglądu.

Kosz otwiera wybór dwóch osobnych akcji: usunięcie przypisania do bieżącego albumu albo trwałe usunięcie ze wszystkich albumów i Blob Storage. Usunięcie ostatniego przypisania jest blokowane; najpierw należy dodać medium do innego albumu albo jawnie usunąć je trwale. Szczegóły są w [album-media-deletion.md](album-media-deletion.md).

## Dane i odczyt

Jeden `MediaItem` w kontenerze `MediaItems` nadal wskazuje jeden oryginał, preview i miniaturę. Przypisanie do kolejnego albumu zmienia wyłącznie metadane; nie zapisuje żadnych kopii plików ani rekordów mediów.

- Opcjonalna tablica `albumIds` jest źródłem prawdy dla przynależności, gdy występuje. Wartości są unikalne.
- `albumId` pozostaje niezmienionym albumem pochodzenia uploadu, potrzebnym również przy ponawianiu jego zakończenia. Nie przywraca przypisania usuniętego z `albumIds`.
- Starsze dokumenty bez tablicy zachowują pojedynczy `albumId`; brak lub pusty `albumId` oznacza systemowy album `guest`. Zapis przypisań uzupełnia tablicę dopiero dla zmienianych mediów. Nowe uploady dostają jedną pozycję. Nie jest potrzebna migracja istniejących dokumentów.
- Filtry albumów stosują tablicę z fallbackiem wyłącznie dla starszych rekordów. Dotyczy to siatki admina i gościa, galerii linkowej, wyboru hero, ZIP, selekcji, sprawdzania pustego albumu i slideshowu. Kolejność chronologiczna pozostaje wspólna. Slideshow obejmujący kilka albumów pokazuje współdzielone zdjęcie jeden raz.
- Liczniki i okładki liczą medium w każdym przypisanym albumie. Globalna liczba plików nadal liczy jeden rekord.

Zmiany przynależności używają odczytu i warunkowego zapisu po ETag. Konflikt powoduje ponowny odczyt i przeliczenie zmiany (maksymalnie pięć prób). Zapis metadanych z przetwarzania preview lub miniatur zachowuje aktualne przypisania, aby wcześniejszy odczyt nie cofnął selekcji administratora.

## API i dostęp

- `POST /panel/albums/{albumId}/media/add-to-album`: `{ targetAlbumId, mediaIds }` → `{ processedCount }`.
- `POST /panel/albums/{albumId}/media/remove`: `{ mediaIds }` → `{ processedCount }`.
- Obie akcje przyjmują 1–25 identyfikatorów i wymagają sesji administratora. Album źródłowy i docelowy muszą istnieć w jego wydarzeniu; dodawanie wymaga innego albumu docelowego.
- Istniejące media są walidowane przed zmianą partii; dodawanie i trwałe usuwanie wymagają przynależności do albumu źródłowego. Usuwanie przypisania toleruje pozycje już odłączone przy ponowieniu. Odczyty i zapisy są ograniczone partycją `eventId`.
- Odpowiedź admina o medium zawiera efektywne `albumIds`. Odpowiedzi galerii gościa nie ujawniają listy innych przypisań.
- Sesja gościa i capability-link pozostają oddzielnymi ścieżkami. Link do albumu wybranych udostępnia tylko media tego albumu, a nie całą zawartość źródła. Nadal obowiązują `approved=true` i `status=ready`.

Zmiana nie wymaga nowego kontenera ani kopiowania Blob Storage. Przy wdrożeniu najpierw należy udostępnić backend rozumiejący `albumIds`, następnie frontend korzystający z nowych akcji.

## Weryfikacja

43 testy backendu obejmują dotychczasową chronologię i usuwanie oraz dodawanie zdjęć i filmów bez kopiowania plików, zgodność starszych danych, powtarzanie i częściowy błąd, ochronę granic albumu/wydarzenia, usunięcie tylko przypisania, ochronę ostatniego albumu, trwałe usuwanie z drugiego albumu, zapis preview po zmianie przypisań oraz odczyt galerii, ZIP, hero, liczników i slideshowu.

W przeglądarce z rzeczywistymi komponentami i lokalnym API na syntetycznych obrazach sprawdzono dodawanie z lightboxa, ponowienie bez duplikatu, usuwanie tylko ze źródła, zachowanie medium w drugim albumie, komunikat dla ostatniego przypisania i dodanie 54 pozycji przy 50 wczytanych. Oba albumy miały po 54 pozycje. Sprawdzono mobilny pasek, okno wyboru, Escape i przywrócenie aktywności tła. Lint i produkcyjny build frontendu oraz build backendu przechodzą.
