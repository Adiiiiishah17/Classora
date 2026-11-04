import { createContext, useContext, useState } from "react";

const NavContext = createContext({ badges: {}, setBadges: () => {} });
export const useNav = () => useContext(NavContext);

// Lets a page (the admin dashboard) put counts on sidebar items
export function NavProvider({ children }) {
  const [badges, setBadges] = useState({});
  return <NavContext.Provider value={{ badges, setBadges }}>{children}</NavContext.Provider>;
}