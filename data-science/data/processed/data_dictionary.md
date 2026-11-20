# DentHub Data Dictionary

Curated and cleaned dental image dataset for Capstone `CC26-PSU285` (DentHub).

## 1. Target Classes (Unified Canonical Labels)

| `label` | Indonesian Display Label | Description | Urgency Baseline (PRD §6.1) |
|---|---|---|---|
| `caries` | Indikasi Karies Gigi (Gigi Berlubang) | Visible enamel decay, brown/dark pits, or carious cavities | `medium` (`emergency` if conf ≥ 0.85 or severe symptoms) |
| `calculus` | Indikasi Karang Gigi | Mineralized plaque / tartar along tooth surfaces or gumline | `medium` (`emergency` if severe symptoms) |
| `gingivitis` | Indikasi Radang Gusi (Gingivitis) | Redness, mild swelling, or gingival inflammation | `medium` (`emergency` if severe symptoms) |
| `healthy` | Gigi dan Gusi Tampak Sehat | Clean teeth and healthy pink gums without visible lesions | `low` (`medium` if mild symptoms) |

## 2. Manifest Columns (`data/processed/manifest.csv`)

| Column | Type | Description |
|---|---|---|
| `image_id` | string | Stable SHA-1 prefix identifier for the cleaned image |
| `source` | string | Originating dataset source (Kaggle / local curated) |
| `label` | enum | Canonical target class (`caries`, `calculus`, `gingivitis`, `healthy`) |
| `split` | enum | Stratified leak-free partition (`train`, `val`, `test`) |
| `processed_path` | string | Relative path under `data/processed/{split}/{label}/` |
| `width` | int | Original image width in pixels |
| `height` | int | Original image height in pixels |
| `dhash_hex` | string | 64-bit perceptual difference hash used for cross-dataset deduplication |
| `cluster_id` | string | Perceptual-hash near-duplicate cluster identifier |

## 3. Dataset Assessment & Cleaning Summary

- **Total raw candidate files scanned:** 48057
- **Dropped (off-target / non-canonical label):** 7616
- **Dropped (corrupt / unreadable):** 0
- **Dropped (tiny < 64×64 or extreme aspect ratio):** 18
- **Dropped (exact & perceptual near-duplicates, Hamming ≤ 4):** 22036
- **Final clean, unique images:** 1751
- **Split counts:** train=1226, val=262, test=263
- **Anti-leakage check:** `train ∩ val = ∅`, `train ∩ test = ∅`, `val ∩ test = ∅` (asserted in `wrangle.py`)
