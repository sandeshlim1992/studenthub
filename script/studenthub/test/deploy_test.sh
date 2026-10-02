#!/usr/bin/env bash
# Tests for script/studenthub/deploy.sh. They run as a normal user in a temporary directory:
# a small git repository stands in for /opt/zammad, a throwaway PostgreSQL cluster for the
# database, and stubs replace sudo, systemctl, rvm, bundle, pnpm and curl.
#
#   script/studenthub/test/deploy_test.sh
#
# Needs git, node, ruby, the PostgreSQL client tools and server binaries (initdb, pg_ctl).

# Single-quoted text is meant literally: stub code and nginx variables like $http_host.
# shellcheck disable=SC2016

set -euo pipefail

SCRIPT=$(realpath "$(dirname "$0")/../deploy.sh")
PG_BIN=${PG_BIN:-$(find /usr/lib/postgresql -maxdepth 2 -name bin -type d 2>/dev/null | sort -V | tail -n 1)}
[[ -x $PG_BIN/initdb ]] || { echo "PostgreSQL server binaries not found; set PG_BIN" >&2; exit 2; }
ME=$(id -un)
REAL_NODE=$(command -v node)
REAL_PG_DUMP=$(command -v pg_dump)
ROOT=$(mktemp -d "${TMPDIR:-/tmp}/deploy-test.XXXXXX")
PG_SOCK=$(mktemp -d "${TMPDIR:-/tmp}/pg.XXXXXX") # unix socket paths are limited to ~100 characters
PG_PORT=$((40000 + RANDOM % 20000))
PASSED=0 FAILED=0 FAILURES=() CASE='' T='' RC=0 C1='' C2=''

cleanup() {
  "$PG_BIN/pg_ctl" -D "$ROOT/pgdata" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$ROOT" "$PG_SOCK"
}
trap cleanup EXIT

psql_super() { psql -X -q -v ON_ERROR_STOP=1 -h "$PG_SOCK" -p "$PG_PORT" -d postgres "$@"; }
db_scalar() { psql -X -q -A -t -v ON_ERROR_STOP=1 -h "$PG_SOCK" -p "$PG_PORT" -d "${2:-zammad_test}" -c "$1"; }

# --- Stubs --------------------------------------------------------------------------------------

write_stubs() {
  local bin=$ROOT/bin
  mkdir -p "$bin"

  cat >"$bin/stub-lib.sh" <<'EOF'
call() { echo "$*" >>"$STUB_STATE/calls"; }
fails() { [[ ",${STUB_FAIL:-}," == *",$1,"* ]]; }

# A pretend "rake assets:precompile": Sprockets first (rewrites its manifest), then Vite.
build() {
  local h
  h=$(git rev-parse --short=8 HEAD)
  mkdir -p public/assets/frontend/vite/assets public/assets/frontend/vite/.vite tmp/cache/vite
  echo "js $h" >"public/assets/application-$h.js"
  echo "css $h" >"public/assets/application-$h.css"
  printf '{"assets":{"application.js":"application-%s.js","application.css":"application-%s.css"}}\n' "$h" "$h" \
    >public/assets/.sprockets-manifest-0123.json
  if fails vite; then
    printf '{"success": false, "errors": "[UNRESOLVED_IMPORT] Could not resolve logo.png"}\n' >tmp/cache/vite/last-build-production.json
    echo "Build with Vite failed! [UNRESOLVED_IMPORT]" >&2
    exit 1
  fi
  echo "desktop $h" >"public/assets/frontend/vite/assets/desktop-$h.js"
  echo "mobile $h" >"public/assets/frontend/vite/assets/mobile-$h.js"
  if fails unreadable-build; then chmod 600 "public/assets/frontend/vite/assets/desktop-$h.js"; fi
  printf '{"entrypoints/desktop.ts":{"file":"assets/desktop-%s.js","isEntry":true},"entrypoints/mobile.ts":{"file":"assets/mobile-%s.js","isEntry":true}}\n' \
    "$h" "$h" >public/assets/frontend/vite/.vite/manifest.json
  echo "sw $h" >public/assets/frontend/vite/sw.js
  printf '{"success": true}\n' >tmp/cache/vite/last-build-production.json
}

# A pretend "rake db:migrate" that changes the schema and data.
migrate() {
  psql -X -q -v ON_ERROR_STOP=1 -h "$TEST_PG_SOCK" -p "$TEST_PG_PORT" -d zammad_test \
    -c 'CREATE TABLE new_feature (id int); ALTER TABLE new_feature OWNER TO app_owner; INSERT INTO tickets VALUES (99);'
  if fails migrate; then
    echo "StandardError: An error has occurred, this and all later migrations canceled" >&2
    exit 1
  fi
}
EOF

  # sudo: runs the command as the current user. "bash -lc" becomes "bash -c", so the stubs
  # stay first in PATH (a login shell would load the real rvm). With -i it joins and escapes
  # the arguments like the real sudo -i, which leaves "$" unescaped for the login shell.
  cat >"$bin/sudo" <<'EOF'
#!/usr/bin/env bash
. "$STUB_LIB"
login=0
while (($#)); do
  case $1 in
    -u) call "sudo -u $2 $3"; shift 2 ;;
    -i) login=1; shift ;;
    -H) shift ;;
    *) break ;;
  esac
done
if [[ $1 == bash && $2 == -lc ]]; then set -- bash -c "${@:3}"; fi
if ((login)); then
  cmd=''
  for arg; do cmd+="${cmd:+ }$(printf '%s' "$arg" | sed -z 's/[^A-Za-z0-9_$-]/\\&/g')"; done
  exec bash -c "$cmd"
fi
exec "$@"
EOF

  cat >"$bin/systemctl" <<'EOF'
#!/usr/bin/env bash
. "$STUB_LIB"
units=$STUB_STATE/units
action=$1
shift
case $action in
  is-active)
    quiet=0
    if [[ $1 == --quiet ]]; then quiet=1; shift; fi
    state=$(cat "$units/$1" 2>/dev/null || echo inactive)
    ((quiet)) || echo "$state"
    [[ $state == active ]]
    ;;
  stop)
    call "systemctl stop $*"
    for unit; do echo inactive >"$units/$unit"; done
    ;;
  start)
    call "systemctl start $*"
    for unit; do
      if fails "start-$unit"; then echo failed >"$units/$unit"; else echo active >"$units/$unit"; fi
    done
    ;;
  show) echo 0 ;;
  *) echo "systemctl stub: $action not supported" >&2; exit 1 ;;
esac
EOF

  cat >"$bin/rvm" <<'EOF'
#!/usr/bin/env bash
. "$STUB_LIB"
if [[ $1 == alias && $2 == create && $3 == default ]]; then
  call "rvm alias default $4"
  sed -i "s/^default=.*/default=$4/" "$RVM_PATH/config/alias"
  exit 0
fi
ruby=$1
shift
if [[ $1 == do ]]; then shift; fi
[[ -d $RVM_PATH/rubies/$ruby ]] || { echo "rvm stub: $ruby is not installed" >&2; exit 1; }
STUB_RUBY=$ruby exec "$@"
EOF

  cat >"$bin/bundle" <<'EOF'
#!/usr/bin/env bash
. "$STUB_LIB"
call "bundle $* ruby=${STUB_RUBY:-none} default=$(sed -n 's/^default=//p' "$RVM_PATH/config/alias") frozen=${BUNDLE_FROZEN:-} env=${RAILS_ENV:-} umask=$(umask)"
case "$*" in
  install)
    # Overwrite the running deploy script in place (longer than the original), as an editor would.
    if fails rewrite-script; then for _ in $(seq 5000); do echo "echo INJECTED"; done >"$RUN_SCRIPT"; fi
    ! fails bundle-install
    ;;
  check) ! fails bundle-check ;;
  "exec rake assets:precompile") build ;;
  "exec rake db:migrate") migrate ;;
  "exec rails runner Rails.cache.clear") true ;;
  *) echo "bundle stub: unexpected: $*" >&2; exit 1 ;;
esac
EOF

  cat >"$bin/pnpm" <<'EOF'
#!/usr/bin/env bash
. "$STUB_LIB"
call "pnpm $* umask=$(umask)"
case $1 in
  --version) echo "${STUB_PNPM_VERSION:-11.28.3}" ;;
  install) ! fails pnpm-install ;;
  *) exit 1 ;;
esac
EOF

  cat >"$bin/curl" <<'EOF'
#!/usr/bin/env bash
. "$STUB_LIB"
url='' code_only=0
for arg; do
  case $arg in
    http://*) url=$arg ;;
    '%{http_code}') code_only=1 ;;
  esac
done
hostport=${url#http://}
hostport=${hostport%%/*}
path=/${url#http://*/}
running() { [[ $(cat "$STUB_STATE/units/$1" 2>/dev/null) == active ]]; }
if [[ ${hostport##*:} == "$TEST_WS_PORT" ]]; then
  if running zammad-websocket; then exit 52; else exit 7; fi
fi
if ! running zammad-web; then
  if ((code_only)); then printf 000; fi
  exit 7
fi
case $path in
  /) printf 200 ;;
  /cable) printf 101; exit 28 ;;
  /desktop/login)
    entry=$("$REAL_NODE" -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))["entrypoints/desktop.ts"].file)' \
      "$APP_DIR/public/assets/frontend/vite/.vite/manifest.json")
    printf '<html><script type="module" src="/assets/frontend/vite/%s"></script></html>\n' "$entry"
    ;;
  *) if ((code_only)); then printf 404; fi ;;
esac
EOF

  cat >"$bin/node" <<'EOF'
#!/usr/bin/env bash
if [[ ${1:-} == --version && -n ${STUB_NODE_VERSION:-} ]]; then echo "$STUB_NODE_VERSION"; exit 0; fi
exec "$REAL_NODE" "$@"
EOF

  cat >"$bin/pg_dump" <<'EOF'
#!/usr/bin/env bash
. "$STUB_LIB"
if fails pg_dump; then echo "pg_dump: error: connection to server failed" >&2; exit 1; fi
exec "$REAL_PG_DUMP" "$@"
EOF

  # The deploy script refuses to run unless it is root.
  cat >"$bin/id" <<'EOF'
#!/usr/bin/env bash
if [[ $* == -u ]]; then echo 0; exit 0; fi
exec /usr/bin/id "$@"
EOF

  chmod +x "$bin"/*
}

# --- Fixture: a repository with two commits and a running "server" -------------------------------

write_commit() { # write_commit RUBY NODE_MIN PNPM_MIN CONTENT MESSAGE (in the current directory)
  echo "$1" >.ruby-version
  printf "source 'https://rubygems.org'\nruby '%s'\n" "$1" >Gemfile
  printf '{"name":"studenthub-test","engines":{"node":">=%s","pnpm":">=%s"}}\n' "$2" "$3" >package.json
  echo "$4" >app.txt
  git add -A
  git commit -q -m "$5"
}

make_template() {
  local tpl=$ROOT/template
  mkdir -p "$tpl/seed" "$tpl/state"
  git init -q --bare -b develop "$tpl/origin.git"
  (
    cd "$tpl/seed"
    git init -q -b develop
    git config user.email test@example.com
    git config user.name Test
    printf '/tmp/\n/log/\n/config/database.yml\n/auto_wizard.json\n/public/assets/frontend/vite/\n/public/assets/.sprockets-manifest-*.json\n/public/assets/application-*\n' >.gitignore
    mkdir -p db/migrate app/assets/stylesheets/custom
    echo 'class Init; end' >db/migrate/20260101000000_init.rb
    echo 'Put custom CSS here' >app/assets/stylesheets/custom/README.txt
    write_commit 3.4.7 20 10 v1 'first version'
    git push -q "$tpl/origin.git" develop
  )
  git clone -q -b develop "$tpl/origin.git" "$tpl/app"
  (
    cd "$tpl/app"
    mkdir -p config log
    cat >config/database.yml <<'EOF'
default: &default
  adapter: postgresql
  host: <%= ENV.fetch("TEST_PG_SOCK") %>
  port: <%= ENV.fetch("TEST_PG_PORT") %>

production:
  <<: *default
  database: zammad_test
EOF
    STUB_STATE=$tpl/state STUB_LIB=$ROOT/bin/stub-lib.sh STUB_FAIL='' bash -c '. "$STUB_LIB"; build'
  )
  (
    cd "$tpl/seed"
    echo 'class NewFeature; end' >db/migrate/20261002000000_new_feature.rb
    write_commit 3.4.9 24 11 v2 'second version'
    git push -q "$tpl/origin.git" develop
  )
  C1=$(git -C "$tpl/app" rev-parse HEAD)
  C2=$(git -C "$tpl/origin.git" rev-parse develop)
}

# Fresh copy of the fixture for each case: repository, rvm, services running, database.
new_case() {
  CASE=$1
  T=$ROOT/case-$((PASSED + FAILED))-$RANDOM
  printf '\n%s\n' "$CASE"
  cp -a "$ROOT/template" "$T"
  git -C "$T/app" remote set-url origin "$T/origin.git"
  git -C "$T/seed" remote add origin "$T/origin.git" 2>/dev/null || git -C "$T/seed" remote set-url origin "$T/origin.git"
  rm -f "$T/state/calls"
  mkdir -p "$T/state/units" "$T/rvm/config" "$T/rvm/rubies/ruby-3.4.7" "$T/rvm/rubies/ruby-3.4.9" "$T/rvm/bin"
  echo 'default=ruby-3.4.7' >"$T/rvm/config/alias"
  cp "$ROOT/bin/rvm" "$T/rvm/bin/rvm"
  for unit in zammad zammad-web zammad-worker zammad-websocket; do echo active >"$T/state/units/$unit"; done
  printf 'RAILS_ENV=production\nZAMMAD_BIND_IP=127.0.0.1\nZAMMAD_RAILS_PORT=3999\nZAMMAD_WEBSOCKET_PORT=6999\n' >"$T/zammad.env"
  printf 'server {\n  location /cable {\n    proxy_set_header Host $http_host;\n    proxy_pass http://zammad-railsserver;\n  }\n}\n' >"$T/nginx.conf"
  psql_super -c 'DROP DATABASE IF EXISTS zammad_test WITH (FORCE)'
  db_scalar "SELECT datname FROM pg_database WHERE datname LIKE 'zammad\_test\_%'" postgres | while read -r db; do
    psql_super -c "DROP DATABASE \"$db\" WITH (FORCE)"
  done
  psql_super -c 'CREATE DATABASE zammad_test OWNER app_owner'
  db_scalar 'CREATE TABLE tickets (id int); INSERT INTO tickets VALUES (1), (2); ALTER TABLE tickets OWNER TO app_owner;' >/dev/null
  RUN_SCRIPT=$SCRIPT
}

# Runs the deploy script against the case's fixture. Output goes to $T/out, the exit code to $RC.
run_deploy() {
  set +e
  env APP_DIR="$T/app" APP_USER="$ME" ENV_FILE="$T/zammad.env" BACKUP_ROOT="$T/backups" RVM_PATH="$T/rvm" \
    DB_SUPERUSER="$ME" NGINX_CONF="$T/nginx.conf" LOCK_FILE="$T/deploy.lock" \
    DEPLOY_REPO="${DEPLOY_REPO:-origin.git}" MIN_FREE_MB=1 HEALTH_TIMEOUT=4 STABLE_SECONDS=0 \
    PATH="$ROOT/bin:$PATH" STUB_STATE="$T/state" STUB_LIB="$ROOT/bin/stub-lib.sh" STUB_FAIL="${STUB_FAIL:-}" \
    STUB_NODE_VERSION="${STUB_NODE_VERSION:-}" REAL_NODE="$REAL_NODE" REAL_PG_DUMP="$REAL_PG_DUMP" \
    TEST_PG_SOCK="$PG_SOCK" TEST_PG_PORT="$PG_PORT" TEST_WS_PORT=6999 RUN_SCRIPT="$RUN_SCRIPT" \
    bash "$RUN_SCRIPT" "$@" </dev/null >"$T/out" 2>&1
  RC=$?
  set -e
  cat "$T/out" >>"$T/all-output"
}

# --- Assertions -----------------------------------------------------------------------------------

check() {
  local description=$1
  shift
  if "$@"; then
    PASSED=$((PASSED + 1))
    printf '  ok    %s\n' "$description"
  else
    FAILED=$((FAILED + 1))
    FAILURES+=("$CASE: $description")
    printf '  FAIL  %s\n' "$description"
    sed 's/^/          | /' "$T/out" | tail -n 40
  fi
}

rc_is() { [[ $RC == "$1" ]]; }
rc_not() { [[ $RC != "$1" ]]; }
out_has() { grep -qF -- "$1" "$T/out"; }
out_lacks() { ! grep -qF -- "$1" "$T/out"; }
called() { grep -qF -- "$1" "$T/state/calls" 2>/dev/null; }
not_called() { ! called "$1"; }
head_is() { [[ $(git -C "$T/app" rev-parse HEAD) == "$1" ]]; }
default_ruby_is() { [[ $(sed -n 's/^default=//p' "$T/rvm/config/alias") == "$1" ]]; }
unit_is() { [[ $(cat "$T/state/units/$1") == "$2" ]]; }
all_units_active() { for u in zammad zammad-web zammad-worker zammad-websocket; do unit_is "$u" active || return 1; done; }
build_is_for() { # the Vite and Sprockets manifests both belong to commit $1
  local h=${1:0:8}
  grep -qF "desktop-$h.js" "$T/app/public/assets/frontend/vite/.vite/manifest.json" &&
    grep -qF "application-$h.js" "$T/app/public/assets/.sprockets-manifest-0123.json"
}
table_exists() { [[ $(db_scalar "SELECT to_regclass('public.$1') IS NOT NULL" "${2:-zammad_test}") == t ]]; }
table_missing() { ! table_exists "$@"; }
dump_readable() { pg_restore --list "$1" >/dev/null; }
call_count() { grep -cF -- "$1" "$T/state/calls" 2>/dev/null || true; }
backup_dir() { find "$T/backups" -mindepth 1 -maxdepth 1 -type d -name '20*' 2>/dev/null | sort | tail -n 1; }
backup_count() { find "$T/backups" -mindepth 1 -maxdepth 1 -type d -name '20*' 2>/dev/null | wc -l; }
status_is() { [[ $(sed -n 's/^STATUS=//p' "$(backup_dir)/state") == "$1" ]]; }
before() { # the first call containing $1 comes before the first call containing $2
  local a b
  a=$(grep -nF -- "$1" "$T/state/calls" | head -n 1 | cut -d: -f1)
  b=$(grep -nF -- "$2" "$T/state/calls" | head -n 1 | cut -d: -f1)
  [[ -n $a && -n $b ]] && ((a < b))
}

# --- Cases ----------------------------------------------------------------------------------------

test_check_mode() {
  new_case "--check shows the plan and changes nothing"
  run_deploy --check
  check "exits 0" rc_is 0
  check "lists the new commit" out_has "1 new commit(s)"
  check "counts the new migration" out_has "1 new database migration(s)"
  check "announces the Ruby switch" out_has "switches from ruby-3.4.7 to ruby-3.4.9"
  check "says nothing was changed" out_has "Nothing was changed"
  check "code unchanged" head_is "$C1"
  check "no backup made" [ "$(backup_count)" -eq 0 ]
  check "no build, no install" not_called "bundle"
  check "services untouched" not_called "systemctl"
  check "Ruby default unchanged" default_ruby_is ruby-3.4.7
}

test_happy_path() {
  new_case "deploy: build while running, short stop, migrate, start"
  run_deploy --yes
  check "exits 0" rc_is 0
  check "code is the new commit" head_is "$C2"
  check "gems installed with the new Ruby, lockfile frozen" called "bundle install ruby=ruby-3.4.9 default=ruby-3.4.7 frozen=true"
  check "packages installed from the lockfile" called "pnpm install --frozen-lockfile"
  check "build used the new Ruby while the old one was still the default" called "bundle exec rake assets:precompile ruby=ruby-3.4.9 default=ruby-3.4.7"
  check "build ran as the app user with umask 002" called "assets:precompile ruby=ruby-3.4.9 default=ruby-3.4.7 frozen= env=production umask=0002"
  check "build happened before the stop" before "assets:precompile" "systemctl stop"
  check "Ruby default switched while stopped" before "systemctl stop" "rvm alias default ruby-3.4.9"
  check "migrations ran after the switch" before "rvm alias default ruby-3.4.9" "rake db:migrate"
  check "cache cleared before the start" before "rails runner Rails.cache.clear" "systemctl start"
  check "Ruby default is the new one" default_ruby_is ruby-3.4.9
  check "migration applied" table_exists new_feature
  check "services running" all_units_active
  check "new build in place" build_is_for "$C2"
  check "state says deployed" status_is deployed
  check "database backup readable" dump_readable "$(backup_dir)/db.dump"
  check "database backup not world-readable" [ "$(stat -c %a "$(backup_dir)/db.dump")" = 640 ]
  check "log written" grep -qF "6/6  Start Zammad" "$(backup_dir)/deploy.log"
  check "health checks reported" out_has "/desktop/login serves the new frontend build"
  check "explains how to undo" out_has "--rollback $(backup_dir)"

  run_deploy --yes
  check "second run: exits 0" rc_is 0
  check "second run: nothing to do" out_has "Already up to date"
  check "second run: no new backup" [ "$(backup_count)" -eq 1 ]
}

test_build_failure() {
  new_case "deploy: frontend build fails (the 2 Oct problem)"
  STUB_FAIL=vite run_deploy --yes
  check "exits with an error" rc_not 0
  check "shows the build error" out_has "UNRESOLVED_IMPORT"
  check "code put back" head_is "$C1"
  check "previous build put back (Vite and legacy UI)" build_is_for "$C1"
  check "Zammad never stopped" not_called "systemctl stop"
  check "services still running" all_units_active
  check "Ruby default unchanged" default_ruby_is ruby-3.4.7
  check "database untouched" table_missing new_feature
  check "state says reverted" status_is reverted
  check "tells users weren't affected" out_has "users were not affected"

  new_case "deploy: build output not readable by nginx"
  STUB_FAIL=unreadable-build run_deploy --yes
  check "exits with an error" rc_not 0
  check "names the problem" out_has "not readable by nginx"
  check "code put back" head_is "$C1"
  check "Zammad never stopped" not_called "systemctl stop"

  new_case "deploy: bundle install fails"
  STUB_FAIL=bundle-install run_deploy --yes
  check "exits with an error" rc_not 0
  check "code put back" head_is "$C1"
  check "previous build in place" build_is_for "$C1"
  check "Zammad never stopped" not_called "systemctl stop"
  check "state says reverted" status_is reverted
}

test_backup_failure() {
  new_case "deploy: database backup fails while Zammad is stopped"
  STUB_FAIL=pg_dump run_deploy --yes
  check "exits with an error" rc_not 0
  check "code put back" head_is "$C1"
  check "previous build put back" build_is_for "$C1"
  check "Zammad was stopped and started again" before "systemctl stop" "systemctl start"
  check "services running" all_units_active
  check "Ruby default unchanged" default_ruby_is ruby-3.4.7
  check "no migration ran" not_called "rake db:migrate"
  check "says the old version runs again" out_has "is running again"
  check "state says reverted" status_is reverted
}

test_migration_failure_and_rollback() {
  new_case "deploy: migrations fail, then --rollback --restore-db"
  STUB_FAIL=migrate run_deploy --yes
  check "exits with an error" rc_not 0
  check "Zammad left stopped" unit_is zammad-web inactive
  check "explains the rollback command" out_has "--rollback $(backup_dir) --restore-db"
  check "state says failed-migrations" status_is failed-migrations
  check "database is half-migrated (as expected)" table_exists new_feature

  run_deploy --rollback --restore-db --yes
  check "rollback exits 0" rc_is 0
  check "code back on the old commit" head_is "$C1"
  check "Ruby default back to the old one" default_ruby_is ruby-3.4.7
  check "gems checked with the old Ruby" called "bundle check ruby=ruby-3.4.7"
  check "previous build back" build_is_for "$C1"
  check "database restored (no new table)" table_missing new_feature
  check "database restored (old rows only)" [ "$(db_scalar 'SELECT count(*) FROM tickets')" = 2 ]
  check "restored tables keep their owner" [ "$(db_scalar "SELECT tableowner FROM pg_tables WHERE tablename = 'tickets'")" = app_owner ]
  check "restored database keeps its owner" [ "$(db_scalar "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = 'zammad_test'" postgres)" = app_owner ]
  local kept
  kept=$(db_scalar "SELECT datname FROM pg_database WHERE datname LIKE 'zammad\_test\_before\_rollback\_%'" postgres)
  check "the replaced database is kept, not deleted" [ -n "$kept" ]
  check "the kept database has the half-migrated data" table_exists new_feature "$kept"
  check "no leftover restore database" [ -z "$(db_scalar "SELECT datname FROM pg_database WHERE datname LIKE 'zammad\_test\_restore\_%'" postgres)" ]
  check "services running" all_units_active
  check "state says rolled-back" status_is rolled-back

  run_deploy --rollback --yes
  check "second rollback refused" rc_not 0
  check "says it was already rolled back" out_has "already rolled back"
}

test_health_failure_and_rollback() {
  new_case "deploy: new version doesn't come up, then --rollback (database kept)"
  STUB_FAIL=start-zammad-web run_deploy --yes
  check "exits with an error" rc_not 0
  check "reports the failed web check" out_has "answered HTTP 000 instead of 200"
  check "explains both rollback commands" out_has "--restore-db   (database from"
  check "state says failed-checks" status_is failed-checks

  run_deploy --rollback --yes
  check "rollback exits 0" rc_is 0
  check "code back on the old commit" head_is "$C1"
  check "Ruby default back" default_ruby_is ruby-3.4.7
  check "database kept as it was (migration still there)" table_exists new_feature
  check "services running" all_units_active
}

test_rollback_rebuilds_missing_build() {
  new_case "rollback: rebuilds the previous version when the saved build is gone"
  run_deploy --yes
  check "deploy exits 0" rc_is 0
  rm -rf "$T/app/tmp/deploy"
  run_deploy --rollback --yes
  check "rollback exits 0" rc_is 0
  check "rebuilt with the old Ruby" called "bundle exec rake assets:precompile ruby=ruby-3.4.7"
  check "packages reinstalled" [ "$(call_count "pnpm install --frozen-lockfile")" -eq 2 ]
  check "build belongs to the old commit" build_is_for "$C1"

  new_case "rollback: refuses a deploy that already undid itself"
  STUB_FAIL=vite run_deploy --yes
  run_deploy --rollback --yes
  check "exits with an error" rc_not 0
  check "says why" out_has "already undone automatically"
}

test_refusals() {
  new_case "checks: local changes in tracked files"
  echo changed >"$T/app/app.txt"
  run_deploy --check
  check "exits 1" rc_is 1
  check "names the problem and the fix" out_has "tracked files have local changes. Save them first"
  check "lists the file" out_has "M app.txt"

  new_case "checks: git remote is not the Student Hub repository"
  git -C "$T/app" remote set-url origin "$T/seed"
  run_deploy --check
  check "exits 1" rc_is 1
  check "says how to fix the remote" out_has "Point it to the Student Hub repository first"
  check "didn't fetch from it" head_is "$C1"

  new_case "checks: server has its own commits"
  (cd "$T/app" && git -c user.email=t@e -c user.name=T commit -q --allow-empty -m 'local fix')
  run_deploy --check
  check "exits 1" rc_is 1
  check "not a fast-forward" out_has "not a fast-forward"

  new_case "checks: Ruby for the new code not installed"
  rm -r "$T/rvm/rubies/ruby-3.4.9"
  run_deploy --check
  check "exits 1" rc_is 1
  check "gives the install command" out_has "rvm install ruby-3.4.9"

  new_case "checks: Node too old"
  STUB_NODE_VERSION=v20.11.0 run_deploy --check
  check "exits 1" rc_is 1
  check "names the versions" out_has "node v20.11.0 is too old: the new code needs >=24"

  new_case "checks: database on another server"
  sed -i 's/host: .*/host: db.example.com/' "$T/app/config/database.yml"
  run_deploy --check
  check "exits 1" rc_is 1
  check "says why" out_has "only backs up a local PostgreSQL"

  new_case "checks: no confirmation without a terminal"
  run_deploy
  check "exits 1" rc_is 1
  check "asks for --yes" out_has "add --yes"
  check "nothing changed" head_is "$C1"

  new_case "checks: another deploy holds the lock"
  flock "$T/deploy.lock" sleep 5 &
  local holder=$!
  sleep 0.5
  run_deploy --check
  kill "$holder" 2>/dev/null || true
  wait "$holder" 2>/dev/null || true
  check "exits 1" rc_is 1
  check "says another deploy runs" out_has "Another deploy or rollback is running"
}

test_ref() {
  local c3 side
  new_case "--ref: deploys exactly the tested commit, not a newer one"
  (cd "$T/seed" && echo v3 >app.txt && git commit -q -am 'third version' && git push -q origin develop)
  c3=$(git -C "$T/origin.git" rev-parse develop)
  run_deploy --ref "$C2" --yes
  check "exits 0" rc_is 0
  check "on the requested commit" head_is "$C2"
  check "not on the newest" [ "$C2" != "$c3" ]

  new_case "--ref: commit that isn't on the branch is refused"
  (cd "$T/app" && git checkout -q -b side && git -c user.email=t@e -c user.name=T commit -q --allow-empty -m side && git checkout -q develop)
  side=$(git -C "$T/app" rev-parse side)
  run_deploy --ref "$side" --check
  check "exits 1" rc_is 1
  check "says why" out_has "is not on origin/develop"

  new_case "--ref: older commit is refused (use --rollback)"
  run_deploy --yes
  run_deploy --ref "$C1" --check
  check "exits 1" rc_is 1
  check "points to --rollback" out_has "older than the deployed"
}

test_warnings() {
  new_case "checks: warnings for leftovers and nginx"
  echo '.x{}' >"$T/app/app/assets/stylesheets/custom/custom.css"
  echo '{}' >"$T/app/auto_wizard.json"
  printf 'server {\n  location /cable {\n    proxy_pass http://zammad-railsserver;\n  }\n  # proxy_set_header Host $http_host;\n}\n' >"$T/nginx.conf"
  echo inactive >"$T/state/units/zammad-worker"
  run_deploy --check
  check "exits 0 (warnings don't block)" rc_is 0
  check "warns about custom CSS" out_has "untracked CSS is built into the legacy UI"
  check "warns about auto_wizard.json" out_has "auto_wizard.json exists"
  check "warns about the nginx Host header" out_has "has no 'proxy_set_header Host"
  check "warns about a stopped service" out_has "zammad-worker=inactive"
}

test_script_replaced_while_running() {
  new_case "deploy: the script file is overwritten while it runs"
  mkdir -p "$T/run"
  cp "$SCRIPT" "$T/run/deploy.sh"
  RUN_SCRIPT="$T/run/deploy.sh"
  STUB_FAIL=rewrite-script run_deploy --yes
  check "exits 0" rc_is 0
  check "the new file content never ran" out_lacks "INJECTED"
  check "finished the deploy" head_is "$C2"
}

# --- Run ------------------------------------------------------------------------------------------

echo "Setting up (PostgreSQL in $ROOT/pgdata, socket $PG_SOCK) ..."
"$PG_BIN/initdb" -D "$ROOT/pgdata" -A trust -U "$ME" --no-instructions >/dev/null
"$PG_BIN/pg_ctl" -D "$ROOT/pgdata" -l "$ROOT/pg.log" -o "-k $PG_SOCK -p $PG_PORT -c listen_addresses=''" -w start >/dev/null
psql_super -c 'CREATE ROLE app_owner NOLOGIN'
write_stubs
make_template

test_check_mode
test_happy_path
test_build_failure
test_backup_failure
test_migration_failure_and_rollback
test_health_failure_and_rollback
test_rollback_rebuilds_missing_build
test_refusals
test_ref
test_warnings
test_script_replaced_while_running

printf '\n%d passed, %d failed\n' "$PASSED" "$FAILED"
if ((FAILED)); then
  printf '  - %s\n' "${FAILURES[@]}"
  exit 1
fi
