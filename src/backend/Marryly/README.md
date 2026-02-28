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
    "COSMOS_DATABASE_NAME": "MarrylyDB"
  }
}
```

## Struktura danych Cosmos DB

### Container: EventData
Partition Key: `/eventId`

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
