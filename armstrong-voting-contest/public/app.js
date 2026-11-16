const entrantList = document.querySelector("#entrant-list");
const voteMessage = document.querySelector("#vote-message");
const voterStorageKey = "armstrong-voter-id";
const votedStorageKey = "armstrong-vote-cast";

function getVoterId() {
  let voterId = localStorage.getItem(voterStorageKey);
  if (!voterId) {
    voterId = crypto.randomUUID();
    localStorage.setItem(voterStorageKey, voterId);
  }
  return voterId;
}

function showMessage(message, isError = false) {
  voteMessage.textContent = message;
  voteMessage.classList.toggle("error", isError);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function renderEntrants(state) {
  const hasVoted = localStorage.getItem(votedStorageKey) === "true";
  entrantList.innerHTML = state.nominees.map((entrant, index) => `
    <article class="entrant-card">
      <div class="portrait-wrap">
        <span class="entrant-number">${escapeHtml(entrant.note)}</span>
        <img class="entrant-portrait" src="${escapeHtml(entrant.portrait)}" alt="Illustrated portrait for ${escapeHtml(entrant.name)}">
        <span class="portrait-spark" aria-hidden="true">✳</span>
      </div>
      <div class="entrant-details">
        <h3 class="entrant-name">${escapeHtml(entrant.name)}</h3>
        <p class="entrant-note">Who’s your pick?</p>
        <button class="vote-button" type="button" data-nominee="${escapeHtml(entrant.id)}" aria-label="Vote for ${escapeHtml(entrant.name)}" ${hasVoted ? "disabled" : ""}>
          ${hasVoted ? "Vote recorded" : "Choose"} <span aria-hidden="true">↗</span>
        </button>
      </div>
    </article>
  `).join("");
}

function renderDashboard(state) {
  document.querySelector("#total-votes").textContent = state.totalVotes.toLocaleString();
  const countValues = state.nominees.map((entrant) => ({
    entrant,
    count: state.counts[entrant.id] || 0
  }));
  const leader = countValues.reduce((best, current) => current.count > best.count ? current : best, countValues[0]);
  const tied = countValues.filter((item) => item.count === leader.count).length > 1;
  const leaderName = state.totalVotes === 0 ? "Waiting for votes" : tied ? "It's a tie" : leader.entrant.name;
  document.querySelector("#leader-name").textContent = leaderName;
  document.querySelector("#leader-share").textContent = state.totalVotes === 0
    ? "The standings update automatically"
    : `${leader.count.toLocaleString()} vote${leader.count === 1 ? "" : "s"} so far`;

  document.querySelector("#results-list").innerHTML = countValues.map(({ entrant, count }) => {
    const share = state.totalVotes ? Math.round((count / state.totalVotes) * 100) : 0;
    return `<div class="result-row">
      <div class="result-topline"><span>${escapeHtml(entrant.name)}</span></div>
      <div class="result-track" role="progressbar" aria-label="${escapeHtml(entrant.name)} vote share" aria-valuenow="${share}" aria-valuemin="0" aria-valuemax="100">
        <div class="result-fill" style="width: ${share}%"></div>
      </div>
      <span class="result-share">${share}%</span>
    </div>`;
  }).join("");

  const recent = state.recentVotes;
  document.querySelector("#activity-list").innerHTML = recent.length
    ? recent.map((vote) => {
      const entrant = state.nominees.find((item) => item.id === vote.nomineeId);
      return `<div class="activity-row">
        <span class="activity-name">${escapeHtml(entrant ? entrant.name : "Entrant")}</span>
        <time class="activity-time" datetime="${escapeHtml(vote.createdAt)}">${formatTime(vote.createdAt)}</time>
      </div>`;
    }).join("")
    : '<p class="loading">Waiting for the first vote.</p>';
}

async function refreshState() {
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load live results.");
  const state = await response.json();
  renderEntrants(state);
  renderDashboard(state);
}

entrantList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-nominee]");
  if (!button || button.disabled) return;
  button.disabled = true;
  showMessage("Recording your vote…");

  try {
    const response = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomineeId: button.dataset.nominee, voterId: getVoterId() })
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 409) localStorage.setItem(votedStorageKey, "true");
      throw new Error(result.error || "Your vote could not be recorded.");
    }
    localStorage.setItem(votedStorageKey, "true");
    showMessage("Your vote is in. Thanks for taking part!");
    await refreshState();
  } catch (error) {
    showMessage(error.message || "Could not reach the voting server. Please try again.", true);
    if (localStorage.getItem(votedStorageKey) !== "true") button.disabled = false;
  }
});

refreshState().catch((error) => {
  entrantList.innerHTML = '<p class="loading">Could not load the contest. Check that the local server is running.</p>';
  showMessage(error.message, true);
});
window.setInterval(() => {
  refreshState().catch((error) => showMessage(error.message, true));
}, 5000);
