#!/usr/bin/env bash
# Deploy the OCR proxy to Cloud Run.
# Requires: gcloud CLI authenticated, ANTHROPIC_API_KEY env var set locally.

set -euo pipefail

PROJECT="${PROJECT:-printful-manager}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-grandma-recipes-ocr}"
ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-*}"

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ERROR: set ANTHROPIC_API_KEY in your shell before running."
  echo "  export ANTHROPIC_API_KEY=sk-ant-..."
  exit 1
fi

cd "$(dirname "$0")"

gcloud run deploy "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --source . \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 120 \
  --concurrency 10 \
  --max-instances 5 \
  --set-env-vars "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY},ALLOWED_ORIGIN=${ALLOWED_ORIGIN}"

echo
echo "Done. Copy the Service URL above and paste it into ../config.js as window.GRANDMA_OCR_ENDPOINT + '/ocr'."
