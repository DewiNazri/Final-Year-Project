console.log("profile.js loaded");

// ===============================
// SUPABASE INIT
// ===============================
if (!window._supabase) {
  window._supabase = window.supabase.createClient(
    "https://zvbothmzwenoenpmgcnv.supabase.co",
    "sb_publishable_ANaaTi-B_y9JbUGrTxTrwg_jkWSQlIC"
  );
}
const sb3 = window._supabase;
const whyReasonMap = {};  // product_id -> [reasons]

// ===============================
// STATE
// ===============================
let originalData = {};
let favouriteSet = new Set();

// ===============================
// DOM REFS (match profile.html IDs)
// ===============================
let profileForm, pfUsername, pfEmail, pfName, pfGender, pfAge;
let editBtn, saveBtn, cancelBtn;
let newPasswordEl, confirmPasswordEl;

// ===============================
// PASSWORD EYE TOGGLE (used by inline onclick in profile.html)
// ===============================
// HTML calls: togglePassword('newPassword', this) / togglePassword('confirmPassword', this)
window.togglePassword = function (inputId, el) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.type = input.type === "password" ? "text" : "password";

  const icon = el?.querySelector("i");
  if (!icon) return;

  if (input.type === "text") {
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
};

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
  // bind elements safely (so no reliance on global IDs)
  profileForm = document.getElementById("profileForm");
  pfUsername = document.getElementById("pfUsername");
  pfEmail = document.getElementById("pfEmail");
  pfName = document.getElementById("pfName");
  pfGender = document.getElementById("pfGender");
  pfAge = document.getElementById("pfAge");

  editBtn = document.getElementById("editBtn");
  saveBtn = document.getElementById("saveBtn");
  cancelBtn = document.getElementById("cancelBtn");

  newPasswordEl = document.getElementById("newPassword");
  confirmPasswordEl = document.getElementById("confirmPassword");

  const { data: { session } } = await sb3.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return;
  }

  const userId = session.user.id;

  await loadUserFavourites(userId);
  await loadProfile(userId);
  await loadDiagnosticResult(userId);  
  await loadFavourites(userId);
  await loadRecommendations(userId);
  await loadUsersLikeYouAlsoLiked(userId);

  // buttons
  if (editBtn) editBtn.onclick = () => toggleEdit(true);

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      restoreData();
      // clear password fields
      if (newPasswordEl) newPasswordEl.value = "";
      if (confirmPasswordEl) confirmPasswordEl.value = "";
      toggleEdit(false);
    };
  }

  // save (profile form submit)
  if (profileForm) {
    profileForm.addEventListener("submit", onSaveProfile);
  }
});

// ===============================
// CARD BEHAVIOUR
// ===============================
let productModal = null;

document.addEventListener("DOMContentLoaded", () => {
  const modalEl = document.getElementById("productDetailModal");
  if (modalEl) productModal = new bootstrap.Modal(modalEl);
});

function renderStars(rating) {
  let stars = "";
  const rounded = Math.round(rating || 0);
  for (let i = 1; i <= 5; i++) {
    stars += `<i class="fas fa-star ${i <= rounded ? "text-primary" : "text-muted"}"></i>`;
  }
  return stars;
}

// ===============================
// LOAD USER FAVOURITES (STATE)
// ===============================
async function loadUserFavourites(userId) {
  const { data, error } = await sb3
    .from("favourites")
    .select("product_id")
    .eq("user_id", userId);

  if (error) {
    console.error(error);
    return;
  }

  favouriteSet = new Set((data || []).map((f) => f.product_id));
}

// ===============================
// PROFILE INFO
// ===============================
async function loadProfile(userId) {
  const { data, error } = await sb3
    .from("users")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) return alert(error.message);

  if (pfUsername) pfUsername.value = data.username ?? "";
  if (pfEmail) pfEmail.value = data.email ?? "";
  if (pfName) pfName.value = data.name ?? "";
  if (pfGender) pfGender.value = data.gender ?? "";
  if (pfAge) pfAge.value = data.age ?? "";

  originalData = { ...data };
}

// ===============================
// EDIT / CANCEL helpers
// ===============================
function toggleEdit(edit) {
  document.querySelectorAll(".editable").forEach((el) => (el.disabled = !edit));
  if (editBtn) editBtn.classList.toggle("d-none", edit);
  if (saveBtn) saveBtn.classList.toggle("d-none", !edit);
  if (cancelBtn) cancelBtn.classList.toggle("d-none", !edit);
}

function restoreData() {
  if (pfName) pfName.value = originalData.name ?? "";
  if (pfGender) pfGender.value = originalData.gender ?? "";
  if (pfAge) pfAge.value = originalData.age ?? "";
}

// ===============================
// SAVE PROFILE ✅ (AGE VALIDATION + PASSWORD UPDATE)
// ===============================
async function onSaveProfile(e) {
  e.preventDefault();

  // 1) Age validation: if below 0 -> error
  const ageStr = (pfAge?.value ?? "").toString().trim();
  const ageNum = ageStr === "" ? null : Number(ageStr);

  if (ageNum !== null && (Number.isNaN(ageNum) || ageNum < 0)) {
    alert("Age cannot be below 0.");
    return;
  }

  // 2) Password validation + update auth password
  const newPassword = (newPasswordEl?.value ?? "").trim();
  const confirmPassword = (confirmPasswordEl?.value ?? "").trim();

  if (newPassword || confirmPassword) {
    if (newPassword.length < 6) {
      alert("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("New password and confirm password do not match.");
      return;
    }
  }

  // Update users table
  const updates = {
    name: pfName?.value ?? "",
    gender: pfGender?.value ?? "",
    age: ageNum, // number or null
  };

  const { data: { user } } = await sb3.auth.getUser();

  const { error } = await sb3
    .from("users")
    .update(updates)
    .eq("user_id", user.id);

  if (error) return alert(error.message);

  // Update Supabase Auth password (ONLY if user typed it)
  if (newPassword) {
    const { error: passErr } = await sb3.auth.updateUser({ password: newPassword });
    if (passErr) return alert(passErr.message);

    // clear password fields
    if (newPasswordEl) newPasswordEl.value = "";
    if (confirmPasswordEl) confirmPasswordEl.value = "";
  }

  alert("Profile updated successfully!");
  originalData = { ...originalData, ...updates };
  toggleEdit(false);
}

// ===============================
// CARD RENDER (SAME AS SHOP)
// ===============================
function renderProductCard(product, container, removable = false, source = "generic") {
  if (!product) return;

  const isFav = favouriteSet.has(product.product_id);

  const col = document.createElement("div");
  col.className = "col-lg-4 col-md-6";

  col.innerHTML = `
    <div class="product-item rounded wow fadeInUp h-100">
    <div class="product-item-inner border rounded h-100 d-flex flex-column">

      <div class="product-item-inner-item position-relative">
        <img src="${product.image_url}" class="img-fluid w-100 rounded-top" />

        <div class="product-details">
          <a href="#" class="btn-view" data-id="${product.product_id}" data-source="${source}">
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

  container.appendChild(col);

  const btn = col.querySelector(".btn-fav");
  updateFavButton(btn, isFav);

  btn.onclick = async () => {
    const { data: { session } } = await sb3.auth.getSession();
    if (!session) return alert("Please login first");

    if (favouriteSet.has(product.product_id)) {
      await sb3.from("favourites")
        .delete()
        .eq("user_id", session.user.id)
        .eq("product_id", product.product_id);

      favouriteSet.delete(product.product_id);
      updateFavButton(btn, false);

      if (removable) col.remove();
    } else {
      await sb3.from("favourites").insert({
        user_id: session.user.id,
        product_id: product.product_id
      });

      favouriteSet.add(product.product_id);
      updateFavButton(btn, true);
    }
  };
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn-view");
  if (!btn) return;

  e.preventDefault();

  const { data, error } = await sb3
    .from("products")
    .select("*")
    .eq("product_id", btn.dataset.id)
    .single();

  if (error) return console.error(error);

  // ✅ Fill modal (same as shop)
  document.querySelector("#productDetailModal img").src = data.image_url;
  document.querySelector("#productDetailModal h4").textContent = data.product_name;
  document.querySelector("#productDetailModal .fs-4").textContent =
    `RM${Number(data.price).toFixed(2)}`;

  const badge = document.getElementById("modalRatingBadge");
  if (badge) badge.innerHTML = `${renderStars(data.rating)} (${Number(data.rating).toFixed(1)})`;

  const reviews = document.getElementById("modalReviews");
  if (reviews) reviews.textContent =
    data.reviews ? `Reviews: ${data.reviews}` : "Reviews: No reviews";

  const p = document.querySelector("#productDetailModal p");
  if (p) p.textContent = data.ingredients || "No information";

  const source = btn.dataset.source; // "recommended" / "favourite" / "similar"

  const whyBox = document.getElementById("whyInModal");
  const whyList = document.getElementById("whyInModalList");

  if (whyBox && whyList) {
    if (source === "recommended") {
      const reasons = whyReasonMap[data.product_id] || [];
      whyList.innerHTML = reasons.length
        ? reasons.map(r => `<li class="text-muted small">${r}</li>`).join("")
        : `<li class="text-muted small">Recommended based on your hair profile and lifestyle.</li>`;

      whyBox.classList.remove("d-none");
    } else {
      whyBox.classList.add("d-none");
      whyList.innerHTML = "";
    }
  }
  
  productModal?.show();
});

// ===============================
// UPDATE BUTTON UI
// ===============================
function updateFavButton(btn, isFav) {
  if (!btn) return;

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
// LOAD FAVOURITES
// ===============================
async function loadFavourites(userId) {
  const grid = document.getElementById("favouriteGrid");
  if (!grid) return;

  grid.innerHTML = "";

  const { data, error } = await sb3
    .from("favourites")
    .select(`
      products (
        product_id,
        product_name,
        product_type,
        price,
        rating,
        image_url
      )
    `)
    .eq("user_id", userId);

  if (error) return console.error(error);

  if (!data?.length) {
    grid.innerHTML = "<p class='text-muted'>No favourite products yet.</p>";
    return;
  }

  data.forEach((f) => {
    if (f.products) renderProductCard(f.products, grid, true);
  });
}

// ===============================
// LOAD RECOMMENDATIONS
// ===============================
async function loadRecommendations(userId) {
  const grid = document.getElementById("recommendationGrid");
  if (!grid) return;

  grid.innerHTML = "";

  const { data, error } = await sb3
    .from("recommendation")
    .select(`
      products (
        product_id,
        product_name,
        product_type,
        price,
        rating,
        image_url
      )
    `)
    .eq("user_id", userId)
    .order("hybrid_score", { ascending: false });

  if (error) return console.error(error);

  if (!data?.length) {
    grid.innerHTML = "<p class='text-muted'>No recommendations yet.</p>";
    return;
  }

  const whyGrid = document.getElementById("whyRecommendedGrid");
  if (whyGrid) whyGrid.innerHTML = "";

  data.slice(0, 10).forEach((r) => {
    if (!r.products) return;

    // save reasons only for recommended
    const reasons = buildWhyReasons(r.products, lifestyleState);
    whyReasonMap[r.products.product_id] = reasons;

    // render card with source tag
    renderProductCard(r.products, grid, false, "recommended");

    // optional: if you still want the WHY section on the page too
    if (whyGrid) {
      renderWhyCard(r.products, reasons, whyGrid);
    }
  });

}

// ===============================
// DIAGNOSTIC RESULT (from lifestyle_profile)
// ===============================
let lifestyleState = null;

function prettyText(v) {
  if (!v) return "-";
  return String(v)
    .replaceAll("_", " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function computeLifestyleRisks(lp) {
  const risks = [];

  // "Stress" proxy: sleep < 6 hours
  if (lp?.sleep_hours === "lt_4" || lp?.sleep_hours === "4_6") risks.push("Stress");

  // Outdoor exposure: sunlight high
  if (lp?.sunlight_expose === "1_2" || lp?.sunlight_expose === "gt_2") risks.push("Outdoor exposure");

  // Pollution exposure: frequent
  if (lp?.pollution_expose === "daily" || lp?.pollution_expose === "few_week") risks.push("Pollution");

  // Hydration risk
  if (lp?.water_intake === "lt_2" || lp?.water_intake === "2_4") risks.push("Low hydration");

  return risks;
}

async function loadDiagnosticResult(userId) {
  const box = document.getElementById("diagnosticBox");
  if (!box) return;

  const { data, error } = await sb3
    .from("lifestyle_profile")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    box.innerHTML = `
      <p class="text-muted mb-2">No diagnostic result found yet.</p>
      <a href="diagnostics.html" class="btn btn-primary rounded-pill px-4">Take Diagnostic Test</a>
    `;
    lifestyleState = null;
    return;
  }

  lifestyleState = data;

  const risks = computeLifestyleRisks(data);
  const riskText = risks.length ? risks.join(" + ") : "Low risk";

  // NOTE: You used "product_type" as the concern selection in diagnostics.js
  const mainConcern = prettyText(data.product_type);

  const score = Math.min(100, (risks.length / 4) * 100);

  box.innerHTML = `
    <div class="diag-card">
      <div class="diag-head p-3 p-md-4 d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-3">
          
          <div>
            <div class="fw-bold mb-0">Your Hair Snapshot</div>
            <div class="text-muted small">Based on your diagnostic answers</div>
          </div>
        </div>

        <a href="diagnostics.html" class="btn btn-outline-secondary rounded-pill px-4">
          Update
        </a>
      </div>

      <div class="p-3 p-md-4">
        <div class="row g-3">
          <div class="col-md-6 col-lg-3">
            <div class="diag-item">
              <div class="diag-label"><i class="fas fa-water me-2"></i>Hair Type</div>
              <div class="diag-value">${prettyText(data.hair_type)}</div>
            </div>
          </div>

          <div class="col-md-6 col-lg-3">
            <div class="diag-item">
              <div class="diag-label"><i class="fas fa-ruler-vertical me-2"></i>Thickness</div>
              <div class="diag-value">${prettyText(data.hair_thickness)}</div>
            </div>
          </div>

          <div class="col-md-6 col-lg-3">
            <div class="diag-item">
              <div class="diag-label"><i class="fas fa-leaf me-2"></i>Scalp</div>
              <div class="diag-value">${prettyText(data.scalp_type)}</div>
            </div>
          </div>

          <div class="col-md-6 col-lg-3">
            <div class="diag-item">
              <div class="diag-label"><i class="fas fa-bullseye me-2"></i>Main Concern</div>
              <div class="diag-value">${mainConcern}</div>
            </div>
          </div>

          <div class="col-12">
            <div class="diag-item">
              <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div>
                  <div class="diag-label mb-1"><i class="fas fa-chart-line me-2"></i>Lifestyle Risk</div>
                  <div class="diag-chips">
                    ${
                      risks.length
                        ? risks.map(r => `<span class="diag-chip">${r}</span>`).join("")
                        : `<span class="diag-chip">Low risk</span>`
                    }
                  </div>
                </div>

                <div style="min-width:220px">
                  <div class="small text-muted mb-1">Risk meter</div>
                  <div class="diag-meter">
                    <div style="width:${score}%;"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}


// ===============================
// WHY RECOMMENDED (simple explanation rules)
// ===============================
function buildWhyReasons(product, lp) {
  const reasons = [];

  // Main concern match (your diagnostics uses product_type as concern)
  if (lp?.product_type && product?.product_type) {
    if (String(product.product_type).toLowerCase() === String(lp.product_type).toLowerCase()) {
      reasons.push(`Matches your main concern: ${prettyText(lp.product_type)}.`);
    }
  }

  // Scalp-sensitive logic (basic)
  if (lp?.scalp_type === "oily") reasons.push("Suitable for oily scalp routines (helps reduce heavy buildup).");
  if (lp?.scalp_type === "dry") reasons.push("Supports dry scalp comfort (focus on moisture).");
  if (lp?.scalp_type === "combination") reasons.push("Balanced option for combination scalp needs.");

  // Lifestyle-based nudges
  const risks = computeLifestyleRisks(lp);

  if (risks.includes("Outdoor exposure")) reasons.push("Good for outdoor exposure (hair needs protection + nourishment).");
  if (risks.includes("Pollution")) reasons.push("Helps for frequent pollution exposure (cleansing/repair support).");
  if (risks.includes("Low hydration")) reasons.push("Hydration support (pairs well with low water intake).");
  if (risks.includes("Stress")) reasons.push("Supports hair fall-prone periods linked with low rest/stress.");

  // Keep it short & not spammy
  return reasons.slice(0, 3);
}

function renderWhyCard(product, reasons, container) {
  const col = document.createElement("div");
  col.className = "col-lg-4 col-md-6";

  const reasonList = (reasons?.length ? reasons : ["Recommended based on your profile and similar users' preferences."])
    .map(r => `<li class="small text-muted mb-1">• ${r}</li>`)
    .join("");

  col.innerHTML = `
    <div class="bg-white rounded shadow-sm p-3 h-100">
      <div class="d-flex gap-3">
        <img src="${product.image_url}" alt=""
          style="width:72px;height:72px;object-fit:cover;border-radius:12px;">
        <div class="flex-grow-1">
          <div class="fw-semibold">${product.product_name}</div>
          <div class="text-muted small">${product.product_type ?? ""} • RM${Number(product.price).toFixed(2)}</div>
        </div>
      </div>

      <hr class="my-3">
      <ul class="list-unstyled mb-0">
        ${reasonList}
      </ul>
    </div>
  `;

  container.appendChild(col);
}


// ===============================
// USERS LIKE YOU ALSO LIKED (simple similarity)
// ===============================
async function loadUsersLikeYouAlsoLiked(userId) {
  const grid = document.getElementById("similarUsersGrid");
  if (!grid) return;

  grid.innerHTML = "<p class='text-muted'>Loading...</p>";

  // Need diagnostic first
  if (!lifestyleState) {
    grid.innerHTML = "<p class='text-muted'>Complete your diagnostic to see similar users.</p>";
    return;
  }

  // 1) Find similar users by matching hair_type + scalp_type + concern
  const { data: similarProfiles, error: spErr } = await sb3
    .from("lifestyle_profile")
    .select("user_id")
    .eq("hair_type", lifestyleState.hair_type)
    .eq("scalp_type", lifestyleState.scalp_type)
    .eq("product_type", lifestyleState.product_type)
    .neq("user_id", userId)
    .limit(25);

  if (spErr || !similarProfiles?.length) {
    grid.innerHTML = "<p class='text-muted'>Not enough similar users yet.</p>";
    return;
  }

  const similarUserIds = similarProfiles.map(x => x.user_id);

  // 2) Pull their favourites
  const { data: favRows, error: favErr } = await sb3
    .from("favourites")
    .select(`
      product_id,
      products (
        product_id, product_name, product_type, price, rating, image_url
      )
    `)
    .in("user_id", similarUserIds);

  if (favErr || !favRows?.length) {
    grid.innerHTML = "<p class='text-muted'>No similar-user favourites found yet.</p>";
    return;
  }

  // 3) Count product popularity
  const counts = new Map();
  for (const row of favRows) {
    const pid = row.product_id;
    if (!pid || !row.products) continue;
    counts.set(pid, (counts.get(pid) || 0) + 1);
  }

  // 4) Sort by popularity, exclude user's own favourites
  const uniqueProducts = [];
  const seen = new Set();

  // build list of product objects
  for (const row of favRows) {
    if (row.products && !seen.has(row.products.product_id)) {
      seen.add(row.products.product_id);
      uniqueProducts.push(row.products);
    }
  }

  uniqueProducts.sort((a, b) => (counts.get(b.product_id) || 0) - (counts.get(a.product_id) || 0));

  const top = uniqueProducts
    .filter(p => !favouriteSet.has(p.product_id))
    .slice(0, 6);

  if (!top.length) {
    grid.innerHTML = "<p class='text-muted'>No new suggestions from similar users yet.</p>";
    return;
  }

  grid.innerHTML = "";
  top.forEach(p => renderProductCard(p, grid, false));
}
