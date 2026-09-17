# Marryly — przewodnik po projekcie

## Cel produktu

Marryly jest prywatną aplikacją weselną Alicji i Piotra. Łączy stronę informacyjną dla gości z narzędziami organizatorów: harmonogramem, menu, RSVP, listą gości, galerią, księgą gości, slideshowem oraz panelem administracyjnym.

Najważniejszą zasadą produktu jest rozdzielenie dostępu gości, administratorów i osób mających wyłącznie udostępniony link. Funkcje prywatne nie mogą przypadkowo ujawnić treści przez publiczne endpointy ani przez interfejs.

## Aktualna architektura

- **Frontend:** React 19, TypeScript, Vite, React Router i Tailwind CSS. Wspólne style komponentowe są głównie w `frontend/marryly-app/web/src/styles/components.css`; panel admina ma globalną kolejkę uploadu zdjęć utrwalaną w IndexedDB.
- **Backend:** .NET 9 Azure Functions. Logika jest podzielona na `Marryly.Application`, `Marryly.Infrastructure` i `Marryly.Functions`.
- **Dane:** Cosmos DB. Dane związane z wydarzeniem trafiają do kontenerów opisanych w [README backendu](../backend/Marryly/README.md).
- **Media:** galeria korzysta z istniejącego przepływu uploadu i wersji pochodnych; szczegóły MVP uploadu są w [photo-upload-mvp.md](../frontend/marryly-app/web/docs/photo-upload-mvp.md).

Dokument [target-architecture.md](architecture/target-architecture.md) jest wizją dalszej migracji do modularnego monolitu ASP.NET Core. Traktuj go jako kierunek, nie jako opis bieżącego runtime'u.

## Mapa repozytorium

```text
src/
├── AGENTS.md                         # instrukcje ładowane dla pracy Codex
├── docs/                             # dokumentacja projektu i handoff
├── backend/Marryly/
│   ├── Marryly.Application/           # modele, interfejsy, logika aplikacyjna
│   ├── Marryly.Infrastructure/        # Cosmos DB i implementacje serwisów
│   └── Marryly.Functions/             # endpointy Azure Functions i konfiguracja DI
└── frontend/marryly-app/web/
    └── src/
        ├── api/                       # klienci API
        ├── app/                       # routing i ochrona tras
        ├── components/                # komponenty wielokrotnego użytku
        ├── hooks/                     # logika pobierania danych i interakcji
        ├── pages/                     # strony
        ├── styles/                    # style współdzielone
        └── types/                     # typy TypeScript
```

## Lokalne uruchomienie i weryfikacja

Frontend:

```bash
cd frontend/marryly-app/web
npm install
npm run dev
npm run lint
npm run build
```

Backend:

```bash
cd backend/Marryly
dotnet restore
dotnet build
cd Marryly.Functions
func start
```

Backend wymaga lokalnego `local.settings.json`; jego schemat oraz zasady przechowywania sekretów opisuje [README backendu](../backend/Marryly/README.md). Tego pliku nie należy commitować ani kopiować do dokumentacji.

## Konwencje zmian

- Przed zmianą sprawdź istniejące komponenty, hooki i serwisy — projekt preferuje rozwijanie wspólnych elementów zamiast dublowania funkcji.
- Jeśli kontrakt API się zmienia, zmień równolegle model backendowy, endpoint, klienta API, typy frontendu i widok używający danych.
- Nowe dane eventowe w Cosmos DB opisuj przez jawny typ dokumentu i uwzględniaj ich partycjonowanie po `eventId`.
- Widoki publiczne i administracyjne mają inne mechanizmy autoryzacji. Nie mieszaj ich tylko po to, by uprościć routing.
- Po zmianie funkcjonalnej uruchom build/lint proporcjonalnie do zmienionej części oraz opisz rezultat w `current-status.md`, jeśli stan projektu się zmienił.
