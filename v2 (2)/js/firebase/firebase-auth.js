import { auth, db, googleProvider } from "./firebase-init.js";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    onAuthStateChanged,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Funktion, um die Event-Listener an die Formulare zu haengen
function initAuthFormListeners() {
    // Handle login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            signInWithEmailAndPassword(auth, email, password)
                .then(() => { window.location.reload(); }) // Aktuelle Seite aktualisieren
                .catch((error) => { alert("Login failed: " + error.message); });
        });
    }

    // Handle signup form submission
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const firstName = document.getElementById('signupVorname').value;
            const lastName = document.getElementById('signupNachname').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;

            let registeredUser = null;

            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    registeredUser = userCredential.user;
                    const displayName = `${firstName} ${lastName}`.trim();
                    return updateProfile(registeredUser, { displayName: displayName });
                })
                .then(async () => {
                    if (db) {
                        await setDoc(doc(db, "users", registeredUser.uid), {
                            firstName: firstName,
                            lastName: lastName,
                            displayName: `${firstName} ${lastName}`.trim(),
                            email: email,
                            role: "Member",
                            subscription: "Free",
                            avatarUrl: "https://www.w3schools.com/howto/img_avatar.png",
                            language: "en",
                            sbbTarif: "none"
                        });
                    }
                })
                .then(() => {
                    window.location.reload(); // Aktuelle Seite aktualisieren
                })
                .catch((error) => {
                    alert("Registration failed: " + error.message);
                });
        });
    }

    // Handle Google login button click
    const googleBtn = document.getElementById('googleLoginBtn');
    if (googleBtn) {
        googleBtn.addEventListener('click', () => {
            signInWithPopup(auth, googleProvider)
                .then(() => { window.location.reload(); }) // Aktuelle Seite aktualisieren
                .catch((error) => { alert("Google login failed: " + error.message); });
        });
    }
}

// Warten, bis page-elements.js meldet, dass die Modals im HTML existieren
document.addEventListener('modalsLoaded', () => {
    initAuthFormListeners();
});


// Monitor authentication state to update the header navigation
onAuthStateChanged(auth, async (user) => {
    // 1. Automatische Sichtbarkeit fuer Klassen umschalten
    updateVisibilityBasedOnAuth(user);

    const checkHeaderInterval = setInterval(async () => {
        const loginNavBtns = document.querySelectorAll('#loginNavBtn, #profileMenuToggle');

        if (loginNavBtns.length > 0) {
            clearInterval(checkHeaderInterval);

            if (user) {
                // --- USER IST EINGELOGGT ---
                let displayName = user.displayName || user.email;
                let avatarUrl = 'https://www.w3schools.com/howto/img_avatar.png';

                if (db) {
                    try {
                        const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                        const userDocRef = doc(db, "users", user.uid);
                        const userDoc = await getDoc(userDocRef);

                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            if (userData.avatarUrl) avatarUrl = userData.avatarUrl;
                            if (userData.displayName) displayName = userData.displayName;

                            if (userData.language && typeof window.setLanguage === 'function') {
                                window.setLanguage(userData.language);
                            }
                        }
                    } catch (error) {
                        console.error("Error loading header profile image or language:", error);
                    }
                }

                const userHeaderHTML = `
                    <div id="userProfileGroup" class="inline-block text-left">
                        <button id="profileMenuToggle" class="flex items-center gap-3 text-white rounded-sm text-sm font-medium transition cursor-pointer">
                            <img src="${avatarUrl}" alt="Profilbild" class="w-8 h-8 rounded-full border border-white/40 object-cover">
                            <span class="text-white font-medium text-sm inline">${displayName}</span>
                            <svg id="profileArrow" class="w-4 h-4 text-white transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                        
                        <div id="profileDropdown" class="hidden absolute left-0 right-0 top-full bg-red-600 shadow-md p-4 text-sm z-50 space-y-1 md:right-13 md:left-auto md:top-16 md:w-48 md:rounded-sm">
                            <div class="max-w-7xl mx-auto px-2 md:px-0 space-y-2">
                                <a data-key="header.account" href="account" class="w-full text-left text-white/80 hover:text-white/100 hover:bg-white/20 block rounded-sm px-4 py-2">
                                    Edit Account
                                </a>
                                <hr class="border-white/50">
                                <button data-key="header.logout" id="logoutBtn" class="w-full text-left text-white/80 hover:text-white/100 hover:bg-white/20 block rounded-sm px-4 py-2 cursor-pointer">
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                if (!document.getElementById('userProfileGroup')) {
                    loginNavBtns.forEach(btn => {
                        btn.outerHTML = userHeaderHTML;
                    });
                }

                const menuToggle = document.getElementById('profileMenuToggle');
                const dropdown = document.getElementById('profileDropdown');
                const profileArrow = document.getElementById('profileArrow');

                if (menuToggle && dropdown) {
                    menuToggle.replaceWith(menuToggle.cloneNode(true));
                    const newMenuToggle = document.getElementById('profileMenuToggle');

                    newMenuToggle.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const isClosed = dropdown.classList.contains('hidden');

                        if (isClosed) {
                            dropdown.classList.remove('hidden');
                            if (profileArrow) profileArrow.classList.add('rotate-180');
                        } else {
                            dropdown.classList.add('hidden');
                            if (profileArrow) profileArrow.classList.remove('rotate-180');
                        }
                    });
                }

                document.addEventListener('click', () => {
                    if (dropdown) dropdown.classList.add('hidden');
                    if (profileArrow) profileArrow.classList.remove('rotate-180');
                });

                const logoutBtn = document.getElementById('logoutBtn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', () => {
                        localStorage.setItem('selectedLanguage', 'en');
                        signOut(auth).then(() => {
                            window.location.reload();
                        }).catch((error) => {
                            console.error("Fehler beim Ausloggen:", error);
                            window.location.reload();
                        });
                    });
                }

            } else {
                // --- USER IST AUSGELOGGT ---
                // Hier muessen wir nur noch das Profil-Menue wieder zum Login-Button machen, falls es da war
                const profileGroup = document.getElementById('userProfileGroup');
                if (profileGroup) {
                    profileGroup.outerHTML = `
                        <a data-key="nav.login" id="loginNavBtn" class="bg-white/40 hover:bg-white/60 text-white rounded-sm px-5 py-2.5 text-sm font-medium transition" href="#">
                            LOGIN
                        </a>
                    `;
                }
            }
        }
    }, 100);
});

function updateVisibilityBasedOnAuth(user) {
    const loggedInElements = document.querySelectorAll('.show-logged-in');
    const loggedOutElements = document.querySelectorAll('.show-logged-out');

    if (user) {
        // Benutzer ist EINGELOGGT
        loggedInElements.forEach(el => {
            el.setAttribute('data-active', 'true');
            el.style.removeProperty('display');
        });
        loggedOutElements.forEach(el => {
            el.removeAttribute('data-active');
            el.style.setProperty('display', 'none', 'important');
        });
    } else {
        // Benutzer ist AUSGELOGGT
        loggedInElements.forEach(el => {
            el.removeAttribute('data-active');
            el.style.setProperty('display', 'none', 'important');
        });
        loggedOutElements.forEach(el => {
            el.setAttribute('data-active', 'true');
            el.style.removeProperty('display');
        });
    }
}