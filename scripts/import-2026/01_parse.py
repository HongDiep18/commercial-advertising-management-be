#!/usr/bin/env python3
"""
Parse TONG HOP 2026 (1).docx into structured JSON.

The document is a Word table: each 4-cell row = one company.
  Cell 0 (names)    → companyNameZh, companyNameVi, companyNameEn, country
  Cell 1 (contacts) → userContacts [{ name, phone }]
  Cell 2 (details)  → address, companyContacts [{ type, value }], taxId
  Cell 3 (desc)     → description

Usage: python3 scripts/01_parse.py
Output: scripts/out/01_parsed.json
"""

import json
import re
import unicodedata
import zipfile
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────

DOCX_PATH = Path(__file__).parent.parent.parent / "tasks" / "TONG HOP 2026 (1).docx"
OUTPUT_PATH = Path(__file__).parent / "out" / "01_parsed.json"

# ─── Section → Industry mapping ───────────────────────────────────────────────

SECTION_TO_INDUSTRY = {
    "A": "textile",
    "B": "shoes",
    "C": "vehicle",
    "D": "furniture",
    "E": "construction",
    "F": "electronics",
    "G": "machinery",
    "H": "plastic",
    "I": "agriculture",
    "J": "metal",
    "K": "paper",
    "L": "logistics",
    "M": "finance",
    "N": "gifts",
    "O": "tourism",
    "P": "food",
    "Q": "education",
    "R": "legal",
    "S": "other",
}

# ─── Regex ────────────────────────────────────────────────────────────────────

COUNTRY_RE    = re.compile(r"（(.+?)[）)]")
HAS_CJK_RE    = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")
LATIN_CO_RE   = re.compile(r"\b(CO\.?,?\s*LTD|CONG TY|CORPORATION|INC\.|JSC|COMPANY)\b", re.IGNORECASE)
EMAIL_RE      = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE      = re.compile(r"[\d]{3,}[\d\s\-]{3,}")
LABELED_RE    = re.compile(
    r"^(tel|fax|mst|email|web|website|skype|hotline|zalo|viber|wechat(\s*id)?|line|facebook|fb|"
    r"line[/,\s]*wechat(\s*id)?|viber[/,\s]*line[/,\s]*wechat|wechat[/,\s]*line(\s*id)?|"
    r"[\u4e00-\u9fff]{1,6}[：:]?(?:電話|訂位|服務))\s*[:\：]",
    re.IGNORECASE,
)
TYPO_LABELED_RE = re.compile(
    r"^(webs|wed|webiste|websiet|wedsite|emai|emaill|eamil|enail|eamail|emsil|emaiil|e-mail|hottline|mts)\s*[:\：]",
    re.IGNORECASE,
)
BARE_URL_RE   = re.compile(r"^www\.", re.IGNORECASE)
OFFICE_RE     = re.compile(r"^(VP\s*\w*|VPDD|CHI NHANH|[\u4e00-\u9fff]+分行|HCM office|HA NOI office)\s*[:\：]\s*", re.IGNORECASE)
ADDRESS_KEYWORDS_RE = re.compile(r"\b(duong|khu|kcn|kcx|vsip|phuong|quan|xa|tang|lo\b|so\b|ap\b|kdc|kdt|cum cn|lau\b)\b", re.IGNORECASE)
SECTION_RE    = re.compile(r"^([A-S])\.\s*[\u4e00-\u9fff]")   # "A. 紡織..."
SECTION_SINGLE_RE = re.compile(r"^([D-P])$")                   # bare "D", "E"...
CITY_RE       = re.compile(r"[\u4e00-\u9fff]+.{0,10}[–—]\s*[A-Z][A-Z\s\.]+$")

# ─── XML helpers ──────────────────────────────────────────────────────────────

def cell_paragraphs(cell_xml: str) -> list[str]:
    """Return list of non-empty paragraph texts from a table cell."""
    paras = re.findall(r"<w:p[ >].*?</w:p>", cell_xml, re.DOTALL)
    result = []
    for p in paras:
        text = re.sub(r"<[^>]+>", "", p).strip()
        text = re.sub(r"\s+", " ", text)
        text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        if text:
            result.append(text)
    return result


def cell_text(cell_xml: str) -> str:
    return "\n".join(cell_paragraphs(cell_xml))


def normalize_website(raw: str) -> str:
    url = re.sub(r"(?i)^(web|website)\s*[:\：]\s*", "", raw).strip()
    if url and not url.startswith("http"):
        url = "https://" + url
    return url


# Matches embedded labels after a digit (with or without leading space)
EMBEDDED_LABEL_RE = re.compile(r"(?<=\d)\s*(Fax|Tel|Hotline|MST)\s*[:\：]", re.IGNORECASE)

def split_numbers(raw: str, label: str) -> list[str]:
    stripped = re.sub(rf"(?i)^{label}\s*[:\：]\s*", "", raw)
    # Split on /, comma, ~, and em/en dashes used as separators
    parts = [p.strip() for p in re.split(r"[/,~\u2013\u2014]", stripped) if p.strip()]
    result = []
    for part in parts:
        # Strip trailing annotations: (ext 101), (Zalo), *extension, etc.
        part = re.sub(r"\s*\([^)]*\)\s*$", "", part).strip()
        part = re.sub(r"\*\d+$", "", part).strip()  # PBX extension: *33690
        if not part:
            continue
        digits_only = re.sub(r"[\s\-\.]", "", part)
        is_suffix = result and (not part.startswith("0") or len(digits_only) < 7)
        if is_suffix:
            prev = result[-1]
            if len(part) < len(prev):
                # Suffix replacement: "0274-3740996 / 8" → "0274-3740998"
                part = prev[:-len(part)] + part
            else:
                # Local number without area code: "028-xxx / yyy" → "028-yyy"
                prefix_match = re.match(r"^(0\d{1,3}[-\s]?)", prev)
                if prefix_match:
                    part = prefix_match.group(1) + part
        # Expand trailing single-digit range suffixes: "0276-3897177-8-9"
        # → ["0276-3897177", "0276-3897178", "0276-3897179"]
        # Require 2+ trailing -digit groups to avoid misreading normal phone dashes.
        range_m = re.match(r"^(0[\d\-\.\s]+\d{3,})((?:-\d{1,2}){2,})$", part)
        if range_m:
            base = range_m.group(1)
            suffixes = [s for s in range_m.group(2).split("-") if s]
            result.append(base)
            for s in suffixes:
                result.append(base[: -len(s)] + s)
        else:
            result.append(part)
    return result


def looks_like_phone(text: str) -> bool:
    cleaned = re.sub(r"[\s\-\(\)\+\/]", "", text)
    return cleaned.isdigit() and 7 <= len(cleaned) <= 15

# ─── Cell parsers ─────────────────────────────────────────────────────────────

def parse_names_cell(paras: list[str]) -> dict:
    """Cell 0: company names + country."""
    company_name_cn = None
    company_name_vi = None
    company_name_en = None

    # Collect all （xxx） matches across all lines; country is the LAST one.
    # The first （） is often a location or subsidiary embedded in the CJK name
    # (e.g. 欣長華織造（平陽）有限公司), while the actual country always appears
    # as the last standalone parenthetical (e.g. （台灣）).
    country_candidates: list[str] = []

    cleaned_paras: list[str] = []
    for line in paras:
        matches = list(COUNTRY_RE.finditer(line))
        for m in matches:
            val = re.sub(r'HYPERLINK\s+"[^"]*"\s*', "", m.group(1)).strip()
            country_candidates.append(val)
        # Only strip a trailing （country） marker.
        # Mid-name parentheticals like 聚陽（越南）實業股份有限公司 are preserved.
        last_m = matches[-1] if matches else None
        if last_m and last_m.end() >= len(line.rstrip()):
            line = line[:last_m.start()].strip()
        cleaned_paras.append(line)

    country = country_candidates[-1] if country_candidates else None

    # Matches "CONG TY TNHH", "CONG TY CO PHAN", "CONG TY MTV" etc. with nothing after
    VI_TYPE_ONLY_RE = re.compile(
        r"^CONG\s+TY\s+(TNHH|CO\.?\s*PHAN|MTV|LIEN\s+DOANH|HUU\s+HAN|CP)\s*$",
        re.IGNORECASE,
    )

    for line in cleaned_paras:
        if not line:
            continue

        if HAS_CJK_RE.search(line) and not company_name_cn:
            company_name_cn = line
        elif re.match(
            r"^(CONG TY|TONG CONG TY|TAP DOAN|NGAN HANG|TRUNG TAM|PHONG KHAM|"
            r"BENH VIEN|NHA HANG|KHACH SAN|LAP XUONG|CHI NHANH|VAN PHONG|"
            r"HOP TAC XA|QUY|TRUONG|HOI |LIEN DOAN|BAN QUAN LY|"
            r"VPDD|DNTN|HTX|CTCP)",  # Vietnamese abbreviations
            # Strip diacritics before matching so "CÔNG TY" matches "CONG TY"
            unicodedata.normalize("NFD", line).encode("ascii", "ignore").decode(),
            re.IGNORECASE,
        ) and not company_name_vi:
            company_name_vi = line
        elif (company_name_vi and VI_TYPE_ONLY_RE.match(company_name_vi)
              and not HAS_CJK_RE.search(line) and not company_name_en):
            # Continuation of a split Vi name: "CONG TY TNHH\nSAN XUAT ..."
            company_name_vi = company_name_vi + " " + line
        elif not HAS_CJK_RE.search(line) and not company_name_en:
            # Bare ASCII parenthetical like "(VIET NAM)" or "(3S DOOR)" —
            # could be a location suffix or a product brand label, not a company name.
            # If Vi name already exists, append as suffix; otherwise skip entirely.
            if re.match(r"^\([A-Z0-9][A-Z0-9\s]+\)$", line):
                if company_name_vi:
                    company_name_vi = company_name_vi + " " + line
                # else: skip — brand/slogan before Vi name is set, not a company name
            else:
                company_name_en = line
        elif not HAS_CJK_RE.search(line) and company_name_en and not company_name_vi:
            # Second Latin line and still no Vi name — prefer the longer one as En
            if len(line) > len(company_name_en):
                company_name_en = line

    return {
        "companyNameZh": company_name_cn,
        "companyNameVi": company_name_vi,
        "companyNameEn": company_name_en,
        "country": country,
    }


HOTLINE_LABEL_RE = re.compile(
    r"(?i)^hotline\s*[:\：]?\s*"          # English: "Hotline:" / "Hotline"
    r"|^[\u4e00-\u9fff]*熱[線綫]\s*[:\：]?\s*"  # CJK: "銷售熱線:", "熱綫:" (both char variants)
)
# Labels that are section headers in column 2, not person names — skip entirely
CONTACT_SKIP_LABEL_RE = re.compile(r"^聯絡人\s*[:\：]?\s*$")
# Pure CJK parenthetical location labels between contacts, e.g. （胡志明市）,（興安省）
CJK_LOCATION_RE = re.compile(r"^（[\u4e00-\u9fff\u3400-\u4dbf\s]+）$")

def parse_contacts_cell(paras: list[str]) -> tuple[list[dict], list[dict]]:
    """Cell 1: user contacts — alternating name / phone lines.

    Returns (user_contacts, hotline_company_contacts).
    Hotline labels (Hotline:, 銷售熱線:, etc.) are extracted as company
    hotline contacts instead of being stored as person names.
    """
    contacts = []
    hotlines = []
    pending_name = None
    pending_hotline = False

    for line in paras:
        line = line.strip()
        if not line:
            continue

        if CONTACT_SKIP_LABEL_RE.match(line):
            continue  # "聯絡人：" is a section header, not a person name

        if CJK_LOCATION_RE.match(line):
            continue  # "（胡志明市）" etc. are branch location labels, not person names

        if HOTLINE_LABEL_RE.match(line):
            # Flush any pending name
            if pending_name:
                contacts.append({"name": pending_name, "phone": None})
                pending_name = None
            # Check if the phone is on the same line after the label
            remainder = HOTLINE_LABEL_RE.sub("", line).strip()
            if remainder and looks_like_phone(remainder):
                hotlines.append({"type": "hotline", "value": remainder})
                pending_hotline = False
            else:
                pending_hotline = True
            continue

        if looks_like_phone(line):
            if pending_hotline:
                hotlines.append({"type": "hotline", "value": line})
                pending_hotline = False
            elif pending_name:
                contacts.append({"name": pending_name, "phone": line})
                pending_name = None
            else:
                contacts.append({"name": None, "phone": line})
        else:
            pending_hotline = False
            # Scan for all phone segments: handles simple "Name0912-345678" and
            # concatenated "0704-439073Bin Lee0938-277792" (phone+name+phone)
            _PHONE_SEG_RE = re.compile(r"(0\d{2,3}[-\s]?\d{3,4}[-\s]?\d{3,4})")
            segments: list[tuple[str, str]] = []
            pos = 0
            for m in _PHONE_SEG_RE.finditer(line):
                text_before = line[pos:m.start()].strip()
                if text_before:
                    segments.append(("name", text_before))
                segments.append(("phone", m.group(1)))
                pos = m.end()
            text_after = line[pos:].strip()
            if text_after:
                segments.append(("name", text_after))

            if any(t == "phone" for t, _ in segments):
                i = 0
                while i < len(segments):
                    seg_type, seg_val = segments[i]
                    if seg_type == "phone":
                        # First phone pairs with any pending name
                        contacts.append({"name": pending_name, "phone": seg_val})
                        pending_name = None
                        i += 1
                    else:  # "name"
                        if i + 1 < len(segments) and segments[i + 1][0] == "phone":
                            contacts.append({"name": seg_val, "phone": segments[i + 1][1]})
                            i += 2
                        else:
                            pending_name = seg_val
                            i += 1
            else:
                if pending_name:
                    contacts.append({"name": pending_name, "phone": None})
                pending_name = line

    if pending_name:
        contacts.append({"name": pending_name, "phone": None})

    return contacts, hotlines


def parse_details_cell(paras: list[str]) -> dict:
    """Cell 2: address, Tel, Fax, MST, Email, Website, Skype..."""
    company_contacts = []
    addresses = []
    tax_id = None
    flags = []
    last_contact_type = None  # track for continuation lines

    # First non-labeled, non-phone line(s) before any labeled line = address
    hit_labeled = False

    for line in paras:
        line = line.strip()
        if not line:
            continue

        lower = line.lower()

        if LABELED_RE.match(line):
            hit_labeled = True

            if lower.startswith("tel"):
                # Split on embedded labels: "Tel: 0251-xxx Fax: 0251-yyy"
                chunks = EMBEDDED_LABEL_RE.split(line)
                for num in split_numbers(chunks[0], "tel"):
                    company_contacts.append({"type": "tel", "value": num})
                for i in range(1, len(chunks), 2):
                    lbl, val = chunks[i].lower(), chunks[i + 1] if i + 1 < len(chunks) else ""
                    val = val.strip()
                    if lbl == "mst":
                        if val:
                            tax_id = val
                    else:
                        ctype = "fax" if lbl == "fax" else "hotline" if lbl == "hotline" else "tel"
                        for num in split_numbers(f"{lbl}: {val}", lbl):
                            company_contacts.append({"type": ctype, "value": num})
            elif lower.startswith("fax"):
                chunks = EMBEDDED_LABEL_RE.split(line)
                for num in split_numbers(chunks[0], "fax"):
                    company_contacts.append({"type": "fax", "value": num})
                for i in range(1, len(chunks), 2):
                    lbl, val = chunks[i].lower(), chunks[i + 1].strip() if i + 1 < len(chunks) else ""
                    if lbl == "mst":
                        if val:
                            tax_id = val
                    else:
                        ctype = "tel" if lbl == "tel" else "hotline" if lbl == "hotline" else "fax"
                        for num in split_numbers(f"{lbl}: {val}", lbl):
                            company_contacts.append({"type": ctype, "value": num})
            elif lower.startswith("mst"):
                tax_id = re.sub(r"(?i)^mst\s*[:\：]\s*", "", line).strip()
            elif lower.startswith("email"):
                for email in EMAIL_RE.findall(line):
                    company_contacts.append({"type": "email", "value": email})
            elif lower.startswith("web") or lower.startswith("website"):
                company_contacts.append({"type": "website", "value": normalize_website(line)})
            elif lower.startswith("skype"):
                value = re.sub(r"(?i)^skype\s*[:\：]\s*", "", line).strip()
                company_contacts.append({"type": "skype", "value": value})
            elif lower.startswith("hotline"):
                for num in split_numbers(line, "hotline"):
                    company_contacts.append({"type": "hotline", "value": num})
            elif any(lower.startswith(p) for p in ("zalo", "wechat", "line", "viber", "facebook", "fb")):
                label = re.match(r"^([\w/,\s]+)\s*[:\：]", line, re.IGNORECASE).group(1).strip().lower()
                label = re.sub(r"[\s/,]+", "_", label)  # e.g. "line/wechat id" → "line_wechat_id"
                value = re.sub(r"^[\w/,\s]+\s*[:\：]\s*", "", line).strip()
                # Split embedded social labels: "sgpk1962 Line: sgpk360"
                SOCIAL_EMBED_RE = re.compile(
                    r"\s+(Zalo|Wechat|Line|Viber|Facebook|Skype)\s*[:\：]\s*", re.IGNORECASE
                )
                parts = SOCIAL_EMBED_RE.split(value)
                company_contacts.append({"type": label, "value": parts[0].strip()})
                for i in range(1, len(parts), 2):
                    extra_label = parts[i].lower().strip()
                    extra_value = parts[i + 1].strip() if i + 1 < len(parts) else ""
                    if extra_value:
                        company_contacts.append({"type": extra_label, "value": extra_value})
            elif re.match(r"^[\u4e00-\u9fff].+[：:]\s*[\d]", line):
                # CJK-labeled phone: "機場服務電話: 028-xxx", "維修服務：0961-xxx"
                value = re.sub(r"^.+[：:]\s*", "", line).strip()
                company_contacts.append({"type": "tel", "value": value})
            else:
                flags.append(line)

        elif TYPO_LABELED_RE.match(line):
            hit_labeled = True
            lower = line.lower()
            value = re.sub(r"^[\w\-]+\s*[:\：]\s*", "", line).strip()
            if any(lower.startswith(p) for p in ("emai", "e-mail", "emaill", "eamil", "enail", "eamail", "emsil", "emaiil")):
                # Fix double-@ too
                fixed = value.replace("@@", "@")
                for email in EMAIL_RE.findall(fixed):
                    company_contacts.append({"type": "email", "value": email})
            elif lower.startswith("mts"):
                # Flipped MST
                tax_id = value
            elif lower.startswith("hott"):
                company_contacts.append({"type": "hotline", "value": value})
            else:
                company_contacts.append({"type": "website", "value": normalize_website(re.sub(r"^\w+\s*[:\：]\s*", "", line))})

        elif BARE_URL_RE.match(line):
            # Bare URL: "www.taya.com.tw"
            company_contacts.append({"type": "website", "value": "https://" + line})

        elif OFFICE_RE.match(line):
            # Office/branch label: "VP HCM: address", "VPDD: address"
            hit_labeled = True
            addr = OFFICE_RE.sub("", line).strip()
            if addr:
                addresses.append(addr)

        elif not hit_labeled:
            # Before first labeled line → address
            # But check for embedded Tel:/Fax:/Email: within the line
            embedded = re.search(r"(?<=[A-Za-z0-9])\s*(Tel|Fax|Email|Web|MST)\s*[:\：]", line, re.IGNORECASE)
            if embedded:
                hit_labeled = True
                addr_part = line[:embedded.start()].strip()
                rest = line[embedded.start():].strip()
                if addr_part:
                    addresses.append(addr_part)
                # Re-process the labeled remainder recursively
                for chunk in re.split(r"\s+(?=(?:Tel|Fax|Email|Web|MST)\s*[:\：])", rest, flags=re.IGNORECASE):
                    chunk = chunk.strip()
                    if not chunk:
                        continue
                    clower = chunk.lower()
                    if clower.startswith("tel"):
                        for num in split_numbers(chunk, "tel"):
                            company_contacts.append({"type": "tel", "value": num})
                    elif clower.startswith("fax"):
                        for num in split_numbers(chunk, "fax"):
                            company_contacts.append({"type": "fax", "value": num})
                    elif clower.startswith("mst"):
                        tax_id = re.sub(r"(?i)^mst\s*[:\：]\s*", "", chunk).strip()
                    elif clower.startswith("email"):
                        for email in EMAIL_RE.findall(chunk):
                            company_contacts.append({"type": "email", "value": email})
                    elif clower.startswith("web"):
                        company_contacts.append({"type": "website", "value": normalize_website(chunk)})
            elif not looks_like_phone(line):
                addresses.append(line)

        else:
            # After labeled lines
            if EMAIL_RE.match(line):
                company_contacts.append({"type": "email", "value": line})
            elif re.match(r"^MST\s+\d+$", line, re.IGNORECASE):
                # "MST 3900421817" — no colon
                tax_id = line.split()[-1]
            elif looks_like_phone(re.sub(r"（[^）]*）", "", line)):
                # Standalone phone, strip annotations like "（CNC）"
                company_contacts.append({"type": "tel", "value": re.sub(r"（[^）]*）", "", line).strip()})
            elif ADDRESS_KEYWORDS_RE.search(line) and len(line) > 15:
                addresses.append(line)
            else:
                flags.append(line)

    return {
        "addresses": addresses,
        "taxId": tax_id,
        "companyContacts": company_contacts,
        "_flags": flags,
    }

# ─── Main parser ──────────────────────────────────────────────────────────────

def parse(docx_path: Path) -> list[dict]:
    with zipfile.ZipFile(docx_path) as z:
        with z.open("word/document.xml") as f:
            content = f.read().decode("utf-8")

    companies = []
    current_industry = "other"
    current_section_letter = None

    # Split into tables and non-table blocks to track section headers
    # Section headers appear outside tables as regular paragraphs
    blocks = re.split(r"(<w:tbl[ >].*?</w:tbl>)", content, flags=re.DOTALL)

    for block in blocks:
        if block.startswith("<w:tbl"):
            # Parse table rows
            rows = re.findall(r"<w:tr[ >].*?</w:tr>", block, re.DOTALL)
            current_region = None

            for row in rows:
                cells = re.findall(r"<w:tc[ >].*?</w:tc>", row, re.DOTALL)

                if len(cells) == 1:
                    # Single-cell row = city/region header
                    text = cell_text(cells[0]).strip()
                    if CITY_RE.search(text):
                        current_region = text
                    continue

                if len(cells) != 4:
                    continue

                paras0 = cell_paragraphs(cells[0])
                paras1 = cell_paragraphs(cells[1])
                paras2 = cell_paragraphs(cells[2])
                raw_desc = cell_text(cells[3]).strip()

                names   = parse_names_cell(paras0)
                contacts, hotlines = parse_contacts_cell(paras1)
                details  = parse_details_cell(paras2)

                # Hotlines from user-contacts cell belong in companyContacts
                if hotlines:
                    details["companyContacts"] = hotlines + details.get("companyContacts", [])

                companies.append({
                    **names,
                    "industry": current_industry,
                    "region": current_region,
                    **details,
                    "description": raw_desc or None,
                    "userContacts": contacts,
                    "_raw": {
                        "names":    cell_text(cells[0]),
                        "contacts": cell_text(cells[1]),
                        "details":  cell_text(cells[2]),
                        "description": raw_desc,
                    },
                })

        else:
            # Non-table block: look for section headers in paragraphs
            paras = re.findall(r"<w:p[ >].*?</w:p>", block, re.DOTALL)
            for p in paras:
                is_bold = bool(re.search(r"<w:b\s*/>", p))
                text = re.sub(r"<[^>]+>", "", p).strip()
                text = re.sub(r"\s+", " ", text).replace("&amp;", "&")
                if not text or is_bold:
                    continue

                m = SECTION_RE.match(text) or SECTION_SINGLE_RE.match(text)
                if m:
                    current_section_letter = m.group(1)
                    current_industry = SECTION_TO_INDUSTRY.get(current_section_letter, "other")

    return companies

# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    print(f"Parsing {DOCX_PATH.name}...")
    companies = parse(DOCX_PATH)
    before = len(companies)

    # Drop blank/null rows — no name at all
    companies = [
        c for c in companies
        if c.get("companyNameZh") or c.get("companyNameVi") or c.get("companyNameEn")
    ]
    dropped = before - len(companies)
    print(f"  {before} companies extracted, {dropped} blank rows dropped → {len(companies)} kept")

    with_email   = sum(1 for c in companies if any(x["type"] == "email" for x in c["companyContacts"]))
    with_tel     = sum(1 for c in companies if any(x["type"] == "tel"   for x in c["companyContacts"]))
    with_taxid   = sum(1 for c in companies if c["taxId"])
    with_address = sum(1 for c in companies if c["addresses"])
    with_flags   = sum(1 for c in companies if c["_flags"])
    multi_user   = sum(1 for c in companies if len(c["userContacts"]) > 1)

    print(f"\n  Stats:")
    print(f"    With email:         {with_email}/{len(companies)}")
    print(f"    With tel:           {with_tel}/{len(companies)}")
    print(f"    With tax ID:        {with_taxid}/{len(companies)}")
    print(f"    With address:       {with_address}/{len(companies)}")
    print(f"    With flags:         {with_flags}/{len(companies)}")
    print(f"    Multi user contact: {multi_user}")

    print(f"\n  By industry:")
    counts: dict[str, int] = {}
    for c in companies:
        counts[c["industry"]] = counts.get(c["industry"], 0) + 1
    for industry, count in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"    {industry:<15} {count}")

    OUTPUT_PATH.write_text(json.dumps(companies, ensure_ascii=False, indent=2))
    print(f"\nOutput: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
