import { Toaster } from "@/components/ui/sonner";
import { CookieConsentBanner } from "./components/CookieConsentBanner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Home from "./pages/Home";
import Create from "./pages/Create";
import Library from "./pages/Library";
import Reader from "./pages/Reader";
import Store from "./pages/Store";
import Leaderboard from "./pages/Leaderboard";
import Credits from "./pages/Credits";
import Notifications from "./pages/Notifications";
import Admin from "./pages/Admin";
import Onboarding from "./pages/Onboarding";
import BookDetail from "./pages/BookDetail";
import AuthorProfile from "./pages/AuthorProfile";
import Auth from "./pages/Auth";
import ProfilePage from "./pages/Profile";
import {
  ImpressumPage,
  LegalNoticePage,
  PrivacyPolicyPage,
  CookiePolicyPage,
  CookieSettingsPage,
} from "./pages/LegalPages";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Auth} />
      <Route path="/register" component={Auth} />
      <Route path="/create" component={Create} />
      <Route path="/library" component={Library} />
      <Route path="/reader/:id" component={Reader} />
      <Route path="/store" component={Store} />
      <Route path="/store/:id" component={BookDetail} />
      <Route path="/author/:id" component={AuthorProfile} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/credits" component={Credits} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/admin" component={Admin} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/settings" component={ProfilePage} />
      <Route path="/impressum" component={ImpressumPage} />
      <Route path="/legal-notice" component={LegalNoticePage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/cookie-policy" component={CookiePolicyPage} />
      <Route path="/cookie-settings" component={CookieSettingsPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <CookieConsentBanner />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
