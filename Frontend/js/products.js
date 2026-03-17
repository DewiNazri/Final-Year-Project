console.log("shop.js loaded");

// ===============================
// Supabase Init
// ===============================
if (!window._supabase) {
  window._supabase = window.supabase.createClient(
    "https://zvbothmzwenoenpmgcnv.supabase.co",
    "sb_publishable_ANaaTi-B_y9JbUGrTxTrwg_jkWSQlIC"
  );
}
const sb2 = window._supabase;

// ===============================
// DOM Elements
// ===============================
const productGrid = document.getElementById("productGrid");
const priceRange = document.getElementById("priceRange");
const priceValue = document.getElementById("priceValue");

let productModal = null;

// ===============================
// Pagination State
// ===============================
let allProducts = [];
let currentPage = 1;
const PRODUCTS_PER_PAGE = 9;

// ===============================
// Filter State
// ===============================
let selectedCategory = null;
let selectedBrand = null;
let maxPrice = 500;
let searchKeyword = "";
let sortOption = "";

// ===============================
// Favourite State (NEW)
// ===============================
let favouriteSet = new Set();

// ===============================
// Modal Init
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const modalEl = document.getElementById("productDetailModal");
  if (modalEl) {
    productModal = new bootstrap.Modal(modalEl);
  }
});

// ===============================
// LOAD USER FAVOURITES (NEW)
// ===============================
async function loadUserFavourites() {
  const { data: { session } } = await sb2.auth.getSession();
  if (!session) return;

  const { data, error } = await sb2
    .from("favourites")
    .select("product_id")
    .eq("user_id", session.user.id);

  if (error) return console.error(error);

  favouriteSet = new Set(data.map(f => f.product_id));
}

// ===============================
// Fetch Products
// ===============================
async function fetchProducts() {
  let query = sb2
    .from("products")
    .select(`*, brand:brand_id ( brand_name )`)
    .lte("price", maxPrice);

  if (selectedCategory) query = query.eq("product_type", selectedCategory);
  if (selectedBrand) query = query.eq("brand_id", selectedBrand);
  if (searchKeyword) query = query.ilike("product_name", `%${searchKeyword}%`);

  switch (sortOption) {
    case "rating_desc":
      query = query.order("rating", { ascending: false });
      break;
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) return console.error(error);

  allProducts = data;
  currentPage = 1;
  renderPage();
  renderPagination();
}

// ===============================
// Render Page
// ===============================
function renderPage() {
  productGrid.innerHTML = "";
  const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const pageItems = allProducts.slice(start, start + PRODUCTS_PER_PAGE);
  pageItems.forEach(renderProductCard);
}

// ===============================
// Pagination
// ===============================
function renderPagination() {
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";

  const totalPages = Math.ceil(allProducts.length / PRODUCTS_PER_PAGE);
  const MAX_VISIBLE = 5;

  // « Prev
  const prev = document.createElement("a");
  prev.href = "#";
  prev.className = "rounded";
  prev.innerHTML = "&laquo;";
  prev.onclick = e => {
    e.preventDefault();
    if (currentPage > 1) {
      currentPage--;
      renderPage();
      renderPagination();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  pagination.appendChild(prev);

  // Calculate window
  let startPage = Math.max(
    1,
    currentPage - Math.floor(MAX_VISIBLE / 2)
  );
  let endPage = startPage + MAX_VISIBLE - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - MAX_VISIBLE + 1);
  }

  // Page numbers
  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement("a");
    btn.href = "#";
    btn.className = `rounded ${i === currentPage ? "active" : ""}`;
    btn.textContent = i;

    btn.onclick = e => {
      e.preventDefault();
      currentPage = i;
      renderPage();
      renderPagination();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    pagination.appendChild(btn);
  }

  // » Next
  const next = document.createElement("a");
  next.href = "#";
  next.className = "rounded";
  next.innerHTML = "&raquo;";
  next.onclick = e => {
    e.preventDefault();
    if (currentPage < totalPages) {
      currentPage++;
      renderPage();
      renderPagination();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  pagination.appendChild(next);
}


// ===============================
// Render Stars
// ===============================
function renderStars(rating) {
  let stars = "";
  const rounded = Math.round(rating || 0);
  for (let i = 1; i <= 5; i++) {
    stars += `<i class="fas fa-star ${
      i <= rounded ? "text-primary" : "text-muted"
    }"></i>`;
  }
  return stars;
}

// ===============================
// Render Product Card (MERGED)
// ===============================
function renderProductCard(product) {
  const isFav = favouriteSet.has(product.product_id);

  const col = document.createElement("div");
  col.className = "col-lg-4 col-md-6";

  col.innerHTML = `
    <div class="product-item rounded wow fadeInUp h-100">
      <div class="product-item-inner border rounded h-100 d-flex flex-column">

        <div class="product-item-inner-item">
          <img src="${product.image_url}" class="img-fluid w-100 rounded-top" />

          <div class="product-details">
            <a href="#" class="btn-view" data-id="${product.product_id}">
              <i class="fa fa-eye fa-1x"></i>
            </a>
          </div>
        </div>

        <div class="text-center rounded-bottom p-4 flex-grow-1">
          <span class="text-muted">${product.product_type}</span>
          <h6 class="mt-2">${product.product_name}</h6>
          <span class="text-primary fs-5">
            RM${Number(product.price).toFixed(2)}
          </span>
        </div>

        <div class="product-item-add border-top text-center p-4">
          <button
            class="btn btn-fav border-secondary rounded-pill py-2 px-4 mb-3"
            data-id="${product.product_id}">
          </button>

          <div class="d-flex justify-content-center">
            ${renderStars(product.rating)}
          </div>
        </div>

      </div>
    </div>
  `;

  productGrid.appendChild(col);

  const btn = col.querySelector(".btn-fav");
  updateFavButton(btn, isFav);
}

// ===============================
// Update Favourite Button UI
// ===============================
function updateFavButton(btn, isFav) {
  if (isFav) {
    btn.innerHTML = `<i class="fas fa-heart me-2"></i>Remove from Favourite`;
    btn.classList.add("btn-danger");
    btn.classList.remove("btn-primary");
  } else {
    btn.innerHTML = `<i class="far fa-heart me-2"></i>Add to Favourite`;
    btn.classList.add("btn-primary");
    btn.classList.remove("btn-danger");
  }
}

// ===============================
// Favourite Toggle (MERGED)
// ===============================
document.addEventListener("click", async e => {
  const favBtn = e.target.closest(".btn-fav");
  if (!favBtn) return;

  const { data: { session } } = await sb2.auth.getSession();
  if (!session) return alert("Please login first");

  const productId = favBtn.dataset.id;

  if (favouriteSet.has(productId)) {
    await sb2.from("favourites")
      .delete()
      .eq("user_id", session.user.id)
      .eq("product_id", productId);

    favouriteSet.delete(productId);
    updateFavButton(favBtn, false);
  } else {
    await sb2.from("favourites").insert({
      user_id: session.user.id,
      product_id: productId
    });

    favouriteSet.add(productId);
    updateFavButton(favBtn, true);
  }
});

// ===============================
// Product Modal (UNCHANGED)
// ===============================
document.addEventListener("click", async e => {
  const btn = e.target.closest(".btn-view");
  if (!btn) return;

  e.preventDefault();

  const { data, error } = await sb2
    .from("products")
    .select("*")
    .eq("product_id", btn.dataset.id)
    .single();

  if (error) return console.error(error);

  document.querySelector("#productDetailModal img").src = data.image_url;
  document.querySelector("#productDetailModal h4").textContent = data.product_name;
  document.querySelector("#productDetailModal .fs-4").textContent =
    `RM${Number(data.price).toFixed(2)}`;

  document.getElementById("modalRatingBadge").innerHTML =
    `${renderStars(data.rating)} (${Number(data.rating).toFixed(1)})`;

  document.getElementById("modalReviews").textContent =
    data.reviews ? `Reviews: ${data.reviews}` : "Reviews: No reviews";

  document.querySelector("#productDetailModal p").textContent =
    data.ingredients || "No information";

  productModal.show();
});

// ===============================
// Categories + Brands + Filters
// ===============================
async function loadCategories() {
  const { data } = await sb2.from("products").select("product_type");
  const map = {};
  data.forEach(p => map[p.product_type] = (map[p.product_type] || 0) + 1);

  const list = document.getElementById("categoryList");
  list.innerHTML = "";

  Object.entries(map).forEach(([type, count]) => {
    list.innerHTML += `<li>
      <a href="#" class="category-link" data-type="${type}">
        ${type} (${count})
      </a>
    </li>`;
  });

  document.querySelectorAll(".category-link").forEach(l =>
    l.onclick = e => {
      e.preventDefault();
      selectedCategory = l.dataset.type;
      fetchProducts();
    });
}

async function loadBrands() {
  const { data } = await sb2
    .from("brand")
    .select(`brand_id, brand_name, products(count)`);

  const list = document.getElementById("brandList");
  list.innerHTML = "";

  data.forEach(b => {
    list.innerHTML += `<li>
      <a href="#" class="brand-link" data-id="${b.brand_id}">
        ${b.brand_name} (${b.products[0]?.count || 0})
      </a>
    </li>`;
  });

  document.querySelectorAll(".brand-link").forEach(l =>
    l.onclick = e => {
      e.preventDefault();
      selectedBrand = l.dataset.id;
      fetchProducts();
    });
}

// ===============================
// Search / Sort / Price
// ===============================
priceRange?.addEventListener("input", () => {
  maxPrice = priceRange.value;
  priceValue.textContent = `RM ${maxPrice}`;
  fetchProducts();
});

document.getElementById("searchInput")?.addEventListener("input", e => {
  searchKeyword = e.target.value.trim();
  fetchProducts();
});

document.getElementById("sortSelect")?.addEventListener("change", e => {
  sortOption = e.target.value;
  fetchProducts();
});

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
  await loadUserFavourites();
  loadCategories();
  loadBrands();
  fetchProducts();
});
