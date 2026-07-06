# Marryly

Marryly to prywatna aplikacja weselna dla wydarzenia Alicji i Piotra planowanego na 31 lipca 2026. Repo zawiera frontend dla gosci i panelu administracyjnego oraz backend oparty obecnie o Azure Functions i Cosmos DB.

## O czym jest projekt

Aplikacja laczy publiczna strone wydarzenia z zestawem narzedzi do obslugi wesela:

- strona glowna z podstawowymi informacjami o wydarzeniu,
- harmonogram dnia,
- menu i atrakcje,
- galeria i albumy,
- upload zdjec i filmow od gosci,
- slideshow wyswietlany na sali,
- ksiega gosci,
- panel admina do zarzadzania trescia i mediami,
- panel gosci z lista zaproszonych i statusem RSVP.

## Struktura repo

```text
src/
  backend/Marryly
  docs/architecture
  frontend/marryly-app/web
  marryly-codex-context.tmp
```

### Frontend

Sciezka: [frontend/marryly-app/web](/Users/piotrek/Developer/Current/Marryly/src/frontend/marryly-app/web)

Najwazniejsze informacje:

- React 19 + TypeScript + Vite + Tailwind CSS,
- obsluguje zarowno widoki publiczne, jak i panel administracyjny,
- glowne strony znajduja sie w `src/pages`,
- wspolne komponenty UI znajduja sie w `src/components`,
- wspolne style administracyjne i komponentowe znajduja sie w `src/styles/components.css`.

### Backend

Sciezka: [backend/Marryly](/Users/piotrek/Developer/Current/Marryly/src/backend/Marryly)

Najwazniejsze informacje:

- obecnie backend jest oparty o .NET 9 Azure Functions,
- dane trzymane sa w Cosmos DB,
- logika aplikacyjna jest rozdzielona na projekty `Marryly.Application`, `Marryly.Infrastructure` i `Marryly.Functions`,
- repo zawiera tez narzedzie `Marryly.Tools.PasswordHash` do generowania hasha hasla admina.

## Aktualny zakres funkcjonalny widoczny w repo

Na podstawie kodu i dokumentacji repo obejmuje obecnie:

- menu weselne i harmonogram wydarzen,
- galerie, albumy, upload zdjec i generowanie pochodnych wersji zdjec,
- slideshow i ustawienia slajdow,
- ksiege gosci,
- panel administracyjny z logowaniem,
- zarzadzanie lista gosci, grupami zaproszen, RSVP, noclegiem i transportem,
- widoki publiczne dla gosci oraz narzedzia administracyjne dla organizatorow.

## Najwazniejsze dokumenty

- [frontend/marryly-app/web/README.md](/Users/piotrek/Developer/Current/Marryly/src/frontend/marryly-app/web/README.md)
  Krotki opis produktu, stacku frontendu i uruchomienia aplikacji webowej.
- [backend/Marryly/README.md](/Users/piotrek/Developer/Current/Marryly/src/backend/Marryly/README.md)
  Konfiguracja backendu, kontenery Cosmos DB, endpointy i lokalne uruchomienie Azure Functions.
- [docs/architecture/target-architecture.md](/Users/piotrek/Developer/Current/Marryly/src/docs/architecture/target-architecture.md)
  Docelowy kierunek architektury backendu: modularny monolit z glownym API w ASP.NET Core.
- [frontend/marryly-app/web/docs/photo-upload-mvp.md](/Users/piotrek/Developer/Current/Marryly/src/frontend/marryly-app/web/docs/photo-upload-mvp.md)
  Opis przeplywu uploadu zdjec bezposrednio do Azure Blob Storage z SAS URL.

## Szybki start

### Frontend

```bash
cd frontend/marryly-app/web
npm install
npm run dev
```

Domyslny lokalny adres z dokumentacji frontendu: `http://localhost:5173`.

### Backend

```bash
cd backend/Marryly
dotnet restore
dotnet build
cd Marryly.Functions
func start
```

Backend wymaga skonfigurowania `local.settings.json` zgodnie z [backend/Marryly/README.md](/Users/piotrek/Developer/Current/Marryly/src/backend/Marryly/README.md).

## Dla przyszlych sesji Codex

Lokalny plik [marryly-codex-context.tmp](/Users/piotrek/Developer/Current/Marryly/src/marryly-codex-context.tmp) sluzy jako szybki handoff dla kolejnych rozmow. Zawiera on aktualny stan prac, ustalenia UX i pliki, od ktorych najlepiej zaczynac.
