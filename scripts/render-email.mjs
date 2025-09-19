// scripts/render-email.mjs
import fs from "fs";

const RUN_URL = process.env.RUN_URL || "";
const REPO = process.env.REPO || "";
const BRANCH = process.env.BRANCH || "";
const STATUS = process.env.STATUS || "passed";
const COMMIT_SHA = (process.env.COMMIT_SHA || "").slice(0, 7);
const ACTOR = process.env.ACTOR || "";

function readJSON(path) {
  try { return JSON.parse(fs.readFileSync(path, "utf8")); }
  catch { return null; }
}

const data = readJSON("playwright-results.json");

// --- Parse Playwright JSON (robusto ante cambios) ---
const tests = [];
function walk(node) {
  if (!node) return;
  if (Array.isArray(node.suites)) node.suites.forEach(walk);
  if (Array.isArray(node.specs)) {
    for (const spec of node.specs) {
      if (!Array.isArray(spec.tests)) continue;
      for (const t of spec.tests) {
        const results = Array.isArray(t.results) ? t.results : [];
        const statuses = results.map(r => r.status);
        const anyFailed = statuses.includes("failed");
        const anyPassed = statuses.includes("passed");
        const allSkipped = results.length > 0 && results.every(r => r.status === "skipped");

        // detalles del primer resultado fallido o, si no, del primero
        const r0 = results.find(r => r.status === "failed") || results[0] || {};
        const err = r0.error || {};
        const errorMsg = [err.message, r0.error?.snippet, r0.error?.value]
          .filter(Boolean).join(" ").trim();

        tests.push({
          title: t.title || spec.title || "Test",
          project: t.projectName || t.project || "default",
          file: spec.file || "",
          anyFailed, anyPassed, allSkipped,
          duration: typeof r0.duration === "number" ? r0.duration : undefined,
          errorMsg
        });
      }
    }
  }
}
if (data && Array.isArray(data.suites)) data.suites.forEach(walk);

// Métricas
const passed = tests.filter(t => t.anyPassed && !t.anyFailed).length;
const failed = tests.filter(t => t.anyFailed).length;
const skipped = tests.filter(t => t.allSkipped).length;
const total = tests.length || 0;

// Top fallos (máx 8)
const failures = tests.filter(t => t.anyFailed).slice(0, 8);

// Helpers
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => (
  { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]
));
const statusColor = STATUS === "failed" ? "#ef4444" : "#10b981"; // rojo/verde

// HTML inline-friendly (clientes de correo)
const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>Resultados Playwright</title>
    <style>
      .container{max-width:680px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,'Helvetica Neue',Arial,sans-serif;background:#0b0b0b0a;padding:24px}
      .card{background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb}
      @media (prefers-color-scheme: dark){
        .container{background:#0b0b0b;padding:24px}
        .card{background:#111827;border-color:#1f2937;color:#e5e7eb}
        .muted{color:#9ca3af}
        .pill{color:#111827}
      }
      .header{display:flex;justify-content:space-between;align-items:center}
      .brand{font-weight:800;letter-spacing:.3px}
      .pill{display:inline-block;padding:4px 10px;border-radius:999px;background:${statusColor};color:#fff;font-weight:700;font-size:12px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}
      .metric{border-radius:10px;border:1px solid #e5e7eb;padding:14px;text-align:center}
      .metric h3{margin:0;font-size:22px}
      .metric p{margin:4px 0 0 0;font-size:12px}
      .btn{display:inline-block;text-decoration:none;background:#111827;color:#fff;padding:12px 16px;border-radius:10px;font-weight:700}
      .btn:link,.btn:visited{color:#fff}
      .muted{font-size:12px;color:#6b7280}
      .fail{border-left:4px solid #ef4444;padding-left:12px;margin:10px 0}
      .fail .title{font-weight:700;margin:0 0 4px 0}
      .code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;white-space:pre-wrap}
      .footer{margin-top:16px;font-size:12px;color:#6b7280}
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <div class="header">
          <div>
            <div class="brand">Digital-Dealer • Playwright</div>
            <div class="muted">${esc(REPO)}@${esc(BRANCH)} • ${esc(COMMIT_SHA)} • by ${esc(ACTOR)}</div>
          </div>
          <span class="pill">${STATUS === "failed" ? "FAILED" : "PASSED"}</span>
        </div>

        <div class="grid">
          <div class="metric">
            <h3>${total}</h3><p>Total</p>
          </div>
          <div class="metric">
            <h3>${passed}</h3><p>Pasados</p>
          </div>
          <div class="metric">
            <h3>${failed}</h3><p>Fallados</p>
          </div>
        </div>

        <p class="muted" style="margin-top:8px;">Omitidos: ${skipped}</p>

        <div style="margin:18px 0 12px 0;">
          <a href="${esc(RUN_URL)}" class="btn">Ver run y descargar reporte</a>
        </div>

        ${failures.length ? `<h3 style="margin:18px 0 8px 0;">❌ Fallos (${failures.length}${failed>failures.length?` de ${failed}`:""})</h3>` : ""}
        ${failures.map(f => `
          <div class="fail">
            <p class="title">${esc(f.title)} <span class="muted">• ${esc(f.project)}</span></p>
            ${f.file ? `<p class="muted">${esc(f.file)}</p>` : ""}
            ${f.duration ? `<p class="muted">Duración: ${(f.duration/1000).toFixed(2)}s</p>` : ""}
            ${f.errorMsg ? `<div class="code">${esc(f.errorMsg).slice(0,400)}${f.errorMsg.length>400?"…":""}</div>` : ""}
          </div>
        `).join("")}

        <div class="footer">
          Reporte generado automáticamente. Enlace al run: <a href="${esc(RUN_URL)}">${esc(RUN_URL)}</a>
        </div>
      </div>
    </div>
  </body>
</html>`;

fs.writeFileSync("email.html", html, "utf8");
console.log("Pretty email written to email.html");
