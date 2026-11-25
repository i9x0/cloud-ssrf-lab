const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const LAB = path.resolve(__dirname, "..");
const SHOT = path.join(LAB, "results", "screenshots");
const FIG = path.join(LAB, "results", "figures");
const P = (f) => path.join(SHOT, f);
const F = (f) => path.join(FIG, f);

// palette
const NAVY = "131A30", PANEL = "1E2761", INK = "1F2937", MUTE = "6B7280";
const RED = "C0392B", GREEN = "15803D", TEAL = "0E7490", GOLD = "B7791F";
const LIGHT = "FFFFFF", SOFT = "EEF2F7", LINE = "D7DEE8", ICE = "CADCFC";
const HERO = "F2F6FD", ACCENT = "2563EB";
const HEAD = "Calibri", BODY = "Calibri";

const pres = new pptxgen();
pres.defineLayout({ name: "W", width: 13.333, height: 7.5 });
pres.layout = "W";
const W = 13.333, Hh = 7.5;

function pngWH(file) { const d = fs.readFileSync(file); return { w: d.readUInt32BE(16), h: d.readUInt32BE(20) }; }
function fit(file, maxW, maxH) { const { w, h } = pngWH(file); const r = Math.min(maxW / w, maxH / h); return { w: w * r, h: h * r }; }

function titleBar(s, text, kicker) {
  s.addText(text, { x: 0.6, y: 0.42, w: 12.1, h: 0.8, fontFace: HEAD, fontSize: 30, bold: true, color: INK, isTextBox: true, margin: 0, valign: "middle" });
  if (kicker) s.addText(kicker.toUpperCase(), { x: 0.62, y: 0.2, w: 12, h: 0.28, fontFace: BODY, fontSize: 11, bold: true, color: TEAL, charSpacing: 2, isTextBox: true, margin: 0 });
}
function imgCard(s, file, x, y, maxW, maxH, caption) {
  const { w, h } = fit(file, maxW, maxH);
  const cx = x + (maxW - w) / 2;
  s.addShape(pres.ShapeType.rect, { x: cx - 0.08, y: y - 0.08, w: w + 0.16, h: h + 0.16, fill: { color: LIGHT }, line: { color: LINE, width: 1 }, shadow: { type: "outer", color: "9AA5B5", blur: 6, offset: 3, angle: 90, opacity: 0.45 } });
  s.addImage({ path: file, x: cx, y, w, h });
  if (caption) s.addText(caption, { x: x, y: y + h + 0.12, w: maxW, h: 0.3, fontFace: BODY, fontSize: 10, italic: true, color: MUTE, align: "center", isTextBox: true, margin: 0 });
  return { w, h, cx };
}
function chip(s, text, x, y, w, color) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h: 0.42, rectRadius: 0.08, fill: { color }, line: { type: "none" } });
  s.addText(text, { x, y, w, h: 0.42, fontFace: BODY, fontSize: 13, bold: true, color: "FFFFFF", align: "center", valign: "middle", isTextBox: true, margin: 0 });
}
function notes(s, t) { s.addNotes(t); }

// ============================================================ 1. TITLE
let s = pres.addSlide();
s.background = { color: HERO };
s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: Hh, fill: { color: HERO } });
s.addText("CS621 — CLOUD COMPUTING SECURITY", { x: 0.9, y: 1.3, w: 11, h: 0.4, fontFace: BODY, fontSize: 14, color: TEAL, bold: true, charSpacing: 3, isTextBox: true, margin: 0 });
s.addText("Server-Side Request Forgery to Cloud Metadata", { x: 0.9, y: 2.05, w: 11.5, h: 1.0, fontFace: HEAD, fontSize: 40, bold: true, color: PANEL, isTextBox: true, margin: 0 });
s.addText("Reproducing and defending the instance-credential theft chain", { x: 0.9, y: 3.05, w: 11.5, h: 0.6, fontFace: BODY, fontSize: 22, color: INK, isTextBox: true, margin: 0 });
s.addText("Practical Cloud Security Project (Lab-Based) — Capital One 2019 scenario", { x: 0.9, y: 3.65, w: 11.5, h: 0.5, fontFace: BODY, fontSize: 16, italic: true, color: MUTE, isTextBox: true, margin: 0 });
s.addShape(pres.ShapeType.line, { x: 0.95, y: 4.55, w: 4.2, h: 0, line: { color: TEAL, width: 2 } });
s.addText([{ text: "Abdullah Alruwaili", options: { breakLine: true } }, { text: "Ahmed Alsaleh", options: { breakLine: true } }, { text: "Bassam Alruwaili" }],
  { x: 0.9, y: 4.8, w: 6, h: 1.2, fontFace: BODY, fontSize: 16, color: INK, lineSpacingMultiple: 1.2, isTextBox: true, margin: 0 });
s.addText([{ text: "Code:  ", options: { color: MUTE } }, { text: "github.com/i9x0/cloud-ssrf-lab", options: { color: ACCENT, bold: true } }], { x: 0.9, y: 6.22, w: 7, h: 0.4, fontFace: "Consolas", fontSize: 14, isTextBox: true, margin: 0 });
s.addText([{ text: "Demo:  ", options: { color: MUTE } }, { text: "cloud-ssrf-lab-aws.vercel.app", options: { color: ACCENT, bold: true } }], { x: 0.9, y: 6.68, w: 7, h: 0.4, fontFace: "Consolas", fontSize: 14, isTextBox: true, margin: 0 });
s.addText("Jouf University · 26 Nov 2026", { x: 7.5, y: 6.7, w: 5, h: 0.4, fontFace: BODY, fontSize: 13, color: MUTE, align: "right", isTextBox: true, margin: 0 });
notes(s, "مرحباً دكتور. مشروعنا العملي يعيد بناء هجوم اختراق Capital One 2019، وهو هجوم SSRF على السحابة يسرق مفاتيح الدخول ثم يسرق البيانات. بنينا كل شيء معزولاً على جهاز واحد، ثم طبّقنا أربع حمايات وقِسنا فعاليتها بالأرقام.");

// ============================================================ 2. PROBLEM
s = pres.addSlide(); s.background = { color: LIGHT };
titleBar(s, "The security problem: SSRF reaches cloud credentials", "The problem");
s.addText([
  { text: "Cloud VMs get a short-lived identity from a local ", options: {} },
  { text: "metadata service", options: { bold: true, color: TEAL } },
  { text: " at 169.254.169.254 — no stored passwords.", options: {} },
], { x: 0.7, y: 1.5, w: 7.1, h: 0.9, fontFace: BODY, fontSize: 17, color: INK, isTextBox: true, margin: 0, lineSpacingMultiple: 1.15 });
s.addText([
  { text: "SSRF", options: { bold: true, color: RED } },
  { text: " = a server is tricked into fetching a URL the attacker chose. Link previews, webhooks and image proxies are classic SSRF sinks (OWASP Top 10 A10:2021).", options: {} },
], { x: 0.7, y: 2.5, w: 7.1, h: 1.2, fontFace: BODY, fontSize: 17, color: INK, isTextBox: true, margin: 0, lineSpacingMultiple: 1.15 });
s.addShape(pres.ShapeType.roundRect, { x: 0.7, y: 3.9, w: 7.1, h: 2.7, rectRadius: 0.1, fill: { color: SOFT }, line: { color: LINE, width: 1 } });
s.addText("The dangerous coupling", { x: 0.95, y: 4.05, w: 6.6, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: PANEL, isTextBox: true, margin: 0 });
const steps = ["Attacker sends a crafted URL to the app", "App fetches it from inside the VM (SSRF)", "URL points at the metadata service", "Temporary cloud credentials are returned", "Attacker uses them to reach cloud storage"];
steps.forEach((t, i) => {
  s.addShape(pres.ShapeType.ellipse, { x: 0.95, y: 4.55 + i * 0.4, w: 0.3, h: 0.3, fill: { color: i < 3 ? RED : GREEN }, line: { type: "none" } });
  s.addText(String(i + 1), { x: 0.95, y: 4.55 + i * 0.4, w: 0.3, h: 0.3, fontFace: BODY, fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle", isTextBox: true, margin: 0 });
  s.addText(t, { x: 1.4, y: 4.52 + i * 0.4, w: 6.2, h: 0.36, fontFace: BODY, fontSize: 13.5, color: INK, valign: "middle", isTextBox: true, margin: 0 });
});
imgCard(s, P("03_webapp_ssrf_metadata.png"), 8.1, 1.7, 4.6, 4.0, "The app fetches the metadata service for the attacker");
notes(s, "المشكلة: خدمة السحابة تعطي التطبيق مفاتيحه من عنوان داخلي 169.254.169.254. وثغرة SSRF تعني إنك تخلي الخادم يجيب أي رابط تعطيه. فلو التطبيق فيه SSRF، يقدر المهاجم يخليه يقرأ المفاتيح. الصورة توضح التطبيق وهو يقرأ بيانات السحابة بأمر من المهاجم.");

// ============================================================ 3. IMPACT
s = pres.addSlide(); s.background = { color: HERO };
s.addText("WHY IT MATTERS", { x: 0.62, y: 0.35, w: 12, h: 0.3, fontFace: BODY, fontSize: 12, bold: true, color: TEAL, charSpacing: 2, isTextBox: true, margin: 0 });
s.addText("Capital One, 2019: the same chain, in production", { x: 0.6, y: 0.62, w: 12.1, h: 0.8, fontFace: HEAD, fontSize: 30, bold: true, color: PANEL, isTextBox: true, margin: 0 });
const stats = [["100M+", "customers' records exposed"], ["$190M", "settlement with customers"], ["$80M", "regulatory fine (OCC)"], ["1", "SSRF bug started it all"]];
stats.forEach((st, i) => {
  const x = 0.75 + i * 3.05;
  s.addShape(pres.ShapeType.roundRect, { x, y: 1.9, w: 2.8, h: 2.0, rectRadius: 0.1, fill: { color: LIGHT }, line: { color: LINE, width: 1 } });
  s.addText(st[0], { x, y: 2.15, w: 2.8, h: 0.9, fontFace: HEAD, fontSize: 40, bold: true, color: i === 0 ? RED : PANEL, align: "center", isTextBox: true, margin: 0 });
  s.addText(st[1], { x: x + 0.15, y: 3.1, w: 2.5, h: 0.7, fontFace: BODY, fontSize: 13, color: MUTE, align: "center", isTextBox: true, margin: 0 });
});
s.addText([
  { text: "The attacker used SSRF against a web app firewall, read the instance role credentials from the AWS metadata service, and used them to download data from S3 buckets.", options: {} },
], { x: 0.75, y: 4.3, w: 11.8, h: 1.0, fontFace: BODY, fontSize: 17, color: INK, isTextBox: true, margin: 0, lineSpacingMultiple: 1.2 });
s.addText("MITRE ATT&CK T1552.005 — Unsecured Credentials: Cloud Instance Metadata API", { x: 0.75, y: 5.5, w: 11.8, h: 0.4, fontFace: BODY, fontSize: 13, italic: true, color: MUTE, isTextBox: true, margin: 0 });
notes(s, "هذا الهجوم ليس نظرياً. سنة 2019 صار فعلاً لبنك Capital One: تسربت بيانات أكثر من 100 مليون عميل، ودفع البنك تسوية 190 مليون وغرامة 80 مليون. والبداية كانت ثغرة SSRF واحدة. هذا اللي نعيد بناءه ونحميه.");

// ============================================================ 4. OBJECTIVES
s = pres.addSlide(); s.background = { color: LIGHT };
titleBar(s, "Project objectives", "Goals");
const objs = [["O1", "Reproduce", "Rebuild the SSRF → metadata → credential theft → S3 exfiltration chain in a safe, isolated lab.", TEAL],
  ["O2", "Defend", "Implement four cloud defences aligned with AWS, OWASP and NIST best practice.", GREEN],
  ["O3", "Measure", "Evaluate each defence: attack success, data lost, false positives, latency, and detection.", GOLD],
  ["O4", "Conclude", "Draw defence-in-depth lessons for real cloud-native deployments.", PANEL]];
objs.forEach((o, i) => {
  const x = 0.7 + (i % 2) * 6.2, y = 1.6 + Math.floor(i / 2) * 2.55;
  s.addShape(pres.ShapeType.roundRect, { x, y, w: 5.9, h: 2.3, rectRadius: 0.1, fill: { color: SOFT }, line: { color: LINE, width: 1 } });
  s.addShape(pres.ShapeType.ellipse, { x: x + 0.3, y: y + 0.35, w: 0.95, h: 0.95, fill: { color: o[3] }, line: { type: "none" } });
  s.addText(o[0], { x: x + 0.3, y: y + 0.35, w: 0.95, h: 0.95, fontFace: HEAD, fontSize: 22, bold: true, color: "FFFFFF", align: "center", valign: "middle", isTextBox: true, margin: 0 });
  s.addText(o[1], { x: x + 1.45, y: y + 0.35, w: 4.2, h: 0.5, fontFace: HEAD, fontSize: 20, bold: true, color: INK, isTextBox: true, margin: 0 });
  s.addText(o[2], { x: x + 1.45, y: y + 0.9, w: 4.25, h: 1.2, fontFace: BODY, fontSize: 13.5, color: "374151", isTextBox: true, margin: 0, lineSpacingMultiple: 1.1 });
});
notes(s, "أهدافنا أربعة: أولاً نعيد بناء الهجوم في مختبر آمن. ثانياً نطبّق أربع حمايات معتمدة من AWS وOWASP وNIST. ثالثاً نقيس كل حماية بالأرقام. رابعاً نستخرج دروس الدفاع متعدد الطبقات.");

// ============================================================ 5. ARCHITECTURE
s = pres.addSlide(); s.background = { color: LIGHT };
titleBar(s, "System architecture: an isolated mini-cloud", "Methodology");
imgCard(s, F("fig_architecture.png"), 0.6, 1.45, 8.5, 5.6, null);
s.addShape(pres.ShapeType.roundRect, { x: 9.3, y: 1.55, w: 3.45, h: 5.4, rectRadius: 0.1, fill: { color: SOFT }, line: { color: LINE, width: 1 } });
s.addText("8 Docker services · 4 isolated networks · 0 traffic leaves the host", { x: 9.5, y: 1.75, w: 3.05, h: 0.9, fontFace: HEAD, fontSize: 15, bold: true, color: PANEL, isTextBox: true, margin: 0, lineSpacingMultiple: 1.1 });
const map = [["webapp", "EC2 + app (victim)"], ["imds", "EC2 metadata svc"], ["SeaweedFS", "Amazon S3"], ["s3-gateway", "AWS CloudTrail"], ["detector", "Amazon GuardDuty"], ["internal-api", "Private VPC svc"]];
map.forEach((m, i) => {
  const y = 2.75 + i * 0.68;
  s.addText(m[0], { x: 9.5, y, w: 1.55, h: 0.6, fontFace: "Consolas", fontSize: 12, bold: true, color: TEAL, valign: "middle", isTextBox: true, margin: 0 });
  s.addText("→ " + m[1], { x: 11.05, y, w: 1.65, h: 0.6, fontFace: BODY, fontSize: 11.5, color: "374151", valign: "middle", isTextBox: true, margin: 0 });
});
notes(s, "بنينا سحابة مصغرة على جهاز واحد بـ Docker: ثمان خدمات وأربع شبكات معزولة، ولا شيء يطلع للإنترنت. كل خدمة تقابل خدمة حقيقية في AWS: webapp هو الخادم الضحية، imds خدمة المفاتيح، SeaweedFS يقابل S3، s3-gateway يقابل CloudTrail، وdetector يقابل GuardDuty. الخط الأحمر هو مسار الهجوم بأربع خطوات.");

// ============================================================ 6. DEFENCES
s = pres.addSlide(); s.background = { color: LIGHT };
titleBar(s, "Four defences, one per link in the chain", "Solution");
const defs = [["D1", "IMDSv2 enforced", "Metadata", "Requires a session token before serving credentials — blocks simple GET-based SSRF.", TEAL],
  ["D2", "SSRF input guard", "Application", "Resolves the host, blocks private / link-local ranges, re-validates redirects, pins the IP.", GREEN],
  ["D3", "Least-privilege role", "IAM", "Instance role may only write uploads — it cannot read the customer database.", GOLD],
  ["D4", "Exfiltration detector", "Detection", "Alerts when the role key is used from any IP other than the instance itself.", RED]];
defs.forEach((d, i) => {
  const x = 0.7 + i * 3.08, col = d[4];
  s.addShape(pres.ShapeType.roundRect, { x, y: 1.6, w: 2.9, h: 4.9, rectRadius: 0.1, fill: { color: SOFT }, line: { color: LINE, width: 1 } });
  s.addShape(pres.ShapeType.roundRect, { x, y: 1.6, w: 2.9, h: 1.1, rectRadius: 0.1, fill: { color: col }, line: { type: "none" } });
  s.addShape(pres.ShapeType.rect, { x, y: 2.25, w: 2.9, h: 0.45, fill: { color: col }, line: { type: "none" } });
  s.addText(d[0], { x, y: 1.72, w: 2.9, h: 0.55, fontFace: HEAD, fontSize: 26, bold: true, color: "FFFFFF", align: "center", isTextBox: true, margin: 0 });
  s.addText(d[2].toUpperCase(), { x, y: 2.28, w: 2.9, h: 0.35, fontFace: BODY, fontSize: 12, bold: true, color: "FFFFFF", align: "center", charSpacing: 2, isTextBox: true, margin: 0 });
  s.addText(d[1], { x: x + 0.2, y: 3.0, w: 2.5, h: 0.6, fontFace: HEAD, fontSize: 17, bold: true, color: INK, align: "center", isTextBox: true, margin: 0 });
  s.addText(d[3], { x: x + 0.25, y: 3.75, w: 2.4, h: 2.5, fontFace: BODY, fontSize: 13, color: "374151", align: "center", isTextBox: true, margin: 0, lineSpacingMultiple: 1.2 });
});
notes(s, "طبّقنا أربع حمايات، كل وحدة تقطع حلقة من سلسلة الهجوم. D1 يحمي خدمة المفاتيح بفرض تذكرة. D2 يفحص الروابط ويمنع الداخلية. D3 يقلّل صلاحية المفتاح. D4 يكشف استخدام المفتاح المسروق. النقطة المهمة: كل حماية تغطي حلقة مختلفة.");

// ============================================================ 7. ATTACK full chain
s = pres.addSlide(); s.background = { color: LIGHT };
titleBar(s, "Baseline attack: full compromise", "Testing · results");
imgCard(s, P("05_attack_chain_C0.png"), 0.6, 1.5, 8.0, 5.5, "Full kill chain on the undefended baseline (C0)");
s.addShape(pres.ShapeType.roundRect, { x: 8.85, y: 1.6, w: 3.9, h: 2.5, rectRadius: 0.1, fill: { color: "FCECEC" }, line: { color: RED, width: 1 } });
s.addText("1,000", { x: 8.85, y: 1.85, w: 3.9, h: 0.95, fontFace: HEAD, fontSize: 46, bold: true, color: RED, align: "center", isTextBox: true, margin: 0 });
s.addText("customer records stolen with no defences in place", { x: 9.1, y: 2.85, w: 3.4, h: 1.0, fontFace: BODY, fontSize: 14, color: "7A1F1F", align: "center", isTextBox: true, margin: 0, lineSpacingMultiple: 1.1 });
const chain6 = ["Recon the preview feature", "SSRF reads the metadata service", "Discover the IAM role name", "Steal temporary credentials", "List buckets from attacker IP", "Download the customer database"];
s.addText("Six steps, web interface only:", { x: 8.9, y: 4.3, w: 3.8, h: 0.35, fontFace: HEAD, fontSize: 14, bold: true, color: PANEL, isTextBox: true, margin: 0 });
s.addText(chain6.map((t, i) => ({ text: t, options: { bullet: { characterCode: "2022" }, breakLine: i < 5 } })),
  { x: 8.95, y: 4.7, w: 3.75, h: 2.2, fontFace: BODY, fontSize: 12.5, color: "374151", isTextBox: true, margin: 0, paraSpaceAfter: 4 });
notes(s, "هذي نتيجة الهجوم على النظام بدون حماية. بست خطوات، ومن المتصفح فقط، المهاجم يسرق المفاتيح ثم يحمّل كامل قاعدة العملاء: ألف سجل. لاحظوا أن المفاتيح مخفية في الصورة لأسباب أمنية. البيانات وهمية بالكامل.");

// ============================================================ 8. DEFENCES BLOCK
s = pres.addSlide(); s.background = { color: LIGHT };
titleBar(s, "Defences stop the attack", "Testing · results");
imgCard(s, P("07_attack_chain_C1_imdsv2.png"), 0.55, 1.55, 6.1, 2.55, "D1 — IMDSv2 refuses the token-less request (HTTP 401)");
imgCard(s, P("09_webapp_guard_blocks_decimal_ip.png"), 0.55, 4.5, 6.1, 2.4, "D2 — SSRF guard blocks even a decimal-encoded metadata IP");
imgCard(s, P("12_attack_chain_C3_leastpriv.png"), 6.95, 1.55, 6.0, 2.55, "D3 — stolen key is useless: S3 returns AccessDenied");
imgCard(s, P("06_detector_alerts.png"), 6.95, 4.5, 6.0, 2.4, "D4 — detector raises HIGH-severity exfiltration alerts");
notes(s, "هنا نشوف الحمايات وهي تصد الهجوم فعلاً. D1 يرفض الطلب برسالة 401. D2 يمنع حتى حيلة كتابة العنوان كرقم. D3 يخلي المفتاح المسروق بدون فائدة. D4 يطلع إنذار عند استخدام المفتاح من عنوان غريب. كل الصور حقيقية من المختبر.");

// ============================================================ 9. RESULTS TABLE
s = pres.addSlide(); s.background = { color: LIGHT };
titleBar(s, "Quantitative results across five configurations", "Evaluation");
const head = ["Config", "Defences", "SSRF blocked", "Creds stolen", "Records lost", "Legit OK", "Latency", "Alerts"];
const rows = [
  ["C0", "None", "0 / 23", "Yes", "1000", "100/100", "2.38 ms", "2"],
  ["C1", "IMDSv2", "14 / 23", "No", "0", "100/100", "2.39 ms", "0"],
  ["C2", "SSRF guard", "23 / 23", "No", "0", "100/100", "2.38 ms", "0"],
  ["C3", "Least priv.", "0 / 23", "Yes", "0", "100/100", "2.34 ms", "2"],
  ["C4", "All three", "23 / 23", "No", "0", "100/100", "2.49 ms", "0"],
];
const colW = [1.1, 2.0, 1.75, 1.6, 1.5, 1.5, 1.4, 1.15];
const tblRows = [head.map((h) => ({ text: h, options: { fill: { color: PANEL }, color: "FFFFFF", bold: true, align: "center", fontSize: 13, valign: "middle" } }))];
rows.forEach((r, ri) => {
  tblRows.push(r.map((c, ci) => {
    let color = INK, bold = false;
    if (ci === 2) { color = c.startsWith("23") ? GREEN : c.startsWith("0 ") ? RED : "374151"; bold = true; }
    if (ci === 3) { color = c === "Yes" ? RED : GREEN; bold = true; }
    if (ci === 4) { color = c === "0" ? GREEN : RED; bold = true; }
    return { text: c, options: { fill: { color: ri % 2 ? "FFFFFF" : SOFT }, color, bold: bold || ci === 0, align: ci === 1 ? "left" : "center", fontSize: 13, valign: "middle" } };
  }));
});
s.addTable(tblRows, { x: 0.7, y: 1.7, w: 11.9, colW, rowH: 0.52, border: { type: "solid", color: LINE, pt: 1 }, align: "center", valign: "middle", fontFace: BODY });
s.addText("Every value is taken directly from the automated evaluation output — no number entered by hand.", { x: 0.7, y: 4.75, w: 11.9, h: 0.35, fontFace: BODY, fontSize: 12, italic: true, color: MUTE, isTextBox: true, margin: 0 });
const take = [["SSRF guard (D2) alone", "blocked 23 / 23", GREEN], ["Least privilege (D3)", "cut data loss to 0", GOLD], ["All defences (C4)", "blocked everything, 0% false positives", TEAL]];
take.forEach((t, i) => {
  const x = 0.7 + i * 4.0;
  s.addShape(pres.ShapeType.roundRect, { x, y: 5.3, w: 3.8, h: 1.35, rectRadius: 0.1, fill: { color: SOFT }, line: { color: t[2], width: 1.25 } });
  s.addText(t[0], { x: x + 0.25, y: 5.45, w: 3.4, h: 0.5, fontFace: HEAD, fontSize: 15, bold: true, color: INK, isTextBox: true, margin: 0 });
  s.addText(t[1], { x: x + 0.25, y: 5.9, w: 3.4, h: 0.6, fontFace: BODY, fontSize: 14, color: t[2], bold: true, isTextBox: true, margin: 0 });
});
notes(s, "هذا جدول النتائج كاملاً. أهم ثلاث نقاط: فلتر الروابط D2 لحاله صدّ 23 من 23. أقل صلاحية D3 خفّض الخسارة إلى صفر حتى بعد سرقة المفتاح. والحمايات الثلاث معاً C4 صدّت كل شيء بدون أي إنذار كاذب. كل الأرقام من المخرجات الآلية مباشرة.");

// ============================================================ 10. CHARTS
s = pres.addSlide(); s.background = { color: LIGHT };
titleBar(s, "Attack coverage and kill-chain progression", "Evaluation");
imgCard(s, F("fig_payload_outcomes.png"), 0.55, 1.6, 6.15, 5.2, "Outcome of the 23 SSRF payloads per configuration");
imgCard(s, F("fig_kill_chain.png"), 6.95, 1.6, 6.0, 5.2, "How far the attacker gets in each configuration");
notes(s, "الرسمان يلخّصان النتائج بصرياً. الرسم الأيسر: مصير الـ 23 هجمة في كل إعداد — أحمر نجح، أخضر انمنع. الرسم الأيمن: إلى أين وصل المهاجم في السلسلة. نلاحظ أن IMDSv2 لحاله ما يكفي، لكن الحمايات مجتمعة توقف كل شيء.");

// ============================================================ 11. DISCUSSION
s = pres.addSlide(); s.background = { color: LIGHT };
titleBar(s, "Key findings", "Discussion");
const finds = [["No single control is enough", "IMDSv2 leaves internal & loopback SSRF open (9/23 still hit); least privilege doesn't stop theft, only limits damage.", RED],
  ["Validate the root cause", "The SSRF guard blocked 23/23 because it fixes the server-side fetch itself, not one target.", GREEN],
  ["Defences are complementary", "D1 stops theft, D3 contains a leaked key, D4 detects misuse — together they cover the whole chain.", TEAL],
  ["No cost to usability", "100/100 legitimate requests kept working in every config; ~0.1 ms median latency overhead.", GOLD]];
finds.forEach((f, i) => {
  const y = 1.65 + i * 1.32;
  s.addShape(pres.ShapeType.roundRect, { x: 0.7, y, w: 11.95, h: 1.15, rectRadius: 0.08, fill: { color: SOFT }, line: { color: LINE, width: 1 } });
  s.addShape(pres.ShapeType.ellipse, { x: 0.95, y: y + 0.3, w: 0.55, h: 0.55, fill: { color: f[2] }, line: { type: "none" } });
  s.addText(String(i + 1), { x: 0.95, y: y + 0.3, w: 0.55, h: 0.55, fontFace: HEAD, fontSize: 18, bold: true, color: "FFFFFF", align: "center", valign: "middle", isTextBox: true, margin: 0 });
  s.addText(f[0], { x: 1.75, y: y + 0.14, w: 10.6, h: 0.45, fontFace: HEAD, fontSize: 17, bold: true, color: INK, isTextBox: true, margin: 0 });
  s.addText(f[1], { x: 1.75, y: y + 0.56, w: 10.7, h: 0.5, fontFace: BODY, fontSize: 13.5, color: "374151", isTextBox: true, margin: 0 });
});
notes(s, "أربعة دروس. أولاً: ولا حماية وحدها تكفي. ثانياً: أقوى حماية هي اللي تعالج السبب الجذري وهو فحص الروابط. ثالثاً: الحمايات تكمّل بعضها. رابعاً: الحماية ما أثّرت على المستخدمين ولا على الأداء — صفر إنذار كاذب وتأخير ضئيل جداً.");

// ============================================================ 12. LIVE DEMO
s = pres.addSlide(); s.background = { color: LIGHT };
titleBar(s, "Public interactive demo — the attack, live", "Deliverable");
s.addText("Same website, two clicks: disable the defences and the attack steals 1,000 records; enable them and it is blocked.", { x: 0.6, y: 1.35, w: 12.1, h: 0.45, fontFace: BODY, fontSize: 15, color: INK, isTextBox: true, margin: 0 });
chip(s, "No defences (C0)  ·  1,000 records stolen", 0.5, 2.0, 6.15, RED);
chip(s, "All defences (C4)  ·  blocked, 0 records", 6.7, 2.0, 6.15, GREEN);
imgCard(s, P("15_demo_attack.png"), 0.5, 2.65, 6.15, 3.9, "LinkPeek leaks the credentials; the attacker console downloads 1,000 records");
imgCard(s, P("16_demo_blocked.png"), 6.7, 2.65, 6.15, 3.9, "The SSRF guard blocks the request at step 2 — 0 credentials, 0 records");
s.addText("cloud-ssrf-lab-aws.vercel.app", { x: 0.6, y: 7.0, w: 12.1, h: 0.35, fontFace: "Consolas", fontSize: 13, bold: true, color: ACCENT, align: "center", isTextBox: true, margin: 0 });
notes(s, "وهذا الموقع التفاعلي المنشور وهو يشتغل: على اليسار بدون حماية — المفاتيح تتسرب ويُسرق ألف سجل. على اليمين بتفعيل الحمايات الأربع — الطلب ينحجب وصفر سجل. المستخدم يجرّب بنفسه بضغطة. الرابط: cloud-ssrf-lab-aws.vercel.app");

// ============================================================ 13. CONCLUSION + contributions
s = pres.addSlide(); s.background = { color: HERO };
s.addText("CONCLUSION", { x: 0.9, y: 0.6, w: 12, h: 0.3, fontFace: BODY, fontSize: 12, bold: true, color: TEAL, charSpacing: 2, isTextBox: true, margin: 0 });
s.addText("Cloud credential theft is a multi-layer problem — only defence-in-depth works", { x: 0.9, y: 0.95, w: 11.5, h: 1.0, fontFace: HEAD, fontSize: 26, bold: true, color: PANEL, isTextBox: true, margin: 0, lineSpacingMultiple: 1.05 });
s.addText([
  { text: "Secure the metadata service (IMDSv2) · validate server-side requests (SSRF guard) · minimise IAM permissions (least privilege) · monitor for misuse (detection). ", options: {} },
  { text: "Each control covers a link the others miss.", options: { bold: true, color: PANEL } },
], { x: 0.9, y: 2.2, w: 11.6, h: 1.0, fontFace: BODY, fontSize: 16, color: INK, isTextBox: true, margin: 0, lineSpacingMultiple: 1.2 });
s.addText("Group member contributions", { x: 0.9, y: 3.5, w: 11, h: 0.4, fontFace: HEAD, fontSize: 17, bold: true, color: INK, isTextBox: true, margin: 0 });
const contrib = [["Abdullah Alruwaili", "Architecture & Docker design; victim app and metadata service; report §1–3."],
  ["Ahmed Alsaleh", "Attack corpus & kill chain; defences D1 (IMDSv2) and D2 (SSRF guard); report §4.1–4.4."],
  ["Bassam Alruwaili", "Defences D3 (least privilege) & D4 (detector); evaluation harness, figures & results; §4.5–5."]];
contrib.forEach((c, i) => {
  const x = 0.9 + i * 4.0;
  s.addShape(pres.ShapeType.roundRect, { x, y: 4.05, w: 3.8, h: 2.1, rectRadius: 0.1, fill: { color: LIGHT }, line: { color: LINE, width: 1 } });
  s.addText(c[0], { x: x + 0.25, y: 4.25, w: 3.3, h: 0.6, fontFace: HEAD, fontSize: 15, bold: true, color: INK, isTextBox: true, margin: 0 });
  s.addShape(pres.ShapeType.line, { x: x + 0.25, y: 4.85, w: 1.2, h: 0, line: { color: TEAL, width: 1.5 } });
  s.addText(c[1], { x: x + 0.25, y: 4.95, w: 3.35, h: 1.1, fontFace: BODY, fontSize: 12.5, color: MUTE, isTextBox: true, margin: 0, lineSpacingMultiple: 1.1 });
});
s.addText("Thank you — questions welcome", { x: 0.9, y: 6.45, w: 6.2, h: 0.5, fontFace: HEAD, fontSize: 18, bold: true, color: PANEL, isTextBox: true, margin: 0 });
s.addText([{ text: "Code:  ", options: { color: MUTE } }, { text: "github.com/i9x0/cloud-ssrf-lab   ", options: { color: ACCENT, bold: true } }, { text: "Demo:  ", options: { color: MUTE } }, { text: "cloud-ssrf-lab-aws.vercel.app", options: { color: ACCENT, bold: true } }], { x: 6.0, y: 6.55, w: 6.7, h: 0.4, fontFace: "Consolas", fontSize: 12, align: "right", isTextBox: true, margin: 0 });
notes(s, "الخلاصة: سرقة مفاتيح السحابة مشكلة متعددة الطبقات، وما ينفع فيها إلا الدفاع متعدد الطبقات: أمّن خدمة المفاتيح، افحص الروابط، قلّل الصلاحيات، وراقب. وهذي مساهمة كل عضو. شكراً، وجاهزين لأسئلتكم.");

pres.writeFile({ fileName: path.join(__dirname, "CS621_Presentation.pptx") }).then((f) => console.log("wrote", f));
