# Dentify (CC26-PSU285)

**Dentify** (Capstone `CC26-PSU285`, Coding Camp 2026 × DBS Foundation) is a mobile-responsive web application for **early, non-diagnostic dental screening**. Users capture or upload a dental photo; a TensorFlow/Keras Computer Vision model (MobileNetV2 transfer learning with custom layers, loss, and callback) detects `caries`, `calculus`, `gingivitis`, or `healthy`; **Deni** (LangChain + Gemini) explains the screening result and builds an Indonesian self-care plan; and **Clinic Finder** (OpenStreetMap Overpass + Nominatim + Leaflet) locates nearby dentists, automatically on emergency triggers.

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
| `ai-service/` (:8000) | `pip install -r requirements.txt` | `uvicorn app.main:app --reload --port 8000` | `pytest` | `ruff check .` | – |
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

# 3. Fine-tune the MobileNetV2 transfer-learning model (2-stage tf.GradientTape loop) + TensorBoard logs
cd ../ai-service && python -m app.ml.train

# 4. Run standalone CLI inference
python -m app.ml.infer_cli <path-to-dental-photo.jpg>

# 5. Run Baseline vs CLAHE McNemar A/B test & generate Technical Report PDF
cd ../data-science && python ab_test.py && python generate_report_pdf.py
```

## Model

The screening model is **not trained from scratch**. It is **transfer learning on MobileNetV2** (ImageNet weights) built with the Keras Functional API, plus custom components: a `ChannelAttention` layer, dual (avg + max) pooling head, `ClassWeightedFocalLoss`, a `MacroF1Checkpoint` callback, and a two-stage (warm-up, then fine-tune) `tf.GradientTape` training loop. Input is CLAHE-normalised 224×224 RGB; inference averages 4 test-time-augmentation (TTA) views.

Current metrics (held-out test set, n = 255, source: `ai-service/models/model_meta.json`, model `dentify-mobilenetv2-2.0.0`):

| | Accuracy | Macro-F1 |
|---|---|---|
| With 4-view TTA (served) | **80.8%** | **0.79** |
| Single view | 76.5% | 0.74 |

Per-class F1 (TTA): caries 0.70, calculus 0.81, gingivitis 0.82, healthy 0.84. Caries recall is 0.71, so treat caries results with extra caution. This is a screening aid, not a diagnosis.

## Deployment Targets

- **Frontend:** Vercel (`frontend/vercel.json`) — set `NEXT_PUBLIC_API_URL`
- **Backend & AI Service:** Railway (`backend/railway.json`, `ai-service/railway.json`) or Render (`render.yaml`) — set all `sync: false` secrets and `CORS_ORIGINS`
- **Analytics Dashboard:** Streamlit Cloud (`data-science/app.py`) — *Public URL: pending Streamlit Cloud account deployment (T-402)*

### Getting the model file onto the server

`ai-service/models/dentify_model.keras` is **not in git** (`*.keras` is ignored), so a Render/Railway build from the repo has no model. Only `model_meta.json` (labels, version, metrics) is tracked. Pick one:

1. **Download at build time (recommended).** Upload the `.keras` file to private object storage or a GitHub Release asset, store its URL as a secret env var `MODEL_URL`, and extend the ai-service build command:
   ```bash
   pip install -r requirements.txt && curl -fL "$MODEL_URL" -o models/dentify_model.keras
   ```
   (Render: `buildCommand` in `render.yaml`; Railway: `build.buildCommand` in `ai-service/railway.json`.)
2. **Persistent disk.** Attach a Render Disk / Railway Volume, copy the file there once, and set `MODEL_PATH` to its absolute path.

Re-train locally with `python -m app.ml.train` and re-upload both the `.keras` file and the updated `model_meta.json`. Without the model, `/healthz` still responds but predictions fail and the backend returns `AI_SERVICE_UNAVAILABLE`. TensorBoard logs (`ai-service/logs/`) are local-only and not needed for deployment.

## Capstone Compliance

Built for Project Brief `CC26-PSU285`. The compliance audit is maintained outside this repository.
