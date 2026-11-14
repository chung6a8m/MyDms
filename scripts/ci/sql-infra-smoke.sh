#!/usr/bin/env bash
set -euo pipefail

# Infrastructure-only test. Never use this as a credentialed or business-ledger runner.
if [[ "${MYDMS_SQL_TEST_DISPOSABLE:-}" != "YES" || "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "SQL INFRA BLOCKED: disposable GitHub-hosted test environment only" >&2
  exit 12
fi
if [[ "${RUNNER_ENVIRONMENT:-}" != "github-hosted" ]]; then
  echo "SQL INFRA BLOCKED: self-hosted or unknown runner environment" >&2
  exit 15
fi
if [[ -n "${SQL_CONNECTION_STRING:-}" || -n "${MYDMS_PRODUCTION_CONNECTION:-}" ||
      -n "${MYDMS_SQL_CONNECTION_STRING:-}" || -n "${DATABASE_URL:-}" ]]; then
  echo "SQL INFRA BLOCKED: external database connection not allowed" >&2
  exit 13
fi

name="mydms-s6-0-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
network_name="${name}-internal"
pass="T!$(openssl rand -hex 16)aA9"
# Digest observed in source-bound GitHub Actions #43560500604; update only by reviewed PR.
pinned_digest="sha256:4525e3efac9f3e241cb003bb2ff2a82818b502f37e12049d788b1a9fa7e13b7f"
image_ref="mcr.microsoft.com/mssql/server@${pinned_digest}"
source_sha="${MYDMS_SOURCE_HEAD_SHA:-${GITHUB_SHA:-UNKNOWN}}"
checkout_sha="${GITHUB_SHA:-UNKNOWN}"
run_id="${GITHUB_RUN_ID:-UNKNOWN}"
if [[ ! "$source_sha" =~ ^[a-f0-9]{40}$ || ! "$checkout_sha" =~ ^[a-f0-9]{40}$ ]]; then
  echo "SQL INFRA BLOCKED: exact source/checkout SHA required" >&2
  exit 20
fi

mkdir -p artifacts/ci
ready=false
egress_denied=false
network_verified=false
image_id=""
cleanup() {
  local rc=$?
  local cleanup_failed=false
  trap - EXIT
  # A failed run must not leave a successful evidence file.
  rm -f artifacts/ci/sql-infra-smoke.json
  if docker inspect "$name" >/dev/null 2>&1; then
    if ! timeout 25s docker rm -f "$name" >/dev/null 2>&1; then cleanup_failed=true; fi
  fi
  if docker network inspect "$network_name" >/dev/null 2>&1; then
    if ! timeout 25s docker network rm "$network_name" >/dev/null 2>&1; then cleanup_failed=true; fi
  fi
  if docker inspect "$name" >/dev/null 2>&1 ||
     docker network inspect "$network_name" >/dev/null 2>&1; then
    cleanup_failed=true
  fi
  if [[ "$cleanup_failed" == true ]]; then
    echo "SQL INFRA BLOCKED: ephemeral container/network cleanup unverified" >&2
    rc=19
  fi
  if [[ "$rc" -eq 0 && "$ready" == true && "$egress_denied" == true &&
        "$network_verified" == true && "$cleanup_failed" == false ]]; then
    printf '{"result":"INFRA_SQL_READY_ONLY","classification":"PUBLIC_SYNTHETIC_METADATA_ONLY","imageId":"%s","imagePinnedDigest":"%s","sourceHeadSha":"%s","testedCheckoutSha":"%s","ciRunId":"%s","networkIsolation":"DOCKER_INTERNAL_BRIDGE_NEGATIVE_PROBE","negativeEgressProbe":"DENIED_TEST_NET_198_51_100_1_PORT_443","hostPublishedPorts":0,"containerAndNetworkCleanupVerified":true,"realBusinessTests":0,"productVerified":false}\n' \
      "$image_id" "$pinned_digest" "$source_sha" "$checkout_sha" "$run_id" \
      > artifacts/ci/sql-infra-smoke.json
    echo "SQL Server 2022 pinned-digest infra READY; negative TEST-NET egress probe DENIED; container/network cleanup VERIFIED; NO ledger or business tests"
  fi
  exit "$rc"
}
trap cleanup EXIT

docker network create --driver bridge --internal "$network_name" >/dev/null
docker run --rm --detach --name "$name" --env ACCEPT_EULA=Y \
  --env "MSSQL_SA_PASSWORD=$pass" --env MSSQL_PID=Developer \
  --network "$network_name" "$image_ref" >/dev/null

for attempt in $(seq 1 80); do
  for tool in /opt/mssql-tools18/bin/sqlcmd /opt/mssql-tools/bin/sqlcmd; do
    if docker exec "$name" test -x "$tool" >/dev/null 2>&1; then
      if timeout 8s docker exec "$name" "$tool" -S localhost -U sa -P "$pass" -C -b -l 3 \
        -Q "SET NOCOUNT ON; SELECT 'INFRA_SQL_READY_ONLY';" >/dev/null 2>&1; then
        ready=true
        break
      fi
    fi
  done
  if [[ "$ready" == true ]]; then break; fi
  sleep 3
done
if [[ "$ready" != true ]]; then
  echo "SQL readiness failed, no production fallback" >&2
  exit 14
fi

network_mode=$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$name")
network_internal=$(docker network inspect --format '{{.Internal}}' "$network_name")
port_bindings=$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$name")
if [[ "$network_mode" != "$network_name" || "$network_internal" != "true" ||
      ( "$port_bindings" != "{}" && "$port_bindings" != "null" ) ]]; then
  echo "SQL INFRA BLOCKED: internal Docker network/port binding verification failed" >&2
  exit 16
fi
# Verify the probe interpreter exists; otherwise a missing shell could look like "denied egress".
if ! docker exec "$name" /bin/bash -c 'true' >/dev/null 2>&1; then
  echo "SQL INFRA BLOCKED: negative egress probe unavailable" >&2
  exit 17
fi
# 198.51.100.1 belongs to reserved TEST-NET-2, not a provider endpoint.
# This is a bounded negative observation, NOT a general network penetration test.
if timeout 6s docker exec "$name" /bin/bash -c \
  'exec 3<>/dev/tcp/198.51.100.1/443' >/dev/null 2>&1; then
  echo "SQL INFRA BLOCKED: unexpected outbound TCP connection" >&2
  exit 18
fi
egress_denied=true
network_verified=true
image_id=$(docker inspect --format '{{.Image}}' "$name")
# A successful evidence record is only written by the EXIT trap after cleanup verification.
