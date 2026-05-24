# Sheets

REST API to return Google Sheets data.

GCP project: `build-tridnguyen-com`. Running as Cloud Run.

## Auth

In prod (Cloud Run), identity is `1058747850311-compute@developer.gserviceaccount.com`.

For local dev, identity is `sheets-muffin@build-tridnguyen-com.iam.gserviceaccount.com`.

## Local development

```sh
docker compose up
```
