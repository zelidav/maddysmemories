#!/usr/bin/env bash
# Deploy the Maddy's Memories API to Cloud Run.
# Secrets live in Google Secret Manager; this script only references them.
# To rotate a value: `gcloud secrets versions add MM_<NAME> --project printful-manager --data-file=-`

set -euo pipefail

PROJECT="${PROJECT:-printful-manager}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-maddysmemories-api}"
BUCKET="${GCS_BUCKET:-maddysmemories-photos}"
ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-https://maddysmemories.com}"
OCR_MODEL="${OCR_MODEL:-claude-opus-4-7}"

cd "$(dirname "$0")"

# Make sure the bucket exists (idempotent)
if ! gcloud storage buckets describe "gs://${BUCKET}" --project "$PROJECT" >/dev/null 2>&1; then
  echo "Creating GCS bucket gs://${BUCKET} in $PROJECT…"
  gcloud storage buckets create "gs://${BUCKET}" \
    --project "$PROJECT" \
    --location "$REGION" \
    --uniform-bucket-level-access
  gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
    --member=allUsers --role=roles/storage.objectViewer --project "$PROJECT"
fi

# Grant the Cloud Run runtime service account access to the secrets (idempotent).
PROJ_NUM=$(gcloud projects describe "$PROJECT" --format="value(projectNumber)")
RUNTIME_SA="${PROJ_NUM}-compute@developer.gserviceaccount.com"
for secret in MM_ANTHROPIC_API_KEY MM_ADMIN_PASSWORD MM_FAMILY_PASSWORD MM_AUTH_SECRET; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --project "$PROJECT" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None >/dev/null 2>&1 || true
done

gcloud run deploy "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --source . \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 120 \
  --concurrency 20 \
  --max-instances 5 \
  --set-env-vars "GCS_BUCKET=${BUCKET},ALLOWED_ORIGIN=${ALLOWED_ORIGIN},OCR_MODEL=${OCR_MODEL}" \
  --set-secrets "ANTHROPIC_API_KEY=MM_ANTHROPIC_API_KEY:latest,ADMIN_PASSWORD=MM_ADMIN_PASSWORD:latest,FAMILY_PASSWORD=MM_FAMILY_PASSWORD:latest,AUTH_SECRET=MM_AUTH_SECRET:latest"

URL=$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)')
echo
echo "========================================"
echo "Service URL: $URL"
echo "========================================"
