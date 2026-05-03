#!/usr/bin/env bash
# Deploy the Maddy's Memories API to Cloud Run.
# Reads required secrets from your shell env. See README for what to set first.

set -euo pipefail

PROJECT="${PROJECT:-printful-manager}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-maddysmemories-api}"
BUCKET="${GCS_BUCKET:-maddysmemories-photos}"
ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-https://maddysmemories.com}"
OCR_MODEL="${OCR_MODEL:-claude-opus-4-7}"

require() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "ERROR: $name is not set in your shell." >&2
    return 1
  fi
}

require ANTHROPIC_API_KEY || exit 1
require ADMIN_PASSWORD || exit 1
require FAMILY_PASSWORD || exit 1
require AUTH_SECRET || exit 1

cd "$(dirname "$0")"

# Make sure the bucket exists (idempotent)
if ! gcloud storage buckets describe "gs://${BUCKET}" --project "$PROJECT" >/dev/null 2>&1; then
  echo "Creating GCS bucket gs://${BUCKET} in $PROJECT…"
  gcloud storage buckets create "gs://${BUCKET}" \
    --project "$PROJECT" \
    --location "$REGION" \
    --uniform-bucket-level-access
  # Allow public read of objects (only the photos we put there)
  gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
    --member=allUsers --role=roles/storage.objectViewer --project "$PROJECT"
fi

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
  --set-env-vars "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY},ADMIN_PASSWORD=${ADMIN_PASSWORD},FAMILY_PASSWORD=${FAMILY_PASSWORD},AUTH_SECRET=${AUTH_SECRET},GCS_BUCKET=${BUCKET},ALLOWED_ORIGIN=${ALLOWED_ORIGIN},OCR_MODEL=${OCR_MODEL}"

URL=$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)')
echo
echo "========================================"
echo "Service URL: $URL"
echo "Set this as the GitHub Actions repo variable VITE_API_URL:"
echo "  gh variable set VITE_API_URL --body '$URL' --repo zelidav/maddysmemories"
echo "Then push any commit and the site will rebuild against the live API."
echo "========================================"
