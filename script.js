// --- DOM refs ---
const baseUrlInput = document.getElementById("baseUrl");
const chat         = document.getElementById("chat");
const form         = document.getElementById("composer");
const msg          = document.getElementById("message");
const sendBtn      = document.getElementById("sendBtn");
const checkBtn     = document.getElementById("checkBtn");

// --- Persist base URL ---
const DEFAULT_URL = "http://127.0.0.1:8000";
baseUrlInput.value =
  (localStorage.getItem("bb_base_url") || DEFAULT_URL).trim();
baseUrlInput.addEventListener("change", () => {
  localStorage.setItem("bb_base_url", baseUrlInput.value.trim());
});

// --- UI helpers ---
function addBubble(text, who = "bot") {
  const div = document.createElement("div");
  div.className = `bubble ${who}`;
  div.textContent = String(text ?? "");
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
function addError(text) {
  const div = document.createElement("div");
  div.className = "bubble error";
  div.textContent = String(text ?? "Error");
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// --- Fetch with timeout helper ---
async function fetchWithTimeout(url, opts = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

// --- Health check (click) ---
checkBtn.addEventListener("click", async () => {
  const base = (baseUrlInput.value || "").trim() || DEFAULT_URL;

  // Sanity: ensure user didn't type "127.0.0.1:8000" without scheme
  if (!/^https?:\/\//i.test(base)) {
    addError("Base URL must start with http:// or https:// (e.g., http://127.0.0.1:8000)");
    return;
  }

  checkBtn.disabled = true;
  checkBtn.textContent = "Checking…";
  try {
    const r = await fetchWithTimeout(`${base}/health`, { method: "GET" }, 5000);

    if (!r.ok) {
      const raw = await r.text().catch(() => "");
      addError(`Health failed: HTTP ${r.status} ${r.statusText}\n${raw}`);
      return;
    }

    const j = await r.json().catch(() => ({}));
    const ok      = j?.ok === true && j?.offline === true;
    const loaded  = j?.model_loaded ? "Model: loaded"     : "Model: not loaded";
    const pathSet = j?.model_path_set ? "Model path: set" : "Model path: not set";
    addBubble(`Health: ${ok ? "OK" : "Issue"} • ${loaded} • ${pathSet}`, "bot");
  } catch (e) {
    if (e.name === "AbortError") {
      addError("Health check timed out (no response). Is the backend running?");
    } else {
      addError(`Could not reach backend /health: ${e.message || e}`);
    }
  } finally {
    checkBtn.disabled = false;
    checkBtn.textContent = "Check";
  }
});

// --- Send flow ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const base = (baseUrlInput.value || "").trim() || DEFAULT_URL;
  const userMsg = (msg.value || "").trim();
  if (!userMsg) return;

  addBubble(userMsg, "user");
  msg.value = "";
  sendBtn.disabled = true;

  try {
    const r = await fetchWithTimeout(
      `${base}/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMsg }),
      },
      20000 // 20s timeout for generation
    );

    if (!r.ok) {
      const raw = await r.text().catch(() => "");
      addError(`HTTP ${r.status} ${r.statusText}\n${raw}`);
      console.error("[ButtonBuddy] /generate failed:", r.status, raw);
      return;
    }

    const data = await r.json().catch(() => ({}));
    addBubble(data?.text || "(no response)", "bot");
  } catch (err) {
    if (err.name === "AbortError") {
      addError("Request timed out. Try again.");
    } else {
      addError("Error: Could not reach backend or it returned an error.");
    }
    console.error(err);
  } finally {
    sendBtn.disabled = false;
    msg.focus();
  }
});

// --- Enter to send (Shift+Enter = newline) ---
msg.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});