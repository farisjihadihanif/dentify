# Dentify Data Dictionary

Cleaned, deduplicated, leak-free dental image dataset for Capstone `CC26-PSU285` (Dentify).

## 1. Unified Canonical Target Classes

| `label` | Indonesian Display Label | Urgency Baseline (`PRD §6.1`) |
|---|---|---|
| `caries` | Indikasi Karies Gigi (Gigi Berlubang) | `medium` (`emergency` if conf ≥ 0.85 or severe symptoms) |
| `calculus` | Indikasi Karang Gigi | `medium` (`emergency` if severe symptoms) |
| `gingivitis` | Indikasi Radang Gusi (Gingivitis) | `medium` (`emergency` if severe symptoms) |
| `healthy` | Gigi dan Gusi Tampak Sehat | `low` (`medium` if mild symptoms) |

## 2. Source-to-Canonical Label Mapping (All 3 Sources)

| Dataset Source | Raw Folder / Label | Action / Canonical Label | License |
|---|---|---|---|
| Kaggle `salmansajid05/oral-diseases` | `Data caries/caries orignal data set/done` | Mapped → `caries` | Unknown (per Kaggle API) |
| Kaggle `salmansajid05/oral-diseases` | `Calculus/Calculus` | Mapped → `calculus` | Unknown (per Kaggle API) |
| Kaggle `salmansajid05/oral-diseases` | `Gingivitis/Gingivitis` | Mapped → `gingivitis` | Unknown (per Kaggle API) |
| Kaggle `salmansajid05/oral-diseases` | `caries augmented data set`, `*_augmented_*`, `*_yolo_annotated_*` | **Removed** (pre-augmented / duplicate exports) | Unknown (per Kaggle API) |
| Kaggle `salmansajid05/oral-diseases` | `hypodontia`, `Mouth Ulcer`, `Tooth Discoloration` | **Removed** (out-of-scope conditions per `PRD §5.2`) | Unknown (per Kaggle API) |
| Kaggle `shahjahanabdullatif/dental-cavity-detection-dataset` | `Yolo_Dataset/{train,val,test}` (IDs `0`, `1`) | **Removed** after manual audit (missing class YAML, mixed severe pathology in both IDs, caption overlays, `.rf.` pre-augmentations) | CC BY-SA 4.0 |
| Kaggle `hamza202404/al-zahrawi-twenty-oral-teeth-mouth-diseases` (authenticated 3rd Kaggle source) | `Healthy Teeth`, `Data caries`, `Calculus A`, `Gingivitis A` (`al-Zahrawi.csv`) | Mapped → `healthy`, `caries`, `calculus`, `gingivitis` (dropped `Normal` `.rf.` segments & 15 off-target oral cancer/lesion classes) | CC0: Public Domain |
| Local `dentalscan` supplement (brief `jehanbhathena/dental-caries-dataset` remains 403/private on Kaggle) | `gigi caries`, `karang gigi`, `gigi sehat`, `gusi sehat` | Mapped → `caries`, `calculus`, `healthy` | Internal Capstone `CC26-PSU285` research set |

## 3. Class Counts per Leak-Free Split (`data/processed/`)

| Class | Train (~70%) | Val (~15%) | Test (~15%) | Total |
|---|---:|---:|---:|---:|
| `caries` | 134 | 29 | 28 | 191 |
| `calculus` | 344 | 74 | 74 | 492 |
| `gingivitis` | 490 | 105 | 105 | 700 |
| `healthy` | 221 | 48 | 48 | 317 |
| **Total** | **1189** | **256** | **255** | **1700** |

## 4. Manifest Columns (`data/processed/manifest.csv`)

| Column | Type | Description |
|---|---|---|
| `image_id` | string | Stable 12-char SHA-1 identifier |
| `source` | string | Dataset source (`oral_diseases` or `local_dentalscan`) |
| `label` | enum | Canonical class (`caries`, `calculus`, `gingivitis`, `healthy`) |
| `split` | enum | Leak-free partition (`train`, `val`, `test`) |
| `processed_path` | string | Relative path under `data/processed/{split}/{label}/` |
| `width`, `height` | int | Original pixel dimensions |
| `dhash_hex` | string | 64-bit perceptual difference hash |
| `cluster_id` | string | Perceptual-hash cluster identifier |

## 5. Deduplication & Anti-Leakage Verification

- **Pre-dedupe candidate clean images:** 5030
- **Duplicates removed (64-bit dHash, Hamming ≤ 4):** 3303 (exact + near-duplicates)
- **Exact overlap across splits:** 0
- **Cluster overlap across splits:** 0
- **Minimum cross-split Hamming distance:** 5 (strictly > 4)
