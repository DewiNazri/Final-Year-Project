console.log("User Management Loaded");

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

document.addEventListener("DOMContentLoaded", () => {
  loadUsers();
});

// ===============================
// Load Users with Profile + Favourites
// ===============================
async function loadUsers() {
  const { data, error } = await sb
    .from("users")
    .select(`
      user_id,
      username,
      email,
      created_at,
      lifestyle_profile (
        hair_type,
        scalp_type,
        washing_frequency,
        treatment_usage
      ),
      favourites ( product_id )
    `);

  if (error) {
    console.error("User load error:", error.message);
    return;
  }

  const tbody = document.getElementById("userTableBody");
  tbody.innerHTML = "";

  data.forEach((user, index) => {
    const profile = user.lifestyle_profile?.[0] || {};
    const favCount = user.favourites?.length || 0;

    const lifestyleSummary = `
      Wash: ${profile.washing_frequency || "N/A"},
      Treatment: ${profile.treatment_usage || "N/A"}
    `;

    const row = `
      <tr>
        <td>${index + 1}</td>
        <td class="text-muted">${user.user_id}</td>
        <td>
          <strong>${user.username || "N/A"}</strong><br>
          <small>${user.email}</small>
        </td>
        <td>${new Date(user.created_at).toLocaleDateString("en-GB")}</td>
        
        <td>
          <button class="btn p-0" style="border:none; background:transparent;"
                  onclick="openFavsModal('${user.user_id}', '${escapeHtml(user.username || "User")}')">
            <span class="badge bg-primary">${favCount}</span>
          </button>
        </td>


        <td>
          <div class="d-flex flex-column gap-2">
            <button class="btn btn-outline-primary btn-sm w-100"
                    style="min-width: 120px;"
                    onclick="openProfileModal('${user.user_id}', '${escapeHtml(user.username || "User")}')">
              View Profile
            </button>

            <button class="btn btn-outline-dark btn-sm w-100"
                    style="min-width: 120px;"
                    onclick="openRecsModal('${user.user_id}', '${escapeHtml(user.username || "User")}')">
              View Recs
            </button>
          </div>
        </td>
      </tr>
    `;

    tbody.insertAdjacentHTML("beforeend", row);
  });
}

// ===============================
// Modal: Profile Details
// ===============================
async function openProfileModal(userId, username) {
  const modalTitle = document.querySelector("#profileModal .modal-title");
  const body = document.getElementById("profileModalBody");

  modalTitle.textContent = `Lifestyle Profile Details — ${username}`;
  body.innerHTML = `<div class="text-muted small">Loading...</div>`;

  const { data, error } = await sb
    .from("lifestyle_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    body.innerHTML = `<div class="text-danger small">Failed to load profile: ${error.message}</div>`;
  } else if (!data) {
    body.innerHTML = `<div class="text-muted small">No lifestyle profile found (cold-start user).</div>`;
  } else {
    // Render key fields nicely
    body.innerHTML = `
      <div class="row g-3">
        <div class="col-md-6"><strong>Hair Type:</strong> ${pretty("hair_type", data.hair_type)}</div>
        <div class="col-md-6"><strong>Hair Thickness:</strong> ${pretty("hair_thickness", data.hair_thickness)}</div>

        <div class="col-md-6"><strong>Scalp Type:</strong> ${pretty("scalp_type", data.scalp_type)}</div>
        <div class="col-md-6"><strong>Washing Frequency:</strong> ${pretty("washing_frequency", data.washing_frequency)}</div>

        <div class="col-md-6"><strong>Hair Concern:</strong> ${pretty("product_type", data.product_type)}</div>
        <div class="col-md-6"><strong>Treatment Frequency:</strong> ${pretty("treatment_usage", data.treatment_usage)}</div>

        <div class="col-md-6"><strong>Water Intake:</strong> ${pretty("water_intake", data.water_intake)}</div>
        <div class="col-md-6"><strong>Sleep Hours:</strong> ${pretty("sleep_hours", data.sleep_hours)}</div>

        <div class="col-md-6"><strong>Sunlight Exposure:</strong> ${pretty("sunlight_expose", data.sunlight_expose)}</div>
        <div class="col-md-6"><strong>Pollution Exposure:</strong> ${pretty("pollution_expose", data.pollution_expose)}</div>

        <div class="col-md-6"><strong>Supplements:</strong> ${pretty("supplements", data.supplements)}</div>
        <div class="col-md-6"><strong>Created At:</strong> ${data.created_at ? new Date(data.created_at).toLocaleString() : "N/A"}</div>
      </div>
    `;
  }

  const modal = new bootstrap.Modal(document.getElementById("profileModal"));
  modal.show();
}

// ===============================
// Modal: Recommendation History
// ===============================
async function openRecsModal(userId, username) {
  const modalEl = document.getElementById("recsModal");
  const modal = new bootstrap.Modal(modalEl);

  // ✅ show modal immediately (so even "no data" users will see something)
  const modalTitle = document.querySelector("#recsModal .modal-title");
  const tbody = document.getElementById("recsModalBody");

  modalTitle.textContent = `Recommendation History — ${username}`;
  tbody.innerHTML = `<tr><td colspan="6" class="text-muted small">Loading...</td></tr>`;
  modal.show();

  // Fetch recs
  const { data, error } = await sb
    .from("recommendation")
    .select(`
      created_at,
      cbf_score,
      cf_score,
      lifestyle_score,
      hybrid_score,
      products ( product_name )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-danger small">
          Failed to load recommendations: ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
    return;
  }

  // ✅ No recs case -> show message inside modal
  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted small py-4">
          No recommendation yet
        </td>
      </tr>
    `;
    return;
  }

  // Render rows
  tbody.innerHTML = "";
  data.forEach(r => {
    const productName = r.products?.product_name || "Unknown Product";
    const date = r.created_at ? new Date(r.created_at).toLocaleDateString("en-GB") : "—";

    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${date}</td>
        <td>${escapeHtml(productName)}</td>
        <td class="text-center">${formatScore(r.cbf_score)}</td>
        <td class="text-center">${formatScore(r.cf_score)}</td>
        <td class="text-center">${formatScore(r.lifestyle_score)}</td>
        <td class="text-center"><strong>${formatScore(r.hybrid_score)}</strong></td>
      </tr>
    `);
  });
}


// ===============================
// Modal: Favourite
// ===============================
async function openFavsModal(userId, username) {
  const modalEl = document.getElementById("favsModal");
  const modal = new bootstrap.Modal(modalEl);

  const title = document.querySelector("#favsModal .modal-title");
  const tbody = document.getElementById("favsModalBody");

  title.textContent = `Favourite Products — ${username}`;
  tbody.innerHTML = `<tr><td colspan="5" class="text-muted small">Loading...</td></tr>`;
  modal.show();

  // Get favourites + product details + brand
  const { data, error } = await sb
    .from("favourites")
    .select(`
      created_at,
      products (
        product_name,
        product_type,
        image_url,
        brand ( brand_name )
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    tbody.innerHTML = `
      <tr><td colspan="5" class="text-danger small">
        Failed to load favourites: ${escapeHtml(error.message)}
      </td></tr>
    `;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5" class="text-center text-muted small py-4">
        No favourite products yet
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = "";
  data.forEach(row => {
    const p = row.products;
    const img = p?.image_url
      ? `<img src="${escapeHtml(p.image_url)}" alt="img" style="width:48px;height:48px;object-fit:cover;border-radius:8px;">`
      : `<div style="width:48px;height:48px;border-radius:8px;background:#eee;"></div>`;

    const brandName = p?.brand?.brand_name || "No Brand";
    const date = row.created_at ? new Date(row.created_at).toLocaleDateString("en-GB") : "—";

    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${img}</td>
        <td>${escapeHtml(p?.product_name || "Unknown Product")}</td>
        <td>${escapeHtml(p?.product_type || "—")}</td>
        <td>${escapeHtml(brandName)}</td>
        <td>${date}</td>
      </tr>
    `);
  });
}


// ===============================
// Format Lifestyle Modal
// ===============================

const VALUE_LABELS = {
  hair_type: {
    straight: "Straight (Type 1)",
    wavy: "Wavy (Type 2)",
    curly: "Curly (Type 3)",
    coily: "Coily (Type 4)",
  },
  hair_thickness: {
    fine: "Fine",
    medium: "Medium",
    thick: "Thick",
  },
  scalp_type: {
    oily: "Oily",
    normal: "Normal",
    dry: "Dry",
    combination: "Combination",
  },

  // DB column: washing_frequency
  washing_frequency: {
    daily: "Daily",
    "2_3_per_week": "2–3 times per week",
    once_week: "Once a week",
    less_than_once_week: "Less than once a week",
  },

  // DB column: product_type
  product_type: {
    moisturizing: "Moisturizing",
    volumizing: "Volumizing",
    anti_dandruff: "Anti-dandruff",
    strengthening: "Strengthening",
  },

  // DB column: treatment_usage
  treatment_usage: {
    daily: "Daily",
    "2_3_per_week": "2–3 times per week",
    occasionally: "Occasionally",
    never: "Never",
  },

  water_intake: {
    lt_2: "Less than 2 glasses",
    "2_4": "2–4 glasses",
    "5_7": "5–7 glasses",
    "8_plus": "8 glasses or more",
  },

  sleep_hours: {
    lt_4: "Less than 4 hours",
    "4_6": "4–6 hours",
    "6_8": "6–8 hours",
    gt_8: "More than 8 hours",
  },

  // DB column: sunlight_expose
  sunlight_expose: {
    lt_30: "Less than 30 minutes",
    "30_60": "30–60 minutes",
    "1_2": "1–2 hours",
    gt_2: "More than 2 hours",
  },

  // DB column: pollution_expose
  pollution_expose: {
    daily: "Daily",
    few_week: "A few times per week",
    occasionally: "Occasionally",
    rarely_never: "Rarely or never",
  },

  supplements: {
    yes_regularly: "Yes, regularly",
    occasionally: "Occasionally",
    rarely: "Rarely",
    never: "Never",
  },
};

function pretty(field, value) {
  if (value === null || value === undefined || value === "") return "N/A";
  const key = String(value);

  const map = VALUE_LABELS[field];
  if (map && map[key]) return map[key];

  // fallback: make code readable
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}




// ===============================
// Helpers
// ===============================
function formatScore(v) {
  if (v === null || v === undefined) return "—";
  const num = Number(v);
  return Number.isFinite(num) ? num.toFixed(2) : "—";
}

function safe(v) {
  return v === null || v === undefined || v === "" ? "N/A" : escapeHtml(String(v));
}

// Prevent XSS in modal/table
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}
