import { useEffect, useState } from "react";
import { api, errMsg } from "../api/client";
import { Alert, Badge, Card, Field } from "./ui";
import Avatar from "./Avatar";

export default function TutorList() {
  const [tutors, setTutors] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/profile/tutors")
      .then((r) => setTutors(r.data.tutors))
      .catch((e) => { setTutors([]); setError(errMsg(e)); });
  }, []);

  if (!tutors) return <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>;

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? tutors.filter((t) => t.name.toLowerCase().includes(needle) || t.subjects.some((s) => s.toLowerCase().includes(needle)))
    : tutors;

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-md">
        <Field label="Search by teacher or subject" placeholder="e.g. Maths" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Alert>{error}</Alert>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((t) => (
          <Card key={t.id} className="bouncy flex flex-col items-center gap-3 text-center">
            <Avatar id={t.id} v={t.photoV} name={t.name} hasPhoto={t.hasPhoto} size="lg" />
            <h3 className="break-words text-lg font-extrabold">{t.name}</h3>
            <div className="flex flex-wrap justify-center gap-1">
              {t.subjects.map((s) => <Badge key={s} tone="green">📚 {s}</Badge>)}
              {!t.subjects.length && <span className="text-xs font-semibold opacity-60">No subjects listed</span>}
            </div>
            <p className="whitespace-pre-line break-words text-sm font-medium opacity-80">
              {t.bio || "This teacher has not written a bio yet."}
            </p>
          </Card>
        ))}
      </div>
      {!shown.length && !error && (
        <p className="text-center text-sm opacity-60">{tutors.length ? "No teacher matches your search." : "No teachers yet."}</p>
      )}
    </div>
  );
}