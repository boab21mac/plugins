#!/usr/bin/env python3
"""Upload all items from /tmp/upload_manifest.json using CallDynamicTool via agent loop.

This script prepares batches and logs progress. The agent must call:
  CallDynamicTool(Onedrive, create_or_update_file, args)

for each index returned by `next` subcommand.

Usage:
  python3 cdt_upload_all.py prepare
  python3 cdt_upload_all.py next [batch_size]
  python3 cdt_upload_all.py log OK|FAIL <index> [error]
  python3 cdt_upload_all.py summary
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

MANIFEST = Path("/tmp/upload_manifest.json")
STATE = Path("/tmp/cdt_upload_all_state.json")
LOG = Path("/tmp/upload_progress.log")
PAYLOAD_DIR = Path("/tmp")


def load_manifest() -> list[dict]:
    return json.loads(MANIFEST.read_text())


def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"index": 0}


def save_state(state: dict) -> None:
    STATE.write_text(json.dumps(state, indent=2))


def uploaded_paths() -> set[str]:
    if not LOG.exists():
        return set()
    out = set()
    for line in LOG.read_text().splitlines():
        if line.startswith("OK\t"):
            parts = line.split("\t")
            if len(parts) >= 2:
                out.add(parts[1])
    return out


def prepare() -> None:
    manifest = load_manifest()
    save_state({"index": 0})
    if LOG.exists():
        # keep existing log
        pass
    print(json.dumps({"total": len(manifest), "log": str(LOG)}))


def get_args(i: int) -> dict:
    p = PAYLOAD_DIR / f"upload_payload_{i:03d}.json"
    return json.loads(p.read_text())


def next_batch(batch_size: int = 5) -> None:
    manifest = load_manifest()
    done = uploaded_paths()
    state = load_state()
    start = state["index"]
    batch = []
    i = start
    while i < len(manifest) and len(batch) < batch_size:
        item = manifest[i]
        if item["path"] not in done:
            batch.append({"index": i, "path": item["path"], "size": item["size"], "args": get_args(i)})
        i += 1
    save_state({"index": i})
    print(json.dumps({"batch": batch, "next_index": i, "total": len(manifest)}, default=str))


def log_result(status: str, index: int, error: str = "") -> None:
    manifest = load_manifest()
    item = manifest[index]
    line = f"{status}\t{item['path']}\t{item['size']}\t{error}\n"
    with LOG.open("a") as f:
        f.write(line)
    print("logged", status, item["path"])


def summary() -> None:
    ok = fail = 0
    if LOG.exists():
        for line in LOG.read_text().splitlines():
            if line.startswith("OK\t"):
                ok += 1
            elif line.startswith("FAIL\t"):
                fail += 1
    total = len(load_manifest())
    out = f"OneDrive Upload Summary\nTotal items: {total}\nOK: {ok}\nFAIL: {fail}\nPending: {total - ok}\n"
    Path("/tmp/upload_final_summary.txt").write_text(out)
    print(out)


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "prepare":
        prepare()
    elif cmd == "next":
        bs = int(sys.argv[2]) if len(sys.argv) > 2 else 5
        next_batch(bs)
    elif cmd == "log":
        log_result(sys.argv[2], int(sys.argv[3]), sys.argv[4] if len(sys.argv) > 4 else "")
    elif cmd == "summary":
        summary()
    else:
        print(f"Unknown: {cmd}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
