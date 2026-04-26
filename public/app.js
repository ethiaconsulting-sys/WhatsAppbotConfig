'use strict';

const TEXT_FIELDS = [
  'env',
  'bot_id',
  'llm_prompt_language_detector',
  'prompt_system_message_ca',
  'prompt_system_message_es',
  'prompt_system_message_fr',
  'prompt_system_message_en',
  'llm_get_language',
  'llm_get_response',
  'db_vectorial_collection',
  'embeddings_model_name',
  'twilio_url',
  'groq_url',
  'mistral_url',
  'huggingface_url',
  'supabase_url',
  'qdrant_url',
  'mistral_embeddings_url',
  'audio_model_name',
  'image_model_name',
  'llm_model_name',
  'guardrail_classifier_model',
  'guardrail_blocked_ca',
  'guardrail_blocked_es',
  'guardrail_blocked_en',
  'guardrail_blocked_fr',
  'guardrail_greeting_ca',
  'guardrail_greeting_es',
  'guardrail_greeting_en',
  'guardrail_greeting_fr',
  'no_authorized_usr_ca',
  'no_authorized_usr_es',
  'no_authorized_usr_en',
  'no_authorized_usr_fr',
  'workflow_default_language',
  'reset_keywords'
];

const NUMERIC_FIELDS = [
  'language_confidence',
  'llm_get_response_temperature'
];

const INTEGER_FIELDS = [
  'tipus_resposta',
  'qdrant_top_k',
  'whatsapp_max_chars',
  'whatsapp_send_delay_seconds',
  'guardrail_max_input_chars',
  'conversation_window',
  'conversation_max_age_hours'
];

const JSON_FIELDS = [
  'language_rules',
  'llm_prompt_return_schema',
  'json_structured_output_parser_0',
  'json_structured_output_parser_1',
  'json_structured_output_parser_2',
  'user_prompt_templates_ca',
  'user_prompt_templates_es',
  'user_prompt_templates_fr',
  'user_prompt_templates_en',
  'whatsapp_labels_ca',
  'whatsapp_labels_es',
  'whatsapp_labels_fr',
  'whatsapp_labels_en',
  'guardrail_injection_ca',
  'guardrail_injection_es',
  'guardrail_injection_en',
  'guardrail_injection_fr',
  'guardrail_abuse_ca',
  'guardrail_abuse_es',
  'guardrail_abuse_en',
  'guardrail_abuse_fr'
];

const NULLABLE_FIELDS = new Set([
  ...TEXT_FIELDS.filter(field => !['env', 'bot_id'].includes(field)),
  ...JSON_FIELDS,
  'guardrail_max_input_chars',
  'conversation_window',
  'conversation_max_age_hours'
]);

const FIELD_TYPES = {
  id: 'id',
  created_at: 'readonly'
};

TEXT_FIELDS.forEach(field => { FIELD_TYPES[field] = 'text'; });
NUMERIC_FIELDS.forEach(field => { FIELD_TYPES[field] = 'numeric'; });
INTEGER_FIELDS.forEach(field => { FIELD_TYPES[field] = 'integer'; });
JSON_FIELDS.forEach(field => { FIELD_TYPES[field] = 'json'; });

let records = [];
let currentRecord = null;
let cmEditors = {};
let cmInitialized = false;
let initialPayload = null;
let initialPayloadKey = '';
let hasDirtyChanges = false;
let isPopulating = false;

const $ = id => document.getElementById(id);

const loginView = $('loginView');
const editorView = $('editorView');
const loginUser = $('loginUser');
const loginPass = $('loginPass');
const loginBtn = $('loginBtn');
const loginErr = $('loginErr');
const logoutBtn = $('logoutBtn');
const reloadBtn = $('reloadBtn');
const saveBtn = $('saveBtn');
const whoami = $('whoami');
const recordSelect = $('recordSelect');
const statusMsg = $('statusMsg');
const dirtyBadge = $('dirtyBadge');
const rawJson = $('rawJson');
const changesList = $('changesList');
const whatsappPreview = $('whatsappPreview');

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortValue(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function formatJsonValue(value) {
  if (value == null) return '';
  return JSON.stringify(value, null, 2);
}

function initCodeMirrors() {
  if (cmInitialized) return;
  cmInitialized = true;

  document.querySelectorAll('textarea[data-json]').forEach(textarea => {
    const field = textarea.dataset.field;
    const height = Number.parseInt(textarea.dataset.cmHeight || '170', 10);

    const cm = CodeMirror.fromTextArea(textarea, {
      mode: { name: 'javascript', json: true },
      theme: 'eclipse',
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
      indentWithTabs: false
    });

    cm.setSize('100%', height);
    cm.on('change', () => {
      if (!isPopulating) updateDirtyState();
    });
    cmEditors[field] = cm;
  });
}

function refreshAllCM() {
  Object.values(cmEditors).forEach(cm => cm.refresh());
}

function showEditor(user) {
  loginView.classList.add('hidden');
  editorView.classList.remove('hidden');
  whoami.textContent = `${user.username} - ${user.role}`;
  initCodeMirrors();
  window.setTimeout(refreshAllCM, 0);
}

function showLogin() {
  editorView.classList.add('hidden');
  loginView.classList.remove('hidden');
}

function setStatus(message, type = '') {
  statusMsg.textContent = message;
  statusMsg.className = `status-msg ${type}`.trim();
}

function setDirtyState(dirty, invalidMessage = '') {
  hasDirtyChanges = dirty;
  saveBtn.disabled = Boolean(invalidMessage) || !dirty;

  if (invalidMessage) {
    dirtyBadge.textContent = 'JSON invalid';
    dirtyBadge.className = 'state-chip error';
    setStatus(invalidMessage, 'error');
    return;
  }

  dirtyBadge.textContent = dirty ? 'Canvis pendents' : 'Sense canvis';
  dirtyBadge.className = dirty ? 'state-chip warning' : 'state-chip';
}

function readJsonField(field) {
  const cm = cmEditors[field];
  const raw = cm ? cm.getValue() : (document.querySelector(`[data-field="${field}"]`)?.value || '');
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`JSON invalid a ${field}: ${err.message}`);
  }
}

function readScalarField(field, type) {
  const el = document.querySelector(`[data-field="${field}"]`);
  if (!el) return null;
  const raw = el.value;

  if (type === 'text') {
    if (!raw && NULLABLE_FIELDS.has(field)) return null;
    return raw;
  }

  if (!raw) {
    if (NULLABLE_FIELDS.has(field)) return null;
    throw new Error(`Falta valor numeric a ${field}`);
  }

  if (type === 'integer') {
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) throw new Error(`Enter invalid a ${field}`);
    return n;
  }

  const n = Number(raw);
  if (Number.isNaN(n)) throw new Error(`Numero invalid a ${field}`);
  return n;
}

function collectFormData() {
  const payload = {};

  Object.entries(FIELD_TYPES).forEach(([field, type]) => {
    if (type === 'id' || type === 'readonly') return;
    payload[field] = type === 'json' ? readJsonField(field) : readScalarField(field, type);
  });

  return payload;
}

function populateForm(record) {
  isPopulating = true;

  Object.entries(FIELD_TYPES).forEach(([field, type]) => {
    const value = record[field];

    if (type === 'json') {
      const cm = cmEditors[field];
      if (cm) cm.setValue(formatJsonValue(value));
      return;
    }

    const el = document.querySelector(`[data-field="${field}"]`);
    if (!el) return;
    el.value = value ?? '';
  });

  isPopulating = false;
  initialPayload = collectFormData();
  initialPayloadKey = stableStringify(initialPayload);
  updateDirtyState();
  window.setTimeout(refreshAllCM, 0);
}

function selectRecord(record) {
  currentRecord = record;
  populateForm(record);
}

async function loadConfigs(preferredId = null) {
  setStatus('Carregant...', '');
  const keepId = preferredId || currentRecord?.id || null;
  records = await api('/api/configs');

  recordSelect.innerHTML = '';
  records.forEach(record => {
    const option = document.createElement('option');
    option.value = String(record.id);
    option.textContent = `#${record.id} - ${record.env} - ${record.bot_id}`;
    recordSelect.appendChild(option);
  });

  const next = records.find(record => record.id === keepId) || records[0] || null;
  if (next) {
    recordSelect.value = String(next.id);
    selectRecord(next);
  } else {
    currentRecord = null;
    initialPayload = null;
    initialPayloadKey = '';
    setDirtyState(false);
  }

  const suffix = records.length === 1 ? '' : 's';
  setStatus(`${records.length} registre${suffix} carregat${suffix}`, 'ok');
}

function updateDirtyState() {
  if (!currentRecord || isPopulating) return;

  try {
    const payload = collectFormData();
    const payloadKey = stableStringify(payload);
    const dirty = payloadKey !== initialPayloadKey;
    setDirtyState(dirty);
    renderAdvanced(payload);
    renderWhatsappPreview(payload);
  } catch (err) {
    setDirtyState(true, err.message);
  }
}

function renderAdvanced(payload = null) {
  if (!rawJson || !changesList || !currentRecord) return;

  const currentPayload = payload || collectFormData();
  const merged = { ...currentRecord, ...currentPayload };
  rawJson.value = JSON.stringify(merged, null, 2);

  changesList.innerHTML = '';
  if (!initialPayload) return;

  const changedFields = Object.keys(currentPayload).filter(field => {
    return stableStringify(currentPayload[field]) !== stableStringify(initialPayload[field]);
  });

  if (!changedFields.length) {
    const li = document.createElement('li');
    li.textContent = 'Sense canvis pendents';
    changesList.appendChild(li);
    return;
  }

  changedFields.forEach(field => {
    const li = document.createElement('li');
    li.textContent = field;
    changesList.appendChild(li);
  });
}

function renderWhatsappPreview(payload = null) {
  if (!whatsappPreview) return;

  const data = payload || collectFormData();
  const lang = data.workflow_default_language || 'ca';
  const labels = data[`whatsapp_labels_${lang}`] || {};
  const answerHeader = labels.answerHeader || labels.answer_header || 'Resposta';
  const sourcesHeader = labels.sourcesHeader || labels.sources_header || 'Fonts';
  const medicineLabel = labels.nombre_medicamento || 'Medicament';
  const urlLabel = labels.url_descarga_ficha_tecnica || 'Fitxa tecnica';

  whatsappPreview.textContent = [
    answerHeader,
    'Text de resposta del model...',
    '',
    sourcesHeader,
    `${medicineLabel}: Exemple`,
    `${urlLabel}: https://example.com/fitxa.pdf`
  ].join('\n');
}

function initSectionNav() {
  document.querySelectorAll('[data-section]').forEach(button => {
    button.addEventListener('click', () => {
      const section = button.dataset.section;
      document.querySelectorAll('[data-section]').forEach(item => {
        item.classList.toggle('active', item === button);
      });
      document.querySelectorAll('[data-section-panel]').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.sectionPanel === section);
      });
      window.setTimeout(refreshAllCM, 0);
    });
  });
}

function initTabs() {
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const group = button.closest('[data-tab-group]')?.dataset.tabGroup;
      const tab = button.dataset.tab;
      if (!group || !tab) return;

      document.querySelectorAll(`[data-tab-group="${group}"] .tab-button`).forEach(item => {
        item.classList.toggle('active', item === button);
      });
      document.querySelectorAll(`[data-tab-panel="${group}"]`).forEach(panel => {
        panel.classList.toggle('active', panel.dataset.tab === tab);
      });
      window.setTimeout(refreshAllCM, 0);
    });
  });
}

function initFormListeners() {
  document.querySelectorAll('[data-field]:not([data-json])').forEach(el => {
    el.addEventListener('input', updateDirtyState);
    el.addEventListener('change', updateDirtyState);
  });
}

loginBtn.addEventListener('click', async () => {
  loginErr.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Entrant...';
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        username: loginUser.value.trim(),
        password: loginPass.value
      })
    });
    showEditor(data.user);
    await loadConfigs();
  } catch (err) {
    loginErr.textContent = err.message;
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Entrar';
  }
});

[loginUser, loginPass].forEach(el => {
  el.addEventListener('keydown', event => {
    if (event.key === 'Enter') loginBtn.click();
  });
});

logoutBtn.addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch (_) {
    // Ignore logout failures; the local UI still returns to login.
  }
  records = [];
  currentRecord = null;
  initialPayload = null;
  initialPayloadKey = '';
  showLogin();
});

reloadBtn.addEventListener('click', async () => {
  if (hasDirtyChanges && !window.confirm('Hi ha canvis pendents. Vols recarregar igualment?')) return;
  try {
    await loadConfigs(currentRecord?.id || null);
  } catch (err) {
    setStatus(err.message, 'error');
  }
});

recordSelect.addEventListener('change', () => {
  const selectedId = Number.parseInt(recordSelect.value, 10);
  const next = records.find(record => record.id === selectedId);
  if (!next) return;

  if (hasDirtyChanges && !window.confirm('Hi ha canvis pendents. Vols canviar de registre?')) {
    recordSelect.value = String(currentRecord.id);
    return;
  }

  selectRecord(next);
});

saveBtn.addEventListener('click', async () => {
  if (!currentRecord) return;

  setStatus('Desant...', '');
  saveBtn.disabled = true;

  try {
    const payload = collectFormData();
    await api(`/api/configs/${currentRecord.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    setStatus('Desat correctament', 'ok');
    await loadConfigs(currentRecord.id);
  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error');
    saveBtn.disabled = false;
  }
});

initSectionNav();
initTabs();
initFormListeners();
setDirtyState(false);

(async () => {
  try {
    const session = await api('/api/session');
    if (session.loggedIn) {
      showEditor(session.user);
      await loadConfigs();
    } else {
      showLogin();
    }
  } catch (_) {
    showLogin();
  }
})();
