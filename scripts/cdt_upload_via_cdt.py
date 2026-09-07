#!/usr/bin/env python3
"""Emit create_or_update_file args JSON for agent CallDynamicTool (stdout).

Usage:
  python3 cdt_upload_via_cdt.py <index> [--item-id ID]
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
from pathlib import Path

BATCH = Path("/tmp/upload_batch")
EXEC = Path("/workspace/scripts/cdt_upload_exec.py")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("index", type=int)
    p.add_argument("--item-id", default="")
    args = p.parse_args()
    import subprocess

    cmd = ["python3", str(EXEC), str(args.index)]
    if args.item_id:
        cmd.extend(["--item-id", args.item_id])
    subprocess.check_call(cmd)
    payload = json.loads(Path("/tmp/cdt_exec_args.json").read_text())
    json.dump(payload, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
