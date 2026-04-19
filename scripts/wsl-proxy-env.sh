#!/usr/bin/env bash
# 供 WSL2 使用：把 HTTP 代理指到 Windows 上的 Clash（默认 7890）。
# 注意：resolv.conf 里的 nameserver 有时是 VPN/DNS（如 10.255.255.254），不是宿主机。
# 优先顺序：环境变量 WSL_WINDOWS_HOST > 默认网关 > nameserver > 127.0.0.1

export CLASH_HTTP_PORT="${CLASH_HTTP_PORT:-7890}"

_win=""
if [[ -n "${WSL_WINDOWS_HOST:-}" ]]; then
  _win="${WSL_WINDOWS_HOST}"
elif [[ -r /proc/version ]] && grep -qi microsoft /proc/version; then
  # WSL2：默认网关几乎总是「能连到 Windows 本机」的地址
  _gw="$(ip route show default 2>/dev/null | awk '/default/ {print $3; exit}')"
  if [[ -n "${_gw:-}" ]]; then
    _win="${_gw}"
  elif [[ -f /etc/resolv.conf ]]; then
    _win="$(grep -m1 '^nameserver[[:space:]]' /etc/resolv.conf | awk '{print $2}')"
  fi
fi

if [[ -n "${_win:-}" ]]; then
  export HTTP_PROXY="http://${_win}:${CLASH_HTTP_PORT}"
  export HTTPS_PROXY="http://${_win}:${CLASH_HTTP_PORT}"
  export ALL_PROXY="${HTTP_PROXY}"
else
  export HTTP_PROXY="http://127.0.0.1:${CLASH_HTTP_PORT}"
  export HTTPS_PROXY="http://127.0.0.1:${CLASH_HTTP_PORT}"
  export ALL_PROXY="${HTTP_PROXY}"
fi
unset _win _gw
