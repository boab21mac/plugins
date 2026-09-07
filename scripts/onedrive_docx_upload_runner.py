#!/usr/bin/env python3
"""Prepare OneDrive upload args for cloud-agent CallDynamicTool invocations.

Large docx (>~26KB base64) exceed agent output token limits when inlined.
Use:
  - docx mode: base64Content for b64_len <= MAX_B64 (default 26000)
  - prog mode: progressive HTML .doc content steps for larger files

Usage:
  python3 onedrive_docx_upload_runner.py status
  python3 onedrive_docx_upload_runner.py next [--mode auto|docx|prog]
  python3 onedrive_docx_upload_runner.py log NAME SIZE PARENT_ID
  python3 onedrive_docx_upload_runner.py prepare-prog DOCX_NAME STEP
"""
from __future__ import annotations

import argparse
import glob
import json
import sys
from pathlib import Path

QUEUE = Path("/tmp/upload_b64/queue.json")
LOG = Path("/tmp/docx_uploads/word_upload_log.txt")
ARGS_DIR = Path("/tmp/docx_uploads/args_all")
OUT = Path("/tmp/docx_uploads/cdt_next.json")
PROG_PLAN = Path("/tmp/prog_word_html/plan.json")
CORRECT_PARENT = "01PMLPHD53IYBUCSJKRRBYK34GSVJA3XN7"
MAX_B64 = 26000
KNOWN_ITEM_IDS = {
    "Claire Black - Full Pack Part 1.docx": "01PMLPHD7UIHL3UWZCLZAJIRMMHF4L3C66",
    "Claire Black - Full Notes and Transcripts.docx": "01PMLPHD7TPUNP2GQULRE3WFMWZBEPSH36",
}


def done_names() -> set[str]:
    names: set[str] = set()
    if LOG.exists():
        for line in LOG.read_text().splitlines():
            if "\tcorrect" in line:
                parts = line.split("\t")
                if len(parts) >= 2:
                    names.add(parts[1])
    return names


def args_file_for(name: str) -> Path | None:
    for f in ARGS_DIR.iterdir():
        if name in f.name:
            return f
    return None


def pending() -> list[dict]:
    queue = json.loads(QUEUE.read_text())
    done = done_names()
    return [x for x in queue if x["name"] not in done]


def prog_steps(docx_name: str) -> list[dict]:
    plan = json.loads(PROG_PLAN.read_text())
    out: list[dict] = []
    for item in plan:
        if item["filename"].replace(".doc", ".docx") != docx_name:
            continue
        outdir = item["outdir"]
        for i, f in enumerate(sorted(glob.glob(f"{outdir}/step_*.doc"))):
            content = Path(f).read_text(encoding="utf-8", errors="replace")
            out.append(
                {
                    "step": i,
                    "path": f"adviser reviews/{item['filename']}",
                    "content": content,
                    "bytes": len(content.encode("utf-8")),
                    "final": i == len(glob.glob(f"{outdir}/step_*.doc")) - 1,
                }
            )
    return out


def cmd_status() -> None:
    p = pending()
    print(
        json.dumps(
            {
                "done": len(done_names()),
                "pending": len(p),
                "correct_parent": CORRECT_PARENT,
                "max_b64": MAX_B64,
            },
            indent=2,
        )
    )


def cmd_next(mode: str) -> None:
    items = pending()
    if not items:
        print(json.dumps({"done": True}))
        return
    item = items[0]
    af = args_file_for(item["name"])
    if not af:
        print(json.dumps({"error": f"no args for {item['name']}"}))
        sys.exit(1)
    args = json.loads(af.read_text())
    b64_len = len(args.get("base64Content", ""))
    use_docx = mode == "docx" or (mode == "auto" and b64_len <= MAX_B64)
    if use_docx:
        if item["name"] in KNOWN_ITEM_IDS:
            payload = {
                "itemId": KNOWN_ITEM_IDS[item["name"]],
                "base64Content": args["base64Content"],
                "contentType": args["contentType"],
            }
            upload_mode = "itemId+docx"
        else:
            payload = {
                "path": args["path"],
                "base64Content": args["base64Content"],
                "contentType": args["contentType"],
            }
            upload_mode = "path+docx"
        OUT.write_text(json.dumps(payload))
        print(
            json.dumps(
                {
                    "name": item["name"],
                    "size": item["size"],
                    "upload_mode": upload_mode,
                    "b64_len": b64_len,
                    "args_file": str(OUT),
                    "instruction": "CallDynamicTool(Onedrive, create_or_update_file, json.load(open(args_file)))",
                },
                indent=2,
            )
        )
        return
    steps = prog_steps(item["name"])
    if not steps:
        print(json.dumps({"error": f"no prog steps for {item['name']}"}))
        sys.exit(1)
    step = steps[0]
    payload = {"path": step["path"], "content": step["content"]}
    OUT.write_text(json.dumps(payload, ensure_ascii=False))
    print(
        json.dumps(
            {
                "name": item["name"],
                "size": item["size"],
                "upload_mode": "prog_doc",
                "prog_step": step["step"],
                "prog_steps_total": len(steps),
                "content_bytes": step["bytes"],
                "path": step["path"],
                "args_file": str(OUT),
                "instruction": "CallDynamicTool(Onedrive, create_or_update_file, json.load(open(args_file)))",
            },
            indent=2,
        )
    )


def cmd_prepare_prog(docx_name: str, step: int) -> None:
    steps = prog_steps(docx_name)
    if step >= len(steps):
        print(json.dumps({"error": "step out of range", "total": len(steps)}))
        sys.exit(1)
    s = steps[step]
    payload = {"path": s["path"], "content": s["content"]}
    OUT.write_text(json.dumps(payload, ensure_ascii=False))
    print(json.dumps({"docx_name": docx_name, "step": step, "bytes": s["bytes"], "args_file": str(OUT)}, indent=2))


def cmd_log(name: str, size: int, parent_id: str) -> None:
    status = "correct" if parent_id == CORRECT_PARENT else f"wrong_parent:{parent_id}"
    with LOG.open("a") as f:
        f.write(f"OK\t{name}\t{size}\t{status}\n")
    print(json.dumps({"logged": name, "status": status}))


def main() -> None:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    n = sub.add_parser("next")
    n.add_argument("--mode", default="auto", choices=["auto", "docx", "prog"])
    lg = sub.add_parser("log")
    lg.add_argument("name")
    lg.add_argument("size", type=int)
    lg.add_argument("parent_id")
    pp = sub.add_parser("prepare-prog")
    pp.add_argument("docx_name")
    pp.add_argument("step", type=int)
    args = p.parse_args()
    if args.cmd == "status":
        cmd_status()
    elif args.cmd == "next":
        cmd_next(args.mode)
    elif args.cmd == "log":
        cmd_log(args.name, args.size, args.parent_id)
    elif args.cmd == "prepare-prog":
        cmd_prepare_prog(args.docx_name, args.step)


if __name__ == "__main__":
    main()
