#!/usr/bin/env bash
# 例：./scripts/wsl-curl.sh -I --connect-timeout 10 https://github.com

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=/dev/null
source "${ROOT}/scripts/wsl-proxy-env.sh"
exec curl "$@"
