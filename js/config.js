// Zentrale Konfiguration für das SBB Gleiswürfeln
const CONFIG = {
    // Start-Einstellungen
    excludeBuses: false,       // true = Busse standardmässig ausschliessen, false = Busse erlauben

    // Joker-Einstellungen (Wie oft darf man jeden Joker benutzen?)
    maxJokers: {
        speed: 10,             // Anzahl für Speed-Joker
        endstation: 10,        // Anzahl für Endstation-Joker
        umsteigen: 10,         // Anzahl für Umsteigen-Joker
        nachhause: 10          // Anzahl für Nachhause-Joker
    }
};