#!/usr/bin/env python3
"""
Step 02 — LLM flag enrichment.

Reads 01_parsed.json, resolves ambiguous _flags entries using OpenAI,
and writes the corrected records to 02_enriched.json.

Only companies with _flags are sent to the LLM (17 companies in practice).

Usage: python3 scripts/02_enrich.py
Requires: OPENAI_API_KEY in environment or .env file
"""

import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

OUT    = Path(__file__).parent / "out"
INPUT  = OUT / "01_parsed.json"
OUTPUT = OUT / "02_enriched.json"
MODEL  = "gpt-4o-mini"

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


# ─── Prompt ───────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a data cleaning assistant for a Vietnamese business directory.
Each company record was parsed from a Word document. Lines the parser could not classify
are stored in _flags. Your job is to classify each flagged line.

Respond ONLY with a JSON object in this exact schema:
{
  "resolved": [
    {
      "original": "<exact flagged line>",
      "action": "address" | "companyContact" | "userContact" | "discard",
      "value": "<cleaned value — omit for discard>",
      "contactType": "<tel|fax|email|website|hotline|skype|zalo|wechat|line> — only when action=companyContact>",
      "name": "<person name — only when action=userContact>",
      "phone": "<phone — only when action=userContact>"
    }
  ]
}

Rules:
- address: physical location (street, building, floor, city, country)
- companyContact: company-level contact (phone, fax, email, website, social)
  - Fix typos: double @@ → single @, bare domain → add https://
  - Strip department/cargo prefixes (e.g. "CNC:", "旅客訂位專線:") — keep the value
- userContact: individual person's name + phone
- discard: department labels, region headers, duplicate lines, or anything not useful
"""

def build_user_message(company: dict) -> str:
    name = (
        company.get("companyNameEn")
        or company.get("companyNameVi")
        or company.get("companyNameZh")
        or "Unknown"
    )
    raw = company.get("_raw") or {}
    details_cell = raw.get("details", "") if isinstance(raw, dict) else ""
    flags = company.get("_flags", [])

    return (
        f"Company: {name}\n\n"
        f"Raw details cell (for context):\n{details_cell}\n\n"
        f"Flagged lines to classify:\n"
        + "\n".join(f"- {f}" for f in flags)
    )


# ─── Patch helpers ────────────────────────────────────────────────────────────

def apply_resolved(company: dict, resolved: list[dict]) -> None:
    for item in resolved:
        action = item.get("action")
        value  = item.get("value", "").strip()

        if action == "address" and value:
            if value not in company.get("addresses", []):
                company.setdefault("addresses", []).append(value)

        elif action == "companyContact" and value:
            contact_type = item.get("contactType", "tel")
            entry = {"type": contact_type, "value": value}
            if entry not in company.get("companyContacts", []):
                company.setdefault("companyContacts", []).append(entry)

        elif action == "userContact":
            name  = item.get("name", "").strip()
            phone = item.get("phone", "").strip()
            if name or phone:
                entry = {"name": name, "phone": phone}
                if entry not in company.get("userContacts", []):
                    company.setdefault("userContacts", []).append(entry)

        # discard → do nothing


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    data = json.loads(INPUT.read_text())
    flagged = [c for c in data if c.get("_flags")]

    print(f"Total companies : {len(data)}")
    print(f"Flagged         : {len(flagged)}")

    if not flagged:
        print("Nothing to enrich — copying raw → v1 as-is.")
        OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        return

    print(f"Model           : {MODEL}\n")

    for i, company in enumerate(flagged, 1):
        name = (
            company.get("companyNameEn")
            or company.get("companyNameVi")
            or company.get("companyNameZh")
            or "?"
        )
        print(f"[{i}/{len(flagged)}] {name}")
        print(f"  flags: {company['_flags']}")

        try:
            response = client.chat.completions.create(
                model=MODEL,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": build_user_message(company)},
                ],
            )
            result = json.loads(response.choices[0].message.content)
            resolved = result.get("resolved", [])
            apply_resolved(company, resolved)
            company["_flags"] = []  # cleared after enrichment
            for r in resolved:
                print(f"  → [{r['action']}] {r.get('value') or r.get('original')}")
        except Exception as exc:
            print(f"  ✗ LLM error: {exc} — flags kept as-is")

    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"\nOutput: {OUTPUT}  ({len(data)} companies)")


if __name__ == "__main__":
    main()
