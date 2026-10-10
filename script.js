
// FastAPI address. Change this if you run uvicorn on another port.
const API_URL = "http://127.0.0.1:8000";

const form = document.getElementById("form");
const submitBtn = document.getElementById("submit");
const resultEl = document.getElementById("result");
const arc = document.getElementById("arc");
const scoreEl = document.getElementById("score");

const states = {
  empty: document.getElementById("state-empty"),
  loading: document.getElementById("state-loading"),
  error: document.getElementById("state-error"),
  done: document.getElementById("state-done"),
};

function showState(name) {
  Object.entries(states).forEach(([key, el]) => { el.hidden = key !== name; });
}

/* ---------- slider read-outs ---------- */
function updateSlider(input) {
  const min = +input.min, max = +input.max, val = +input.value;
  input.style.setProperty("--pct", ((val - min) / (max - min)) * 100 + "%");
  const out = form.querySelector(`output[for="${input.id}"]`);
  if (out) out.textContent = out.dataset.fmt === "h" ? `${val} h` : val;
}
form.querySelectorAll('input[type="range"]').forEach((input) => {
  updateSlider(input);
  input.addEventListener("input", () => updateSlider(input));
});

/* ---------- build the request body ---------- */
function readForm() {
  const fd = new FormData(form);
  return {
    Age: parseInt(fd.get("Age"), 10),
    Gender: fd.get("Gender"),
    Country: fd.get("Country"),
    Academic_Level: fd.get("Academic_Level"),
    Most_Used_Platform: fd.get("Most_Used_Platform"),
    Purpose_Of_Use: fd.get("Purpose_Of_Use"),
    Avg_Daily_Usage_Hours: parseFloat(fd.get("Avg_Daily_Usage_Hours")),
    Daily_Unlocks: parseInt(fd.get("Daily_Unlocks"), 10),
    Study_Hours: parseInt(fd.get("Study_Hours"), 10),
    Physical_Activity_Hours: parseInt(fd.get("Physical_Activity_Hours"), 10),
    Sleep_Hours_Per_Night: parseInt(fd.get("Sleep_Hours_Per_Night"), 10),
    stress_level: fd.get("stress_level"),
  };
}

/* ---------- score -> words ---------- */
function describe(score) {
  if (score >= 7.2) return { color: "#14a085", band: "Looking healthy", text: "Your habits point to a good mental health score." };
  if (score >= 6.0) return { color: "#e8a21c", band: "Somewhere in the middle", text: "Your habits point to a moderate score. Small changes could lift it." };
  return { color: "#e5484d", band: "Worth some attention", text: "Your habits point to a lower score. A few changes could help." };
}

function tipsFor(d) {
  const tips = [];
  if (d.Sleep_Hours_Per_Night < 7) tips.push(`You sleep ${d.Sleep_Hours_Per_Night} h a night. Most people do better with 7 to 9 h.`);
  if (d.Avg_Daily_Usage_Hours >= 6) tips.push(`${d.Avg_Daily_Usage_Hours} h of social media a day is a lot. Try a daily limit on ${d.Most_Used_Platform}.`);
  if (d.Daily_Unlocks >= 100) tips.push(`${d.Daily_Unlocks} unlocks a day suggests constant checking. Turning off non-urgent notifications can cut that down.`);
  if (d.Physical_Activity_Hours < 1) tips.push("A short daily walk or workout often helps with both stress and sleep.");
  if (d.stress_level === "High" || d.stress_level === "Very High") tips.push("Your stress is high. Talking to a friend, mentor or counsellor can make a real difference.");
  if (!tips.length) tips.push("Keep it up. Your sleep, activity and screen time look balanced.");
  return tips.slice(0, 3);
}

/* ---------- animate dial + number ---------- */
let rafId;
function animateScore(target, color) {
  const pct = Math.max(0, Math.min(10, target)) * 10;   // arc uses 0-100
  arc.style.opacity = 1;
  arc.style.stroke = color;
  arc.style.strokeDashoffset = 100 - pct;

  cancelAnimationFrame(rafId);
  const start = performance.now(), dur = 1100;
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    scoreEl.textContent = (target * eased).toFixed(1);
    if (t < 1) rafId = requestAnimationFrame(step);
    else scoreEl.textContent = target.toFixed(1);
  };
  rafId = requestAnimationFrame(step);
}

/* ---------- error text ---------- */
async function errorMessage(res) {
  try {
    const body = await res.json();
    if (Array.isArray(body.detail)) {
      return body.detail.map((e) => `${e.loc.slice(1).join(".")}: ${e.msg}`).join(". ");
    }
    if (body.detail) return String(body.detail);
  } catch (_) { /* ignore */ }
  return `The server returned an error (${res.status}).`;
}

/* ---------- submit ---------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = readForm();
  if (!(data.Age >= 10 && data.Age <= 100)) {
    document.getElementById("error-text").textContent = "Enter an age between 10 and 100.";
    showState("error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Predicting…";
  showState("loading");
  if (window.matchMedia("(max-width: 900px)").matches) resultEl.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const res = await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await errorMessage(res));

    const { predicted_mental_health_score: score } = await res.json();
    const info = describe(score);

    document.getElementById("band").textContent = info.band;
    document.getElementById("summary").textContent = info.text;
    document.getElementById("tips").innerHTML = tipsFor(data).map((t) => `<li>${t}</li>`).join("");
    showState("done");
    animateScore(score, info.color);
  } catch (err) {
    const offline = err instanceof TypeError;   // fetch network failure
    document.getElementById("error-text").textContent = offline
      ? `Can't reach the API at ${API_URL}. Start it with "uvicorn main:app --reload" and try again.`
      : err.message;
    showState("error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Predict my score";
  }
});