#!/usr/bin/env bash
# Run manually in your own sandbox. Never place real API keys in the collection/repository.
set -euo pipefail
: "${FACTOSYS_API_KEY:?Set FACTOSYS_API_KEY}"
: "${FACTOSYS_DOCUMENT_ID:?Set FACTOSYS_DOCUMENT_ID}"
BASE="${FACTOSYS_URL:-http://localhost:3000}"
curl --fail-with-body "$BASE/v1/capabilities"
curl --fail-with-body -H "Authorization: Bearer $FACTOSYS_API_KEY" "$BASE/v1/documents/$FACTOSYS_DOCUMENT_ID"
# To emit, replace company_id in the case JSON, persist a unique key and reuse it on timeout:
# curl --fail-with-body -X POST "$BASE/v1/invoices" -H "Authorization: Bearer $FACTOSYS_API_KEY" \
#   -H 'Content-Type: application/json' -H "Idempotency-Key: $PERSISTED_KEY" --data-binary @cases/01-01-credito-cuotas.json
# After acceptance, deliver using a separate persistent event key:
# curl --fail-with-body -X POST "$BASE/v1/documents/$FACTOSYS_DOCUMENT_ID/deliveries" \
#   -H "Authorization: Bearer $FACTOSYS_API_KEY" -H 'Content-Type: application/json' \
#   -H "Idempotency-Key: $DELIVERY_EVENT_KEY" --data '{"recipients":["destinatario@example.invalid"]}'
# Recover without resending:
# curl --fail-with-body -X POST "$BASE/v1/documents/$FACTOSYS_DOCUMENT_ID/recover-cdr" -H "Authorization: Bearer $FACTOSYS_API_KEY"
# Certificate rotation: PUT /v1/companies/$COMPANY_ID/certificate with -F 'file=@certificate.pfx' -F "password=$PFX_PASSWORD".
