# Who Will Date Armstrong? — voting prototype

A small, dependency-free demo with a voting page, a live aggregate dashboard, and a local Node.js server that saves ballots in `data/votes.json`.

## Run it

1. Install Node.js 18 or newer.
2. From this folder, run `npm start`.
3. Open `http://127.0.0.1:3000`.

Run the API checks with `npm test`.

## Try it out

- Contestants Jessica, Loveth, and Peace are configured in `server.js`. Replace their names there before using the page for a different lineup.
- The contestant cards use original feminine-styled vector illustrations in `public/portraits`; they are not AI-generated photographs. Replace those files with approved contestant photos when available.
- Cast a vote; the dashboard refreshes about every five seconds.
- Votes are stored on this computer in `data/votes.json` and remain after a server restart.
- The local vote file is excluded from Git so private/local demo results are not uploaded with the source.
- The demo limits repeat votes by a browser-generated ID. Clearing browser storage or using another device can bypass that limit.

## Before accepting real votes

This is a local prototype, not a production voting service. The browser ID is not a verified identity, the dashboard/API are not protected by an administrator login, and the JSON file is not appropriate for concurrent multi-server hosting or independent auditing. GitHub Pages serves static files and cannot run this Node.js voting API; public live voting requires a deployed server and shared database. Do not publish it as-is or use its results to award a real prize.

For a real contest, first obtain entrants' consent and publish eligibility, dates, tie-break, privacy, and prize rules (including the currency and what “20 million” means). Then deploy over HTTPS with an authenticated voter process appropriate to the rules, server-side duplicate-vote controls, rate limiting and abuse monitoring, a transactional database with an audit trail and backups, and a role-protected admin dashboard. Track totals, vote share, turnout over time, invalid/duplicate attempts, and unusual voting spikes; keep personal data minimal and access-controlled. Independently verify the final tally before announcing a winner.
