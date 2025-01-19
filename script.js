let rowCount = 0;

// Initialize Leaflet map
const map = L.map('map').setView([0, 0], 2);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors',
}).addTo(map);

// Add a new row
function addRow() {
  const tableBody = document.getElementById('input-rows');
  rowCount++;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text" name="position-${rowCount}" placeholder="Lat,Lng" required></td>
    <td><input type="number" name="bearing-${rowCount}" min="0" max="360" required></td>
    <td><input type="number" name="freq-${rowCount}" required></td>
    <td><input type="number" name="signal-${rowCount}" required></td>
    <td><button type="button" onclick="removeRow(this)">Remove</button></td>
  `;
  tableBody.appendChild(row);
}

// Remove a specific row
function removeRow(button) {
  const row = button.parentNode.parentNode;
  row.remove();
}

// Process the input data
function processData() {
  const rows = document.querySelectorAll('#input-rows tr');
  if (rows.length < 2) {
    alert('At least two data rows are required for triangulation.');
    return;
  }

  const data = Array.from(rows).map(row => {
    const inputs = row.querySelectorAll('input');
    const [lat, lng] = inputs[0].value.split(',').map(Number);
    const bearing = parseFloat(inputs[1].value);
    return { position: [lat, lng], bearing };
  });

  calculateIntersection(data);
}

// Calculate intersections and update the map
function calculateIntersection(data) {
  map.setView(data[0].position, 12); // Center map on the first data point

  const lines = data.map((d, index) => {
    // Project the bearing line
    const endPoint = destinationPoint(d.position, d.bearing, 100); // 100 km projection

    // Generate unique color for the line
    const lineColor = `hsl(${(index * 360) / data.length}, 100%, 50%)`;

    // Draw line on the map
    const line = L.polyline([d.position, endPoint], { color: lineColor }).addTo(map);

    // Add a numbered label at the starting point
    L.marker(d.position, {
      icon: L.divIcon({
        className: 'line-label',
        html: `<div style="color: ${lineColor}; font-weight: bold;">${index + 1}</div>`,
      }),
    }).addTo(map);

    // Return the bearing line data
    return { start: d.position, bearing: d.bearing };
  });

  // Calculate the intersection point using geodesics
  const intersection = calculateGeodesicIntersection(lines);
  if (intersection) {
    // Add marker for the calculated intersection
    L.marker(intersection, { color: 'blue' })
      .addTo(map)
      .bindPopup('Calculated Intersection')
      .openPopup();

    document.getElementById('result-coords').textContent = `Coordinates: ${intersection[0].toFixed(6)}, ${intersection[1].toFixed(6)}`;
  } else {
    alert('No intersection found. Ensure the data is correct and the bearings form an intersection.');
    document.getElementById('result-coords').textContent = 'Coordinates: N/A';
  }
}

// Helper function: Destination point from given lat/lng, bearing, and distance
function destinationPoint([lat, lng], bearing, distance) {
  const R = 6371; // Earth's radius in km
  const bearingRad = (bearing * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(latRad) * Math.cos(distance / R) +
      Math.cos(latRad) * Math.sin(distance / R) * Math.cos(bearingRad)
  );
  const lng2 =
    lngRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(latRad),
      Math.cos(distance / R) - Math.sin(latRad) * Math.sin(lat2)
    );

  return [(lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI];
}

// Helper function: Find geodesic intersection
function calculateGeodesicIntersection(lines) {
  const intersections = [];

  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const intersection = geodesicIntersection(
        lines[i].start,
        lines[i].bearing,
        lines[j].start,
        lines[j].bearing
      );
      if (intersection) {
        intersections.push(intersection);
      }
    }
  }

  if (intersections.length === 0) return null;

  // Average the intersections to find a central point
  const avgLat =
    intersections.reduce((sum, point) => sum + point[0], 0) / intersections.length;
  const avgLng =
    intersections.reduce((sum, point) => sum + point[1], 0) / intersections.length;

  return [avgLat, avgLng];
}

// Helper function: Calculate intersection of two geodesics
function geodesicIntersection([lat1, lng1], brng1, [lat2, lng2], brng2) {
  const φ1 = (lat1 * Math.PI) / 180,
    λ1 = (lng1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180,
    λ2 = (lng2 * Math.PI) / 180;
  const θ13 = (brng1 * Math.PI) / 180,
    θ23 = (brng2 * Math.PI) / 180;
  const Δφ = φ2 - φ1,
    Δλ = λ2 - λ1;

  const δ12 =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
      )
    );

  if (Math.abs(δ12) < 1e-10) return null;

  const θa = Math.acos(
    (Math.sin(φ2) - Math.sin(φ1) * Math.cos(δ12)) /
      (Math.sin(δ12) * Math.cos(φ1))
  );
  const θb = Math.acos(
    (Math.sin(φ1) - Math.sin(φ2) * Math.cos(δ12)) /
      (Math.sin(δ12) * Math.cos(φ2))
  );

  const θ12 = Math.sin(λ2 - λ1) > 0 ? θa : 2 * Math.PI - θa;
  const θ21 = Math.sin(λ2 - λ1) > 0 ? 2 * Math.PI - θb : θb;

  const α1 = (θ13 - θ12 + Math.PI) % (2 * Math.PI) - Math.PI;
  const α2 = (θ21 - θ23 + Math.PI) % (2 * Math.PI) - Math.PI;

  if (Math.sin(α1) === 0 && Math.sin(α2) === 0) return null;
  if (Math.sin(α1) * Math.sin(α2) < 0) return null;

  const α3 = Math.acos(
    -Math.cos(α1) * Math.cos(α2) +
      Math.sin(α1) * Math.sin(α2) * Math.cos(δ12)
  );
  const δ13 = Math.atan2(
    Math.sin(δ12) * Math.sin(α1) * Math.sin(α2),
    Math.cos(α2) + Math.cos(α1) * Math.cos(α3)
  );

  const φ3 = Math.asin(
    Math.sin(φ1) * Math.cos(δ13) +
      Math.cos(φ1) * Math.sin(δ13) * Math.cos(θ13)
  );
  const Δλ13 = Math.atan2(
    Math.sin(θ13) * Math.sin(δ13) * Math.cos(φ1),
    Math.cos(δ13) - Math.sin(φ1) * Math.sin(φ3)
  );
  const λ3 = λ1 + Δλ13;

  return [(φ3 * 180) / Math.PI, (λ3 * 180) / Math.PI];
}


// Reset the form, rows, and map
function resetData() {
  // Clear input rows
  document.getElementById('input-rows').innerHTML = '';
  rowCount = 0; // Reset row count

  // Add a default row
  addRow();

  // Clear map layers except for the tile layer
  map.eachLayer(layer => {
    if (layer instanceof L.Marker || layer instanceof L.Polyline) {
      map.removeLayer(layer);
    }
  });

  // Reset output
  document.getElementById('result-coords').textContent = 'Coordinates: N/A';

  // Recenter the map
  map.setView([0, 0], 2);
}

// Add event listeners to buttons
document.getElementById('add-row').addEventListener('click', addRow);
document.getElementById('process-data').addEventListener('click', processData);
document.getElementById('reset-data').addEventListener('click', resetData);

// Add the first row by default
addRow();
