# DentHub Data Science Workspace

Data wrangling, perceptual-hash deduplication, leak-free splitting, feature engineering, EDA notebooks, CLAHE A/B testing, technical PDF generation, and the Streamlit analytics dashboard (`CC26-PSU285`).

## Structure

```
data-science/
├── data/
│   ├── raw/          # Raw Kaggle datasets (gitignored)
│   └── processed/    # Cleaned train/val/test splits, manifest.csv, engineered_features.csv, data_dictionary.md (gitignored)
├── notebooks/
│   ├── 01_data_wrangling_and_eda.ipynb
│   └── 02_ab_test_clahe.ipynb
├── outputs/
│   ├── charts/       # Explanatory PNG charts
│   └── ab_test_results.json
├── wrangle.py        # T-104: Gather, assess, clean, dHash dedupe, stratified group split
├── features.py       # T-105: Image-quality feature engineering & EDA charts/notebook
├── app.py            # T-105 / T-402: Streamlit dashboard
├── ab_test.py        # T-401: Baseline vs CLAHE McNemar A/B test
└── generate_report_pdf.py  # T-403: Capstone Technical Report PDF generator
```

## Commands

```bash
pip install -r requirements.txt
python wrangle.py
python features.py
streamlit run app.py
python ab_test.py
python generate_report_pdf.py
ruff check .
```
