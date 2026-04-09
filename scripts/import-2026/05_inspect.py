#!/usr/bin/env python3
"""
Inspect out/04_normalized.json — data quality, distributions, suspicious values.

Sections:
  1. Completeness
  2. No email (can't create login)
  3. No tax ID
  4. Remaining flags
  5. Industry distribution
  6. Country distribution (ISO)
  7. Region distribution
  8. Suspicious country values (non-ISO)

Usage: python3 scripts/05_inspect.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path

INPUT = Path(__file__).parent / "out" / "04_normalized.json"
data  = json.load(INPUT.open())
total = len(data)

print(f"Total companies: {total}\n")

SEP = "=" * 60

def display_name(c: dict) -> str:
    return c.get("companyNameVi") or c.get("companyNameEn") or c.get("companyNameZh") or "Unknown"

def pct(n: int) -> str:
    return f"{n}/{total} ({n*100//total}%)"

def has_type(c: dict, t: str) -> bool:
    return any(x["type"] == t for x in c.get("companyContacts", []))


# ─── 1. Completeness ──────────────────────────────────────────────────────────

print(SEP)
print("COMPLETENESS")
print(SEP)

checks = [
    ("Has email",         lambda c: has_type(c, "email")),
    ("Has tel",           lambda c: has_type(c, "tel") or has_type(c, "hotline")),
    ("Has website",       lambda c: has_type(c, "website")),
    ("Has tax ID",        lambda c: bool(c.get("taxId"))),
    ("Has address",       lambda c: bool(c.get("addresses"))),
    ("Has country",       lambda c: bool(c.get("country"))),
    ("Has region",        lambda c: bool(c.get("region"))),
    ("Has companyNameZh", lambda c: bool(c.get("companyNameZh"))),
    ("Has companyNameVi", lambda c: bool(c.get("companyNameVi"))),
    ("Has companyNameEn", lambda c: bool(c.get("companyNameEn"))),
    ("Has userContacts",  lambda c: bool(c.get("userContacts"))),
    ("Multi-industry",    lambda c: len(c.get("industries", [])) > 1),
]

for label, fn in checks:
    count = sum(1 for c in data if fn(c))
    print(f"  {label:<22} {pct(count)}")


# ─── 2. No email ──────────────────────────────────────────────────────────────

no_email = [c for c in data if not has_type(c, "email")]
print(f"\n{SEP}")
print(f"NO EMAIL — cannot create login: {len(no_email)}")
print(SEP)
for c in no_email[:15]:
    tels = [x["value"] for x in c.get("companyContacts", []) if x["type"] == "tel"]
    print(f"  {display_name(c)}")
    print(f"    taxId: {c.get('taxId') or '-'} | tel: {tels[:1] or '-'}")
if len(no_email) > 15:
    print(f"  ... and {len(no_email) - 15} more")


# ─── 3. No tax ID ─────────────────────────────────────────────────────────────

no_taxid = [c for c in data if not c.get("taxId")]
print(f"\n{SEP}")
print(f"NO TAX ID: {len(no_taxid)}")
print(SEP)
for c in no_taxid[:10]:
    emails = [x["value"] for x in c.get("companyContacts", []) if x["type"] == "email"]
    print(f"  {display_name(c)}")
    print(f"    email: {emails[:1] or '-'} | industries: {c.get('industries')}")
if len(no_taxid) > 10:
    print(f"  ... and {len(no_taxid) - 10} more")


# ─── 4. Remaining flags ───────────────────────────────────────────────────────

flagged = [c for c in data if c.get("_flags")]
print(f"\n{SEP}")
print(f"REMAINING FLAGS: {len(flagged)}")
print(SEP)
for c in flagged:
    print(f"  {display_name(c)}")
    for f in c["_flags"]:
        print(f"    → {f}")


# ─── 5. Industry distribution ─────────────────────────────────────────────────

print(f"\n{SEP}")
print("INDUSTRY DISTRIBUTION")
print(SEP)
ind_counts: dict[str, int] = defaultdict(int)
for c in data:
    for ind in c.get("industries", []):
        ind_counts[ind] += 1
max_count = max(ind_counts.values(), default=1)
for ind, count in sorted(ind_counts.items(), key=lambda x: -x[1]):
    bar = "█" * (count * 30 // max_count)
    print(f"  {ind:<15} {count:>4}  {bar}")


# ─── 6. Country distribution ──────────────────────────────────────────────────

print(f"\n{SEP}")
print("COUNTRY DISTRIBUTION (ISO)")
print(SEP)
country_counts: dict[str, int] = defaultdict(int)
for c in data:
    country_counts[c.get("country") or "(none)"] += 1
for country, count in sorted(country_counts.items(), key=lambda x: -x[1]):
    print(f"  {country:<8} {count:>5}  {count/total*100:.1f}%")


# ─── 7. Region distribution ───────────────────────────────────────────────────

print(f"\n{SEP}")
print("REGION DISTRIBUTION")
print(SEP)
region_counts: dict[str, int] = defaultdict(int)
for c in data:
    region_counts[c.get("region") or "(none)"] += 1
for region, count in sorted(region_counts.items(), key=lambda x: -x[1]):
    print(f"  {count:>5}  {region}")


# ─── 8. Suspicious country values ────────────────────────────────────────────

ISO_RE = re.compile(r"^[A-Z]{2}$")
suspicious = [c for c in data if c.get("country") and not ISO_RE.match(c["country"])]
print(f"\n{SEP}")
print(f"SUSPICIOUS COUNTRY VALUES (not ISO): {len(suspicious)}")
print(SEP)
for c in suspicious:
    raw = c.get("_raw") or {}
    raw_names = (raw.get("names", "") if isinstance(raw, dict) else "").replace("\n", " | ")
    print(f"  {display_name(c)}")
    print(f"    country: {repr(c['country'])} | raw: {raw_names[:80]}")
