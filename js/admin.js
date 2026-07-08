// MILANO CAFE - Admin Dashboard Control Script
import { auth, db } from "./firebase.js";
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    getDocs, 
    query, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ─────────────────────────────────────────
// DOM References
// ─────────────────────────────────────────
const loginContainer      = document.getElementById("login-container");
const dashboardContainer  = document.getElementById("dashboard-container");
const loginForm           = document.getElementById("login-form");
const loginEmail          = document.getElementById("login-email");
const loginPassword       = document.getElementById("login-password");
const loginSpinner        = document.getElementById("login-spinner");
const loginError          = document.getElementById("login-error");
const logoutBtn           = document.getElementById("logout-btn");
const adminUserEmail      = document.getElementById("admin-user-email");
const publishMenuBtn      = document.getElementById("publish-menu-btn");
const productsTableBody   = document.getElementById("products-table-body");
const productForm         = document.getElementById("product-form");
const productModalEl      = document.getElementById("productModal");
const productImageFile    = document.getElementById("product-image-file");
const imagePreview        = document.getElementById("image-preview");
const adminSearch         = document.getElementById("admin-search");
const saveSpinner         = document.getElementById("save-spinner");
const categoryForm        = document.getElementById("category-form");
const categoriesList      = document.getElementById("categories-list");
const productCategorySelect = document.getElementById("product-category");

// ─────────────────────────────────────────
// State
// ─────────────────────────────────────────
let productModal;
let allProducts = [];
let allCategories = []; // { id, name_ar, name_en, slug }
let filteredProducts = [];
let currentFilterCategory = "all";

if (productModalEl) {
    productModal = new bootstrap.Modal(productModalEl);
}

// ─────────────────────────────────────────
// 🔐 Auth State
// ─────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginContainer.classList.add("d-none");
        dashboardContainer.classList.remove("d-none");
        adminUserEmail.textContent = user.email;
        loadCategories().then(() => loadProductsFromFirestore());
    } else {
        loginContainer.classList.remove("d-none");
        dashboardContainer.classList.add("d-none");
        allProducts = [];
        allCategories = [];
    }
});

// Login
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        loginError.classList.add("d-none");
        loginSpinner.classList.remove("d-none");
        try {
            await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
        } catch (err) {
            loginError.textContent = "فشل تسجيل الدخول: " + getReadableAuthError(err.code);
            loginError.classList.remove("d-none");
        } finally {
            loginSpinner.classList.add("d-none");
        }
    });
}

// Logout
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => signOut(auth));
}

// ─────────────────────────────────────────
// 📂 CATEGORIES — Load from Firestore
// ─────────────────────────────────────────
async function loadCategories() {
    try {
        const snap = await getDocs(collection(db, "categories"));
        allCategories = [];
        snap.forEach(d => allCategories.push({ id: d.id, ...d.data() }));
        
        // Sort by order field, fallback to createdAt
        allCategories.sort((a, b) => {
            const orderA = typeof a.order === 'number' ? a.order : 9999;
            const orderB = typeof b.order === 'number' ? b.order : 9999;
            if (orderA !== orderB) return orderA - orderB;
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeA - timeB;
        });

        // Initialize missing order values
        allCategories.forEach((cat, idx) => {
            if (typeof cat.order !== 'number') cat.order = idx;
        });
    } catch (err) {
        console.warn("Could not load categories:", err.message);
        allCategories = [];
    }
    renderCategoriesList();
    populateCategorySelect();
    updateCategoryFiltersList();
}

// Render the categories pills in the Categories tab
function renderCategoriesList() {
    if (!categoriesList) return;

    if (allCategories.length === 0) {
        categoriesList.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="fa-solid fa-tags fa-2x mb-2 d-block"></i>
                لا توجد أقسام بعد. أضف قسماً جديداً من النموذج.
            </div>`;
        return;
    }

    categoriesList.innerHTML = `
        <!-- Category pills removed based on feedback -->
        <div class="mt-4 table-responsive">
            <table class="table table-sm table-hover text-nowrap">
                <thead class="table-light">
                    <tr>
                        <th>الترتيب</th>
                        <th>الاسم بالعربية</th>
                        <th>الاسم بالإنجليزية</th>
                        <th>Slug</th>
                        <th>المنتجات</th>
                        <th class="text-start">الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    ${allCategories.map((cat, i) => {
                        const productCount = allProducts.filter(p => p.category === cat.slug).length;
                        return `
                        <tr>
                            <td class="text-nowrap">
                                <button class="btn btn-sm btn-light p-1 border-0" onclick="moveCategoryUp(${i})" ${i === 0 ? 'disabled' : ''} title="أعلى">
                                    <i class="fa-solid fa-chevron-up text-muted"></i>
                                </button>
                                <button class="btn btn-sm btn-light p-1 border-0 ms-1" onclick="moveCategoryDown(${i})" ${i === allCategories.length - 1 ? 'disabled' : ''} title="أسفل">
                                    <i class="fa-solid fa-chevron-down text-muted"></i>
                                </button>
                            </td>
                            <td class="fw-semibold">${cat.name_ar}</td>
                            <td>${cat.name_en}</td>
                            <td><code>${cat.slug}</code></td>
                            <td><span class="badge bg-secondary">${productCount}</span></td>
                            <td class="text-start">
                                <button class="btn btn-sm btn-outline-dark me-1" onclick="editCategory('${cat.id}')">
                                    <i class="fa-solid fa-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${cat.id}', '${cat.name_ar}')">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Populate the product form category <select> with Firestore categories
function populateCategorySelect() {
    if (!productCategorySelect) return;
    const currentVal = productCategorySelect.value;
    productCategorySelect.innerHTML = `<option value="">-- اختر القسم --</option>`;
    allCategories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.slug;
        opt.textContent = `${cat.name_ar} (${cat.name_en})`;
        productCategorySelect.appendChild(opt);
    });
    // Restore selection if editing
    if (currentVal) productCategorySelect.value = currentVal;
}

// Toggle pizza size price fields based on selected category
window.togglePizzaPriceFields = function(isPizza) {
    const priceWrapper = document.getElementById('price-field-wrapper');
    const pizzaWrapper = document.getElementById('pizza-prices-wrapper');
    const priceInput   = document.getElementById('product-price');
    if (!priceWrapper || !pizzaWrapper) return;
    if (isPizza) {
        priceWrapper.classList.add('d-none');
        pizzaWrapper.classList.remove('d-none');
        priceInput.removeAttribute('required');
    } else {
        priceWrapper.classList.remove('d-none');
        pizzaWrapper.classList.add('d-none');
        priceInput.setAttribute('required', 'true');
    }
}

// Listen for category change to toggle pizza fields
if (productCategorySelect) {
    productCategorySelect.addEventListener('change', () => {
        togglePizzaPriceFields(productCategorySelect.value === 'pizza');
    });
}

// ➕ Add / ✏ Edit Category form submit
if (categoryForm) {
    categoryForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const catSpinner  = document.getElementById("cat-spinner");
        const saveCatBtn  = document.getElementById("save-category-btn");
        catSpinner.classList.remove("d-none");
        saveCatBtn.setAttribute("disabled", "true");

        const editId   = document.getElementById("category-edit-id").value;
        const nameAr   = document.getElementById("cat-name-ar").value.trim();
        const nameEn   = document.getElementById("cat-name-en").value.trim();
        const slug     = document.getElementById("cat-slug").value.trim().toLowerCase().replace(/\s+/g, '-');

        // Validate slug
        if (!/^[a-z0-9-]+$/.test(slug)) {
            alert("الـ Slug يجب أن يحتوي على حروف إنجليزية صغيرة وأرقام وشُرَط فقط.");
            catSpinner.classList.add("d-none");
            saveCatBtn.removeAttribute("disabled");
            return;
        }

        try {
            if (editId) {
                await updateDoc(doc(db, "categories", editId), { name_ar: nameAr, name_en: nameEn, slug });
            } else {
                // Check for duplicate slug
                const exists = allCategories.find(c => c.slug === slug);
                if (exists) {
                    alert(`القسم "${exists.name_ar}" يستخدم هذا الـ Slug بالفعل.`);
                    catSpinner.classList.add("d-none");
                    saveCatBtn.removeAttribute("disabled");
                    return;
                }
                await addDoc(collection(db, "categories"), { name_ar: nameAr, name_en: nameEn, slug, order: allCategories.length, createdAt: serverTimestamp() });
            }
            resetCategoryForm();
            await loadCategories();
        } catch (err) {
            alert("حدث خطأ: " + err.message);
        } finally {
            catSpinner.classList.add("d-none");
            saveCatBtn.removeAttribute("disabled");
        }
    });
}

// 🔄 Reorder category up/down
window.moveCategoryUp = async function(index) {
    if (index <= 0) return;
    await swapCategoryOrder(index, index - 1);
};

window.moveCategoryDown = async function(index) {
    if (index >= allCategories.length - 1) return;
    await swapCategoryOrder(index, index + 1);
};

async function swapCategoryOrder(idx1, idx2) {
    const cat1 = allCategories[idx1];
    const cat2 = allCategories[idx2];
    
    // Swap order values
    const temp = cat1.order;
    cat1.order = cat2.order;
    cat2.order = temp;
    
    // Optimistic update UI
    const tempCat = allCategories[idx1];
    allCategories[idx1] = allCategories[idx2];
    allCategories[idx2] = tempCat;
    renderCategoriesList();
    
    try {
        await updateDoc(doc(db, "categories", cat1.id), { order: cat1.order });
        await updateDoc(doc(db, "categories", cat2.id), { order: cat2.order });
        // Refresh product display if they depend on category order
        populateCategorySelect();
        updateCategoryFiltersList();
    } catch (err) {
        console.error(err);
        alert("فشل حفظ الترتيب: " + err.message);
        await loadCategories(); // rollback
    }
}

// ✏ Load category into form for editing
window.editCategory = function(id) {
    const cat = allCategories.find(c => c.id === id);
    if (!cat) return;
    document.getElementById("category-edit-id").value = cat.id;
    document.getElementById("cat-name-ar").value = cat.name_ar;
    document.getElementById("cat-name-en").value = cat.name_en;
    document.getElementById("cat-slug").value = cat.slug;
    document.getElementById("cat-btn-label").textContent = "تحديث القسم";
    document.getElementById("cancel-edit-cat-btn").style.display = "";
    // Switch to categories tab
    document.getElementById("categories-tab").click();
    document.getElementById("cat-name-ar").focus();
};

// Reset category form
window.resetCategoryForm = function() {
    categoryForm.reset();
    document.getElementById("category-edit-id").value = "";
    document.getElementById("cat-btn-label").textContent = "حفظ القسم";
    document.getElementById("cancel-edit-cat-btn").style.display = "none";
};

// ❌ Delete category from Firestore
window.deleteCategory = async function(id, name) {
    const productCount = allProducts.filter(p => p.category === allCategories.find(c => c.id === id)?.slug).length;
    let msg = `هل أنت متأكد من حذف قسم "${name}"؟`;
    if (productCount > 0) {
        msg += `\n\nتحذير: يوجد ${productCount} منتج في هذا القسم. لن تُحذف المنتجات ولكن ستفقد قسمها.`;
    }
    if (!confirm(msg)) return;
    try {
        await deleteDoc(doc(db, "categories", id));
        await loadCategories();
    } catch (err) {
        alert("فشل الحذف: " + err.message);
    }
};

// ─────────────────────────────────────────
// 🛍 PRODUCTS — Load from Firestore
// ─────────────────────────────────────────
async function loadProductsFromFirestore() {
    productsTableBody.innerHTML = `
        <tr><td colspan="6" class="text-center py-4">
            <div class="spinner-border text-warning" role="status"></div>
            <p class="mt-2 text-muted mb-0">جارٍ تحميل المنتجات من Firestore...</p>
        </td></tr>`;
    
    try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        allProducts = [];
        snap.forEach(d => allProducts.push({ id: d.id, ...d.data() }));

        if (allProducts.length === 0) {
            productsTableBody.innerHTML = `
                <tr><td colspan="6" class="text-center py-5">
                    <i class="fa-solid fa-folder-open fa-3x mb-3 text-muted"></i>
                    <p class="fs-5 text-muted">قاعدة بيانات القائمة فارغة.</p>
                    <button class="btn btn-premium mt-2" id="seed-database-btn">إضافة منتجات تجريبية</button>
                </td></tr>`;
            document.getElementById("seed-database-btn")?.addEventListener("click", seedFirestore);
            updateCategoryFiltersList();
            return;
        }
        filterAndRenderTable();
        updateCategoryFiltersList();
        renderCategoriesList(); // refresh product counts in categories tab
    } catch (err) {
        console.error(err);
        productsTableBody.innerHTML = `
            <tr><td colspan="6" class="text-center text-danger py-4">
                <i class="fa-solid fa-triangle-exclamation fa-2x mb-2"></i>
                <p class="mb-0">فشل تحميل البيانات. تحقق من قواعد الأمان وبيانات الاعتماد.</p>
            </td></tr>`;
    }
}

// Seed mock products into Firestore for first-time demo
async function seedFirestore() {
    const mockProducts = [
        { name_en: "Espresso", name_ar: "اسبريسو", category: "coffee", price: 2500, image: "https://images.unsplash.com/photo-151097252790b-af4f42df8e40?q=80&w=600&auto=format&fit=crop", available: true, bestSeller: true, createdAt: serverTimestamp() },
        { name_en: "Spanish Latte", name_ar: "سبانش لاتيه", category: "coffee", price: 3800, image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=600&auto=format&fit=crop", available: true, bestSeller: true, createdAt: serverTimestamp() },
        { name_en: "Cappuccino", name_ar: "كابتشينو", category: "coffee", price: 3200, image: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?q=80&w=600&auto=format&fit=crop", available: true, bestSeller: false, createdAt: serverTimestamp() },
        { name_en: "Turkish Coffee", name_ar: "قهوة تركية", category: "hot-drinks", price: 2000, image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=600&auto=format&fit=crop", available: true, bestSeller: false, createdAt: serverTimestamp() },
        { name_en: "Iced Caramel Macchiato", name_ar: "كراميل ماكياتو بارد", category: "cold-drinks", price: 4200, image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?q=80&w=600&auto=format&fit=crop", available: true, bestSeller: true, createdAt: serverTimestamp() },
        { name_en: "San Sebastian Cheesecake", name_ar: "سان سيباستيان تشيز كيك", category: "desserts", price: 5500, image: "https://images.unsplash.com/photo-1524351199679-46cddf530c04?q=80&w=600&auto=format&fit=crop", available: true, bestSeller: true, createdAt: serverTimestamp() }
    ];

    // Also seed default categories if empty
    const mockCategories = [
        { name_ar: "قهوة", name_en: "Coffee", slug: "coffee", createdAt: serverTimestamp() },
        { name_ar: "مشروبات ساخنة", name_en: "Hot Drinks", slug: "hot-drinks", createdAt: serverTimestamp() },
        { name_ar: "مشروبات باردة", name_en: "Cold Drinks", slug: "cold-drinks", createdAt: serverTimestamp() },
        { name_ar: "مشروبات طازجة", name_en: "Fresh Drinks", slug: "fresh-drinks", createdAt: serverTimestamp() },
        { name_ar: "حلويات", name_en: "Desserts", slug: "desserts", createdAt: serverTimestamp() },
        { name_ar: "مأكولات", name_en: "Food", slug: "food", createdAt: serverTimestamp() }
    ];

    if (!confirm("هل أنت متأكد من إضافة المنتجات والأقسام التجريبية؟")) return;

    try {
        productsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-warning"></div> جارٍ الإضافة...</td></tr>`;
        if (allCategories.length === 0) {
            for (const cat of mockCategories) {
                await addDoc(collection(db, "categories"), cat);
            }
        }
        for (const item of mockProducts) {
            await addDoc(collection(db, "products"), item);
        }
        alert("تمت إضافة المنتجات والأقسام بنجاح! اضغط 'نشر القائمة' لتحديث الكاش والنشر.");
        await loadCategories();
        await loadProductsFromFirestore();
    } catch (err) {
        alert("فشلت العملية: " + err.message);
        loadProductsFromFirestore();
    }
}

// ─────────────────────────────────────────
// Category sidebar filters
// ─────────────────────────────────────────
function updateCategoryFiltersList() {
    const listGroup = document.getElementById("admin-category-filters");
    if (!listGroup) return;

    const counts = { all: allProducts.length };
    allProducts.forEach(p => {
        const cat = p.category || "other";
        counts[cat] = (counts[cat] || 0) + 1;
    });

    let html = `<button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center ${currentFilterCategory === 'all' ? 'active bg-accent border-accent text-dark fw-bold' : ''}" onclick="filterByCategory('all')">
        جميع المنتجات <span class="badge bg-secondary rounded-pill">${counts.all}</span>
    </button>`;

    allCategories.forEach(cat => {
        const count = counts[cat.slug] || 0;
        html += `<button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center ${currentFilterCategory === cat.slug ? 'active bg-accent border-accent text-dark fw-bold' : ''}" onclick="filterByCategory('${cat.slug}')">
            ${cat.name_ar} <span class="badge bg-secondary rounded-pill">${count}</span>
        </button>`;
    });

    listGroup.innerHTML = html;
}

window.filterByCategory = function(category) {
    currentFilterCategory = category;
    updateCategoryFiltersList();
    filterAndRenderTable();
};

window.filterAdminProducts = function(val) {
    filterAndRenderTable(val);
};

// ─────────────────────────────────────────
// Render Products Table
// ─────────────────────────────────────────
function filterAndRenderTable(searchVal = "") {
    const queryStr = (searchVal || (adminSearch?.value || '')).toLowerCase().trim();

    filteredProducts = allProducts.filter(p => {
        if (currentFilterCategory !== "all" && p.category !== currentFilterCategory) return false;
        if (queryStr) {
            const nameEn = (p.name_en || '').toLowerCase();
            const nameAr = (p.name_ar || '').toLowerCase();
            return nameEn.includes(queryStr) || nameAr.includes(queryStr);
        }
        return true;
    });

    if (filteredProducts.length === 0) {
        productsTableBody.innerHTML = `
            <tr><td colspan="6" class="text-center py-4 text-muted">لا توجد نتائج مطابقة.</td></tr>`;
        return;
    }

    // Get category label helper
    const getCatLabel = (slug) => {
        const cat = allCategories.find(c => c.slug === slug);
        return cat ? cat.name_ar : slug;
    };

    productsTableBody.innerHTML = filteredProducts.map(p => `
        <tr>
            <td>
                <img src="${p.image}" alt="${p.name_ar}" onerror="this.src='https://images.unsplash.com/photo-1507133750040-4a8f57021571?q=80&w=100&auto=format&fit=crop'">
            </td>
            <td>
                <div class="fw-semibold text-dark">${p.name_ar}</div>
                <div class="small text-muted" dir="ltr">${p.name_en}</div>
            </td>
            <td>
                <span class="badge bg-dark">${getCatLabel(p.category)}</span>
            </td>
            <td class="fw-bold text-accent" dir="ltr">
                ${p.category === 'pizza' && (p.price_small || p.price_large)
                    ? `<span class="d-block">صغيرة: ${Number(p.price_small||0).toLocaleString('en-US')} SDG</span>
                       <span class="d-block">كبيرة: ${Number(p.price_large||0).toLocaleString('en-US')} SDG</span>`
                    : `${Number(p.price||0).toLocaleString('en-US')} SDG`
                }
            </td>
            <td>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch" ${p.available ? 'checked' : ''} onchange="toggleAvailability('${p.id}', this.checked)">
                    <span class="small text-muted">${p.available ? 'ظاهر' : 'مخفي'}</span>
                </div>
            </td>
            <td class="text-start">
                <button class="btn btn-sm btn-outline-dark me-1" onclick="openEditProductModal('${p.id}')">
                    <i class="fa-solid fa-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct('${p.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ─────────────────────────────────────────
// Product Modal — Open Add
// ─────────────────────────────────────────
window.openAddProductModal = function() {
    document.getElementById("productModalLabel").textContent = "إضافة منتج جديد";
    productForm.reset();
    document.getElementById("product-id").value = "";
    document.getElementById("product-image-url").value = "";
    document.getElementById("product-price-small").value = "";
    document.getElementById("product-price-large").value = "";
    imagePreview.src = "";
    imagePreview.classList.add("d-none");
    togglePizzaPriceFields(false);
    populateCategorySelect();
    productModal.show();
};

// Product Modal — Open Edit
window.openEditProductModal = function(id) {
    const p = allProducts.find(prod => prod.id === id);
    if (!p) return;

    document.getElementById("productModalLabel").textContent = "تعديل المنتج";
    document.getElementById("product-id").value = p.id;
    document.getElementById("product-name-ar").value = p.name_ar;
    document.getElementById("product-name-en").value = p.name_en;
    document.getElementById("product-price").value = p.price || "";
    document.getElementById("product-price-small").value = p.price_small || "";
    document.getElementById("product-price-large").value = p.price_large || "";
    document.getElementById("product-image-url").value = p.image;
    document.getElementById("product-available").checked = p.available;
    document.getElementById("product-bestseller").checked = !!p.bestSeller;

    populateCategorySelect();
    document.getElementById("product-category").value = p.category;
    togglePizzaPriceFields(p.category === 'pizza');

    if (p.image) {
        imagePreview.src = p.image;
        imagePreview.classList.remove("d-none");
    } else {
        imagePreview.src = "";
        imagePreview.classList.add("d-none");
    }
    productModal.show();
};

// ─────────────────────────────────────────
// 📸 WebP Compression (client-side, saves to Firestore as Base64)
// ─────────────────────────────────────────
function compressAndConvertToWebP(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const maxDimension = 800;
                let width = img.width;
                let height = img.height;
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) { height = Math.round((height * maxDimension) / width); width = maxDimension; }
                    else { width = Math.round((width * maxDimension) / height); height = maxDimension; }
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    blob ? resolve(blob) : reject(new Error("WebP conversion failed."));
                }, 'image/webp', 0.82);
            };
            img.onerror = () => reject(new Error("Invalid image file."));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("File read error."));
        reader.readAsDataURL(file);
    });
}

// Image preview on file select
if (productImageFile) {
    productImageFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            imagePreview.src = URL.createObjectURL(file);
            imagePreview.classList.remove("d-none");
        }
    });
}

// ─────────────────────────────────────────
// 💾 Save Product (Add / Edit)
// ─────────────────────────────────────────
if (productForm) {
    productForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        saveSpinner.classList.remove("d-none");
        document.getElementById("save-product-btn").setAttribute("disabled", "true");

        const id        = document.getElementById("product-id").value;
        const nameAr    = document.getElementById("product-name-ar").value.trim();
        const nameEn    = document.getElementById("product-name-en").value.trim();
        const price     = Number(document.getElementById("product-price").value);
        const category  = document.getElementById("product-category").value;
        const available = document.getElementById("product-available").checked;
        const bestSeller= document.getElementById("product-bestseller").checked;
        let imageUrl    = document.getElementById("product-image-url").value;

        if (!category) {
            alert("يرجى اختيار القسم أولاً.");
            saveSpinner.classList.add("d-none");
            document.getElementById("save-product-btn").removeAttribute("disabled");
            return;
        }

        try {
            const file = productImageFile.files[0];
            if (file) {
                const webpBlob = await compressAndConvertToWebP(file);
                imageUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(webpBlob);
                });
            }

            const productData = {
                name_ar: nameAr,
                name_en: nameEn,
                category,
                image: imageUrl || "https://images.unsplash.com/photo-1507133750040-4a8f57021571?q=80&w=300&auto=format&fit=crop",
                available,
                bestSeller,
            };

            // Save pizza dual prices or regular price
            if (category === 'pizza') {
                productData.price_small = Number(document.getElementById('product-price-small').value) || 0;
                productData.price_large = Number(document.getElementById('product-price-large').value) || 0;
                productData.price = productData.price_small; // fallback for legacy display
            } else {
                productData.price = Number(document.getElementById('product-price').value);
                productData.price_small = null;
                productData.price_large = null;
            }

            if (id) {
                await updateDoc(doc(db, "products", id), productData);
            } else {
                productData.createdAt = serverTimestamp();
                await addDoc(collection(db, "products"), productData);
            }

            productModal.hide();
            await loadProductsFromFirestore();
            alert("تم حفظ المنتج بنجاح في Firestore! اضغط 'نشر القائمة' لتحديث القائمة العامة.");
        } catch (err) {
            console.error(err);
            alert("حدث خطأ أثناء الحفظ: " + err.message);
        } finally {
            saveSpinner.classList.add("d-none");
            document.getElementById("save-product-btn").removeAttribute("disabled");
        }
    });
}

// Toggle product availability
window.toggleAvailability = async function(id, isAvailable) {
    try {
        await updateDoc(doc(db, "products", id), { available: isAvailable });
        const idx = allProducts.findIndex(p => p.id === id);
        if (idx > -1) allProducts[idx].available = isAvailable;
        filterAndRenderTable();
    } catch (err) {
        alert("فشل تحديث الحالة: " + err.message);
    }
};

// Delete product
window.deleteProduct = async function(id) {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء!")) return;
    try {
        await deleteDoc(doc(db, "products", id));
        loadProductsFromFirestore();
    } catch (err) {
        alert("حدث خطأ أثناء الحذف: " + err.message);
    }
};

// ─────────────────────────────────────────
// ⚡ Publish Menu — Clear Cloudflare KV Cache
// ─────────────────────────────────────────
if (publishMenuBtn) {
    publishMenuBtn.addEventListener("click", async () => {
        publishMenuBtn.setAttribute("disabled", "true");
        publishMenuBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> جارٍ النشر...`;
        try {
            const response = await fetch('/api/menu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                alert("تم بنجاح! تم مسح كاش Cloudflare KV وإعادة بنائه. القائمة العامة محدَّثة!");
            } else {
                const text = await response.text();
                alert("تم مسح الكاش، لكن Worker أعاد: " + text + ". سيتم إعادة البناء عند أول زيارة.");
            }
        } catch (err) {
            alert("تم محاكاة النشر. عند النشر على Cloudflare، سيتم استدعاء Worker API تلقائياً.");
        } finally {
            publishMenuBtn.removeAttribute("disabled");
            publishMenuBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> <span>نشر القائمة (مسح الكاش)</span>`;
        }
    });
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function getReadableAuthError(code) {
    switch (code) {
        case "auth/invalid-email":      return "صيغة البريد الإلكتروني غير صحيحة.";
        case "auth/user-not-found":     return "المستخدم غير موجود.";
        case "auth/wrong-password":     return "كلمة المرور غير صحيحة.";
        case "auth/invalid-credential": return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
        default: return code;
    }
}
