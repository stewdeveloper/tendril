#!/usr/bin/env bash
# Local cron plumbing: stores the Vault secrets private.call_worker reads, and the worker key the worker function
# compares against (supabase/functions/.env, git-ignored). Run after every `db:reset`, which wipes Vault.
# The worker key is a dedicated random secret, never the service key; an existing one is reused.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=supabase/functions/.env
[ -f "$ENV_FILE" ] || cp supabase/functions/.env.example "$ENV_FILE"

KEY=$(grep '^WORKER_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//" || true)
if [ -z "$KEY" ]; then
  KEY=$(openssl rand -hex 32)
  if grep -q '^WORKER_KEY=' "$ENV_FILE"; then
    sed -i "s|^WORKER_KEY=.*|WORKER_KEY=$KEY|" "$ENV_FILE"
  else
    [ -z "$(tail -c1 "$ENV_FILE")" ] || echo >> "$ENV_FILE"
    echo "WORKER_KEY=$KEY" >> "$ENV_FILE"
  fi
  echo "Generated a new WORKER_KEY: restart \`supabase functions serve\` to pick up WORKER_KEY."
fi

STATUS=$(pnpm exec supabase status -o env < /dev/null)
DB_URL=$(grep '^DB_URL=' <<<"$STATUS" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')

# The secrets travel in the environment and are read inside the session, never on a command line.
TENDRIL_URL="http://api.supabase.internal:8000" TENDRIL_KEY="$KEY" psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
\getenv t_url TENDRIL_URL
\getenv t_key TENDRIL_KEY
select set_config('tendril.url', :'t_url', false), set_config('tendril.key', :'t_key', false) \gset
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
