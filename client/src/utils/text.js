// "Maths, Physics ,  " becomes ["Maths", "Physics"]
export const splitList = (s) =>
  String(s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);