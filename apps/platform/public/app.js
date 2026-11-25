// Platform UI: chat with the Chef-Agent, live office, approvals. No build step on purpose.
// Work runs asynchronously in the agent; everything the browser shows arrives as events.
const AGENT = "chef";
const $ = (id) => document.getElementById(id);
const state = { token: readToken(), agents: [], lastEventId: 0, stream: null, running: false, connectedOnce: false };

function readToken() {
  try { return localStorage.getItem("platform-token") || ""; } catch { return ""; }
}
function saveToken(token) {
  try { localStorage.setItem("platform-token", token); } catch { /* storage may be blocked */ }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(state.token ? { authorization: `Bearer ${state.token}` } : {}) },
  });
  if (response.status === 401) throw Object.assign(new Error("unauthorized"), { status: 401 });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function linkify(node, text) {
  node.replaceChildren();
  for (const part of String(text).split(/(https?:\/\/[^\s)]+)/g)) {
    if (/^https?:\/\//.test(part)) {
      const a = el("a", "", part);
      a.href = part; a.target = "_blank"; a.rel = "noopener";
      node.append(a);
    } else node.append(document.createTextNode(part));
  }
  return node;
}

function addMessage(role, text, extra = "") {
  const node = linkify(el("div", `msg ${role} ${extra}`), text);
  $("messages").append(node);
  node.scrollIntoView({ block: "end" });
  return node;
}

// ---- running state ---------------------------------------------------------------------------

function setRunning(running, text = "") {
  state.running = running;
  $("stop").hidden = !running;
  $("status").textContent = running ? text || "arbeitet …" : "";
}

function endStream(finalText) {
  if (state.stream) {
    if (finalText !== undefined) linkify(state.stream.node, finalText);
    state.stream.node.classList.remove("streaming");
    state.stream = null;
    return true;
  }
  return false;
}

function onDelta(delta) {
  if (delta.agentId !== AGENT) return;
  if (!state.stream || state.stream.step !== delta.step) {
    endStream();
    state.stream = { step: delta.step, text: "", node: addMessage("assistant", "", "streaming") };
  }
  state.stream.text += delta.text;
  linkify(state.stream.node, state.stream.text);
  state.stream.node.scrollIntoView({ block: "end" });
}

// ---- approvals -------------------------------------------------------------------------------

function approvalBody(approval) {
  const parts = [el("div", "", approval.summary || approval.action)];
  for (const warning of approval.warnings || []) parts.push(el("div", "warning", `⚠ ${warning}`));
  if (approval.expires_at) {
    parts.push(el("div", "meta", `läuft ab: ${new Date(approval.expires_at * 1000).toLocaleString("de-DE")}`));
  }
  return parts;
}

function decisionButtons(approvalId) {
  const actions = el("div", "actions");
  const yes = el("button", "", "Freigeben");
  const no = el("button", "secondary", "Ablehnen");
  yes.onclick = () => decide(approvalId, "approve");
  no.onclick = () => decide(approvalId, "reject");
  actions.append(yes, no);
  return actions;
}

function addApprovalCard(approval) {
  if (document.querySelector(`.card[data-approval="${approval.id}"]`)) return;
  const card = el("div", `card ${approval.risk === "security" ? "security" : ""}`);
  card.dataset.approval = approval.id;
  card.append(el("strong", "", `Freigabe nötig: ${approval.action}`), ...approvalBody(approval), decisionButtons(approval.id));
  $("messages").append(card);
  card.scrollIntoView({ block: "end" });
}

function markDecided(approvalId, text) {
  document.querySelectorAll(`[data-approval="${approvalId}"] .actions`).forEach((node) => node.replaceWith(el("div", "meta", text)));
}

async function decide(approvalId, decision) {
  document.querySelectorAll(`[data-approval="${approvalId}"] button`).forEach((button) => (button.disabled = true));
  markDecided(approvalId, decision === "approve" ? "Wird ausgeführt …" : "Abgelehnt.");
  try {
    const result = await api(`/api/approvals/${approvalId}`, { method: "POST", body: JSON.stringify({ decision }) });
    markDecided(approvalId, decision === "approve" ? (result.ok ? "Ausgeführt." : `Fehlgeschlagen: ${result.outcome}`) : "Abgelehnt.");
    setRunning(true, "verarbeitet die Freigabe …");
  } catch (error) {
    markDecided(approvalId, `Fehler: ${error.message}`);
  }
  loadApprovals();
}

async function loadApprovals({ restoreCards = false } = {}) {
  const approvals = await api("/api/approvals?status=pending");
  if (restoreCards) approvals.slice().reverse().forEach(addApprovalCard);
  $("approvals").replaceChildren(...(approvals.length ? approvals.map((approval) => {
    const item = el("li");
    item.dataset.approval = approval.id;
    item.append(el("strong", "", `${approval.action} · ${approval.agent_id}`), ...approvalBody(approval), decisionButtons(approval.id));
    return item;
  }) : [el("li", "muted", "Nichts offen.")]));
}

// ---- agents and activity ---------------------------------------------------------------------

const STATUS = { thinking: "working", tool_call: "working", tool_result: "working", model_result: "working", user_message: "working", stage_paused: "working", approval_requested: "waiting", error: "error", budget_blocked: "error" };

function renderAgents() {
  $("agents").replaceChildren(...state.agents.map((agent) => {
    const item = el("li", "agent");
    item.append(el("span", `dot ${STATUS[agent.last_event] || ""}`), el("span", "", agent.name), el("span", "muted", agent.model_alias));
    return item;
  }));
}

function describe(event) {
  const d = event.data || {};
  switch (event.type) {
    case "user_message": return ["Auftrag", d.text];
    case "thinking": return ["denkt", `Schritt ${d.step}`];
    case "model_result": return ["Modell", `${d.model} · ${event.tokensIn}→${event.tokensOut} Tokens · ${(event.costUsd || 0).toFixed(4)} $`];
    case "tool_call": return [d.tool, d.args];
    case "tool_result": return [`${d.tool} ${d.ok ? "✓" : "✗"}`, d.preview];
    case "approval_requested": return ["Freigabe angefragt", d.summary];
    case "approval_decided": return ["Freigabe", `${d.approved ? "erteilt" : "abgelehnt"} · ${d.tool}`];
    case "message": return ["Antwort", d.text];
    case "stage_paused": return ["Etappe", `${d.stage} beendet nach Schritt ${d.steps}, geht gleich weiter`];
    case "stopped": return ["Gestoppt", `nach Schritt ${d.steps}`];
    case "budget_blocked": return ["Budget", `aufgebraucht (${d.spent} / ${d.budget} $)`];
    case "error": return ["Fehler", d.message];
    default: return [event.type, JSON.stringify(d)];
  }
}

/** live: the event happened now (or was missed while offline), so it also updates the chat. */
function addEvent(event, live) {
  if (event.id <= state.lastEventId) return;
  state.lastEventId = event.id;
  const [title, text] = describe(event);
  const item = el("li", event.type);
  item.append(el("b", "", `${new Date(event.ts).toLocaleTimeString("de-DE")} ${title} `), document.createTextNode(String(text ?? "").slice(0, 300)));
  $("events").prepend(item);
  while ($("events").children.length > 200) $("events").lastChild.remove();

  const agent = state.agents.find((a) => a.id === event.agentId);
  if (agent) { agent.last_event = event.type; renderAgents(); }
  if (!live || event.agentId !== AGENT) return;

  const d = event.data || {};
  switch (event.type) {
    case "thinking": setRunning(true, `arbeitet · Schritt ${d.step}`); break;
    case "tool_call": endStream(); setRunning(true, `nutzt ${d.tool}`); break;
    case "stage_paused": setRunning(true, `Etappe ${d.stage} fertig, geht weiter …`); break;
    case "approval_requested":
      addApprovalCard({ id: d.approvalId, action: d.tool, summary: d.summary, warnings: d.warnings, risk: d.risk });
      loadApprovals();
      break;
    case "message":
      if (!endStream(d.text)) addMessage("assistant", d.text);
      setRunning(false);
      break;
    case "error": endStream(); addMessage("assistant", `Fehler: ${d.message}`, "pending"); setRunning(false); break;
    case "stopped": case "budget_blocked": endStream(); setRunning(false); break;
  }
}

// ---- live connection -------------------------------------------------------------------------

let heartbeat;
async function connectLive() {
  let ticket;
  try {
    ({ ticket } = await api("/api/live-ticket", { method: "POST" }));
  } catch (error) {
    if (error.status === 401) return showLogin();
    return setTimeout(connectLive, 5000);
  }
  // Catch up on what happened while the socket was down.
  if (state.connectedOnce) (await api(`/api/events?since=${state.lastEventId}`).catch(() => [])).forEach((event) => addEvent(event, true));
  state.connectedOnce = true;

  const scheme = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${scheme}://${location.host}/api/live?ticket=${encodeURIComponent(ticket)}`);
  socket.onopen = () => { $("live").textContent = "live"; $("live").classList.add("on"); };
  socket.onmessage = (message) => {
    let data;
    try { data = JSON.parse(message.data); } catch { return; /* pong */ }
    if (data.type === "event") addEvent(data.event, true);
    if (data.type === "delta") onDelta(data);
  };
  socket.onclose = () => {
    $("live").textContent = "offline"; $("live").classList.remove("on");
    setTimeout(connectLive, 3000);
  };
  clearInterval(heartbeat);
  heartbeat = setInterval(() => socket.readyState === 1 && socket.send("ping"), 25000);
}

// ---- actions ---------------------------------------------------------------------------------

async function send(event) {
  event.preventDefault();
  const text = $("input").value.trim();
  if (!text) return;
  $("input").value = "";
  addMessage("user", text);
  try {
    const result = await api(`/api/agents/${AGENT}/chat`, { method: "POST", body: JSON.stringify({ text }) });
    if (result.message) addMessage("assistant", result.message, "pending");
    setRunning(true);
  } catch (error) {
    addMessage("assistant", `Fehler: ${error.message}`, "pending");
  }
  $("input").focus();
}

async function stop() {
  $("stop").disabled = true;
  try { await api(`/api/agents/${AGENT}/stop`, { method: "POST" }); } finally { $("stop").disabled = false; }
  endStream();
  setRunning(false);
}

function showLogin() {
  $("login").hidden = false;
  $("app").hidden = true;
}

async function start() {
  try {
    state.agents = await api("/api/agents");
  } catch (error) {
    if (error.status === 401) return showLogin();
    throw error;
  }
  $("login").hidden = true;
  $("app").hidden = false;
  renderAgents();

  const history = await api(`/api/agents/${AGENT}/history`);
  for (const message of history) {
    if (message.role === "user" && !String(message.content).startsWith("[Plattform]")) addMessage("user", message.content);
    if (message.role === "assistant" && message.content && !message.toolCalls) addMessage("assistant", message.content);
  }
  (await api("/api/events?limit=120")).forEach((event) => addEvent(event, false));
  await loadApprovals({ restoreCards: true });
  const status = await api(`/api/agents/${AGENT}/status`);
  setRunning(status.running, status.running ? `arbeitet · Schritt ${status.step}` : "");
  connectLive();
}

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  state.token = $("token").value.trim();
  saveToken(state.token);
  $("login-error").hidden = true;
  await start().catch(() => ($("login-error").hidden = false));
  if ($("app").hidden) $("login-error").hidden = false;
});
$("composer").addEventListener("submit", send);
$("stop").addEventListener("click", stop);
$("input").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); $("composer").requestSubmit(); }
});

// Marks the dev environment so it is never mistaken for production.
fetch("/api/health").then((response) => response.json()).then(({ env }) => {
  if (env !== "dev") return;
  document.body.classList.add("env-dev");
  document.title = `DEV · ${document.title}`;
}).catch(() => {});

start().catch((error) => addMessage("assistant", `Fehler beim Laden: ${error.message}`));
