#!/usr/bin/env python3
"""Automated prog20k OneDrive upload loop using CallDynamicTool (agent must invoke).

Prepares each batch index, records results, tracks progress.

Usage:
  python3 cdt_prog20k_upload_loop.py status
  python3 cdt_prog20k_upload_loop.py next          # prepare /tmp/cdt_invoke_args.json
  python3 cdt_prog20k_upload_loop.py ok <idx> <size>
  python3 cdt_prog20k_upload_loop.py fail <path> <err>
  python3 cdt_prog20k_upload_loop.py finalize
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

HELPER = Path("/tmp/cdt_batch_upload_helper.py")
INVOKE = Path("/tmp/cdt_invoke_args.json")
LOG = Path("/tmp/all_upload.log")
DONE = Path("/tmp/all_upload_done.txt")
STATE = Path("/tmp/upload_cursor_state.json")


def run_helper(*args: str) -> dict:
    out = subprocess.check_output(["python3", str(HELPER), *args], text=True)
    return json.loads(out)


def status() -> None:
    st = run_helper("status")
    pending = []
    if STATE.exists():
        done = set(json.loads(STATE.read_text()).get("done", []))
        batch = sorted(Path("/tmp/upload_batch").glob("[0-9][0-9][0-9].json"))
        pending = [int(p.stem) for p in batch if int(p.stem) not in done]
    print(json.dumps({**st, "pending_head": pending[:10]}, indent=2))


def next_upload() -> None:
    st = run_helper("status")
    idx = st["next"]
    if idx >= st["total"]:
        print(json.dumps({"done": True, "total": st["total"]}))
        return
    meta = run_helper("prepare", str(idx))
    args = json.loads((Path("/tmp/upload_batch") / f"{idx:03d}.json").read_text())
    INVOKE.write_text(json.dumps({"path": args["path"], "content": args["content"]}, ensure_ascii=False))
    print(json.dumps({**meta, "invoke_args": str(INVOKE), "ready": True}, indent=2))


def record_ok(idx: int, size: int) -> None:
    print(json.dumps(run_helper("ok", str(idx), str(size))))


def record_fail(path: str, err: str) -> None:
    with LOG.open("a") as f:
        f.write(f"FAIL\t{path}\t{err}\n")
    print(json.dumps({"recorded": "FAIL", "path": path}))


def finalize() -> None:
    ok_lines = [l for l in LOG.read_text().splitlines() if l.startswith("OK\t")] if LOG.exists() else []
    count = 0
    for line in ok_lines:
        parts = line.split("\t")
        if len(parts) >= 4 and "Full Pack Part" in parts[1] and parts[1].endswith(".md"):
            try:
                if int(parts[3]) > 15000:
                    count += 1
            except ValueError:
                pass
    DONE.write_text(str(count) + "\n")
    print(json.dumps({"full_pack_md_over_15k": count, "ok_lines": len(ok_lines)}))


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "status":
        status()
    elif cmd == "next":
        next_upload()
    elif cmd == "ok":
        record_ok(int(sys.argv[2]), int(sys.argv[3]))
    elif cmd == "fail":
        record_fail(sys.argv[2], sys.argv[3])
    elif cmd == "finalize":
        finalize()
    else:
        sys.exit(f"Unknown: {cmd}")


if __name__ == "__main__":
    main()
