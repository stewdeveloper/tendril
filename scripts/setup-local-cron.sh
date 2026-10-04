#!/usr/bin/env bash
# Local cron plumbing: stores the Vault secrets private.call_worker reads, and the worker key the worker function
# compares against (supabase/functions/.env, git-ignored). Run after every `db:reset`, which wipes Vault.
# The worker key is a dedicated random secret, never the service key; an existing one is reused.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=supabase/functions/.env
touch "$ENV_FILE"

KEY=$(grep '^WORKER_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)
if [ -z "$KEY" ]; then
  KEY=$(openssl rand -hex 32)
  if grep -q '^WORKER_KEY=' "$ENV_FILE"; then
    sed -i "s|^WORKER_KEY=.*|WORKER_KEY=$KEY|" "$ENV_FILE"
  else
    [ -z "$(tail -c1 "$ENV_FILE")" ] || echo >> "$ENV_FILE"
    echo "WORKER_KEY=$KEY" >> "$ENV_FILE"
  fi
fi

STATUS=$(pnpm exec supabase status -o env < /dev/null)
DB_URL=$(grep '^DB_URL=' <<<"$STATUS" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')

psql "$DB_URL" -v ON_ERROR_STOP=1 -v key="$KEY" -v url="http://api.supabase.internal:8000" <<'SQL'
select set_config('tendril.url', :'url', false), set_config('tendril.key', :'key', false) \gset
do $$
declare
  v_id uuid;
  v_pair text[];
begin
  foreach v_pair slice 1 in array array[array['project_url', current_setting('tendril.url')], array['worker_key', current_setting('tendril.key')]] loop
    select id into v_id from vault.secrets where name = v_pair[1];
    if v_id is null then
      perform vault.create_secret(v_pair[2], v_pair[1]);
    else
      perform vault.update_secret(v_id, v_pair[2]);
    end if;
  end loop;
end $$;
SQL
echo "Worker secrets stored in Vault; WORKER_KEY is in $ENV_FILE."
