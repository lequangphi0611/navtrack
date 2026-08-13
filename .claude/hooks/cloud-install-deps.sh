#!/bin/bash
# SessionStart hook — tự `pnpm install` mỗi phiên Claude Cloud, KHÔNG chạy trên Local (xem
# check CLAUDE_CODE_REMOTE dưới) vì dev Local đã tự cài tay theo README.
#
# Cố ý KHÔNG đặt lệnh này vào setup script của environment: setup script chỉ chạy 1 lần rồi bị
# cache theo ENVIRONMENT (giữ tới ~7 ngày), trong khi repo được clone MỚI mỗi phiên — nếu
# `pnpm install` chạy trong setup script, node_modules sẽ đóng băng theo trạng thái repo của
# lần đầu tiên, lệch với lockfile/commit thật của các phiên sau. SessionStart hook chạy sau
# khi repo đã clone xong, luôn khớp đúng bản đang có — đúng khuyến nghị của nền tảng, xem
# https://code.claude.com/docs/en/cloud-environments#setup-scripts-vs-sessionstart-hooks.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

pnpm install
