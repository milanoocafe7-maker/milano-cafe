// MILANO CAFE - Public Menu Handler
import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Translation Dictionaries
const translations = {
    en: {
        title: "Milano Cafe | Premium Digital Menu",
        subtitle: "Premium Coffee Experience",
        explore: "Explore Menu",
        searchPlaceholder: "Search menu...",
        noItems: "No items found matching your search.",
        bestSeller: "Best Seller",
        footerTagline: "An elegant premium QR digital menu experience in Sudan.",
        footerContact: "Contact Us",
        footerFollow: "Follow Us",
        address: "Khartoum - Sudan",
        langToggle: "العربية"
    },
    ar: {
        title: "ميلانو كافيه | قائمة الطعام الرقمية",
        subtitle: "تجربة قهوة بطعم مميز",
        explore: "تصفح المنيو",
        searchPlaceholder: "ابحث في القائمة...",
        noItems: "لم يتم العثور على عناصر تطابق بحثك.",
        bestSeller: "الأكثر طلباً",
        footerTagline: "تجربة قائمة رقمية فاخرة عبر رمز QR في السودان.",
        footerContact: "اتصل بنا",
        footerFollow: "تابعنا",
        address: "الخرطوم - السودان",
        langToggle: "English"
    }
};

// Fallback Mock Data for demo/offline preview if API hasn't been set up yet
const mockProducts = [
    {
        name_en: "Espresso",
        name_ar: "اسبريسو",
        category: "coffee",
        price: 2500,
        image: "https://images.unsplash.com/photo-151097252790b-af4f42df8e40?q=80&w=600&auto=format&fit=crop",
        available: true,
        bestSeller: true
    },
    {
        name_en: "Spanish Latte",
        name_ar: "سبانش لاتيه",
        category: "coffee",
        price: 3800,
        image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=600&auto=format&fit=crop",
        available: true,
        bestSeller: true
    },
    {
        name_en: "Cappuccino",
        name_ar: "كابتشينو",
        category: "coffee",
        price: 3200,
        image: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?q=80&w=600&auto=format&fit=crop",
        available: true,
        bestSeller: false
    },
    {
        name_en: "Turkish Coffee",
        name_ar: "قهوة تركية",
        category: "hot drinks",
        price: 2000,
        image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=600&auto=format&fit=crop",
        available: true,
        bestSeller: false
    },
    {
        name_en: "Hot Chocolate",
        name_ar: "شوكولاتة ساخنة",
        category: "hot drinks",
        price: 3000,
        image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?q=80&w=600&auto=format&fit=crop",
        available: true,
        bestSeller: false
    },
    {
        name_en: "Iced Caramel Macchiato",
        name_ar: "كراميل ماكياتو بارد",
        category: "cold drinks",
        price: 4200,
        image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?q=80&w=600&auto=format&fit=crop",
        available: true,
        bestSeller: true
    },
    {
        name_en: "Lemon Mint Juice",
        name_ar: "عصير ليمون بالنعناع",
        category: "fresh drinks",
        price: 1800,
        image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=600&auto=format&fit=crop",
        available: true,
        bestSeller: false
    },
    {
        name_en: "San Sebastian Cheesecake",
        name_ar: "سان سيباستيان تشيز كيك",
        category: "desserts",
        price: 5500,
        image: "https://images.unsplash.com/photo-1524351199679-46cddf530c04?q=80&w=600&auto=format&fit=crop",
        available: true,
        bestSeller: true
    },
    {
        name_en: "Croissant Supreme",
        name_ar: "كرواسون سوبريم",
        category: "food",
        price: 2800,
        image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=600&auto=format&fit=crop",
        available: true,
        bestSeller: false
    }
];

const appState = {
    products: [],
    categories: [],
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
});

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
        const TWO_HOURS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

        if (cachedStr && cacheTime && (Date.now() - parseInt(cacheTime) < TWO_HOURS)) {
            console.log("Loading menu from local cache (0 Firebase Reads)");
            const data = JSON.parse(cachedStr);
            appState.products = data.products || [];
            appState.categories = data.categories || [];
        } else {
            // 2. Cache expired or doesn't exist -> Fetch from Firebase (1 Read)
            console.log("Fetching fresh menu from Firebase (1 Read)");
            const docRef = doc(db, "published_menu", "live");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                appState.products = data.products || [];
                appState.categories = data.categories || [];
                
                // Save to phone's local storage for next time
                localStorage.setItem("milano_cached_menu", JSON.stringify(data));
                localStorage.setItem("milano_cache_time", Date.now().toString());
            } else {
                console.log("No published menu found. Using mock items.");
                appState.products = mockProducts;
            }
        }

        // If API returns successfully but with empty array, fallback to mock data
        if (appState.products.length === 0) {
            console.log("Empty menu. Using mock items.");
            appState.products = mockProducts;
        }
    } catch (error) {
        console.warn("Could not fetch from Firebase. Using mock menu items as fallback.", error);
        appState.products = mockProducts;
    } finally {
        // Build & Render Menu
        renderMenu();
        // Force scroll to top so user sees the hero section first
        window.scrollTo(0, 0);
        
        // Hide preloader with a smooth fade
        setTimeout(() => {
            preloader.classList.add("fade-out");
            // Trigger hero animation after preloader is gone
            setTimeout(() => {
                const heroContent = document.querySelector('.hero-content');
                if (heroContent) heroContent.classList.add('animate-hero');
            }, 300);
        }, 800);
    }
}

// Render Menu based on current state (language, search query)
function renderMenu() {
    const query = appState.searchQuery.toLowerCase().trim();
    
    // Filter available products and search query
    let filteredProducts = appState.products.filter(p => {
        // Must be available
        if (!p.available) return false;
        
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

    // Group products by category
    const categoriesMap = {};
    filteredProducts.forEach(p => {
        const cat = p.category || "other";
        if (!categoriesMap[cat]) {
            categoriesMap[cat] = [];
        }
        categoriesMap[cat].push(p);
    });

    // Generate menu sections and nav links in the correct ordered defined by Admin
    // First, map the categories defined in the database
    const orderedCategoryKeys = [];
    appState.categories.forEach(cat => {
        const keyOptions = [
            (cat.slug || '').toLowerCase().trim(),
            (cat.name_en || '').toLowerCase().trim(),
            (cat.name_ar || '').trim()
        ];
        
        // Find which key actually exists in our categoriesMap
        let foundKey = null;
        for (const k of keyOptions) {
            if (categoriesMap[k]) {
                foundKey = k;
                break;
            }
        }
        
        if (foundKey && !orderedCategoryKeys.includes(foundKey)) {
            orderedCategoryKeys.push(foundKey);
        }
    });

    // Add any remaining categories that were in the products but not in the defined categories
    Object.keys(categoriesMap).forEach(key => {
        if (!orderedCategoryKeys.includes(key)) {
            orderedCategoryKeys.push(key);
        }
    });

    orderedCategoryKeys.forEach((categoryName, index) => {
        const categoryId = categoryName.replace(/\s+/g, '-').toLowerCase();
        const displayCategoryName = formatCategoryName(categoryName);
        
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
                
                // Highlight clicked category
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

        categoriesMap[categoryName].forEach(p => {
            const cardCol = document.createElement("div");
            cardCol.className = "col";

            const isAr = appState.currentLang === 'ar';
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
            
            // Premium product image card template
            cardCol.innerHTML = `
                <div class="product-card">
                    <div class="product-image-container">
                        ${p.bestSeller ? `<span class="badge-bestseller">${translations[appState.currentLang].bestSeller}</span>` : ''}
                        <img src="${p.image}" alt="${p.name_en}" class="product-image" loading="lazy" 
                             onerror="this.src='https://images.unsplash.com/photo-1507133750040-4a8f57021571?q=80&w=300&auto=format&fit=crop'">
                    </div>
                    <div class="product-info">
                        <div class="product-title-en">${mainName}</div>
                        <div class="product-title-ar small text-muted">${subName}</div>
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
