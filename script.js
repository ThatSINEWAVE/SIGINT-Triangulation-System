let rowCount = 0;

// Initialize Leaflet map with dark theme
const darkMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '©OpenStreetMap, ©CartoDB',
    maxZoom: 19
});

const map = L.map('map', {
    layers: [darkMap],
    center: [0, 0],
    zoom: 2
});

// Custom icon for intersection point
const targetIcon = L.divIcon({
    className: 'custom-target-marker',
    html: '<div class="marker-pulse"></div>',
    iconSize: [20, 20]
});

// Add a new row
function addRow() {
    const tableBody = document.getElementById('input-rows');
    rowCount++;
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" name="position-${rowCount}" placeholder="Lat,Lng" required></td>
        <td><input type="number" name="bearing-${rowCount}" min="0" max="360" step="0.1" placeholder="0-360" required></td>
        <td><input type="number" name="freq-${rowCount}" step="0.001" placeholder="MHz" required></td>
        <td><input type="number" name="signal-${rowCount}" step="0.1" placeholder="dB" required></td>
        <td><button type="button" class="danger" onclick="removeRow(this)">Remove</button></td>
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
    const loadingSpinner = document.getElementById('process-loading');
    loadingSpinner.style.display = 'inline-block';

    const rows = document.querySelectorAll('#input-rows tr');
    if (rows.length < 2) {
        alert('At least two signal sources are required for triangulation.');
        loadingSpinner.style.display = 'none';
        return;
    }

    try {
        const data = Array.from(rows).map(row => {
            const inputs = row.querySelectorAll('input');
            const [lat, lng] = inputs[0].value.split(',').map(Number);

            if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                throw new Error('Invalid coordinates format. Use Lat,Lng format with valid ranges.');
            }

            const bearing = parseFloat(inputs[1].value);
            if (isNaN(bearing) || bearing < 0 || bearing > 360) {
                throw new Error('Bearing must be between 0 and 360 degrees.');
            }

            return {
                position: [lat, lng],
                bearing,
                frequency: parseFloat(inputs[2].value),
                signal: parseFloat(inputs[3].value)
            };
        });

        setTimeout(() => {
            calculateIntersection(data);
            loadingSpinner.style.display = 'none';
            document.getElementById('confidence-level').style.display = 'block';
        }, 500);
    } catch (error) {
        alert(error.message);
        loadingSpinner.style.display = 'none';
    }
}

// Calculate intersections and update the map
function calculateIntersection(data) {
    // Clear previous layers
    map.eachLayer(layer => {
        if (layer !== darkMap) {
            map.removeLayer(layer);
        }
    });

    // Create bounds object to track all points
    const bounds = L.latLngBounds();

    // Draw lines and add markers for each measurement point
    const lines = data.map((d, index) => {
        const endPoint = destinationPoint(d.position, d.bearing, 50); // Reduced line length for cleaner visualization
        const lineColor = `hsl(${(index * 360) / data.length}, 100%, 50%)`;

        // Add measurement point to bounds
        bounds.extend(d.position);

        // Draw the bearing line
        const line = L.polyline([d.position, endPoint], {
            color: lineColor,
            weight: 2,
            opacity: 0.8
        }).addTo(map);

        // Add marker for measurement point
        L.marker(d.position, {
            icon: L.divIcon({
                className: 'line-label',
                html: `<div style="color: ${lineColor}; font-weight: bold;">${index + 1}</div>`,
            })
        })
        .addTo(map)
        .bindPopup(`
            <b>Signal Source ${index + 1}</b><br>
            Frequency: ${d.frequency} MHz<br>
            Signal Strength: ${d.signal} dB<br>
            Bearing: ${d.bearing}°
        `);

        return { start: d.position, bearing: d.bearing };
    });

    const intersection = calculateGeodesicIntersection(lines);
    if (intersection) {
        // Add intersection point to bounds
        bounds.extend(intersection);

        // Add marker for the intersection point
        L.marker(intersection, { icon: targetIcon })
            .addTo(map)
            .bindPopup('Calculated Target Location')
            .openPopup();

        // Update coordinates display
        document.getElementById('result-coords').textContent =
            `Coordinates: ${intersection[0].toFixed(6)}, ${intersection[1].toFixed(6)}`;

        // Add a small padding to the bounds and fit the map to show all points
        map.fitBounds(bounds.pad(0.3));

        updateConfidenceLevel(lines, intersection);
    } else {
        alert('No intersection found. Please verify the signal source locations and bearings.');
        document.getElementById('result-coords').textContent = 'Coordinates: No valid intersection found';
        document.getElementById('confidence-level').style.display = 'none';

        // If no intersection, just fit to measurement points
        map.fitBounds(bounds.pad(0.3));
    }
}

// Calculate the destination point given start point, bearing and distance
function destinationPoint([lat, lng], bearing, distance) {
    const R = 6371; // Earth's radius in km
    const d = distance / R;
    const bearingRad = (bearing * Math.PI) / 180;
    const lat1 = (lat * Math.PI) / 180;
    const lng1 = (lng * Math.PI) / 180;

    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(d) +
        Math.cos(lat1) * Math.sin(d) * Math.cos(bearingRad)
    );

    const lng2 = lng1 + Math.atan2(
        Math.sin(bearingRad) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

    return [
        (lat2 * 180) / Math.PI,
        (lng2 * 180) / Math.PI
    ];
}

// Find geodesic intersection of multiple bearing lines
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

    // Calculate weighted center point of all intersections
    const avgLat = intersections.reduce((sum, point) => sum + point[0], 0) / intersections.length;
    const avgLng = intersections.reduce((sum, point) => sum + point[1], 0) / intersections.length;

    return [avgLat, avgLng];
}

// Calculate intersection of two geodesics
function geodesicIntersection([lat1, lng1], brng1, [lat2, lng2], brng2) {
    const φ1 = (lat1 * Math.PI) / 180;
    const λ1 = (lng1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const λ2 = (lng2 * Math.PI) / 180;
    const θ13 = (brng1 * Math.PI) / 180;
    const θ23 = (brng2 * Math.PI) / 180;
    const Δφ = φ2 - φ1;
    const Δλ = λ2 - λ1;

    const δ12 = 2 * Math.asin(Math.sqrt(
        Math.sin(Δφ/2) * Math.sin(Δφ/2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2)
    ));

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

// Calculate confidence level based on intersection spread
function updateConfidenceLevel(lines, intersection) {
    const distances = lines.map(line => {
        return calculateDistance(line.start, intersection);
    });

    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const spread = Math.max(...distances) - Math.min(...distances);

    let confidence;
    if (spread < avgDistance * 0.1) confidence = "Very High";
    else if (spread < avgDistance * 0.2) confidence = "High";
    else if (spread < avgDistance * 0.3) confidence = "Medium";
    else confidence = "Low";

    const confidenceElement = document.getElementById('confidence-value');
    confidenceElement.textContent = confidence;

    // Update confidence indicator color
    confidenceElement.style.color =
        confidence === "Very High" ? "#51cf66" :
        confidence === "High" ? "#94d82d" :
        confidence === "Medium" ? "#fcc419" :
        "#fa5252";
}

// Calculate distance between two points in km
function calculateDistance(point1, point2) {
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Reset the form, rows, and map
function resetData() {
    document.getElementById('input-rows').innerHTML = '';
    rowCount = 0;

    map.eachLayer(layer => {
        if (layer !== darkMap) {
            map.removeLayer(layer);
        }
    });

    map.setView([0, 0], 2);
    document.getElementById('result-coords').textContent = 'Coordinates: Awaiting triangulation...';
    document.getElementById('confidence-level').style.display = 'none';

    // Add initial row
    addRow();
}

// Add event listeners
document.getElementById('add-row').addEventListener('click', addRow);
document.getElementById('process-data').addEventListener('click', processData);
document.getElementById('reset-data').addEventListener('click', resetData);

// Initialize with one row
addRow();