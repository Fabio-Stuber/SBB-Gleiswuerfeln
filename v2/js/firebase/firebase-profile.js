import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, updateProfile, deleteUser, updatePassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Funktion zum Aktualisieren des Profils einschliesslich der neuen Felder
window.updateUserProfile = function (firstName, lastName, avatarUrl, language, sbbTarif, newPassword) {
    const user = auth.currentUser;

    if (user) {
        const displayName = `${firstName} ${lastName}`.trim();

        // 1. Name im Login-System aktualisieren
        updateProfile(user, {
            displayName: displayName
        }).then(async () => {

            // 2. Zusätzliche Daten in der Datenbank speichern
            if (db) {
                const userDocRef = doc(db, "users", user.uid);
                await updateDoc(userDocRef, {
                    firstName: firstName,
                    lastName: lastName,
                    displayName: displayName,
                    avatarUrl: avatarUrl,
                    language: language,
                    sbbTarif: sbbTarif
                });
            }

            // 3. Passwort ändern, falls der Nutzer ein neues eingegeben hat
            if (newPassword && newPassword.trim() !== "") {
                try {
                    await updatePassword(user, newPassword);
                    alert("Profil und Passwort erfolgreich aktualisiert!");
                } catch (passError) {
                    if (passError.code === 'auth/requires-recent-login') {
                        alert("Aus Sicherheitsgründen müssen Sie sich neu anmelden, um das Passwort zu ändern.");
                    } else {
                        alert("Fehler beim Passwort ändern: " + passError.message);
                    }
                }
            } else {
                alert("Profil erfolgreich aktualisiert!");
            }

            window.location.reload();
        }).catch((error) => {
            alert("Fehler beim Aktualisieren: " + error.message);
        });
    } else {
        alert("Kein Nutzer angemeldet!");
    }
};

// Daten beim Laden der Seite in die neuen Felder einfügen
window.initProfilePage = function () {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // ... (Dein Code für den eingeloggten Zustand bleibt genau gleich) ...
            document.getElementById('profileEmail').value = user.email || '';
            document.getElementById('profileHeaderEmail').textContent = user.email || '';
            document.getElementById('profileDisplayName').value = user.displayName || '';
            document.getElementById('profileHeaderName').textContent = user.displayName || 'User';
            document.getElementById('profilePreview').src = 'https://www.w3schools.com/howto/img_avatar.png';

            if (db) {
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    document.getElementById('profileFirstName').value = userData.firstName || '';
                    document.getElementById('profileLastName').value = userData.lastName || '';
                    document.getElementById('userRole').textContent = userData.role || 'Member';
                    document.getElementById('userSubscription').textContent = userData.subscription || 'Free';

                    if (userData.language) {
                        document.getElementById('profileLanguage').value = userData.language;
                        if (typeof window.setLanguage === 'function') {
                            window.setLanguage(userData.language);
                        }
                    }

                    if (userData.sbbTarif) {
                        document.getElementById('profileSbbTarif').value = userData.sbbTarif;
                    }

                    if (userData.avatarUrl) {
                        document.getElementById('profilePreview').src = userData.avatarUrl;
                    }
                }
            }
        } else {
            // Wenn kein Nutzer angemeldet ist: Standardmässig 'en' laden
            const localLang = localStorage.getItem('selectedLanguage') || 'en';
            if (typeof window.setLanguage === 'function') {
                window.setLanguage(localLang);
            }
            // Optional: Weiterleitung zur Startseite, falls ausgeloggte Personen die Seite gar nicht sehen dürfen:
            window.location.href = "/";
        }
    });
};

// Formular-Absendung verarbeiten und die neuen Werte weitergeben
window.handleProfileSubmit = function (event) {
    event.preventDefault();

    const firstName = document.getElementById('profileFirstName').value;
    const lastName = document.getElementById('profileLastName').value;
    const avatarUrl = document.getElementById('profilePreview').src;

    const language = document.getElementById('profileLanguage').value;
    const sbbTarif = document.getElementById('profileSbbTarif').value;
    const newPassword = document.getElementById('profileNewPassword').value;

    if (typeof window.updateUserProfile === 'function') {
        window.updateUserProfile(firstName, lastName, avatarUrl, language, sbbTarif, newPassword);
    }
};

// Funktion zum Umschalten der Passwort-Sichtbarkeit
window.togglePasswordVisibility = function () {
    const passwordInput = document.getElementById('profileNewPassword');
    const toggleText = document.getElementById('passwordToggleText');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleText.textContent = 'Hide';
    } else {
        passwordInput.type = 'password';
        toggleText.textContent = 'Show';
    }
};

// Funktion speichert die Sprache sofort und aktualisiert die Seite ohne Neuladen
window.autoUpdateLanguage = async function (selectedLanguage) {
    const user = auth.currentUser;

    if (user && db) {
        // Wenn angemeldet: in Firebase speichern (localStorage wird ignoriert)
        try {
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
                language: selectedLanguage
            });
        } catch (error) {
            console.error("Fehler beim Speichern der Sprache in Firebase:", error);
        }
    } else {
        // NUR wenn KEIN Nutzer angemeldet ist, nutzen wir den localStorage
        localStorage.setItem('selectedLanguage', selectedLanguage);
    }

    // Ihre Funktion aus translation.js direkt aufrufen, damit der Header updatet
    if (typeof window.setLanguage === 'function') {
        window.setLanguage(selectedLanguage);
    }
};