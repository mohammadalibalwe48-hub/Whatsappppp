const rows: any[] = [];
for (let i = 0; i < 10000; i++) {
  const status = ["verified", "failed", "expired", "pending", "unknown"][i % 5];
  const created_at = new Date(Date.now() - (i % 30) * 24 * 60 * 60 * 1000).toISOString();
  rows.push({ status, created_at });
}

function original() {
  const totals = {
    sent: rows.length,
    verified: rows.filter((r) => r.status === "verified").length,
    failed: rows.filter((r) => r.status === "failed").length,
    expired: rows.filter((r) => r.status === "expired").length,
    pending: rows.filter((r) => r.status === "pending").length
  };

  const buckets: Record<string, { sent: number; verified: number; failed: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { sent: 0, verified: 0, failed: 0 };
  }
  for (const r of rows) {
    const key = (r.created_at as string).slice(0, 10);
    const bucket = buckets[key];
    if (!bucket) continue;
    bucket.sent += 1;
    if (r.status === "verified") bucket.verified += 1;
    if (r.status === "failed") bucket.failed += 1;
  }
  return totals;
}

function twoLoops() {
  const totals = { sent: rows.length, verified: 0, failed: 0, expired: 0, pending: 0 };
  for (let i = 0; i < rows.length; i++) {
    const s = rows[i].status;
    if (s === "verified") totals.verified++;
    else if (s === "failed") totals.failed++;
    else if (s === "expired") totals.expired++;
    else if (s === "pending") totals.pending++;
  }

  const buckets: Record<string, { sent: number; verified: number; failed: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { sent: 0, verified: 0, failed: 0 };
  }
  for (const r of rows) {
    const key = (r.created_at as string).slice(0, 10);
    const bucket = buckets[key];
    if (!bucket) continue;
    bucket.sent += 1;
    if (r.status === "verified") bucket.verified += 1;
    if (r.status === "failed") bucket.failed += 1;
  }
  return totals;
}

function oneLoop() {
  const totals = { sent: rows.length, verified: 0, failed: 0, expired: 0, pending: 0 };
  const buckets: Record<string, { sent: number; verified: number; failed: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { sent: 0, verified: 0, failed: 0 };
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const s = r.status;
    if (s === "verified") totals.verified++;
    else if (s === "failed") totals.failed++;
    else if (s === "expired") totals.expired++;
    else if (s === "pending") totals.pending++;

    const key = (r.created_at as string).slice(0, 10);
    const bucket = buckets[key];
    if (bucket) {
      bucket.sent += 1;
      if (s === "verified") bucket.verified += 1;
      if (s === "failed") bucket.failed += 1;
    }
  }

  return totals;
}

console.time("original (4 filters + 1 map)");
for (let i = 0; i < 1000; i++) original();
console.timeEnd("original (4 filters + 1 map)");

console.time("two loops");
for (let i = 0; i < 1000; i++) twoLoops();
console.timeEnd("two loops");

console.time("one loop");
for (let i = 0; i < 1000; i++) oneLoop();
console.timeEnd("one loop");
