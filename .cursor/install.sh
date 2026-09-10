#!/usr/bin/env bash
# Idempotent bootstrap for the Cursor plugins marketplace repo.
# Safe to re-run: every step converges to the same state.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Installing plugin-validator dependencies (ajv, ajv-formats)"
# The root has no package.json; --no-save mirrors the CI workflow and only
# populates the git-ignored node_modules/ used by scripts/validate-plugins.mjs.
npm install --no-save ajv ajv-formats

echo "==> Ensuring bun is installed (used by the orchestrate and poteto-mode script packages)"
if ! command -v bun >/dev/null 2>&1; then
  export BUN_INSTALL="$HOME/.bun"
  curl -fsSL https://bun.sh/install | bash
fi
BUN_BIN="$HOME/.bun/bin/bun"
# Expose bun on PATH for non-interactive agent shells regardless of profile sourcing.
if [ -x "$BUN_BIN" ]; then
  sudo ln -sf "$BUN_BIN" /usr/local/bin/bun
fi
export PATH="$HOME/.bun/bin:$PATH"
bun --version

# Install dependencies for each bun-based script package that ships a lockfile.
for pkg in \
  "orchestrate/skills/orchestrate/scripts" \
  "pstack/skills/poteto-mode/scripts"; do
  if [ -f "$REPO_ROOT/$pkg/package.json" ]; then
    echo "==> bun install ($pkg)"
    (cd "$REPO_ROOT/$pkg" && bun install --frozen-lockfile)
  fi
done

echo "==> Install complete"
