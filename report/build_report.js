const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, ImageRun, Header, Footer,
  PageNumber, TableOfContents,
} = require("docx");

const LAB = path.resolve(__dirname, "..");
const SHOT = path.join(LAB, "results", "screenshots");
const FIG = path.join(LAB, "results", "figures");
const img = (p) => fs.readFileSync(p);

const BLUE = "1F3864", ACCENT = "2563EB", GREY = "6B7280", LIGHT = "F1F5F9", RED = "B91C1C", GREEN = "0F6E56";
const FONT = "Calibri";

// ---- helpers ----
const H = (text, level) => new Paragraph({ heading: level, children: [new TextRun({ text })] });
const P = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 120, line: 276 },
    alignment: opts.align,
    children: Array.isArray(text) ? text : [new TextRun({ text, ...opts.run })],
  });
const bullet = (text, lvl = 0) =>
  new Paragraph({ numbering: { reference: "bullets", level: lvl }, spacing: { after: 60, line: 276 },
    children: Array.isArray(text) ? text : [new TextRun({ text })] });
const B = (t) => new TextRun({ text: t, bold: true });
const T = (t) => new TextRun({ text: t });
const code = (t) => new TextRun({ text: t, font: "Consolas", size: 19 });

function figure(file, caption, widthPx) {
  const data = img(file);
  // probe PNG size
  const w = data.readUInt32BE(16), h = data.readUInt32BE(20);
  const targetW = widthPx || 560;
  const targetH = Math.round((h / w) * targetW);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 },
      children: [new ImageRun({ type: "png", data, transformation: { width: targetW, height: targetH },
        border: { color: "D0D0D0", space: 1, style: BorderStyle.SINGLE, size: 4 } })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
      children: [new TextRun({ text: caption, italics: true, size: 18, color: GREY })] }),
  ];
}

// ---- table builder ----
function cell(text, { bold = false, bg, align = AlignmentType.LEFT, color, width } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: bg ? { type: ShadingType.CLEAR, color: "auto", fill: bg } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ alignment: align, spacing: { after: 0, line: 252 },
      children: [new TextRun({ text, bold, color, size: 18 })] })],
  });
}
function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const headRow = new TableRow({ tableHeader: true,
    children: headers.map((h, i) => cell(h, { bold: true, bg: BLUE, color: "FFFFFF",
      align: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER, width: widths[i] })) });
  const bodyRows = rows.map((r, ri) =>
    new TableRow({ children: r.map((c, i) => {
      const val = Array.isArray(c) ? c[0] : c;
      const col = Array.isArray(c) ? c[1] : undefined;
      return cell(String(val), { bg: ri % 2 ? "FFFFFF" : LIGHT, color: col,
        bold: Array.isArray(c) && c[2], align: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER, width: widths[i] });
    }) }));
  return new Table({ columnWidths: widths, width: { size: total, type: WidthType.DXA }, rows: [headRow, ...bodyRows] });
}

const spacer = () => new Paragraph({ spacing: { after: 80 }, children: [] });

// =====================================================================
const doc = new Document({
  creator: "CS621 Group",
  styles: {
    default: {
      document: { run: { font: FONT, size: 22, color: "222222" } },
      title: { run: { font: FONT, size: 40, bold: true, color: BLUE }, paragraph: { spacing: { after: 120 }, alignment: AlignmentType.CENTER } },
      heading1: { run: { font: FONT, size: 30, bold: true, color: BLUE }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true, outlineLevel: 0 } },
      heading2: { run: { font: FONT, size: 25, bold: true, color: ACCENT }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 1 } },
      heading3: { run: { font: FONT, size: 22, bold: true, color: "333333" }, paragraph: { spacing: { before: 160, after: 80 }, keepNext: true, outlineLevel: 2 } },
    },
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } },
        { level: 1, format: "bullet", text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 920, hanging: 260 } } } },
      ] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1200, right: 1200 } } },
    headers: { default: new Header({ children: [ new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 },
      border: { bottom: { color: "D0D0D0", space: 4, style: BorderStyle.SINGLE, size: 4 } },
      children: [new TextRun({ text: "CS621 — Cloud Computing Security | Practical Project", size: 16, color: GREY })] }) ] }) },
    footers: { default: new Footer({ children: [ new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Page ", size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY }),
        new TextRun({ text: " of ", size: 16, color: GREY }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GREY })] }) ] }) },
    children: [
      // ---------------- TITLE PAGE ----------------
      new Paragraph({ spacing: { before: 1200 }, children: [] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Jouf University — College of Computer Science", size: 24, color: GREY })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "CS621 — Cloud Computing Security", size: 24, color: GREY })] }),
      new Paragraph({ style: "Title", alignment: AlignmentType.CENTER, spacing: { before: 200, after: 120 },
        children: [new TextRun({ text: "Server-Side Request Forgery to Cloud Metadata:", bold: true, size: 36, color: BLUE })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 },
        children: [new TextRun({ text: "Reproducing and Defending the Instance-Credential Theft Chain (Capital One 2019 Scenario)", bold: true, size: 28, color: ACCENT })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Practical Cloud Security Project (Lab-Based)", size: 24 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 700 }, children: [new TextRun({ text: "Option 2 — Technical Report", italics: true, size: 22, color: GREY })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "Group Members", bold: true, size: 24, color: BLUE })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "Abdullah Alruwaili  (471114279)", size: 22 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "Ahmed Alsaleh  (471114261)", size: 22 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "Bassam Alruwaili  (471114260)", size: 22 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "Date: 25 November 2026", size: 22, color: GREY })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "Project repository: ", size: 20, color: GREY }), new TextRun({ text: "https://github.com/i9x0/cloud-ssrf-lab", size: 20, bold: true, color: ACCENT })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Live interactive demo: ", size: 20, color: GREY }), new TextRun({ text: "https://cloud-ssrf-lab-aws.vercel.app", size: 20, bold: true, color: ACCENT })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ---------------- TOC ----------------
      H("Table of Contents", HeadingLevel.HEADING_1),
      new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
      new Paragraph({ children: [new PageBreak()] }),

      // ---------------- 1. ABSTRACT ----------------
      H("1. Abstract", HeadingLevel.HEADING_1),
      P([T("Cloud workloads that fetch URLs on behalf of users are exposed to "), B("Server-Side Request Forgery (SSRF)"),
        T(". When such a workload runs on a cloud virtual machine, an attacker can abuse SSRF to reach the "),
        B("Instance Metadata Service (IMDS)"), T(" at the link-local address 169.254.169.254, steal the machine's temporary IAM credentials, and use them to access cloud storage. This is the exact chain behind the 2019 Capital One breach that exposed data on more than 100 million customers.")]),
      P([T("This project designs, implements, and evaluates a complete, isolated reproduction of that attack and four defences against it. We built an eight-service cloud environment on a single host using Docker: a vulnerable URL-preview web application, an emulated AWS metadata service (IMDSv1/IMDSv2), S3-compatible object storage behind an access-logging gateway, a private internal service, and a GuardDuty-style exfiltration detector. We attack the baseline with "),
        B("23 SSRF payloads"), T(" and a full kill chain, then measure four defences — IMDSv2 enforcement, an application-level SSRF guard, a least-privilege instance role, and detection — individually and combined.")]),
      P([T("Results are clear and reproducible. The undefended baseline leaked all "), B("1,000"),
        T(" synthetic customer records. The SSRF input guard alone blocked "), B("23/23"),
        T(" payloads; IMDSv2 blocked all 14 metadata payloads; least privilege let credentials be stolen but reduced data loss to "),
        B("0 records"), T("; and the three preventive controls combined blocked every payload. All 100 legitimate requests kept working under every configuration (0% false positives), with a median latency overhead of about 0.1 ms, and the detector raised alerts whenever stolen credentials were used. The study confirms that no single control is sufficient and that defence-in-depth is required for cloud-native workloads.")]),

      // ---------------- 2. INTRODUCTION ----------------
      H("2. Introduction", HeadingLevel.HEADING_1),
      H("2.1 The Security Problem", HeadingLevel.HEADING_2),
      P([T("Modern cloud applications are frequently given a short-lived identity through an "), B("instance role"),
        T(". Instead of storing long-term secrets, the application asks a local metadata service for temporary credentials at runtime. This is convenient and widely used, but it creates a dangerous coupling: "),
        B("any code that can make the server send an HTTP request can also ask the metadata service for those credentials."), T(" SSRF is precisely such a flaw.")]),
      P([T("SSRF occurs when a server accepts a user-supplied URL and fetches it without validating the destination. Features such as link previews, webhooks, PDF generators, and image proxies all fetch URLs server-side and are classic SSRF sinks. SSRF is listed as a category of its own, "),
        B("A10:2021 – Server-Side Request Forgery"), T(", in the OWASP Top 10.")]),
      H("2.2 Significance and Impact", HeadingLevel.HEADING_2),
      P([T("In the 2019 Capital One incident, an attacker used SSRF against a web application firewall to read instance credentials from the AWS metadata service and then accessed data in S3 buckets, exposing records on over 100 million people. Because the metadata service trusts any request that originates from the instance, SSRF converts a web-layer bug into full cloud credential theft and data loss. The impact includes confidentiality breaches, regulatory penalties, and lateral movement across the cloud account.")]),
      H("2.3 Objectives", HeadingLevel.HEADING_2),
      bullet([B("O1. "), T("Reproduce the SSRF → metadata → credential-theft → S3-exfiltration chain in a safe, isolated lab.")]),
      bullet([B("O2. "), T("Implement four cloud defences aligned with industry best practice (AWS, OWASP, NIST).")]),
      bullet([B("O3. "), T("Evaluate each defence quantitatively: attack success, data exfiltrated, false positives, latency, and detection.")]),
      bullet([B("O4. "), T("Draw defence-in-depth conclusions for real cloud-native deployments.")]),

      // ---------------- 3. ARCHITECTURE & METHODOLOGY ----------------
      new Paragraph({ children: [new PageBreak()] }),
      H("3. System Architecture and Methodology", HeadingLevel.HEADING_1),
      H("3.1 Proposed Solution and Components", HeadingLevel.HEADING_2),
      P([T("We built a self-contained “mini-cloud” on one host using Docker and four isolated virtual networks, so no traffic ever leaves the machine. The environment reproduces the trust relationships of a real cloud account: a public-facing application, a link-local metadata service, a private VPC subnet, and an object-storage service fronted by an access-logging gateway that plays the role of AWS CloudTrail.")]),
      ...figure(path.join(FIG, "fig_architecture.png"), "Figure 1. System architecture. Red = the attack path (1–4); grey = legitimate internal traffic.", 580),
      P([B("Components and their real-cloud equivalents:")], { after: 60 }),
      table(
        ["Lab component", "Real-cloud equivalent", "Role in the lab", "Address"],
        [
          ["webapp (LinkPeek)", "EC2 instance + app", "Victim URL-preview app with the SSRF flaw", "203.0.113.10"],
          ["imds", "EC2 Metadata Service", "Serves instance IAM credentials (IMDSv1/v2)", "169.254.169.254"],
          ["seaweedfs", "Amazon S3", "Object storage holding customer data", "10.0.9.20"],
          ["s3-gateway (nginx)", "AWS CloudTrail", "Logs every S3 API call with caller IP + key", "203.0.113.30"],
          ["internal-api", "Private VPC service", "Second SSRF target (internal only)", "10.0.1.20"],
          ["detector", "Amazon GuardDuty", "Alerts on stolen-credential use", "—"],
          ["website / evil", "Public Internet sites", "Legitimate site and attacker redirect server", "203.0.113.20/66"],
          ["attacker", "Attacker laptop", "Runs the attack and the evaluation", "203.0.113.100"],
        ],
        [2600, 2400, 3400, 2040]),
      spacer(),
      P([B("Networks: "), code("internet"), T(" 203.0.113.0/24 (public, TEST-NET-3), "), code("vpc"), T(" 10.0.1.0/24 (private), "),
        code("imds-link"), T(" 169.254.169.0/24 (link-local, instance-only), and "), code("storage-backend"), T(" 10.0.9.0/24. The attacker container sits only on the public network and holds no lab secrets, exactly like a real external attacker.")]),

      H("3.2 Platforms, Software, Tools, and Data", HeadingLevel.HEADING_2),
      table(
        ["Category", "Tool / technology", "Purpose in the project"],
        [
          ["Virtualization", "Docker Desktop + Docker Compose (WSL2)", "Isolated multi-service cloud simulation"],
          ["Language", "Python 3.12 (Flask, boto3, requests)", "Services, attack scripts, evaluation"],
          ["Object storage", "SeaweedFS (S3-compatible API)", "Stands in for Amazon S3"],
          ["Gateway / log", "nginx", "S3 access logging (CloudTrail equivalent)"],
          ["Analysis / charts", "Matplotlib", "Figures from the evaluation data"],
          ["Dataset", "1,000 synthetic customer records", "Generated locally; no real personal data"],
          ["Host", "Windows 11, Ryzen 7 5700G, 32 GB RAM", "Single-machine lab"],
        ],
        [2400, 3600, 4440]),
      spacer(),
      P([T("No paid public-cloud account was required: the methodology deliberately uses a local simulation so the attack can be run safely and repeatedly. The approach maps directly onto AWS, Azure, and GCP, which all expose an equivalent metadata service.")]),

      H("3.3 The Four Defences", HeadingLevel.HEADING_2),
      table(
        ["ID", "Defence", "Layer", "What it does"],
        [
          ["D1", "IMDSv2 enforced", "Metadata", "Requires a session token (PUT) before serving credentials, blocking simple GET-based SSRF"],
          ["D2", "SSRF input guard", "Application", "Resolves the host and blocks private/link-local ranges; re-validates redirects; pins the IP"],
          ["D3", "Least-privilege role", "IAM", "Instance role may only write to app-uploads, not read customer-data"],
          ["D4", "Exfiltration detector", "Detection", "Alerts when the role key is used from any IP other than the instance"],
        ],
        [700, 2600, 1700, 5440]),
      spacer(),
      P([B("Defence D2 "), T("follows the OWASP SSRF Prevention Cheat Sheet: it allows only http/https on ports 80/443, resolves the hostname to an IP, and rejects any address inside loopback, RFC-1918 private, link-local (169.254.0.0/16), or reserved ranges. Because the check is on the "),
        B("resolved address"), T(", alternative encodings (decimal, hexadecimal, octal, IPv4-mapped IPv6, DNS aliases) and open-redirect bounces are all caught.")]),

      H("3.4 Implementation Procedure", HeadingLevel.HEADING_2),
      P("The lab is deployed and exercised with four commands. Defences are toggled by environment variables, so the same code runs in every configuration:", { after: 60 }),
      P([code("python setup.py")], { after: 20 }),
      P([code("docker compose up -d")], { after: 20 }),
      P([code("docker compose run --rm attacker python attack_chain.py")], { after: 20 }),
      P([code("python run_experiment.py")], { after: 120 }),
      P([B("Experimental design. "), T("We define five configurations and run each through an identical automated test harness: "),
        B("C0"), T(" baseline (no defences), "), B("C1"), T(" D1 only, "), B("C2"), T(" D2 only, "), B("C3"), T(" D3 only, and "),
        B("C4"), T(" D1+D2+D3 combined. Each run executes 23 SSRF payloads, the full credential-theft kill chain, and 100 legitimate requests (10 URLs × 10 repeats) to measure availability and latency.")]),
      ...figure(path.join(SHOT, "01_lab_running.png"), "Figure 2. All eight cloud services running (docker compose ps).", 600),

      // ---------------- 4. IMPLEMENTATION, TESTING & RESULTS ----------------
      new Paragraph({ children: [new PageBreak()] }),
      H("4. Implementation, Testing, and Results", HeadingLevel.HEADING_1),

      H("4.1 Step 1 — The Vulnerability (SSRF)", HeadingLevel.HEADING_2),
      P([T("The victim app, LinkPeek, fetches any URL the user submits and shows a preview. A normal request returns ordinary web content (Figure 3). But when the submitted URL points at the metadata service, the server fetches it from inside the instance and returns the response to the attacker (Figure 4) — the SSRF flaw.")]),
      ...figure(path.join(SHOT, "02_webapp_normal_use.png"), "Figure 3. Legitimate use: the app previews a normal public page.", 560),
      ...figure(path.join(SHOT, "03_webapp_ssrf_metadata.png"), "Figure 4. SSRF: the server is tricked into reading its own cloud metadata (169.254.169.254).", 560),

      H("4.2 Step 2 — Full Credential-Theft Kill Chain", HeadingLevel.HEADING_2),
      P([T("Using only the public web interface, the attacker walks six steps: (1) recon, (2) reach the metadata service via SSRF, (3) discover the IAM role name, (4) steal the temporary credentials, (5) use them from the attacker's own machine to list buckets, and (6) exfiltrate the customer database. On the undefended baseline the chain succeeds completely and downloads all 1,000 records (Figure 5).")]),
      ...figure(path.join(SHOT, "05_attack_chain_C0.png"), "Figure 5. Baseline (C0): the full chain succeeds — 1,000 synthetic records exfiltrated. Secrets are masked.", 560),

      H("4.3 Step 3 — Detection (D4)", HeadingLevel.HEADING_2),
      P([T("The S3 gateway logs every API call with the caller's IP and access-key ID. The detector knows the instance role key should only ever be used from the instance's own address (203.0.113.10). When the same key appears from the attacker's IP (203.0.113.100), it raises a GuardDuty-style "),
        code("InstanceCredentialExfiltration"), T(" finding (Figure 6).")]),
      ...figure(path.join(SHOT, "06_detector_alerts.png"), "Figure 6. Detector (D4): HIGH-severity alerts when the stolen key is used from an external IP.", 560),

      H("4.4 Step 4 — Defences Block the Attack", HeadingLevel.HEADING_2),
      P([B("D1 (IMDSv2). "), T("With IMDSv2 enforced, the metadata service refuses token-less GET requests, so the SSRF attempt returns HTTP 401 and the chain breaks at step 2 (Figure 7). However, IMDSv2 only protects the metadata service: the 9 payloads that target the internal VPC service and the server's own loopback still succeed.")]),
      ...figure(path.join(SHOT, "07_attack_chain_C1_imdsv2.png"), "Figure 7. D1 (IMDSv2): the metadata request is refused (HTTP 401); no credentials stolen.", 520),
      P([B("D2 (SSRF guard). "), T("The application-level guard blocks the request before it ever leaves the server, and it catches evasion tricks such as writing the metadata address as a single decimal number (Figure 8). It blocked all 23 payloads across all three target categories.")]),
      ...figure(path.join(SHOT, "09_webapp_guard_blocks_decimal_ip.png"), "Figure 8. D2 (SSRF guard): a decimal-encoded metadata IP is still blocked.", 560),
      P([B("D3 (least privilege). "), T("Least privilege does not stop the theft of the credentials, but the stolen key can only write to app-uploads. The attempt to read the customer database is denied with AccessDenied, so 0 records are lost (Figure 9).")]),
      ...figure(path.join(SHOT, "12_attack_chain_C3_leastpriv.png"), "Figure 9. D3 (least privilege): credentials are stolen but useless — S3 returns AccessDenied.", 560),

      H("4.5 Quantitative Results", HeadingLevel.HEADING_2),
      P("The automated harness produced the following results across all five configurations. Every number is taken directly from the evaluation output; no value was entered by hand.", { after: 100 }),
      table(
        ["Config", "Defences", "SSRF blocked", "Creds stolen", "Records lost", "Legit OK", "Median latency", "Alerts"],
        [
          ["C0", "None", ["0 / 23", RED, true], ["Yes", RED, true], ["1000", RED, true], "100/100", "2.38 ms", "2"],
          ["C1", "IMDSv2", ["14 / 23", GREY], ["No", GREEN], ["0", GREEN], "100/100", "2.39 ms", "0"],
          ["C2", "SSRF guard", ["23 / 23", GREEN, true], ["No", GREEN], ["0", GREEN], "100/100", "2.38 ms", "0"],
          ["C3", "Least priv.", ["0 / 23", GREY], ["Yes", RED], ["0", GREEN, true], "100/100", "2.34 ms", "2"],
          ["C4", "All three", ["23 / 23", GREEN, true], ["No", GREEN], ["0", GREEN], "100/100", "2.49 ms", "0"],
        ],
        [900, 1700, 1400, 1300, 1300, 1200, 1500, 1140]),
      new Paragraph({ spacing: { before: 60, after: 160 }, children: [new TextRun({ text: "Table 1. Evaluation results for the five configurations (23 SSRF payloads + kill chain + 100 legitimate requests each).", italics: true, size: 18, color: GREY })] }),
      ...figure(path.join(FIG, "fig_payload_outcomes.png"), "Figure 10. Outcome of the 23 SSRF payloads under each configuration.", 580),
      ...figure(path.join(FIG, "fig_kill_chain.png"), "Figure 11. How far the attacker progresses along the kill chain in each configuration.", 580),

      P([T("Beyond the Docker lab, the same decision logic is published as a free browser demo at "), new TextRun({ text: "https://cloud-ssrf-lab-aws.vercel.app", bold: true, color: ACCENT }), T(", where a visitor can toggle the four defences on and off and run the attack live. Its outcomes match Table 1 (the baseline leaks 1,000 records; all defences block the chain).")]),
      ...figure(path.join(SHOT, "15_demo_attack.png"), "Figure 12. The public demo (cloud-ssrf-lab-aws.vercel.app) with no defences: the SSRF leaks the instance credentials and the attacker exfiltrates 1,000 records.", 580),
      ...figure(path.join(SHOT, "16_demo_blocked.png"), "Figure 13. The same demo with all four defences enabled: the request is blocked at step 2 and 0 records are lost.", 580),
      H("4.6 Discussion", HeadingLevel.HEADING_2),
      bullet([B("No single control is sufficient. "), T("IMDSv2 (D1) protects the metadata service but leaves internal-service and loopback SSRF open (9/23 payloads still succeed). Least privilege (D3) does not stop credential theft at all — it only limits the blast radius.")]),
      bullet([B("Input validation is the strongest single control here. "), T("The SSRF guard (D2) blocked 23/23 payloads because it addresses the root cause (the server-side fetch) rather than one target.")]),
      bullet([B("Defences are complementary, not redundant. "), T("D1 stops credential theft, D3 contains the damage if a key leaks another way, and D4 detects misuse. Combined (C4) they block every payload and detect any residual abuse.")]),
      bullet([B("Security did not harm usability or performance. "), T("Across all configurations, 100/100 legitimate requests succeeded (0% false positives) and the median added latency was about 0.1 ms (Figure 12).")]),
      ...figure(path.join(FIG, "fig_latency.png"), "Figure 14. Latency of legitimate requests under each configuration (n = 100).", 580),

      H("4.7 Limitations", HeadingLevel.HEADING_2),
      bullet("The lab is a faithful but simplified model: SeaweedFS stands in for S3, and the metadata/IAM logic is emulated, so exact byte-level behaviour differs from AWS."),
      bullet("The dataset is synthetic and small (1,000 records); it is sufficient to demonstrate exfiltration but is not a performance benchmark."),
      bullet("The SSRF guard is a reference implementation; a production deployment should also use egress firewalling and DNS-rebinding protections at the network layer."),
      bullet("Latency figures are from a local single host and should be read as relative overhead, not absolute cloud numbers."),

      H("4.8 Possible Improvements", HeadingLevel.HEADING_2),
      bullet("Add a network-layer egress policy (default-deny to 169.254.169.254 and RFC-1918) as an independent control."),
      bullet("Integrate a real admission/policy engine and automated alert-to-isolation response (convert the detector into an active defence)."),
      bullet("Extend the harness with additional SSRF evasion classes (gopher://, DNS rebinding) and a larger payload corpus."),

      // ---------------- 5. CONCLUSION ----------------
      new Paragraph({ children: [new PageBreak()] }),
      H("5. Conclusion and Future Work", HeadingLevel.HEADING_1),
      P([T("We designed, implemented, and evaluated a complete, isolated reproduction of the SSRF-to-cloud-metadata credential-theft chain behind the 2019 Capital One breach, and measured four defences against it. The undefended system leaked all 1,000 records; an application-level SSRF guard blocked every one of the 23 attack payloads; IMDSv2 stopped credential theft but not all SSRF; least privilege reduced data loss to zero even after a key was stolen; and a GuardDuty-style detector caught every misuse of stolen credentials. Combined, the preventive controls blocked all attacks with no false positives and negligible latency.")]),
      P([B("Key finding: "), T("cloud credential theft via SSRF is a multi-layer problem, and only defence-in-depth — secure the metadata service (IMDSv2), validate server-side requests (SSRF guard), minimise IAM permissions (least privilege), and monitor for misuse (detection) — provides robust protection. Each control covers a different link in the chain that the others miss.")]),
      P([B("Future work. "), T("Add a network egress firewall as an independent control, turn the detector into an automated isolation response, broaden the SSRF evasion corpus, and port the lab onto a free-tier AWS account to validate the emulation against the real metadata service and IAM.")]),

      // ---------------- MEMBER CONTRIBUTIONS ----------------
      H("6. Group Member Contributions", HeadingLevel.HEADING_1),
      table(
        ["Member", "Primary contribution"],
        [
          ["Abdullah Alruwaili", "Environment architecture and Docker/network design; the vulnerable web application (webapp) and the metadata service (imds, IMDSv1/v2); report sections 1–3."],
          ["Ahmed Alsaleh", "Attack development: the 23-payload SSRF corpus and the kill-chain script; defences D1 (IMDSv2) and D2 (SSRF guard); report section 4.1–4.4."],
          ["Bassam Alruwaili", "Defences D3 (least-privilege IAM) and D4 (detector); the automated evaluation harness, figures, and results; report sections 4.5–5."],
        ],
        [3000, 7440]),
      spacer(),
      P([T("All three members jointly reviewed the final report and prepared the presentation; each member will explain their own contribution during the presentation.")]),

      // ---------------- ETHICS ----------------
      H("7. Ethical and Safety Statement", HeadingLevel.HEADING_1),
      bullet("All testing was performed only inside an isolated laboratory environment on the team's own computer; no external or third-party system was ever contacted."),
      bullet("All customer data is randomly generated and represents no real person."),
      bullet("All credentials are random, lab-only values that exist solely inside the simulation; they are masked in every screenshot and were never reused anywhere."),
      bullet("No passwords, API keys, or access tokens are exposed in this report or its figures."),

      // ---------------- REFERENCES ----------------
      H("8. References", HeadingLevel.HEADING_1),
      ...[
        "[1] OWASP Foundation, “A10:2021 – Server-Side Request Forgery (SSRF),” OWASP Top 10, 2021.",
        "[2] OWASP Foundation, “Server-Side Request Forgery Prevention Cheat Sheet,” OWASP Cheat Sheet Series, 2023.",
        "[3] Amazon Web Services, “Use IMDSv2,” Amazon EC2 User Guide, 2024.",
        "[4] Amazon Web Services, “Add defense in depth against open firewalls, reverse proxies, and SSRF vulnerabilities with enhancements to the EC2 Instance Metadata Service,” AWS Security Blog, 2019.",
        "[5] United States Senate Committee on Homeland Security, “How Capital One’s cloud configuration led to a data breach,” 2022.",
        "[6] NIST, “SP 800-190: Application Container Security Guide,” National Institute of Standards and Technology, 2017.",
        "[7] NIST, “SP 800-204: Security Strategies for Microservices-based Application Systems,” 2019.",
        "[8] MITRE, “T1552.005 – Unsecured Credentials: Cloud Instance Metadata API,” ATT&CK for Enterprise, 2023.",
        "[9] Amazon Web Services, “IAM best practices: grant least privilege,” AWS IAM User Guide, 2024.",
        "[10] Amazon Web Services, “Amazon GuardDuty finding types – UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration,” 2024.",
        "[11] Docker Inc., “Docker Compose and networking documentation,” 2024.",
        "[12] SeaweedFS, “S3 API documentation,” 2024.",
        "[13] Project source code, “cloud-ssrf-lab,” https://github.com/i9x0/cloud-ssrf-lab, 2026.",
        "[14] Live interactive demo, https://cloud-ssrf-lab-aws.vercel.app, 2026.",
      ].map((r) => new Paragraph({ spacing: { after: 80, line: 264 }, indent: { left: 460, hanging: 460 }, children: [new TextRun({ text: r, size: 20 })] })),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(__dirname, process.env.OUT_DOCX || "CS621_Practical_Report.docx");
  fs.writeFileSync(out, buf);
  console.log("wrote", out, buf.length, "bytes");
});
