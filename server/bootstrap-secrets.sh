#!/usr/bin/env bash
# One-time bootstrap: generate AUTH_SECRET, prompt for the other secrets,
# save them to ~/.maddysmemories.env so future redeploys reuse them.
# Then source the env and run deploy.sh.

set -euo pipefail

ENV_FILE="${HOME}/.maddysmemories.env"

if [ -f "$ENV_FILE" ]; then
  echo "Reusing existing $ENV_FILE"
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

prompt() {
  local var="$1" desc="$2" default="${3:-}"
  if [ -n "${!var:-}" ]; then return; fi
  local value
  if [ -n "$default" ]; then
    read -r -p "$desc [$default]: " value
    value="${value:-$default}"
  else
    read -r -s -p "$desc: " value
    echo
  fi
  if [ -z "$value" ]; then echo "Empty $var — abort." >&2; exit 1; fi
  printf -v "$var" '%s' "$value"
}

if [ -z "${AUTH_SECRET:-}" ]; then
  AUTH_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  echo "Generated AUTH_SECRET (kept in $ENV_FILE)."
fi

prompt ANTHROPIC_API_KEY    "Anthropic API key (sk-ant-...)"
prompt ADMIN_PASSWORD       "Maddy's admin password (she'll use this to log in)"
prompt FAMILY_PASSWORD      "Family password (grandkids share this)"

umask 077
{
  echo "export ANTHROPIC_API_KEY='${ANTHROPIC_API_KEY}'"
  echo "export ADMIN_PASSWORD='${ADMIN_PASSWORD}'"
  echo "export FAMILY_PASSWORD='${FAMILY_PASSWORD}'"
  echo "export AUTH_SECRET='${AUTH_SECRET}'"
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "Saved secrets to $ENV_FILE (mode 600). Source it later with: source $ENV_FILE"

export ANTHROPIC_API_KEY ADMIN_PASSWORD FAMILY_PASSWORD AUTH_SECRET

cd "$(dirname "$0")"
./deploy.sh
