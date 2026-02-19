import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const baselinePath = join(root, "docs", "openclaw-compat-baseline.json");
const strict = process.env.OPENCLAW_COMPAT_REQUIRE_REMOTE === "true";

function log(kind, message) {
  const prefix = kind.toUpperCase();
  // eslint-disable-next-line no-console
  console[kind === "error" ? "error" : kind === "warn" ? "warn" : "log"](`${prefix}: ${message}`);
}

function readBaseline() {
  const raw = readFileSync(baselinePath, "utf8");
  return JSON.parse(raw);
}

function cloneOpenClaw(repo, branch) {
  const checkoutRoot = mkdtempSync(join(tmpdir(), "openclaw-compat-"));
  const repoPath = join(checkoutRoot, "openclaw");
  execFileSync("git", ["clone", "--depth", "1", "--branch", branch, `https://github.com/${repo}.git`, repoPath], {
    stdio: "pipe"
  });
  return { checkoutRoot, repoPath };
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

function uniq(items) {
  return Array.from(new Set(items));
}

function extractWsUrls(text) {
  return uniq(Array.from(text.matchAll(/ws:\/\/[^\s"'`]+/gi)).map((match) => match[0]));
}

function extractHttpUrls(text) {
  return uniq(Array.from(text.matchAll(/http:\/\/[^\s"'`]+/gi)).map((match) => match[0]));
}

function extractTokenHeaders(text) {
  const candidates = [
    ...Array.from(text.matchAll(/x-[a-z0-9-]*session[a-z0-9-]*/gi)).map((m) => m[0]),
    ...Array.from(text.matchAll(/x-[a-z0-9-]*token[a-z0-9-]*/gi)).map((m) => m[0])
  ];
  return uniq(candidates.map((value) => value.toLowerCase()));
}

function extractAuthScopes(text) {
  return uniq(Array.from(text.matchAll(/\b(?:operator|agent|vault)\.[a-z_]+\b/gi)).map((m) => m[0].toLowerCase()));
}

function compareAgainstBaseline(live, expected) {
  const drift = [];
  if (typeof expected.ws === "string" && expected.ws.trim()) {
    if (!live.ws.includes(expected.ws)) {
      drift.push(`WS URL drift: expected '${expected.ws}', got [${live.ws.join(", ") || "none"}]`);
    }
  }
  if (typeof expected.http === "string" && expected.http.trim()) {
    if (!live.http.includes(expected.http)) {
      drift.push(`HTTP URL drift: expected '${expected.http}', got [${live.http.join(", ") || "none"}]`);
    }
  }
  if (typeof expected.tokenHeader === "string" && expected.tokenHeader.trim()) {
    if (!live.tokenHeader.includes(expected.tokenHeader.toLowerCase())) {
      drift.push(
        `Token header drift: expected '${expected.tokenHeader.toLowerCase()}', got [${live.tokenHeader.join(", ") || "none"}]`
      );
    }
  }
  if (Array.isArray(expected.authScopes) && expected.authScopes.length > 0) {
    const missing = expected.authScopes.map((item) => item.toLowerCase()).filter((scope) => !live.authScopes.includes(scope));
    if (missing.length > 0) {
      drift.push(`Auth scopes drift: missing [${missing.join(", ")}], got [${live.authScopes.join(", ") || "none"}]`);
    }
  }
  return drift;
}

function printEvidence(sources, live) {
  log("log", `Using source files: config=[${sources.config.join(", ")}], server=[${sources.server.join(", ")}], docs=[${sources.docs.join(", ")}]`);
  log("log", `Observed WS URLs: ${live.ws.join(", ") || "none"}`);
  log("log", `Observed HTTP URLs: ${live.http.join(", ") || "none"}`);
  log("log", `Observed token headers: ${live.tokenHeader.join(", ") || "none"}`);
  log("log", `Observed auth scopes: ${live.authScopes.join(", ") || "none"}`);
}

function main() {
  const baseline = readBaseline();
  const repo = baseline.reference?.repo;
  const branch = baseline.reference?.branch ?? "main";
  const sourceCandidates = baseline.reference?.latestSourceCandidates;
  const expectedRemoteGateway = baseline.expectedRemoteGateway ?? {};

  if (!repo || !sourceCandidates) {
    log("error", "baseline missing reference.repo or reference.latestSourceCandidates");
    process.exit(1);
  }

  let checkoutRoot = "";
  try {
    const cloned = cloneOpenClaw(repo, branch);
    checkoutRoot = cloned.checkoutRoot;

    const configSources = readExistingFiles(cloned.repoPath, sourceCandidates.config ?? []);
    const serverSources = readExistingFiles(cloned.repoPath, sourceCandidates.server ?? []);
    const docsSources = readExistingFiles(cloned.repoPath, sourceCandidates.docs ?? []);

    const missingSources = [];
    if (configSources.length === 0) missingSources.push("config");
    if (serverSources.length === 0) missingSources.push("server");
    if (docsSources.length === 0) missingSources.push("docs");
    if (missingSources.length > 0) {
      const message = `unable to locate OpenClaw source candidates for: ${missingSources.join(", ")}; update latestSourceCandidates in baseline`;
      if (strict) {
        log("error", message);
        process.exit(1);
      }
      log("warn", message);
      process.exit(0);
    }

    const configText = configSources.map((item) => item.content).join("\n");
    const serverText = serverSources.map((item) => item.content).join("\n");
    const docsText = docsSources.map((item) => item.content).join("\n");

    const live = {
      ws: uniq([
        ...extractWsUrls(configText),
        ...extractWsUrls(serverText),
        ...extractWsUrls(docsText)
      ]),
      http: uniq([
        ...extractHttpUrls(configText),
        ...extractHttpUrls(serverText),
        ...extractHttpUrls(docsText)
      ]),
      tokenHeader: uniq([...extractTokenHeaders(configText), ...extractTokenHeaders(serverText), ...extractTokenHeaders(docsText)]),
      authScopes: uniq([...extractAuthScopes(configText), ...extractAuthScopes(serverText), ...extractAuthScopes(docsText)])
    };

    printEvidence(
      {
        config: configSources.map((item) => item.path),
        server: serverSources.map((item) => item.path),
        docs: docsSources.map((item) => item.path)
      },
      live
    );

    const drift = compareAgainstBaseline(live, expectedRemoteGateway);
    if (drift.length > 0) {
      const message = `OpenClaw latest compatibility drift detected:\n- ${drift.join("\n- ")}`;
      if (strict) {
        log("error", message);
        process.exit(1);
      }
      log("warn", message);
      process.exit(0);
    }

    log("log", "OpenClaw latest compatibility verified");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    if (strict) {
      log("error", `latest compatibility check failed: ${message}`);
      process.exit(1);
    }
    log("warn", `latest compatibility check skipped/failure tolerated: ${message}`);
  } finally {
    if (checkoutRoot) {
      rmSync(checkoutRoot, { recursive: true, force: true });
    }
  }
}

main();

