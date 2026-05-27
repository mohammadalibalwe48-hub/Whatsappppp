const rows = [];
for (let i = 0; i < 10000; i++) {
  const status = ["verified", "failed", "expired", "pending", "unknown"][i % 5];
  rows.push({ status, created_at: new Date().toISOString() });
}

function original() {
  const totals = {
    sent: rows.length,
    verified: rows.filter((r) => r.status === "verified").length,
    failed: rows.filter((r) => r.status === "failed").length,
    expired: rows.filter((r) => r.status === "expired").length,
    pending: rows.filter((r) => r.status === "pending").length
  };
  return totals;
}

function optimized() {
  const totals = { sent: rows.length, verified: 0, failed: 0, expired: 0, pending: 0 };
  for (let i = 0; i < rows.length; i++) {
    const s = rows[i].status;
    if (s === "verified") totals.verified++;
    else if (s === "failed") totals.failed++;
    else if (s === "expired") totals.expired++;
    else if (s === "pending") totals.pending++;
  }
  return totals;
}

console.time("original");
for (let i = 0; i < 1000; i++) original();
console.timeEnd("original");

console.time("optimized");
for (let i = 0; i < 1000; i++) optimized();
console.timeEnd("optimized");
