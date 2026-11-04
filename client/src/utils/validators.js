export const PHONE_HINT = "Enter a 10-digit mobile number starting with 6, 7, 8 or 9.";

// Keeps digits only, max 10. Pasting "+91 98765 43210" also works.
export function cleanPhone(raw) {
  const s = String(raw ?? "").trim();
  let d = s.replace(/\D/g, "");
  if (/^\+\s*91/.test(s)) d = d.slice(2);
  else if (/^0091/.test(s.replace(/\s/g, ""))) d = d.slice(4);
  return d.slice(0, 10);
}

export const isValidPhone = (p) => /^[6-9]\d{9}$/.test(String(p ?? ""));

// name@domain.tld, with a real ending like .com or .in
export const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(String(e ?? "").trim());