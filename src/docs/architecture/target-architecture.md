# Marryly - docelowa architektura backendu

## Status decyzji

Ten dokument opisuje docelowy kierunek architektury backendu Marryly po decyzji, ze aplikacja pozostaje modularnym monolitem, a nie zostaje rozbita na mikroserwisy per funkcjonalnosc.

Glowne decyzje:

- Backend docelowo przechodzi z modelu "wszystko jako Azure Functions HTTP" na glowny backend HTTP w ASP.NET Core Minimal API.
- Architektura pozostaje modularnym monolitem z wyraznymi bounded contexts.
- Cosmos DB zostaje glowna baza danych.
- `eventId` pozostaje obecnym identyfikatorem partycji, ale w architekturze traktujemy go jako obecny odpowiednik `tenantId`.
- Azure Functions zostaja dla workloadow, do ktorych pasuja naturalnie: triggery, harmonogramy, webhooki, proste zadania asynchroniczne.
- Workery przejmuja dluzsze procesy, zwlaszcza przetwarzanie mediow.
- SignalR zostaje hostowany razem z API, bez osobnego Azure SignalR Service na tym etapie.
- .NET Aspire sluzy do lokalnej orkiestracji, konfiguracji zaleznosci, observability i wdrozenia na Azure Container Apps.

## Cel architektury

Celem nie jest stworzenie wielu niezaleznych systemow, tylko uporzadkowanie rosnacej aplikacji tak, aby:

- funkcjonalnosci byly rozdzielone domenowo w kodzie,
- deployment pozostal prosty,
- koszt operacyjny byl niski,
- synchroniczne API bylo szybkie i przewidywalne,
- dluzsze procesy nie blokowaly requestow HTTP,
- latwo bylo dodawac nowe moduly bez przepisywania fundamentow,
- w przyszlosci mozna bylo wydzielic wybrane moduly, jezeli pojawi sie prawdziwy powod biznesowy lub skalowy.

## Docelowy uklad projektow

Proponowany docelowy uklad backendu:

```text
backend/Marryly
  Marryly.AppHost
  Marryly.ServiceDefaults
  Marryly.Api
  Marryly.Application
  Marryly.Domain
  Marryly.Infrastructure
  Marryly.Functions
  Marryly.Worker
  Marryly.Contracts
  Marryly.Tools.PasswordHash
  Marryly.Tests
```

### `Marryly.AppHost`

Projekt .NET Aspire odpowiedzialny za lokalna orkiestracje i opis aplikacji jako calosci.

Odpowiedzialnosci:

- uruchamianie `Marryly.Api`,
- uruchamianie `Marryly.Worker`,
- opcjonalne uruchamianie `Marryly.Functions` lokalnie,
- deklaracja zaleznosci takich jak Cosmos DB, Storage, kolejka, Application Insights,
- lokalne wiring konfiguracji i sekretow developerskich,
- podstawa do wdrozenia na Azure Container Apps.

`AppHost` nie zawiera logiki biznesowej.

### `Marryly.ServiceDefaults`

Wspolna konfiguracja techniczna dla hostowanych procesow .NET.

Odpowiedzialnosci:

- OpenTelemetry,
- health checks,
- service discovery w Aspire,
- retry/timeouts dla klientow HTTP, jezeli beda potrzebne,
- wspolne ustawienia logowania i diagnostyki.

Ten projekt powinien byc czysto infrastrukturalny.

### `Marryly.Api`

Glowny backend HTTP aplikacji, hostowany jako kontener w Azure Container Apps.

Technologia:

- ASP.NET Core Minimal API,
- endpointy pogrupowane modulami,
- SignalR hubs hostowane w tym samym procesie,
- DI do warstwy Application i Infrastructure,
- middleware dla auth, tenant resolution, problem details, CORS i telemetry.

Odpowiedzialnosci:

- publiczne API dla gosci,
- API panelu administracyjnego,
- obsluga logowania i tokenow,
- szybkie operacje synchroniczne,
- walidacja requestow,
- autoryzacja,
- tenant resolution,
- wystawienie SignalR hubs,
- kolejkowanie pracy asynchronicznej do workerow albo Functions.

`Marryly.Api` nie powinno wykonywac dlugich procesow takich jak generowanie miniaturek zdjec w ramach requestu HTTP.

### `Marryly.Application`

Warstwa przypadkow uzycia i portow aplikacyjnych.

Odpowiedzialnosci:

- use case'y domenowe,
- interfejsy repozytoriow i serwisow infrastrukturalnych,
- modele request/response dla przypadkow uzycia, jezeli sa wewnetrzne dla backendu,
- walidacja reguly aplikacyjnej, ktora nie zalezy od transportu HTTP,
- orchestration miedzy modelami domenowymi w ramach jednego procesu.

Ta warstwa nie powinna znac Azure Functions, ASP.NET endpointow ani szczegolow Cosmos SDK.

### `Marryly.Domain`

Docelowe miejsce na czysta logike domenowa.

Odpowiedzialnosci:

- encje domenowe,
- value objects,
- reguly domenowe,
- domenowe wyliczenia i stale,
- metody utrzymujace spojnosc agregatow.

Na start nie trzeba agresywnie przenosic wszystkiego z `Marryly.Application`. Ten projekt warto wprowadzac stopniowo przy wiekszych zmianach domenowych, zwlaszcza tam, gdzie modele zaczynaja miec realne reguly zachowania.

### `Marryly.Infrastructure`

Implementacje techniczne portow z `Marryly.Application`.

Odpowiedzialnosci:

- Cosmos DB,
- Azure Blob Storage,
- kolejki,
- generowanie SAS do uploadu,
- implementacje repozytoriow,
- implementacje serwisow technicznych,
- adaptery do zewnetrznych providerow.

Ta warstwa moze znac SDK Azure. Nie powinna zawierac endpointow HTTP ani logiki prezentacyjnej API.

### `Marryly.Functions`

Azure Functions pozostaja jako host dla workloadow triggerowanych zdarzeniami.

Odpowiedzialnosci:

- blob triggers,
- queue triggers, jezeli dla danego przypadku Functions beda prostsze niz worker,
- timer triggers,
- webhooki od zewnetrznych systemow,
- male, idempotentne zadania infrastrukturalne,
- techniczne automatyzacje, ktore nie sa glownym API aplikacji.

Docelowo `Marryly.Functions` nie powinno byc glownym miejscem dla CRUD HTTP aplikacji.

### `Marryly.Worker`

Dlugotrwale procesy dzialajace poza requestem HTTP.

Technologia:

- .NET Worker Service,
- hostowany jako Azure Container App albo Azure Container Apps Job,
- uruchamiany lokalnie przez Aspire.

Odpowiedzialnosci:

- przetwarzanie zdjec,
- generowanie miniaturek i preview,
- moderacja mediow, jezeli dojdzie,
- import/export danych,
- wysylka powiadomien,
- budowanie ciezszych read modeli,
- retry dla operacji zewnetrznych,
- prace konserwacyjne wymagajace wiecej czasu niz typowy request HTTP.

Worker powinien byc idempotentny. Powtorzenie tej samej wiadomosci z kolejki nie powinno uszkadzac danych.

### `Marryly.Contracts`

Opcjonalny projekt na kontrakty wspolne miedzy procesami.

Odpowiedzialnosci:

- komunikaty kolejkowe,
- eventy integracyjne wewnatrz aplikacji,
- stabilne DTO uzywane przez `Api`, `Worker` i `Functions`.

Nie nalezy wrzucac tu wszystkich modeli "na zapas". Ten projekt ma sens tylko dla kontraktow, ktore faktycznie przekraczaja granice procesu.

### `Marryly.Tools.PasswordHash`

Pozostaje jako narzedzie developersko-operacyjne do generowania hasha hasla admina.

## Bounded contexts

Bounded contexts sa logicznymi granicami w modularnym monolicie. Nie oznaczaja osobnych mikroserwisow ani osobnych deploymentow.

### Tenant / Event Context

Odpowiada za identyfikacje wydarzenia i konfiguracje tenantowa.

Zakres:

- `eventId` jako obecny identyfikator tenantowy,
- podstawowe dane wydarzenia,
- harmonogram,
- menu,
- atrakcje,
- ustawienia publicznej strony wydarzenia.

Docelowo warto oddzielic pojecia:

- `tenantId` - para mloda / klient / przestrzen danych,
- `eventId` - konkretne wydarzenie slubne.

Na obecnym etapie moga byc ta sama wartoscia, ale w kodzie architektonicznie powinnismy myslec o `eventId` jak o obecnym tenant scope.

### Tenant scope jako jawne pojecie

Obecnie `eventId` pelni dwie role naraz:

- identyfikuje konkretne wydarzenie,
- wyznacza granice danych tenantowych w Cosmos DB.

To dziala na obecnym etapie, bo jeden tenant praktycznie odpowiada jednemu wydarzeniu. Architektonicznie warto jednak juz teraz nazwac te role osobno:

- `tenantId` odpowiada na pytanie: "czyje to sa dane?",
- `eventId` odpowiada na pytanie: "ktorego wydarzenia dotycza te dane?".

Na dzis fizyczna wartosc moze byc taka sama. Nie trzeba natychmiast migrowac dokumentow w Cosmos DB ani zmieniac partition key. Chodzi o to, zeby nowe elementy architektury nie utrwalaly zalozenia, ze tenant zawsze bedzie tym samym co wydarzenie.

Praktyczne zasady na najblizszy etap:

- w API wprowadzic pojecie `TenantContext` albo `EventContext`, ktore jawnie niesie scope requestu,
- w nowym kodzie unikac przekazywania luznego `eventId` przez wiele warstw, jezeli lepiej przekazac obiekt kontekstu,
- w autoryzacji rozstrzygac tenant scope w jednym miejscu,
- w komunikatach async dodawac `eventId`, a docelowo przewidziec tez `tenantId`,
- w SignalR grupy nadal moga byc oparte o `eventId`, ale powinny byc traktowane jako grupy tenant/event-scoped,
- w dokumentach Cosmos DB dalej wymagac `eventId`, a przy nowych modelach rozwazac dodanie `tenantId`, jezeli model moze przetrwac przyszle rozdzielenie tych pojec.

Dzieki temu pozniejsze funkcje SaaS beda prostsze:

- onboarding wielu par mlodych,
- plany i pakiety,
- billing,
- konta premium,
- wiele wydarzen pod jednym klientem,
- dedykowane zasoby dla wybranych tenantow,
- deployment stamps albo shardowanie tenantow w przyszlosci.

To jest decyzja glownie semantyczna i architektoniczna. Najpierw porzadkujemy nazewnictwo i granice odpowiedzialnosci, a dopiero pozniej, jezeli pojawi sie potrzeba, zmieniamy fizyczny model danych.

### Jak wprowadzic `TenantContext` / `EventContext`

W obecnej aplikacji zalazek tego mechanizmu juz istnieje. `AccessTokenContext` niesie `Subject`, `Role`, `Email` i `EventId`, a funkcje po walidacji tokenu wyciagaja `context.EventId` i przekazuja go dalej do serwisow.

Przyklad obecnego stylu:

```csharp
var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
if (auth.Response is not null)
{
    return auth.Response;
}

var eventId = auth.Context!.EventId;
var response = await guestListService.GetGuestListAsync(eventId, ct);
```

To dziala, ale ma dwa minusy:

- `eventId` jest przekazywany jako luzny string przez wiele warstw,
- transport HTTP i auth sa blisko sklejone z wyznaczaniem scope requestu.

Docelowo warto wprowadzic jawny kontekst requestu:

```csharp
public sealed record TenantContext(
    string TenantId,
    string EventId,
    string Subject,
    string Role,
    string? Email)
{
    public bool IsAdmin => string.Equals(Role, "admin", StringComparison.Ordinal);
    public bool IsGuest => string.Equals(Role, "guest", StringComparison.Ordinal);
}
```

Na obecnym etapie `TenantId` moze byc ustawiany taka sama wartoscia jak `EventId`:

```csharp
public static TenantContext FromAccessToken(AccessTokenContext accessToken)
{
    return new TenantContext(
        TenantId: accessToken.EventId,
        EventId: accessToken.EventId,
        Subject: accessToken.Subject,
        Role: accessToken.Role,
        Email: accessToken.Email);
}
```

Mozna tez nazwac ten obiekt `EventContext`, jezeli na poczatku chcemy mniej zmieniac jezyk domeny:

```csharp
public sealed record EventContext(
    string EventId,
    string TenantId,
    string Subject,
    string Role,
    string? Email);
```

Preferowany kierunek dla Marryly to `TenantContext`, bo aplikacja zmierza w strone SaaS. `EventContext` moze pojawic sie jako wezszy obiekt w modulach, ktore faktycznie operuja tylko na jednym wydarzeniu.

#### Gdzie powinien powstawac kontekst

Kontekst powinien powstawac przy granicy aplikacji, czyli w API, Functions albo workerze.

W `Marryly.Api` najlepszym miejscem bedzie middleware albo endpoint filter:

```csharp
app.Use(async (httpContext, next) =>
{
    var token = httpContext.Request.Headers["X-Marryly-Access-Token"].ToString();
    var accessToken = tokenValidator.Validate(token);

    var tenantContext = TenantContextFactory.FromAccessToken(accessToken);
    httpContext.Items["TenantContext"] = tenantContext;

    await next();
});
```

Endpointy nie powinny same parsowac tokenu, jezeli middleware juz to zrobil. Powinny pobierac gotowy kontekst przez endpoint filter, scoped accessor albo jawny helper:

```csharp
group.MapGet("/panel/guests", async (
    ITenantContextAccessor tenantAccessor,
    IGuestListService guestListService,
    CancellationToken ct) =>
{
    var tenant = tenantAccessor.Current;
    var response = await guestListService.GetGuestListAsync(tenant.EventId, ct);
    return Results.Ok(response);
});
```

W Azure Functions mozna zrobic lagodny krok posredni: zostawic `AuthHelpers`, ale zwracac z nich gotowy kontekst tenantowy:

```csharp
internal static async Task<(HttpResponseData? Response, TenantContext? Tenant)> ValidateAdminTenantAsync(
    HttpRequestData req,
    IAuthService authService)
{
    var auth = await ValidateAdminAsync(req, authService);
    if (auth.Response is not null || auth.Context is null)
    {
        return (auth.Response, null);
    }

    return (null, TenantContextFactory.FromAccessToken(auth.Context));
}
```

Wtedy funkcja przestaje pracowac na luznym `eventId`:

```csharp
var auth = await AuthHelpers.ValidateAdminTenantAsync(req, authService);
if (auth.Response is not null)
{
    return auth.Response;
}

var tenant = auth.Tenant!;
var response = await guestListService.GetGuestListAsync(tenant.EventId, ct);
```

#### Jak przekazywac kontekst do Application

Sa dwa sensowne warianty.

Wariant pierwszy: minimalna zmiana, serwisy nadal przyjmuja `eventId`, a endpointy wyciagaja go z `TenantContext`.

```csharp
await guestBookService.GetGuestBookEntriesPageAsync(
    tenant.EventId,
    page,
    pageSize,
    ct);
```

To jest najlepszy pierwszy krok, bo ogranicza liczbe zmian.

Wariant drugi: nowe use case'y przyjmuja caly `TenantContext` albo wezszy `EventScope`.

```csharp
public sealed record EventScope(string TenantId, string EventId);

public interface IGuestListService
{
    Task<GuestListResponse> GetGuestListAsync(EventScope scope, CancellationToken ct = default);
}
```

Ten wariant jest czytelniejszy dla nowych modulow, ale nie trzeba od razu przepisywac wszystkich istniejacych interfejsow.

#### Rekomendowana sciezka dla Marryly

1. Dodac model `TenantContext` w warstwie Application, np. w `Marryly.Application/Auth` albo `Marryly.Application/Tenancy`.
2. Dodac `TenantContextFactory`, ktore mapuje `AccessTokenContext` na `TenantContext`.
3. Zachowac `AccessTokenContext` jako techniczny model tokenu JWT.
4. W Functions dodac nowe helpery `ValidateUserTenantAsync` i `ValidateAdminTenantAsync`.
5. W nowych endpointach API wymagac gotowego `TenantContext`, a nie samodzielnie czytac token.
6. Na poczatku przekazywac do istniejacych serwisow `tenant.EventId`.
7. Przy nowych lub wiekszych refaktorach przechodzic z parametru `string eventId` na `EventScope` albo `TenantContext`, jezeli use case potrzebuje tez roli/uzytkownika.

Zasada praktyczna:

- `AccessTokenContext` opisuje to, co przyszlo z tokenu,
- `TenantContext` opisuje scope aktualnego requestu,
- `EventScope` opisuje minimalny zakres danych potrzebny repozytoriom i serwisom domenowym,
- encje i dokumenty Cosmos DB nadal przechowuja `EventId`.

Najwazniejsze jest to, zeby `TenantContext` nie stal sie "workiem na wszystko". Powinien niesc tylko informacje potrzebne do autoryzacji, tenant scope i audytu. Szczegoly konkretnego modulu, np. `albumId`, `guestId` albo `slideshowId`, powinny zostac normalnymi parametrami requestu.

### Access / Auth Context

Odpowiada za dostep do aplikacji i panelu.

Zakres:

- logowanie admina,
- token admina,
- access code dla gosci,
- kontekst dostepu zawierajacy tenant/event scope,
- autoryzacja endpointow panelowych.

Ten kontekst powinien byc centralnym miejscem rozstrzygania, do jakiego tenant/event scope nalezy request.

### Guest Management Context

Odpowiada za liste gosci i RSVP.

Zakres:

- goscie,
- grupy zaproszen,
- rodziny,
- osoby towarzyszace,
- status obecnosci,
- nocleg,
- transport,
- podsumowania gosci.

To jest samodzielny modul domenowy, ale nie wymaga osobnego serwisu. Jego dane sa naturalnie tenant-local i dobrze pasuja do Cosmos DB z partycja po `eventId`.

### Guestbook Context

Odpowiada za wpisy w ksiedze gosci.

Zakres:

- dodawanie zyczen,
- lista wpisow publicznych,
- widok administracyjny,
- moderacja, jezeli dojdzie.

Ten modul moze w przyszlosci emitowac zdarzenia realtime do SignalR, np. nowy wpis w ksiedze gosci na ekranie live.

### Media Context

Odpowiada za zdjecia, albumy i metadane mediow.

Zakres:

- albumy,
- upload targety,
- metadane zdjec,
- akceptacja zdjec,
- status przetwarzania,
- powiazania zdjec z albumami,
- integracja z Blob Storage.

To jest pierwszy kandydat do wydzielenia pracy asynchronicznej do `Marryly.Worker`, poniewaz przetwarzanie obrazow nie powinno blokowac requestow HTTP.

#### Jak traktowac media w architekturze

`Media` powinno byc osobnym bounded contextem w modularnym monolicie, ale nie osobnym mikroserwisem na tym etapie.

To oznacza:

- kod mediow ma wlasne modele, use case'y, endpointy i adaptery infrastrukturalne,
- deployment pozostaje wspolny z reszta API,
- przetwarzanie plikow jest wydzielone do `Marryly.Worker`,
- Blob Storage i Cosmos DB sa szczegolami infrastruktury Media Context,
- inne konteksty korzystaja z Media Context przez jawne use case'y, a nie przez bezposrednie grzebanie w kontenerach Cosmos.

W praktyce `Media` sklada sie z kilku podobszarow:

- Albums - zarzadzanie albumami, slugami, widocznoscia i kolejnoscia,
- Media Catalog - metadane zdjec w Cosmos DB,
- Uploads - generowanie upload targetow i finalizacja uploadu,
- Storage - czytanie oryginalow i zapis pochodnych plikow w Blob Storage,
- Processing - generowanie miniaturek, preview i odczyt wymiarow,
- Moderation - przyszla akceptacja/odrzucanie zdjec,
- Gallery Read Model - publiczne i administracyjne odczyty galerii.

To sa podmoduly jednego bounded contextu, a nie osobne bounded contexts.

#### Co zostaje synchroniczne w API

W `Marryly.Api` zostaje wszystko, co jest szybka decyzja albo szybkim zapisem metadanych:

- lista albumow,
- szczegoly albumu,
- tworzenie, edycja, usuwanie i sortowanie albumow,
- lista zdjec publicznych,
- lista zdjec administracyjnych,
- generowanie SAS/upload targetu,
- finalizacja uploadu,
- usuwanie zdjecia,
- zmiana widocznosci/akceptacji zdjecia, jezeli dojdzie,
- endpointy uzywane przez slideshow do pobierania gotowych zdjec.

Finalizacja uploadu nie powinna generowac miniaturek w requestcie HTTP. Powinna:

1. zwalidowac payload,
2. zapisac albo zaktualizowac `MediaItem` ze statusem `processing`,
3. opublikowac komunikat `PhotoUploadedForProcessing`,
4. zwrocic klientowi aktualny stan zasobu.

Przykladowy szkic:

```csharp
public async Task<MediaItem> CompletePhotoUploadAsync(
    EventScope scope,
    string photoId,
    string albumId,
    CompletePhotoUploadRequest request,
    CancellationToken ct)
{
    var mediaItem = MediaItem.CreateProcessing(
        eventId: scope.EventId,
        photoId: photoId,
        albumId: albumId,
        blobName: request.BlobName,
        blobUrl: request.BlobUrl,
        contentType: request.ContentType,
        sizeBytes: request.SizeBytes);

    var savedItem = await mediaRepository.UpsertAsync(scope, mediaItem, ct);

    await mediaProcessingQueue.EnqueueAsync(new PhotoUploadedForProcessing
    {
        MessageId = Guid.NewGuid().ToString("N"),
        TenantId = scope.TenantId,
        EventId = scope.EventId,
        PhotoId = savedItem.Id
    }, ct);

    return savedItem;
}
```

#### Co idzie do workera

`Marryly.Worker` przejmuje wszystko, co jest zwiazane z ciezka praca na plikach:

- pobranie oryginalu z Blob Storage,
- weryfikacja, czy plik faktycznie istnieje,
- generowanie miniaturek,
- generowanie preview,
- odczyt wymiarow,
- zapis pochodnych plikow,
- ustawienie statusu `ready`,
- zapis `processingError` i statusu `failed`,
- retry przetwarzania.

Worker powinien operowac na komunikacie i aktualnym stanie `MediaItem`, nie na danych przeslanych przez klienta jako jedynym zrodle prawdy.

Przykladowy szkic:

```csharp
public async Task HandleAsync(PhotoUploadedForProcessing message, CancellationToken ct)
{
    var scope = new EventScope(message.TenantId, message.EventId);
    var mediaItem = await mediaRepository.GetRequiredAsync(scope, message.PhotoId, ct);

    if (mediaItem.Status == "ready")
    {
        return;
    }

    try
    {
        var derivative = await photoDerivativeService.GenerateAsync(mediaItem, ct);
        mediaItem.MarkReady(derivative);
    }
    catch (Exception ex)
    {
        mediaItem.MarkFailed(ex.Message);
    }

    await mediaRepository.UpsertAsync(scope, mediaItem, ct);
}
```

#### Co moze zostac w Functions

Functions moga byc pomocnicze dla mediow, ale nie powinny byc glownym miejscem logiki Media Context.

Dobre przypadki:

- timer do czyszczenia porzuconych uploadow,
- blob trigger jako dodatkowe zabezpieczenie, jezeli finalizacja uploadu przez API nie zostala wywolana,
- zadanie okresowe do ponowienia zdjec w statusie `failed`,
- zadanie okresowe do czyszczenia pochodnych plikow po usunietych mediach.

Jezeli flow jest czescia normalnej interakcji uzytkownika, powinno przechodzic przez API i worker. Jezeli jest reakcja techniczna na zdarzenie platformy, Functions sa dobrym wyborem.

#### Proponowana organizacja kodu mediow

Docelowo kod mediow warto ukladac tak:

```text
Marryly.Api
  Modules
    Media
      AlbumsEndpoints.cs
      MediaEndpoints.cs
      UploadEndpoints.cs

Marryly.Application
  Media
    Albums
    Catalog
    Uploads
    Processing
    Contracts

Marryly.Domain
  Media
    Album.cs
    MediaItem.cs
    MediaStatus.cs
    MediaSourceType.cs

Marryly.Infrastructure
  Media
    CosmosMediaRepository.cs
    CosmosAlbumRepository.cs
    BlobMediaStorage.cs
    AzureQueueMediaProcessingQueue.cs

Marryly.Worker
  Media
    PhotoProcessingWorker.cs
    PhotoProcessingHandler.cs
```

Na obecnym etapie nie trzeba tworzyc wszystkich tych katalogow naraz. Najpierw warto oddzielic:

- upload orchestration,
- media metadata,
- blob storage,
- photo derivative generation,
- queue publishing.

#### Relacja Media Context ze Slideshow

`Slideshow / Live Experience Context` korzysta z mediow, ale nie powinien przejmowac ich odpowiedzialnosci.

Zasada:

- Media Context wie, jakie zdjecia istnieja, jaki maja status i gdzie sa pochodne pliki,
- Slideshow Context wie, ktore albumy sa wybrane do prezentacji i jak emitowac/odswiezac widok live.

Slideshow moze pytac Media Context o gotowe zdjecia, ale nie powinien sam generowac miniaturek, aktualizowac statusow przetwarzania ani znac szczegolow Blob Storage.

### Slideshow / Live Experience Context

Odpowiada za widoki live i prezentacje zdjec.

Zakres:

- ustawienia slideshow,
- wybor albumow,
- pobieranie nowych zdjec,
- eventy realtime do podlaczonych klientow,
- przyszle funkcje live na sali weselnej.

Ten kontekst korzysta z Media Context, ale powinien miec wlasny model konfiguracji i wlasne endpointy/huby.

### Overview / Admin Dashboard Context

Odpowiada za agregacje danych do panelu admina.

Zakres:

- liczniki,
- statusy modulow,
- szybki przeglad konfiguracji,
- ewentualne read modele.

To jest modul odczytowy. Powinien agregowac dane z innych kontekstow wewnatrz procesu. Jezeli agregacja stanie sie kosztowna, mozna przeniesc czesc danych do read modelu aktualizowanego przez worker.

### Notifications Context

Na razie kontekst przyszlosciowy.

Zakres:

- e-maile,
- SMS,
- powiadomienia administracyjne,
- przypomnienia,
- informacje o nowych uploadach lub wpisach.

Nie trzeba go tworzyc przed pojawieniem sie realnej funkcji, ale warto przewidziec, ze bedzie naturalnie asynchroniczny.

## Co zostaje w API

W `Marryly.Api` powinny zostac wszystkie szybkie, request-response operacje:

- logowanie admina,
- walidacja access code,
- pobieranie konfiguracji wydarzenia,
- pobieranie menu i harmonogramu,
- CRUD listy gosci,
- RSVP i szybkie aktualizacje statusow,
- dodawanie wpisow do ksiegi gosci,
- pobieranie ksiegi gosci,
- CRUD albumow,
- generowanie SAS/upload targetu,
- finalizacja uploadu jako szybkie zapisanie statusu i zakolejkowanie przetwarzania,
- pobieranie galerii,
- pobieranie danych panelu admina,
- endpointy slideshow,
- SignalR hubs.

API powinno koncentrowac sie na:

- walidacji wejscia,
- autoryzacji,
- ustaleniu tenant scope,
- wywolaniu use case'a,
- zapisie szybkiej zmiany stanu,
- zwroceniu odpowiedzi,
- ewentualnym wyslaniu komunikatu do kolejki.

## Co idzie do Azure Functions

Azure Functions zostaja jako uzupelnienie, nie jako glowny backend HTTP.

Dobre przypadki uzycia dla Functions:

- reakcja na zdarzenie Blob Storage,
- timer do czyszczenia starych uploadow,
- timer do porzadkowania tymczasowych danych,
- webhook od zewnetrznego systemu,
- lekki queue trigger dla prostych zadan,
- techniczne zadania administracyjne,
- migracje danych uruchamiane kontrolowanie, jezeli beda jednorazowe i dobrze izolowane.

Unikamy przenoszenia do Functions:

- standardowego CRUD panelu admina,
- publicznych endpointow HTTP,
- zlozonej logiki domenowej,
- logiki, ktora wymaga wielu zaleznosci i jest czescia glownego flow aplikacji.

## Co idzie do workerow

Do `Marryly.Worker` trafia praca, ktora jest za dluga, za zawodna albo za kosztowna dla requestu HTTP.

Pierwsze kandydaty:

- generowanie miniaturek zdjec,
- generowanie preview zdjec,
- odczyt metadanych obrazu,
- ponawianie nieudanego przetwarzania mediow,
- przyszla moderacja zdjec,
- import listy gosci z pliku,
- export listy gosci,
- generowanie paczek zdjec do pobrania,
- aktualizacja ciezszych read modeli admin dashboardu,
- wysylka powiadomien.

Preferowany flow dla uploadu zdjec:

1. API generuje SAS i zwraca klientowi upload target.
2. Klient uploaduje plik bezposrednio do Blob Storage.
3. API finalizuje upload, zapisuje `MediaItem` ze statusem `processing` i publikuje komunikat do kolejki.
4. Worker pobiera komunikat, generuje pochodne pliki i aktualizuje `MediaItem` na `ready` albo `failed`.
5. API i SignalR pokazuja klientom aktualny status.

## Co idzie do SignalR

SignalR jest czescia `Marryly.Api`.

Na tym etapie nie tworzymy osobnego Azure SignalR Service. To upraszcza wdrozenie i wystarcza dla pierwszych funkcji realtime.

Proponowane huby:

- `LiveHub` - funkcje publiczne/live, np. slideshow i nowe zdjecia,
- `AdminHub` - panel administracyjny, np. status uploadu, nowe wpisy, powiadomienia operacyjne.

Alternatywnie mozna zaczac od jednego `MarrylyHub` i rozdzielic go dopiero, gdy kontrakty realtime zaczna sie rozjezdzac.

Zasady:

- kazde polaczenie SignalR musi byc przypisane do tenant/event scope,
- klienci dolaczaja do grup per `eventId`,
- panel admina dolacza do osobnej grupy administracyjnej per `eventId`,
- nie wysylamy danych miedzy tenantami,
- eventy SignalR powinny byc male i traktowane jako informacja o zmianie, a nie jako jedyne zrodlo prawdy,
- klient po otrzymaniu eventu moze odswiezyc konkretny zasob przez API.

Pierwsze dobre przypadki dla SignalR:

- nowe zdjecie gotowe do slideshow,
- zmiana statusu przetwarzania zdjecia,
- nowy wpis w ksiedze gosci,
- odswiezenie widoku live,
- proste powiadomienie w panelu admina.

Ograniczenie na tym etapie:

- jezeli API bedzie skalowane do wielu replik, self-hosted SignalR bedzie wymagac dodatkowej decyzji o sticky sessions albo backplane,
- jezeli realtime stanie sie krytyczna czescia produktu, nalezy ponownie rozwazyc Azure SignalR Service.

## Cosmos DB

Cosmos DB zostaje podstawowa baza danych.

Zasady modelowania:

- partycja logiczna pozostaje oparta o `eventId`,
- zapytania powinny byc mozliwie tenant-local,
- kazdy dokument musi zawierac `eventId`,
- kontenery powinny byc organizowane wokol modeli dostepu, nie wokol czysto technicznych klas,
- operacje cross-tenant powinny byc wyjatkiem i wymagac swiadomej decyzji,
- read modele mozna trzymac jako osobne dokumenty w Cosmos DB, jezeli agregacje zaczna byc kosztowne.

Obecny uklad kontenerow moze zostac rozwijany stopniowo:

- `EventData`,
- `GuestList`,
- `GuestInvitationGroups`,
- `GuestbookEntry`,
- `Albums`,
- `MediaItems`.

Przy nowych modulach najpierw definiujemy:

- glowny query pattern,
- partition key,
- id dokumentu,
- czy dokument jest agregatem zapisu czy read modelem,
- czy potrzebuje TTL,
- czy bedzie aktualizowany synchronicznie, czy przez worker.

## Komunikacja asynchroniczna

Docelowo API, Functions i Worker komunikuja sie przez kolejke albo eventy integracyjne.

Najprostszy domyslny wybor:

- Azure Queue Storage dla prostych zadan,
- Azure Service Bus, jezeli potrzebne beda bardziej rozbudowane mechanizmy: dead-letter, tematy, subskrypcje, silniejsze kontrakty i lepsza kontrola dostarczania.

Na obecnym etapie prawdopodobnie wystarczy zaczac od prostego modelu kolejki dla mediow.

Przykladowe komunikaty:

- `PhotoUploadedForProcessing`,
- `PhotoProcessingFailed`,
- `GuestListImportRequested`,
- `AdminExportRequested`,
- `NotificationRequested`.

Komunikaty powinny zawierac:

- `messageId`,
- `eventId`,
- identyfikator zasobu,
- typ operacji,
- timestamp,
- wersje kontraktu, jezeli komunikat ma byc trwaly.

## Przekrojowe zasady produkcyjne

Te zasady dotycza wszystkich hostow: `Marryly.Api`, `Marryly.Worker` i `Marryly.Functions`.

### Observability

Docelowo kazdy request, komunikat kolejki i zadanie workera powinny byc latwe do przesledzenia.

Minimalny standard:

- structured logging zamiast skladania tekstowych logow,
- `tenantId` i `eventId` w scope logowania,
- `correlationId` dla requestow HTTP i komunikatow async,
- logowanie statusu operacji dlugotrwalych, np. `photoId`, `status`, `attempt`,
- health checks dla API i workera,
- metryki dla liczby uploadow, bledow przetwarzania zdjec, czasu generowania pochodnych i liczby wiadomosci w kolejce.

Przyklad uzycia scope logowania:

```csharp
using var scope = logger.BeginScope(new Dictionary<string, object>
{
    ["TenantId"] = tenant.TenantId,
    ["EventId"] = tenant.EventId,
    ["CorrelationId"] = correlationId
});
```

W Aspire `Marryly.ServiceDefaults` powinno byc miejscem, w ktorym konfigurujemy telemetry, health checks i wspolne logowanie dla procesow .NET.

### Bezpieczenstwo tenantow

Najwazniejsza zasada: backend nie powinien ufac `eventId` przyslanemu przez klienta, jezeli request ma juz token.

Zasady:

- tenant/event scope pochodzi z tokenu, access code albo zaufanego komunikatu async,
- endpointy admina nie powinny przyjmowac `eventId` z body jako zrodla prawdy,
- kazde zapytanie do Cosmos DB powinno uzywac partition key zgodnego z tenant/event scope,
- SignalR groups musza byc budowane z kontekstu po autoryzacji, a nie z dowolnej wartosci od klienta,
- operacje cross-tenant wymagaja osobnego, jawnego mechanizmu administracyjnego,
- logi nie powinny zawierac tokenow, access code ani SAS URL w calosci.

Jezeli w URL zostaje `eventId`, traktujemy go jako element routingu lub walidacji zgodnosci, a nie jako zrodlo autoryzacji.

### Sekrety i dostep do Azure

Docelowo aplikacja powinna ograniczac uzycie connection stringow i kluczy konta storage.

Kierunek:

- sekrety w Azure Key Vault albo konfiguracji Container Apps/Functions,
- Managed Identity dla dostepu do Cosmos DB, Storage i kolejek tam, gdzie to praktyczne,
- generowanie SAS ograniczone czasowo i zakresem uprawnien,
- osobne ustawienia dla srodowisk dev/staging/prod,
- brak sekretow w repo i brak sekretow w logach.

Obecny mechanizm SAS moze zostac, ale przy migracji do `Marryly.Api` warto zaplanowac przejscie z `StorageSharedKeyCredential` na bezpieczniejszy model, jezeli hosting i wymagania Azure na to pozwola.

### Niezawodnosc workerow

Workery powinny zakladac, ze komunikat moze przyjsc wiecej niz raz albo po czesciowo wykonanej poprzedniej probie.

Zasady:

- kazdy komunikat ma stabilny `messageId`,
- operacje sa idempotentne,
- zasob ma jawny status, np. `processing`, `ready`, `failed`,
- bledy sa zapisywane w dokumencie zasobu w formie skroconej i bez sekretow,
- po kilku nieudanych probach komunikat trafia do poison queue albo dead-letter,
- worker loguje liczbe prob i powod porazki,
- API pokazuje status zasobu zamiast czekac synchronicznie na zakonczenie pracy.

Przyklad dla zdjec:

```text
uploaded -> processing -> ready
                    \-> failed
```

Ponowienie przetwarzania powinno byc osobna operacja, ktora zmienia status na `processing` i publikuje nowy komunikat.

### Spojnosc danych w Cosmos DB

Wiekszosc operacji w Marryly jest tenant-local, wiec Cosmos DB nadal pasuje. Warto jednak ustalic kilka zasad, zanim aplikacja urosnie.

Zasady:

- dla aktualizacji edytowalnych przez panel admina warto rozwazyc optimistic concurrency przez ETag,
- operacje typu szybki checkbox w panelu powinny byc odporne na wyscigi zapisow,
- read modele sa dopuszczalne, jezeli dashboard zacznie wykonywac zbyt wiele zapytan,
- dokumenty statusowe dla workerow powinny byc zrodlem prawdy o stanie operacji,
- zapytania z `OFFSET` sa akceptowalne przy malych zbiorach, ale dla wiekszych galerii lepsze sa continuation tokens.

Szczegolnie uwazac trzeba na funkcje administracyjne, ktore edytuja ten sam zasob z kilku miejsc: lista gosci, albumy, status zdjec i ustawienia slideshow.

### Kontrakty API i frontendu

Przy przejsciu na Minimal API warto utrzymac stabilny kontrakt dla frontendu.

Zasady:

- endpointy moga zmieniac hosting bez zmiany publicznej sciezki, jezeli frontend nie musi o tym wiedziec,
- response DTO powinny byc jawne i nie powinny bezposrednio przeciekac wewnetrznych encji, jezeli model domenowy zaczyna sie rozrastac,
- bledy powinny zostac w jednym standardzie, np. problem details z kodem bledu,
- nowe endpointy powinny miec opisany kontrakt request/response,
- przy wiekszej migracji warto dodac OpenAPI dla `Marryly.Api`.

To pozwoli przenosic endpointy z Functions do API etapami bez ciaglego przepisywania klienta React.

Obecny frontend korzysta z jednego `VITE_API_BASE_URL`, wiec hosting backendu mozna zmieniac etapami, jezeli publiczne sciezki pozostana stabilne.

Wazne kontrakty do utrzymania:

- `X-Marryly-Access-Token` jako obecny header sesji,
- format `application/problem+json` dla bledow,
- statusy `401` i `403`, ktore frontend wykorzystuje do czyszczenia sesji albo pokazania braku dostepu,
- brak HTML w odpowiedziach API,
- stabilne sciezki `/app/*`, `/auth/*` i `/panel/*` przynajmniej w okresie migracji.

Docelowe API powinno miec jeden wspolny mechanizm bledow:

```json
{
  "type": "https://httpstatuses.com/400",
  "title": "Invalid payload",
  "status": 400,
  "detail": "Request body is invalid.",
  "code": "INVALID_PAYLOAD",
  "traceId": "..."
}
```

W produkcji problem details nie powinny zwracac `stackTrace` ani surowych komunikatow wyjatkow. Te informacje powinny trafic do logow i telemetry, a klient powinien dostac `code`, `detail` i `traceId`.

### Frontend, cache i realtime

Frontend jest obecnie request-response i uzywa prostego cache w `sessionStorage`. To jest dobre dla obecnego etapu, ale przy SignalR trzeba dopisac zasade integracji realtime z cache.

Zasady:

- eventy SignalR nie powinny byc jedynym zrodlem prawdy,
- event SignalR powinien najczesciej uniewazniac konkretny cache albo triggerowac odswiezenie zasobu,
- nazwy eventow SignalR powinny odpowiadac domenowym zmianom, np. `photo.ready`, `guestbook.entryAdded`, `slideshow.settingsChanged`,
- event powinien zawierac `eventId`, identyfikator zasobu i minimalny payload potrzebny do odswiezenia UI,
- frontend nie powinien aktualizowac zlozonych struktur lokalnie, jezeli taniej i bezpieczniej jest pobrac swiezy zasob z API,
- dla panelu admina eventy powinny uniewazniac cache z prefiksem `admin_`,
- dla publicznych widokow eventy powinny uniewazniac cache z prefiksem `wedding_`.

Przyklad:

```text
photo.ready -> invalidate gallery/photos cache -> fetch latest photos page
guestbook.entryAdded -> invalidate guestbook cache -> fetch first page
slideshow.photoReady -> append albo fetch latest slideshow photos
```

Przy dodaniu SignalR frontend powinien dostac osobny modul, np. `realtimeClient`, zamiast mieszac polaczenie WebSocket z klientami REST.

### Strategia testow

Przy migracji z Azure Functions do Minimal API testy powinny chronic kontrakty i najwazniejsze reguly domenowe, a nie tylko sprawdzac, czy projekt sie buduje.

Minimalny zestaw:

- unit testy dla czystych regul domenowych, np. podsumowanie listy gosci, statusy mediow, walidacja albumow,
- testy use case'ow w `Marryly.Application` z fake repozytoriami,
- testy integracyjne API dla auth, problem details, tenant scope i kluczowych endpointow,
- testy kontraktowe odpowiedzi uzywanych przez frontend,
- testy workerow dla idempotencji i retry,
- smoke test dla staging po deploymentcie.

Pierwsze testy, ktore warto dodac przy migracji:

- token admina pozwala wejsc do `/panel/*`,
- token goscia nie pozwala wejsc do `/panel/*`,
- request bez tokenu zwraca `401` w formacie problem details,
- endpoint panelowy uzywa `eventId` z tokenu, a nie z body,
- finalizacja uploadu ustawia status `processing` i publikuje komunikat,
- worker nie przetwarza ponownie zdjecia w statusie `ready`,
- bledy produkcyjne nie zwracaja `stackTrace`.

Testy frontendowe powinny skupic sie na przeplywach, ktore moga ucierpiec przy zmianie backendu:

- logowanie access code,
- logowanie admina,
- czyszczenie sesji po `401`,
- brak dostepu po `403`,
- upload zdjecia,
- odswiezenie danych po invalidacji cache.

### Srodowiska i deployment

Docelowo warto miec jasny podzial srodowisk.

Minimalny model:

- local - uruchamiane przez Aspire,
- staging - srodowisko do testu migracji i smoke testow,
- production - srodowisko dla realnych par mlodych.

Zasady:

- staging powinien miec osobne zasoby danych albo jasno oznaczone testowe tenanty,
- migracje danych powinny byc odwracalne albo przynajmniej powtarzalne,
- Container Apps revisions moga sluzyc do bezpiecznego rollout/rollback API,
- worker powinien miec osobna konfiguracje skalowania od API,
- Functions powinny miec jasno opisane triggery i harmonogramy.

## Granice modulow w kodzie

Kazdy bounded context powinien miec wlasne:

- endpoint mappings w API,
- request/response DTO, jezeli sa specyficzne dla HTTP,
- use case'y w Application,
- modele domenowe albo aplikacyjne,
- interfejsy repozytoriow,
- implementacje repozytoriow w Infrastructure,
- testy.

Przykladowa organizacja katalogow:

```text
Marryly.Api
  Modules
    Guests
    Guestbook
    Media
    Slideshow
    Events
    Auth

Marryly.Application
  Guests
  Guestbook
  Media
  Slideshow
  Events
  Auth
  Overview

Marryly.Domain
  Guests
  Media
  Events

Marryly.Infrastructure
  Cosmos
  Storage
  Queues
  Guests
  Guestbook
  Media
```

Nie trzeba tworzyc folderu w kazdej warstwie dla kazdego modulu, jezeli modul jest maly. Struktura ma pomagac w czytaniu, nie produkowac pustych katalogow.

## Zasady rozwoju

Nowa funkcjonalnosc powinna domyslnie zaczynac jako modul w modularnym monolicie.

Wydzielenie do osobnego procesu rozwazamy dopiero, gdy pojawi sie co najmniej jeden z powodow:

- dlugi czas wykonania,
- potrzeba niezaleznego skalowania,
- wyraznie inny profil awarii,
- zewnetrzny trigger jako glowny sposob uruchamiania,
- duze zaleznosci techniczne, ktorych nie chcemy w API,
- potrzeba izolacji kosztu albo zasobow.

Wydzielenie do osobnego mikroserwisu rozwazamy dopiero pozniej, gdy modul bedzie mial:

- wlasny model danych,
- wlasne tempo zmian,
- wlasne SLA,
- realny problem skalowania lub organizacyjnej niezaleznosci,
- stabilne kontrakty integracyjne.

## Pierwszy etap migracji

Pierwszy techniczny etap powinien byc spokojny i odwracalny:

1. Dodac `Marryly.Api` jako ASP.NET Core Minimal API.
2. Przeniesc konfiguracje DI z Functions do wspolnego miejsca uzywanego przez API i Functions.
3. Przeniesc kilka prostych endpointow read-only do API.
4. Dodac Aspire `AppHost` i `ServiceDefaults`.
5. Uruchomic API lokalnie razem z Cosmos/Storage przez Aspire.
6. Przeniesc upload finalization tak, aby tylko zapisywal status i kolejkowal przetwarzanie.
7. Dodac `Marryly.Worker` do przetwarzania zdjec.
8. Dopiero pozniej przenosic kolejne endpointy HTTP z Functions do API.

## Decyzje odlozone

Te tematy zostaja swiadomie poza pierwsza wersja docelowej architektury:

- osobny Azure SignalR Service,
- migracja z Cosmos DB do PostgreSQL,
- pelne mikroserwisy per bounded context,
- osobny identity provider,
- osobne bazy per tenant,
- event sourcing,
- CQRS jako domyslny wzorzec dla calej aplikacji.

Kazdy z tych tematow mozna wrocic, ale nie jest potrzebny, zeby uporzadkowac obecny backend.
