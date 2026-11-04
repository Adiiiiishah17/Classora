// "class 10", "Class 10" and "10" all become "10". Sections like "10-A" are not allowed.
function normalizeClass(s) {
  return String(s ?? "").trim().replace(/^class\s+/i, "").trim().toUpperCase();
}

// One word of letters and numbers. "10A" is refused because it looks like a section.
const CLASS_RE = /^(?!\d+\p{L}$)[\p{L}\p{N}]{1,20}$/u;

module.exports = { normalizeClass, CLASS_RE };