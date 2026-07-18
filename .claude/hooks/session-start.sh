#!/bin/bash
# Detect which infra this session runs on (Claude Local CLI vs Claude Cloud web) and inject
# it as context so Claude self-announces and knows to consult TOOLS.md for infra-dependent
# tools (gh CLI vs GitHub MCP, Docker availability...). See TOOLS.md for the full table.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  INFRA="Claude Cloud"
else
  INFRA="Claude Local"
fi

cat <<EOF
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Ha tang phien nay: ${INFRA} (bien CLAUDE_CODE_REMOTE=${CLAUDE_CODE_REMOTE:-rong}). Trong cau tra loi dau tien cua session, tu gioi thieu ngan gon ha tang dang chay (vd: 'Dang chay tren ${INFRA}.') truoc khi vao noi dung chinh. Khi can dung tool co tinh ha tang-phu-thuoc (tao PR/issue, comment, e2e, Docker...), tra bang o TOOLS.md theo dung ha tang nay, khong hardcode tool cua ha tang con lai."}}
EOF
