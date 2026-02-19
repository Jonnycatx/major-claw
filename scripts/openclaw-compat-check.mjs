import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const baselinePath = join(root, "docs", "openclaw-compat-baseline.json");
const serverPath = join(root, "services", "gateway", "src", "server.ts");
const wsContractPath = join(root, "docs", "ws-contract.md");

const requireRemote = process.env.OPENCLAW_COMPAT_REQUIRE_REMOTE === "true";
const remoteTimeoutMs = Number(process.env.OPENCLAW_COMPAT_REMOTE_TIMEOUT_MS ?? "8000");
const argMode = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = (argMode?.split("=")[1] ?? "local").toLowerCase();

function pass(message) {
  // eslint-disable-next-line no-console
  console.log(`PASS: ${message}`);
}

function warn(message) {
  // eslint-disable-next-line no-console
  console.warn(`WARN: ${message}`);
}

function fail(message) {
  // eslint-disable-next-line no-console
  console.error(`FAIL: ${message}`);
}

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

function extractMutatingRouteFragments(serverSource) {
  const lines = serverSource.split("\n");
  const routes = [];
  for (const line of lines) {
    const methodMatch = line.match(/req\.method\s===\s"(POST|PATCH|DELETE)"/);
    if (!methodMatch) {
      continue;
    }
    const startsWithMatch = line.match(/req\.url\.startsWith\("([^"]+)"\)/);
    if (startsWithMatch?.[1]) {
      routes.push(startsWithMatch[1]);
      continue;
    }
    const endsWithMatch = line.match(/req\.url\.endsWith\("([^"]+)"\)/);
    if (endsWithMatch?.[1]) {
      routes.push(endsWithMatch[1]);
    }
  }
  return Array.from(new Set(routes));
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOpenClawGatewaySource(candidateUrls) {
  let lastError = null;
  for (const url of candidateUrls) {
    try {
      const source = await fetchWithTimeout(url, remoteTimeoutMs);
      return { url, source };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("all candidate URLs failed");
}

function assertSupportedMode(value) {
  const allowed = new Set(["local", "pinned", "latest", "all"]);
  if (!allowed.has(value)) {
    throw new Error(`unsupported mode '${value}', expected one of: local, pinned, latest, all`);
  }
}

function resolvePinnedUrls(reference) {
  const commit = reference.pinnedCommit;
  if (typeof commit !== "string" || !commit.trim()) {
    throw new Error("reference.pinnedCommit is required for pinned mode");
  }
  const templates = reference.candidateGatewayRawUrlsPinned;
  if (!Array.isArray(templates) || templates.length === 0) {
    throw new Error("reference.candidateGatewayRawUrlsPinned must be a non-empty array");
  }
  return templates.map((template) => String(template).replaceAll("{commit}", commit));
}

async function runRemoteCheck(candidateUrls, requiredMarkers, label) {
  const remote = await fetchOpenClawGatewaySource(candidateUrls);
  const sourceLower = remote.source.toLowerCase();
  const missingRemoteMarkers = requiredMarkers.filter((marker) => !sourceLower.includes(marker));
  if (missingRemoteMarkers.length > 0) {
    throw new Error(`${label} marker check failed (${remote.url}): missing ${missingRemoteMarkers.join(", ")}`);
  }
  pass(`${label} compatibility probe passed (${remote.url})`);
}

async function runSnapshotCheck(snapshotPath, requiredMarkers, label) {
  const raw = await readFile(join(root, snapshotPath), "utf8");
  const sourceLower = raw.toLowerCase();
  const missingMarkers = requiredMarkers.filter((marker) => !sourceLower.includes(marker));
  if (missingMarkers.length > 0) {
    throw new Error(`${label} marker check failed (${snapshotPath}): missing ${missingMarkers.join(", ")}`);
  }
  pass(`${label} compatibility snapshot passed (${snapshotPath})`);
}

async function run() {
  assertSupportedMode(mode);
  const baseline = await readJson(baselinePath);
  const [serverSource, wsContract] = await Promise.all([
    readFile(serverPath, "utf8"),
    readFile(wsContractPath, "utf8")
  ]);

  const mutatingRoutes = extractMutatingRouteFragments(serverSource);
  const missingRouteFragments = baseline.expectedLocalContract.mutatingRouteFragments.filter(
    (fragment) => !mutatingRoutes.includes(fragment)
  );
  if (missingRouteFragments.length > 0) {
    fail(`Local mutating route drift: missing ${missingRouteFragments.join(", ")}`);
    process.exit(1);
  }
  pass(`Local mutating route baseline matched (${baseline.expectedLocalContract.mutatingRouteFragments.length} checks)`);

  const missingAuthMarkers = baseline.expectedLocalContract.authMarkers.filter((marker) => !serverSource.includes(marker));
  if (missingAuthMarkers.length > 0) {
    fail(`Local auth model drift: missing ${missingAuthMarkers.join(", ")}`);
    process.exit(1);
  }
  pass("Local auth marker baseline matched");

  const missingConfigMarkers = baseline.expectedLocalContract.configMarkers.filter((marker) => !serverSource.includes(marker));
  if (missingConfigMarkers.length > 0) {
    fail(`Local config loading drift: missing ${missingConfigMarkers.join(", ")}`);
    process.exit(1);
  }
  pass("Local config marker baseline matched");

  if (!wsContract.includes("Canonical Task Status")) {
    fail("ws-contract is missing canonical status section");
    process.exit(1);
  }
  pass("WS contract document shape looks valid");

  const remoteChecks = [];
  if (mode === "pinned" || mode === "all") {
    const snapshotPath = baseline.reference.pinnedGatewaySnapshotPath;
    if (typeof snapshotPath === "string" && snapshotPath.trim()) {
      try {
        await runSnapshotCheck(snapshotPath, baseline.reference.requiredMarkers, "OpenClaw pinned snapshot");
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        fail(`Pinned snapshot check failed: ${message}`);
        process.exit(1);
      }
    } else {
      remoteChecks.push({
        label: "Remote OpenClaw (pinned)",
        urls: resolvePinnedUrls(baseline.reference)
      });
    }
  }
  if (mode === "latest" || mode === "all") {
    remoteChecks.push({
      label: "Remote OpenClaw (latest main)",
      urls: baseline.reference.candidateGatewayRawUrlsLatest
    });
  }

  for (const check of remoteChecks) {
    try {
      await runRemoteCheck(check.urls, baseline.reference.requiredMarkers, check.label);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      if (requireRemote) {
        fail(`${check.label} check required but failed: ${message}`);
        process.exit(1);
      } else {
        warn(`${check.label} skipped/failure tolerated: ${message}`);
      }
    }
  }

  pass(`OpenClaw compatibility check complete (mode=${mode})`);
}

void run();

