#!/usr/bin/env bash
set -euo pipefail

if [[ "${MYDMS_SQL_TEST_DISPOSABLE:-}" != "YES" || "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "SQL INFRA BLOCKED: disposable GitHub-hosted test environment only" >&2
  exit 12
fi
if [[ -n "${SQL_CONNECTION_STRING:-}" || -n "${MYDMS_PRODUCTION_CONNECTION:-}" ]]; then
  echo "SQL INFRA BLOCKED: external database connection not allowed" >&2
  exit 13
fi

name="mydms-s6-0-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
pass="T!$(openssl rand -hex 16)aA9"
tag="mcr.microsoft.com/mssql/server:2022-latest"
mkdir -p artifacts/ci
cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker run --rm --detach --name "$name" --env ACCEPT_EULA=Y \
  --env "MSSQL_SA_PASSWORD=$pass" --env MSSQL_PID=Developer \
  --publish 127.0.0.1:14333:1433 "$tag" >/dev/null

ready=false
for attempt in $(seq 1 80); do
  for tool in /opt/mssql-tools18/bin/sqlcmd /opt/mssql-tools/bin/sqlcmd; do
    if docker exec "$name" test -x "$tool" >/dev/null 2>&1; then
      if docker exec "$name" "$tool" -S localhost -U sa -P "$pass" -C -b \
        -Q "SET NOCOUNT ON; SELECT 'INFRA_SQL_READY_ONLY';" >/dev/null 2>&1; then
        ready=true
        break
      fi
    fi
  done
  if [[ "$ready" == "true" ]]; then break; fi
  sleep 3
done
if [[ "$ready" != "true" ]]; then
  echo "SQL readiness failed, no production fallback" >&2
  exit 14
fi
image_id=$(docker inspect --format '{{.Image}}' "$name")
source_sha="${GITHUB_SHA:-UNKNOWN}"
run_id="${GITHUB_RUN_ID:-UNKNOWN}"
printf '{"result":"INFRA_SQL_READY_ONLY","imageId":"%s","sourceSha":"%s","ciRunId":"%s","realBusinessTests":0,"productVerified":false}\n' \
  "$image_id" "$source_sha" "$run_id" > artifacts/ci/sql-infra-smoke.json
echo "SQL Server 2022 disposable container ready; business/schema/ledger tests NOT RUN"
