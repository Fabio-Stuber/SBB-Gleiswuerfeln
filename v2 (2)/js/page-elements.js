function updateTheme() {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    };
}

updateTheme();

function darkMode() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (document.documentElement.classList.contains('dark')) {
                localStorage.theme = 'light';
            } else {
                localStorage.theme = 'dark';
            }
            updateTheme();
        });
    };
}

function mobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileMenu = document.getElementById('mobileMenu');

    const burgerIcon = mobileMenuToggle?.querySelector('.burger-icon');
    const closeIcon = mobileMenuToggle?.querySelector('.close-icon');

    if (mobileMenuToggle && mobileMenu) {
        mobileMenuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            mobileMenu.classList.toggle('hidden');
            const isOpen = !mobileMenu.classList.contains('hidden');

            if (burgerIcon && closeIcon) {
                if (isOpen) {
                    burgerIcon.classList.add('hidden');
                    closeIcon.classList.remove('hidden');
                } else {
                    burgerIcon.classList.remove('hidden');
                    closeIcon.classList.add('hidden');
                }
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            if (!mobileMenu.contains(e.target)) {
                mobileMenu.classList.add('hidden');
                if (burgerIcon && closeIcon) {
                    burgerIcon.classList.remove('hidden');
                    closeIcon.classList.add('hidden');
                }
            }
        }
    });
}

function languageSwitcher() {
    if (typeof setLanguage === 'function') {
        // 1. Parameter aus der URL auslesen (?lang=de)
        const urlParams = new URLSearchParams(window.location.search);
        let targetLanguage = urlParams.get('lang');

        if (targetLanguage) {
            // Wenn über die URL mitgegeben, nur im sessionStorage für diesen Tab merken
            sessionStorage.setItem('selectedLanguage', targetLanguage);
        } else {
            // 2. Wenn nicht in der URL, zuerst im sessionStorage nachschauen
            targetLanguage = sessionStorage.getItem('selectedLanguage');

            // 3. Wenn dort auch nicht, den normalen localStorage nutzen
            if (!targetLanguage) {
                targetLanguage = localStorage.getItem('selectedLanguage');
            }
        }

        // 4. Wenn absolut nichts gesetzt ist, Englisch als Standard nutzen
        if (!targetLanguage) {
            targetLanguage = 'en';
        }

        // Sprache anwenden
        setLanguage(targetLanguage);
    }
}


// Universelle Funktion zum Oeffnen und Schliessen von Modals
function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (modal) {
        if (show) {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    }
}

// Event-Listener fuer alle Knöpfe einrichten
function setupModalToggles() {
    // Wenn man irgendwo auf den Login- oder Registrierungs-Button klickt
    document.addEventListener('click', (e) => {
        if (e.target.closest('#loginNavBtn')) {
            e.preventDefault();
            toggleModal('loginModal', true);
            toggleModal('signupModal', false);
        }
        // Neu: Oeffnet das Registrierungs-Fenster direkt
        if (e.target.closest('#signupNavBtn')) {
            e.preventDefault();
            toggleModal('signupModal', true);
            toggleModal('loginModal', false);
        }
    });

    // Schliessen-Buttons
    document.getElementById('closeLoginBtn')?.addEventListener('click', () => toggleModal('loginModal', false));
    document.getElementById('closeSignupBtn')?.addEventListener('click', () => toggleModal('signupModal', false));

    // Hin- und Herschalten zwischen Registrieren und Login
    document.getElementById('switchToSignup')?.addEventListener('click', () => {
        toggleModal('loginModal', false);
        toggleModal('signupModal', true);
    });

    document.getElementById('switchToLogin')?.addEventListener('click', () => {
        toggleModal('signupModal', false);
        toggleModal('loginModal', true);
    });

    // Schliessen, wenn man ausserhalb des Fensters auf den dunklen Hintergrund klickt
    window.addEventListener('click', (e) => {
        const loginModal = document.getElementById('loginModal');
        const signupModal = document.getElementById('signupModal');
        if (e.target === loginModal) toggleModal('loginModal', false);
        if (e.target === signupModal) toggleModal('signupModal', false);
    });
}

// Modals im Hintergrund laden
function loadAuthModals() {
    const loginContainer = document.getElementById('loginModalContainer');
    const signupContainer = document.getElementById('signupModalContainer');

    if (loginContainer && signupContainer) {
        Promise.all([
            fetch('page-elements/login-modal.html').then(r => r.text()),
            fetch('page-elements/signup-modal.html').then(r => r.text())
        ]).then(([loginHtml, signupHtml]) => {
            loginContainer.innerHTML = loginHtml;
            signupContainer.innerHTML = signupHtml;
            setupModalToggles();

            // Sende ein Event, damit firebase-auth.js weiss, dass die Formulare da sind
            document.dispatchEvent(new Event('modalsLoaded'));
        });
    }
}

// Start des Ladevorgangs für den Header
fetch('page-elements/header.html')
    .then(response => response.text())
    .then(data => {
        const navContainer = document.getElementById('header');
        if (navContainer) {
            navContainer.innerHTML = data;
            navContainer.classList.add('sticky', 'top-0', 'z-50', 'shadow-sm');
            initHeaderScripts();
            darkMode();
            mobileMenu();
            languageSwitcher();
            loadAuthModals(); // Modals laden, sobald der Header da ist
        }
    })
    .catch(error => console.log("Fehler beim Laden des Headers:", error));

function initHeaderScripts() {
    let currentPage = window.location.pathname.split("/").pop();
    if (currentPage === "" || currentPage === "index.html" || currentPage === "index" || currentPage === undefined) {
        currentPage = "/";
    }

    const activeLinks = document.querySelectorAll(
        `#navigation nav a[href="${currentPage}"], #navigation #mobileMenu a[href="${currentPage}"]`
    );

    // Nur ausführen, wenn auch wirklich passende Links gefunden wurden
    if (activeLinks && activeLinks.length > 0) {
        activeLinks.forEach(link => {
            link.classList.remove('text-white/80');
            link.classList.add('text-white/100', 'font-bold');
        });
    }
}

// Start des Ladevorgangs für den Footer
fetch('page-elements/footer.html')
    .then(response => response.text())
    .then(data => {
        const footerContainer = document.getElementById('footer');
        if (footerContainer) {
            footerContainer.innerHTML = data;

            setTimeout(() => {
                initFooterScripts();
            }, 100);
        }
    })

function initFooterScripts() {
    const yearSpan = document.getElementById('copyrightYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}

fetch('page-elements/Cookie-banner.html')
    .then(response => response.text())
    .then(data => {
        const cookieContainer = document.getElementById('cookieBanner');
        cookieContainer.innerHTML = data;
        cookieContainer.classList.add('fixed', 'bottom-4', 'left-4', 'right-4', 'md:left-auto', 'md:max-w-md', 'bg-gray-100', 'dark:bg-gray-900', 'border', 'border-gray-200', 'dark:border-gray-800', 'p-6', 'rounded-lg', 'shadow-xl', 'z-50', 'transition-all', 'duration-300', 'transform', 'translate-y-0');
        initCookieScripts();
    });

function initCookieScripts() {
    const banner = document.getElementById("cookieBanner");
    const acceptBtn = document.getElementById("acceptCookies");
    const declineBtn = document.getElementById("declineCookies");

    if (banner && acceptBtn && declineBtn) {
        if (localStorage.getItem("cookieBannerDecision")) {
            banner.classList.add("hidden");
        } else {
            banner.classList.remove("hidden");
        }

        acceptBtn.addEventListener("click", function () {
            localStorage.setItem("cookieBannerDecision", "accepted");
            banner.classList.add("hidden");
            loadGoogleAnalytics();
        });

        if (localStorage.getItem("cookieBannerDecision") === "accepted") {
            loadGoogleAnalytics();
        }

        function loadGoogleAnalytics() {
            const gaId = 'G-8D4W3TJ3YZ';
            const script1 = document.createElement('script');
            script1.async = true;
            script1.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
            document.head.appendChild(script1);

            const script2 = document.createElement('script');
            script2.innerHTML = `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}', { 'anonymize_ip': true });
            `;
            document.head.appendChild(script2);
        }

        declineBtn.addEventListener("click", function () {
            localStorage.setItem("cookieBannerDecision", "declined");
            banner.classList.add("hidden");
        });
    };
}

function togglePasswordVisibility(inputId, textId) {
    const passwordInput = document.getElementById(inputId);
    const toggleText = document.getElementById(textId);

    if (passwordInput && toggleText) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleText.textContent = 'Hide';
        } else {
            passwordInput.type = 'password';
            toggleText.textContent = 'Show';
        }
    }
}

// Funktion global verfuegbar machen
window.togglePasswordVisibility = togglePasswordVisibility;


// Funktion, die beim Laden der Seite den URL-Hash prueft
function checkUrlHash() {
    const hash = window.location.hash;

    if (hash === '#login') {
        toggleModal('loginModal', true);
        toggleModal('signupModal', false);
    } else if (hash === '#signup') {
        toggleModal('signupModal', true);
        toggleModal('loginModal', false);
    }
}

// Fuehre die Pruefung aus, sobald die Seite fertig geladen ist
window.addEventListener('DOMContentLoaded', checkUrlHash);

// Optional: Falls sich der Hash aendert, waehrend die Seite schon offen ist
window.addEventListener('hashchange', checkUrlHash);