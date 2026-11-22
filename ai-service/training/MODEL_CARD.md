# Model Card: Dentify dental screening classifier

**Served model:** `dentify-mobilenetv2-2.1.0` (`ai-service/models/dentify_model.keras` + `model_meta.json`)
**Last updated:** 2026-11-22
**Status:** in use. **Advisor confirmation pending** on the use of ImageNet pretrained weights.

> Dentify is a **non-diagnostic** screening aid. Every result says "indikasi"/"tampak", and the backend appends the standard disclaimer advising a visit to a dentist. This model does not replace a clinical examination.

## 1. Intended use

- **Task:** classify one intraoral photo into `caries`, `calculus`, `gingivitis` or `healthy`. The output feeds urgency rules (`app/ml/urgency.py`) and the user's care guidance.
- **Users:** members of the public taking a phone or webcam photo of their own teeth.
- **Out of scope:** diagnosis, treatment decisions, X-rays, children's teeth (not represented in the data), any condition outside the four classes (ulcers, lesions, oral cancer, discolouration, hypodontia, etc.).

## 2. Data

The data is 1,700 images after cleaning, perceptual-hash deduplication (64-bit dHash, Hamming ≤ 4, 3,303 duplicates removed) and a leak-free 70/15/15 split. No hash cluster crosses splits, and the minimum cross-split Hamming distance is 5. The pipeline is in `data-science/wrangle.py`; details are in `data-science/data/processed/data_dictionary.md`.

| Split | caries | calculus | gingivitis | healthy | Total |
|---|---:|---:|---:|---:|---:|
| train | 134 | 344 | 490 | 221 | 1,189 |
| val | 29 | 74 | 105 | 48 | 256 |
| test | 28 | 74 | 105 | 48 | 255 |

### Sources and licences

| Source | Images used (all splits) | Classes contributed | Licence |
|---|---:|---|---|
| Kaggle `salmansajid05/oral-diseases` (v3, Salman Sajid) | 1,229 | gingivitis 700, calculus 428, caries 101 | **Unknown.** The Kaggle API metadata says `licenseName: "Unknown"` (checked 2026-11-22). The description only says the images come from "multiple hospitals and reputable dental websites" and gives no reuse terms. `data_dictionary.md` calls this "Kaggle open research / educational terms", but nothing on Kaggle supports that wording. |
| Kaggle `hamza202404/al-zahrawi-twenty-oral-teeth-mouth-diseases` (v1) | 198 | healthy 198 | CC0: Public Domain (Kaggle API metadata) |
| Local `dentalscan` (capstone team set, CC26-PSU285) | 273 | healthy 119, caries 90, calculus 64 | Internal capstone research set; no public licence |
| Kaggle `shahjahanabdullatif/dental-cavity-detection-dataset` | 0 (removed after audit) | – | CC BY-SA 4.0 |

**Licence risk:** 72% of the data, including **every gingivitis image**, has an unknown licence. Treat the model as research/educational only until this is resolved: get permission, or replace the source with clearly licensed data.

### Source/label confound

The labels are not independent of the source:

- **gingivitis:** 100% from `oral_diseases`
- **healthy:** 100% from `al_zahrawi` (62%) and `dentalscan` (38%); none from `oral_diseases`
- **calculus:** 87% `oral_diseases`; **caries:** 53% `oral_diseases`, 47% `dentalscan`

The model can therefore partly learn *which dataset a photo looks like it came from* (camera, framing, lighting, resolution) instead of the condition. Test metrics come from the same sources, so they do **not** measure this risk and are probably optimistic for real user photos. No per-source or external evaluation has been done.

## 3. Method

- **Preprocessing:** RGB → LAB CLAHE (clip 2.0, 8×8 grid) → resize 224×224 → scale to [0, 1]. The same function (`preprocess_rgb_for_model`) is used in training and serving.
- **Architecture (served):** `keras.applications.MobileNetV2(include_top=False, weights="imagenet")`, so the pretrained weights come from Keras applications, **not TF Hub**. It's wrapped in a Keras Functional API model: rescale to [-1, 1] → MobileNetV2 → `gradcam_conv` 1×1 conv (256) → BN/ReLU6 → **`ChannelAttention`** (custom squeeze-and-excitation layer) → dual pooling (GAP ‖ GMP) → dropout → dense 160 (swish) → softmax over 4 classes.
- **Custom components** (`app/ml/custom_model.py`, all registered for `.keras` reload):
  - `ChannelAttention` (layer)
  - `ClassWeightedFocalLoss` (loss; γ = 1.5, label smoothing 0.05, √-inverse-frequency class weights)
  - `MacroF1Checkpoint` (callback; saves the best val macro-F1 checkpoint)
- **Training** (`python -m app.ml.train`):
  - Two-stage `tf.GradientTape` loop: a frozen-backbone warm-up, then fine-tuning of the top 38 backbone layers with BatchNorm kept frozen. AdamW with cosine decay.
  - Class-balanced sampling, train-only augmentation (flip, colour jitter, random crop) and MixUp on 25% of batches.
- **Inference:** averages 4 TTA views (original, horizontal flip, 90% centre crop, flipped crop).
- **Decision weights (new in 2.1.0):** per-class multipliers `[caries 2.5, calculus 2.5, gingivitis 1.75, healthy 1.0]`.
  - They were chosen by grid search on the **validation split only**. The objective was the best val macro-F1, subject to val caries recall ≥ 0.85, with a small penalty for moving away from 1.0. The test split was never used for training, checkpoint selection or tuning.
  - The weights only choose the class. The reported probabilities and confidence stay the model's raw TTA outputs, so the urgency (`caries` ≥ 0.85 → emergency) and unsure (`CONFIDENCE_THRESHOLD`, default 0.60: below it the app shows "unsure, retake the photo" instead of a label) thresholds keep their meaning.
- **Serving rules outside the model** (`app/ml/inference.py`): the model's label and confidence are final. Before the model runs, Gemini Vision may be asked one question, "is this a clear photo of teeth?", and only when the OpenCV colour heuristic is unsure; it can reject the photo (`NOT_DENTAL_IMAGE`) but never changes the label. When Gemini is unavailable or not asked, an offline out-of-distribution guard rejects photos with very low top probability. The metrics below cover the model plus the decision weights.

## 4. Metrics (held-out test set, n = 255)

Evaluated with `python -m app.ml.evaluate`. Exact numbers are in `models/model_meta.json` and `models/candidates/*.json`.

### Served model: MobileNetV2 2.1.0

| Variant | Accuracy | Macro-F1 | caries | calculus | gingivitis | healthy |
|---|---:|---:|---:|---:|---:|---:|
| **TTA + decision weights (served)** | **0.839** | **0.839** | **0.893** | 0.851 | 0.800 | 0.875 |
| TTA, plain argmax (2.0.0 as served before) | 0.808 | 0.793 | 0.714 | 0.730 | 0.848 | 0.896 |
| Single view + decision weights | 0.808 | 0.814 | 0.929 | 0.946 | 0.648 | 0.875 |
| Single view, plain argmax | 0.765 | 0.744 | 0.571 | 0.662 | 0.819 | 0.917 |

Per-class columns are recall.

Confusion matrices (rows = true, columns = predicted; order caries, calculus, gingivitis, healthy):

```
Served (TTA + weights)        Before (TTA, argmax)
[25,  0,  2,  1]              [20,  0,  3,  5]
[ 1, 63, 10,  0]              [ 1, 54, 17,  2]
[ 8, 10, 84,  3]              [ 7,  5, 89,  4]
[ 1,  2,  3, 42]              [ 1,  1,  3, 43]
```

**Trade-off:** caries misses fell from 8 to 3, and calculus→gingivitis errors fell from 17 to 10. In exchange, gingivitis recall dropped from 0.85 to 0.80: more gingivitis is called calculus (5 → 10) or caries (7 → 8). Healthy recall dropped slightly (0.90 → 0.88). Caries precision is 0.71 (25/35). For a screening aid that always recommends seeing a dentist, we accept over-calling pathology in preference to missing caries.

**Uncertainty:** the test set has only 28 caries images, so one image moves caries recall by 3.6 points. An approximate 95% Wilson interval for caries recall of 25/28 is 0.73–0.96. The decision weights were tuned on just 29 val caries images.

### All training runs (same test set, same evaluator)

| Run | Pretrained | Config | Epochs | TTA acc | TTA macro-F1 | TTA caries recall | With val-tuned weights (TTA): macro-F1 / caries recall |
|---|---|---|---:|---:|---:|---:|---|
| `dentify-mobilenetv2-2.0.0` (**served, as 2.1.0**) | ImageNet | 2-stage fine-tune, balanced sampling, caries loss ×1.15 | 5 + 10 | 0.808 | 0.793 | 0.714 | **0.839 / 0.893** |
| T-106 original (git `4684cde`, `.keras` not kept) | none | from scratch, balanced sampling, MixUp | 55 | 0.839 | 0.809 | 0.571 | not measured |
| `baseline_t106` (2026-11-22 reproduction, **fallback**) | none | T-106 config, lr 1e-3, batch 32, patience 15 | 38 (early stop) | 0.749 | 0.710 | 0.464 | 0.695 / 0.643 |
| `improved_a` | none | + caries sampling ×1.6, loss caries ×1.25 / calculus ×1.1, strong aug (caries, calculus), checkpoint score + 0.3 × caries recall | 27 (early stop) | 0.369 | 0.384 | 0.857 | 0.420 / 0.714. **Collapsed:** never predicts gingivitis |
| `improved_b` | none | milder version of `improved_a`, seed 7 | stopped at 4 | – | – | – | Killed (machine out of memory); not evaluated |

Notes:

- **Reproduction gap:** `baseline_t106` did not reproduce the original T-106 result (0.710 vs 0.809 macro-F1). The original learning rate and patience were not recorded, and this run stopped early at epoch 38 of 55. The from-scratch comparison is therefore incomplete.
- **Why `improved_a` failed:** the caries-recall term in checkpoint selection, combined with heavy caries/calculus oversampling, saved an early checkpoint that labels almost everything as caries or calculus. Strong per-class augmentation, oversampling and class weights were therefore **not** properly evaluated on the from-scratch model.
- **Goal status:** caries recall ≥ 0.85 and lower calculus→gingivitis confusion were reached only on the pretrained model, through val-tuned decision weights. No from-scratch run met either goal.
- **Fallback:** `models/candidates/baseline_t106.keras` (not in git; `*.keras` is ignored) is kept in case the advisor rejects ImageNet weights. It would need further work before serving.

## 5. Limitations and risks

- **Source/label confound** (see §2). Probably the largest gap between test metrics and real-world performance.
- **Unknown licence** for 72% of the training data.
- **Small classes:** caries has 191 images in total. Per-class metrics carry wide intervals.
- **Single-label:** a photo with both calculus and gingivitis (common in practice) gets one label. Calculus and gingivitis remain the most confused pair.
- **Image domain:** curated clinical/website photos, not the user's phone selfies. The quality gate only rejects blank frames, so blurry or dark photos still reach the model.
- **Demographics:** age, skin tone, dental work (braces, fillings, crowns) and camera device were not recorded, so subgroup performance is unknown.
- **Pretrained weights:** ImageNet weights may conflict with the capstone brief's no-pretrained default. Advisor confirmation is pending.
- **Serving behaviour differs from the evaluated model:** the Gemini gate and the out-of-distribution guard can reject photos (never relabel them), and how often they reject real dental photos has not been measured on the test set.

## 6. Reproduce

```bash
cd ai-service
python -m app.ml.train                                   # MobileNetV2 -> models/candidates/mobilenetv2.keras
python -m app.ml.train_scratch --tag baseline_t106       # from-scratch fallback -> models/candidates/
python -m app.ml.evaluate --model models/dentify_model.keras --out eval.json
```

Training writes to `models/candidates/` only. Promote a model by hand after comparing it with `models/backup/` and the served model. Copy the decision weights from the evaluation JSON (`decision_weights_tta.weights`) into `model_meta.json` → `decision_weights`.
