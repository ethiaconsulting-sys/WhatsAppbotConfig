const loginCard = document.getElementById("loginCard");
const editorCard = document.getElementById("editorCard");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const reloadBtn = document.getElementById("reloadBtn");
const saveBtn = document.getElementById("saveBtn");
const whoami = document.getElementById("whoami");
const recordSelect = document.getElementById("recordSelect");
const configForm = document.getElementById("configForm");
const statusEl = document.getElementById("status");

const jsonFields = new Set([
  "language_rules",
  "llm_prompt_return_schema",
  "json_structured_output_parser_0",
  "json_structured_output_parser_1",
  "json_structured_output_parser_2",
  "user_prompt_templates_ca",
  "user_prompt_templates_es",
  "user_prompt_templates_fr",
  "user_prompt_templates_en",
  "whatsapp_labels_ca",
  "whatsapp_labels_es",
  "whatsapp_labels_fr",
  "whatsapp_labels_en"
]);
const integerFields = new Set(["tipus_resposta", "qdrant_top_k", "whatsapp_max_chars", "whatsapp_send_delay_seconds"]);
const numericFields = new Set(["language_confidence", "llm_get_response_temperature"]);

let records = [];
let current = null;

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function setLoggedIn(user) {
  loginCard.classList.add("hidden");
  editorCard.classList.remove("hidden");
  whoami.textContent = `Usuari: ${user.username} (${user.role})`;
}

function setLoggedOut() {
  editorCard.classList.add("hidden");
  loginCard.classList.remove("hidden");
}

function renderRecordOptions() {
  recordSelect.innerHTML = "";
  for (const row of records) {
    const opt = document.createElement("option");
    opt.value = String(row.id);
    opt.textContent = `#${row.id} | ${row.env} | ${row.bot_id}`;
    recordSelect.appendChild(opt);
  }
  if (records.length) {
    recordSelect.value = String(records[0].id);
    current = records[0];
    renderForm();
  }
}

function renderForm() {
  configForm.innerHTML = "";
  if (!current) return;
  for (const [key, value] of Object.entries(current)) {
    const card = document.createElement("article");
    card.className = "form-field";
    const title = document.createElement("h4");
    title.textContent = key;
    card.appendChild(title);

    let input;
    if (key === "id" || key === "created_at") {
      input = document.createElement("input");
      input.type = "text";
      input.disabled = true;
      input.value = value ?? "";
    } else if (jsonFields.has(key)) {
      input = document.createElement("textarea");
      input.value = JSON.stringify(value, null, 2);
    } else if (integerFields.has(key)) {
      input = document.createElement("input");
      input.type = "number";
      input.step = "1";
      input.value = value;
    } else if (numericFields.has(key)) {
      input = document.createElement("input");
      input.type = "number";
      input.step = "any";
      input.value = value;
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.value = value ?? "";
    }

    input.dataset.field = key;
    input.addEventListener("change", onFieldChange);
    card.appendChild(input);
    configForm.appendChild(card);
  }
}

function onFieldChange(event) {
  if (!current) return;
  const field = event.target.dataset.field;
  if (!field || field === "id" || field === "created_at") return;

  try {
    if (jsonFields.has(field)) {
      current[field] = JSON.parse(event.target.value || "{}");
    } else if (integerFields.has(field)) {
      current[field] = Number.parseInt(event.target.value || "0", 10);
    } else if (numericFields.has(field)) {
      current[field] = Number(event.target.value || "0");
    } else {
      current[field] = event.target.value;
    }
    statusEl.textContent = "Canvi local aplicat";
  } catch (err) {
    statusEl.textContent = `Error al camp ${field}: ${err.message}`;
  }
}

async function loadConfigs() {
  const data = await api("/api/configs");
  records = data;
  renderRecordOptions();
  statusEl.textContent = `${records.length} registres carregats`;
}

loginBtn.addEventListener("click", async () => {
  loginError.textContent = "";
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
    });
    setLoggedIn(data.user);
    await loadConfigs();
  } catch (err) {
    loginError.textContent = err.message;
  }
});

logoutBtn.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  setLoggedOut();
});

reloadBtn.addEventListener("click", async () => {
  await loadConfigs();
});

recordSelect.addEventListener("change", () => {
  const id = Number.parseInt(recordSelect.value, 10);
  current = records.find((r) => r.id === id) || null;
  renderForm();
});

saveBtn.addEventListener("click", async () => {
  if (!current) return;
  const payload = { ...current };
  delete payload.id;
  delete payload.created_at;
  await api(`/api/configs/${current.id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
  statusEl.textContent = "Guardat correctament";
  await loadConfigs();
  recordSelect.value = String(current.id);
});

(async () => {
  try {
    const session = await api("/api/session");
    if (session.loggedIn) {
      setLoggedIn(session.user);
      await loadConfigs();
    } else {
      setLoggedOut();
    }
  } catch {
    setLoggedOut();
  }
})();
