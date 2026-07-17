"""Train the MQ3 produce freshness model used by ``freshness_agent.py``.

The workbook contains synthetic demonstration data, so this model is useful
for the application demo but should not be treated as a food-safety system.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

DEFAULT_DATASET = Path(__file__).parent / "mock_data" / "Synthetic_MQ3_Freshness_Dataset.xlsx"
DEFAULT_MODEL = Path(__file__).with_name("freshness_model.joblib")
TARGET = "Estimated Remaining Days"

CATEGORICAL_FEATURES = ["Fruit", "Fruit Type", "Seasonality"]
NUMERIC_FEATURES = [
    "Hours Since Storage",
    "MQ3 Sensor Output",
    "Fruit Baseline MQ3",
    "Delta From Baseline",
    "Temperature C",
    "Humidity %",
]
FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES


def train_model(dataset_path: Path, model_path: Path) -> dict[str, float]:
    data = pd.read_excel(dataset_path, sheet_name="Synthetic_MQ3_Data")
    missing_columns = sorted(set(FEATURES + [TARGET]) - set(data.columns))
    if missing_columns:
        raise ValueError(f"Dataset is missing columns: {', '.join(missing_columns)}")

    training_data = data[FEATURES + [TARGET]].dropna()
    if training_data.empty:
        raise ValueError("Dataset has no complete rows to train on")

    X_train, X_test, y_train, y_test = train_test_split(
        training_data[FEATURES],
        training_data[TARGET],
        test_size=0.2,
        random_state=42,
    )

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "categories",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
            ("numbers", "passthrough", NUMERIC_FEATURES),
        ]
    )
    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "regressor",
                RandomForestRegressor(
                    n_estimators=300,
                    min_samples_leaf=2,
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test)
    metrics = {
        "mae_days": float(mean_absolute_error(y_test, predictions)),
        "r2": float(r2_score(y_test, predictions)),
        "training_rows": float(len(X_train)),
        "test_rows": float(len(X_test)),
    }

    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "pipeline": pipeline,
            "features": FEATURES,
            "metrics": metrics,
            "dataset": str(dataset_path),
        },
        model_path,
    )
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--output", type=Path, default=DEFAULT_MODEL)
    args = parser.parse_args()

    metrics = train_model(args.dataset, args.output)
    print(f"Saved model to {args.output}")
    print(f"MAE: {metrics['mae_days']:.2f} days | R²: {metrics['r2']:.3f}")


if __name__ == "__main__":
    main()
