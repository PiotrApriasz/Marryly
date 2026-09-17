# Masowy upload zdjęć w panelu admina

## Cel

Panel administracyjny pozwala dodać do 500 zdjęć do jednego albumu w ramach jednej kolejki. Upload działa w tle panelu i nie blokuje przechodzenia między stronami.

## Zachowanie kolejki

- Kolejka przyjmuje zdjęcia partiami do limitu 500 pozycji przypisanych do albumu.
- Do wysyłania używane są maksymalnie dwa równoległe workery.
- Każdy plik przechodzi przez utworzenie celu SAS, bezpośredni upload do Blob Storage oraz zakończenie uploadu i generowanie pochodnych wersji.
- Kolejka jest przechowywana w IndexedDB razem z lokalnymi plikami, dlatego oczekujące i błędne pozycje mogą zostać wznowione po odświeżeniu.
- Elementy aktywne w chwili odświeżenia wracają do stanu oczekującego. Po sukcesie pozycja jest usuwana z kolejki, a po błędzie pozostaje dostępna dla akcji „Ponów błędne”.
- Przy braku sieci kolejka zatrzymuje się i wznawia po powrocie połączenia. Wygaśnięcie sesji admina zatrzymuje upload bez usuwania zapisanych plików.

Przeglądarka może ograniczyć ilość danych możliwych do zapisania w IndexedDB. W takim przypadku panel pokazuje ostrzeżenie i kontynuuje upload w pamięci bieżącej sesji.

## Idempotencja

Admin przekazuje dla każdej pozycji stabilny `clientUploadId`. Backend wiąże go z wydarzeniem i albumem, dzięki czemu ponowienie tego samego uploadu korzysta z tego samego identyfikatora media/blob. Ponowione zakończenie gotowego uploadu zwraca istniejące medium zamiast tworzyć duplikat.

Zwykły upload zdjęć i filmów gości zachowuje dotychczasowy limit oraz przepływ.

## Weryfikacja

Sprawdź wybór 500 zdjęć, dodawanie kolejnych partii, zmianę strony panelu, odświeżenie, wznowienie po błędzie sieci, ponowienie błędnych pozycji, duplikaty, zdjęcia HEIC oraz przypadek ograniczonego miejsca w IndexedDB. Zweryfikuj również, że zwykły upload gościa pozostał bez zmian.
