// Platform UI: chat with the Chef-Agent, live office, approvals. No build step on purpose.
const AGENT = "chef";
const $ = (id) => document.getElementById(id);
const state = { token: readToken(), agents: [], lastEventId: 0 };

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
  const parts = String(text).split(/(https?:\/\/[^\s)]+)/g);
  for (const part of parts) {
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

function addApprovalCard(approvalId, tool, summary) {
  if (document.querySelector(`[data-approval="${approvalId}"]`)) return;
  const card = el("div", "card");
  card.dataset.approval = approvalId;
  card.append(el("strong", "", `Freigabe nötig: ${tool}`), el("div", "", summary || ""));
  const actions = el("div", "actions");
  const yes = el("button", "", "Freigeben");
  const no = el("button", "secondary", "Ablehnen");
  yes.onclick = () => decide(approvalId, "approve", card);
  no.onclick = () => decide(approvalId, "reject", card);
  actions.append(yes, no);
  card.append(actions);
  $("messages").append(card);
  card.scrollIntoView({ block: "end" });
}

async function decide(approvalId, decision, card) {
  card.querySelectorAll("button").forEach((button) => (button.disabled = true));
  const pending = addMessage("assistant", decision === "approve" ? "Führe aus …" : "Abgelehnt, ich melde mich …", "pending");
  try {
    const result = await api(`/api/approvals/${approvalId}`, { method: "POST", body: JSON.stringify({ decision }) });
    pending.remove();
    card.querySelector(".actions").replaceWith(el("div", "muted", decision === "approve" ? (result.ok ? "Ausgeführt." : "Fehlgeschlagen.") : "Abgelehnt."));
    if (result.reply) addMessage("assistant", result.reply);
  } catch (error) {
    pending.textContent = `Fehler: ${error.message}`;
  }
  loadApprovals();
}

const STATUS = { thinking: "working", tool_call: "working", tool_result: "working", model_result: "working", user_message: "working", approval_requested: "waiting", error: "error", budget_blocked: "error" };

function renderAgents() {
  const list = $("agents");
  list.replaceChildren(...state.agents.map((agent) => {
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
    case "budget_blocked": return ["Budget", `aufgebraucht (${d.spent} / ${d.budget} $)`];
    case "error": return ["Fehler", d.message];
    default: return [event.type, JSON.stringify(d)];
  }
}

function addEvent(event) {
  if (event.id <= state.lastEventId) return;
  state.lastEventId = event.id;
  const [title, text] = describe(event);
  const item = el("li", event.type);
  item.append(el("b", "", `${new Date(event.ts).toLocaleTimeString("de-DE")} ${title} `), document.createTextNode(String(text ?? "").slice(0, 300)));
  $("events").prepend(item);
  while ($("events").children.length > 200) $("events").lastChild.remove();

  const agent = state.agents.find((a) => a.id === event.agentId);
  if (agent) { agent.last_event = event.type; renderAgents(); }
  if (event.type === "approval_requested") { addApprovalCard(event.data.approvalId, event.data.tool, event.data.summary); loadApprovals(); }
}

async function loadApprovals() {
  const approvals = await api("/api/approvals?status=pending");
  $("approvals").replaceChildren(...(approvals.length ? approvals.map((approval) => {
    const item = el("li");
    item.append(el("span", "", `${approval.action} · ${approval.agent_id}`));
    const actions = el("div", "actions");
    const yes = el("button", "", "Freigeben");
    const no = el("button", "secondary", "Ablehnen");
    const card = document.querySelector(`[data-approval="${approval.id}"]`) || item;
    yes.onclick = () => decide(approval.id, "approve", card);
    no.onclick = () => decide(approval.id, "reject", card);
    actions.append(yes, no);
    item.append(actions);
    return item;
  }) : [el("li", "muted", "Nichts offen.")]));
}

let heartbeat;
function connectLive() {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${scheme}://${location.host}/api/live?token=${encodeURIComponent(state.token)}`);
  socket.onopen = () => { $("live").textContent = "live"; $("live").classList.add("on"); };
  socket.onmessage = (message) => {
    try {
      const data = JSON.parse(message.data);
      if (data.type === "event") addEvent(data.event);
    } catch { /* pong */ }
  };
  socket.onclose = () => {
    $("live").textContent = "offline"; $("live").classList.remove("on");
    setTimeout(connectLive, 3000);
  };
  clearInterval(heartbeat);
  heartbeat = setInterval(() => socket.readyState === 1 && socket.send("ping"), 25000);
}

async function send(event) {
  event.preventDefault();
  const text = $("input").value.trim();
  if (!text) return;
  $("input").value = "";
  $("send").disabled = true;
  addMessage("user", text);
  const pending = addMessage("assistant", "arbeitet …", "pending");
  try {
    const result = await api(`/api/agents/${AGENT}/chat`, { method: "POST", body: JSON.stringify({ text }) });
    pending.remove();
    addMessage("assistant", result.reply);
  } catch (error) {
    pending.textContent = `Fehler: ${error.message}`;
  } finally {
    $("send").disabled = false;
    $("input").focus();
  }
}

async function start() {
  try {
    state.agents = await api("/api/agents");
  } catch (error) {
    if (error.status === 401) { $("login").hidden = false; $("app").hidden = true; return; }
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
  (await api("/api/events?limit=120")).forEach(addEvent);
  await loadApprovals();
  connectLive();
}

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  state.token = $("token").value.trim();
  saveToken(state.token);
  $("login-error").hidden = true;
  await start().catch(() => ($("login-error").hidden = false));
  if (!$("app").hidden) return;
  $("login-error").hidden = false;
});
$("composer").addEventListener("submit", send);
$("input").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); $("composer").requestSubmit(); }
});

start().catch((error) => addMessage("assistant", `Fehler beim Laden: ${error.message}`));
