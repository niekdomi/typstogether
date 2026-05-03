"""Converts bun test --coverage text output to a Markdown table with a badge."""

import sys
from pathlib import Path

MIN_SUCCESS_PCT = 80
MIN_ACCEPTABLE_PCT = 50


def generate_report(input_path: str, output_path: str) -> None:
    text = Path(input_path).read_text(encoding="utf-8")

    in_table = False
    summary = None
    rows = []

    for line in text.splitlines():
        s = line.strip()
        if s.startswith("-") and "|" in s:
            in_table = True
            continue
        if not in_table or "|" not in s or ("File" in s and "% Funcs" in s):
            continue

        parts = [p.strip() for p in s.split("|")]
        if len(parts) < 3 or not parts[0]:
            continue

        filename, funcs, lines = parts[0], parts[1], parts[2]
        uncovered = parts[3] if len(parts) > 3 else ""

        try:
            lines_pct = float(lines)
        except ValueError:
            continue

        if filename == "All files":
            summary = (funcs, lines, lines_pct)
        else:
            rows.append((filename, funcs, lines, uncovered, lines_pct))

    if summary is None:
        print("Error: could not find 'All files' summary row.")
        sys.exit(1)

    af_funcs, af_lines, af_lines_pct = summary
    color = (
        "success"
        if af_lines_pct >= MIN_SUCCESS_PCT
        else ("yellow" if af_lines_pct >= MIN_ACCEPTABLE_PCT else "critical")
    )

    md = [
        f"![Code Coverage](https://img.shields.io/badge/Code%20Coverage-{af_lines_pct:.0f}%25-{color}?style=flat)",
        "",
        "| File | % Funcs | % Lines | Uncovered Lines | Status |",
        "|:---|---:|---:|:---|:---:|",
    ]

    for filename, funcs, lines, uncovered, lines_pct in sorted(rows):
        status = "✔" if lines_pct >= MIN_ACCEPTABLE_PCT else "❌"
        md.append(f"| `{filename}` | {funcs}% | {lines}% | {uncovered} | {status} |")

    summary_status = "✔" if af_lines_pct >= MIN_ACCEPTABLE_PCT else "❌"
    md.append(
        f"| **All files** | **{af_funcs}%** | **{af_lines}%** | | {summary_status} |"
    )

    Path(output_path).write_text("\n".join(md) + "\n", encoding="utf-8")


if __name__ == "__main__":
    input_path = sys.argv[1] if len(sys.argv) > 1 else "coverage.txt"
    output_path = sys.argv[2] if len(sys.argv) > 2 else "code-coverage-results.md"
    generate_report(input_path, output_path)
