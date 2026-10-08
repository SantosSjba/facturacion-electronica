import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface SidebarState {
  isExpanded: boolean;
  isMobile: boolean;
  isMobileOpen: boolean;
  isHovered: boolean;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  setIsHovered: (value: boolean) => void;
  setIsMobileOpen: (value: boolean) => void;
}
const SidebarContext = createContext<SidebarState | null>(null);

/** TailAdmin's xl breakpoint is shared by the header, drawer and content. */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  const [isMobile, setMobile] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  useEffect(() => {
    const resize = () => {
      const mobile = window.innerWidth < 1280;
      setMobile(mobile);
      if (!mobile) setIsMobileOpen(false);
      setIsHovered(false);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (!isMobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMobileOpen]);
  const value = useMemo(
    () => ({
      isExpanded: !isMobile && expanded,
      isMobile,
      isMobileOpen,
      isHovered,
      toggleSidebar: () => setExpanded((current) => !current),
      toggleMobileSidebar: () => setIsMobileOpen((current) => !current),
      setIsHovered,
      setIsMobileOpen,
    }),
    [expanded, isMobile, isMobileOpen, isHovered],
  );
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
export function useSidebar() {
  const value = useContext(SidebarContext);
  if (!value) throw new Error("useSidebar must be used within SidebarProvider");
  return value;
}
