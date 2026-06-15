import { Link, useLocation } from "wouter";
import { Menu, X, User as UserIcon, LogOut, MessageCircle, ArrowRightLeft, Search, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect, useRef } from "react";

const navLinks = [
  { href: "/", label: "Beranda" },
  { href: "/barter", label: "Forum Barter", icon: ArrowRightLeft },
  { href: "/chat", label: "Chat Petani", icon: MessageCircle },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [location] = useLocation();
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
  };

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white shadow-md border-b border-gray-200"
            : "bg-white/98 border-b border-gray-100"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">

            {/* ── KIRI: Logo ── */}
            <Link href="/" className="flex items-center gap-2.5 group shrink-0 min-w-[160px]">
              <img
                src="/logo/logo.png"
                alt="SWAPPY Logo"
                style={{ height: "52px" }}
                className="w-auto object-contain group-hover:scale-105 transition-transform"
              />
            </Link>

            {/* ── TENGAH: Search bar ── */}
            <div className="hidden md:flex flex-1 max-w-md mx-auto">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari komoditas, petani..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 text-sm rounded-full border border-border bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:bg-white transition-all placeholder:text-muted-foreground/70"
                />
              </div>
            </div>

            {/* ── KANAN: Nav links + Auth ── */}
            <div className="hidden md:flex items-center gap-1 ml-auto">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                    isActive(href)
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground/70 hover:text-foreground hover:bg-gray-100"
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {label}
                </Link>
              ))}

              {/* Divider */}
              <div className="h-5 w-px bg-border mx-2" />

              {/* Auth */}
              {user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-border hover:border-primary/40 hover:bg-gray-50 transition-all duration-150"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.avatarUrl || ""} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-semibold text-foreground max-w-[90px] truncate">{user.name}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                      <div className="px-4 py-3 bg-muted/40 border-b border-gray-100">
                        <p className="text-sm font-semibold truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <div className="p-1.5 flex flex-col gap-0.5">
                        <Link href="/profil" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition-colors">
                          <UserIcon className="h-4 w-4 text-primary" /> Profil Saya
                        </Link>
                        <Link href="/barter" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition-colors">
                          <ArrowRightLeft className="h-4 w-4 text-primary" /> Forum Barter
                        </Link>
                        <Link href="/chat" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition-colors">
                          <MessageCircle className="h-4 w-4 text-primary" /> Chat Petani
                        </Link>
                        <div className="my-1 border-t border-gray-100" />
                        <button onClick={handleLogout} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors w-full">
                          <LogOut className="h-4 w-4" /> Keluar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/daftar" className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm">
                    Masuk / Daftar
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden ml-auto p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileMenuOpen ? "max-h-[600px]" : "max-h-0"}`}>
          <div className="border-t border-gray-100 bg-white px-4 py-4 flex flex-col gap-2">
            {/* Mobile Search */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari komoditas, petani..."
                className="w-full h-10 pl-9 pr-4 text-sm rounded-full border border-border bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive(href) ? "bg-primary/10 text-primary" : "hover:bg-gray-100 text-foreground/80"
                }`}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {label}
              </Link>
            ))}

            <div className="mt-2 pt-3 border-t border-gray-100">
              {user ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 rounded-xl mb-1">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatarUrl || ""} />
                      <AvatarFallback className="bg-primary/20 text-primary font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.location}</p>
                    </div>
                  </div>
                  <Link href="/profil" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm hover:bg-gray-100 transition-colors">
                    <UserIcon className="h-4 w-4 text-primary" /> Profil Saya
                  </Link>
                  <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <LogOut className="h-4 w-4" /> Keluar
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link href="/daftar" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
                    Daftar Gratis
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Spacer */}
      <div className="h-16" />
    </>
  );
}
