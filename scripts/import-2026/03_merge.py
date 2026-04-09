#!/usr/bin/env python3
"""
Merge multi-sector companies and deduplicate identical entries.

Rules:
  1. Group by taxId (primary) or companyNameZh (fallback) → merge into one
     record with industries[] array, combining all contacts/addresses
  2. After merge, deduplicate remaining entries that share the same
     companyNameZh AND at least one email → keep first, drop rest

Input:  scripts/out/02_enriched.json
Output: scripts/out/03_merged.json

Usage: python3 scripts/03_merge.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path

OUT    = Path(__file__).parent / "out"
INPUT  = OUT / "02_enriched.json"
OUTPUT = OUT / "03_merged.json"

data = json.load(open(INPUT))
print(f"Input: {len(data)} companies")

# ─── Helpers ──────────────────────────────────────────────────────────────────

def merge_contacts(lists: list[list[dict]]) -> list[dict]:
    """Combine companyContacts lists, deduplicate by (type, normalized-value).
    Emails are lowercased so Ken-chang@... and ken-chang@... collapse to one.
    """
    seen = set()
    result = []
    for lst in lists:
        for item in lst:
            val = item["value"].lower() if item["type"] == "email" else item["value"]
            key = (item["type"], val)
            if key not in seen:
                seen.add(key)
                result.append({**item, "value": val} if item["type"] == "email" else item)
    return result


def merge_user_contacts(lists: list[list[dict]]) -> list[dict]:
    """Combine userContacts lists, deduplicate by (name, phone)."""
    seen = set()
    result = []
    for lst in lists:
        for item in lst:
            key = (item.get("name"), item.get("phone"))
            if key not in seen:
                seen.add(key)
                result.append(item)
    return result


def merge_addresses(lists: list[list[str]]) -> list[str]:
    seen_lower: set[str] = set()
    result = []
    for lst in lists:
        for addr in lst:
            key = addr.lower()
            if key not in seen_lower:
                seen_lower.add(key)
                result.append(addr)
    return result


def merge_raw(raws: list[dict]) -> dict:
    """Concatenate _raw blocks."""
    return {
        "names":       "\n---\n".join(r.get("names", "")       for r in raws if r),
        "contacts":    "\n---\n".join(r.get("contacts", "")    for r in raws if r),
        "details":     "\n---\n".join(r.get("details", "")     for r in raws if r),
        "description": "\n---\n".join(r.get("description", "") for r in raws if r),
    }


def merge_group(entries: list[dict]) -> dict:
    """Merge a group of entries (same company, multiple industries) into one."""
    base = entries[0].copy()

    # Collect all industries (deduplicated, preserve order)
    industries = []
    seen_ind = set()
    for e in entries:
        ind = e.get("industry")
        if ind and ind not in seen_ind:
            seen_ind.add(ind)
            industries.append(ind)

    base["industries"]      = industries
    base["industry"]        = industries[0] if len(industries) == 1 else None  # keep for single
    base["companyContacts"] = merge_contacts([e.get("companyContacts", []) for e in entries])
    base["userContacts"]    = merge_user_contacts([e.get("userContacts", []) for e in entries])
    base["addresses"]       = merge_addresses([e.get("addresses", []) for e in entries])
    base["_raw"]            = merge_raw([e.get("_raw", {}) for e in entries])
    base["_flags"]          = list({f for e in entries for f in e.get("_flags", [])})

    # Fill nulls from other entries
    for field in ("companyNameZh", "companyNameVi", "companyNameEn", "country", "taxId", "description", "region"):
        if not base.get(field):
            for e in entries[1:]:
                if e.get(field):
                    base[field] = e[field]
                    break

    return base


# ─── Step 1: Group and merge by taxId / companyNameZh ─────────────────────────

groups: dict[str, list[dict]] = defaultdict(list)
no_key: list[dict] = []

for c in data:
    tax_id  = c.get("taxId")
    name_cn = c.get("companyNameZh")
    key = f"taxid:{tax_id}" if tax_id else (f"name:{name_cn}" if name_cn else None)
    if key:
        groups[key].append(c)
    else:
        no_key.append(c)

merged: list[dict] = []
merge_count = 0

for key, entries in groups.items():
    if len(entries) == 1:
        c = entries[0].copy()
        c["industries"] = [c["industry"]] if c.get("industry") else []
        c["companyContacts"] = merge_contacts([c.get("companyContacts", [])])  # dedup within single record
        merged.append(c)
    else:
        merged.append(merge_group(entries))
        merge_count += len(entries) - 1  # how many were collapsed

# Add entries with no key as-is
for c in no_key:
    c = c.copy()
    c["industries"] = [c["industry"]] if c.get("industry") else []
    c["companyContacts"] = merge_contacts([c.get("companyContacts", [])])  # dedup within single record
    merged.append(c)

print(f"After merge: {len(merged)} companies ({merge_count} entries collapsed)")

# ─── Step 2: Deduplicate by companyNameZh + shared email ──────────────────────
# Same name + same email = same company (possibly different branches)
# → merge their addresses/regions/contacts rather than drop

def get_emails(c: dict) -> set[str]:
    return {x["value"].lower() for x in c.get("companyContacts", []) if x["type"] == "email"}


# Group again by (companyNameZh, frozenset of emails)
dup_groups: dict[str, list[dict]] = defaultdict(list)
no_email_entries: list[dict] = []

for c in merged:
    name_cn = c.get("companyNameZh")
    emails  = get_emails(c)
    if name_cn and emails:
        key = f"{name_cn}||{','.join(sorted(emails))}"
        dup_groups[key].append(c)
    else:
        no_email_entries.append(c)

deduped: list[dict] = []
dup_count = 0

for key, entries in dup_groups.items():
    if len(entries) == 1:
        deduped.append(entries[0])
    else:
        # Merge branches: combine addresses, userContacts, companyContacts, regions
        dup_count += len(entries) - 1
        base = entries[0].copy()
        base["addresses"]       = merge_addresses([e.get("addresses", []) for e in entries])
        base["companyContacts"] = merge_contacts([e.get("companyContacts", []) for e in entries])
        base["userContacts"]    = merge_user_contacts([e.get("userContacts", []) for e in entries])
        # Collect all regions as a list
        regions = list(dict.fromkeys(
            e.get("region") for e in entries if e.get("region")
        ))
        base["region"] = regions[0] if len(regions) == 1 else regions
        base["_flags"] = list({f for e in entries for f in e.get("_flags", [])})
        deduped.append(base)

deduped.extend(no_email_entries)

print(f"After dedup:  {len(deduped)} companies ({dup_count} branch entries merged)")

# ─── Step 3: Dedup by companyNameEn + shared phone (catches no-email, typo-CJK-name cases) ───
# e.g. same English name + same phone but CJK name has a typo → merge industries

def get_phones(c: dict) -> set[str]:
    return {
        re.sub(r"[\s\-\.]", "", x["value"])
        for x in c.get("companyContacts", [])
        if x["type"] in ("tel", "hotline") and x.get("value")
    }

en_phone_groups: dict[str, list[dict]] = defaultdict(list)
no_en_entries: list[dict] = []

for c in deduped:
    name_en = (c.get("companyNameEn") or "").strip().upper()
    phones  = get_phones(c)
    if name_en and phones:
        key = f"{name_en}||{','.join(sorted(phones))}"
        en_phone_groups[key].append(c)
    else:
        no_en_entries.append(c)

deduped2: list[dict] = []
en_dup_count = 0

for key, entries in en_phone_groups.items():
    if len(entries) == 1:
        deduped2.append(entries[0])
    else:
        en_dup_count += len(entries) - 1
        base = entries[0].copy()
        base["industries"]      = list(dict.fromkeys(i for e in entries for i in e.get("industries", [])))
        base["addresses"]       = merge_addresses([e.get("addresses", []) for e in entries])
        base["companyContacts"] = merge_contacts([e.get("companyContacts", []) for e in entries])
        base["userContacts"]    = merge_user_contacts([e.get("userContacts", []) for e in entries])
        base["_flags"]          = list({f for e in entries for f in e.get("_flags", [])})
        # Fill nulls (e.g. taxId, companyNameZh) from other entries
        for field in ("taxId", "companyNameZh", "companyNameVi", "country", "region"):
            if not base.get(field):
                for e in entries[1:]:
                    if e.get(field):
                        base[field] = e[field]
                        break
        deduped2.append(base)

deduped2.extend(no_en_entries)

print(f"After en+phone dedup: {len(deduped2)} companies ({en_dup_count} entries merged)")
deduped = deduped2

# ─── Output ───────────────────────────────────────────────────────────────────

OUTPUT.write_text(json.dumps(deduped, ensure_ascii=False, indent=2))
print(f"\nOutput: {OUTPUT}")

# Summary
with_multi_industry = sum(1 for c in deduped if len(c.get("industries", [])) > 1)
print(f"\nStats:")
print(f"  Multi-industry companies: {with_multi_industry}")
print(f"  Single-industry:          {len(deduped) - with_multi_industry}")

industry_counts: dict[str, int] = {}
for c in deduped:
    for ind in c.get("industries", []):
        industry_counts[ind] = industry_counts.get(ind, 0) + 1
print(f"\nBy industry (after merge, counts overlap for multi-sector):")
for ind, count in sorted(industry_counts.items(), key=lambda x: -x[1]):
    print(f"  {ind:<15} {count}")
