

const API_BASE = "https://generativelanguage.googleapis.com";
const TRANSPORT_API = "https://transport.opendata.ch/v1";

let state = {
    currentStation: null,
    visitedStations: [],
    blockedRoutes: [],
    activeTrain: null,
    activeStops: [],
    rolledStop: null,
    jokers: {
        speed: { used: 0, active: false, max: CONFIG.maxJokers.speed },
        endstation: { used: 0, active: false, max: CONFIG.maxJokers.endstation },
        umsteigen: { used: 0, active: false, max: CONFIG.maxJokers.umsteigen },
        nachhause: { used: 0, active: false, max: CONFIG.maxJokers.nachhause }
    },
    diceCount: 1,
    destDiceCount: 1,
    excludeBuses: CONFIG.excludeBuses
};

let map = null;
let markersLayer = null;
let pathLine = null;
let activeBoardDepartures = [];

// Leaflet marker icons customization
const currentIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div class='w-5 h-5 bg-teal-500 hover:bg-teal-600 border-2 border-white rounded-full shadow-md animate-pulse'></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

const visitedIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div class='w-5 h-5 bg-red-500 hover:bg-red-600 border-2 border-white rounded-full shadow-md'></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

// Initialize Page
window.onload = function () {
    loadStateFromLocalStorage();
    initMap();
    renderApp();

    // Auto Geolocate on first open if no start station
    if (!state.currentStation) {
        geolocate();
    }
};

// Initialize Leaflet Map
function initMap() {
    // Centered on central Switzerland (Sarnen/Lucerne area)
    map = L.map('map', {
        zoomControl: true,
        scrollWheelZoom: true
    }).setView([46.8182, 8.2275], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
    updateMapVisualization();
}

// Load from LocalStorage
function loadStateFromLocalStorage() {
    const stored = localStorage.getItem('sbb_gleiswuerfeln_state');
    if (stored) {
        try {
            state = JSON.parse(stored);
        } catch (e) {
            showToast("Konnte gespeicherte Spieldaten nicht laden. Verwende Standard.", "warning");
        }
    }
}

// Save to LocalStorage
function saveState() {
    localStorage.setItem('sbb_gleiswuerfeln_state', JSON.stringify(state));
}

// Helper: Show custom beautiful visual toast
function showToast(message, type = "info") {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    let bgColor = "bg-sbb-dark text-white";
    if (type === "error") bgColor = "bg-sbb-red text-white";
    if (type === "success") bgColor = "bg-emerald-600 text-white";
    if (type === "warning") bgColor = "bg-amber-500 text-white";

    toast.className = `${bgColor} px-4 py-2 rounded-xl shadow-lg text-sm font-semibold transition-all duration-300 transform translate-y-4 opacity-0 flex items-center space-x-2 pointer-events-auto max-w-sm`;
    toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>${message}</span>
    `;

    container.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
    }, 50);

    // Remove after 4s
    setTimeout(() => {
        toast.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

// Toggle Modals
function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.toggle('hidden');
    }
    checkModalsAndMap();
}

// Check if any modal is currently open and hide the map card to prevent overlay bugs
function checkModalsAndMap() {
    const rulesModal = document.getElementById('rules-modal');
    const searchModal = document.getElementById('search-modal');
    const confirmModal = document.getElementById('confirm-modal');
    const mapCard = document.getElementById('map-card-container');

    const rulesOpen = rulesModal && !rulesModal.classList.contains('hidden');
    const searchOpen = searchModal && !searchModal.classList.contains('hidden');
    const confirmOpen = confirmModal && !confirmModal.classList.contains('hidden');

    if (mapCard) {
        if (rulesOpen || searchOpen || confirmOpen) {
            mapCard.classList.add('hidden');
        } else {
            mapCard.classList.remove('hidden');
            // Trigger Leaflet resize recalculation once visible again
            if (map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            }
        }
    }
}

// Geolocation Support
function geolocate() {
    if (!navigator.geolocation) {
        showToast("Geolocation wird von deinem Browser nicht unterstützt.", "error");
        return;
    }

    showToast("Suche nach nächstgelegenem Bahnhof...", "info");

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            await fetchClosestStation(lat, lon);
        },
        (error) => {
            showToast("Standortzugriff verweigert oder fehlgeschlagen. Nutze die Suche.", "warning");
            toggleModal('search-modal');
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
}

// Fetch Closest Station from Coordinate via Opendata.ch
async function fetchClosestStation(lat, lon) {
    try {
        const res = await fetch(`${TRANSPORT_API}/locations?x=${lat}&y=${lon}`);
        const data = await res.json();

        if (data && data.stations && data.stations.length > 0) {
            // Find first station that is of type station and has a numeric SBB ID
            const station = data.stations.find(s => {
                if (!s.id || isNaN(s.id)) return false;
                // Wenn Busse erlaubt sind, bevorzugen wir den Bahnhofplatz fuer maximale Auswahl
                if (!state.excludeBuses && s.name.toLowerCase().includes('platz')) {
                    return true;
                }
                return true;
            }) || data.stations.find(s => s.id && !isNaN(s.id));
            if (station) {
                setNewStartStation({
                    id: station.id,
                    name: station.name,
                    lat: station.coordinate.x, // Das ist korrekt für Breitengrad
                    lon: station.coordinate.y  // Das ist korrekt für Längengrad
                });
                showToast(`Nächster Bahnhof gefunden: ${station.name}`, "success");
            } else {
                showToast("Keinen passenden Bahnhof in der Nähe gefunden.", "warning");
            }
        } else {
            showToast("Keine Bahnhöfe in der Nähe.", "error");
        }
    } catch (err) {
        showToast("Fehler bei der Abfrage der Opendata API.", "error");
        console.error(err);
    }
}

// Set and save new Start Station
function setNewStartStation(stationObj) {
    state.currentStation = stationObj;
    state.activeTrain = null;
    state.activeStops = [];
    state.rolledStop = null;

    saveState();
    renderApp();
    updateMapVisualization();
    fetchDepartures(stationObj.id);

    // Am Ende von setNewStartStation(stationObj):
    const diceContainer = document.getElementById('dice-display-container');
    if (diceContainer) diceContainer.classList.add('hidden');

    const destDiceContainer = document.getElementById('dest-dice-display-container');
    if (destDiceContainer) destDiceContainer.classList.add('hidden');
}

// Manual Station Search in Input
async function searchStations(query) {
    const resultsDiv = document.getElementById('search-results');
    if (!resultsDiv) return;

    if (!query || query.trim().length < 2) {
        resultsDiv.innerHTML = '<p class="text-xs text-slate-400 italic p-3 text-center">Tippe den Namen eines Schweizer Bahnhofs ein...</p>';
        return;
    }

    try {
        const res = await fetch(`${TRANSPORT_API}/locations?query=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (data && data.stations) {
            const filtered = data.stations.filter(s => s.id && s.id !== null);
            if (filtered.length === 0) {
                resultsDiv.innerHTML = '<p class="text-xs text-slate-400 italic p-3 text-center">Keine Stationen gefunden.</p>';
                return;
            }

            resultsDiv.innerHTML = filtered.map(s => `
    <button onclick="selectStationFromSearch('${s.id}', '${s.name.replace(/'/g, "\\'")}', ${s.coordinate.x}, ${s.coordinate.y})" class="w-full text-left p-4 hover:bg-slate-50 transition flex justify-between items-center text-slate-700">
    <span class="font-bold text-sm">${s.name}</span>
    <span class="text-xs text-slate-400">Auswählen →</span>
</button>
`).join('');
        }
    } catch (e) {
        console.error(e);
    }
}

function selectStationFromSearch(id, name, lat, lon) {
    setNewStartStation({ id, name, lat, lon });
    toggleModal('search-modal');
}

// Fetch Departures (Stationboard)
async function fetchDepartures(stationId) {
    const container = document.getElementById('departure-board-container');
    if (!container) return;

    container.innerHTML = `
    <div class="flex items-center space-x-2 py-4">
          <svg class="animate-spin h-5 w-5 text-sbb-red" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-sm font-semibold text-slate-600">Suche Verbindungen im Umkreis...</span>
        </div>
    `;

    try {
        // 1. Wir holen uns die Koordinaten der aktuellen Station
        if (!state.currentStation || !state.currentStation.lat || !state.currentStation.lon) {
            // Fallback: Wenn keine Koordinaten da sind, laden wir nur die eine Station
            let url = `${TRANSPORT_API}/stationboard?id=${stationId}&limit=35`;
            if (state.excludeBuses) url += `&transportations[]=train`;
            const res = await fetch(url);
            const data = await res.json();
            activeBoardDepartures = data.stationboard || [];
            renderDepartureBoard();
            return;
        }

        const lat = state.currentStation.lat;
        const lon = state.currentStation.lon;

        // 2. Alle Haltestellen im Umkreis abfragen
        const locationsRes = await fetch(`${TRANSPORT_API}/locations?x=${lat}&y=${lon}`);
        const locationsData = await locationsRes.json();

        // Wir nehmen nur die Stationen, die eine gueltige ID haben und ganz nah sind
        // Die API sortiert diese meistens schon nach Distanz
        const nearbyStations = (locationsData.stations || []).slice(0, 3); // Top 3 Naechsten nehmen

        let allDepartures = [];

        // 3. Fuer jede gefundene Haltestelle im Umkreis die Abfahrten laden
        for (const station of nearbyStations) {
            let url = `${TRANSPORT_API}/stationboard?id=${station.id}&limit=20`;
            if (state.excludeBuses) {
                url += `&transportations[]=train`;
            }

            try {
                const depRes = await fetch(url);
                const depData = await depRes.json();
                if (depData && depData.stationboard) {
                    allDepartures = allDepartures.concat(depData.stationboard);
                }
            } catch (e) {
                console.error("Fehler bei Teilstation: " + station.name, e);
            }
        }

        // 4. Doppelte Eintraege filtern (falls eine Fahrt bei beiden Stationen auftaucht)
        const seen = new Set();
        let filteredDepartures = allDepartures.filter(dep => {
            if (!dep.stop || !dep.stop.departure) return false;

            // Einzigartiger Schluessel aus Uhrzeit und Zugnummer/Ziel
            const key = dep.stop.departure + "-" + (dep.number || '') + "-" + dep.to;
            if (seen.has(key)) return false;
            seen.add(key);

            // Blockierte Strecken filtern (Regel 2)
            const isBlocked = state.blockedRoutes.some(route => {
                return route.toName && dep.to && route.toName.toLowerCase() === dep.to.toLowerCase();
            });
            if (isBlocked) return false;

            // Schnelle Zuege Filter (Joker)
            if (state.jokers.speed.active) {
                const category = dep.category ? dep.category.toUpperCase() : '';
                return ['IC', 'IR', 'ICE', 'EC', 'TGV', 'RE'].includes(category);
            }

            return true;
        });

        // 5. Nach echter Abfahrtszeit sortieren, damit alles schoen der Reihe nach kommt
        filteredDepartures.sort((a, b) => {
            return new Date(a.stop.departure) - new Date(b.stop.departure);
        });

        // Im Speicher ablegen und anzeigen
        activeBoardDepartures = filteredDepartures;
        renderDepartureBoard();

    } catch (err) {
        container.innerHTML = `<p class="text-sm text-red-500 font-bold">Fehler beim Zusammenfuehren der Stationen.</p>`;
        console.error(err);
    }
}

// Toggle Bus Exclusion state
function toggleExcludeBuses(checked) {
    state.excludeBuses = checked;
    saveState();
    if (state.currentStation) {
        fetchDepartures(state.currentStation.id);
    }
    showToast(checked ? "Busse & Trams ausgeblendet" : "Alle Verkehrsmittel eingeblendet", "info");
}

// Render Departure Board in View
function renderDepartureBoard() {
    const container = document.getElementById('departure-board-container');
    if (!container) return;

    if (activeBoardDepartures.length === 0) {
        container.innerHTML = `
          <div class="p-4 bg-slate-50 rounded-xl text-center border">
            <p class="text-sm text-slate-500 italic">Keine passenden Verbindungen gefunden. Hast du evtl. zu viele Strecken blockiert?</p>
            <button onclick="fetchDepartures('${state.currentStation ? state.currentStation.id : ''}')" class="mt-2 text-xs font-bold text-sbb-red underline hover:no-underline">Erneut versuchen</button>
          </div>
        `;
        return;
    }

    // We only show up to 18 departures (since 3 dice max = 18)
    const displayCount = Math.min(activeBoardDepartures.length, state.diceCount * 6);

    let html = `<div class="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">`;
    for (let i = 0; i < displayCount; i++) {
        const dep = activeBoardDepartures[i];
        const depTime = new Date(dep.stop.departure);
        const formatTime = depTime.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
        const track = dep.stop.platform ? `Gleis ${dep.stop.platform}` : 'Gleis -';

        // SBB-like Train Badge colors
        let catColor = "bg-slate-500";
        if (['IC', 'IR', 'ICE', 'EC', 'TGV'].includes(dep.category)) catColor = "bg-sbb-red";
        else if (dep.category === 'S') catColor = "bg-blue-600";
        else if (dep.category === 'RE' || dep.category === 'RX') catColor = "bg-amber-600";

        html += `
          <div id="dep-row-${i + 1}" class="flex items-center justify-between p-3 transition hover:bg-slate-50 text-slate-700">
            <div class="flex items-center space-x-3">
              <span class="w-6 h-6 rounded bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center">${i + 1}</span>
              <span class="${catColor} text-white font-black text-[10px] px-1.5 py-0.5 rounded uppercase">${dep.category || 'Zug'}</span>
              <div>
                <p class="font-bold text-sm text-sbb-dark leading-tight">${dep.to}</p>
                <p class="text-[11px] text-slate-400">Zugnummer: ${dep.number || 'Unbekannt'}</p>
              </div>
            </div>
            <div class="text-right">
              <p class="font-bold text-sm text-sbb-dark">${formatTime}</p>
              <p class="text-[11px] text-slate-400">${track}</p>
            </div>
          </div>
        `;
    }
    html += `</div>`;
    container.innerHTML = html;
}

// Set Dice Count
function setDiceCount(count) {
    state.diceCount = count;
    // Re-render departures because the number of selection items depends on count
    renderDepartureBoard();

    // Update buttons
    for (let i = 1; i <= 3; i++) {
        const btn = document.getElementById(`btn-dice-${i}`);
        if (btn) {
            if (i === count) {
                btn.className = "px-3 py-1 text-sm font-bold rounded-md bg-sbb-dark text-white transition";
            } else {
                btn.className = "px-3 py-1 text-sm font-bold rounded-md text-slate-600 hover:bg-slate-100 transition";
            }
        }
    }
}

// Set Destination Dice Count
function setDestDiceCount(count) {
    state.destDiceCount = count;

    for (let i = 1; i <= 3; i++) {
        const btn = document.getElementById(`btn-dest-dice-${i}`);
        if (btn) {
            if (i === count) {
                btn.className = "px-3 py-0.5 text-xs font-bold rounded bg-sbb-dark text-white transition";
            } else {
                btn.className = "px-3 py-0.5 text-xs font-bold rounded text-slate-600 hover:bg-slate-100 transition";
            }
        }
    }
}

// Dynamic Svg generator for Dice Faces
function getDiceSvg(val) {
    const dots = {
        1: [[12, 12]],
        2: [[6, 6], [18, 18]],
        3: [[6, 6], [12, 12], [18, 18]],
        4: [[6, 6], [6, 18], [18, 6], [18, 18]],
        5: [[6, 6], [6, 18], [12, 12], [18, 6], [18, 18]],
        6: [[6, 6], [6, 12], [6, 18], [18, 6], [18, 12], [18, 18]]
    };

    let dotsHtml = '';
    if (dots[val]) {
        dotsHtml = dots[val].map(coord => `<circle cx="${coord[0]}" cy="${coord[1]}" r="2" class="fill-sbb-red" />`).join('');
    }

    return `
        <svg class="w-12 h-12 bg-white border border-slate-300 rounded-lg shadow-sm" viewBox="0 0 24 24">
          ${dotsHtml}
        </svg>
      `;
}

// Roll for Departure Train
function rollForTrain() {
    if (!activeBoardDepartures || activeBoardDepartures.length === 0) {
        showToast("Keine Abfahrten zum Würfeln verfügbar.", "error");
        return;
    }

    const rollerBtn = document.getElementById('btn-roll-train');
    if (rollerBtn) {
        rollerBtn.disabled = true;
        const btnText = document.getElementById('btn-roll-train-text');
        if (btnText) btnText.innerText = "Würfle...";
    }

    const container = document.getElementById('dice-display-container');
    if (container) container.classList.remove('hidden');

    const wrapper = document.getElementById('dice-wrapper');
    if (wrapper) wrapper.classList.add('shake-dice');

    let rollValues = [];
    let interval = setInterval(() => {
        if (wrapper) {
            wrapper.innerHTML = Array.from({ length: state.diceCount }, () => Math.floor(Math.random() * 6) + 1).map(v => getDiceSvg(v)).join('');
        }
    }, 80);

    setTimeout(() => {
        clearInterval(interval);
        if (wrapper) wrapper.classList.remove('shake-dice');

        let sum = 0;
        for (let i = 0; i < state.diceCount; i++) {
            const val = Math.floor(Math.random() * 6) + 1;
            rollValues.push(val);
            sum += val;
        }

        // Display outcome
        if (wrapper) wrapper.innerHTML = rollValues.map(v => getDiceSvg(v)).join('');

        const sumDisplay = document.getElementById('dice-sum-display');
        if (sumDisplay) sumDisplay.innerText = sum;

        // --- ERSETZE ES DURCH DIESEN CODE ---
        const totalDeps = Math.min(activeBoardDepartures.length, state.diceCount * 6);
        const resultMsg = document.getElementById('dice-result-msg');

        // Index sauber berechnen (0-basiert)
        const chosenIndex = (sum - 1) % totalDeps;

        if (sum > totalDeps) {
            if (resultMsg) resultMsg.innerText = `Es gibt nur ${totalDeps} Abfahrten. Wurf wurde auf Position ${chosenIndex + 1} umgelegt.`;
        } else {
            if (resultMsg) resultMsg.innerText = `Zug auf Position ${chosenIndex + 1} ausgewählt!`;
        }

        // Highlight selected row in UI (da die IDs im HTML bei 1 starten, i + 1 nutzen)
        for (let i = 0; i < totalDeps; i++) {
            const row = document.getElementById(`dep-row-${i + 1}`);
            if (row) {
                if (i === chosenIndex) {
                    row.classList.add('bg-red-50', 'border-l-4', 'border-l-sbb-red');
                } else {
                    row.className = row.className.replace('bg-red-50 border-l-4 border-l-sbb-red', '');
                }
            }
        }

        // Select the train direkt über den berechneten Index
        const selectedTrain = activeBoardDepartures[chosenIndex];

        setTimeout(() => {
            setupDestinationStep(selectedTrain);
            if (rollerBtn) {
                rollerBtn.disabled = false;
                const btnText = document.getElementById('btn-roll-train-text');
                if (btnText) btnText.innerText = "Zug erwürfeln";
            }
        }, 1500);

    }, 1200);
}

// Set up Step 2 (Destination)
function setupDestinationStep(train) {
    if (!train) return;
    state.activeTrain = train;

    // Filter the passList of the train to only include stations AFTER our current station
    const passList = train.passList || [];

    // SECURE Null-checks for finding current index of current station in train itinerary
    const currentIdx = (state.currentStation && state.currentStation.name) ? passList.findIndex(p => {
        return p && p.station && p.station.name &&
            p.station.name.toLowerCase() === state.currentStation.name.toLowerCase();
    }) : -1;

    // Slice list to future stops
    let futureStops = [];
    if (currentIdx !== -1) {
        futureStops = passList.slice(currentIdx + 1);
    } else {
        // Fallback in case coordinates or current station name do not perfectly match
        futureStops = passList;
    }

    // Securely filter out null or corrupt stations from future stops
    state.activeStops = futureStops
        .filter(stop => stop && stop.station && stop.station.name && !stop.station.name.toLowerCase().includes('tunnel'))
        .map(stop => ({
            station: stop.station,
            included: true // Standardmässig aktiv
        }));

    // Render details in Step 2 card
    const trainCategoryBadge = document.getElementById('train-category-badge');
    const trainNameBadge = document.getElementById('train-name-badge');
    const trainPlatform = document.getElementById('train-platform');
    const trainDirection = document.getElementById('train-direction');

    if (trainCategoryBadge) trainCategoryBadge.innerText = train.category || 'ZUG';
    if (trainNameBadge) trainNameBadge.innerText = train.name || train.number || 'Zug';
    if (trainPlatform) trainPlatform.innerText = train.stop.platform || '-';
    if (trainDirection) trainDirection.innerText = train.to;

    // Toggle step visibilities
    const stepDeparture = document.getElementById('step-departure');
    const stepDestination = document.getElementById('step-destination');
    if (stepDeparture) stepDeparture.classList.add('opacity-40', 'pointer-events-none');
    if (stepDestination) stepDestination.classList.remove('hidden');

    renderStopsList();

    // Auto recommend dice count
    recommendDiceCount();

    // Check if Endstation Joker is active
    const badgeEndstation = document.getElementById('badge-endstation');
    if (badgeEndstation) {
        if (state.jokers.endstation.active) {
            badgeEndstation.classList.remove('hidden');
        } else {
            badgeEndstation.classList.add('hidden');
        }
    }

    // Hide the confirm arrival button until rolled
    const btnConfirmArrival = document.getElementById('btn-confirm-arrival');
    if (btnConfirmArrival) btnConfirmArrival.classList.add('hidden');

    const destDiceDisplayContainer = document.getElementById('dest-dice-display-container');
    if (destDiceDisplayContainer) destDiceDisplayContainer.classList.add('hidden');
}

// Auto recommend dice count based on active stops
function recommendDiceCount() {
    const activeCount = state.activeStops.filter(s => s.included).length;
    let recommended = 1;
    if (activeCount > 6 && activeCount <= 12) recommended = 2;
    if (activeCount > 12) recommended = 3;

    setDestDiceCount(recommended);
    const recText = document.getElementById('destination-dice-recommendation');
    if (recText) recText.innerText = `Empfehlung: ${recommended} Würfel (${activeCount} aktive Haltestellen)`;
}

// Render Stops list
function renderStopsList() {
    const container = document.getElementById('stops-list-container');
    if (!container) return;

    if (state.activeStops.length === 0) {
        container.innerHTML = `<p class="p-3 text-xs text-slate-400 italic">Keine Zwischenhalte für diesen Zug gefunden. Du darfst direkt an der Endstation aussteigen!</p>`;
        // Force mock endstation stop
        state.activeStops = [{
            station: { id: 'end', name: state.activeTrain ? state.activeTrain.to : 'Endstation', coordinate: { x: null, y: null } },
            included: true
        }];
    }

    container.innerHTML = state.activeStops.map((stop, index) => {
        const isIncluded = stop.included;
        const opacityClass = isIncluded ? 'opacity-100' : 'opacity-40 bg-slate-100 line-through';
        const checkIcon = isIncluded ? '✓' : '✗';

        // Show direct select button if Joker "Endstation" is active
        const selectBtn = state.jokers.endstation.active
            ? `<button onclick="directSelectStop(${index})" class="ml-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded transition">Auswählen</button>`
            : '';

        return `
          <div class="flex items-center justify-between p-3 transition ${opacityClass} text-slate-700">
            <button onclick="toggleStopInclusion(${index})" class="flex-1 text-left flex items-center space-x-2">
              <span class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isIncluded ? 'bg-sbb-red text-white' : 'bg-slate-300 text-slate-500'}">
                ${isIncluded ? (index + 1) : checkIcon}
              </span>
              <span class="font-bold text-sm text-sbb-dark">${stop.station.name}</span>
            </button>
            <div class="flex items-center">
              ${selectBtn}
            </div>
          </div>
        `;
    }).join('');
}

// Toggle stop inclusion (Rule 1)
function toggleStopInclusion(index) {
    if (state.jokers.endstation.active) return; // Disallow toggle if endstation is already active and clickable
    state.activeStops[index].included = !state.activeStops[index].included;
    renderStopsList();
    recommendDiceCount();
}

// Rule 1 Auto Helper: filter main junction stations
function toggleMajorStopsOnly() {
    // Very simple smart filter: keep stations containing "HB", "Bahnhof", "Flughafen", or matching common big Swiss stations
    const keywords = ["hb", "bahnhof", "flughafen", "luzern", "bern", "basel", "zürich", "olten", "spiez", "lausanne", "geneve", "winterthur", "st. gallen", "biel", "neuchatel"];

    state.activeStops.forEach(stop => {
        if (stop && stop.station && stop.station.name) {
            const name = stop.station.name.toLowerCase();
            const matches = keywords.some(kw => name.includes(kw));
            stop.included = matches;
        } else {
            stop.included = false;
        }
    });

    // Ensure at least one stop is active
    const activeCount = state.activeStops.filter(s => s.included).length;
    if (activeCount === 0) {
        state.activeStops.forEach(stop => stop.included = true);
        showToast("Keine passenden Knotenbahnhöfe gefunden. Alle Halte wieder aktiviert.", "warning");
    } else {
        showToast("Kleinere Halte wurden gemäss Rule 1 deaktiviert.", "success");
    }

    renderStopsList();
    recommendDiceCount();
}

// Direct Select (Joker "Endstation" feature)
function directSelectStop(index) {
    const stopObj = state.activeStops[index];
    state.rolledStop = stopObj;

    showToast(`Zielort direkt bestimmt: ${stopObj.station.name}`, "success");

    // Highlight selection
    const destDiceDisplayContainer = document.getElementById('dest-dice-display-container');
    if (destDiceDisplayContainer) destDiceDisplayContainer.classList.remove('hidden');

    const destDiceSumDisplay = document.getElementById('dest-dice-sum-display');
    if (destDiceSumDisplay) destDiceSumDisplay.innerText = "Joker";

    const rolledDestStationName = document.getElementById('rolled-dest-station-name');
    if (rolledDestStationName) rolledDestStationName.innerText = stopObj.station.name;

    // Reveal final confirmation button
    const btnConfirmArrival = document.getElementById('btn-confirm-arrival');
    if (btnConfirmArrival) btnConfirmArrival.classList.remove('hidden');
}

// Roll for Destination
function rollForDestination() {
    const activeStopsList = state.activeStops.filter(s => s.included);
    if (activeStopsList.length === 0) {
        showToast("Bitte aktiviere mindestens eine Haltestelle.", "error");
        return;
    }

    const rollerBtn = document.getElementById('btn-roll-dest');
    if (rollerBtn) rollerBtn.disabled = true;

    const container = document.getElementById('dest-dice-display-container');
    if (container) container.classList.remove('hidden');

    const wrapper = document.getElementById('dest-dice-wrapper');
    if (wrapper) wrapper.classList.add('shake-dice');

    let interval = setInterval(() => {
        if (wrapper) {
            wrapper.innerHTML = Array.from({ length: state.destDiceCount }, () => Math.floor(Math.random() * 6) + 1).map(v => getDiceSvg(v)).join('');
        }
    }, 80);

    setTimeout(() => {
        clearInterval(interval);
        if (wrapper) wrapper.classList.remove('shake-dice');

        let sum = 0;
        let rollValues = [];
        for (let i = 0; i < state.destDiceCount; i++) {
            const val = Math.floor(Math.random() * 6) + 1;
            rollValues.push(val);
            sum += val;
        }

        // Display outcome
        if (wrapper) wrapper.innerHTML = rollValues.map(v => getDiceSvg(v)).join('');

        const destDiceSumDisplay = document.getElementById('dest-dice-sum-display');
        if (destDiceSumDisplay) destDiceSumDisplay.innerText = sum;

        // Map sum to index of active stops
        const targetIndex = (sum - 1) % activeStopsList.length;
        const selectedStop = activeStopsList[targetIndex];
        state.rolledStop = selectedStop;

        const rolledDestStationName = document.getElementById('rolled-dest-station-name');
        if (rolledDestStationName) rolledDestStationName.innerText = selectedStop.station.name;

        showToast(`Dein Zielbahnhof für diese Etappe: ${selectedStop.station.name}! Gute Fahrt!`, "success");

        // Reveal final confirmation button
        const btnConfirmArrival = document.getElementById('btn-confirm-arrival');
        if (btnConfirmArrival) btnConfirmArrival.classList.remove('hidden');
        if (rollerBtn) rollerBtn.disabled = false;

    }, 1200);
}

// Confirm Arrival (Save to itinerary history and switch active location)
function confirmArrival() {
    if (!state.rolledStop) return;

    const previousStation = state.currentStation;
    const targetStop = state.rolledStop;

    // 1. Add current station to history log if not already there
    const now = new Date();
    const timeStr = now.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });

    // Save previous location into visited list
    if (previousStation) {
        state.visitedStations.push({
            id: previousStation.id,
            name: previousStation.name,
            lat: previousStation.lat,
            lon: previousStation.lon,
            time: timeStr
        });

        // Rule 2: Register blocked route
        state.blockedRoutes.push({
            fromName: previousStation.name,
            toName: targetStop.station.name,
            timestamp: now.getTime()
        });
    }

    // 2. Set newly reached station as current station
    state.currentStation = {
        id: targetStop.station.id,
        name: targetStop.station.name,
        lat: (targetStop.station.coordinate && targetStop.station.coordinate.x) ? targetStop.station.coordinate.x : null,
        lon: (targetStop.station.coordinate && targetStop.station.coordinate.y) ? targetStop.station.coordinate.y : null
    };

    // 3. Clear temporary state for next roll
    state.activeTrain = null;
    state.activeStops = [];
    state.rolledStop = null;

    // 4. Reset Active Jokers that are one-time use (except "Ab nach Hause")
    if (state.jokers.speed.active) {
        state.jokers.speed.active = false;
        state.jokers.speed.used++; // Erhöht die Zahl der verbrauchten Joker um 1
    }
    if (state.jokers.endstation.active) {
        state.jokers.endstation.active = false;
        state.jokers.endstation.used++; // Erhöht die Zahl der verbrauchten Joker um 1
    }
    if (state.jokers.umsteigen.active) {
        state.jokers.umsteigen.active = false;
        state.jokers.umsteigen.used++; // Erhöht die Zahl der verbrauchten Joker um 1
    }
    if (state.jokers.nachhause.active) {
        state.jokers.nachhause.active = false;
        state.jokers.nachhause.used++; // Erhöht die Zahl der verbrauchten Joker um 1
    }

    saveState();
    renderApp();
    updateMapVisualization();

    // Jump back to step 1 automatically and fetch departures of the new station
    resetToStep1();

    showToast(`Willkommen in ${state.currentStation.name}! Etappe abgeschlossen.`, "success");
}

// Reset to Step 1 interface
function resetToStep1() {
    const stepDeparture = document.getElementById('step-departure');
    if (stepDeparture) stepDeparture.classList.remove('opacity-40', 'pointer-events-none');

    const stepDestination = document.getElementById('step-destination');
    if (stepDestination) stepDestination.classList.add('hidden');

    const diceDisplayContainer = document.getElementById('dice-display-container');
    if (diceDisplayContainer) diceDisplayContainer.classList.add('hidden');

    if (state.currentStation) {
        fetchDepartures(state.currentStation.id);
    }
}

// Activate Joker
function activateJoker(jokerKey) {
    // 1. NEU: Zuerst pruefen, ob ueberhaupt noch Joker uebrig sind
    const joker = state.jokers[jokerKey];
    if (joker && joker.used >= joker.max) {
        alert(`Sie haben keine ${jokerKey}-Joker mehr übrig!`);
        return; // Bricht ab, bevor der Joker aktiviert wird
    }

    if (jokerKey === 'umsteigen') {
        // Special Action: Umsteigen lets them search and teleport immediately
        joker.active = true;
        showToast("Joker Aktiviert: Du darfst jetzt an jeden beliebigen Bahnhof umsteigen!", "success");
        toggleModal('search-modal');
        return;
    }

    // Toggle state
    joker.active = !joker.active;

    if (joker.active) {
        showToast(`Joker ${jokerKey.toUpperCase()} aktiviert!`, "success");
        // Apply instantly to departure view if speed upgrade
        if (jokerKey === 'speed' && state.currentStation) {
            fetchDepartures(state.currentStation.id);
        }
    } else {
        showToast(`Joker ${jokerKey.toUpperCase()} deaktiviert.`, "info");
    }

    saveState();
    renderApp();
}

// Update entire UI according to current State
function renderApp() {
    // 1. Current Station panel
    const nameEl = document.getElementById('current-station-name');
    const infoEl = document.getElementById('current-station-info');

    if (nameEl && infoEl) {
        if (state.currentStation) {
            nameEl.innerText = state.currentStation.name;
            infoEl.innerText = `ID: ${state.currentStation.id} • Lat: ${parseFloat(state.currentStation.lat).toFixed(4)}, Lon: ${parseFloat(state.currentStation.lon).toFixed(4)}`;
        } else {
            nameEl.innerText = "Kein Startbahnhof";
            infoEl.innerText = "Bitte nutze GPS Ortung oder die manuelle Suche.";
        }
    }

    // Synchronize the bus toggle checkbox state
    const excludeBusesToggle = document.getElementById('toggle-exclude-buses');
    if (excludeBusesToggle) {
        excludeBusesToggle.checked = state.excludeBuses;
    }

    // 2. Jokers styling update
    const jokerKeys = ['speed', 'endstation', 'umsteigen', 'nachhause'];
    jokerKeys.forEach(key => {
        const btn = document.getElementById(`joker-${key}`);
        const badge = document.getElementById(`joker-badge-${key}`);
        const status = state.jokers[key];

        if (btn && badge && status) {
            if (status.used) {
                // Greyed out, nonclickable
                btn.className = "p-3 rounded-xl border border-slate-200 text-left transition flex flex-col justify-between h-28 bg-slate-200 opacity-40 cursor-not-allowed";
                badge.className = "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-slate-300 text-slate-600 inline-block";
                badge.innerText = "Genutzt";
                badge.classList.remove('hidden');
            } else if (status.active) {
                // Highlight active state
                btn.className = "p-3 rounded-xl border-2 border-sbb-red text-left transition flex flex-col justify-between h-28 bg-red-50/50 shadow-sm";
                badge.className = "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-sbb-red text-white inline-block";
                badge.innerText = "Aktiv";
                badge.classList.remove('hidden');
            } else {
                // Ready to use
                btn.className = "p-3 rounded-xl border border-slate-200 hover:border-slate-300 text-left transition flex flex-col justify-between h-28 bg-white hover:shadow-sm";
                badge.classList.add('hidden');
            }
        }
    });

    // 3. Render Badges
    const badgeSpeed = document.getElementById('badge-speed');
    if (badgeSpeed) {
        if (state.jokers.speed.active) {
            badgeSpeed.classList.remove('hidden');
        } else {
            badgeSpeed.classList.add('hidden');
        }
    }

    // 4. Render Log/Timeline
    const timeline = document.getElementById('timeline-container');
    const emptyText = document.getElementById('empty-timeline-text');
    const routeCount = document.getElementById('route-count-badge');

    if (routeCount) {
        routeCount.innerText = `${state.visitedStations.length + (state.currentStation ? 1 : 0)} Stationen`;
    }

    if (state.visitedStations.length === 0 && !state.currentStation) {
        if (emptyText) emptyText.classList.remove('hidden');
        if (timeline) {
            timeline.classList.add('hidden');
            timeline.innerHTML = '';
        }
    } else {
        if (emptyText) emptyText.classList.add('hidden');
        if (timeline) timeline.classList.remove('hidden');

        let timelineHtml = '';

        // Render current location first
        if (state.currentStation) {
            timelineHtml += `
            <div class="relative flex items-start">
              <span class="absolute left-[-29px] top-1.5 bg-emerald-500 w-4.5 h-4.5 rounded-full border-4 border-white shadow-sm flex items-center justify-center"></span>
              <div class="ml-4">
                <p class="font-black text-sm text-sbb-dark flex items-center">
                  <span>${state.currentStation.name}</span>
                  <span class="ml-2 bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">Aktuell</span>
                </p>
                <p class="text-[10px] text-slate-400">Hier stehst du im Moment</p>
              </div>
            </div>
          `;
        }

        // Render past visited history (reversed)
        for (let i = state.visitedStations.length - 1; i >= 0; i--) {
            const v = state.visitedStations[i];
            timelineHtml += `
            <div class="relative flex items-start opacity-75 hover:opacity-100 transition">
              <span class="absolute left-[-29px] top-1.5 bg-sbb-red w-4.5 h-4.5 rounded-full border-4 border-white shadow-sm"></span>
              <div class="ml-4">
                <p class="font-bold text-sm text-sbb-dark">${v.name}</p>
                <p class="text-[10px] text-slate-400">Besucht um ${v.time} Uhr</p>
              </div>
            </div>
          `;
        }

        if (timeline) timeline.innerHTML = timelineHtml;
    }

    // 5. Render Blocked Routes list (Rule 2)
    const blockedSection = document.getElementById('blocked-lines-section');
    const blockedList = document.getElementById('blocked-lines-list');

    if (blockedSection && blockedList) {
        if (state.blockedRoutes.length > 0) {
            blockedSection.classList.remove('hidden');
            blockedList.innerHTML = state.blockedRoutes.map(r => `
            <span class="inline-flex items-center bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-md border">
              🚫 ${r.fromName} → ${r.toName}
            </span>
          `).join('');
        } else {
            blockedSection.classList.add('hidden');
        }
    }

    const toggleBusCheckbox = document.getElementById('toggle-exclude-buses');
    if (toggleBusCheckbox) {
        toggleBusCheckbox.checked = state.excludeBuses;
    }
}

// Map Updates (Drawing Markers & Flightlines)
function updateMapVisualization() {
    if (!map || !markersLayer) return;

    // Clear layers
    markersLayer.clearLayers();
    if (pathLine) {
        map.removeLayer(pathLine);
        pathLine = null;
    }

    const coordinatesList = [];

    // Render Visited Stations (Red Markers)
    state.visitedStations.forEach(v => {
        if (v.lat && v.lon) {
            const latLng = [v.lat, v.lon];
            coordinatesList.push(latLng);

            L.marker(latLng, { icon: visitedIcon })
                .addTo(markersLayer)
                .bindPopup(`<div class="font-bold text-slate-800">${v.name}</div><div class="text-xs text-slate-500">Besucht um ${v.time}</div>`);
        }
    });

    // Render Current Location (Green Pulsing Marker)
    if (state.currentStation && state.currentStation.lat && state.currentStation.lon) {
        const curLatLng = [state.currentStation.lat, state.currentStation.lon];
        coordinatesList.push(curLatLng);

        L.marker(curLatLng, { icon: currentIcon })
            .addTo(markersLayer)
            .bindPopup(`<div class="font-bold text-slate-800">${state.currentStation.name}</div><div class="text-xs text-emerald-600 font-bold">Dein aktueller Standort</div>`);

        // Center map dynamically to current station
        map.setView(curLatLng, 10);
    }

    // Draw Path Line (Polyline) of the journey
    if (coordinatesList.length > 1) {
        pathLine = L.polyline(coordinatesList, {
            color: '#D30F15',
            weight: 4,
            opacity: 0.8,
            dashArray: '5, 8',
            lineJoin: 'round'
        }).addTo(map);

        // Adjust map zoom level to fit entire itinerary
        map.fitBounds(pathLine.getBounds(), { padding: [40, 40] });
    }
}

// Reset Confirmation
function confirmReset() {
    toggleModal('confirm-modal');
}

// Execute Full reset
function executeReset() {
    // Clear LocalStorage
    localStorage.removeItem('sbb_gleiswuerfeln_state');

    // KORREKTUR: Joker wieder als Zahlen (0) und mit dem max-Wert aus der CONFIG initialisieren
    state = {
        currentStation: null,
        visitedStations: [],
        blockedRoutes: [],
        activeTrain: null,
        activeStops: [],
        rolledStop: null,
        jokers: {
            speed: { used: 0, active: false, max: CONFIG.maxJokers.speed },
            endstation: { used: 0, active: false, max: CONFIG.maxJokers.endstation },
            umsteigen: { used: 0, active: false, max: CONFIG.maxJokers.umsteigen },
            nachhause: { used: 0, active: false, max: CONFIG.maxJokers.nachhause }
        },
        diceCount: 1,
        destDiceCount: 1,
        excludeBuses: CONFIG.excludeBuses // Wert aus Config nehmen
    };

    toggleModal('confirm-modal');

    // Clear Board UI
    const departureContainer = document.getElementById('departure-board-container');
    if (departureContainer) departureContainer.innerHTML = `<p class="text-sm text-slate-500 italic">Bahnhof wählen, um Abfahrten anzuzeigen.</p>`;

    const diceContainer = document.getElementById('dice-display-container');
    if (diceContainer) diceContainer.classList.add('hidden');

    // Update Map & App view
    renderApp();
    updateMapVisualization();

    showToast("Alle Reisedaten wurden erfolgreich zurückgesetzt!", "success");

    // Query position again
    geolocate();
}