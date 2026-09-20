# Masowy upload zdjęć w panelu admina i upload gościa

## Cel

Panel administracyjny pozwala dodać do 800 zdjęć lub filmów do jednego albumu w ramach jednej kolejki. Upload działa w tle panelu i nie blokuje przechodzenia między stronami.
Widok uploadu gościa wykorzystuje ten sam wspólny mechanizm kolejki i przyjmuje do 800 mediów w jednej partii.

## Zachowanie kolejki

- Kolejka przyjmuje zdjęcia i filmy partiami do limitu 800 pozycji przypisanych do albumu.
- Do wysyłania używane są maksymalnie dwa równoległe workery.
- Każdy plik przechodzi przez utworzenie celu SAS, bezpośredni upload do Blob Storage oraz zakończenie uploadu i generowanie pochodnych wersji.
- Kolejka jest przechowywana w IndexedDB razem z lokalnymi plikami, dlatego oczekujące i błędne pozycje mogą zostać wznowione po odświeżeniu.
- Filmy nie mają aplikacyjnego limitu rozmiaru; nadal obowiązują ograniczenia techniczne przeglądarki, IndexedDB, sieci i Blob Storage.
- Elementy aktywne w chwili odświeżenia wracają do stanu oczekującego. Po sukcesie pozycja jest usuwana z kolejki, a po błędzie pozostaje dostępna dla akcji „Ponów błędne”.
- Przy braku sieci kolejka zatrzymuje się i wznawia po powrocie połączenia. Wygaśnięcie sesji zatrzymuje upload bez usuwania zapisanych plików.
- Upload gościa korzysta z tej samej trwałej kolejki, ale wysyła dane przez osobne endpointy gościa. Można przejść na inną stronę, a po odświeżeniu oczekujące i błędne pliki wracają do kolejki.

Przeglądarka może ograniczyć ilość danych możliwych do zapisania w IndexedDB. W takim przypadku panel pokazuje ostrzeżenie i kontynuuje upload w pamięci bieżącej sesji.

## Idempotencja

Każda pozycja przekazuje stabilny `clientUploadId`. Backend wiąże go z wydarzeniem oraz albumem albo zakresem gościa, dzięki czemu ponowienie tego samego uploadu korzysta z tego samego identyfikatora media/blob. Ponowione zakończenie gotowego uploadu zwraca istniejące medium zamiast tworzyć duplikat.

Limit 800 jest współdzielony przez kolejkę admina i partię uploadu gościa. Obie ścieżki nadal korzystają z osobnych endpointów i zasad autoryzacji.

## Weryfikacja

Sprawdź wybór 800 zdjęć i filmów w panelu admina i widoku gościa, dodawanie kolejnych partii, zmianę strony panelu, odświeżenie, wznowienie po błędzie sieci, ponowienie błędnych pozycji, zdjęcia HEIC oraz przypadek ograniczonego miejsca w IndexedDB. Zweryfikuj również, że upload gościa nadal używa osobnych endpointów i poprawnie obsługuje zdjęcia oraz filmy.
