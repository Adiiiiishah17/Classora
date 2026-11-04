
import { Link } from "react-router-dom";

export default function Unauthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">Access denied</h1>

      <p>You don't have permission to view this page.</p>

      <Link to="/" className="text-blue-600 underline">
        Return to home
      </Link>
    </div>
  );
}
