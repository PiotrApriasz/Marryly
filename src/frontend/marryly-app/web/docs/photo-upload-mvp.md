# Photo Upload MVP

Frontend uploads guest photos directly to Azure Blob Storage. The browser never receives `STORAGE_ACCOUNT_KEY`.

## Flow

1. Frontend sends `POST /events/{eventId}/photos/uploads`.
2. API validates the file metadata and creates a short-lived SAS URL for a single blob.
3. Frontend uploads the file with `PUT` directly to Blob Storage.
4. Frontend sends `POST /events/{eventId}/photos/uploads/{photoId}/complete`.
5. API upserts a `mediaItem` document in Cosmos DB and synchronously generates `thumbnail` and `preview`.
6. Frontend galleries use the generated versions instead of the original blob.

## Request

`POST /events/{eventId}/photos/uploads`

```json
{
  "fileName": "IMG_1024.HEIC",
  "fileSizeBytes": 4281193,
  "contentType": "image/heic",
  "lastModifiedAt": "2026-03-17T12:34:56.000Z"
}
```

## Response

```json
{
  "photoId": "d4b514e6-7b67-4e46-8e40-0464d8053437",
  "blobName": "events/31072026-piotralicja-rytro/photos/2026/03/17/d4b514e6-7b67-4e46-8e40-0464d8053437.heic",
  "blobUrl": "https://<account>.blob.core.windows.net/media-originals/events/31072026-piotralicja-rytro/photos/2026/03/17/d4b514e6-7b67-4e46-8e40-0464d8053437.heic",
  "uploadUrl": "https://<account>.blob.core.windows.net/media-originals/events/31072026-piotralicja-rytro/photos/2026/03/17/d4b514e6-7b67-4e46-8e40-0464d8053437.heic?<sas>",
  "expiresAt": "2026-03-17T13:05:00.000Z",
  "requiredHeaders": {
    "x-ms-blob-type": "BlockBlob",
    "Content-Type": "image/heic"
  }
}
```

## Complete upload request

`POST /events/{eventId}/photos/uploads/{photoId}/complete`

```json
{
  "blobName": "events/31072026-piotralicja-rytro/photos/2026/03/17/d4b514e6-7b67-4e46-8e40-0464d8053437.heic",
  "blobUrl": "https://<account>.blob.core.windows.net/media-originals/events/31072026-piotralicja-rytro/photos/2026/03/17/d4b514e6-7b67-4e46-8e40-0464d8053437.heic",
  "contentType": "image/heic",
  "sizeBytes": 4281193
}
```

## API rules

- Accept only photo MIME types and extensions used by the frontend.
- Reject files larger than the frontend limit.
- Generate SAS for a single blob path with short expiration, preferably 10-15 minutes.
- Grant write permissions only for the new blob.
- Store `STORAGE_ACCOUNT_NAME` and `STORAGE_ACCOUNT_KEY` in Azure Function app settings, not in Static Web App frontend settings.
- Use `BLOB_CONTAINER_FULL` to point at the container that stores original guest uploads.
- Use `BLOB_CONTAINER_DERIVED` or `BLOB_CONTAINER_THUMB` to point at the container that stores thumbnails and previews.
- Create a Cosmos container named `MediaItems` with partition key `/eventId`.

## Storage layout

- Container: value of `BLOB_CONTAINER_FULL` such as `media-originals`
- Blob path: `events/{eventId}/photos/{yyyy}/{MM}/{dd}/{photoId}{ext}`
- Derived container: value of `BLOB_CONTAINER_DERIVED` or `BLOB_CONTAINER_THUMB` such as `media-derived`
- Derived paths:
  - `events/{eventId}/photos/thumbnails/{yyyy}/{MM}/{dd}/{photoId}.jpg`
  - `events/{eventId}/photos/previews/{yyyy}/{MM}/{dd}/{photoId}.jpg`

This keeps uploads partitioned per event and avoids filename collisions.
