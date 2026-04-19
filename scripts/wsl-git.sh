#!/usr/bin/env bash
# 在 WSL 里走 Windows 代理执行 git，避免每次手写 export。
# 例：./scripts/wsl-git.sh push -u origin master

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=/dev/null
source "${ROOT}/scripts/wsl-proxy-env.sh"
exec git "$@"
