const fs = require('fs');
const path = require('path');

// Liste deiner Sprachen
const languages = ['en', 'fr', 'it'];

// 1. Die originale deutsche index.html einlesen
const originalHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

languages.forEach(lang => {
    try {
        // 2. Die passende JSON-Datei einlesen
        const jsonPath = path.join(__dirname, `language/${lang}.json`);
        const translations = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        let newHtml = originalHtml;

        // 3. Meta-Daten und Titel im HTML ersetzen
        if (translations.meta_title) {
            newHtml = newHtml.replace(/<title>.*?<\/title>/, `<title>${translations.meta_title}</title>`);
            newHtml = newHtml.replace(/<meta property="og:title" content=".*?" \/>/g, `<meta property="og:title" content="${translations.meta_title}" />`);
        }
        if (translations.meta_description) {
            newHtml = newHtml.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${translations.meta_description}" />`);
            newHtml = newHtml.replace(/<meta property="og:description" content=".*?" \/>/g, `<meta property="og:description" content="${translations.meta_description}" />`);
        }
        if (translations.meta_locale) {
            newHtml = newHtml.replace(/<meta property="og:locale" content=".*?" \/>/, `<meta property="og:locale" content="${translations.meta_locale}" />`);
        }

        // Das Sprachattribut im HTML-Tag anpassen
        newHtml = newHtml.replace('<html lang="de">', `<html lang="${lang}">`);

        // 4. Die neue Datei abspeichern (z.B. index-en.html)
        const outputPath = path.join(__dirname, `index-${lang}.html`);
        fs.writeFileSync(outputPath, newHtml, 'utf8');
        console.log(`Erfolgreich erstellt: index-${lang}.html`);

    } catch (error) {
        console.error(`Fehler bei Sprache ${lang}:`, error.message);
    }
});