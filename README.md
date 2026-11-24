# Dentify

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

## Website

Visit the Deployment Website: https://dentifyd.vercel.app

## Model

The screening model is **MobileNetV2 transfer learning** loaded from `keras.applications` (ImageNet weights; not TF Hub, not AutoML), as named in the Project Plan. The model is built with the Keras Functional API and adds custom components: a `ChannelAttention` layer, a dual (avg + max) pooling head, `ClassWeightedFocalLoss`, a `MacroF1Checkpoint` callback, and a two-stage (warm-up, then fine-tune) `tf.GradientTape` training loop. Input is CLAHE-normalised 224×224 RGB, and inference averages 4 test-time-augmentation (TTA) views. Per-class decision weights (`decision_weights` in `model_meta.json`) are tuned on the validation split only. They choose the class; the reported probabilities and confidence remain the model's raw outputs.

Current metrics (held-out test set, n = 255, model `dentify-mobilenetv2-2.1.0`, source: `ai-service/models/model_meta.json`):

|                                           | Accuracy  | Macro-F1 | Caries recall |
| ----------------------------------------- | --------- | -------- | ------------- |
| TTA + val-tuned decision weights (served) | **83.9%** | **0.84** | **0.89**      |
| TTA, plain argmax                         | 80.8%     | 0.79     | 0.71          |
| Single view + val-tuned weights           | 80.8%     | 0.81     | 0.93          |
| Single view, plain argmax                 | 76.5%     | 0.74     | 0.57          |

## Copyright

© 2026 Faris Jihadi Hanif Lubis. All rights reserved.

This repository is public for portfolio and review purposes only. No license is granted: you may view the code, but you may not copy, modify, redistribute, or use it in other projects without my written permission.

Repositori ini dipublikasikan hanya untuk keperluan portofolio. Kode boleh dilihat, tetapi tidak boleh disalin, diubah, disebarkan, atau digunakan tanpa izin tertulis dari saya.

Contact: [LinkedIn](https://www.linkedin.com/in/faris-jihadi-hanif-lubis-62337a286/)
