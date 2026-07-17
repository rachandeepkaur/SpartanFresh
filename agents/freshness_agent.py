from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

import joblib
import pandas as pd

MODEL_PATH = Path(__file__).with_name("freshness_model.joblib")

PRODUCE_PROFILES = {
    "apple": {"Fruit": "Apples", "Fruit Type": "Climacteric", "Seasonality": "Seasonal", "Fruit Baseline MQ3": 178},
    "apples": {"Fruit": "Apples", "Fruit Type": "Climacteric", "Seasonality": "Seasonal", "Fruit Baseline MQ3": 178},
    "banana": {"Fruit": "Banana", "Fruit Type": "Climacteric", "Seasonality": "Seasonal", "Fruit Baseline MQ3": 176},
    "bananas": {"Fruit": "Banana", "Fruit Type": "Climacteric", "Seasonality": "Seasonal", "Fruit Baseline MQ3": 176},
    "mango": {"Fruit": "Mango", "Fruit Type": "Climacteric & non-seasonal", "Seasonality": "Non-seasonal", "Fruit Baseline MQ3": 175},
    "mangoes": {"Fruit": "Mango", "Fruit Type": "Climacteric & non-seasonal", "Seasonality": "Non-seasonal", "Fruit Baseline MQ3": 175},
    "orange": {"Fruit": "Orange", "Fruit Type": "Non-climacteric", "Seasonality": "Seasonal", "Fruit Baseline MQ3": 170},
    "oranges": {"Fruit": "Orange", "Fruit Type": "Non-climacteric", "Seasonality": "Seasonal", "Fruit Baseline MQ3": 170},
    "lemon": {"Fruit": "Lemon", "Fruit Type": "Non-climacteric", "Seasonality": "Seasonal", "Fruit Baseline MQ3": 167},
    "lemons": {"Fruit": "Lemon", "Fruit Type": "Non-climacteric", "Seasonality": "Seasonal", "Fruit Baseline MQ3": 167},
}

PRODUCE_CATEGORIES = {"produce", "fruit", "fruits", "vegetable", "vegetables"}

PACKAGED_CATEGORIES = {
    "bakery", "dairy", "canned", "canned food", "pantry", "frozen",
    "grain", "grains", "protein", "beverages", "breakfast", "infant", "snacks",
}

@dataclass
class FreshnessResult:
    item: str
    method: str
    remaining_days: float
    urgency: str
    confidence: float
    reason: str


def classify_urgency(days: float) -> str:
    if days <= 0:
        return "Expired"
    if days <= 1:
        return "Critical"
    if days <= 3:
        return "Use Soon"
    if days <= 7:
        return "Normal"
    return "Fresh"


def parse_date(value: Any) -> Optional[date]:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.date()


def normalize_key(value: Any) -> str:
    return str(value or "").strip().lower()


def first_present(item: dict[str, Any], *keys: str, default: Any = None) -> Any:
    """Read aliases without treating valid numeric zero values as missing."""
    for key in keys:
        value = item.get(key)
        if value is not None and not (isinstance(value, float) and pd.isna(value)):
            return value
    return default


class FreshnessAgent:
    def __init__(self, model_path: Path | str = MODEL_PATH):
        self.model_bundle = joblib.load(model_path) if Path(model_path).exists() else None

    def evaluate_item(self, item: dict[str, Any], today: date | None = None) -> FreshnessResult:
        today = today or date.today()
        name = str(first_present(item, "item", "Item Name", "name", default="Unknown")).strip()
        category = normalize_key(first_present(item, "category", "Category"))
        expiry_date = parse_date(first_present(item, "expiry_date", "Expiry Date", "expiry"))
        mq3 = first_present(item, "mq3_sensor_output", "MQ3 Sensor Output", "mq3")

        # Packaged branch: exact date math when a printed expiry date exists.
        if expiry_date is not None and (category not in PRODUCE_CATEGORIES or mq3 is None):
            days = float((expiry_date - today).days)
            urgency = classify_urgency(days)
            return FreshnessResult(
                item=name,
                method="expiry_date_rule",
                remaining_days=round(days, 2),
                urgency=urgency,
                confidence=1.0,
                reason=f"Calculated from printed expiry date {expiry_date.isoformat()}.",
            )

        # Produce branch: ethylene/MQ3 model.
        produce_key = normalize_key(name)
        profile = PRODUCE_PROFILES.get(produce_key)
        if profile and mq3 is not None and self.model_bundle is not None:
            hours = float(first_present(item, "hours_since_storage", "Hours Since Storage", default=24))
            temp = float(first_present(item, "temperature_c", "Temperature C", default=22))
            humidity = float(first_present(item, "humidity_percent", "Humidity %", default=60))
            mq3 = float(mq3)
            baseline = float(profile["Fruit Baseline MQ3"])
            row = {
                **profile,
                "Hours Since Storage": hours,
                "MQ3 Sensor Output": mq3,
                "Delta From Baseline": mq3 - baseline,
                "Temperature C": temp,
                "Humidity %": humidity,
            }
            X = pd.DataFrame([row], columns=self.model_bundle["features"])
            days = float(self.model_bundle["pipeline"].predict(X)[0])
            days = max(0.0, days)
            urgency = classify_urgency(days)
            confidence = max(0.55, min(0.95, 0.95 - abs(mq3 - baseline) / 100))
            return FreshnessResult(
                item=name,
                method="mq3_ethylene_model",
                remaining_days=round(days, 2),
                urgency=urgency,
                confidence=round(confidence, 2),
                reason="Predicted from MQ3 sensor output used as an ethylene proxy.",
            )

        # Fallback branch: use shelf-life defaults when neither date nor MQ3 is present.
        default_days = 5.0 if category in PRODUCE_CATEGORIES else 14.0
        return FreshnessResult(
            item=name,
            method="fallback_default",
            remaining_days=default_days,
            urgency=classify_urgency(default_days),
            confidence=0.35,
            reason="No usable expiry date or MQ3 produce reading was provided.",
        )

    def evaluate_dataframe(self, df: pd.DataFrame, today: date | None = None) -> pd.DataFrame:
        results = [asdict(self.evaluate_item(row.dropna().to_dict(), today=today)) for _, row in df.iterrows()]
        out = df.copy()
        res = pd.DataFrame(results)
        for col in res.columns:
            out[col if col not in out.columns else f"freshness_{col}"] = res[col]
        return out


def process_excel(input_path: str, output_path: str, sheet_name: str = 0, today: str | None = None) -> str:
    run_date = parse_date(today) if today else date.today()
    df = pd.read_excel(input_path, sheet_name=sheet_name)
    agent = FreshnessAgent()
    enriched = agent.evaluate_dataframe(df, today=run_date)
    enriched.to_excel(output_path, index=False)
    return output_path


if __name__ == "__main__":
    demo_items = [
        {"item": "Milk", "category": "Dairy", "expiry_date": "2026-07-20"},
        {"item": "Banana", "category": "Produce", "mq3_sensor_output": 190, "hours_since_storage": 96, "temperature_c": 22, "humidity_percent": 60},
        {"item": "Apples", "category": "Produce", "mq3_sensor_output": 191, "hours_since_storage": 84, "temperature_c": 21, "humidity_percent": 65},
    ]
    agent = FreshnessAgent()
    for demo in demo_items:
        print(asdict(agent.evaluate_item(demo, today=date(2026, 7, 17))))
