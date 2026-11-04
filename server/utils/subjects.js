const Subject = require("../models/Subject");

// "maths" / "MATHS " / "Maths" all become "Maths"
const normalizeSubject = (s) =>
  String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

const SUBJECT_RE = /^[\p{L}\p{N} &+.'-]{1,50}$/u;

function uniqueList(list) {
  const seen = new Set();
  return list.filter((n) => {
    const k = n.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Adds any new subject names to the shared dropdown list
async function ensureSubjects(names) {
  const list = uniqueList((names || []).map(normalizeSubject).filter(Boolean));
  if (!list.length) return;
  try {
    await Subject.bulkWrite(
      list.map((name) => ({
        updateOne: {
          filter: { key: name.toLowerCase() },
          update: { $setOnInsert: { name, key: name.toLowerCase() } },
          upsert: true,
        },
      }))
    );
  } catch (err) {
    if (err.code !== 11000) throw err; // two people adding the same subject at once is fine
  }
}

module.exports = { normalizeSubject, SUBJECT_RE, uniqueList, ensureSubjects };