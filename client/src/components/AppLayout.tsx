import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  BarChart2,
  Settings,
  User,
  BookOpen,
  Coins,
  LogOut,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Gamebook AI Logo
function GamebookLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-7 h-7", md: "w-8 h-8", lg: "w-10 h-10" };
  const textSizes = { sm: "text-base", md: "text-lg", lg: "text-2xl" };
  return (
    <Link href="/" className="flex items-center gap-2 no-underline">
      <div className={cn("rounded-lg bg-[#F59E0B] flex items-center justify-center flex-shrink-0", sizes[size])}>
        <BookOpen className="text-white w-4 h-4" />
      </div>
      <span className={cn("font-bold text-white", textSizes[size])}>
        GAMEBOOK <span className="text-[#A855F7]">AI</span>
      </span>
    </Link>
  );
}

function NavLink({ href, children, active }: { href: string; children: React.ReactNode; active?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-[#7C3AED] text-white"
          : "text-gray-300 hover:text-white hover:bg-white/10"
      )}
    >
      {children}
    </Link>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const [location] = useLocation();

  const { data: balance } = trpc.credits.balance.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: unread } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: profile } = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-[#0D0B1A] text-white flex flex-col">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 bg-[#1A1033] border-b border-purple-900/30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <GamebookLogo />

          {/* Center Nav */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink href="/create" active={location === "/create"}>{t("nav.create")}</NavLink>
            <NavLink href="/library" active={location === "/library"}>{t("nav.library")}</NavLink>
            <NavLink href="/store" active={location === "/store"}>{t("nav.store")}</NavLink>
            <NavLink href="/leaderboard" active={location === "/leaderboard"}>{t("nav.leaderboard")}</NavLink>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* Credits */}
                <Link href="/credits">
                  <div className="flex items-center gap-1.5 bg-[#2D1B69] hover:bg-[#3D2B79] px-3 py-1.5 rounded-full cursor-pointer transition-colors">
                    <Coins className="w-4 h-4 text-[#F59E0B]" />
                    <span className="text-sm font-semibold text-[#F59E0B]">
                      {balance?.balance ?? 0}
                    </span>
                  </div>
                </Link>

                {/* Stats */}
                <Link href="/leaderboard">
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white w-8 h-8">
                    <BarChart2 className="w-4 h-4" />
                  </Button>
                </Link>

                {/* Notifications */}
                <Link href="/notifications">
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white w-8 h-8 relative">
                    <Bell className="w-4 h-4" />
                    {(unread?.count ?? 0) > 0 && (
                      <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#F59E0B] rounded-full text-[10px] font-bold text-black flex items-center justify-center">
                        {unread!.count > 9 ? "9+" : unread!.count}
                      </span>
                    )}
                  </Button>
                </Link>

                {/* Profile dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white w-8 h-8">
                      <User className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#1A1033] border-purple-900/50 text-white w-48">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium">{profile?.authorName || user?.name || "User"}</p>
                      <p className="text-xs text-gray-400">{user?.email}</p>
                    </div>
                    <DropdownMenuSeparator className="bg-purple-900/30" />
                    <DropdownMenuItem asChild className="hover:bg-purple-900/30 cursor-pointer">
                      <Link href="/profile">
                        <User className="w-4 h-4 mr-2" /> Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="hover:bg-purple-900/30 cursor-pointer">
                      <Link href="/credits">
                        <Coins className="w-4 h-4 mr-2" /> Credits
                      </Link>
                    </DropdownMenuItem>
                    {user?.role === "admin" && (
                      <DropdownMenuItem asChild className="hover:bg-purple-900/30 cursor-pointer">
                        <Link href="/admin">
                          <Shield className="w-4 h-4 mr-2" /> Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-purple-900/30" />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="hover:bg-purple-900/30 cursor-pointer text-red-400"
                    >
                      <LogOut className="w-4 h-4 mr-2" /> {t("nav.signOut")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Settings */}
                <Link href="/settings">
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white w-8 h-8">
                    <Settings className="w-4 h-4" />
                  </Button>
                </Link>

                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  className="text-gray-300 hover:text-white text-sm hidden md:flex"
                >
                  {t("nav.signOut")}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => (window.location.href = "/login")}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm px-4"
              >
                {t("nav.signIn")}
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-[#0D0B1A] border-t border-purple-900/30 pt-12 pb-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <GamebookLogo size="sm" />
              <p className="mt-3 text-sm text-gray-400 leading-relaxed">
                {t("footer.tagline")}
              </p>
              <div className="mt-4 text-xs text-[#A855F7] space-y-0.5">
                <p>SASMAZ DIGITAL SERVICES</p>
                <p>Responsible: TOLGAR SASMAZ</p>
                <p>München, 81543 Deutschland</p>
              </div>
            </div>

            {/* Platform */}
            <div>
              <h4 className="text-xs font-bold text-white tracking-wider mb-4">{t("footer.platform")}</h4>
              <ul className="space-y-2">
                {[
                  { href: "/create", label: t("nav.create") },
                  { href: "/library", label: t("nav.library") },
                  { href: "/store", label: t("nav.store") },
                  { href: "/leaderboard", label: t("nav.leaderboard") },
                  { href: "/credits", label: t("footer.credits") },
                ].map(item => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-bold text-white tracking-wider mb-4">{t("footer.legal")}</h4>
              <ul className="space-y-2">
                {[
                  { href: "/impressum", label: t("footer.impressum") },
                  { href: "/legal-notice", label: t("footer.legalNotice") },
                  { href: "/privacy-policy", label: t("footer.privacyPolicy") },
                  { href: "/cookie-policy", label: t("footer.cookiePolicy") },
                  { href: "/cookie-settings", label: t("footer.cookieSettings") },
                ].map(item => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Language */}
            <div>
              <h4 className="text-xs font-bold text-white tracking-wider mb-4">{t("footer.language")}</h4>
              <Select value={lang} onValueChange={setLang}>
                <SelectTrigger className="bg-[#1A1033] border-purple-900/50 text-white w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1033] border-purple-900/50 text-white max-h-48">
                  {SUPPORTED_LANGUAGES.map(l => (
                    <SelectItem key={l.code} value={l.code} className="hover:bg-purple-900/30">
                      {l.flag} {l.nativeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-3 text-xs text-[#A855F7]">{t("footer.contact")}</p>
            </div>
          </div>

          <div className="border-t border-purple-900/30 pt-6 text-center">
            <p className="text-xs text-gray-500">{t("footer.copyright")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export { GamebookLogo };
