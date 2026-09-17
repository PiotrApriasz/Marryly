# Marryly — instrukcje dla agenta

## Początek każdej pracy

Zanim rozpoczniesz zmianę w tym repozytorium, przeczytaj kolejno:

1. [docs/project-guide.md](docs/project-guide.md) — aktualny opis projektu, architektury i sposobu pracy;
2. [docs/current-status.md](docs/current-status.md) — handoff oraz stan ostatnio zrealizowanych funkcji.

Następnie sprawdź `git status --short`. Nie cofaj, nie nadpisuj ani nie porządkuj zmian, których nie wykonałeś w ramach bieżącego zadania.

## Dokumentacja funkcjonalności

- `docs/current-status.md` jest krótkim indeksem prac. Nie dopisuj do niego szczegółowego opisu implementacji każdej zmiany.
- Szczegóły pojedynczej funkcjonalności trzymaj w osobnym pliku w `docs/features/`. Nazwa pliku powinna być krótka, stabilna i w `kebab-case`.
- Jeśli użytkownik na początku zadania wskaże nazwę lub ścieżkę dokumentu funkcjonalności, najpierw przeczytaj ten plik i **kontynuuj go**. Aktualizuj istniejący dokument zamiast tworzyć nowy o tym samym zakresie.
- Jeśli użytkownik nie wskaże dokumentu, wyszukaj w `docs/features/` dokument opisujący dany obszar. Nowy plik utwórz tylko, gdy nie ma właściwego istniejącego zakresu.
- Po ukończeniu pracy aktualizuj dokument funkcjonalności. W `docs/current-status.md` zmieniaj wyłącznie krótki opis, status i link do dokumentu.

## Zasady pracy

- Zachowuj rozdział: React/Vite w `frontend/marryly-app/web`, Azure Functions/.NET w `backend/Marryly`.
- Nie umieszczaj sekretów, wartości z `local.settings.json` ani danych dostępowych w kodzie i dokumentacji.
- Wprowadzaj zmiany możliwie małe i reużywaj istniejące komponenty, hooki oraz serwisy.
- Dla zmiany frontendu uruchom, gdy jest to adekwatne: `cd frontend/marryly-app/web && npm run lint && npm run build`.
- Dla zmiany backendu uruchom, gdy jest to adekwatne: `dotnet build backend/Marryly/Marryly.sln --no-restore`.
- Po istotnej, ukończonej pracy produktowej uaktualnij właściwy dokument w `docs/features/`, wpis w `docs/current-status.md` oraz — gdy zmienia się sposób pracy lub architektura — `docs/project-guide.md`.

## Ważne ograniczenia funkcjonalne

- Zwykła galeria gościa oraz galeria udostępniona linkiem są oddzielnymi ścieżkami dostępu. Nie osłabiaj kontroli sesji gościa dla zwykłych endpointów.
- Link `?view=…` jest capability linkiem: może ujawniać wyłącznie albumy wskazane poprawnymi kodami w parametrze. Zachowuj ten parametr przy przejściu do albumu i paginacji.
- Katalog wygenerowanych linków służy tylko do zarządzania w panelu; usunięcie rekordu nie unieważnia wcześniej skopiowanego URL-a.
