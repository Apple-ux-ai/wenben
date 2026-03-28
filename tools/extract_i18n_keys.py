#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, Iterable, List, Set, Tuple


T_CALL_RE = re.compile(
    r"""\bt\s*\(\s*(?P<q>["'])(?P<s>(?:\\.|(?!\1).)*?)\1\s*(?:,\s*\{[\s\S]*?\}\s*)?\)""",
    re.MULTILINE,
)

T_TEMPLATE_RE = re.compile(
    r"""\bt\s*\(\s*`(?P<s>(?:\\.|[^`])*?)`\s*(?:,\s*\{[\s\S]*?\}\s*)?\)""",
    re.MULTILINE,
)


def iter_source_files(root: Path, exts: Tuple[str, ...]) -> Iterable[Path]:
    for ext in exts:
        yield from root.rglob(f"*{ext}")


def has_interpolation(template: str) -> bool:
    return "${" in template


def unescape_js_string(s: str) -> str:
    return (
        s.replace("\\n", "\n")
        .replace("\\r", "\r")
        .replace("\\t", "\t")
        .replace('\\"', '"')
        .replace("\\'", "'")
        .replace("\\\\", "\\")
    )


def extract_keys_from_text(text: str) -> Set[str]:
    keys: Set[str] = set()
    for m in T_CALL_RE.finditer(text):
        raw = m.group("s")
        keys.add(unescape_js_string(raw))

    for m in T_TEMPLATE_RE.finditer(text):
        raw = m.group("s")
        if has_interpolation(raw):
            continue
        keys.add(unescape_js_string(raw))
    return keys


def build_locale_map(keys: Iterable[str]) -> Dict[str, str]:
    data: Dict[str, str] = {}
    for k in keys:
        k = k.strip()
        if not k:
            continue
        data[k] = k
    return data


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", required=True, help="Source root to scan (e.g. src/renderer)")
    parser.add_argument("--out", required=True, help="Output zh_CN.json path")
    args = parser.parse_args()

    src_root = Path(args.src).resolve()
    out_path = Path(args.out).resolve()

    exts = (".ts", ".tsx", ".js", ".jsx")
    keys: Set[str] = set()

    for file_path in iter_source_files(src_root, exts):
        try:
            text = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = file_path.read_text(encoding="utf-8-sig")
        keys |= extract_keys_from_text(text)

    locale_map = build_locale_map(sorted(keys))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(locale_map, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

