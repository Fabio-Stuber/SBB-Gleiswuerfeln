// Hilfsfunktion, um verschachtelte Texte aus der JSON-Datei zu lesen
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : null;
    }, obj);
}

// Hauptfunktion zum Laden und Setzen der Sprache
async function setLanguage(language) {
    try {
        const response = await fetch(`./language/${language}.json`);

        if (!response.ok) {
            throw new Error(`language for ${language} could not be loaded.`);
        }

        const translations = await response.json();

        // Alle Elemente mit dem Attribut [data-key] übersetzen
        const elements = document.querySelectorAll('[data-key]');
        elements.forEach(element => {
            const key = element.getAttribute('data-key');
            const translatedText = getNestedValue(translations, key);

            if (translatedText !== null) {
                const tagName = element.tagName.toLowerCase();

                if (tagName === 'img') {
                    element.src = translatedText;
                } else if (tagName === 'meta') {
                    element.setAttribute('content', translatedText);
                } else if (tagName === 'title') {
                    document.title = translatedText;
                } else {
                    element.innerHTML = translatedText;
                }
            }
        });

        // Sprache im Browser speichern und HTML-Attribut anpassen
        localStorage.setItem('selectedLanguage', language);
        document.documentElement.lang = language;

        // URL-Parameter anpassen (?lang=...)
        // const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?lang=' + language;
        // window.history.pushState({ path: newUrl }, '', newUrl);

    } catch (error) {
        console.error("Error while loading language:", error);
    }
}

// Funktion global verfügbar machen, damit du sie im Account-Bereich aufrufen kannst
window.setLanguage = setLanguage;