#!/usr/bin/env bash
# Docker smoke test for container health and fail-fast behaviour (issue #74).
# Run from the repo root:  tests/docker/health-smoke.sh   (SKIP_BUILD=1 reuses the image)
# Creates only resources named paper-health-smoke* / image paper:health-74.
# No host ports are published.
set -euo pipefail

cd "$(dirname "$0")/../.."
IMAGE=paper:health-74
PROJECT="paper-health-smoke-$RANDOM"
FATAL_NAME="paper-health-smoke-fatal-$RANDOM"
TMP="$(mktemp -d)"
SECRET_VALUE="$(python3 -c 'import secrets;print(secrets.token_hex(32))')"
FAILED=0
RESULTS=()

printf 'SECRET=%s\n' "$SECRET_VALUE" > "$TMP/env"
cat > "$TMP/override.yml" <<YML
services:
  app:
    image: $IMAGE
    pull_policy: never
    ports: !reset []
YML

dc() { docker compose -p "$PROJECT" --env-file "$TMP/env" -f docker-compose.yml -f "$TMP/override.yml" "$@"; }

cleanup() {
    dc down -v --remove-orphans >/dev/null 2>&1 || true
    docker rm -f "$FATAL_NAME" >/dev/null 2>&1 || true
    rm -rf "$TMP"
}
trap cleanup EXIT

record() { # name status detail
    RESULTS+=("$2  $1  $3")
    [ "$2" = PASS ] || FAILED=1
    echo "[$2] $1 $3"
}

app_cid() { dc ps -a -q app; }
health() { docker inspect -f '{{.State.Health.Status}}' "$(app_cid)" 2>/dev/null || echo none; }
running() { docker inspect -f '{{.State.Running}}' "$(app_cid)" 2>/dev/null || echo false; }
wait_for() { # timeout cmd...
    local deadline=$((SECONDS + $1)); shift
    while [ $SECONDS -lt $deadline ]; do
        if "$@"; then return 0; fi
        sleep 2
    done
    return 1
}
is_healthy() { [ "$(health)" = healthy ]; }
is_unhealthy() { [ "$(health)" = unhealthy ]; }
http_code() { dc exec -T app curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://127.0.0.1:8080/healthz" 2>/dev/null || true; }
code_is_503() { [ "$(http_code)" = 503 ]; }
node_pids() { # pids of the Next.js server (it renames itself to next-server)
    dc exec -T app sh -c 'for d in /proc/[0-9]*; do
        c=$(tr "\0" " " < $d/cmdline 2>/dev/null) || continue
        case "$c" in "next-server"*) echo "${d#/proc/}";; esac
    done' 2>/dev/null | tr -d '\r' | sort | tr '\n' ' '
}

if [ "${SKIP_BUILD:-0}" != 1 ]; then
    echo "Building $IMAGE ..."
    docker build -t "$IMAGE" .
fi

# ---- Scenario 1: healthy -------------------------------------------------
dc up -d --wait --wait-timeout 180 >/dev/null
body="$(dc exec -T app curl -s http://127.0.0.1:8080/healthz || true)"
if [ "$(health)" = healthy ] && [ "$body" = '{"status":"ok"}' ]; then
    record "1  healthy" PASS "(health=healthy body=$body)"
else
    record "1  healthy" FAIL "(health=$(health) body=$body)"
fi

# ---- Scenario 1b: brief crash is restarted in place ----------------------
t0=$SECONDS
before="$(node_pids)"
pid="${before%% *}"
if [ -z "$pid" ]; then
    record "1b crash restart" FAIL "(no server.js pid found)"
else
    dc exec -T app sh -c "kill $pid"
    ok=0
    newpid_seen() { local n; n="$(node_pids)"; [ -n "$n" ] && [ "$n" != "$before" ]; }
    if wait_for 60 newpid_seen && wait_for 60 is_healthy && [ "$(running)" = true ]; then ok=1; fi
    if [ "$ok" = 1 ]; then
        record "1b crash restart" PASS "(pid $pid -> $(node_pids), healthy again, $((SECONDS - t0))s)"
    else
        record "1b crash restart" FAIL "(before=$before after=$(node_pids) health=$(health) running=$(running))"
    fi
fi

# ---- Scenario 2: DB down -------------------------------------------------
t0=$SECONDS
dc stop db >/dev/null 2>&1
ok=1; detail=""
wait_for 30 code_is_503 || { ok=0; detail="no 503 (last=$(http_code)) "; }
t503=$((SECONDS - t0))
wait_for 120 is_unhealthy || { ok=0; detail+="never unhealthy (health=$(health)) "; }
tunh=$((SECONDS - t0))
[ "$(running)" = true ] || { ok=0; detail+="container exited "; }
dc start db >/dev/null 2>&1
t1=$SECONDS
wait_for 120 is_healthy || { ok=0; detail+="did not recover (health=$(health)) "; }
if [ "$ok" = 1 ]; then
    record "2  DB down/recover" PASS "(503 after ${t503}s, unhealthy after ${tunh}s, recovered in $((SECONDS - t1))s)"
else
    record "2  DB down/recover" FAIL "($detail)"
fi

# ---- Scenario 3: graceful stop -------------------------------------------
t0=$SECONDS
dc stop -t 20 app >/dev/null 2>&1
code="$(docker inspect -f '{{.State.ExitCode}}' "$(app_cid)" 2>/dev/null || echo '?')"
el=$((SECONDS - t0))
if [ "$code" = 0 ] && [ "$el" -lt 20 ]; then
    record "3  graceful stop" PASS "(exit=$code in ${el}s)"
else
    record "3  graceful stop" FAIL "(exit=$code in ${el}s)"
fi

# ---- Scenario 4: permanent frontend failure ------------------------------
docker run -d --name "$FATAL_NAME" -e "SECRET=$SECRET_VALUE" \
    -e NODE_OPTIONS=--paper-invalid-option "$IMAGE" >/dev/null
t0=$SECONDS
exited() { [ "$(docker inspect -f '{{.State.Running}}' "$FATAL_NAME")" = false ]; }
if wait_for 90 exited; then
    el=$((SECONDS - t0))
    code="$(docker inspect -f '{{.State.ExitCode}}' "$FATAL_NAME")"
    if [ "$code" = 1 ] && docker logs "$FATAL_NAME" 2>&1 | grep -q '\[start.sh\] FATAL: frontend failed to start'; then
        record "4  fatal frontend exits" PASS "(exit=$code after ${el}s)"
    else
        record "4  fatal frontend exits" FAIL "(exit=$code after ${el}s, FATAL log missing?)"
    fi
else
    record "4  fatal frontend exits" FAIL "(still running after 90s)"
fi

echo
echo "==== Summary ===="
printf '%s\n' "${RESULTS[@]}"
exit "$FAILED"
