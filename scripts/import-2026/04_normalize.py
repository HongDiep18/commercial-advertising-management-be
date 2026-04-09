#!/usr/bin/env python3
"""
Normalize 03_merged.json in place → writes 04_normalized.json.

Fixes:
  1. Near-duplicate region strings → canonical English names
  2. Companies with no region → infer from address
  3. CJK country values → ISO 3166-1 alpha-2 codes

Usage: python3 scripts/04_normalize.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path

OUT    = Path(__file__).parent / "out"
INPUT  = OUT / "03_merged.json"
OUTPUT = OUT / "04_normalized.json"
data = json.load(INPUT.open())

# ─── 1. Region → English ─────────────────────────────────────────────────────
# All CJK/Vietnamese variants map directly to English in one pass.

CANONICAL_REGION = {
    "胡志明市 – TP.HCM":      "Ho Chi Minh City",
    "胡志明市 – TP. HCM":     "Ho Chi Minh City",  # trailing space variant
    "同奈省 – TINH DONG NAI": "Dong Nai",
    "同奈省 – DONG NAI":      "Dong Nai",           # missing TINH variant
    "其他 – KHAC":            "Other",
    "西寧省 – TINH TAY NINH": "Tay Ninh",
    "河内市 – TP.HA NOI":     "Ha Noi",
    "河內市 – TP.HA NOI":     "Ha Noi",             # traditional char variant
    "林同省 – TINH LAM DONG": "Lam Dong",
}

fixed_canonical = 0

for c in data:
    r = c.get("region")
    if isinstance(r, list):
        new = [CANONICAL_REGION.get(x, x) for x in r]
        if new != r:
            c["region"] = new
            fixed_canonical += 1
    elif isinstance(r, str) and r in CANONICAL_REGION:
        c["region"] = CANONICAL_REGION[r]
        fixed_canonical += 1

# ─── 2. Infer region from address for no-region companies ────────────────────

def infer_region(c: dict) -> str | None:
    addrs = c.get("addresses", [])
    text  = " ".join(addrs).upper()
    if "TP.HCM" in text or "HCMC" in text or "HO CHI MINH" in text or "HỒ CHÍ MINH" in text:
        return "Ho Chi Minh City"
    if "TP.HA NOI" in text or "HA NOI" in text or "HANOI" in text or "HÀ NỘI" in text:
        return "Ha Noi"
    if "DONG NAI" in text or "TINH DONG NAI" in text:
        return "Dong Nai"
    if "TAY NINH" in text:
        return "Tay Ninh"
    if "LAM DONG" in text:
        return "Lam Dong"
    return None

fixed_inferred = 0

for c in data:
    if not c.get("region"):
        region = infer_region(c)
        if region:
            c["region"] = region
            fixed_inferred += 1

# ─── 3. CJK country → ISO 3166-1 alpha-2 ─────────────────────────────────────

COUNTRY_ISO = {
    "台灣":         "TW",
    "越南":         "VN",
    "中國":         "CN",
    "香港":         "HK",
    "新加坡":       "SG",
    "日本":         "JP",
    "馬來西亞":     "MY",
    "泰國":         "TH",
    "韓國":         "KR",
    "澳洲":         "AU",
    "法國":         "FR",
    "瑞典":         "SE",
    "瑞士":         "CH",
    "美國":         "US",
    "荷蘭":         "NL",
    "沙烏地阿拉伯": "SA",
}

fixed_country = 0
unknown_countries: dict[str, int] = defaultdict(int)
ISO_RE = re.compile(r"^[A-Z]{2}$")

for c in data:
    raw = c.get("country")
    if not raw:
        continue
    if ISO_RE.match(raw):
        continue  # already ISO, skip
    iso = COUNTRY_ISO.get(raw)
    if iso:
        c["country"] = iso
        fixed_country += 1
    else:
        unknown_countries[raw] += 1

# ─── 4. Fix taxId parsing artifacts (taxId + email concatenated) ─────────────
# e.g. "3603757691Email: superman@..." → taxId="3603757691", rescue the email

TAXID_EMAIL_RE = re.compile(r'^(\d{10}(?:-\d{3})?)\s*[Ee]mail?[l]?:\s*(.+)$')

fixed_taxid = 0
for c in data:
    raw = c.get("taxId") or ""
    m = TAXID_EMAIL_RE.match(raw.strip())
    if not m:
        continue
    c["taxId"] = m.group(1)
    email = m.group(2).strip().lower()
    existing = {x["value"].lower() for x in c.get("companyContacts", []) if x["type"] == "email"}
    if email not in existing:
        c.setdefault("companyContacts", []).append({"type": "email", "value": email})
    fixed_taxid += 1

# ─── 5. Fix values concatenated with '"' or space separator ─────────────────
# e.g. 'tvc@pebsteel.com.vn"lim@pebsteel.com.vn'    → two email entries
# e.g. 'https://www.messer.com.vn " victor.lim@...' → website + email

EMAIL_RE   = re.compile(r'^[^\@\s]+@[^\@\s]+\.[^\@\s]+$')
WEBSITE_RE = re.compile(r'^https?://')

for c in data:
    expanded = []
    for contact in c.get("companyContacts", []):
        val = contact["value"]
        ctype = contact["type"]

        if '"' in val or (ctype == "website" and "@" in val):
            parts = [p.strip() for p in re.split(r'["\s]+', val) if p.strip()]
            added = False
            for p in parts:
                if EMAIL_RE.match(p):
                    expanded.append({"type": "email", "value": p.lower()})
                    added = True
                elif WEBSITE_RE.match(p) or (ctype == "website" and "." in p and "@" not in p):
                    url = p if WEBSITE_RE.match(p) else "https://" + p
                    expanded.append({"type": "website", "value": url})
                    added = True
            if not added:
                expanded.append(contact)
        else:
            expanded.append(contact)
    # Deduplicate by (type, value) after splitting
    seen: set[tuple] = set()
    deduped_contacts = []
    for x in expanded:
        key = (x["type"], x["value"])
        if key not in seen:
            seen.add(key)
            deduped_contacts.append(x)
    c["companyContacts"] = deduped_contacts

# ─── 6. Normalize compound/variant contact types ─────────────────────────────
# Maps parser artifacts to canonical types.
# Compound types (e.g. Line/WeChat share same ID) → expand into both.

# Single-target mappings
TYPE_MAP = {
    "wechat_id":       "wechat",
    "fb":              "facebook",
}

# Compound → list of canonical types (same value copied to each)
TYPE_EXPAND = {
    "line_wechat":       ["line", "wechat"],
    "line_wechat_id":    ["line", "wechat"],
    "wechat_line_id":    ["wechat", "line"],
    "viber_line_wechat": ["viber", "line", "wechat"],
}

fixed_contact_types = 0

for c in data:
    new_contacts = []
    for contact in c.get("companyContacts", []):
        ctype = contact["type"]
        if ctype in TYPE_MAP:
            new_contacts.append({**contact, "type": TYPE_MAP[ctype]})
            fixed_contact_types += 1
        elif ctype in TYPE_EXPAND:
            for canonical in TYPE_EXPAND[ctype]:
                new_contacts.append({**contact, "type": canonical})
            fixed_contact_types += 1
        else:
            new_contacts.append(contact)
    # Drop contacts with empty value
    c["companyContacts"] = [x for x in new_contacts if x.get("value", "").strip()]

# ─── Output ───────────────────────────────────────────────────────────────────

OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2))

# Final clean version — drop internal fields not needed for DB import
FINAL = OUT / "05_companies.json"
DROP_FIELDS = {"_flags", "_raw", "industry"}  # industry superseded by industries[]
clean = [{k: v for k, v in c.items() if k not in DROP_FIELDS} for c in data]
FINAL.write_text(json.dumps(clean, ensure_ascii=False, indent=2))
print(f"\nFinal output : {FINAL}  ({len(clean)} companies)")

print(f"Canonical region fixes : {fixed_canonical}")
print(f"Inferred regions       : {fixed_inferred}")
print(f"Country → ISO fixes    : {fixed_country}")
print(f"TaxId artifact fixes   : {fixed_taxid}")
print(f"Contact type fixes     : {fixed_contact_types}")

if unknown_countries:
    print("\nUnrecognized country values (not mapped):")
    for val, count in sorted(unknown_countries.items(), key=lambda x: -x[1]):
        print(f"  {count:>4}  {repr(val)}")

# Region distribution
region_counts: dict[str, int] = defaultdict(int)
for c in data:
    r = c.get("region")
    if isinstance(r, list):
        for x in r: region_counts[x] += 1
    else:
        region_counts[r or "(none)"] += 1

print("\nRegion distribution:")
for region, count in sorted(region_counts.items(), key=lambda x: -x[1]):
    print(f"  {count:>4}  {region}")

# Country distribution
country_counts: dict[str, int] = defaultdict(int)
for c in data:
    country_counts[c.get("country") or "(none)"] += 1

print("\nCountry distribution (ISO):")
for country, count in sorted(country_counts.items(), key=lambda x: -x[1]):
    print(f"  {count:>4}  {country}")
