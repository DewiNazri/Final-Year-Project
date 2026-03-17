console.log("trend-products.js loaded");

document.addEventListener("DOMContentLoaded", async () => {
  const row = document.getElementById("trendProductsRow");
  const loading = document.getElementById("trendLoading");
  const empty = document.getElementById("trendEmpty");
  if (!row) return;

  loading?.classList.remove("d-none");
  empty?.classList.add("d-none");

  const sb = window._supabase;
  if (!sb) {
    console.error("Supabase client not found. Make sure auth.js loads before trend-products.js");
    loading?.classList.add("d-none");
    empty?.classList.remove("d-none");
    return;
  }

  // Bootstrap modal instance (same as shop)
  const productModalEl = document.getElementById("productDetailModal");
  const productModal = productModalEl ? new bootstrap.Modal(productModalEl) : null;

  try {
    const days = 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: recRows, error: recErr } = await sb
      .from("recommendation")
      .select("product_id, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);

    if (recErr) throw recErr;

    if (!recRows || recRows.length === 0) {
      loading?.classList.add("d-none");
      empty?.classList.remove("d-none");
      return;
    }

    const counts = new Map();
    for (const r of recRows) {
      if (!r.product_id) continue;
      counts.set(r.product_id, (counts.get(r.product_id) || 0) + 1);
    }

    const topIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([product_id]) => product_id);

    const { data: products, error: prodErr } = await sb
      .from("products")
      .select(`
        product_id,
        product_name,
        product_type,
        price,
        image_url,
        rating,
        reviews,
        ingredients,
        brand:brand_id ( brand_name )
      `)
      .in("product_id", topIds);

    if (prodErr) throw prodErr;

    const productMap = new Map((products || []).map(p => [p.product_id, p]));
    const ordered = topIds.map(id => productMap.get(id)).filter(Boolean);

    row.innerHTML = "";

    for (let i = 0; i < ordered.length; i++) {
      const p = ordered[i];
      const recCount = counts.get(p.product_id) || 0;

      const name = p.product_name || "Hair Product";
      const type = p.product_type || "Recommended";
      const brandName = p.brand?.brand_name ? p.brand.brand_name : "";
      const img = p.image_url || "img/product-3.png";
      const price = (p.price !== null && p.price !== undefined)
        ? `RM${Number(p.price).toFixed(2)}`
        : "";

      const delay = 0.1 + i * 0.2;

      // ✅ SAME CARD STRUCTURE AS shop (products.js renderProductCard)
      row.insertAdjacentHTML("beforeend", `
        <div class="col-lg-4 col-md-6 wow fadeInUp" data-wow-delay="${delay}s">
          <div class="product-item rounded wow fadeInUp h-100">
            <div class="product-item-inner border rounded h-100 d-flex flex-column">

              <div class="product-item-inner-item position-relative">
                <img src="${img}" class="img-fluid w-100 rounded-top" alt="${name}" />

                <!-- ✅ Trending badge (pink style like shop theme) -->
                <span class="badge bg-secondary position-absolute top-0 start-0 m-2">
                  Trending
                </span>

                <div class="product-details">
                  <!-- ✅ Eye opens modal -->
                  <a href="#" class="btn-view" data-id="${p.product_id}">
                    <i class="fa fa-eye fa-1x"></i>
                  </a>
                </div>
              </div>

              <div class="text-center rounded-bottom p-4 flex-grow-1">
                <span class="text-muted">${type}</span>
                <h6 class="mt-2">${name}</h6>

                <!-- ✅ keep recommendations (last 30 days) -->
                <small class="text-muted d-block mb-2">
                  ${brandName ? `${brandName} • ` : ""}${recCount} recommendations (last 30 days)
                </small>

                ${price ? `<span class="text-primary fs-5">${price}</span>` : ``}
              </div>

              

            </div>
          </div>
        </div>
      `);
    }

    loading?.classList.add("d-none");
    if (ordered.length === 0) empty?.classList.remove("d-none");

    // ✅ Modal click handler (same behaviour as shop/products.js)
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest(".btn-view");
      if (!btn) return;
      e.preventDefault();

      if (!productModal) {
        console.warn("productDetailModal not found in index.html");
        return;
      }

      const productId = btn.dataset.id;

      const { data, error } = await sb
        .from("products")
        .select("*")
        .eq("product_id", productId)
        .single();

      if (error) return console.error(error);

      document.querySelector("#productDetailModal img").src = data.image_url || "";
      document.querySelector("#productDetailModal h4").textContent = data.product_name || "";
      document.querySelector("#productDetailModal .fs-4").textContent =
        `RM${Number(data.price || 0).toFixed(2)}`;

      // If you have a star renderer in homepage, you can plug it here.
      document.getElementById("modalRatingBadge").textContent =
        data.rating ? `Rating: ${Number(data.rating).toFixed(1)}` : "Rating: -";

      document.getElementById("modalReviews").textContent =
        data.reviews ? `Reviews: ${data.reviews}` : "Reviews: No reviews";

      document.querySelector("#productDetailModal p").textContent =
        data.ingredients || "No information";

      productModal.show();
    });

  } catch (err) {
    console.error("Trend load error:", err);
    loading?.classList.add("d-none");
    empty?.classList.remove("d-none");
  }
});
