  // ============================
  // Multi-step wizard logic
  // ============================
  const form = document.getElementById("hairQuizForm");
  const steps = Array.from(document.querySelectorAll(".quiz-step"));
  const backBtn = document.getElementById("backBtn");
  const nextBtn = document.getElementById("nextBtn");
  const submitBtn = document.getElementById("submitBtn");

  const progressBar = document.getElementById("progressBar");
  const stepText = document.getElementById("stepText");
  const percentText = document.getElementById("percentText");

  const errorBox = document.getElementById("errorBox");
  const successBox = document.getElementById("successBox");

  let currentStep = 1;
  const totalSteps = steps.length;
  let userId = null;

  function showStep(stepNumber) {
    steps.forEach(s => s.style.display = "none");
    const current = steps.find(s => Number(s.dataset.step) === stepNumber);
    if (current) current.style.display = "block";

    // Buttons
    backBtn.disabled = stepNumber === 1;
    nextBtn.classList.toggle("d-none", stepNumber === totalSteps);
    submitBtn.classList.toggle("d-none", stepNumber !== totalSteps);

    // Progress
    const percent = Math.round(((stepNumber - 1) / (totalSteps - 1)) * 100);
    progressBar.style.width = percent + "%";
    percentText.textContent = percent + "%";
    stepText.textContent = `Step ${stepNumber} of ${totalSteps}`;

    // Clear alerts
    errorBox.classList.add("d-none");
    successBox.classList.add("d-none");
  }

  function validateCurrentStep() {
    const stepEl = steps.find(s => Number(s.dataset.step) === currentStep);
    if (!stepEl) return true;

    // Check required radios in this step
    const requiredInputs = stepEl.querySelectorAll("input[required]");
    for (const input of requiredInputs) {
      if (input.type === "radio") {
        const groupName = input.name;
        const checked = stepEl.querySelector(`input[name="${groupName}"]:checked`);
        if (!checked) return false;
      }
    }
    return true;
  }

  backBtn.addEventListener("click", () => {
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  });

  nextBtn.addEventListener("click", () => {
    if (!validateCurrentStep()) {
      errorBox.textContent = "Please select an answer before continuing.";
      errorBox.classList.remove("d-none");
      return;
    }
    if (currentStep < totalSteps) {
      currentStep++;
      showStep(currentStep);
    }
  });









  form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!validateCurrentStep()) {
    errorBox.textContent = "Please select an answer before submitting.";
    errorBox.classList.remove("d-none");
    return;
  }

  if (!userId) {
    errorBox.textContent = "User not logged in.";
    errorBox.classList.remove("d-none");
    return;
  }

  // 1️⃣ Collect answers
  const fd = new FormData(form);
  const answers = Object.fromEntries(fd.entries());

  // 2️⃣ Build payload that MATCHES Supabase columns
  const lifestylePayload = {
    user_id: userId,                         // UUID (string)
    hair_type: answers.hair_type,
    hair_thickness: answers.hair_thickness,
    scalp_type: answers.scalp_type,
    washing_frequency: answers.wash_frequency,
    product_type: answers.product_type,
    treatment_usage: answers.treatment_frequency,
    water_intake: answers.water_intake,
    sleep_hours: answers.sleep_hours,
    sunlight_expose: answers.sun_exposure,
    pollution_expose: answers.pollution_exposure,
    supplements: answers.supplements,
  };

  try {
    errorBox.classList.add("d-none");
    successBox.classList.add("d-none");

    // setTimeout(() => {
    //   window.location.href = "profile.html";
    // }, 1200);

    // 3️⃣ Save to Supabase (THIS WAS MISSING)
    const { error: upsertError } = await sb
      .from("lifestyle_profile")
      .upsert(lifestylePayload, {
        onConflict: "user_id"
      });

    if (upsertError) throw upsertError;


    // 4️⃣ Call Flask recommendation API
    await fetch("http://127.0.0.1:5000/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });

    successBox.textContent = "✅ Analysis complete! Generating recommendations...";
    successBox.classList.remove("d-none");

    // 5️⃣ Redirect to profile
    setTimeout(() => {
      window.location.href = "profile.html#recommendationGrid";
    }, 1500);

  } catch (err) {
    console.error(err);
    errorBox.textContent = "❌ " + err.message;
    errorBox.classList.remove("d-none");
  }
});


  // init
  showStep(currentStep);

document.addEventListener("DOMContentLoaded", async () => {
  const sb = window._supabase;

  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    alert("Please sign in to access the diagnostic quiz.");
    window.location.href = "index.html";
    return;
  }

  // ✅ THIS is the correct user_id
  userId = session.user.id;
  console.log("Logged in user:", userId);
});

