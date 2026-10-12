import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const chatSource = readFileSync(
  path.resolve(process.cwd(), "components/partners/PartnerChat.tsx"),
  "utf8",
);
const pageSource = readFileSync(
  path.resolve(process.cwd(), "app/(workspace)/partners/[partnerId]/page.tsx"),
  "utf8",
);
const archiveSource = readFileSync(
  path.resolve(process.cwd(), "components/partners/PartnerArchives.tsx"),
  "utf8",
);

test("partner web chat waits for runtime readiness, not channel running state", () => {
  assert.match(chatSource, /data\.type === "ready"/);
  assert.match(chatSource, /disabled=\{!connected \|\| reconciling \|\| commandBusy \|\| switchingSession/);
  assert.doesNotMatch(chatSource, /if \(!running\)/);
  assert.doesNotMatch(chatSource, /disabled=\{!connected \|\| !running\}/);
});

test("partner views stay separate from page actions", () => {
  const toolbarEnd = pageSource.indexOf("</PageToolbar>");
  const localViews = pageSource.indexOf('<nav className="dt-page-view-tabs">');
  assert.ok(toolbarEnd >= 0 && localViews > toolbarEnd);
  assert.match(pageSource, /className="dt-toolbar-actions"/);
});

test("partner chat keeps old active and archived conversations reachable", () => {
  assert.match(pageSource, /handleArchiveConversation/);
  assert.match(pageSource, /archivePartnerSession\(partnerId, sessionKey\)/);
  assert.match(pageSource, /if \(result\.active_session_key\) selectSessionKey\(result\.active_session_key, true\)/);
  assert.match(archiveSource, /const next = await getPartnerSessions\(partnerId\)/);
  assert.match(archiveSource, /resumePartnerSession/);
});
