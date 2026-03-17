console.log("Brand Management Loaded");

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

let brandModal;

document.addEventListener("DOMContentLoaded", () => {
  brandModal = new bootstrap.Modal(document.getElementById("brandModal"));
  loadBrands();
});

// ===============================
// Load Brands + Product Count
// ===============================
async function loadBrands() {
  const { data, error } = await sb
    .from("brand")
    .select(`
      brand_id,
      brand_name,
      products ( product_id )
    `);

  if (error) {
    console.error("Brand load error:", error.message);
    return;
  }

  const tbody = document.getElementById("brandTableBody");
  tbody.innerHTML = "";

  data.forEach((brand, index) => {
    const productCount = brand.products?.length || 0;

    const row = `
      <tr>
        <td>${index + 1}</td>
        <td>${brand.brand_name}</td>
        <td>
          <span class="badge bg-info">${productCount}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-warning me-1"
            onclick="openEditBrand(${brand.brand_id}, '${brand.brand_name.replace(/'/g, "\\'")}')">
            Edit
          </button>
          <button class="btn btn-sm btn-danger"
            onclick="deleteBrand(${brand.brand_id})">
            Delete
          </button>
        </td>
      </tr>
    `;

    tbody.insertAdjacentHTML("beforeend", row);
  });
}

// ===============================
// Open Add Brand
// ===============================
function openAddBrand() {
  document.getElementById("brandModalTitle").innerText = "Add Brand";
  document.getElementById("brandId").value = "";
  document.getElementById("brandName").value = "";
  brandModal.show();
}

// ===============================
// Open Edit Brand
// ===============================
function openEditBrand(id, name) {
  document.getElementById("brandModalTitle").innerText = "Edit Brand";
  document.getElementById("brandId").value = id;
  document.getElementById("brandName").value = name;
  brandModal.show();
}

// ===============================
// Save Brand (Add or Edit)
// ===============================
async function saveBrand() {
  const id = document.getElementById("brandId").value;
  const name = document.getElementById("brandName").value.trim();

  if (!name) {
    alert("Brand name cannot be empty");
    return;
  }

  let result;
  if (id) {
    result = await sb
      .from("brand")
      .update({ brand_name: name })
      .eq("brand_id", id);
  } else {
    result = await sb
      .from("brand")
      .insert({ brand_name: name });
  }

  if (result.error) {
    alert(result.error.message);
    return;
  }

  brandModal.hide();
  loadBrands();
}

// ===============================
// Delete Brand
// ===============================
async function deleteBrand(id) {
  if (!confirm("Delete this brand? Products under this brand may be affected.")) return;

  const { error } = await sb
    .from("brand")
    .delete()
    .eq("brand_id", id);

  if (error) {
    alert(error.message);
    return;
  }

  loadBrands();
}
