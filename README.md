# Dentify (CC26-PSU285)

**Dentify** (Capstone `CC26-PSU285`, Coding Camp 2026 × DBS Foundation) is a mobile-responsive web application for **early, non-diagnostic dental screening**. Users capture or upload a dental photo; a TensorFlow/Keras Computer Vision model (MobileNetV2 transfer learning via `keras.applications`, with custom layer, loss, and callback; advisor confirmation pending) detects `caries`, `calculus`, `gingivitis`, or `healthy`; **Deni** (LangChain + Gemini) explains the screening result and builds an Indonesian self-care plan; and **Clinic Finder** (OpenStreetMap Overpass + Nominatim + Leaflet) locates nearby dentists, automatically on emergency triggers.

## Monorepo Structure

```
dentify/
├── frontend/       Next.js (App Router) + TypeScript + Tailwind + Framer Motion + Three.js + Leaflet (:3000)
├── backend/        Express + TypeScript + Mongoose + Zod + Multer + Vitest (:5000)
├── ai-service/     FastAPI + TensorFlow/Keras (.keras) + OpenCV + LangChain/Gemini (:8000)
├── data-science/   Data wrangling, feature engineering, EDA notebooks, A/B test, Streamlit dashboard (:8501)
├── scripts/        End-to-end smoke verification (`e2e-smoke.js`)
└── render.yaml     Render Blueprint (backend + ai-service)
```

Specs (`docs/`) and agent instructions (`AGENTS.md`, `CLAUDE.md`) are kept local and are not part of this repository.

## Quick Start (Local Development)

Copy `.env.example` → `.env` (or `.env.local` for frontend) in each service folder and fill required values (`MONGODB_URI`, `JWT_SECRET`, `AI_SERVICE_API_KEY`, `GEMINI_API_KEY`).

| Service | Install | Dev | Test | Lint | Build |
|---|---|---|---|---|---|
| `frontend/` (:3000) | `npm install` | `npm run dev` | `npm test` | `npm run lint` | `npm run build` |
| `backend/` (:5000) | `npm install` | `npm run dev` | `npm test` | `npm run lint` | `npm run build` |
| `ai-service/` (:8000) | `pip install -r requirements-train.txt` | `uvicorn app.main:app --reload --port 8000` | `pytest` | `ruff check .` | – |
| `data-science/` (:8501) | `pip install -r requirements.txt` | `streamlit run app.py` | – | `ruff check .` | – |

Seed MongoDB (`dental_knowledge`, `articles`, `clinic_directory`, and initial Admin from env):
```bash
cd backend && npm run seed
```

## Data Science & ML Pipeline

```bash
# 1. Gather, assess, clean, dHash dedupe, and leak-free split (70/15/15)
cd data-science && python wrangle.py

# 2. Extract engineered image-quality features, charts, and EDA notebook
python features.py

# 3. Fine-tune the MobileNetV2 transfer-learning model (2-stage tf.GradientTape loop) -> models/candidates/
cd ../ai-service && python -m app.ml.train
#    From-scratch fallback (weights=None):  python -m app.ml.train_scratch --tag baseline_t106
#    Evaluate any model (test set, with/without TTA, val-tuned decision weights):
python -m app.ml.evaluate --model models/candidates/mobilenetv2.keras

# 4. Run standalone CLI inference
python -m app.ml.infer_cli <path-to-dental-photo.jpg>

# 5. Run Baseline vs CLAHE McNemar A/B test & generate Technical Report PDF
cd ../data-science && python ab_test.py && python generate_report_pdf.py
```

## Model

The screening model is **MobileNetV2 transfer learning** loaded from `keras.applications` (ImageNet weights; not TF Hub, not AutoML), as named in the Project Plan. The model is built with the Keras Functional API and adds custom components: a `ChannelAttention` layer, a dual (avg + max) pooling head, `ClassWeightedFocalLoss`, a `MacroF1Checkpoint` callback, and a two-stage (warm-up, then fine-tune) `tf.GradientTape` training loop. Input is CLAHE-normalised 224×224 RGB, and inference averages 4 test-time-augmentation (TTA) views. Per-class decision weights (`decision_weights` in `model_meta.json`) are tuned on the validation split only. They choose the class; the reported probabilities and confidence remain the model's raw outputs.

> **Advisor confirmation pending** on the use of ImageNet pretrained weights. A from-scratch fallback (`weights=None`, `app.ml.train_scratch`) is kept in `ai-service/models/candidates/baseline_t106.keras`. It is weaker (test macro-F1 0.71) and is not served.

Current metrics (held-out test set, n = 255, model `dentify-mobilenetv2-2.1.0`, source: `ai-service/models/model_meta.json`):

| | Accuracy | Macro-F1 | Caries recall |
|---|---|---|---|
| TTA + val-tuned decision weights (served) | **83.9%** | **0.84** | **0.89** |
| TTA, plain argmax | 80.8% | 0.79 | 0.71 |
| Single view + val-tuned weights | 80.8% | 0.81 | 0.93 |
| Single view, plain argmax | 76.5% | 0.74 | 0.57 |

Served per-class recall: caries 0.89, calculus 0.85, gingivitis 0.80, healthy 0.88. The decision weights reduced calculus→gingivitis confusion from 17 to 10 test images, but more gingivitis is now called caries or calculus. The test set has only 28 caries images, so these figures carry wide uncertainty. Full details, every training run, data licences and limitations: [`ai-service/training/MODEL_CARD.md`](ai-service/training/MODEL_CARD.md). This is a screening aid, not a diagnosis.

## Deployment Targets

Step-by-step guide (Indonesian): [`DEPLOY.md`](DEPLOY.md). Everything fits free tiers:

- **Frontend:** Vercel (root directory `frontend/`, `frontend/vercel.json`). The build fails unless `NEXT_PUBLIC_API_URL` is an `https://…/api/v1` URL.
- **Backend & AI Service:** Render Free plan via the `render.yaml` Blueprint (health checks on `/healthz`). Both services sleep after 15 minutes idle; the frontend shows a "Server sedang dinyalakan" state with retry while they wake (~1 minute). `backend/railway.json` and `ai-service/railway.json` remain as an alternative.
- **Database:** MongoDB Atlas (M0 free cluster).
- **Analytics Dashboard:** Streamlit Cloud (`data-science/app.py`) — *Public URL: pending Streamlit Cloud account deployment (T-402)*

Every URL, CORS origin and key comes from environment variables. The `.env.example` files in `frontend/`, `backend/` and `ai-service/` list each variable by name only.

### Getting the model file onto the server

Production serves `ai-service/models/dentify_model.tflite` through LiteRT, without TensorFlow (peak ~185 MB RAM, fits Render's 512 MB instance; parity with the `.keras` model is in the model card). Model binaries are **not in git** (`*.keras` and `*.tflite` are ignored), so the build downloads the file:

1. `cd ai-service && python -m training.convert_tflite` (needs `requirements-train.txt`) creates the `.tflite` and checks it against the `.keras` model on the validation split.
2. Upload `dentify_model.tflite` as a GitHub Release asset (or any direct-download URL) and set `MODEL_URL` (plus optionally `MODEL_SHA256`) on the ai-service.
3. The build command runs `python scripts/fetch_model.py`, which downloads the file and fails the build if it is missing or the checksum does not match.

`MODEL_RUNTIME=keras` serves the `.keras` file with full TensorFlow instead (needs `requirements-train.txt` and more than 1 GB RAM). After re-training, convert again and re-upload both the model file and the updated `model_meta.json`.

## Capstone Compliance

Built for Project Brief `CC26-PSU285`. The compliance audit is maintained outside this repository.
