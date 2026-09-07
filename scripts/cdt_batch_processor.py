#!/usr/bin/env python3
"""Process OneDrive uploads via CallDynamicTool batch helper.

Reads /tmp/upload_manifest.json and /tmp/upload_payload_NNN.json.
Prints AWAIT lines for agent CallDynamicTool invocations, or logs if --log used.

Usage:
  python3 cdt_batch_processor.py status
  python3 cdt_batch_processor.py next [batch_size]
  python3 cdt_batch_processor.py log <index> OK|FAIL [error]
  python3 cdt_batch_processor.py summary
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

MANIFEST = Path("/tmp/upload_manifest.json")
LOG = Path("/tmp/upload_progress.log")
PAYLOAD = Path("/tmp")
SUMMARY = Path("/tmp/upload_final_summary.txt")
STATE = Path("/tmp/cdt_batch_state.json")


def load_manifest() -> list[dict]:
    return json.loads(MANIFEST.read_text())


def done_paths() -> set[str]:
    if not LOG.exists():
        return set()
    return {l.split("\t")[1] for l in LOG.read_text().splitlines() if l.startswith("OK\t")}


def save_state(idx: int) -> None:
    STATE.write_text(json.dumps({"index": idx}))


def load_state() -> int:
    if STATE.exists():
        return json.loads(STATE.read_text()).get("index", 0)
    return 0


def log_result(index: int, status: str, error: str = "") -> None:
    manifest = load_manifest()
    item = manifest[index]
    line = f"{status}\t{item['path']}\t{item['size']}\t{error}\n"
    with LOG.open("a") as f:
        f.write(line)


def status() -> None:
    manifest = load_manifest()
    done = done_paths()
    ok = fail = 0
    if LOG.exists():
        for line in LOG.read_text().splitlines():
            if line.startswith("OK\t"):
                ok += 1
            elif line.startswith("FAIL\t"):
                fail += 1
    pending = [i for i, item in enumerate(manifest) if item["path"] not in done]
    print(json.dumps({
        "total": len(manifest),
        "ok": ok,
        "fail": fail,
        "pending_count": len(pending),
        "next_index": load_state(),
        "pending_sample": pending[:10],
    }, indent=2))


def next_batch(batch_size: int = 3) -> None:
    manifest = load_manifest()
    done = done_paths()
    start = load_state()
    batch = []
    i = start
    while i < len(manifest) and len(batch) < batch_size:
        item = manifest[i]
        if item["path"] not in done:
            args = json.loads((PAYLOAD / f"upload_payload_{i:03d}.json").read_text())
            batch.append({
                "index": i,
                "path": item["path"],
                "size": item["size"],
                "arguments": args,
            })
        i += 1
    save_state(i)
    print(json.dumps({"batch": batch, "next_index": i, "total": len(manifest)}, default=str))


def summary() -> None:
    manifest = load_manifest()
    ok = fail = 0
    if LOG.exists():
        for line in LOG.read_text().splitlines():
            if line.startswith("OK\t"):
                ok += 1
            elif line.startswith("FAIL\t"):
                fail += 1
    text = (
        f"OneDrive Upload Summary\n"
        f"Total items: {len(manifest)}\n"
        f"OK: {ok}\n"
        f"FAIL: {fail}\n"
        f"Pending: {len(manifest) - ok}\n"
    )
    SUMMARY.write_text(text)
    print(text)


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "status":
        status()
    elif cmd == "next":
        bs = int(sys.argv[2]) if len(sys.argv) > 2 else 3
        next_batch(bs)
    elif cmd == "log":
        log_result(int(sys.argv[2]), sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "")
        print("logged", sys.argv[3], sys.argv[2])
    elif cmd == "summary":
        summary()
    else:
        print(f"Unknown: {cmd}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
