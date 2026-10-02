#!/usr/bin/env bash
# Student Hub deploy script for the Zammad source install on the test and production servers.
#
#   sudo studenthub-deploy --check        show what would be deployed; changes nothing
#   sudo studenthub-deploy                deploy the newest commit on origin/develop
#   sudo studenthub-deploy --rollback     undo the last deploy (add --restore-db for the database)
#
# How a deploy runs:
#   1. Checks: clean git tree, fast-forward only, Ruby/Node/pnpm versions, database, disk space.
#   2. Build while the current version keeps running: git fast-forward, bundle install,
#      pnpm install, assets:precompile, then verify the build. If any of this fails, the code
#      is put back and Zammad is never restarted, so users notice nothing.
#   3. Short downtime: stop Zammad, back up the database, switch the rvm default Ruby if the
#      new code needs another version, run the migrations, clear the cache.
#   4. Start Zammad and check it: services, HTTP, new frontend build served, websockets.
#
# Every deploy keeps its database backup, state and log in /var/backups/zammad-deploy/<time>/.
# Documentation: "Deploying to the servers" in README.md.

# Single-quoted command lines below run in another shell (as the app user), where $1 is expanded.
# shellcheck disable=SC2016

set -euo pipefail

# Settings. Override them with environment variables, e.g. sudo DEPLOY_BRANCH=main studenthub-deploy
APP_DIR=${APP_DIR:-/opt/zammad}
APP_USER=${APP_USER:-zammad}
DEPLOY_REMOTE=${DEPLOY_REMOTE:-origin}
DEPLOY_BRANCH=${DEPLOY_BRANCH:-develop}
DEPLOY_REPO=${DEPLOY_REPO:-sandeshlim1992/studenthub} # the remote must point to this repository
ENV_FILE=${ENV_FILE:-/etc/zammad/zammad.env}
SERVICE_UNITS=${SERVICE_UNITS:-zammad zammad-web zammad-worker zammad-websocket}
BACKUP_ROOT=${BACKUP_ROOT:-/var/backups/zammad-deploy}
RVM_PATH=${RVM_PATH:-/usr/share/rvm}
DB_SUPERUSER=${DB_SUPERUSER:-postgres}
NGINX_CONF=${NGINX_CONF:-/etc/nginx/sites-enabled/zammad.conf}
LOCK_FILE=${LOCK_FILE:-/run/lock/zammad-deploy.lock}
MIN_FREE_MB=${MIN_FREE_MB:-3072}      # free space needed in APP_DIR for the build
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-300} # seconds to wait for Zammad to answer after the start
STABLE_SECONDS=${STABLE_SECONDS:-20}  # seconds the services must keep running after the start

MODE=deploy ASSUME_YES=0 RESTORE_DB=0 REF='' ROLLBACK_DIR=''
PHASE=checks STAMP=$(date '+%Y%m%d-%H%M%S') SELF=''
BACKUP_DIR='' STATE_FILE='' ASSET_SNAPSHOT=''
PREV_COMMIT='' TARGET_COMMIT='' PREV_RUBY='' TARGET_RUBY=''
UP_TO_DATE=0 SNAPSHOT_TAKEN=0 CODE_UPDATED=0 RUBY_SWITCHED=0 DOWN_SINCE=0 DOWNTIME=''
FAILS=() WARNS=() UNITS=() PG_ARGS=()
DB_NAME='' DB_HOST='' DB_PORT='' DB_OWNER='' DB_ENCODING='' DB_COLLATE='' DB_CTYPE='' DB_SIZE=0
RAILS_ENV='' WEB_URL='' WS_URL='' VITE_DIR='' VITE_LAST_BUILD=''

# --- Small programs run by Ruby, Node or the shell -------------------------------------------

# Prints DB_DATABASE=, DB_HOST= and DB_PORT= for the Rails environment given as argument.
DB_INFO_RUBY='
require "erb"
require "yaml"
config = YAML.safe_load(ERB.new(File.read("config/database.yml")).result, aliases: true).fetch(ARGV[0])
%w[database host port].each { |key| puts "DB_#{key.upcase}=#{config[key]}" }
'

# Reads package.json on stdin and prints "<engines.node>\t<engines.pnpm>".
ENGINES_JS='
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const e = JSON.parse(s).engines || {};
  console.log([e.node || "", e.pnpm || ""].join("\t"));
});
'

# Prints the file of the desktop entry point from the Vite manifest given as argument.
VITE_ENTRY_JS='
const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
console.log(m["entrypoints/desktop.ts"].file);
'

# Checks that every file in the Vite manifest exists and is readable by nginx, and that the
# Sprockets manifest (legacy UI) points to existing files. Arguments: vite dir, public/assets dir.
VERIFY_BUILD_JS='
const fs = require("fs"), path = require("path");
const [viteDir, assetsDir] = process.argv.slice(1);
const problems = [];
const manifest = JSON.parse(fs.readFileSync(path.join(viteDir, ".vite/manifest.json"), "utf8"));
const files = new Set();
for (const entry of Object.values(manifest)) {
  for (const f of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) if (f) files.add(f);
}
for (const f of files) {
  const p = path.join(viteDir, f);
  if (!fs.existsSync(p)) problems.push("missing " + p);
  else if (!(fs.statSync(p).mode & 0o004)) problems.push("not readable by nginx: " + p);
}
if (!manifest["entrypoints/desktop.ts"]) problems.push("no entrypoints/desktop.ts in the Vite manifest");
const sprockets = fs.readdirSync(assetsDir).filter((n) => /^\.sprockets-manifest-.*\.json$/.test(n));
if (sprockets.length !== 1) problems.push("expected 1 Sprockets manifest in " + assetsDir + ", found " + sprockets.length);
else {
  const assets = JSON.parse(fs.readFileSync(path.join(assetsDir, sprockets[0]), "utf8")).assets || {};
  for (const name of ["application.js", "application.css"]) {
    if (!assets[name] || !fs.existsSync(path.join(assetsDir, assets[name]))) problems.push("missing legacy UI asset " + name);
  }
}
if (problems.length) {
  console.error(problems.slice(0, 10).join("\n"));
  process.exit(1);
}
console.log(files.size + " frontend files present, desktop entry " + manifest["entrypoints/desktop.ts"].file);
'

# Copies the build manifests (the only build files that are overwritten in place) to $1.
ASSET_SNAPSHOT_SH='
set -e
mkdir -p "$1/vite"
for f in public/assets/.sprockets-manifest-*.json; do [ -e "$f" ] && cp -a "$f" "$1/"; done
[ -d public/assets/frontend/vite/.vite ] && cp -a public/assets/frontend/vite/.vite "$1/vite/"
for f in sw.js sw.js.map; do [ -e "public/assets/frontend/vite/$f" ] && cp -a "public/assets/frontend/vite/$f" "$1/vite/"; done
true
'

# Puts the manifests saved by ASSET_SNAPSHOT_SH back. Old asset files are never deleted by a
# build, so the previous manifests point to files that still exist.
ASSET_RESTORE_SH='
set -e
[ -d "$1" ] || { echo "asset snapshot $1 is missing" >&2; exit 1; }
if ls "$1"/.sprockets-manifest-*.json >/dev/null 2>&1; then
  rm -f public/assets/.sprockets-manifest-*.json
  cp -a "$1"/.sprockets-manifest-*.json public/assets/
fi
if [ -d "$1/vite/.vite" ]; then
  rm -rf public/assets/frontend/vite/.vite
  cp -a "$1/vite/.vite" public/assets/frontend/vite/
fi
for f in sw.js sw.js.map; do [ -e "$1/vite/$f" ] && cp -a "$1/vite/$f" public/assets/frontend/vite/; done
true
'

# --- Output -----------------------------------------------------------------------------------

log() { printf '%s  %s\n' "$(date '+%H:%M:%S')" "$*"; }
step() { printf '\n%s  == %s\n' "$(date '+%H:%M:%S')" "$*"; }
ok() { log "ok    $*"; }
warn() { log "WARN  $*"; WARNS+=("$*"); }
fail() { log "FAIL  $*"; FAILS+=("$*"); }
die() { log "ERROR $*"; exit 1; }
short() { printf '%s' "${1:0:10}"; }

usage() {
  cat <<EOF
Usage: sudo studenthub-deploy [--check] [--ref COMMIT] [--yes]
       sudo studenthub-deploy --rollback [BACKUP_DIR] [--restore-db] [--yes]

  --check        Run all checks and show what would be deployed. Changes nothing
                 (apart from fetching from GitHub).
  --ref COMMIT   Deploy this commit instead of the newest one on $DEPLOY_REMOTE/$DEPLOY_BRANCH.
                 It must already be on that branch. Use it to put the exact commit you
                 tested on the test server onto production.
  --yes          Don't ask for confirmation.
  --rollback     Undo a deploy: previous code, Ruby and frontend build. BACKUP_DIR defaults
                 to the newest one in $BACKUP_ROOT.
  --restore-db   With --rollback: also put the database back to the backup taken during that
                 deploy. The current database is kept under a new name, nothing is deleted.

Settings (paths, branch, service names) can be changed with environment variables; see the
top of this file.
EOF
}

# --- Running commands as other users ------------------------------------------------------------

# Runs a command line as the app user in a login shell, so rvm is loaded like for the services.
# Extra arguments are available to the command line as $1, $2, ... (Not "sudo -i": it hands the
# command to another shell that expands every "$" before bash -lc sees it.)
as_app() {
  local cmdline=$1
  shift
  sudo -u "$APP_USER" -H bash -lc "umask 002; cd $(printf %q "$APP_DIR") || exit 1; $cmdline" studenthub-deploy "$@"
}

# Runs a command line as the app user with a given rvm Ruby (e.g. ruby-3.4.9), whatever the
# rvm default is.
as_app_ruby() {
  as_app "rvm $(printf %q "$1") do bash -c $(printf %q "$2")"
}

# git as the app user (never as root: the repository belongs to the app user).
app_git() {
  sudo -u "$APP_USER" -H git -C "$APP_DIR" "$@"
}

as_db_superuser() {
  sudo -u "$DB_SUPERUSER" "$@"
}

# Runs SQL as the database superuser and prints the result tab-separated.
db_query() {
  as_db_superuser psql -X -q -A -t -F $'\t' -v ON_ERROR_STOP=1 "${PG_ARGS[@]}" -d "$1" -c "$2"
}

# --- Settings and state ---------------------------------------------------------------------------

# Reads KEY=value from the systemd environment file without running it as shell code.
env_value() {
  local value=''
  if [[ -r $ENV_FILE ]]; then
    value=$(sed -n "s/^[[:space:]]*$1=//p" "$ENV_FILE" | tail -n 1)
    value=${value%\"}
    value=${value#\"}
    value=${value%\'}
    value=${value#\'}
  fi
  printf '%s' "${value:-$2}"
}

load_settings() {
  local ip
  RAILS_ENV=$(env_value RAILS_ENV production)
  [[ $RAILS_ENV =~ ^[a-z_]+$ ]] || die "Unexpected RAILS_ENV '$RAILS_ENV' in $ENV_FILE"
  ip=$(env_value ZAMMAD_BIND_IP 127.0.0.1)
  if [[ $ip == 0.0.0.0 ]]; then ip=127.0.0.1; fi
  WEB_URL="http://$ip:$(env_value ZAMMAD_RAILS_PORT 3000)"
  WS_URL="http://$ip:$(env_value ZAMMAD_WEBSOCKET_PORT 6042)/"
  VITE_DIR="$APP_DIR/public/assets/frontend/vite"
  VITE_LAST_BUILD="$APP_DIR/tmp/cache/vite/last-build-$RAILS_ENV.json"
  read -r -a UNITS <<<"$SERVICE_UNITS"
}

# Database name, host and port from config/database.yml (read as the app user).
read_db_config() {
  local out line
  out=$(as_app 'ruby -e "$1" "$2"' "$DB_INFO_RUBY" "$RAILS_ENV") || die "Can't read config/database.yml"
  while IFS= read -r line; do
    case $line in
      DB_DATABASE=*) DB_NAME=${line#DB_DATABASE=} ;;
      DB_HOST=*) DB_HOST=${line#DB_HOST=} ;;
      DB_PORT=*) DB_PORT=${line#DB_PORT=} ;;
    esac
  done <<<"$out"
  [[ $DB_NAME =~ ^[A-Za-z0-9_]+$ ]] || die "Unexpected database name '$DB_NAME' in config/database.yml"
  PG_ARGS=()
  case $DB_HOST in
    '' | localhost | 127.0.0.1 | ::1) ;;
    /*) PG_ARGS+=("--host=$DB_HOST") ;;
    *) die "The database is on another server ($DB_HOST). This script only backs up a local PostgreSQL." ;;
  esac
  if [[ -n $DB_PORT ]]; then PG_ARGS+=("--port=$DB_PORT"); fi
}

state_set() {
  local key value
  [[ -n $STATE_FILE ]] || return 0
  while (($# >= 2)); do
    key=$1 value=$2
    shift 2
    { grep -v "^$key=" "$STATE_FILE" || true; } >"$STATE_FILE.tmp"
    printf '%s=%s\n' "$key" "$value" >>"$STATE_FILE.tmp"
    mv "$STATE_FILE.tmp" "$STATE_FILE"
  done
}

state_get() {
  sed -n "s/^$1=//p" "$STATE_FILE" | tail -n 1
}

take_lock() {
  exec 9>"$LOCK_FILE" || die "Can't open the lock file $LOCK_FILE"
  flock -n 9 || die "Another deploy or rollback is running (lock: $LOCK_FILE)"
}

start_log() {
  exec > >(tee -a "$1") 2>&1
}

confirm() {
  local answer
  if ((ASSUME_YES)); then return 0; fi
  [[ -t 0 ]] || die "Not running in a terminal: add --yes to confirm"
  read -r -p "$1 [y/N] " answer
  [[ $answer == [yY] || $answer == [yY][eE][sS] ]] || die "Cancelled. Nothing was changed."
}

# --- Checks -------------------------------------------------------------------------------------

check_basics() {
  local cmd
  [[ $(id -u) == 0 ]] || die "Run this as root: sudo $SELF"
  for cmd in sudo git systemctl curl node flock psql pg_dump pg_restore df; do
    command -v "$cmd" >/dev/null || die "Command not found: $cmd"
  done
  [[ -d $APP_DIR ]] || die "$APP_DIR does not exist"
  id "$APP_USER" >/dev/null 2>&1 || die "User $APP_USER does not exist"
  load_settings
}

check_git() {
  local branch changes line remote_url
  app_git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "$APP_DIR is not a git checkout"
  remote_url=$(app_git remote get-url "$DEPLOY_REMOTE" 2>/dev/null) || true
  if [[ $remote_url != *"$DEPLOY_REPO"* ]]; then
    die "git remote '$DEPLOY_REMOTE' is '${remote_url:-not set}', not $DEPLOY_REPO. Point it to the Student Hub repository first: sudo -u $APP_USER -H git -C $APP_DIR remote set-url $DEPLOY_REMOTE git@github.com:$DEPLOY_REPO.git"
  fi
  branch=$(app_git symbolic-ref --quiet --short HEAD || true)
  if [[ $branch != "$DEPLOY_BRANCH" ]]; then
    fail "the checked-out branch is '${branch:-detached HEAD}', expected '$DEPLOY_BRANCH'"
  fi
  ok "git: branch ${branch:-?}, remote $DEPLOY_REMOTE = $remote_url"
  changes=$(app_git status --porcelain --untracked-files=no)
  if [[ -n $changes ]]; then
    fail "tracked files have local changes. Save them first: sudo -u $APP_USER -H git -C $APP_DIR stash push -m 'before deploy'"
    while IFS= read -r line; do log "        $line"; done < <(sed -n '1,15p' <<<"$changes")
  fi
}

resolve_target() {
  local tip="$DEPLOY_REMOTE/$DEPLOY_BRANCH"
  log "fetching $tip ..."
  app_git fetch --quiet "$DEPLOY_REMOTE" "$DEPLOY_BRANCH" || die "git fetch failed (network or deploy key?)"
  PREV_COMMIT=$(app_git rev-parse HEAD)
  TARGET_COMMIT=$(app_git rev-parse --verify --quiet "${REF:-$tip}^{commit}") || die "Unknown commit: ${REF:-$tip}"
  if [[ -n $REF ]] && ! app_git merge-base --is-ancestor "$TARGET_COMMIT" "$tip"; then
    die "$REF is not on $tip. Only commits that were pushed to $DEPLOY_BRANCH can be deployed."
  fi
  if [[ $PREV_COMMIT == "$TARGET_COMMIT" ]]; then
    UP_TO_DATE=1
  elif app_git merge-base --is-ancestor "$PREV_COMMIT" "$TARGET_COMMIT"; then
    ok "fast-forward possible: $(short "$PREV_COMMIT") -> $(short "$TARGET_COMMIT")"
  elif app_git merge-base --is-ancestor "$TARGET_COMMIT" "$PREV_COMMIT"; then
    fail "$(short "$TARGET_COMMIT") is older than the deployed $(short "$PREV_COMMIT"). To go back, use --rollback."
  else
    fail "the server has commits that are not on $tip (not a fast-forward). See: sudo -u $APP_USER -H git -C $APP_DIR log $tip..HEAD"
  fi
}

show_incoming() {
  local count migrations
  count=$(app_git rev-list --count "$PREV_COMMIT..$TARGET_COMMIT")
  log "deployed   $(app_git log -1 --format='%h %ad %s' --date=short "$PREV_COMMIT")"
  log "new        $(app_git log -1 --format='%h %ad %s' --date=short "$TARGET_COMMIT")"
  log "$count new commit(s):"
  app_git log -n 20 --format='             %h %s' "$PREV_COMMIT..$TARGET_COMMIT"
  if ((count > 20)); then log "           ... and $((count - 20)) more"; fi
  migrations=$(app_git diff --name-only --diff-filter=A "$PREV_COMMIT" "$TARGET_COMMIT" -- db/migrate | wc -l)
  log "$migrations new database migration(s)"
}

# rvm name of the Ruby that a commit needs, e.g. ruby-3.4.9 (from .ruby-version or the Gemfile).
ruby_version_at() {
  local version
  version=$(app_git show "$1:.ruby-version" 2>/dev/null | head -n 1 | tr -d '[:space:]') || true
  if [[ -z $version ]]; then
    version=$(app_git show "$1:Gemfile" 2>/dev/null | sed -n "s/^ruby ['\"]\([^'\"]*\)['\"].*/\1/p" | head -n 1) || true
  fi
  [[ -n $version ]] || return 1
  [[ $version == ruby-* ]] || version="ruby-$version"
  printf '%s' "$version"
}

current_default_ruby() {
  sed -n 's/^default=//p' "$RVM_PATH/config/alias" 2>/dev/null | tail -n 1
}

check_ruby() {
  PREV_RUBY=$(current_default_ruby)
  if ! TARGET_RUBY=$(ruby_version_at "$TARGET_COMMIT"); then
    fail "can't tell which Ruby $(short "$TARGET_COMMIT") needs (no .ruby-version, no ruby line in the Gemfile)"
  elif [[ ! -d $RVM_PATH/rubies/$TARGET_RUBY ]]; then
    fail "$TARGET_RUBY is not installed. Install it first without changing the default (no downtime): sudo $RVM_PATH/bin/rvm install $TARGET_RUBY"
  elif [[ $TARGET_RUBY == "$PREV_RUBY" ]]; then
    ok "ruby: $TARGET_RUBY (rvm default)"
  else
    ok "ruby: $TARGET_RUBY installed; the rvm default switches from ${PREV_RUBY:-none} to $TARGET_RUBY during the restart"
  fi
}

check_node_pnpm() {
  local want_node='' want_pnpm='' node_version pnpm_version
  IFS=$'\t' read -r want_node want_pnpm < <(app_git show "$TARGET_COMMIT:package.json" | node -e "$ENGINES_JS") || true
  node_version=$(as_app 'node --version' | tail -n 1) || node_version='none'
  pnpm_version=$(as_app 'cd / && pnpm --version' | tail -n 1) || pnpm_version='none'
  if version_at_least "$node_version" "$want_node"; then
    ok "node: $node_version (needs ${want_node:-any})"
  else
    fail "node $node_version is too old: the new code needs $want_node"
  fi
  if version_at_least "$pnpm_version" "$want_pnpm"; then
    ok "pnpm: $pnpm_version (needs ${want_pnpm:-any})"
  else
    fail "pnpm $pnpm_version is too old: the new code needs $want_pnpm"
  fi
}

# version_at_least VERSION REQUIREMENT: checks requirements like ">=24" on the major version;
# other kinds of requirements are accepted as they are.
version_at_least() {
  local have=${1#v} need re='^>=[[:space:]]*([0-9]+)'
  [[ $2 =~ $re ]] || return 0
  need=${BASH_REMATCH[1]}
  [[ $have =~ ^([0-9]+) ]] || return 1
  ((BASH_REMATCH[1] >= need))
}

check_database() {
  local info
  read_db_config
  if ! info=$(db_query "$DB_NAME" "SELECT pg_get_userbyid(datdba), pg_encoding_to_char(encoding), datcollate, datctype, pg_database_size(oid) FROM pg_database WHERE datname = current_database()"); then
    fail "can't connect to the database $DB_NAME as $DB_SUPERUSER"
    return 0
  fi
  IFS=$'\t' read -r DB_OWNER DB_ENCODING DB_COLLATE DB_CTYPE DB_SIZE <<<"$info"
  ok "database: $DB_NAME, owner $DB_OWNER, $((DB_SIZE / 1024 / 1024)) MB"
}

free_mb() {
  local dir=$1
  while [[ ! -d $dir ]]; do dir=$(dirname "$dir"); done
  df -Pm "$dir" | awk 'NR == 2 { print $4 }'
}

check_disk() {
  local app_free backup_free need_backup
  app_free=$(free_mb "$APP_DIR")
  backup_free=$(free_mb "$BACKUP_ROOT")
  need_backup=$((DB_SIZE / 1024 / 1024 / 2 + 512))
  if ((app_free < MIN_FREE_MB)); then
    fail "only $app_free MB free for $APP_DIR; the build needs $MIN_FREE_MB MB"
  elif ((backup_free < need_backup)); then
    fail "only $backup_free MB free for $BACKUP_ROOT; the database backup needs about $need_backup MB"
  else
    ok "disk: $app_free MB free for the build, $backup_free MB for backups"
  fi
}

check_services() {
  local unit state stopped=()
  for unit in "${UNITS[@]}"; do
    state=$(systemctl is-active "$unit" 2>/dev/null) || true
    if [[ $state != active ]]; then stopped+=("$unit=$state"); fi
  done
  if ((${#stopped[@]})); then
    warn "not running now: ${stopped[*]} (the deploy starts them)"
  else
    ok "services running: ${UNITS[*]}"
  fi
}

check_leftovers() {
  local css
  css=$(app_git ls-files --others --exclude-standard -- app/assets/stylesheets/custom | tr '\n' ' ')
  if [[ -n $css ]]; then
    warn "untracked CSS is built into the legacy UI on top of the Student Hub theme: $css"
  fi
  if [[ -e $APP_DIR/auto_wizard.json ]]; then
    warn "$APP_DIR/auto_wizard.json exists. It creates logins with known passwords; remove it from servers."
  fi
  if [[ -f $VITE_LAST_BUILD ]] && ! grep -q '"success": *true' "$VITE_LAST_BUILD"; then
    log "note  the last frontend build on this server failed; it is rebuilt during the deploy"
  fi
}

check_nginx() {
  local block
  [[ -r $NGINX_CONF ]] || return 0
  block=$(grep -v '^[[:space:]]*#' "$NGINX_CONF" | awk '/location[[:space:]]+\/cable/,/}/')
  if ! grep -q 'proxy_set_header[[:space:]]\+Host[[:space:]]' <<<"$block"; then
    warn "nginx: 'location /cable' in $NGINX_CONF has no 'proxy_set_header Host \$http_host;'. The new UI then shows \"Lost network connection\" when opened by another name or IP than the fqdn setting."
  fi
}

run_checks() {
  step "Checks (nothing is changed)"
  check_basics
  check_git
  resolve_target
  if ((UP_TO_DATE)); then return 0; fi
  show_incoming
  check_ruby
  check_node_pnpm
  check_database
  check_disk
  check_services
  check_leftovers
  check_nginx
}

report_checks() {
  if ((${#FAILS[@]})); then
    printf '\n'
    log "Can't deploy yet. Fix these first:"
    printf '        - %s\n' "${FAILS[@]}"
    exit 1
  fi
  ok "all checks passed (${#WARNS[@]} warning(s))"
}

# --- Build, stop, migrate, start ----------------------------------------------------------------

vite_build_succeeded() {
  grep -q '"success": *true' "$VITE_LAST_BUILD" 2>/dev/null
}

verify_build() {
  node -e "$VERIFY_BUILD_JS" "$VITE_DIR" "$APP_DIR/public/assets"
}

build_assets() {
  local ruby=$1
  if [[ -f $VITE_LAST_BUILD ]] && ! vite_build_succeeded; then
    as_app 'rm -f "$1"' "$VITE_LAST_BUILD" # forget the failed build so Vite tries again
  fi
  as_app_ruby "$ruby" "RAILS_ENV=$RAILS_ENV bundle exec rake assets:precompile"
  vite_build_succeeded || die "The Vite build did not succeed (see $VITE_LAST_BUILD)"
  verify_build
}

stop_services() {
  local unit
  systemctl stop "${UNITS[@]}"
  for unit in "${UNITS[@]}"; do
    if systemctl is-active --quiet "$unit"; then die "$unit is still running after systemctl stop"; fi
  done
  ok "Zammad stopped"
}

start_services() {
  systemctl start "${UNITS[@]}"
}

backup_database() {
  local dump="$BACKUP_DIR/db.dump"
  log "backing up the database $DB_NAME ..."
  as_db_superuser pg_dump --format=custom "${PG_ARGS[@]}" "$DB_NAME" >"$dump"
  chgrp "$DB_SUPERUSER" "$dump" # the database superuser reads it during a rollback
  chmod 0640 "$dump"
  pg_restore --list "$dump" >/dev/null || die "The database backup $dump can't be read back"
  state_set DB_DUMP db.dump DB_DUMP_AT "$(date '+%Y-%m-%d %H:%M:%S')" DB_NAME "$DB_NAME" \
    DB_OWNER "$DB_OWNER" DB_ENCODING "$DB_ENCODING" DB_COLLATE "$DB_COLLATE" DB_CTYPE "$DB_CTYPE"
  ok "database backup: $dump ($(du -h "$dump" | cut -f1))"
}

set_default_ruby() {
  "$RVM_PATH/bin/rvm" alias create default "$1" >/dev/null
  [[ $(current_default_ruby) == "$1" ]] || die "rvm default Ruby is $(current_default_ruby), expected $1"
}

switch_ruby() {
  if [[ $TARGET_RUBY == "$PREV_RUBY" ]]; then return 0; fi
  log "switching the rvm default Ruby: $PREV_RUBY -> $TARGET_RUBY"
  RUBY_SWITCHED=1
  set_default_ruby "$TARGET_RUBY"
  state_set RUBY_SWITCHED 1
}

# Prints ERROR/FATAL lines written to the Rails log since $1 (YYYY-MM-DDTHH:MM:SS). Search index
# errors are left out: they mean Elasticsearch is down, which a deploy doesn't change.
recent_log_errors() {
  local logfile="$APP_DIR/log/$RAILS_ENV.log"
  [[ -r $logfile ]] || return 0
  tail -c 20000000 "$logfile" | grep -a -E '^[EF], \[' | awk -v since="$1" 'substr($0, 5, 19) >= since' |
    grep -a -v -i -E 'elasticsearch|SearchIndex' | tail -n 5 || true
}

# Waits until the web server answers HTTP 200; prints the last HTTP code.
wait_for_web() {
  local code=000 deadline=$((SECONDS + HEALTH_TIMEOUT))
  while :; do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$WEB_URL/") || true
    if [[ $code == 200 ]] || ((SECONDS >= deadline)); then break; fi
    sleep 3
  done
  printf '%s' "$code"
  [[ $code == 200 ]]
}

health_check() {
  local problems=() code expected html unit rc tries=0
  local -A restarts=()
  log "waiting for $WEB_URL to answer (up to ${HEALTH_TIMEOUT}s) ..."
  code=$(wait_for_web) || true
  if ((DOWN_SINCE)); then DOWNTIME=$((SECONDS - DOWN_SINCE)); fi
  if [[ $code != 200 ]]; then
    problems+=("$WEB_URL/ answered HTTP $code instead of 200")
  else
    ok "web server answers"
    expected="/assets/frontend/vite/$(node -e "$VITE_ENTRY_JS" "$VITE_DIR/.vite/manifest.json")"
    html=$(curl -s --max-time 30 "$WEB_URL/desktop/login") || true
    if grep -qF "$expected" <<<"$html"; then
      ok "/desktop/login serves the new frontend build"
    else
      problems+=("/desktop/login does not use the new frontend build ($expected)")
    fi
    code=$(curl --http1.1 -s -o /dev/null -w '%{http_code}' --max-time 5 -H 'Connection: Upgrade' \
      -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: c3R1ZGVudGh1Yi1kZXBsb3k=' \
      -H "Origin: $WEB_URL" "$WEB_URL/cable") || true
    if [[ $code == 101 ]]; then
      ok "websocket /cable connects (new UI)"
    else
      problems+=("websocket $WEB_URL/cable answered HTTP $code instead of 101")
    fi
  fi
  while :; do
    rc=0
    curl -s -o /dev/null --max-time 3 "$WS_URL" || rc=$?
    if ((rc != 7)) || ((++tries >= 10)); then break; fi
    sleep 3
  done
  if ((rc == 7)); then
    problems+=("nothing listens on $WS_URL (websocket server of the legacy UI)")
  else
    ok "websocket server of the legacy UI listens"
  fi
  for unit in "${UNITS[@]}"; do restarts[$unit]=$(systemctl show -p NRestarts --value "$unit" 2>/dev/null || true); done
  log "watching the services for ${STABLE_SECONDS}s ..."
  sleep "$STABLE_SECONDS"
  for unit in "${UNITS[@]}"; do
    if ! systemctl is-active --quiet "$unit"; then
      problems+=("$unit is $(systemctl is-active "$unit" || true)")
    elif [[ $(systemctl show -p NRestarts --value "$unit" 2>/dev/null || true) != "${restarts[$unit]}" ]]; then
      problems+=("$unit restarted during the check (crash loop?)")
    fi
  done
  if ((${#problems[@]})); then
    log "Checks that failed:"
    printf '        - %s\n' "${problems[@]}"
    return 1
  fi
  ok "services stable: ${UNITS[*]}"
}

# --- Deploy -------------------------------------------------------------------------------------

deploy() {
  local since errors
  take_lock
  run_checks
  if ((UP_TO_DATE)); then
    log "Already up to date: $APP_DIR is on $(short "$PREV_COMMIT"), the newest commit of $DEPLOY_REMOTE/$DEPLOY_BRANCH. Nothing to do."
    return 0
  fi
  report_checks
  if [[ $MODE == check ]]; then
    log "Check finished. Nothing was changed. Deploy with: sudo $SELF${REF:+ --ref $REF}"
    return 0
  fi

  printf '\n'
  log "Zammad keeps running while the new version is built. It is stopped only for the database"
  log "backup, the migrations and the restart. Run this inside tmux or screen, so a dropped SSH"
  log "connection can't interrupt it."
  confirm "Deploy $(short "$TARGET_COMMIT") to $APP_DIR now?"

  BACKUP_DIR="$BACKUP_ROOT/$STAMP"
  install -d -m 0750 -g "$DB_SUPERUSER" "$BACKUP_ROOT" "$BACKUP_DIR"
  STATE_FILE="$BACKUP_DIR/state"
  : >"$STATE_FILE"
  start_log "$BACKUP_DIR/deploy.log"
  state_set STATUS building STARTED_AT "$(date '+%Y-%m-%d %H:%M:%S')" PREV_COMMIT "$PREV_COMMIT" \
    TARGET_COMMIT "$TARGET_COMMIT" PREV_RUBY "$PREV_RUBY" TARGET_RUBY "$TARGET_RUBY"

  PHASE=prepare
  step "1/6  Update the code (Zammad keeps running)"
  ASSET_SNAPSHOT="tmp/deploy/assets-$STAMP"
  as_app "$ASSET_SNAPSHOT_SH" "$ASSET_SNAPSHOT"
  SNAPSHOT_TAKEN=1
  state_set ASSET_SNAPSHOT "$ASSET_SNAPSHOT"
  CODE_UPDATED=1 # before the merge, so that a half-done merge is undone as well
  app_git merge --ff-only --quiet "$TARGET_COMMIT"
  ok "code is at $(short "$TARGET_COMMIT")"

  step "2/6  Ruby gems ($TARGET_RUBY)"
  as_app_ruby "$TARGET_RUBY" 'BUNDLE_FROZEN=true bundle install'

  step "3/6  Node packages"
  as_app 'CI=true pnpm install --frozen-lockfile'

  step "4/6  Build the frontend (Zammad keeps running)"
  build_assets "$TARGET_RUBY"
  if [[ -n $(app_git status --porcelain --untracked-files=no) ]]; then
    warn "the build changed tracked files (the next deploy refuses until they are committed or reset): $(app_git status --porcelain --untracked-files=no | tr '\n' ' ')"
  fi

  PHASE=stopped
  step "5/6  Stop Zammad, back up the database, migrate"
  DOWN_SINCE=$SECONDS
  stop_services
  state_set STATUS stopped
  backup_database
  switch_ruby
  PHASE=migrate
  state_set STATUS migrating
  log "running the database migrations ..."
  as_app_ruby "$TARGET_RUBY" "RAILS_ENV=$RAILS_ENV bundle exec rake db:migrate"
  as_app_ruby "$TARGET_RUBY" "RAILS_ENV=$RAILS_ENV bundle exec rails runner 'Rails.cache.clear'"
  ok "migrations done, cache cleared"

  PHASE=started
  state_set STATUS starting
  step "6/6  Start Zammad and check it"
  since=$(date '+%Y-%m-%dT%H:%M:%S')
  start_services
  health_check || die "Zammad was started, but the checks failed"
  PHASE=finished
  state_set STATUS deployed FINISHED_AT "$(date '+%Y-%m-%d %H:%M:%S')"
  errors=$(recent_log_errors "$since")
  if [[ -n $errors ]]; then warn "errors in log/$RAILS_ENV.log since the start (check them):"$'\n'"$errors"; fi

  printf '\n'
  log "Deployed $(short "$PREV_COMMIT") -> $(short "$TARGET_COMMIT") in $((SECONDS / 60))m $((SECONDS % 60))s; Zammad was down for about ${DOWNTIME:-?}s."
  log "Backup and log: $BACKUP_DIR"
  log "To undo:        sudo $SELF --rollback $BACKUP_DIR   (add --restore-db to also restore the database)"
  log "If a browser still shows the old pages, reload with Ctrl+Shift+R."
  if ((${#WARNS[@]})); then
    log "Warnings:"
    printf '        - %s\n' "${WARNS[@]}"
  fi
}

# Puts the previous code and build back; used when a deploy fails before the migrations.
undo_build() {
  local result=0
  if ((CODE_UPDATED)); then
    app_git reset --hard --quiet "$PREV_COMMIT" || result=1
  fi
  if ((SNAPSHOT_TAKEN)); then
    as_app "$ASSET_RESTORE_SH" "$ASSET_SNAPSHOT" || result=1
  fi
  if ((RUBY_SWITCHED)); then
    set_default_ruby "$PREV_RUBY" || result=1
  fi
  return "$result"
}

on_deploy_failure() {
  local undo_dir=${BACKUP_DIR:-$BACKUP_ROOT/<time>}
  printf '\n'
  case $PHASE in
    prepare)
      log "The deploy failed while building. Putting the previous version back ..."
      if undo_build; then
        state_set STATUS reverted
        log "Back on $(short "$PREV_COMMIT"). Zammad was not restarted, so users were not affected."
      else
        log "Undo FAILED. Do it by hand: sudo -u $APP_USER -H git -C $APP_DIR reset --hard $PREV_COMMIT"
      fi
      ;;
    stopped)
      log "The deploy failed while Zammad was stopped, before the migrations. Putting the previous"
      log "version back and starting it again ..."
      if undo_build && start_services; then
        state_set STATUS reverted
        if wait_for_web >/dev/null; then
          log "The previous version $(short "$PREV_COMMIT") is running again."
        else
          log "The previous version $(short "$PREV_COMMIT") was started, but $WEB_URL doesn't answer yet. Check it."
        fi
      else
        log "Undo FAILED. Zammad may be stopped. Run: sudo $SELF --rollback $undo_dir"
      fi
      ;;
    migrate)
      state_set STATUS failed-migrations
      log "The migrations failed. Zammad is STOPPED and the database may be partly migrated."
      log "To go back (code, Ruby and the database from just before the migrations; nothing is lost"
      log "because Zammad was stopped the whole time):"
      log "    sudo $SELF --rollback $undo_dir --restore-db"
      ;;
    started)
      state_set STATUS failed-checks
      log "Zammad runs the new version, but the checks above failed. Look at:"
      log "    journalctl -u zammad-web -n 100    and    $APP_DIR/log/$RAILS_ENV.log"
      log "To go back to the previous version:"
      log "    sudo $SELF --rollback $undo_dir                (keeps the database as it is)"
      log "    sudo $SELF --rollback $undo_dir --restore-db   (database from $(state_get DB_DUMP_AT);"
      log "        anything users changed since then is only kept in the renamed old database)"
      ;;
  esac
  if [[ -n $BACKUP_DIR ]]; then log "Log: $BACKUP_DIR/deploy.log"; fi
}

# --- Rollback -----------------------------------------------------------------------------------

latest_backup_dir() {
  find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '20*' 2>/dev/null | sort | tail -n 1
}

restore_database() {
  local dump=$1 db_stamp=${STAMP//-/_} restore_db old_db data_dir
  restore_db="${DB_NAME}_restore_$db_stamp"
  old_db="${DB_NAME}_before_rollback_$db_stamp"
  data_dir=$(db_query postgres 'SHOW data_directory')
  if (($(free_mb "$data_dir") < DB_SIZE / 1024 / 1024 + 1024)); then
    die "Not enough space in $data_dir for a second copy of the database (needs about $((DB_SIZE / 1024 / 1024 + 1024)) MB)"
  fi
  log "restoring $dump into the new database $restore_db ..."
  as_db_superuser createdb "${PG_ARGS[@]}" --template=template0 --encoding="$DB_ENCODING" \
    --lc-collate="$DB_COLLATE" --lc-ctype="$DB_CTYPE" --owner="$DB_OWNER" "$restore_db"
  if ! as_db_superuser pg_restore "${PG_ARGS[@]}" --exit-on-error --dbname="$restore_db" "$dump"; then
    as_db_superuser dropdb "${PG_ARGS[@]}" --if-exists "$restore_db" || true # only the half-restored copy
    die "Restoring the backup failed. The current database was not touched."
  fi
  log "swapping: $DB_NAME -> $old_db, $restore_db -> $DB_NAME"
  db_query postgres "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('$DB_NAME', '$restore_db') AND pid <> pg_backend_pid()" >/dev/null
  db_query postgres "BEGIN; ALTER DATABASE \"$DB_NAME\" RENAME TO \"$old_db\"; ALTER DATABASE \"$restore_db\" RENAME TO \"$DB_NAME\"; COMMIT;"
  state_set DB_RESTORED 1 DB_KEPT_AS "$old_db"
  ok "database restored. The database from before the rollback is kept as $old_db;"
  log "      drop it once everything works: sudo -u $DB_SUPERUSER dropdb $old_db"
}

rollback() {
  local dir head status prev_ruby dump_at errors since
  take_lock
  step "Rollback checks (nothing is changed)"
  check_basics
  dir=${ROLLBACK_DIR:-$(latest_backup_dir)}
  [[ -n $dir && -f $dir/state ]] || die "No deploy backup found in ${dir:-$BACKUP_ROOT}"
  BACKUP_DIR=$dir STATE_FILE="$dir/state"
  status=$(state_get STATUS)
  PREV_COMMIT=$(state_get PREV_COMMIT) TARGET_COMMIT=$(state_get TARGET_COMMIT)
  prev_ruby=$(state_get PREV_RUBY) ASSET_SNAPSHOT=$(state_get ASSET_SNAPSHOT) dump_at=$(state_get DB_DUMP_AT)
  [[ -n $PREV_COMMIT ]] || die "$STATE_FILE has no previous commit"
  case $status in
    reverted) die "That deploy was already undone automatically when it failed. Nothing to roll back." ;;
    rolled-back) die "That deploy was already rolled back." ;;
  esac
  head=$(app_git rev-parse HEAD)
  if [[ $head != "$TARGET_COMMIT" && $head != "$PREV_COMMIT" ]]; then
    die "The server is on $(short "$head"), but this backup belongs to the deploy of $(short "$TARGET_COMMIT"). Use the backup of the newest deploy."
  fi
  if [[ -n $(app_git status --porcelain --untracked-files=no) ]]; then
    die "Tracked files have local changes; save them first: sudo -u $APP_USER -H git -C $APP_DIR stash push -m 'before rollback'"
  fi
  read_db_config
  if ((RESTORE_DB)); then
    [[ -f $dir/db.dump ]] || die "$dir has no database backup (the deploy failed before taking it)"
    if [[ $(state_get DB_RESTORED) == 1 ]]; then
      log "note  the database of this backup was already restored by an earlier rollback; skipping that part"
      RESTORE_DB=0
    else
      [[ $(state_get DB_NAME) == "$DB_NAME" ]] || die "The backup is of the database $(state_get DB_NAME), but config/database.yml uses $DB_NAME"
      # Owner, encoding and locale of the current database; the restored copy gets the same.
      IFS=$'\t' read -r DB_OWNER DB_ENCODING DB_COLLATE DB_CTYPE DB_SIZE < <(db_query "$DB_NAME" "SELECT pg_get_userbyid(datdba), pg_encoding_to_char(encoding), datcollate, datctype, pg_database_size(oid) FROM pg_database WHERE datname = current_database()") ||
        die "Can't connect to the database $DB_NAME as $DB_SUPERUSER"
    fi
  fi

  log "backup     $dir (deploy of $(state_get STARTED_AT), status: $status)"
  log "code       $(short "$head") -> $(short "$PREV_COMMIT")"
  log "ruby       rvm default -> ${prev_ruby:-unchanged}"
  if ((RESTORE_DB)); then
    log "database   restored to the backup from $dump_at; the current one is kept under a new name"
    log "WARNING    tickets, users and settings changed after $dump_at will not be in the restored database"
  else
    log "database   kept as it is"
  fi
  confirm "Roll back to $(short "$PREV_COMMIT")?"

  start_log "$dir/rollback-$STAMP.log"
  PHASE=rollback
  state_set STATUS rolling-back
  step "Stop Zammad"
  stop_services
  if ((RESTORE_DB)); then
    step "Restore the database"
    restore_database "$dir/db.dump"
  fi
  step "Previous code, Ruby and gems"
  app_git reset --hard --quiet "$PREV_COMMIT"
  ok "code is at $(short "$PREV_COMMIT")"
  prev_ruby=${prev_ruby:-$(current_default_ruby)}
  if [[ $(current_default_ruby) != "$prev_ruby" ]]; then
    set_default_ruby "$prev_ruby"
    ok "rvm default Ruby is $prev_ruby again"
  fi
  as_app_ruby "$prev_ruby" 'bundle check >/dev/null || BUNDLE_FROZEN=true bundle install'
  step "Previous frontend build"
  if [[ -n $ASSET_SNAPSHOT ]] && as_app "$ASSET_RESTORE_SH" "$ASSET_SNAPSHOT" && verify_build; then
    ok "previous build restored"
  else
    log "the saved build can't be used; building the previous version again ..."
    as_app 'CI=true pnpm install --frozen-lockfile'
    build_assets "$prev_ruby"
  fi
  as_app_ruby "$prev_ruby" "RAILS_ENV=$RAILS_ENV bundle exec rails runner 'Rails.cache.clear'"
  step "Start Zammad and check it"
  since=$(date '+%Y-%m-%dT%H:%M:%S')
  start_services
  health_check || die "Zammad was started, but the checks failed"
  PHASE=finished
  state_set STATUS rolled-back ROLLED_BACK_AT "$(date '+%Y-%m-%d %H:%M:%S')"
  errors=$(recent_log_errors "$since")
  if [[ -n $errors ]]; then warn "errors in log/$RAILS_ENV.log since the start (check them):"$'\n'"$errors"; fi
  printf '\n'
  log "Rolled back to $(short "$PREV_COMMIT"). Log: $dir/rollback-$STAMP.log"
}

on_rollback_failure() {
  printf '\n'
  log "The rollback stopped with an error (see above). Zammad may be stopped."
  log "Fix the problem and run the same command again; finished parts are skipped or repeated safely."
  if [[ -n $BACKUP_DIR ]]; then log "Log: $BACKUP_DIR/rollback-$STAMP.log"; fi
}

# --- Main ---------------------------------------------------------------------------------------

on_exit() {
  local rc=$?
  trap - EXIT
  set +e
  if ((rc != 0)); then
    case $PHASE in
      prepare | stopped | migrate | started) on_deploy_failure ;;
      rollback) on_rollback_failure ;;
    esac
  fi
  exit "$rc"
}

parse_args() {
  while (($#)); do
    case $1 in
      --check | --dry-run) MODE=check ;;
      --ref)
        REF=${2:-}
        [[ -n $REF ]] || die "--ref needs a commit"
        shift
        ;;
      --yes | -y) ASSUME_YES=1 ;;
      --rollback)
        MODE=rollback
        if [[ -n ${2:-} && ${2:-} != -* ]]; then
          ROLLBACK_DIR=$(realpath -m "$2")
          shift
        fi
        ;;
      --restore-db) RESTORE_DB=1 ;;
      -h | --help)
        usage
        exit 0
        ;;
      *) die "Unknown option $1 (see --help)" ;;
    esac
    shift
  done
  if ((RESTORE_DB)) && [[ $MODE != rollback ]]; then die "--restore-db only works together with --rollback"; fi
  if [[ -n $REF && $MODE == rollback ]]; then die "--ref can't be combined with --rollback"; fi
}

main() {
  SELF=$(readlink -f "$0")
  parse_args "$@"
  cd /
  trap on_exit EXIT
  trap 'exit 130' INT TERM HUP
  if [[ $MODE == rollback ]]; then rollback; else deploy; fi
}

# Everything above only defines things, so bash has read the whole file before main runs. That
# keeps a running deploy safe when git replaces this file. Sourcing the file (tests) skips main.
[[ ${BASH_SOURCE[0]} != "$0" ]] || {
  main "$@"
  exit $?
}
