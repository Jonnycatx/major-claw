import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

const root = process.cwd();
const baselinePath = join(root, "docs", "openclaw-compat-baseline.json");
let emitLogs = true;

function parseArgs(argv) {
  const flags = new Set(argv.slice(2));
  return {
    check: flags.has("--check"),
    apply: flags.has("--apply"),
    dryRun: flags.has("--dry-run"),
    strict: flags.has("--strict") || process.env.OPENCLAW_COMPAT_REQUIRE_REMOTE === "true"
  };
}

function log(kind, message) {
  if (!emitLogs) {
    return;
  }
  const prefix = kind.toUpperCase();
  // eslint-disable-next-line no-console
  console[kind === "error" ? "error" : kind === "warn" ? "warn" : "log"](`${prefix}: ${message}`);
}

function readBaseline() {
  return JSON.parse(readFileSync(baselinePath, "utf8"));
}

function cloneOpenClaw(repo, branch) {
  const checkoutRoot = mkdtempSync(join(tmpdir(), "openclaw-refresh-"));
  const repoPath = join(checkoutRoot, "openclaw");
  execFileSync("git", ["clone", "--depth", "1", "--branch", branch, `https://github.com/${repo}.git`, repoPath], {
    stdio: "pipe"
  });
  const commit = execFileSync("git", ["-C", repoPath, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  return { checkoutRoot, repoPath, commit };
}

function readExistingFiles(repoPath, candidates) {
  const matches = [];
  for (const relativePath of candidates) {
    const fullPath = join(repoPath, relativePath);
    if (existsSync(fullPath)) {
      matches.push({ path: relativePath, content: readFileSync(fullPath, "utf8") });
    }
  }
  return matches;
}

function uniq(values) {
  return Array.from(new Set(values));
}

function extractWsUrls(text) {
  return uniq(Array.from(text.matchAll(/ws:\/\/[^\s"'`]+/gi)).map((m) => m[0]));
}

function extractHttpUrls(text) {
  return uniq(Array.from(text.matchAll(/http:\/\/[^\s"'`]+/gi)).map((m) => m[0]));
}

function extractTokenHeaders(text) {
  const candidates = [
    ...Array.from(text.matchAll(/x-[a-z0-9-]*session[a-z0-9-]*/gi)).map((m) => m[0].toLowerCase()),
    ...Array.from(text.matchAll(/x-[a-z0-9-]*token[a-z0-9-]*/gi)).map((m) => m[0].toLowerCase())
  ];
  return uniq(candidates);
}

function extractAuthScopes(text) {
  return uniq(Array.from(text.matchAll(/\b(?:operator|agent|vault)\.[a-z_]+\b/gi)).map((m) => m[0].toLowerCase()));
}

function pickCanonical(items, preferred) {
  if (preferred && items.includes(preferred)) {
    return preferred;
  }
  return items[0] ?? "";
}

function pickGatewayHttp(items) {
  const normalized = uniq(
    items
      .map((item) => {
        try {
          const parsed = new URL(item);
          return parsed.origin;
        } catch {
          return "";
        }
      })
      .filter((item) => item.startsWith("http://") && item.endsWith(":18789"))
  );
  if (normalized.includes("http://127.0.0.1:18789")) {
    return "http://127.0.0.1:18789";
  }
  return normalized[0] ?? "";
}

function pickCanonicalScopes(extracted, existing) {
  const preferred = ["operator.read", "agent.execute", "vault.write"];
  const picked = preferred.filter((scope) => extracted.includes(scope));
  if (picked.length > 0) {
    return picked;
  }
  if (Array.isArray(existing) && existing.length > 0) {
    return existing;
  }
  return extracted.length > 0 ? [extracted[0]] : [];
}

function buildProposedExpectedRemoteGateway(live, currentExpected) {
  return {
    ws: pickCanonical(live.ws, "ws://127.0.0.1:18789") || currentExpected.ws || "",
    http: pickGatewayHttp(live.http) || currentExpected.http || "",
    tokenHeader: pickCanonical(live.tokenHeader, "x-openclaw-session-key") || currentExpected.tokenHeader || "",
    authScopes: pickCanonicalScopes(live.authScopes, currentExpected.authScopes)
  };
}

function stableStringify(value) {
  return JSON.stringify(value, null, 2);
}

function compareGateway(currentExpected, proposedExpected) {
  const changes = [];
  if (currentExpected.ws !== proposedExpected.ws) {
    changes.push({
      field: "expectedRemoteGateway.ws",
      expected: currentExpected.ws ?? "",
      actual: proposedExpected.ws ?? ""
    });
  }
  if (currentExpected.http !== proposedExpected.http) {
    changes.push({
      field: "expectedRemoteGateway.http",
      expected: currentExpected.http ?? "",
      actual: proposedExpected.http ?? ""
    });
  }
  if ((currentExpected.tokenHeader ?? "").toLowerCase() !== (proposedExpected.tokenHeader ?? "").toLowerCase()) {
    changes.push({
      field: "expectedRemoteGateway.tokenHeader",
      expected: currentExpected.tokenHeader ?? "",
      actual: proposedExpected.tokenHeader ?? ""
    });
  }
  const currentScopes = stableStringify((currentExpected.authScopes ?? []).slice().sort());
  const proposedScopes = stableStringify((proposedExpected.authScopes ?? []).slice().sort());
  if (currentScopes !== proposedScopes) {
    changes.push({
      field: "expectedRemoteGateway.authScopes",
      expected: JSON.parse(currentScopes),
      actual: JSON.parse(proposedScopes)
    });
  }
  return changes;
}

function printLiveEvidence(sources, live, commit) {
  log("log", `OpenClaw commit: ${commit}`);
  log("log", `Source files used: config=[${sources.config.join(", ")}], server=[${sources.server.join(", ")}], docs=[${sources.docs.join(", ")}]`);
  log("log", `Observed WS URLs: ${live.ws.join(", ") || "none"}`);
  log("log", `Observed HTTP URLs: ${live.http.join(", ") || "none"}`);
  log("log", `Observed token headers: ${live.tokenHeader.join(", ") || "none"}`);
  log("log", `Observed auth scopes: ${live.authScopes.join(", ") || "none"}`);
}

async function promptDecision() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question("Drift detected. Choose action: [a]pply, [r]eject, [e]dit manually: ")).trim().toLowerCase();
    if (answer.startsWith("a")) return "apply";
    if (answer.startsWith("e")) return "edit";
    return "reject";
  } finally {
    rl.close();
  }
}

function mergeAndWriteBaseline(baseline, proposedExpected, commit) {
  const next = {
    ...baseline,
    metadata: {
      ...(baseline.metadata ?? {}),
      lastReviewedAt: new Date().toISOString().slice(0, 10),
      lastVerifiedCommit: commit
    },
    expectedRemoteGateway: {
      ...(baseline.expectedRemoteGateway ?? {}),
      ...proposedExpected
    }
  };
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv);
  emitLogs = !args.dryRun;
  const baseline = readBaseline();
  const repo = baseline.reference?.repo;
  const branch = baseline.reference?.branch ?? "main";
  const sourceCandidates = baseline.reference?.latestSourceCandidates;
  if (!repo || !sourceCandidates) {
    log("error", "baseline missing reference.repo or reference.latestSourceCandidates");
    process.exit(1);
  }

  const interactive = process.stdout.isTTY && process.stdin.isTTY && !args.check && !args.apply;
  let checkoutRoot = "";
  try {
    const cloned = cloneOpenClaw(repo, branch);
    checkoutRoot = cloned.checkoutRoot;

    const configSources = readExistingFiles(cloned.repoPath, sourceCandidates.config ?? []);
    const serverSources = readExistingFiles(cloned.repoPath, sourceCandidates.server ?? []);
    const docsSources = readExistingFiles(cloned.repoPath, sourceCandidates.docs ?? []);
    if (configSources.length === 0 || serverSources.length === 0 || docsSources.length === 0) {
      const missing = [
        configSources.length === 0 ? "config" : null,
        serverSources.length === 0 ? "server" : null,
        docsSources.length === 0 ? "docs" : null
      ].filter(Boolean);
      const message = `unable to locate OpenClaw source candidates for: ${missing.join(", ")}; update baseline latestSourceCandidates`;
      if (args.strict) {
        log("error", message);
        process.exit(1);
      }
      log("warn", message);
      process.exit(0);
    }

    const configText = configSources.map((f) => f.content).join("\n");
    const serverText = serverSources.map((f) => f.content).join("\n");
    const docsText = docsSources.map((f) => f.content).join("\n");
    const live = {
      ws: uniq([...extractWsUrls(configText), ...extractWsUrls(serverText), ...extractWsUrls(docsText)]),
      http: uniq([...extractHttpUrls(configText), ...extractHttpUrls(serverText), ...extractHttpUrls(docsText)]),
      tokenHeader: uniq([...extractTokenHeaders(configText), ...extractTokenHeaders(serverText), ...extractTokenHeaders(docsText)]),
      authScopes: uniq([...extractAuthScopes(configText), ...extractAuthScopes(serverText), ...extractAuthScopes(docsText)])
    };
    printLiveEvidence(
      {
        config: configSources.map((f) => f.path),
        server: serverSources.map((f) => f.path),
        docs: docsSources.map((f) => f.path)
      },
      live,
      cloned.commit
    );

    const currentExpected = baseline.expectedRemoteGateway ?? {};
    const proposedExpected = buildProposedExpectedRemoteGateway(live, currentExpected);
    const changes = compareGateway(currentExpected, proposedExpected);
    if (args.dryRun) {
      const output = {
        status: changes.length === 0 ? "clean" : "drift",
        baselineCommit: baseline.metadata?.lastVerifiedCommit ?? "",
        latestCommit: cloned.commit,
        diff: changes,
        summary: changes.length === 0 ? "No drift" : `${changes.length} field(s) drifted`
      };
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(output, null, 2));
      process.exit(0);
    }

    if (changes.length === 0) {
      log("log", "No compatibility baseline drift detected.");
      process.exit(0);
    }

    log(
      "warn",
      `Drift detected:\n- ${changes
        .map((item) => `${item.field}: ${stableStringify(item.expected)} -> ${stableStringify(item.actual)}`)
        .join("\n- ")}`
    );
    if (args.strict && !args.apply) {
      log("error", "Strict mode enabled and drift present. Run compat:refresh --apply after review.");
      process.exit(1);
    }

    if (args.apply) {
      mergeAndWriteBaseline(baseline, proposedExpected, cloned.commit);
      log("log", "Baseline updated with merged expectedRemoteGateway values.");
      process.exit(0);
    }

    if (args.check || !interactive) {
      log("warn", "Non-interactive/check mode: baseline not modified.");
      process.exit(0);
    }

    const decision = await promptDecision();
    if (decision === "apply") {
      mergeAndWriteBaseline(baseline, proposedExpected, cloned.commit);
      log("log", "Baseline updated with merged expectedRemoteGateway values.");
    } else if (decision === "edit") {
      log("warn", "Edit baseline manually at docs/openclaw-compat-baseline.json and rerun checks.");
    } else {
      log("warn", "Baseline unchanged.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    if (args.strict) {
      log("error", `refresh failed in strict mode: ${message}`);
      process.exit(1);
    }
    log("warn", `refresh skipped/failure tolerated: ${message}`);
    process.exit(0);
  } finally {
    if (checkoutRoot) {
      rmSync(checkoutRoot, { recursive: true, force: true });
    }
  }
}

void main();

