#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for the cursor-plugins marketplace repo.
# Prepares dependencies for the two development workflows in this repo:
#   1. Root plugin/marketplace schema validation (Node, mirrors CI).
#   2. Skill script projects that run under Bun (orchestrate, poteto-mode).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# 1. Root validation dependencies. Mirrors .github/workflows/validate-plugins.yml.
npm install --no-save ajv ajv-formats

# 2. Bun toolchain for the skill script projects.
BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
if ! command -v bun >/dev/null 2>&1 && [ ! -x "$BUN_INSTALL/bin/bun" ]; then
  curl -fsSL https://bun.sh/install | bash
fi
export PATH="$BUN_INSTALL/bin:$PATH"
# Best-effort: also expose bun on the always-on PATH so non-login agent shells
# find it. Never fatal — bun is already usable via the exported PATH above.
if [ -x "$BUN_INSTALL/bin/bun" ] && [ ! -e /usr/local/bin/bun ] && command -v sudo >/dev/null 2>&1; then
  sudo ln -sf "$BUN_INSTALL/bin/bun" /usr/local/bin/bun || true
  sudo ln -sf "$BUN_INSTALL/bin/bun" /usr/local/bin/bunx || true
fi

# 3. Skill script project dependencies.
( cd orchestrate/skills/orchestrate/scripts && bun install )
( cd pstack/skills/poteto-mode/scripts && bun install )

echo "Cloud Agent environment bootstrap complete."
