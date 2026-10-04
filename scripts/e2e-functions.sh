#!/usr/bin/env bash
# End-to-end flow: real Edge Functions under `supabase functions serve` against the local stack.
# Starts the stack if needed, serves the functions with the fake providers, runs the e2e tests, always stops.
# The tests delete every row they create, so `pnpm db:test` still passes afterwards; the weather-cache rows (private,
# out of the API's reach) are deleted here from the cells the tests record.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=supabase/functions/.env
[ -f "$ENV_FILE" ] || cp supabase/functions/.env.example "$ENV_FILE"

if ! STATUS=$(pnpm exec supabase status -o env < /dev/null 2>/dev/null) || ! grep -q '^API_URL=' <<<"$STATUS"; then
  echo "Starting the local stack..."
  pnpm db:start < /dev/null
  STATUS=$(pnpm exec supabase status -o env < /dev/null)
fi
val() { grep "^$1=" <<<"$STATUS" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
export SUPABASE_URL="$(val API_URL)"
export SUPABASE_PUBLISHABLE_KEY="$(val PUBLISHABLE_KEY)"
export SUPABASE_SECRET_KEY="$(val SECRET_KEY)"
DB_URL="$(val DB_URL)"

# The worker tests call the worker with the same key pg_cron uses; make one (and store it in Vault) if missing.
worker_key() { grep '^WORKER_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//" || true; }
if [ -z "$(worker_key)" ]; then bash scripts/setup-local-cron.sh; fi
export WORKER_KEY="$(worker_key)"

LOG="$(mktemp -t tendril-functions-serve.XXXXXX)"
CELLS_FILE="$(mktemp -t tendril-e2e-cells.XXXXXX)"
export E2E_WEATHER_CELLS_FILE="$CELLS_FILE"
SERVE_PID=""
cleanup() {
  if [ -n "$SERVE_PID" ]; then
    kill "$SERVE_PID" 2>/dev/null || true
    wait "$SERVE_PID" 2>/dev/null || true
  fi
  # The CLI runs the edge runtime in a container; make sure it is gone.
  docker rm -f supabase_edge_runtime_tendril >/dev/null 2>&1 || true
  CELLS=$(grep -E '^[0-9]{1,20}$' "$CELLS_FILE" 2>/dev/null | sort -u | paste -sd, - || true)
  if [ -n "$CELLS" ]; then
    psql "$DB_URL" -v ON_ERROR_STOP=1 -q -v cells="$CELLS" <<'SQL' || echo "Could not delete the e2e weather-cache rows."
delete from private.weather_cache where cell_r7 = any (string_to_array(:'cells', ',')::bigint[]);
SQL
  fi
  rm -f "$LOG" "$CELLS_FILE"
}
trap cleanup EXIT INT TERM

pnpm exec supabase functions serve --env-file "$ENV_FILE" < /dev/null > "$LOG" 2>&1 &
SERVE_PID=$!

echo "Waiting for the functions to be served..."
READY=""
for _ in $(seq 1 90); do
  if curl -fs "$SUPABASE_URL/functions/v1/health" >/dev/null 2>&1; then READY=1; break; fi
  if ! kill -0 "$SERVE_PID" 2>/dev/null; then echo "functions serve exited:"; cat "$LOG"; exit 1; fi
  sleep 1
done
if [ -z "$READY" ]; then echo "Timed out waiting for functions serve:"; cat "$LOG"; exit 1; fi

if ! deno test --config supabase/functions/deno.json --allow-env --allow-net --allow-read \
  --allow-write="$CELLS_FILE" supabase/functions/e2e/; then
  echo "--- functions serve log ---"
  tail -n 80 "$LOG"
  exit 1
fi
