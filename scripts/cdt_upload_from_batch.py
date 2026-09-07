#!/usr/bin/env python3
"""Prepare CallDynamicTool args for one prog20k batch index.

Usage:
  python3 cdt_upload_from_batch.py <index>
  python3 cdt_upload_from_batch.py pending   # list pending indices

Writes /tmp/cdt_invoke_args.json with {path, content} for agent CallDynamicTool.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

BATCH = Path("/tmp/upload_batch")
INVOKE = Path("/tmp/cdt_invoke_args.json")
STATE = Path("/tmp/upload_cursor_state.json")


def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"next": 0, "done": []}


def list_jobs() -> list[Path]:
    return sorted(
        [p for p in BATCH.glob("*.json") if p.stem.isdigit() and len(p.stem) == 3],
        key=lambda p: int(p.stem),
    )


def prepare(idx: int) -> dict:
    meta = json.loads((BATCH / f"{idx:03d}.json").read_text())
    args = {"path": meta["path"], "content": meta["content"]}
    INVOKE.write_text(json.dumps(args, ensure_ascii=False))
    return {
        "idx": idx,
        "path": meta["path"],
        "step": meta.get("step", str(idx)),
        "bytes": len(meta["content"]),
        "invoke_args": str(INVOKE),
    }


def pending() -> list[int]:
    st = load_state()
    done = set(st.get("done", []))
    return [int(p.stem) for p in list_jobs() if int(p.stem) not in done]


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(1)
    if sys.argv[1] == "pending":
        p = pending()
        print(json.dumps({"pending_count": len(p), "pending": p[:30], "next": p[0] if p else None}))
        return
    idx = int(sys.argv[1])
    print(json.dumps(prepare(idx), indent=2))


if __name__ == "__main__":
    main()
