// MILANO CAFE - Public Menu Handler
import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Translation Dictionaries
const translations = {
    en: {
        title: "Milano Cafe | Premium Digital Menu",
        subtitle: "Where tranquility meets mood",
        explore: "Explore Menu",
        searchPlaceholder: "Search menu...",
        noItems: "No items found matching your search.",
        bestSeller: "Best Seller",
        footerTagline: "An elegant premium QR digital menu experience in Sudan.",
        footerContact: "Contact Us",
        footerFollow: "Follow Us",
        address: "Omdurman - Nile St - North of Al Abraj Stop",
        langToggle: "العربية"
    },
    ar: {
        title: "ميلانو كافيه | قائمة الطعام الرقمية",
        subtitle: "حيث يجتمع الهدوء والمزاج",
        explore: "تصفح المنيو",
        searchPlaceholder: "ابحث في القائمة...",
        noItems: "لم يتم العثور على عناصر تطابق بحثك.",
        bestSeller: "الأكثر طلباً",
        footerTagline: "تجربة قائمة رقمية فاخرة عبر رمز QR في السودان.",
        footerContact: "اتصل بنا",
        footerFollow: "تابعنا",
        address: "امدرمان - شارع النيل - شمال استوب الابراج",
        langToggle: "English"
    }
};


const appState = {
    products: [],
    categories: [],
    settings: {},
    currentLang: "ar",
    searchQuery: ""
};

// ─────────────────────────────────────────
// Lifecycle & Fetch
// ─────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
    // Check local storage for language preference
    const savedLang = localStorage.getItem("milano_lang");
    if (savedLang) {
        appState.currentLang = savedLang;
        document.documentElement.setAttribute("lang", savedLang);
        document.documentElement.setAttribute("dir", savedLang === 'ar' ? 'rtl' : 'ltr');
    }
    
    updateUILanguage();
    fetchMenuData();
    setupCategoryArrows();
});

function setupCategoryArrows() {
    const btnLeft = document.getElementById('nav-arrow-left');
    const btnRight = document.getElementById('nav-arrow-right');
    const navContainer = document.getElementById('category-nav-links');

    if (btnLeft && btnRight && navContainer) {
        btnLeft.addEventListener('click', () => {
            navContainer.scrollBy({ left: -200, behavior: 'smooth' });
        });
        
        btnRight.addEventListener('click', () => {
            navContainer.scrollBy({ left: 200, behavior: 'smooth' });
        });
    }
}

async function fetchMenuData() {
    const preloader = document.getElementById("preloader");
    try {
        // Allow admin to force-refresh cache by adding ?refresh=true to the URL
        if (window.location.search.includes('refresh')) {
            localStorage.removeItem("milano_cached_menu");
            localStorage.removeItem("milano_cache_time");
            console.log("Cache cleared via URL parameter");
        }

        // 1. Check phone's local cache (0 Firebase reads)
        const cachedStr = localStorage.getItem("milano_cached_menu");
        const cacheTime = localStorage.getItem("milano_cache_time");
        const TWO_HOURS = 2 * 60 * 60 * 1000;

        if (cachedStr && cacheTime && (Date.now() - parseInt(cacheTime) < TWO_HOURS)) {
            console.log("Loading menu from local cache (0 Firebase Reads)");
            const data = JSON.parse(cachedStr);
            appState.products = data.products || [];
            appState.categories = data.categories || [];
            appState.settings = data.settings || {};
        } else {
            // 2. Cache expired or missing -> Fetch from Firebase (1 Read)
            console.log("Fetching fresh menu from Firebase (1 Read)");
            const docRef = doc(db, "published_menu", "live");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                appState.products = data.products || [];
                appState.categories = data.categories || [];
                appState.settings = data.settings || {};
                localStorage.setItem("milano_cached_menu", JSON.stringify(data));
                localStorage.setItem("milano_cache_time", Date.now().toString());
            }
            // If document doesn't exist, products stays empty -> no fake menu shown
        }
    } catch (error) {
        console.warn("Could not fetch from Firebase:", error);
        // Don't show fake mock products - leave menu empty so customer knows it's loading
    } finally {
        // Sort categories just to guarantee order
        if (appState.categories && appState.categories.length > 0) {
            appState.categories.sort((a, b) => {
                const orderA = typeof a.order === 'number' ? a.order : 9999;
                const orderB = typeof b.order === 'number' ? b.order : 9999;
                return orderA - orderB;
            });
        }
        
        applySettings();
        renderMenu();
        window.scrollTo(0, 0);
        preloader.classList.add("fade-out");
        setTimeout(() => {
            const heroContent = document.querySelector('.hero-content');
            if (heroContent) heroContent.classList.add('animate-hero');
        }, 300);
    }
}

// Render Menu based on current state (language, search query)
function renderMenu() {
    const query = appState.searchQuery.toLowerCase().trim();
    
    // Filter by search query
    let filteredProducts = appState.products.filter(p => {
        // Match name in en or ar
        if (query) {
            const nameEn = (p.name_en || '').toLowerCase();
            const nameAr = (p.name_ar || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            return nameEn.includes(query) || nameAr.includes(query) || category.includes(query);
        }
        return true;
    });

    // Sort by price ascending
    filteredProducts.sort((a, b) => Number(a.price) - Number(b.price));

    const menuContent = document.getElementById("menu-content");
    const noProductsMsg = document.getElementById("no-products-message");
    const categoryNav = document.getElementById("category-nav-links");
    
    menuContent.innerHTML = "";
    categoryNav.innerHTML = "";
    
    if (filteredProducts.length === 0) {
        noProductsMsg.classList.remove("d-none");
        return;
    } else {
        noProductsMsg.classList.add("d-none");
    }

    // Group products by category slug/name (whatever is stored in product.category)
    const categoriesMap = {};
    filteredProducts.forEach(p => {
        const cat = (p.category || "other").trim();
        if (!categoriesMap[cat]) categoriesMap[cat] = [];
        categoriesMap[cat].push(p);
    });

    // Build the ordered list of category keys using appState.categories order (set by admin)
    // Each category in appState.categories has: id, name_ar, name_en, slug
    // Products store their category as slug, name_en, or name_ar — check all possibilities
    const orderedCategoryKeys = [];
    const usedKeys = new Set();

    appState.categories.forEach(cat => {
        // All possible values that a product's .category field might hold for this category
        const possibleKeys = [
            (cat.slug || '').trim(),
            (cat.name_en || '').trim().toLowerCase(),
            (cat.name_ar || '').trim(),
            (cat.id || '').trim()
        ].filter(Boolean);

        // Find the actual key used in categoriesMap
        let matchedKey = null;
        for (const candidate of possibleKeys) {
            // Case-insensitive search across all map keys
            const found = Object.keys(categoriesMap).find(
                k => k.trim().toLowerCase() === candidate.toLowerCase()
            );
            if (found) { matchedKey = found; break; }
        }

        if (matchedKey && !usedKeys.has(matchedKey)) {
            orderedCategoryKeys.push({ key: matchedKey, cat });
            usedKeys.add(matchedKey);
        }
    });

    // Any products whose category doesn't match any admin-defined category go at the end
    Object.keys(categoriesMap).forEach(key => {
        if (!usedKeys.has(key)) {
            orderedCategoryKeys.push({ key, cat: null });
            usedKeys.add(key);
        }
    });

    orderedCategoryKeys.forEach(({ key, cat }, index) => {
        const categoryId = key.replace(/\s+/g, '-').toLowerCase();
        // Use the database name directly if available, otherwise fallback to formatCategoryName
        const isAr = appState.currentLang === 'ar';
        const displayCategoryName = cat
            ? (isAr ? (cat.name_ar || cat.name_en || key) : (cat.name_en || cat.name_ar || key))
            : formatCategoryName(key);
        
        // 1. Add Navigation Link
        const navLink = document.createElement("a");
        navLink.className = `nav-link-custom ${index === 0 ? 'active' : ''}`;
        navLink.textContent = displayCategoryName;
        navLink.setAttribute("href", `#${categoryId}`);
        navLink.addEventListener("click", (e) => {
            e.preventDefault();
            const targetEl = document.getElementById(categoryId);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth' });
                document.querySelectorAll(".nav-link-custom").forEach(l => l.classList.remove("active"));
                navLink.classList.add("active");
            }
        });
        categoryNav.appendChild(navLink);

        // 2. Build Category Section Grid
        const section = document.createElement("section");
        section.className = "menu-section";
        section.id = categoryId;

        const headerDiv = document.createElement("div");
        headerDiv.className = "category-header";
        
        const titleH2 = document.createElement("h2");
        titleH2.className = "category-title";
        titleH2.textContent = displayCategoryName;
        
        const divider = document.createElement("div");
        divider.className = "category-divider";
        
        headerDiv.appendChild(titleH2);
        headerDiv.appendChild(divider);
        section.appendChild(headerDiv);

        // Row Grid
        const rowDiv = document.createElement("div");
        rowDiv.className = "row g-4 row-cols-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5";

        categoriesMap[key].forEach(p => {
            const cardCol = document.createElement("div");
            cardCol.className = "col";

            const currency = isAr ? 'جنيه' : 'SDG';
            const mainName = isAr ? p.name_ar : p.name_en;
            const subName = isAr ? p.name_en : p.name_ar;

            // Build price display — pizza gets dual sizes, others get single price
            let priceHtml;
            if (p.category === 'pizza' && (p.price_small || p.price_large)) {
                const smallLabel = isAr ? 'صغيرة' : 'Small';
                const largeLabel = isAr ? 'كبيرة' : 'Large';
                priceHtml = `
                    <div class="product-price pizza-price">
                        <span>${smallLabel}: ${Number(p.price_small||0).toLocaleString('en-US')} ${currency}</span>
                        <span>${largeLabel}: ${Number(p.price_large||0).toLocaleString('en-US')} ${currency}</span>
                    </div>`;
            } else {
                priceHtml = `<div class="product-price">${Number(p.price||0).toLocaleString('en-US')} ${currency}</div>`;
            }
            
            const unavailableBadge = p.available ? '' : `<div class="badge-unavailable">${isAr ? 'غير متوفر حالياً' : 'Currently Unavailable'}</div>`;
            const unavailableClass = p.available ? '' : 'unavailable-product';
            
            cardCol.innerHTML = `
                <div class="product-card ${unavailableClass}">
                    <div class="product-image-container">
                        ${p.bestSeller && p.available ? `<span class="badge-bestseller">${translations[appState.currentLang].bestSeller}</span>` : ''}
                        ${unavailableBadge}
                        <img src="${p.image}" alt="${p.name_en || ''}" class="product-image" loading="lazy" 
                             onerror="this.src='https://images.unsplash.com/photo-1507133750040-4a8f57021571?q=80&w=300&auto=format&fit=crop'">
                    </div>
                    <div class="product-info">
                        <div class="product-title-en">${mainName || ''}</div>
                        <div class="product-title-ar small text-muted">${subName || ''}</div>
                        ${priceHtml}
                    </div>
                </div>
            `;
            rowDiv.appendChild(cardCol);
        });

        section.appendChild(rowDiv);
        menuContent.appendChild(section);
    });

    setupScrollHighlight();
}

// Convert category key to suitable translation / capitalization from database
function formatCategoryName(category) {
    const isAr = appState.currentLang === 'ar';
    const key = category.toLowerCase().trim();

    // 1. Look for a matching category from the database (published_menu)
    const dbCat = appState.categories.find(c => c.slug === key || c.name_en.toLowerCase() === key || c.name_ar === key);
    
    if (dbCat) {
        // Return the dynamic database name
        return isAr ? dbCat.name_ar : dbCat.name_en;
    }

    // 2. Fallback dictionary if db empty or mock products
    const dict = {
        "coffee": isAr ? "قهوة" : "Coffee",
        "hot drinks": isAr ? "مشروبات ساخنة" : "Hot Drinks",
        "cold drinks": isAr ? "مشروبات باردة" : "Cold Drinks",
        "fresh drinks": isAr ? "مشروبات طازجة" : "Fresh Drinks",
        "desserts": isAr ? "حلويات" : "Desserts",
        "food": isAr ? "مأكولات" : "Food"
    };
    
    if (dict[key]) {
        return dict[key];
    }
    
    // Capitalize each word for english, or return raw for arabic
    if (isAr) return category;
    return category.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Toggle page language
window.toggleLanguage = function() {
    appState.currentLang = appState.currentLang === 'en' ? 'ar' : 'en';
    
    const isAr = appState.currentLang === 'ar';
    
    // Update HTML lang + dir attributes
    const htmlEl = document.documentElement;
    htmlEl.setAttribute("lang", appState.currentLang);
    htmlEl.setAttribute("dir", isAr ? 'rtl' : 'ltr');
    
    updateUILanguage();
    renderMenu();
};

// Update static text elements
function updateUILanguage() {
    const lang = appState.currentLang;
    const t = translations[lang];
    
    document.title = t.title;
    const heroSubtitle = document.getElementById("hero-subtitle-text");
    if (heroSubtitle) heroSubtitle.textContent = t.subtitle;
    const btnExplore = document.getElementById("btn-explore-text");
    if (btnExplore) btnExplore.textContent = t.explore;
    const noProductsText = document.getElementById("no-products-text");
    if (noProductsText) noProductsText.textContent = t.noItems;
    const footerTagline = document.getElementById("footer-tagline");
    if (footerTagline) footerTagline.textContent = t.footerTagline;
    const footerContact = document.getElementById("footer-contact-title");
    if (footerContact) footerContact.textContent = t.footerContact;
    const footerFollow = document.getElementById("footer-follow-title");
    if (footerFollow) footerFollow.textContent = t.footerFollow;
    const footerAddress = document.getElementById("footer-address");
    if (footerAddress) footerAddress.textContent = t.address;
    const langBtn = document.getElementById("lang-toggle-btn");
    if (langBtn) langBtn.textContent = t.langToggle;
}

// Handle real-time Search filtering
window.handleSearch = function(value) {
    appState.searchQuery = value;
    renderMenu();
};

// Scroll spy logic for updating active state in navigation
function setupScrollHighlight() {
    const sections = document.querySelectorAll(".menu-section");
    const navLinks = document.querySelectorAll(".nav-link-custom");
    
    window.removeEventListener("scroll", onScrollHandler);
    window.addEventListener("scroll", onScrollHandler);
    
    function onScrollHandler() {
        let currentSectionId = "";
        const scrollPosition = window.scrollY + 100;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                currentSectionId = section.getAttribute("id");
            }
        });
        
        if (currentSectionId) {
            navLinks.forEach(link => {
                link.classList.remove("active");
                if (link.getAttribute("href") === `#${currentSectionId}`) {
                    link.classList.add("active");
                }
            });
        }
    }
}

function applySettings() {
    const s = appState.settings;
    if (!s) return;
    const isAr = appState.currentLang === 'ar';

    const brandName = isAr ? (s.name_ar || "Milano Cafe") : (s.name_en || "Milano Cafe");
    const address = isAr ? (s.address_ar || "امدرمان - شارع النيل") : (s.address_en || "Omdurman - Nile St");

    // Title & Meta
    document.title = brandName;
    
    // Texts
    const titleEls = document.querySelectorAll('.brand-font, .preload-title, .footer-brand');
    titleEls.forEach(el => el.textContent = brandName);

    const addressEl = document.getElementById("footer-address");
    if (addressEl) addressEl.textContent = address;

    // Logos
    if (s.logo) {
        document.querySelectorAll('.hero-logo, .preload-logo').forEach(img => {
            img.src = s.logo;
        });
    }

    // Phones
    const contactList = document.querySelector('.list-unstyled');
    if (contactList && s.phones && s.phones.length > 0) {
        // Find the index to insert before address
        const listItems = contactList.querySelectorAll('li');
        let addressHtml = "";
        if(listItems.length > 0) {
            addressHtml = listItems[listItems.length - 1].outerHTML;
        }

        contactList.innerHTML = "";
        s.phones.forEach(phone => {
            const li = document.createElement("li");
            li.className = "mb-2";
            li.innerHTML = `<i class="fa-solid fa-phone me-2 text-accent"></i><a href="tel:${phone}" class="footer-link" dir="ltr">${phone}</a>`;
            contactList.appendChild(li);
        });
        
        if (addressHtml) {
            contactList.insertAdjacentHTML('beforeend', addressHtml);
            document.getElementById("footer-address").textContent = address;
        }
    }

    // Socials
    const followDiv = document.querySelector('.col-md-4.text-center.text-md-end > div');
    if (followDiv) {
        followDiv.innerHTML = "";
        if (s.instagram) followDiv.innerHTML += `<a href="${s.instagram}" target="_blank" class="footer-social-icon"><i class="fa-brands fa-instagram"></i></a>`;
        if (s.facebook) followDiv.innerHTML += `<a href="${s.facebook}" target="_blank" class="footer-social-icon"><i class="fa-brands fa-facebook"></i></a>`;
        if (s.tiktok) followDiv.innerHTML += `<a href="${s.tiktok}" target="_blank" class="footer-social-icon"><i class="fa-brands fa-tiktok"></i></a>`;
        if (s.whatsapp) followDiv.innerHTML += `<a href="${s.whatsapp}" target="_blank" class="footer-social-icon"><i class="fa-brands fa-whatsapp"></i></a>`;
    }
}
