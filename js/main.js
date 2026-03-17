// ===============================
// 1️⃣ SUPABASE INIT (MUST BE FIRST)
// ===============================
if (!window.sb) {
  window.sb = supabase.createClient(
    "https://zvbothmzwenoenpmgcnv.supabase.co",
    "sb_publishable_ANaaTi-B_y9JbUGrTxTrwg_jkWSQlIC"
  );
}
const sb2 = window._supabase;


// ===============================
// 2️⃣ ADMIN PROTECTION
// ===============================
// document.addEventListener("DOMContentLoaded", async () => {
//   const { data: { session } } = await window._supabase.auth.getSession();

//   if (!session) {
//     window.location.replace("../index.html");
//     return;
//   }

//   const { data: user } = await window._supabase
//     .from("users")
//     .select("role")
//     .eq("user_id", session.user.id)
//     .single();

//   if (user?.role !== "admin") {
//     alert("Access denied");
//     window.location.replace("../index.html");
//   }
// });

document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.replace("../index.html");
    return;
  }

  const { data: user } = await sb
    .from("users")
    .select("role")
    .eq("user_id", session.user.id)
    .single();

  if (user?.role !== "admin") {
    alert("Access denied");
    window.location.replace("../index.html");
  }
});



(function ($) {
    "use strict";

    // Spinner
    var spinner = function () {
        setTimeout(function () {
            if ($('#spinner').length > 0) {
                $('#spinner').removeClass('show');
            }
        }, 1);
    };
    spinner();
    
    
    // Back to top button
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.back-to-top').fadeIn('slow');
        } else {
            $('.back-to-top').fadeOut('slow');
        }
    });
    $('.back-to-top').click(function () {
        $('html, body').animate({scrollTop: 0}, 1500, 'easeInOutExpo');
        return false;
    });


    // Sidebar Toggler
    $('.sidebar-toggler').click(function () {
        $('.sidebar, .content').toggleClass("open");
        return false;
    });


    // Progress Bar
    $('.pg-bar').waypoint(function () {
        $('.progress .progress-bar').each(function () {
            $(this).css("width", $(this).attr("aria-valuenow") + '%');
        });
    }, {offset: '80%'});



    
})(jQuery);


// ===============================
// Load Logged-in Admin Username
// ===============================
async function loadAdminProfile() {
  const { data: { session } } = await window._supabase.auth.getSession();
  if (!session) return;

  const { data, error } = await window._supabase
    .from("users")
    .select("username")
    .eq("user_id", session.user.id)
    .single();

  if (error) {
    console.error("Profile load error:", error.message);
    return;
  }

  const name = data?.username || "Admin";

  const sidebarName = document.getElementById("sidebarUsername");
  const navbarName = document.getElementById("navbarUsername");

  if (sidebarName) sidebarName.innerText = name;
  if (navbarName) navbarName.innerText = name;
}

window.addEventListener("load", loadAdminProfile);

// ===============================
// Admin Global Search
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("adminSearchInput");
  if (!input) return; // <-- THIS PREVENTS LAG

  input.addEventListener("keyup", () => {
    const keyword = input.value.toLowerCase();
    document.querySelectorAll("table tbody tr").forEach(row => {
      row.style.display = row.innerText.toLowerCase().includes(keyword)
        ? ""
        : "none";
    });
  });
});

// ===============================
// LOG OUT FUNCTION
// ===============================
// document.addEventListener("DOMContentLoaded", () => {
//   const logoutBtn = document.getElementById("logoutBtn");
//   if (!logoutBtn) return;

//   logoutBtn.addEventListener("click", async (e) => {
//     e.preventDefault();

//     await window._supabase.auth.signOut();
//     window.location.replace("../index.html");
//   });
// });

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const { error } = await sb.auth.signOut();
    if (error) {
      console.error("Logout error:", error.message);
      alert("Logout failed: " + error.message);
      return;
    }

    window.location.replace("../index.html");
  });
});
