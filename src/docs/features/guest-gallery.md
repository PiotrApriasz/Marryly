# Galeria gości

## Cel

Zwykła galeria dostępna po sesji gościa pokazuje media z albumu w uporządkowanej, prostej siatce. Jest niezależna od galerii udostępnianej linkiem, która pozostaje widokiem masonry.

## Kolejność i układ

- Media są pobierane z backendu według `uploadedAt` malejąco.
- Przed renderowaniem i po doczytaniu kolejnej strony widok ponownie sortuje wszystkie pobrane elementy po `uploadedAt`, od najnowszego do najstarszego.
- Zwykły widok albumu używa standardowej, row-major siatki równych kafelków, więc kolejność jest czytelna od lewej do prawej i z góry na dół.
- Układ masonry pozostaje wyłącznie w galerii dostępnej przez capability link.

## Weryfikacja

Dodaj kilka zdjęć w odstępach czasowych, odśwież zwykły album gościa i sprawdź, czy najnowszy element jest pierwszy. Przy większej liczbie elementów doczytaj kolejną stronę i upewnij się, że kolejność pozostaje malejąca po dacie dodania.
