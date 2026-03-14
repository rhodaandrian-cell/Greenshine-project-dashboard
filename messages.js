// messages.js
document.addEventListener("DOMContentLoaded", () => {
  const ALERTS_KEY = "greenshine_truth_alerts_v1";

  const byId = (id) => document.getElementById(id);

  const els = {
    unreadCount: byId("unreadCount"),
    totalMessagesCount: byId("totalMessagesCount"),
    messageSearch: byId("messageSearch"),
    messageFilter: byId("messageFilter"),
    messagesList: byId("messagesList"),
    messagesEmpty: byId("messagesEmpty"),
    btnMarkAllRead: byId("btnMarkAllRead"),
    btnClearAllMessages: byId("btnClearAllMessages"),
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function loadAlerts() {
    try {
      const raw = localStorage.getItem(ALERTS_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveAlerts(alerts) {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts || []));
  }

  function getAlerts() {
    return loadAlerts()
      .slice()
      .sort((a, b) => {
        const ta = new Date(a?.time || 0).getTime() || 0;
        const tb = new Date(b?.time || 0).getTime() || 0;
        return tb - ta;
      });
  }

  function unreadCount(alerts) {
    return (alerts || []).filter((a) => !a.read).length;
  }

  function formatType(type) {
    switch (String(type || "").trim()) {
      case "new-student":
        return "New Student";
      case "new-receipt":
        return "New Receipt";
      case "finance-without-receipt":
        return "Finance Updated Without Receipt";
      case "finance-undefined":
        return "Undefined Finance Field";
      case "identity-incomplete":
        return "Identity Incomplete";
      default:
        return "Alert";
    }
  }

  function formatTime(iso) {
    const d = new Date(iso || "");
    if (Number.isNaN(d.getTime())) return "Unknown time";
    return d.toLocaleString();
  }

  function matchesFilter(alert, filterValue) {
    const filter = String(filterValue || "ALL").trim();

    if (filter === "ALL") return true;
    if (filter === "UNREAD") return !alert.read;

    return String(alert.type || "") === filter;
  }

  function matchesSearch(alert, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;

    const haystack = [
      alert.title,
      alert.body,
      alert.type,
      alert.time,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  }

  function filteredAlerts() {
    const alerts = getAlerts();
    const q = els.messageSearch?.value || "";
    const filter = els.messageFilter?.value || "ALL";

    return alerts.filter((alert) => {
      return matchesFilter(alert, filter) && matchesSearch(alert, q);
    });
  }

  function updateSummary(allAlerts) {
    if (els.unreadCount) {
      els.unreadCount.textContent = String(unreadCount(allAlerts));
    }

    if (els.totalMessagesCount) {
      els.totalMessagesCount.textContent = String((allAlerts || []).length);
    }
  }

  function markOneRead(id) {
    const alerts = getAlerts().map((alert) => {
      if (String(alert.id) === String(id)) {
        return { ...alert, read: true };
      }
      return alert;
    });

    saveAlerts(alerts);
    render();
  }

  function deleteOne(id) {
    const alerts = getAlerts().filter((alert) => String(alert.id) !== String(id));
    saveAlerts(alerts);
    render();
  }

  function render() {
    const allAlerts = getAlerts();
    const alerts = filteredAlerts();

    updateSummary(allAlerts);

    if (!els.messagesList || !els.messagesEmpty) return;

    els.messagesList.innerHTML = "";

    if (!alerts.length) {
      els.messagesEmpty.classList.remove("hidden");
      return;
    }

    els.messagesEmpty.classList.add("hidden");

    alerts.forEach((alert) => {
      const card = document.createElement("article");
      card.className = `message-card ${alert.read ? "" : "unread"}`;

      card.innerHTML = `
        <div class="message-head">
          <div class="message-head-left">
            <h3 class="message-title">${escapeHtml(alert.title || "Alert")}</h3>
            <div class="message-meta">
              <span class="message-time">${escapeHtml(formatTime(alert.time))}</span>
            </div>
          </div>

          <span class="message-type ${escapeHtml(alert.type || "")}">
            ${escapeHtml(formatType(alert.type))}
          </span>
        </div>

        <p class="message-body">${escapeHtml(alert.body || "")}</p>

        <div class="message-actions">
          <button class="btn" type="button" data-action="read" data-id="${escapeHtml(alert.id)}" ${alert.read ? "disabled" : ""}>
            ${alert.read ? "Read" : "Mark as Read"}
          </button>
          <button class="btn btn-ghost" type="button" data-action="delete" data-id="${escapeHtml(alert.id)}">
            Delete
          </button>
        </div>
      `;

      card.querySelector('[data-action="read"]')?.addEventListener("click", () => {
        markOneRead(alert.id);
      });

      card.querySelector('[data-action="delete"]')?.addEventListener("click", () => {
        deleteOne(alert.id);
      });

      els.messagesList.appendChild(card);
    });
  }

  els.messageSearch?.addEventListener("input", render);
  els.messageFilter?.addEventListener("change", render);

  els.btnMarkAllRead?.addEventListener("click", () => {
    const alerts = getAlerts().map((alert) => ({ ...alert, read: true }));
    saveAlerts(alerts);
    render();
  });

  els.btnClearAllMessages?.addEventListener("click", () => {
    const ok = window.confirm("Clear all finance alerts?");
    if (!ok) return;

    saveAlerts([]);
    render();
  });

  render();
});