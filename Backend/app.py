from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import re
from collections import defaultdict

# ======================================================
# SUPABASE CONFIG (keep yours or move to env vars)
# ======================================================
SUPABASE_URL = "https://zvbothmzwenoenpmgcnv.supabase.co"
SUPABASE_KEY = "sb_publishable_ANaaTi-B_y9JbUGrTxTrwg_jkWSQlIC"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = Flask(__name__)
CORS(app)

# ======================================================
# WEIGHTS (adjust anytime)
# ======================================================
W_CBF = 0.60
W_LIFESTYLE = 0.25
W_CF = 0.15

TOP_K = 20

# ======================================================
# HELPERS
# ======================================================
def safe_get(dct, *keys, default=""):
    """Return the first found key from dct; else default."""
    for k in keys:
        if k in dct and dct[k] is not None:
            return dct[k]
    return default

def normalize_minmax(arr):
    arr = np.array(arr, dtype=float)
    if len(arr) == 0:
        return arr
    mn, mx = float(np.min(arr)), float(np.max(arr))
    if mx - mn < 1e-9:
        return np.zeros_like(arr)
    return (arr - mn) / (mx - mn)

def contains_any(text, keywords):
    """Count how many keywords appear (substring match) in text."""
    if not text:
        return 0
    t = text.lower()
    c = 0
    for kw in keywords:
        if kw and kw.lower() in t:
            c += 1
    return c

def tokenize_text(text):
    """Simple token cleanup for TF-IDF consistency."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s_+-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

# ======================================================
# LIFESTYLE KNOWLEDGE (derived from your CSV, embedded)
# Expand these lists anytime.
# ======================================================
LIFESTYLE_RULES = {
    # ---------------- Scalp type ----------------
    "scalp_type": {
        "dry": {
            "prefer": ["glycerin", "aloe", "hyaluronic", "panthenol", "ceramide", "shea", "argan", "jojoba"],
            "avoid": ["sls", "sodium lauryl sulfate", "alcohol denat", "denatured alcohol"]
        },
        "oily": {
            "prefer": ["salicylic", "niacinamide", "zinc", "tea tree", "charcoal", "clay", "menthol"],
            "avoid": ["heavy oil", "mineral oil", "petrolatum", "butter"]
        },
        "dandruff": {
            "prefer": ["zinc pyrithione", "ketoconazole", "selenium sulfide", "piroctone olamine", "tea tree"],
            "avoid": ["heavy oil", "butter"]
        },
        "combination": {
            "prefer": ["niacinamide", "panthenol", "aloe", "zinc"],
            "avoid": ["sls", "alcohol denat"]
        },
        "normal": {
            "prefer": ["panthenol", "glycerin", "aloe"],
            "avoid": []
        }
    },

    # ---------------- Hair type ----------------
    "hair_type": {
        "straight": {
            "prefer": ["lightweight", "silicone", "dimethicone", "panthenol", "niacinamide"],
            "avoid": ["heavy oil", "butter", "castor oil"]
        },
        "wavy": {
            "prefer": ["balance", "lightweight", "panthenol", "aloe"],
            "avoid": ["heavy oil", "butter"]
        },
        "curly": {
            "prefer": ["shea", "coconut", "argan", "jojoba", "glycerin", "aloe", "curl", "moisture"],
            "avoid": ["sls", "alcohol denat"]
        },
        "coily": {
            "prefer": ["shea", "castor", "coconut", "argan", "ceramide", "butter", "intense moisture"],
            "avoid": ["sls", "alcohol denat"]
        }
    },

    # ---------------- Hair thickness ----------------
    "hair_thickness": {
        "fine": {
            "prefer": ["volumizing", "lightweight", "protein", "biotin"],
            "avoid": ["butter", "heavy oil", "castor oil"]
        },
        "medium": {
            "prefer": ["balance", "panthenol", "aloe"],
            "avoid": []
        },
        "thick": {
            "prefer": ["shea", "argan", "ceramide", "repair", "moisturizing"],
            "avoid": ["harsh"]
        }
    },

    # ---------------- Wash frequency ----------------
    "wash_frequency": {
        "daily": {
            "prefer": ["gentle", "sulfate-free", "mild"],
            "avoid": ["sls", "sodium lauryl sulfate"]
        },
        "2_3_per_week": {
            "prefer": ["balance"],
            "avoid": []
        },
        "once_week": {
            "prefer": ["deep", "repair", "moisture"],
            "avoid": []
        },
        "less_than_once_week": {
            "prefer": ["clarifying", "scalp care"],
            "avoid": []
        }
    },

    # ---------------- Treatment frequency ----------------
    "treatment_frequency": {
        "daily": {"prefer": ["repair", "strengthening", "bond", "keratin"], "avoid": []},
        "2_3_per_week": {"prefer": ["repair", "mask", "serum"], "avoid": []},
        "occasionally": {"prefer": ["maintenance"], "avoid": []},
        "never": {"prefer": ["gentle"], "avoid": []}
    },

    # ---------------- Preference / concern (your Q5) ----------------
    # This is NOT product category; it's benefit preference
    "preference": {
        "moisturizing": {"prefer": ["glycerin", "aloe", "hyaluronic", "panthenol", "ceramide", "hydration"], "avoid": ["alcohol denat"]},
        "volumizing": {"prefer": ["protein", "biotin", "collagen", "volum", "lightweight"], "avoid": ["butter", "heavy oil"]},
        "anti_dandruff": {"prefer": ["zinc pyrithione", "ketoconazole", "piroctone", "selenium sulfide", "tea tree"], "avoid": []},
        "strengthening": {"prefer": ["keratin", "bond", "amino", "protein", "biotin", "repair"], "avoid": []}
    },

    # ---------------- Lifestyle factors ----------------
    "water_intake": {
        "lt_2": {"prefer": ["hydration", "moisturizing", "glycerin", "aloe"], "avoid": ["alcohol denat"]},
        "2_4": {"prefer": ["hydration", "glycerin"], "avoid": []},
        "5_7": {"prefer": [], "avoid": []},
        "8_plus": {"prefer": [], "avoid": []}
    },
    "sleep_hours": {
        "lt_4": {"prefer": ["repair", "strengthening", "scalp care"], "avoid": []},
        "4_6": {"prefer": ["strengthening", "repair"], "avoid": []},
        "6_8": {"prefer": [], "avoid": []},
        "gt_8": {"prefer": [], "avoid": []}
    },
    "sun_exposure": {
        "lt_30": {"prefer": [], "avoid": []},
        "30_60": {"prefer": ["antioxidant", "vitamin e"], "avoid": []},
        "1_2": {"prefer": ["uv", "antioxidant", "vitamin e"], "avoid": []},
        "gt_2": {"prefer": ["uv", "antioxidant", "vitamin e", "repair"], "avoid": []}
    },
    "pollution_exposure": {
        "daily": {"prefer": ["clarifying", "detox", "charcoal"], "avoid": []},
        "few_week": {"prefer": ["clarifying", "detox"], "avoid": []},
        "occasionally": {"prefer": [], "avoid": []},
        "rarely_never": {"prefer": [], "avoid": []}
    },
    "supplements": {
        "yes_regularly": {"prefer": [], "avoid": []},
        "occasionally": {"prefer": ["strengthening"], "avoid": []},
        "rarely": {"prefer": ["strengthening", "repair"], "avoid": []},
        "never": {"prefer": ["strengthening", "repair"], "avoid": []}
    }
}

# ======================================================
# BUILD USER TEXT (CBF input) from ALL diagnostics
# ======================================================
def build_user_text(profile: dict) -> str:
    # Pull values with fallbacks for naming variants
    hair_type = safe_get(profile, "hair_type")
    hair_thickness = safe_get(profile, "hair_thickness")
    scalp_type = safe_get(profile, "scalp_type")

    wash_frequency = safe_get(profile, "washing_frequency", "wash_frequency")
    treatment_frequency = safe_get(profile, "treatment_usage", "treatment_frequency")

    water_intake = safe_get(profile, "water_intake")
    sleep_hours = safe_get(profile, "sleep_hours")
    sun_exposure = safe_get(profile, "sunlight_expose", "sun_exposure")
    pollution_exposure = safe_get(profile, "pollution_expose", "pollution_exposure")
    supplements = safe_get(profile, "supplements")

    # Preference from Q5 (stored as product_type in lifestyle_profile, per your form)
    preference = safe_get(profile, "product_type")

    parts = [
        f"hair_type {hair_type}",
        f"hair_thickness {hair_thickness}",
        f"scalp_type {scalp_type}",
        f"wash_frequency {wash_frequency}",
        f"treatment_frequency {treatment_frequency}",
        f"water_intake {water_intake}",
        f"sleep_hours {sleep_hours}",
        f"sun_exposure {sun_exposure}",
        f"pollution_exposure {pollution_exposure}",
        f"supplements {supplements}",
        f"preference {preference}",
    ]

    # Add preferred/avoid tokens from rules (derived from CSV knowledge)
    prefer_tokens = []
    avoid_tokens = []

    def add_tokens(category, value):
        if not value:
            return
        ruleset = LIFESTYLE_RULES.get(category, {})
        rule = ruleset.get(value, {})
        prefer_tokens.extend(rule.get("prefer", []))
        avoid_tokens.extend(rule.get("avoid", []))

    add_tokens("hair_type", hair_type)
    add_tokens("hair_thickness", hair_thickness)
    add_tokens("scalp_type", scalp_type)
    add_tokens("wash_frequency", wash_frequency)
    add_tokens("treatment_frequency", treatment_frequency)
    add_tokens("water_intake", water_intake)
    add_tokens("sleep_hours", sleep_hours)
    add_tokens("sun_exposure", sun_exposure)
    add_tokens("pollution_exposure", pollution_exposure)
    add_tokens("supplements", supplements)
    add_tokens("preference", preference)

    parts.append("prefer " + " ".join(prefer_tokens))
    if avoid_tokens:
        parts.append("avoid " + " ".join(avoid_tokens))

    return tokenize_text(" ".join(parts))

# ======================================================
# RULE-BASED LIFESTYLE SCORE per product
# ======================================================
def compute_lifestyle_score(profile: dict, product: dict) -> float:
    """
    Score is based on presence of preferred ingredients and penalties for avoid ingredients.
    Uses ALL diagnostics via rule tokens.
    """
    ingredients = (product.get("ingredients") or "").lower()
    name = (product.get("product_name") or "").lower()
    category = (product.get("product_type") or "").lower()

    product_text = f"{name} {category} {ingredients}".lower()

    # Collect prefer/avoid keywords from all diagnostics
    prefer = []
    avoid = []

    def add_tokens(category_key, value):
        if not value:
            return
        ruleset = LIFESTYLE_RULES.get(category_key, {})
        rule = ruleset.get(value, {})
        prefer.extend(rule.get("prefer", []))
        avoid.extend(rule.get("avoid", []))

    hair_type = safe_get(profile, "hair_type")
    hair_thickness = safe_get(profile, "hair_thickness")
    scalp_type = safe_get(profile, "scalp_type")
    wash_frequency = safe_get(profile, "washing_frequency", "wash_frequency")
    treatment_frequency = safe_get(profile, "treatment_usage", "treatment_frequency")
    water_intake = safe_get(profile, "water_intake")
    sleep_hours = safe_get(profile, "sleep_hours")
    sun_exposure = safe_get(profile, "sunlight_expose", "sun_exposure")
    pollution_exposure = safe_get(profile, "pollution_expose", "pollution_exposure")
    supplements = safe_get(profile, "supplements")
    preference = safe_get(profile, "product_type")  # benefit preference

    add_tokens("hair_type", hair_type)
    add_tokens("hair_thickness", hair_thickness)
    add_tokens("scalp_type", scalp_type)
    add_tokens("wash_frequency", wash_frequency)
    add_tokens("treatment_frequency", treatment_frequency)
    add_tokens("water_intake", water_intake)
    add_tokens("sleep_hours", sleep_hours)
    add_tokens("sun_exposure", sun_exposure)
    add_tokens("pollution_exposure", pollution_exposure)
    add_tokens("supplements", supplements)
    add_tokens("preference", preference)

    # Prefer matches add points, avoid matches subtract points
    prefer_hits = contains_any(product_text, prefer)
    avoid_hits = contains_any(product_text, avoid)

    score = 0.0
    score += 0.15 * prefer_hits
    score -= 0.20 * avoid_hits

    # Small bonus if product category matches typical usage of preference
    # (Still flexible; does not require schema changes)
    if preference == "anti_dandruff" and ("shampoo" in category or "scalp" in product_text):
        score += 0.3
    if preference == "volumizing" and ("shampoo" in category or "conditioner" in category):
        score += 0.1
    if preference == "moisturizing" and ("conditioner" in category or "mask" in product_text):
        score += 0.1
    if preference == "strengthening" and ("serum" in category or "treatment" in product_text):
        score += 0.1

    # Clamp (keep stable)
    return float(max(min(score, 5.0), -5.0))

# ======================================================
# CF SCORE from favourites (implicit feedback)
# - popularity: how many favourites a product has
# - co-favourite overlap: products liked by users who liked what this user likes
# ======================================================
def compute_cf_scores(user_id: str, product_ids: list) -> dict:
    """
    Returns {product_id: cf_score_raw} for products in product_ids.
    Uses favourites table only.
    """
    # Pull all favourites (OK for small/medium FYP scale).
    # If it grows huge, we can optimize later.
    fav_res = supabase.table("favourites").select("user_id, product_id").execute()
    fav_rows = fav_res.data or []

    item_users = defaultdict(set)   # product_id -> set(user_id)
    user_items = defaultdict(set)   # user_id -> set(product_id)
    for r in fav_rows:
        uid = r.get("user_id")
        pid = r.get("product_id")
        if uid and pid is not None:
            item_users[pid].add(uid)
            user_items[uid].add(pid)

    # popularity
    pop_count = {pid: len(item_users.get(pid, set())) for pid in product_ids}

    # co-favourite: overlap between users who liked candidate and users who liked any of current user's favs
    user_favs = user_items.get(user_id, set())
    union_users_of_user_favs = set()
    for fav_pid in user_favs:
        union_users_of_user_favs |= item_users.get(fav_pid, set())

    cf_raw = {}
    for pid in product_ids:
        users_for_item = item_users.get(pid, set())
        pop = pop_count.get(pid, 0)

        if pop == 0:
            cf_raw[pid] = 0.0
            continue

        overlap = len(users_for_item & union_users_of_user_favs) if union_users_of_user_favs else 0
        overlap_ratio = overlap / pop  # 0..1

        # Combine: popularity + overlap ratio
        # Popularity scaled later by min-max normalization.
        cf_raw[pid] = float(pop + overlap_ratio)

    return cf_raw

# ======================================================
# MAIN ENDPOINT
# ======================================================
@app.route("/api/recommend", methods=["POST"])
def recommend():
    try:
        body = request.get_json(force=True)
        user_id = body.get("user_id")

        if not user_id:
            return jsonify({"error": "user_id is required"}), 400

        # ======================================================
        # 1) Fetch user's latest lifestyle profile
        # ======================================================
        profile_res = supabase.table("lifestyle_profile") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()

        profiles = profile_res.data or []
        if not profiles:
            return jsonify({"error": "No lifestyle profile found"}), 400

        profile = profiles[0]

        # ======================================================
        # 2) Fetch products
        # ======================================================
        products_res = supabase.table("products") \
            .select("product_id, product_name, ingredients, product_type, rating, reviews") \
            .execute()

        products = products_res.data or []
        if not products:
            return jsonify({"error": "No products found"}), 500

        # ======================================================
        # 3) Build CBF inputs (TF-IDF)
        # ======================================================
        user_text = build_user_text(profile)

        product_texts = []
        valid_products = []

        for p in products:
            pid = p.get("product_id")
            ingredients = p.get("ingredients") or ""
            pname = p.get("product_name") or ""
            pcat = p.get("product_type") or ""

            # product text includes name + category + ingredients (better than ingredients-only)
            text = tokenize_text(f"{pname} {pcat} {ingredients}".strip())
            if not text:
                continue

            product_texts.append(text)
            valid_products.append(p)

        if not valid_products:
            return jsonify({"error": "No valid products (missing text)"}), 500

        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        tfidf_matrix = vectorizer.fit_transform(product_texts)
        user_vec = vectorizer.transform([user_text])

        cbf_scores = cosine_similarity(user_vec, tfidf_matrix).flatten()  # 0..1

        # ======================================================
        # 4) Lifestyle (rule-based) scores
        # ======================================================
        lifestyle_raw = []
        for p in valid_products:
            lifestyle_raw.append(compute_lifestyle_score(profile, p))

        lifestyle_norm = normalize_minmax(lifestyle_raw)

        # ======================================================
        # 5) CF scores (from favourites)
        # ======================================================
        product_ids = [p["product_id"] for p in valid_products]
        cf_raw_map = compute_cf_scores(user_id, product_ids)

        cf_raw_list = [cf_raw_map.get(pid, 0.0) for pid in product_ids]
        cf_norm = normalize_minmax(cf_raw_list)

        # ======================================================
        # 6) Hybrid score
        # ======================================================
        cbf_norm = cbf_scores  # already 0..1
        hybrid = (W_CBF * cbf_norm) + (W_LIFESTYLE * lifestyle_norm) + (W_CF * cf_norm)

        # Rank
        ranked_idx = np.argsort(-hybrid)

        # ======================================================
        # 7) Clear old recommendations
        # ======================================================
        supabase.table("recommendation").delete().eq("user_id", user_id).execute()

        # ======================================================
        # 8) Insert top recommendations
        # ======================================================
        inserts = []
        for i in ranked_idx[:TOP_K]:
            p = valid_products[int(i)]
            inserts.append({
                "user_id": user_id,
                "product_id": p["product_id"],
                "cbf_score": float(cbf_norm[int(i)]),
                "cf_score": float(cf_norm[int(i)]),
                "lifestyle_score": float(lifestyle_norm[int(i)]),
                "hybrid_score": float(hybrid[int(i)])
            })

        if inserts:
            supabase.table("recommendation").insert(inserts).execute()

        return jsonify({
            "message": "Hybrid recommendations generated successfully",
            "user_id": user_id,
            "count": len(inserts),
            "weights": {"cbf": W_CBF, "lifestyle": W_LIFESTYLE, "cf": W_CF}
        }), 200

    except Exception as e:
        print("Recommendation error:", str(e))
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
