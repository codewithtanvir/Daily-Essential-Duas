// --- PWA SETUP ---
const manifest = { "name": "Daily Essential Duas", "short_name": "DuaApp", "start_url": ".", "display": "standalone", "background_color": "#121212", "theme_color": "#1e1e1e", "description": "Your daily companion for essential Islamic supplications.", "icons": [{ "src": "https://placehold.co/192x192/FFFFFF/000000/png?text=Dua", "sizes": "192x192", "type": "image/png" }, { "src": "https://placehold.co/512x512/FFFFFF/000000/png?text=Dua", "sizes": "512x512", "type": "image/png" }] };
const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
const manifestURL = URL.createObjectURL(blob);
const link = document.createElement('link');
link.rel = 'manifest';
link.href = manifestURL;
document.head.appendChild(link);

const swCode = `
    const CACHE_NAME = 'daily-duas-cache-v3-bw';
    const urlsToCache = ['/', 'index.html', 'style.css', 'script.js', 'duas.json', 'https://cdn.tailwindcss.com', 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&display=swap'];
    self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache))));
    self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
    self.addEventListener('activate', e => { const c=[CACHE_NAME]; e.waitUntil(caches.keys().then(n => Promise.all(n.map(k => c.indexOf(k)===-1?caches.delete(k):null)))) });
`;
if ('serviceWorker' in navigator) {
    const swBlob = new Blob([swCode], { type: 'application/javascript' });
    const swURL = URL.createObjectURL(swBlob);
    navigator.serviceWorker.register(swURL).then(r => console.log('SW registered')).catch(e => console.log('SW reg failed', e));
}

// --- LANGUAGE & TRANSLATION ---
const langData = {
    en: {
        app_title: "Daily Essential Duas",
        app_subtitle: "Your daily companion",
        lang_en: "EN",
        lang_bn: "BN",
        gemini_title: "Find a Dua for Your Situation",
        gemini_subtitle: "Feeling a certain way? Describe it below.",
        gemini_placeholder: "e.g., 'I am feeling anxious about my exam'",
        gemini_button: "Get a Dua for me",
        gemini_result_title: "Here is a dua for your situation:",
        translation_label: "Translation:",
        transliteration_label: "Transliteration:",
        reference_label: "Reference:",
        copy_button: "Copy Dua",
        copied_message: "Copied to clipboard!",
        error_message: "Sorry, couldn't fetch a dua. Please try again.",
        input_error: "Please describe your situation first."
    },
    bn: {
        app_title: "দৈনিক প্রয়োজনীয় দোয়া",
        app_subtitle: "আপনার প্রতিদিনের সঙ্গী",
        lang_en: "EN",
        lang_bn: "BN",
        gemini_title: "আপনার পরিস্থিতির জন্য দোয়া খুঁজুন",
        gemini_subtitle: "আপনার অনুভূতি নিচের বক্সে লিখুন।",
        gemini_placeholder: "যেমন, 'আমি পরীক্ষা নিয়ে চিন্তিত'",
        gemini_button: "আমার জন্য একটি দোয়া দিন",
        gemini_result_title: "আপনার পরিস্থিতির জন্য একটি দোয়া:",
        translation_label: "অনুবাদ:",
        transliteration_label: "উচ্চারণ:",
        reference_label: "সূত্র:",
        copy_button: "দোয়াটি কপি করুন",
        copied_message: "ক্লিপবোর্ডে কপি করা হয়েছে!",
        error_message: "দুঃখিত, দোয়া আনা সম্ভব হয়নি। আবার চেষ্টা করুন।",
        input_error: "অনুগ্রহ করে প্রথমে আপনার পরিস্থিতি বর্ণনা করুন।"
    }
};

const languageToggle = document.getElementById('language-toggle');
let currentLang = localStorage.getItem('duaAppLang') || 'en';

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('duaAppLang', lang);
    document.documentElement.lang = lang;
    languageToggle.checked = lang === 'bn';
    
    document.querySelectorAll('[data-lang-key]').forEach(el => {
        const key = el.getAttribute('data-lang-key');
        if (langData[lang][key]) {
            if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
                el.placeholder = langData[lang][key];
            } else {
                el.textContent = langData[lang][key];
            }
        }
    });
    renderStaticDuas(); // Re-render duas with the correct language
}

languageToggle.addEventListener('change', () => {
    setLanguage(languageToggle.checked ? 'bn' : 'en');
});

// --- GEMINI API INTEGRATION ---
const getDuaBtn = document.getElementById('get-dua-btn');
const situationInput = document.getElementById('situation-input');
const geminiResultContainer = document.getElementById('gemini-result');
const geminiLoader = document.getElementById('gemini-loader');
const messageBox = document.getElementById('message-box');

function showMessage(text, isError = false) {
    messageBox.querySelector('p').textContent = text;
    messageBox.className = `fixed bottom-5 left-1/2 -translate-x-1/2 text-white py-2 px-4 rounded-lg shadow-lg ${isError ? 'bg-red-600' : 'bg-green-500'}`;
    messageBox.classList.remove('hidden');
    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, 3000);
}

getDuaBtn.addEventListener('click', async () => {
    const situation = situationInput.value.trim();
    if (!situation) {
        showMessage(langData[currentLang].input_error, true);
        return;
    }

    geminiLoader.classList.remove('hidden');
    geminiResultContainer.classList.add('hidden');
    getDuaBtn.disabled = true;

    try {
        const response = await fetch('/api/get-dua', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ situation })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const result = await response.json();
        const duaData = JSON.parse(result.candidates[0].content.parts[0].text);
        const translation = currentLang === 'bn' ? duaData.bengali_translation : duaData.english_translation;

        geminiResultContainer.innerHTML = `
            <h3 class="text-md font-semibold text-gray-300 mb-3">${langData[currentLang].gemini_result_title}</h3>
            <p class="arabic-text text-right my-4" dir="rtl">${duaData.arabic}</p>
            <p class="italic text-gray-400 my-2"><strong>${langData[currentLang].transliteration_label}</strong> ${duaData.transliteration}</p>
            <p class="my-2 bengali-text"><strong>${langData[currentLang].translation_label}</strong> ${translation}</p>
            <p class="text-sm text-gray-500 mt-3"><strong>${langData[currentLang].reference_label}</strong> ${duaData.reference}</p>
        `;
        geminiResultContainer.classList.remove('hidden');

    } catch (error) {
        console.error("Error fetching from backend:", error);
        showMessage(langData[currentLang].error_message, true);
    } finally {
        geminiLoader.classList.add('hidden');
        getDuaBtn.disabled = false;
    }
});


// --- DYNAMIC DUA LOADING & RENDERING ---
const duaListContainer = document.getElementById('dua-list');
let allDuas = [];

// Fetches duas from JSON and triggers the initial render
async function loadDuas() {
    try {
        const response = await fetch('duas.json');
        if (!response.ok) throw new Error('Failed to load duas.');
        allDuas = await response.json();
        // Once duas are loaded, set the language and render everything.
        setLanguage(currentLang);
    } catch (error) {
        console.error('Error loading duas:', error);
        duaListContainer.innerHTML = `<p class="text-center text-red-400">Failed to load duas. Please check your connection and try again.</p>`;
    }
}

// Renders the list of duas based on the current language
function renderStaticDuas() {
    if (!allDuas) return; // Don't render if duas haven't been loaded
    duaListContainer.innerHTML = '';
    allDuas.forEach((dua) => {
        const title = currentLang === 'bn' ? dua.title_bn : dua.title_en;
        const translation = currentLang === 'bn' ? dua.translation_bn : dua.translation_en;

        const duaCard = document.createElement('div');
        duaCard.className = 'dua-card neumorphic-card';
        duaCard.innerHTML = `
            <div class="p-4 flex justify-between items-center cursor-pointer dua-card-header">
                <h2 class="text-lg font-semibold bengali-text">${title}</h2>
                <svg class="w-6 h-6 text-gray-400 arrow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
            <div class="dua-card-content">
                <div class="px-4 pb-4 border-t-2 border-gray-800">
                    <p class="arabic-text text-right my-4" dir="rtl">${dua.arabic}</p>
                    <p class="italic text-gray-400 my-2"><strong>${langData[currentLang].transliteration_label}</strong> ${dua.transliteration}</p>
                    <p class="my-2 bengali-text"><strong>${langData[currentLang].translation_label}</strong> ${translation}</p>
                    <p class="text-sm text-gray-500 mt-3"><strong>${langData[currentLang].reference_label}</strong> ${dua.reference}</p>
                    <button class="copy-btn mt-4 w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors duration-300">
                        ${langData[currentLang].copy_button}
                    </button>
                </div>
            </div>
        `;
        duaListContainer.appendChild(duaCard);
    });
    addCardListeners();
}

// Adds event listeners to the dua cards for accordion and copy functionality
function addCardListeners() {
    document.querySelectorAll('.dua-card').forEach(card => {
        card.querySelector('.dua-card-header').addEventListener('click', () => {
            const wasOpen = card.classList.contains('open');
            document.querySelectorAll('.dua-card').forEach(c => c.classList.remove('open'));
            if (!wasOpen) card.classList.add('open');
        });

        card.querySelector('.copy-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const title = card.querySelector('h2').innerText;
            const arabicText = card.querySelector('.arabic-text').innerText;
            const transliteration = card.querySelector('.italic').innerText;
            const translation = card.querySelector('.bengali-text').innerText;
            const reference = card.querySelector('.text-sm').innerText;
            const textToCopy = `${title}\n\n${arabicText}\n\n${transliteration}\n\n${translation}\n\n${reference}`;

            navigator.clipboard.writeText(textToCopy).then(() => {
                showMessage(langData[currentLang].copied_message);
            }).catch(err => console.error('Copy failed', err));
        });
    });
}

// --- INITIALIZATION ---
// Set the initial language for UI text, then load and render duas.
loadDuas();