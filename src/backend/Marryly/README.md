# Marryly Backend - Azure Functions

## Konfiguracja

### Wymagane zmienne środowiskowe

W pliku `local.settings.json` (lub w konfiguracji Azure Functions) ustaw:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
    "COSMOS_CONNECTION_STRING": "your-cosmos-db-connection-string",
    "COSMOS_DATABASE_NAME": "MarrylyDB",
    "ADMIN_AUTH_EMAIL": "admin@example.com",
    "ADMIN_AUTH_PASSWORD_HASH": "<ASP.NET Identity hash>",
    "ADMIN_AUTH_SECRET": "<min-32-bytes-jwt-secret>",
    "ADMIN_AUTH_SESSION_HOURS": "12",
    "ADMIN_AUTH_JWT_ISSUER": "marryly-backend",
    "ADMIN_AUTH_JWT_AUDIENCE": "marryly-admin"
  }
}
```

`ADMIN_AUTH_PASSWORD_HASH` should be generated once and stored as a secret (Azure Key Vault / Function App settings), not committed to git.

Admin panel requests use JWT sent in `X-Marryly-Admin-Token`.

### Generator hasha hasła admina

W repo jest narzędzie CLI do generowania `ADMIN_AUTH_PASSWORD_HASH`:

```bash
dotnet run --project Marryly.Tools.PasswordHash -- "twoje-silne-haslo"
```

albo bez argumentu (interaktywnie, bez wyświetlania wpisywanych znaków):

```bash
dotnet run --project Marryly.Tools.PasswordHash
```

## Struktura danych Cosmos DB

### Container: EventData
Partition Key: `/eventId`

### Container: GuestList
Partition Key: `/eventId`

Stores invited people for the admin guest list, including RSVP status, guest category, and accommodation details.

### Container: GuestInvitationGroups
Partition Key: `/eventId`

Stores invitation groups/families, for example "Anna i Jan Kowalscy wraz z dziećmi".

### Menu weselne
```json
{
    "id": "{eventId}:menu",
    "eventId": "{eventId}",
    "type": "menu",
    "title": "Główne menu weselne",
    "sections": [
        {
            "name": "Przystawki",
            "items": [
                {
                    "name": "mięsko"
                }
            ]
        }
    ]
}
```

### Wydarzenie
```json
{
    "id": "{eventId}:event:{nazwa}",
    "eventId": "{eventId}",
    "type": "event",
    "title": "Ślub",
    "startsAt": "2026-07-31T14:00:00Z",
    "endsAt": "2026-07-31T15:00:00Z",
    "location": "Parafia Miłosierdzia Bożego w Starym Sączu"
}
```

## Endpointy API

### Pobierz menu
```
GET /api/events/{eventId}/menu
```

### Pobierz wydarzenia
```
GET /api/events/{eventId}/schedule
```

### Panel: lista gości
```
GET    /api/panel/guests
POST   /api/panel/guests
PATCH  /api/panel/guests/{guestId}
DELETE /api/panel/guests/{guestId}
POST   /api/panel/guest-groups
POST   /api/panel/guest-families
```

## Budowanie i uruchamianie

```bash
# Przywróć pakiety
dotnet restore

# Zbuduj projekt
dotnet build

# Uruchom lokalnie
cd Marryly.Functions
func start
```
