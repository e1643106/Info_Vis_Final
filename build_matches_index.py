#!/usr/bin/env python3
import argparse
import json
import os
import re
from pathlib import Path

PAT = re.compile(r"^liverpool(\d{8})(.+)\.csv$", re.IGNORECASE)

def pretty_opponent(raw: str) -> str:
    s = raw.lower()

    # small normalizations
    s = s.replace("afc", "afc ")
    s = s.replace("westham", "west ham")
    s = s.replace("westbromwich", "west bromwich")
    s = s.replace("hotspur", " hotspur")
    s = s.replace("united", " united")
    s = s.replace("city", " city")
    s = s.replace("palace", " palace")
    s = s.replace("albion", " albion")
    s = re.sub(r"\s+", " ", s).strip()

    # Title case words, but keep AFC uppercase
    parts = []
    for w in s.split(" "):
        if w == "afc":
            parts.append("AFC")
        else:
            parts.append(w[:1].upper() + w[1:])
    return " ".join(parts)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="data", help="Folder containing liverpool*.csv files")
    ap.add_argument("--out", default="data/matches_index.json", help="Output JSON path")
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        raise SystemExit(f"Data dir not found: {data_dir}")

    matches = []
    for fn in os.listdir(data_dir):
        m = PAT.match(fn)
        if not m:
            continue
        date = m.group(1)         # YYYYMMDD
        opp_raw = m.group(2)      # e.g. stokecity / afcbournemouth / manchesterunited
        opp = pretty_opponent(opp_raw)

        yyyy, mm, dd = date[:4], date[4:6], date[6:8]
        label = f"Liverpool - {opp} ({dd}/{mm}/{yyyy})"

        matches.append({
            "file": fn,
            "label": label,
            "dateKey": date
        })

    matches.sort(key=lambda x: x.get("dateKey", ""))

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with out_path.open("w", encoding="utf-8") as f:
        json.dump(matches, f, ensure_ascii=False, indent=2)

    print(f"wrote {len(matches)} matches -> {out_path}")

if __name__ == "__main__":
    main()
