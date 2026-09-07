#!/usr/bin/env python3
"""Load OneDrive upload args from JSON and print metadata for CallDynamicTool.

The agent MUST call CallDynamicTool(Onedrive, create_or_update_file, json.load(open(args_file)))
with the FULL arguments object — never placeholder strings.

Usage:
  python3 cdt_run_upload.py [args.json]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/cdt9_cdt_args_only.json")
    args = json.loads(path.read_text())
    content = args.get("content", "")
    meta = {
        "args_file": str(path),
        "keys": list(args.keys()),
        "path": args.get("path", ""),
        "itemId": args.get("itemId", ""),
        "content_chars": len(content),
        "content_bytes": len(content.encode("utf-8")) if content else 0,
        "end_marker_ok": content.endswith("Bob Duncan: Yeah, They're not looking.") if content else None,
        "instruction": "CallDynamicTool(Onedrive, create_or_update_file, json.load(open(args_file)))",
    }
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
