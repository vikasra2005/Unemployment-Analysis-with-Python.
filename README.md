# India Unemployment Observatory

An interactive, front-end-only dashboard built from the supplied unemployment CSV files.

## Run in VS Code

1. Open this folder in VS Code.
2. Make sure the two CSV files are inside `data/`.
3. Open the VS Code terminal in this folder.
4. Run `py -m http.server 5500`.
5. Open `http://localhost:5500` in your browser.

## Run the Python analysis

1. Run `py analysis.py`.
2. Open the generated SVG charts in `outputs/`.

The dashboard uses the first CSV for the main visualisation. The second CSV is included as a reference dataset for the 2020 geography fields and can be connected later for a map view.

## Features

- National unemployment and labour participation trend
- Rural versus urban comparison
- Regional ranking table
- Region, area, and period filters
- Coordinate-based geographic state view from the 2020 dataset
- Download filtered observations as CSV
- Responsive layout for laptop and mobile screens