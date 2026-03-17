console.log("Product Management Loaded");

// ===============================
// Supabase Init
// ===============================
if (!window._supabase) {
  window._supabase = window.supabase.createClient(
    "https://zvbothmzwenoenpmgcnv.supabase.co",
    "sb_publishable_ANaaTi-B_y9JbUGrTxTrwg_jkWSQlIC"
  );
}
const sb = window._supabase;

let productModal;

document.addEventListener("DOMContentLoaded", async () => {
  productModal = new bootstrap.Modal(document.getElementById("productModal"));
  await loadBrands();
  await loadProductTypes();
  await loadProducts();
});

// ===============================
// Load Products
// ===============================
async function loadProducts() {
  const { data, error } = await sb
    .from("products")
    .select(`
      product_id,
      product_name,
      product_type,
      price,
      rating,
      reviews,
      created_at,
      brand ( brand_name )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error.message);
    return;
  }

  const tbody = document.getElementById("productTableBody");
  tbody.innerHTML = "";

  data.forEach((p, i) => {
    const row = `
      <tr>
        <td>${i + 1}</td>
        <td>${p.product_name}</td>
        <td>${p.product_type || "-"}</td>
        <td>${p.brand?.brand_name || "-"}</td>
        <td>${Number(p.price).toFixed(2)}</td>
        <td>${p.rating || "-"}</td>
        <td>${p.reviews || 0}</td>
        <td>${new Date(p.created_at).toLocaleDateString("en-GB")}</td>
        <td>
          <button class="btn btn-sm w-100 btn-warning me-1 mb-1"
            onclick="openEditProduct(${p.product_id})">Edit</button>
          <button class="btn btn-sm w-100 btn-danger"
            onclick="deleteProduct(${p.product_id})">Delete</button>
        </td>
      </tr>
    `;
    tbody.insertAdjacentHTML("beforeend", row);
  });
}

// ===============================
// Load Brand Dropdown
// ===============================
async function loadBrands() {
  const { data } = await sb.from("brand").select("*");
  const select = document.getElementById("brandSelect");
  select.innerHTML = "";

  data.forEach(b => {
    select.innerHTML += `<option value="${b.brand_id}">${b.brand_name}</option>`;
  });
}


// ===============================
// Load Category Dropdown (from products.product_type)
// ===============================
async function loadProductTypes() {
  const { data, error } = await sb
    .from("products")
    .select("product_type")
    .not("product_type", "is", null);

  if (error) {
    console.error("Load product types error:", error.message);
    return;
  }

  const select = document.getElementById("productType");
  if (!select) return;

  // keep the first placeholder option
  select.innerHTML = `<option value="">-- Select Category --</option>`;

  const uniqueTypes = [...new Set(data.map(d => (d.product_type || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  uniqueTypes.forEach(type => {
    select.innerHTML += `<option value="${type}">${type}</option>`;
  });
}


// ===============================
// Open Add Product
// ===============================
function openAddProduct() {
  document.getElementById("productModalTitle").innerText = "Add Product";
  document.getElementById("productId").value = "";

  // Clear inputs + textarea
  document.querySelectorAll("#productModal input, #productModal textarea").forEach(e => {
    if (e.type === "file") e.value = "";
    else e.value = "";
  });

  // Reset selects
  document.getElementById("brandSelect").selectedIndex = 0;
  document.getElementById("productType").value = "";

  productModal.show();
}


// ===============================
// Save Product (Add / Edit)
// ===============================
async function saveProduct() {
  const id = document.getElementById("productId").value;
  const imageFile = document.getElementById("productImage").files[0];

  let imageUrl = null;

  if (imageFile) {
    const filePath = `products/${Date.now()}_${imageFile.name}`;
    const { error } = await sb.storage
      .from("product-images")
      .upload(filePath, imageFile);

    if (error) {
      alert(error.message);
      return;
    }

    imageUrl = sb.storage.from("product-images").getPublicUrl(filePath).data.publicUrl;
  }

  const payload = {
    product_name: document.getElementById("productName").value,
    product_type: document.getElementById("productType").value,
    brand_id: document.getElementById("brandSelect").value,
    ingredients: document.getElementById("ingredients").value,
    price: document.getElementById("price").value,
    rating: document.getElementById("rating").value,
    reviews: document.getElementById("reviews").value,
    product_link: document.getElementById("productLink").value,
    ...(imageUrl && { image_url: imageUrl })
  };

  let result;
  if (id) {
    result = await sb.from("products").update(payload).eq("product_id", id);
  } else {
    result = await sb.from("products").insert(payload);
  }

  if (result.error) {
    alert(result.error.message);
    return;
  }

  productModal.hide();
  loadProducts();
}

// ===============================
// Open Edit Product
// ===============================
async function openEditProduct(productId) {
  document.getElementById("productModalTitle").innerText = "Edit Product";

  // Clear file input (user must re-pick if they want to change image)
  const fileInput = document.getElementById("productImage");
  if (fileInput) fileInput.value = "";

  const { data, error } = await sb
    .from("products")
    .select("*")
    .eq("product_id", productId)
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  document.getElementById("productId").value = data.product_id;
  document.getElementById("productName").value = data.product_name || "";
  document.getElementById("productType").value = data.product_type || "";
  document.getElementById("brandSelect").value = data.brand_id || "";
  document.getElementById("ingredients").value = data.ingredients || "";
  document.getElementById("price").value = data.price ?? "";
  document.getElementById("rating").value = data.rating ?? "";
  document.getElementById("reviews").value = data.reviews ?? "";
  document.getElementById("productLink").value = data.product_link || "";

  productModal.show();
}


// ===============================
// Delete Product
// ===============================
async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;

  const { error } = await sb.from("products").delete().eq("product_id", id);
  if (error) alert(error.message);
  loadProducts();
}
