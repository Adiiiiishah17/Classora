// Accepts Indian mobile numbers: 9876543210, +91 98765 43210, 098765-43210
function normalizePhone(input) {
  const s = String(input ?? "").replace(/[\s\-().]/g, "");
  const m = s.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  return m ? m[1] : null;
}

module.exports = { normalizePhone };