'use strict';

/* ═══════════════════════════════════════════
   SCHEMA — field types matching Postgres schema
═══════════════════════════════════════════ */
const FIELD_TYPES = {
  // bigserial / internal
  id:                              'id',
  created_at:                      'readonly',

  // text
  env:                             'text',
  bot_id:                          'text',
  llm_prompt_language_detector:    'text',
  llm_get_language:                'text',
  llm_get_response:                'text',
  db_vectorial_collection:         'text',
  embeddings_model_name:           'text',

  // text prompts (multiline but not JSON)
  prompt_system_message_ca:        'text',
  prompt_system_message_es:        'text',
  prompt_system_message_fr:        'text',
  prompt_system_message_en:        'text',

  // numeric
  language_confidence:             'numeric',
  llm_get_response_temperature:    'numeric',

  // integer
  tipus_resposta:                  'integer',
  qdrant_top_k:                    'integer',
  whatsapp_max_chars:              'integer',
  whatsapp_send_delay_seconds:     'integer',

  // jsonb
  language_rules:                  'json',
  llm_prompt_return_schema:        'json',
  json_structured_output_parser_0: 'json',
  json_structured_output_parser_1: 'json',
  json_structured_output_parser_2: 'json',
  user_prompt_templates_ca:        'json',
  user_prompt_templates_es:        'json',
  user_prompt_templates_fr:        'json',
  user_prompt_templates_en:        'json',
  whatsapp_labels_ca:              'json',
  whatsapp_labels_es:              'json',
  whatsapp_labels_fr:              'json',
  whatsapp_labels_en:              'json',
};


/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */
let records        = [];
let currentRecord  = null;
let cmEditors      = {};    // fieldName → CodeMirror instance
let cmInitialized  = false;


/* ═══════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════ */
const $ = id => document.getElementById(id);

const loginView    = $('loginView');
const editorView   = $('editorView');
const loginUser    = $('loginUser');
const loginPass    = $('loginPass');
const loginBtn     = $('loginBtn');
const loginErr     = $('loginErr');
const logoutBtn    = $('logoutBtn');
const reloadBtn    = $('reloadBtn');
const saveBtn      = $('saveBtn');
const whoami       = $('whoami');
const recordSelect = $('recordSelect');
const statusMsg    = $('statusMsg');


/* ═══════════════════════════════════════════
   API HELPERS
═══════════════════════════════════════════ */
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}


/* ═══════════════════════════════════════════
   CODEMIRROR — initialize once when editor is visible
═══════════════════════════════════════════ */
function initCodeMirrors() {
  if (cmInitialized) return;
  cmInitialized = true;

  document.querySelectorAll('textarea[data-json]').forEach(ta => {
    const field  = ta.dataset.field;
    const height = parseInt(ta.dataset.cmHeight || '160', 10);

    const cm = CodeMirror.fromTextArea(ta, {
      mode:        { name: 'javascript', json: true },
      theme:       'eclipse',
      lineNumbers: true,
      lineWrapping: false,
      tabSize:     2,
      indentWithTabs: false,
      autofocus:   false,
      extraKeys:   { 'Ctrl-Space': 'autocomplete' },
    });

    cm.setSize('100%', height);
    cm.getWrapperElement().style.marginTop = '5px';
    cmEditors[field] = cm;
  });
}

function refreshAllCM() {
  Object.values(cmEditors).forEach(cm => cm.refresh());
}


/* ═══════════════════════════════════════════
   AUTH — show / hide views
═══════════════════════════════════════════ */
function showEditor(user) {
  loginView.classList.add('hidden');
  editorView.classList.remove('hidden');
  whoami.textContent = `${user.username}  ·  ${user.role}`;

  // CodeMirror needs the element visible before init
  initCodeMirrors();
}

function showLogin() {
  editorView.classList.add('hidden');
  loginView.classList.remove('hidden');
}


/* ═══════════════════════════════════════════
   RECORDS — load & select
═══════════════════════════════════════════ */
async function loadConfigs() {
  setStatus('Carregant…', '');
  records = await api('/api/configs');

  // Populate dropdown
  recordSelect.innerHTML = '';
  records.forEach(r => {
    const opt = document.createElement('option');
    opt.value = String(r.id);
    opt.textContent = `#${r.id}  ·  ${r.env}  ·  ${r.bot_id}`;
    recordSelect.appendChild(opt);
  });

  if (records.length) {
    selectRecord(records[0]);
    recordSelect.value = String(records[0].id);
  }
  setStatus(`${records.length} registre${records.length !== 1 ? 's' : ''} carregat${records.length !== 1 ? 's' : ''}`, '');
}

function selectRecord(record) {
  currentRecord = record;
  populateForm(record);
}


/* ═══════════════════════════════════════════
   FORM — populate
═══════════════════════════════════════════ */
function populateForm(record) {
  Object.entries(record).forEach(([field, value]) => {
    const type = FIELD_TYPES[field];
    if (!type) return;

    if (type === 'json') {
      const cm = cmEditors[field];
      if (cm) {
        const pretty = JSON.stringify(value, null, 2);
        cm.setValue(pretty);
        cm.refresh();
      }
      return;
    }

    // Plain inputs / textareas
    const el = document.querySelector(`[data-field="${field}"]`);
    if (!el) return;

    if (type === 'readonly') {
      el.value = value ?? '';
    } else if (type === 'text') {
      el.value = value ?? '';
    } else if (type === 'numeric' || type === 'integer') {
      el.value = value ?? '';
    }
  });
}


/* ═══════════════════════════════════════════
   FORM — collect values for save
═══════════════════════════════════════════ */
function collectFormData() {
  const payload = {};

  Object.entries(FIELD_TYPES).forEach(([field, type]) => {
    if (type === 'id' || type === 'readonly') return;

    if (type === 'json') {
      const cm = cmEditors[field];
      if (!cm) return;
      try {
        payload[field] = JSON.parse(cm.getValue());
      } catch (e) {
        throw new Error(`JSON invàlid al camp "${field}": ${e.message}`);
      }
      return;
    }

    const el = document.querySelector(`[data-field="${field}"]`);
    if (!el) return;

    if (type === 'text') {
      payload[field] = el.value;
    } else if (type === 'integer') {
      payload[field] = parseInt(el.value, 10);
    } else if (type === 'numeric') {
      payload[field] = parseFloat(el.value);
    }
  });

  return payload;
}


/* ═══════════════════════════════════════════
   STATUS BAR
═══════════════════════════════════════════ */
function setStatus(msg, type = '') {
  statusMsg.textContent = msg;
  statusMsg.className = 'status-msg ' + type;
}


/* ═══════════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════════ */

// Login
loginBtn.addEventListener('click', async () => {
  loginErr.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Entrant…';
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        username: loginUser.value.trim(),
        password: loginPass.value,
      }),
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

// Enter key on login fields
[loginUser, loginPass].forEach(el => {
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginBtn.click();
  });
});

// Logout
logoutBtn.addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); } catch (_) {}
  showLogin();
  records = [];
  currentRecord = null;
});

// Reload
reloadBtn.addEventListener('click', async () => {
  try {
    await loadConfigs();
    // restore selected record
    if (currentRecord) {
      recordSelect.value = String(currentRecord.id);
      const updated = records.find(r => r.id === currentRecord.id);
      if (updated) selectRecord(updated);
    }
  } catch (err) {
    setStatus(err.message, 'error');
  }
});

// Record switch
recordSelect.addEventListener('change', () => {
  const id = parseInt(recordSelect.value, 10);
  const rec = records.find(r => r.id === id);
  if (rec) selectRecord(rec);
});

// Save
saveBtn.addEventListener('click', async () => {
  if (!currentRecord) return;
  setStatus('Desant…', '');
  saveBtn.disabled = true;
  try {
    const payload = collectFormData();
    await api(`/api/configs/${currentRecord.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    setStatus('✓  Desat correctament', 'ok');
    await loadConfigs();
    recordSelect.value = String(currentRecord.id);
  } catch (err) {
    setStatus('Error: ' + err.message, 'error');
  } finally {
    saveBtn.disabled = false;
  }
});


/* ═══════════════════════════════════════════
   INIT — check existing session on load
═══════════════════════════════════════════ */
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
