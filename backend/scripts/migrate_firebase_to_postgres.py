#!/usr/bin/env python3
"""
Controlled Firebase -> PostgreSQL Migration CLI for Scribble-IT 2.0.

Usage:
  # Dry-run validation & reconciliation report (safe default; makes zero DB writes):
  python3 backend/scripts/migrate_firebase_to_postgres.py \
    --input firebase_export.json \
    --report-json migration_reconciliation.json \
    --report-md migration_reconciliation.md

  # Live transactional apply to PostgreSQL (after reviewing dry-run reconciliation report):
  python3 backend/scripts/migrate_firebase_to_postgres.py \
    --input firebase_export.json \
    --apply \
    --database-url "$MIGRATION_DATABASE_URL" \
    --report-json migration_reconciliation.json \
    --report-md migration_reconciliation.md
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Allow invoking script directly from repo root or backend/
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.migration.firebase_migrator import (  # noqa: E402
    FirebaseToPostgresMigrator,
    apply_plan_to_postgres,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate and migrate exported Firebase Auth/Firestore snapshots into Scribble-IT PostgreSQL."
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to exported Firebase/Firestore JSON snapshot.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute live transactional PostgreSQL upsert (default is safe --dry-run).",
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get("MIGRATION_DATABASE_URL", ""),
        help="PostgreSQL connection string (defaults to MIGRATION_DATABASE_URL env var).",
    )
    parser.add_argument(
        "--report-json",
        default="",
        help="Optional output file path for structured JSON reconciliation report.",
    )
    parser.add_argument(
        "--report-md",
        default="",
        help="Optional output file path for human-readable Markdown reconciliation report.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    if not input_path.is_file():
        print(f"ERROR: Snapshot file not found: {input_path}", file=sys.stderr)
        return 2

    with input_path.open("r", encoding="utf-8") as fh:
        snapshot = json.load(fh)

    migrator = FirebaseToPostgresMigrator()
    result = migrator.transform_snapshot(snapshot, dry_run=not args.apply)
    report_dict = result.to_reconciliation_dict()

    if not all(result.integrity_checks.values()):
        print("ERROR: One or more migration integrity checks failed. Aborting apply.", file=sys.stderr)
        print(json.dumps(report_dict, indent=2))
        return 1

    if args.apply:
        if not args.database_url:
            print("ERROR: --database-url or MIGRATION_DATABASE_URL is required with --apply.", file=sys.stderr)
            return 2
        inserted = apply_plan_to_postgres(result, args.database_url)
        report_dict["postgres_rows_inserted"] = inserted

    if args.report_json:
        Path(args.report_json).write_text(json.dumps(report_dict, indent=2), encoding="utf-8")
    if args.report_md:
        Path(args.report_md).write_text(result.to_markdown_report(), encoding="utf-8")

    print(result.to_markdown_report())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
