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
from uuid import UUID, uuid5

OUT    = Path(__file__).parent / "out"
INPUT  = OUT / "03_merged.json"
OUTPUT = OUT / "04_normalized.json"
data = json.load(INPUT.open())

COMPANY_ID_NAMESPACE = UUID("fdb6602d-1ac7-45d9-89c0-fc5365fe7d91")

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

# ─── 3b. Promote companyNameEn → companyNameVi for VN-only companies ──────────
# When a VN-country company has no CJK name and no Vi name, its Latin-script name
# is its registered Vietnamese name — BUT only when it contains a Vietnamese legal
# entity suffix (CO.,LTD, JOINT STOCK, CORP, etc.).
# Names ending in ASSOCIATION / COMMITTEE / UNION etc. are English translations of
# organizations that have separate proper Vietnamese names → leave in companyNameEn.

VN_ENTITY_SUFFIX_RE = re.compile(
    r"\b(CO\.?,?\s*LTD\.?|COMPANY\s+LIMITED|JOINT[\s-]+STOCK|CORPORATION|CORP\.?|"
    r"INCORPORATED|INC\.?|JSC|LLC|SHAREHOLDING|ONE\s+MEMBER|TRADING|"
    r"MANUFACTURING|PRODUCTION|IMPORT[\s-]+EXPORT|TECHNOLOGY|TECHNOLOGIES|"
    r"INVESTMENT|CONSTRUCTION|SERVICES?|SOLUTIONS?|LOGISTICS|INTERNATIONAL)\b",
    re.IGNORECASE,
)

fixed_en_to_vi = 0
for c in data:
    en = c.get("companyNameEn") or ""
    if (
        c.get("country") == "VN"
        and not c.get("companyNameZh")
        and not c.get("companyNameVi")
        and en
        and VN_ENTITY_SUFFIX_RE.search(en)
    ):
        c["companyNameVi"] = c.pop("companyNameEn")
        fixed_en_to_vi += 1

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

# ─── 5. Strip office-location suffixes from company name fields ──────────────
# Source doc appends "- VPDD TAI HCM", "- CHI NHANH TPHCM" etc. to legal names.
# VPDD = Văn Phòng Đại Diện (Representative Office) — not part of the legal name.

OFFICE_SUFFIX_RE = re.compile(
    # Dash-separated: "CO.,LTD - VPDD TAI HCM", "CO.,LTD - CHI NHANH TPHCM"
    r"\s*[-–—]\s*(?:VPDD|VP\b|CHI\s+NHANH|VAN\s+PHONG)\b.*$"
    # Space-only VPDD: "CORPORATION VPDD TAI HCM" — only mid-string (lookbehind guards start)
    r"|(?<=\S)\s+VPDD\b.*$",
    re.IGNORECASE,
)

fixed_office_suffix = 0
for c in data:
    for field in ("companyNameZh", "companyNameVi", "companyNameEn"):
        val = c.get(field)
        if val and OFFICE_SUFFIX_RE.search(val):
            c[field] = OFFICE_SUFFIX_RE.sub("", val).strip()
            fixed_office_suffix += 1

# ─── 6. Merge split address lines (continuation: previous line ends with comma) ─
# Source doc sometimes wraps a single address across two lines, e.g.:
#   "396 Zhongshan Rd, Qingshui Dist,"  +  "Taichung City, 43642 Taiwan R.O.C."
# → "396 Zhongshan Rd, Qingshui Dist, Taichung City, 43642 Taiwan R.O.C."

fixed_split_addr = 0
for c in data:
    addrs = c.get("addresses", [])
    if len(addrs) < 2:
        continue
    merged: list[str] = []
    i = 0
    while i < len(addrs):
        cur = addrs[i]
        if cur.rstrip().endswith(",") and i + 1 < len(addrs):
            joined = cur.rstrip() + " " + addrs[i + 1].lstrip()
            merged.append(joined)
            fixed_split_addr += 1
            i += 2
        else:
            merged.append(cur)
            i += 1
    c["addresses"] = merged

# ─── 7. Fix values concatenated with '"' or space separator ─────────────────
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

# ─── 8. Normalize compound/variant contact types ─────────────────────────────
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


# ─── 9. Rescue hotline labels stranded in userContacts ───────────────────────
# Catches any remaining cases where a hotline label+number ended up as a person
# name (e.g. "Hotline:1900-558842" with phone=null).

HOTLINE_RESCUE_RE = re.compile(
    r"(?i)^hotline\s*[:\：]\s*(.+)$"
    r"|^[\u4e00-\u9fff]*熱[線綫]\s*[:\：]\s*(.+)$"
)

PHONE_DIGITS_RE = re.compile(r"^[\d\s\-\+\(\)\.]{7,}$")

fixed_hotline_rescue = 0
for c in data:
    keep = []
    for uc in c.get("userContacts", []):
        name = (uc.get("name") or "").strip()
        m = HOTLINE_RESCUE_RE.match(name)
        if m and uc.get("phone") is None:
            phone_val = (m.group(1) or m.group(2) or "").strip()
            if phone_val and PHONE_DIGITS_RE.match(phone_val):
                c.setdefault("companyContacts", []).append({"type": "hotline", "value": phone_val})
                fixed_hotline_rescue += 1
                continue  # drop from userContacts
        keep.append(uc)
    c["userContacts"] = keep


def normalize_text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = re.sub(r"\s+", " ", value.strip()).lower()
    return normalized or None


def unique_sorted(values: list[str | None]) -> list[str]:
    return sorted({value for value in values if value})


def build_company_identity_key(company: dict) -> str:
    names = unique_sorted([
        normalize_text(company.get("companyNameZh")),
        normalize_text(company.get("companyNameEn")),
        normalize_text(company.get("companyNameVi")),
    ])
    tax_id = normalize_text(company.get("taxId"))
    region = normalize_text(company.get("region"))
    country = normalize_text(company.get("country"))
    emails = unique_sorted([
        normalize_text(contact.get("value"))
        for contact in company.get("companyContacts", [])
        if normalize_text(contact.get("type")) == "email"
    ])
    phones = unique_sorted([
        normalize_text(contact.get("value"))
        for contact in company.get("companyContacts", [])
        if normalize_text(contact.get("type")) in {"tel", "hotline", "contact_person"}
    ])
    addresses = unique_sorted([
        normalize_text(address)
        for address in company.get("addresses", [])
    ])

    if tax_id:
        return f"tax:{tax_id}"
    if names and emails:
        return "name-email:" + "|".join([*names, *emails])
    if names and region and phones:
        return "name-region-phone:" + "|".join([*names, region, *phones])
    if names and region:
        return "name-region:" + "|".join([*names, region])
    if names and addresses:
        return "name-address:" + "|".join([*names, *addresses])
    if names:
        return "name:" + "|".join(names)

    fallback = {
        "country": country,
        "region": region,
        "emails": emails,
        "phones": phones,
        "addresses": addresses,
    }
    return "fallback:" + json.dumps(fallback, ensure_ascii=False, sort_keys=True)


generated_ids = 0
identity_counts: dict[str, int] = defaultdict(int)
for c in data:
    identity_key = build_company_identity_key(c)
    c["id"] = str(uuid5(COMPANY_ID_NAMESPACE, identity_key))
    identity_counts[identity_key] += 1
    generated_ids += 1

duplicate_identity_groups = sum(1 for count in identity_counts.values() if count > 1)

# ─── Output ───────────────────────────────────────────────────────────────────

OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2))

# Final clean version — drop internal fields not needed for DB import
FINAL = OUT / "05_companies.json"
DROP_FIELDS = {"_flags", "_raw", "industry"}  # industry superseded by industries[]
clean = [{k: v for k, v in c.items() if k not in DROP_FIELDS} for c in data]
FINAL.write_text(json.dumps(clean, ensure_ascii=False, indent=2))
print(f"\nFinal output : {FINAL}  ({len(clean)} companies)")
print(f"Generated company IDs : {generated_ids}")
print(f"Duplicate identity groups : {duplicate_identity_groups}")

print(f"Canonical region fixes : {fixed_canonical}")
print(f"Inferred regions       : {fixed_inferred}")
print(f"Country → ISO fixes    : {fixed_country}")
print(f"En→Vi name promotions  : {fixed_en_to_vi}")
print(f"TaxId artifact fixes   : {fixed_taxid}")
print(f"Office suffix strips   : {fixed_office_suffix}")
print(f"Split address merges   : {fixed_split_addr}")
print(f"Contact type fixes     : {fixed_contact_types}")
print(f"Hotline rescue (name→contact): {fixed_hotline_rescue}")

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
