import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/auth/me")
      .then((r) => setUser(r.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // If the session dies mid-use, send the user back to login
  useEffect(() => {
    const id = api.interceptors.response.use(
      (r) => r,
      (e) => {
        if (e.response?.status === 401 && !e.config.url.startsWith("/auth/")) setUser(null);
        return Promise.reject(e);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, []);

  // Merge a few fields into the signed-in user (for example a new photo version)
  const patchUser = useCallback((partial) => setUser((u) => (u ? { ...u, ...partial } : u)), []);

  // Find out once whether this student or teacher has a profile photo (admins have none)
  const uid = user?.id;
  const role = user?.role;
  const needsPassword = user?.mustChangePassword;
  const photoKnown = user?.photoV !== undefined;
  useEffect(() => {
    if (!uid || role === "admin" || needsPassword || photoKnown) return;
    api.get("/profile/me")
      .then((r) => patchUser({ hasPhoto: r.data.user.hasPhoto, photoV: r.data.user.photoV }))
      .catch(() => patchUser({ hasPhoto: false, photoV: 0 }));
  }, [uid, role, needsPassword, photoKnown, patchUser]);

  const value = {
    user,
    loading,
    patchUser,
    // portal: "member" (students and teachers) or "admin"
    login: async (identifier, password, portal = "member") => {
      const url = portal === "admin" ? "/auth/admin/login" : "/auth/login";
      const r = await api.post(url, { email: identifier, password });
      setUser(r.data.user);
      return r.data.user;
    },
    codeLogin: async (code) => {
      const r = await api.post("/auth/code-login", { code });
      setUser(r.data.user);
      return r.data.user;
    },
    googleLogin: async (credential) => {
      const r = await api.post("/auth/google", { credential });
      setUser(r.data.user);
      return r.data.user;
    },
    changePassword: async (currentPassword, newPassword) => {
      const r = await api.post("/auth/change-password", { currentPassword, newPassword });
      setUser(r.data.user);
    },
    logout: async () => {
      await api.post("/auth/logout").catch(() => {});
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}