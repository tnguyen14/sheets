# Sheets

REST API to return Google Sheets data.

GCP project: `build-tridnguyen-com`. Running as Cloud Run.

## Auth

Identity the **service** uses to call Google APIs (Sheets/Drive):

- In prod (Cloud Run): `1058747850311-compute@developer.gserviceaccount.com`.
- For local dev: `sheets-muffin@build-tridnguyen-com.iam.gserviceaccount.com`.

Separately, API **clients** authenticate with an Auth0 access token (audience
`https://sheets.cloud.tridnguyen.com`). The email associated with the token is then used to check for permissions for access to the underlying Google resource.

## Local development

```sh
docker compose up
```
