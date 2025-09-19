// scripts/render-email.mjs  — plantilla compatible con clientes de email
import fs from "fs";

const RUN_URL = process.env.RUN_URL || "";
const REPO = process.env.REPO || "";
const BRANCH = process.env.BRANCH || "";
const STATUS = process.env.STATUS || "passed";
const COMMIT_SHA = (process.env.COMMIT_SHA || "").slice(0, 7);
const ACTOR = process.env.ACTOR || "";

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

const data = readJSON("playwright-results.json");

// ---- recorrer JSON de Playwright con seguridad
const tests = [];
function walk(node) {
  if (!node) return;
  if (Array.isArray(node.suites)) node.suites.forEach(walk);
  if (Array.isArray(node.specs)) {
    for (const spec of node.specs) {
      for (const t of (spec.tests || [])) {
        const results = Array.isArray(t.results) ? t.results : [];
        const statuses = results.map(r => r.status);
        const anyFailed = statuses.includes("failed");
        const anyPassed = statuses.includes("passed");
        const allSkipped = results.length > 0 && results.every(r => r.status === "skipped");
        const r0 = results.find(r => r.status === "failed") || results[0] || {};
        const err = r0?.error || {};
        const errorMsg = [err.message, r0?.error?.snippet, r0?.error?.value]
          .filter(Boolean).join(" ").trim();

        tests.push({
          title: t.title || spec.title || "Test",
          project: t.projectName || t.project || "default",
          file: spec.file || "",
          anyFailed, anyPassed, allSkipped,
          duration: typeof r0?.duration === "number" ? r0.duration : undefined,
          errorMsg
        });
      }
    }
  }
}
if (data?.suites) data.suites.forEach(walk);

const passed = tests.filter(t => t.anyPassed && !t.anyFailed).length;
const failed = tests.filter(t => t.anyFailed).length;
const skipped = tests.filter(t => t.allSkipped).length;
const total = tests.length;
const failures = tests.filter(t => t.anyFailed).slice(0, 8);

const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pillBg = STATUS === "failed" ? "#ef4444" : "#10b981"; // rojo/verde

// --- Todo con tablas y estilos inline (compatibilidad máxima)
const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f7f9;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f7f9;">
    <tr><td align="center" style="padding:24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
            <table role="presentation" width="100%"><tr>
              <td align="left" style="font-size:16px;font-weight:800;color:#111827;">
                Digital-Dealer • Playwright
                <div style="font-size:12px;color:#6b7280;font-weight:400;margin-top:2px;">
                  ${esc(REPO)}@${esc(BRANCH)} • ${esc(COMMIT_SHA)} • by ${esc(ACTOR)}
                </div>
              </td>
              <td align="right">
                <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${pillBg};color:#ffffff;font-size:12px;font-weight:700;">
                  ${STATUS === "failed" ? "FAILED" : "PASSED"}
                </span>
              </td>
            </tr></table>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 24px;">
            <!-- Métricas -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="width:33.33%;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
                  <div style="font-size:22px;font-weight:700;color:#111827;line-height:1;">${total}</div>
                  <div style="font-size:12px;color:#6b7280;">Total</div>
                </td>
                <td style="width:12px;"></td>
                <td align="center" style="width:33.33%;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
                  <div style="font-size:22px;font-weight:700;color:#111827;line-height:1;">${passed}</div>
                  <div style="font-size:12px;color:#6b7280;">Pasados</div>
                </td>
                <td style="width:12px;"></td>
                <td align="center" style="width:33.33%;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
                  <div style="font-size:22px;font-weight:700;color:#111827;line-height:1;">${failed}</div>
                  <div style="font-size:12px;color:#6b7280;">Fallados</div>
                </td>
              </tr>
            </table>
            <div style="font-size:12px;color:#6b7280;margin-top:8px;">Omitidos: ${skipped}</div>

            <!-- Botón -->
            <div style="margin:18px 0 12px 0;">
              <a href="${esc(RUN_URL)}" 
                 style="background:#111827;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700;display:inline-block;">
                 Ver run y descargar reporte
              </a>
            </div>

            ${failures.length ? `<div style="font-size:16px;font-weight:700;margin:16px 0 6px 0;color:#111827;">
              ❌ Fallos (${failures.length}${failed>failures.length?` de ${failed}`:""})
            </div>` : ""}

            ${failures.map(f => `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" 
                     style="border-left:4px solid #ef4444;padding-left:12px;margin:8px 0;">
                <tr><td>
                  <div style="font-weight:700;color:#111827;">${esc(f.title)} <span style="color:#6b7280;font-weight:400;">• ${esc(f.project)}</span></div>
                  ${f.file ? `<div style="color:#6b7280;font-size:12px;">${esc(f.file)}</div>` : ""}
                  ${f.duration ? `<div style="color:#6b7280;font-size:12px;">Duración: ${(f.duration/1000).toFixed(2)}s</div>` : ""}
                  ${f.errorMsg ? `<div style="font-family:Consolas,Menlo,monospace;font-size:12px;color:#111827;white-space:pre-wrap;margin-top:4px;">
                    ${esc(f.errorMsg).slice(0,400)}${f.errorMsg.length>400?"…":""}
                  </div>` : ""}
                </td></tr>
              </table>
            `).join("")}
          </td>
        </tr>

        <tr>
          <td style="padding:12px 24px;border-top:1px solid #e5e7eb;">
            <div style="font-size:12px;color:#6b7280;">
              Reporte generado automáticamente. Enlace al run: 
              <a href="${esc(RUN_URL)}" style="color:#2563eb;text-decoration:underline;">${esc(RUN_URL)}</a>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

fs.writeFileSync("email.html", html, "utf8");
console.log("Pretty inline email written to email.html");
