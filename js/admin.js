// MILANO CAFE - Admin Dashboard Control Script
import { auth, db } from "./firebase.js";
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    getDocs, 
    getDoc,
    query, 
    orderBy, 
    serverTimestamp,
    setDoc
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
let cafeSettings = {};

if (productModalEl) {
    productModal = new bootstrap.Modal(productModalEl);
}

// ─────────────────────────────────────────
// Auth State
// ─────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginContainer.classList.add("d-none");
        dashboardContainer.classList.remove("d-none");
        adminUserEmail.textContent = user.email;
        loadSettings().then(() => loadCategories()).then(() => loadProductsFromFirestore());
    } else {
        loginContainer.classList.remove("d-none");
        dashboardContainer.classList.add("d-none");
        allProducts = [];
        allCategories = [];
        cafeSettings = {};
    }
});

function updateDashboardStats() {
    const totalProdEl = document.getElementById("stat-total-products");
    const totalCatEl = document.getElementById("stat-total-categories");
    const availEl = document.getElementById("stat-available-products");
    const unavailEl = document.getElementById("stat-unavailable-products");

    if (totalProdEl) totalProdEl.textContent = allProducts.length;
    if (totalCatEl) totalCatEl.textContent = allCategories.length;
    
    let availCount = 0;
    let unavailCount = 0;
    allProducts.forEach(p => {
        if (p.available) availCount++;
        else unavailCount++;
    });

    if (availEl) availEl.textContent = availCount;
    if (unavailEl) unavailEl.textContent = unavailCount;
}

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
// CATEGORIES — Load from Firestore
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
    updateDashboardStats();
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

// Reorder category up/down
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

// Load category into form for editing
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

// Delete category from Firestore
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
// PRODUCTS — Load from Firestore
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
                </td></tr>`;
            updateCategoryFiltersList();
            return;
        }
        filterAndRenderTable();
        updateCategoryFiltersList();
        renderCategoriesList(); // refresh product counts in categories tab
        updateDashboardStats();
    } catch (err) {
        console.error(err);
        productsTableBody.innerHTML = `
            <tr><td colspan="6" class="text-center text-danger py-4">
                <i class="fa-solid fa-triangle-exclamation fa-2x mb-2"></i>
                <p class="mb-0">فشل تحميل البيانات. تحقق من قواعد الأمان وبيانات الاعتماد.</p>
            </td></tr>`;
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
// WebP Compression & Cloudinary Upload
// ─────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME = "xxfyrvy0";
const CLOUDINARY_UPLOAD_PRESET = "milano_products";

async function uploadToCloudinary(blob) {
    const formData = new FormData();
    formData.append("file", blob, "image.webp");
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || "Cloudinary upload failed");
    }

    const data = await response.json();
    return data.secure_url;
}

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
// Save Product (Add / Edit)
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
                const saveBtn = document.getElementById("save-product-btn");
                const textNode = Array.from(saveBtn.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== "");
                const originalText = textNode ? textNode.textContent : "حفظ المنتج";
                if (textNode) textNode.textContent = " جارٍ رفع الصورة... ";
                
                try {
                    const webpBlob = await compressAndConvertToWebP(file);
                    imageUrl = await uploadToCloudinary(webpBlob);
                } catch (err) {
                    throw new Error("فشل رفع الصورة: " + err.message);
                } finally {
                    if (textNode) textNode.textContent = originalText;
                }
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
// Publish Menu — Clear Cloudflare KV Cache
// ─────────────────────────────────────────
if (publishMenuBtn) {
    publishMenuBtn.addEventListener("click", async () => {
        publishMenuBtn.setAttribute("disabled", "true");
        publishMenuBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> جارٍ النشر...`;
        try {
            // 1. Fetch all products from Firestore
            const productSnap = await getDocs(collection(db, "products"));
            const products = [];
            productSnap.forEach(d => products.push({ id: d.id, ...d.data() }));

            // 2. Fetch all categories from Firestore and sort them by order
            const catSnap = await getDocs(collection(db, "categories"));
            const categories = [];
            catSnap.forEach(d => categories.push({ id: d.id, ...d.data() }));
            
            categories.sort((a, b) => {
                const orderA = typeof a.order === 'number' ? a.order : 9999;
                const orderB = typeof b.order === 'number' ? b.order : 9999;
                return orderA - orderB;
            });

            // 3. Save combined payload to a Single Document in Firestore
            const payload = { 
                products, 
                categories, 
                settings: cafeSettings,
                updatedAt: serverTimestamp(),
                version: "2.0"
            };
            
            await setDoc(doc(db, "published_menu", "live"), payload);

            // Clear local cache for the admin so they can see changes immediately
            localStorage.removeItem("milano_cached_menu");
            localStorage.removeItem("milano_cache_time");

            alert(`✅ تم النشر بنجاح! تم حفظ ${products.length} منتج في قاعدة البيانات. القائمة العامة محدَّثة الآن!`);
            
        } catch (err) {
            alert("فشل النشر: " + err.message);
        } finally {
            publishMenuBtn.removeAttribute("disabled");
            publishMenuBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> <span>نشر القائمة (تحديث الموقع)</span>`;
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

// ─────────────────────────────────────────
// Settings - Cafe Info
// ─────────────────────────────────────────
async function loadSettings() {
    try {
        const snap = await getDoc(doc(db, "settings", "cafe"));
        if (snap.exists()) {
            cafeSettings = snap.data();
        }
    } catch (err) {
        console.error("Could not load settings:", err);
    }
}

// ─────────────────────────────────────────
// Settings - Change Password
// ─────────────────────────────────────────
const changePasswordForm = document.getElementById("change-password-form");
const passwordAlert = document.getElementById("password-alert");

if (changePasswordForm) {
    changePasswordForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById("current-password").value;
        const newPassword = document.getElementById("new-password").value;
        const confirmPassword = document.getElementById("confirm-password").value;
        const saveBtn = document.getElementById("save-password-btn");
        const spinner = document.getElementById("password-spinner");

        if (!currentPassword || !newPassword || !confirmPassword) return;

        if (newPassword.length < 8) {
            showPasswordAlert("يجب أن تكون كلمة المرور الجديدة مكونة من 8 أحرف على الأقل.", "danger");
            return;
        }

        if (newPassword !== confirmPassword) {
            showPasswordAlert("كلمتا المرور غير متطابقتين.", "danger");
            return;
        }

        const user = auth.currentUser;
        if (!user) return;

        saveBtn.setAttribute("disabled", "true");
        spinner.classList.remove("d-none");
        passwordAlert.classList.add("d-none");

        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);

            showPasswordAlert("تم تغيير كلمة المرور بنجاح.", "success");
            changePasswordForm.reset();
        } catch (err) {
            console.error("Password change error:", err);
            let msg = "حدث خطأ أثناء تغيير كلمة المرور.";
            if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
                msg = "كلمة المرور الحالية غير صحيحة.";
            } else if (err.code === "auth/network-request-failed") {
                msg = "تعذر الاتصال، حاول مرة أخرى.";
            }
            showPasswordAlert(msg, "danger");
        } finally {
            saveBtn.removeAttribute("disabled");
            spinner.classList.add("d-none");
        }
    });
}

function showPasswordAlert(msg, type) {
    passwordAlert.className = `alert alert-${type} small`;
    passwordAlert.textContent = msg;
    passwordAlert.classList.remove("d-none");
}

// ─────────────────────────────────────────
// Backup & Restore
// ─────────────────────────────────────────
const exportJsonBtn = document.getElementById("export-json-btn");
const exportXlsxBtn = document.getElementById("export-xlsx-btn");
const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");

if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", () => {
        const date = new Date().toISOString().split('T')[0];
        const data = {
            metadata: { exportDate: date, version: "2.0", format: "json" },
            settings: cafeSettings,
            categories: allCategories,
            products: allProducts
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `milano-backup-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

if (exportXlsxBtn) {
    exportXlsxBtn.addEventListener("click", () => {
        if (typeof XLSX === "undefined") {
            alert("مكتبة Excel غير محملة.");
            return;
        }
        const date = new Date().toISOString().split('T')[0];
        const wb = XLSX.utils.book_new();
        
        // Products
        const prodData = allProducts.map(p => {
            const row = { ...p };
            delete row.createdAt;
            return row;
        });
        const wsProd = XLSX.utils.json_to_sheet(prodData);
        XLSX.utils.book_append_sheet(wb, wsProd, "Products");

        // Categories
        const catData = allCategories.map(c => {
            const row = { ...c };
            delete row.createdAt;
            return row;
        });
        const wsCat = XLSX.utils.json_to_sheet(catData);
        XLSX.utils.book_append_sheet(wb, wsCat, "Categories");

        // Settings (flatten phones array to string)
        const settingsRow = { ...cafeSettings, phones: (cafeSettings.phones || []).join(",") };
        const wsSet = XLSX.utils.json_to_sheet([settingsRow]);
        XLSX.utils.book_append_sheet(wb, wsSet, "Settings");

        XLSX.writeFile(wb, `milano-backup-${date}.xlsx`);
    });
}

if (importBtn) {
    importBtn.addEventListener("click", async () => {
        const file = importFile?.files[0];
        if (!file) {
            alert("الرجاء اختيار ملف أولاً.");
            return;
        }
        if (!confirm("هل أنت متأكد؟ سيتم استبدال جميع المنتجات والأقسام والإعدادات الحالية بهذه النسخة.")) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                let data;
                if (file.name.endsWith(".json")) {
                    data = JSON.parse(e.target.result);
                } else if (file.name.endsWith(".xlsx")) {
                    const dataUint8 = new Uint8Array(e.target.result);
                    const wb = XLSX.read(dataUint8, { type: 'array' });
                    
                    const prodSheet = wb.Sheets["Products"];
                    const catSheet = wb.Sheets["Categories"];
                    const setSheet = wb.Sheets["Settings"];
                    
                    if (!prodSheet || !catSheet || !setSheet) throw new Error("ملف Excel غير صالح. يجب أن يحتوي على أوراق Products, Categories, Settings");
                    
                    const products = XLSX.utils.sheet_to_json(prodSheet);
                    const categories = XLSX.utils.sheet_to_json(catSheet);
                    const settingsArr = XLSX.utils.sheet_to_json(setSheet);
                    
                    const settingsObj = settingsArr[0] || {};
                    if (settingsObj.phones && typeof settingsObj.phones === 'string') {
                        settingsObj.phones = settingsObj.phones.split(',').map(s => s.trim()).filter(Boolean);
                    }
                    
                    data = { products, categories, settings: settingsObj };
                } else {
                    throw new Error("نوع الملف غير مدعوم.");
                }

                if (!data.products || !data.categories || !data.settings) {
                    throw new Error("هيكل الملف غير صالح.");
                }

                importBtn.setAttribute("disabled", "true");
                importBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ الاستعادة...';

                // Restore Settings
                await setDoc(doc(db, "settings", "cafe"), data.settings);
                cafeSettings = data.settings;

                // Restore Categories
                const existingCats = await getDocs(collection(db, "categories"));
                for (const d of existingCats.docs) {
                    await deleteDoc(doc(db, "categories", d.id));
                }
                for (const cat of data.categories) {
                    const id = cat.id;
                    const catData = { ...cat, createdAt: serverTimestamp() };
                    delete catData.id;
                    if (id) await setDoc(doc(db, "categories", id), catData);
                    else await addDoc(collection(db, "categories"), catData);
                }

                // Restore Products
                const existingProds = await getDocs(collection(db, "products"));
                for (const d of existingProds.docs) {
                    await deleteDoc(doc(db, "products", d.id));
                }
                for (const prod of data.products) {
                    const id = prod.id;
                    const prodData = { ...prod, createdAt: serverTimestamp() };
                    delete prodData.id;
                    if (id) await setDoc(doc(db, "products", id), prodData);
                    else await addDoc(collection(db, "products"), prodData);
                }

                alert("✅ تم استعادة النسخة الاحتياطية بنجاح! سيتم إعادة تحميل الصفحة.");
                window.location.reload();

            } catch (err) {
                console.error(err);
                alert("خطأ في الاستيراد: " + err.message);
                importBtn.removeAttribute("disabled");
                importBtn.innerHTML = '<i class="fa-solid fa-upload"></i> استيراد (يستبدل الحالية)';
            }
        };

        if (file.name.endsWith(".xlsx")) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    });
}
