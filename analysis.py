"""Reproducible, dependency-free analysis for the India unemployment datasets."""

import csv
from collections import defaultdict
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"
OUTPUT_DIR = ROOT / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)


def load_csv(path: Path) -> list[dict[str, object]]:
    rows = []
    with path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            try:
                row = {str(key).strip(): (value or "").strip() for key, value in row.items() if key}
                row["Date"] = datetime.strptime(row["Date"], "%d-%m-%Y")
                row["rate"] = float(row["Estimated Unemployment Rate (%)"])
                row["Region"] = row["Region"].strip()
                rows.append(row)
            except (AttributeError, KeyError, ValueError):
                continue
    return rows


def save_svg(path: Path, title: str, points: list[tuple[str, float]], marker: str | None = None) -> None:
    width, height, left, bottom = 900, 430, 70, 55
    values = [value for _, value in points]
    maximum = max(values) * 1.1 or 1
    chart_width, chart_height = width - left - 25, height - bottom - 35
    coordinates = [
        (left + index * chart_width / max(1, len(points) - 1), height - bottom - value / maximum * chart_height)
        for index, (_, value) in enumerate(points)
    ]
    line = " ".join(f"{x:.1f},{y:.1f}" for x, y in coordinates)
    marker_line = ""
    if marker and marker in [label for label, _ in points]:
        marker_index = [label for label, _ in points].index(marker)
        marker_x = coordinates[marker_index][0]
        marker_line = f'<line x1="{marker_x:.1f}" y1="35" x2="{marker_x:.1f}" y2="{height - bottom}" stroke="#ef7651" stroke-dasharray="6 5" />'
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}"><rect width="100%" height="100%" fill="#f7faf5"/><text x="35" y="30" font-family="sans-serif" font-size="20" font-weight="bold" fill="#17231f">{title}</text><line x1="{left}" y1="{height-bottom}" x2="{width-25}" y2="{height-bottom}" stroke="#b8c8bd"/><polyline points="{line}" fill="none" stroke="#155c56" stroke-width="4" stroke-linejoin="round"/>{marker_line}<text x="{left}" y="{height-18}" font-family="monospace" font-size="12" fill="#718079">timeline</text><text x="15" y="{height//2}" transform="rotate(-90 15 {height//2})" font-family="monospace" font-size="12" fill="#718079">rate (%)</text></svg>'''
    path.write_text(svg, encoding="utf-8")


def main() -> None:
    main_data, geo_data = load_csv(DATA_DIR / "Unemployment in India.csv"), load_csv(DATA_DIR / "Unemployment_Rate_upto_11_2020.csv")
    monthly_values = defaultdict(list)
    state_values = defaultdict(list)
    for row in main_data:
        monthly_values[row["Date"].strftime("%Y-%m")].append(row["rate"])
        state_values[row["Region"]].append(row["rate"])
    monthly = sorted((month, sum(values) / len(values)) for month, values in monthly_values.items())
    baseline = sum(value for month, value in monthly if month.startswith("2019")) / len([month for month, _ in monthly if month.startswith("2019")])
    april_2020 = next(value for month, value in monthly if month == "2020-04")
    print(f"Main observations: {len(main_data):,}")
    print(f"Geographic observations: {len(geo_data):,}")
    print(f"Average unemployment rate: {sum(row['rate'] for row in main_data) / len(main_data):.2f}%")
    print(f"April 2020 impact over 2019 baseline: {april_2020 - baseline:.2f} percentage points")
    print("Highest-average states:")
    print(
        "\n".join(f"{region}: {sum(values) / len(values):.2f}%" for region, values in sorted(state_values.items(), key=lambda item: sum(item[1]) / len(item[1]), reverse=True)[:5])
    )

    save_svg(OUTPUT_DIR / "unemployment-trend.svg", "India unemployment rate over time", monthly, "2020-04")
    highest_states = sorted(((region, sum(values) / len(values)) for region, values in state_values.items()), key=lambda item: item[1], reverse=True)[:10]
    save_svg(OUTPUT_DIR / "state-comparison.svg", "Ten highest-average state rates", highest_states)
    print(f"Charts saved to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()