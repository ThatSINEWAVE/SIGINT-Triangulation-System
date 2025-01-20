# SIGINT Triangulation System

The **SIGINT Triangulation System** is a web-based application designed to simulate and visualize signal triangulation using geospatial data. It enables users to input signal sources, bearings, frequencies, and signal strengths to calculate a target location using geodesic intersection methods.

## Features

- **Dynamic Input Form**: Add and manage multiple signal sources with customizable parameters.
- **Interactive Map**: Displays signal source locations, bearings, and triangulated target positions on a dark-themed Leaflet map.
- **Data Processing**: Validates input and calculates intersections for accurate triangulation.
- **Export Options**: Export the map as an image or generate a detailed text-based report.
- **Responsive Design**: Optimized for desktop and mobile browsers.

<div align="center">

## ☕ [Support my work on Ko-Fi](https://ko-fi.com/thatsinewave)

</div>

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Mapping Library**: [Leaflet](https://leafletjs.com/)
- **External Libraries**:
  - Leaflet Image Export
  - Google Fonts (Inter, Roboto Mono)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/sigint-triangulation-system.git
   ```
2. Navigate to the project folder:
   ```bash
   cd sigint-triangulation-system
   ```
3. Open `index.html` in your preferred web browser.

## Usage

1. **Add Signal Sources**: Use the "Add Signal Source" button to add rows for signal data.
2. **Enter Parameters**:
   - Signal Source Location: Latitude and Longitude (e.g., `44.4268,26.1025`).
   - Bearing: Direction in degrees (0–360°).
   - Frequency: Signal frequency in MHz.
   - Signal Strength: Strength in dB.
3. **Triangulate Position**: Click "Triangulate Position" to calculate the target location.
4. **View Results**: See the triangulated coordinates and confidence level on the map and in the results section.
5. **Export Data**: Use the "Export Map" or "Export Report" buttons to save outputs.

## How It Works

1. **Geodesic Intersection**:
   - Bearing lines are drawn from the source locations based on input bearings.
   - Intersection points are calculated using geodesic mathematics.
2. **Weighted Intersection**:
   - Multiple intersections are averaged to determine the most probable target location.

## Limitations

- Requires an an internet connection.
- Requires at least two signal sources for triangulation.
- Assumes accurate user input for reliable results.

## Future Enhancements

- Add support for real-time GPS integration.
- Offline support.
- Improve confidence level calculations with advanced algorithms.
- Enhance visualization with additional map themes.

## Contributing

Contributions are welcome! If you find any bugs or have suggestions for improvements, please feel free to open an issue or submit a pull request.

<div align="center">

## [Join my discord server](https://discord.gg/2nHHHBWNDw)

</div>

## License

This project is licensed under the [GPL-3.0 license](LICENSE).
