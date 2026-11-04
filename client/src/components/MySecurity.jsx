import { useEffect, useState } from "react";
import { api, errMsg } from "../api/client";
import { Alert } from "./ui";
import ChangePasswordCard from "./ChangePasswordCard";
import MyLoginCode from "./MyLoginCode";

export default function MySecurity() {
  const [hasPassword, setHasPassword] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/profile/me")
      .then((r) => setHasPassword(!!r.data.security?.hasPassword))
      .catch((e) => setError(errMsg(e)));
  }, []);

  if (hasPassword === null) {
    return error ? <Alert>{error}</Alert> : <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChangePasswordCard hasPassword={hasPassword} />
      <MyLoginCode />
    </div>
  );
}