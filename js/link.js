// Generiert einen Link mit den besuchten Bahnhoefen
function generateExportLink() {
    if (!state.visitedStations || state.visitedStations.length === 0) {
        alert("Sie haben noch keine Bahnhoefe besucht!");
        return;
    }
    // Wandelt die Liste der besuchten Bahnhoefe in Text um
    const stationData = encodeURIComponent(JSON.stringify(state.visitedStations));
    // Erstellt die neue Web-Adresse
    const exportUrl = `${window.location.origin}${window.location.pathname}?reise=${stationData}`;
    // Kopiert den Link automatisch in die Zwischenablage
    navigator.clipboard.writeText(exportUrl).then(() => {
        alert("Der Link wurde in Ihre Zwischenablage kopiert! Sie koennen ihn jetzt teilen.");
    }).catch(err => {
        // Falls das automatische Kopieren fehlschlaegt, zeigen wir den Link an
        prompt("Hier ist Ihr Reise-Link:", exportUrl);
    });
} // <-- Diese Klammer hat gefehlt!

// Prueft beim Start der Seite, ob ein Reise-Link geoeffnet wurde
function loadRouteFromLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const reiseParam = urlParams.get('reise');
    if (reiseParam) {
        try {
            const loadedStations = JSON.parse(decodeURIComponent(reiseParam));
            if (Array.isArray(loadedStations) && loadedStations.length > 0) {
                // Setzt die geladenen Bahnhoefe ins Spiel ein
                state.visitedStations = loadedStations;
                state.currentStation = loadedStations[loadedStations.length - 1];
                // Aktualisiert die Karte und die Anzeige
                if (typeof updateMap === "function") updateMap();
                if (typeof updateVisitedList === "function") updateVisitedList();
                alert("Reise erfolgreich aus dem Link geladen!");
            }
        } catch (e) {
            console.error("Fehler beim Laden der Reise aus dem Link", e);
        }
    }
} // <-- Diese Klammer hat auch gefehlt!

window.addEventListener('DOMContentLoaded', loadRouteFromLink);