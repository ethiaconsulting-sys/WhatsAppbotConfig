import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import dotenv from "dotenv";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);
const cookieName = process.env.SESSION_COOKIE_NAME || "workflow_session";

function normalizeDatabaseUrl(connectionString) {
  const [base, query = ""] = connectionString.split("?", 2);
  if (!query) return base;

  const filteredQuery = query
    .split("&")
    .filter(Boolean)
    // node-postgres lets ssl params in the URL override the explicit ssl config object.
    .filter((part) => {
      const [rawKey = ""] = part.split("=", 1);
      const key = rawKey.toLowerCase();
      return !["sslmode", "sslcert", "sslkey", "sslrootcert"].includes(key);
    })
    .join("&");

  return filteredQuery ? `${base}?${filteredQuery}` : base;
}

function createPoolConfig() {
  const common = { ssl: { rejectUnauthorized: false } };

  if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD) {
    return {
      ...common,
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || "postgres",
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD
    };
  }

  if (process.env.DATABASE_URL) {
    return {
      ...common,
      connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL)
    };
  }

  throw new Error("Missing DATABASE_URL or PGHOST/PGUSER/PGPASSWORD in environment");
}

const pool = new Pool(createPoolConfig());

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
  "whatsapp_labels_en",
  "guardrail_injection_ca",
  "guardrail_injection_es",
  "guardrail_injection_en",
  "guardrail_injection_fr",
  "guardrail_abuse_ca",
  "guardrail_abuse_es",
  "guardrail_abuse_en",
  "guardrail_abuse_fr"
]);

const numericFields = new Set(["language_confidence", "llm_get_response_temperature"]);
const integerFields = new Set([
  "tipus_resposta",
  "qdrant_top_k",
  "whatsapp_max_chars",
  "whatsapp_send_delay_seconds",
  "guardrail_max_input_chars",
  "conversation_window",
  "conversation_max_age_hours"
]);

const nullableFields = new Set([
  "language_rules",
  "llm_prompt_language_detector",
  "llm_prompt_return_schema",
  "json_structured_output_parser_0",
  "json_structured_output_parser_1",
  "json_structured_output_parser_2",
  "prompt_system_message_ca",
  "prompt_system_message_es",
  "prompt_system_message_fr",
  "prompt_system_message_en",
  "user_prompt_templates_ca",
  "user_prompt_templates_es",
  "user_prompt_templates_fr",
  "user_prompt_templates_en",
  "llm_get_language",
  "llm_get_response",
  "db_vectorial_collection",
  "embeddings_model_name",
  "whatsapp_labels_ca",
  "whatsapp_labels_es",
  "whatsapp_labels_fr",
  "whatsapp_labels_en",
  "twilio_url",
  "groq_url",
  "mistral_url",
  "huggingface_url",
  "supabase_url",
  "qdrant_url",
  "mistral_embeddings_url",
  "audio_model_name",
  "image_model_name",
  "llm_model_name",
  "guardrail_classifier_model",
  "guardrail_max_input_chars",
  "guardrail_blocked_ca",
  "guardrail_blocked_es",
  "guardrail_blocked_en",
  "guardrail_blocked_fr",
  "guardrail_greeting_ca",
  "guardrail_greeting_es",
  "guardrail_greeting_en",
  "guardrail_greeting_fr",
  "guardrail_injection_ca",
  "guardrail_injection_es",
  "guardrail_injection_en",
  "guardrail_injection_fr",
  "guardrail_abuse_ca",
  "guardrail_abuse_es",
  "guardrail_abuse_en",
  "guardrail_abuse_fr",
  "no_authorized_usr_ca",
  "no_authorized_usr_es",
  "no_authorized_usr_en",
  "no_authorized_usr_fr",
  "workflow_default_language",
  "conversation_window",
  "conversation_max_age_hours",
  "reset_keywords"
]);

const editableColumns = [
  "env",
  "bot_id",
  "language_rules",
  "language_confidence",
  "llm_prompt_language_detector",
  "llm_prompt_return_schema",
  "tipus_resposta",
  "json_structured_output_parser_0",
  "json_structured_output_parser_1",
  "json_structured_output_parser_2",
  "prompt_system_message_ca",
  "prompt_system_message_es",
  "prompt_system_message_fr",
  "prompt_system_message_en",
  "user_prompt_templates_ca",
  "user_prompt_templates_es",
  "user_prompt_templates_fr",
  "user_prompt_templates_en",
  "llm_get_language",
  "llm_get_response",
  "llm_get_response_temperature",
  "db_vectorial_collection",
  "qdrant_top_k",
  "embeddings_model_name",
  "whatsapp_max_chars",
  "whatsapp_send_delay_seconds",
  "whatsapp_labels_ca",
  "whatsapp_labels_es",
  "whatsapp_labels_fr",
  "whatsapp_labels_en",
  "twilio_url",
  "groq_url",
  "mistral_url",
  "huggingface_url",
  "supabase_url",
  "qdrant_url",
  "mistral_embeddings_url",
  "audio_model_name",
  "image_model_name",
  "llm_model_name",
  "guardrail_classifier_model",
  "guardrail_max_input_chars",
  "guardrail_blocked_ca",
  "guardrail_blocked_es",
  "guardrail_blocked_en",
  "guardrail_blocked_fr",
  "guardrail_greeting_ca",
  "guardrail_greeting_es",
  "guardrail_greeting_en",
  "guardrail_greeting_fr",
  "guardrail_injection_ca",
  "guardrail_injection_es",
  "guardrail_injection_en",
  "guardrail_injection_fr",
  "guardrail_abuse_ca",
  "guardrail_abuse_es",
  "guardrail_abuse_en",
  "guardrail_abuse_fr",
  "no_authorized_usr_ca",
  "no_authorized_usr_es",
  "no_authorized_usr_en",
  "no_authorized_usr_fr",
  "workflow_default_language",
  "conversation_window",
  "conversation_max_age_hours",
  "reset_keywords"
];

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

function parseEditableRow(input) {
  const row = {};
  for (const col of editableColumns) {
    if (!(col in input)) {
      throw new Error(`Missing field: ${col}`);
    }
    const value = input[col];
    if (jsonFields.has(col)) {
      if (value === "" || value == null) {
        if (!nullableFields.has(col)) {
          throw new Error(`Missing JSON value for ${col}`);
        }
        row[col] = null;
      } else {
        const parsedJson = typeof value === "string" ? JSON.parse(value) : value;
        const serializedJson = JSON.stringify(parsedJson);
        if (serializedJson === undefined) {
          throw new Error(`Invalid JSON value for ${col}`);
        }
        row[col] = serializedJson;
      }
    } else if (numericFields.has(col)) {
      if (value === "" || value == null) {
        if (nullableFields.has(col)) {
          row[col] = null;
          continue;
        }
        throw new Error(`Missing numeric value for ${col}`);
      }
      const n = Number(value);
      if (Number.isNaN(n)) throw new Error(`Invalid numeric value for ${col}`);
      row[col] = n;
    } else if (integerFields.has(col)) {
      if (value === "" || value == null) {
        if (nullableFields.has(col)) {
          row[col] = null;
          continue;
        }
        throw new Error(`Missing integer value for ${col}`);
      }
      const n = Number.parseInt(String(value), 10);
      if (Number.isNaN(n)) throw new Error(`Invalid integer value for ${col}`);
      row[col] = n;
    } else {
      row[col] = (value === "" || value == null) && nullableFields.has(col) ? null : String(value);
    }
  }
  return row;
}

async function getSession(token) {
  if (!token) return null;
  const result = await pool.query(
    "select * from app_security.is_session_valid($1::uuid)",
    [token]
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  if (!row.ok) return null;
  return row;
}

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies[cookieName];
    const session = await getSession(token);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    req.session = session;
    req.sessionToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

app.post("/api/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await pool.query("select * from app_security.login($1, $2)", [username, password]);
    const row = result.rows[0];
    if (!row?.ok) return res.status(401).json({ error: "Invalid credentials" });

    res.cookie(cookieName, row.session_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 12 * 60 * 60 * 1000
    });

    return res.json({ user: { id: row.user_id, username: row.username, role: row.role } });
  } catch (err) {
    next(err);
  }
});

app.post("/api/logout", async (req, res, next) => {
  try {
    const token = req.cookies[cookieName];
    if (token) {
      await pool.query("select app_security.logout($1::uuid)", [token]);
    }
    res.clearCookie(cookieName);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get("/api/session", async (req, res, next) => {
  try {
    const session = await getSession(req.cookies[cookieName]);
    if (!session) return res.json({ loggedIn: false });
    return res.json({ loggedIn: true, user: { id: session.user_id, username: session.username, role: session.role } });
  } catch (err) {
    next(err);
  }
});

app.get("/api/configs", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query("select * from public.workflow_config order by id");
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.put("/api/configs/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const row = parseEditableRow(req.body || {});
    const values = editableColumns.map((c) => row[c]);

    const setSql = editableColumns
      .map((c, i) => {
        if (jsonFields.has(c)) return `${c} = $${i + 1}::jsonb`;
        if (numericFields.has(c)) return `${c} = $${i + 1}::numeric`;
        if (integerFields.has(c)) return `${c} = $${i + 1}::integer`;
        return `${c} = $${i + 1}`;
      })
      .join(",\n  ");

    await pool.query(
      `update public.workflow_config\nset\n  ${setSql}\nwhere id = $${editableColumns.length + 1}::bigint`,
      [...values, id]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
