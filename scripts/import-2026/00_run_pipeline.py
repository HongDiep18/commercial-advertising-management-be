#!/usr/bin/env python3
"""
End-to-end ETL pipeline runner.

Steps:
  01_parse.py      — parse docx → out/01_parsed.json
  02_enrich.py     — LLM flag enrichment → out/02_enriched.json
  03_merge.py      — merge + dedup → out/03_merged.json
  04_normalize.py  — normalize regions/countries → out/04_normalized.json

Usage:
  python3 scripts/00_run_pipeline.py               # full pipeline
  python3 scripts/00_run_pipeline.py --skip-enrich # skip LLM step (reuse existing 02_enriched.json)

Requirements:
  pip install openai python-dotenv
  OPENAI_API_KEY in .env or environment
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent

STEPS = [
    ("01  Parse docx",        "01_parse.py",     False),
    ("02  Enrich flags (LLM)", "02_enrich.py",   True),   # skippable
    ("03  Merge & dedup",     "03_merge.py",     False),
    ("04  Normalize",         "04_normalize.py", False),
]


def run_step(label: str, script: str) -> bool:
    print(f"\n{'─' * 60}")
    print(f"  {label}")
    print(f"{'─' * 60}")
    start = time.time()
    result = subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / script)],
        cwd=SCRIPTS_DIR.parent,
    )
    elapsed = time.time() - start
    if result.returncode != 0:
        print(f"\n✗ {label} failed (exit {result.returncode})")
        return False
    print(f"\n✓ done in {elapsed:.1f}s")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the company ETL pipeline.")
    parser.add_argument(
        "--skip-enrich",
        action="store_true",
        help="Skip the LLM enrichment step and reuse existing out/02_enriched.json",
    )
    args = parser.parse_args()

    # Ensure output directory exists
    (SCRIPTS_DIR / "out").mkdir(exist_ok=True)

    print("=" * 60)
    print("  COMPANY ETL PIPELINE")
    print("=" * 60)

    total_start = time.time()

    for label, script, skippable in STEPS:
        if skippable and args.skip_enrich:
            enriched = SCRIPTS_DIR / "out" / "02_enriched.json"
            if enriched.exists():
                print(f"\n  [skip] {label} — using existing {enriched.name}")
                continue
            else:
                print(f"\n  [warn] --skip-enrich set but {enriched.name} not found, running anyway")

        if not run_step(label, script):
            sys.exit(1)

    total = time.time() - total_start
    print(f"\n{'=' * 60}")
    print(f"  Pipeline complete in {total:.1f}s")
    print(f"  Output: scripts/import-2026/out/04_normalized.json")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()