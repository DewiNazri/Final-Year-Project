console.log("Hairvella Admin Dashboard Loaded");

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

document.addEventListener("DOMContentLoaded", async () => {
  loadDashboardStats();
  loadTopProductsChart();
  loadNewUsersTrend();
  loadHybridContributionChart();
  loadPersonalizationCoverage(); // ✅ NEW
});

// ===============================
// Dashboard Counters
// ===============================
async function loadDashboardStats() {
  const { count: users } = await sb.from("users").select("*", { count: "exact", head: true });
  const { count: products } = await sb.from("products").select("*", { count: "exact", head: true });
  const { count: brands } = await sb.from("brand").select("*", { count: "exact", head: true });
  const { count: recs } = await sb.from("recommendation").select("*", { count: "exact", head: true });

  document.getElementById("totalUsers").innerText = users ?? 0;
  document.getElementById("totalProducts").innerText = products ?? 0;
  document.getElementById("totalBrands").innerText = brands ?? 0;
  document.getElementById("totalRecommendations").innerText = recs ?? 0;
}

// ===============================
// 1️⃣ Top 5 Recommended Products
// ===============================
async function loadTopProductsChart() {
  const { data, error } = await sb
    .from("recommendation")
    .select("product_id, products(product_name)");

  if (error) {
    console.error("Top products error:", error.message);
    return;
  }

  const counts = {};
  (data || []).forEach(r => {
    if (!r.products) return;
    const name = r.products.product_name;
    counts[name] = (counts[name] || 0) + 1;
  });

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const labels = sorted.map(i =>
    i[0].length > 30 ? i[0].slice(0, 30) + "…" : i[0]
  );
  const values = sorted.map(i => i[1]);

  new Chart(document.getElementById("topProductsChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Times Recommended",
        data: values,
        backgroundColor: [
          "rgba(0, 156, 255, 0.8)",
          "rgba(40, 167, 69, 0.8)",
          "rgba(255, 193, 7, 0.8)",
          "rgba(220, 53, 69, 0.8)",
          "rgba(108, 117, 125, 0.8)"
        ]
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Number of Times Recommended"
          }
        }
      }
    }
  });
}

// ===============================
// 2️⃣ New Users Trend
// ===============================
async function loadNewUsersTrend() {
  const { data, error } = await sb
    .from("users")
    .select("created_at");

  if (error) {
    console.error("New users trend error:", error.message);
    return;
  }

  const daily = {};
  (data || []).forEach(u => {
    const date = new Date(u.created_at).toISOString().slice(0, 10);
    daily[date] = (daily[date] || 0) + 1;
  });

  let labels = Object.keys(daily).sort();
  let values = labels.map(d => daily[d]);

  const MAX_DAYS = 14;
  if (labels.length > MAX_DAYS) {
    labels = labels.slice(-MAX_DAYS);
    values = values.slice(-MAX_DAYS);
  }

  new Chart(document.getElementById("newUsersChart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "New Users per Day",
        data: values,
        borderColor: "rgba(0, 156, 255, 1)",
        backgroundColor: "rgba(0, 156, 255, 0.15)",
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}

// ===============================
// 3️⃣ Hybrid Contribution Analysis
// ===============================
async function loadHybridContributionChart() {
  const { data, error } = await sb
    .from("recommendation")
    .select("cbf_score, cf_score, lifestyle_score, hybrid_score");

  if (error) {
    console.error("Hybrid contribution error:", error.message);
    return;
  }

  let cbf = 0, cf = 0, lifestyle = 0, hybrid = 0;

  (data || []).forEach(r => {
    cbf += r.cbf_score || 0;
    cf += r.cf_score || 0;
    lifestyle += r.lifestyle_score || 0;
    hybrid += r.hybrid_score || 0;
  });

  const n = (data && data.length) ? data.length : 1;

  new Chart(document.getElementById("hybridContributionChart"), {
    type: "bar",
    data: {
      labels: [
        "Content-Based Filtering",
        "Collaborative Filtering",
        "Lifestyle Factors",
        "Hybrid Filtering"
      ],
      datasets: [{
        label: "Average Score",
        data: [
          cbf / n,
          cf / n,
          lifestyle / n,
          hybrid / n
        ],
        backgroundColor: [
          "rgba(0, 156, 255, 0.7)",
          "rgba(40, 167, 69, 0.7)",
          "rgba(255, 193, 7, 0.7)",
          "rgba(220, 53, 69, 0.8)"
        ]
      }]
    },
    options: {
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Average Score Value"
          }
        }
      }
    }
  });
}

// ===============================
// ✅ 4️⃣ Personalization Coverage Mini Cards
// ===============================
async function loadPersonalizationCoverage() {
  try {
    // total users
    const { count: usersCount, error: usersErr } = await sb
      .from("users")
      .select("*", { count: "exact", head: true });

    const totalUsers = usersErr ? 0 : (usersCount ?? 0);

    // lifestyle users (distinct user_id)
    const { data: lifestyleRows, error: lifeErr } = await sb
      .from("lifestyle_profile")
      .select("user_id");

    if (lifeErr) {
      console.error("Lifestyle profile fetch error:", lifeErr.message);
    }

    const lifestyleUserSet = new Set((lifestyleRows || []).map(r => r.user_id));
    const lifestyleUsers = lifestyleUserSet.size;

    // cold-start users
    const coldStart = Math.max(0, totalUsers - lifestyleUsers);

    // total recommendations
    const { count: recsCount, error: recsErr } = await sb
      .from("recommendation")
      .select("*", { count: "exact", head: true });

    const totalRecs = recsErr ? 0 : (recsCount ?? 0);

    // avg recs per user
    const avgRecs = totalUsers > 0 ? (totalRecs / totalUsers) : 0;

    // Render
    const usersWithLifestyleEl = document.getElementById("usersWithLifestyle");
    const coldStartUsersEl = document.getElementById("coldStartUsers");
    const avgRecsPerUserEl = document.getElementById("avgRecsPerUser");

    if (usersWithLifestyleEl) usersWithLifestyleEl.innerText = `${lifestyleUsers} / ${totalUsers}`;
    if (coldStartUsersEl) coldStartUsersEl.innerText = coldStart;
    if (avgRecsPerUserEl) avgRecsPerUserEl.innerText = avgRecs.toFixed(1);

  } catch (e) {
    console.error("loadPersonalizationCoverage unexpected error:", e);
  }
}
