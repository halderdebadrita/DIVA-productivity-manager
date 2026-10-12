// Runs the reminder job against a running Diva server (local dev or deployed).
// Usage: npm run reminders            (uses APP_URL / CRON_SECRET from .env.local)
import fs from "node:fs";
const env = Object.fromEntries(
  (fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "")
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const url = (process.env.APP_URL || env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.CRON_SECRET || env.CRON_SECRET || "";
const res = await fetch(`${url}/api/cron/reminders`, { headers: secret ? { authorization: `Bearer ${secret}` } : {} });
console.log(res.status, JSON.stringify(await res.json(), null, 2));
