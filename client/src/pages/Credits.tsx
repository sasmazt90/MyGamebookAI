import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Coins,
  ChevronLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  Gift,
  ShoppingCart,
  BookOpen,
  Check,
  Star,
  ExternalLink,
  CheckCircle,
  XCircle,
} from "lucide-react";

function TransactionIcon({ type }: { type: string }) {
  const iconClass = "w-4 h-4";
  switch (type) {
    case "purchase": return <ShoppingCart className={cn(iconClass, "text-green-400")} />;
    case "spend_generate": return <BookOpen className={cn(iconClass, "text-red-400")} />;
    case "earn_sale": return <TrendingUp className={cn(iconClass, "text-green-400")} />;
    case "spend_buy": return <ShoppingCart className={cn(iconClass, "text-red-400")} />;
    case "monthly_reward": return <Gift className={cn(iconClass, "text-[#F59E0B]")} />;
    case "admin_adjust": return <TrendingDown className={cn(iconClass, "text-blue-400")} />;
    default: return <Coins className={cn(iconClass, "text-gray-400")} />;
  }
}

export default function Credits() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const searchString = useSearch();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  // Always call hooks unconditionally (Rules of Hooks)
  const { data: balance, refetch: refetchBalance } = trpc.credits.balance.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const { data: transactions, isLoading: txLoading, refetch: refetchTx } = trpc.credits.transactions.useQuery(
    { limit: 30 },
    { enabled: isAuthenticated }
  );
  const { data: packages, isLoading: packagesLoading } = trpc.stripe.getPackages.useQuery();

  const createCheckout = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: ({ checkoutUrl }) => {
      toast.info("Redirecting to Stripe Checkout…", { duration: 3000 });
      window.open(checkoutUrl, "_blank");
      setPurchasingId(null);
    },
    onError: (err) => {
      toast.error(`Payment error: ${err.message}`);
      setPurchasingId(null);
    },
  });

  // Handle Stripe redirect callbacks (?payment=success or ?payment=cancelled)
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const paymentStatus = params.get("payment");
    const creditsAdded = params.get("credits");

    if (paymentStatus === "success" && creditsAdded) {
      toast.success(`🎉 Payment successful! ${creditsAdded} credits added to your account.`, {
        duration: 6000,
      });
      // Refetch balance and transactions to reflect the new credits
      refetchBalance();
      refetchTx();
      // Clean up URL params without page reload
      window.history.replaceState({}, "", "/credits");
    } else if (paymentStatus === "cancelled") {
      toast.info("Payment cancelled. No charges were made.", { duration: 4000 });
      window.history.replaceState({}, "", "/credits");
    }
  }, [searchString]);

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <Coins className="w-16 h-16 text-purple-700 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">Sign in to manage credits</h2>
          <Button
            onClick={() => (window.location.href = "/login")}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
          >
            Sign In
          </Button>
        </div>
      </AppLayout>
    );
  }

  const handleBuy = (packageId: string) => {
    setPurchasingId(packageId);
    createCheckout.mutate({
      packageId: packageId as "starter" | "value" | "pro",
      origin: window.location.origin,
    });
  };

  // Feature list per package
  const featureMap: Record<string, string[]> = {
    starter: ["100 credits", "Entry pack for premium generations", "No expiry"],
    value: ["250 credits", "Best balance for regular use", "No expiry", "Best value"],
    pro: ["500 credits", "Built for high-volume creation", "No expiry"],
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-3 w-fit">
            <ChevronLeft className="w-4 h-4" />
            {t("common.backToHome")}
          </Link>
          <h1 className="text-3xl font-bold text-white">{t("credits.title")}</h1>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-200 text-sm mb-1">{t("credits.balance")}</p>
              <div className="flex items-center gap-2">
                <Coins className="w-8 h-8 text-[#F59E0B]" />
                <span className="text-4xl font-bold text-white">{balance?.balance ?? 0}</span>
                <span className="text-purple-200 text-lg">credits</span>
              </div>
            </div>
            <div className="text-right text-purple-200 text-sm">
              <p>Payments processed by</p>
              <p className="font-semibold text-white">Stripe</p>
              <p className="text-xs mt-1 opacity-70">Secure · EUR</p>
            </div>
          </div>
        </div>

        {/* Credit Packages */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-white mb-1">{t("credits.buyMore")}</h2>
          <p className="text-sm text-gray-400 mb-5">
            All prices in EUR. Payments are processed securely by Stripe.
            Use test card <span className="font-mono text-purple-300">4242 4242 4242 4242</span> in test mode.
          </p>

          {packagesLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(packages ?? []).map(pkg => (
                <div
                  key={pkg.id}
                  className={cn(
                    "bg-[#1A1033] border rounded-2xl p-6 relative transition-all hover:border-purple-500/50",
                    pkg.popular ? "border-[#7C3AED]" : "border-purple-900/30"
                  )}
                >
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-[#F59E0B] text-black font-bold text-xs px-3">
                        <Star className="w-3 h-3 mr-1" /> MOST POPULAR
                      </Badge>
                    </div>
                  )}

                  <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-white">{pkg.name}</h3>
                    <p className="text-sm text-gray-400 mt-0.5">{pkg.description}</p>
                  </div>

                  <div className="text-center mb-2">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Coins className="w-5 h-5 text-[#F59E0B]" />
                      <span className="text-3xl font-bold text-[#F59E0B]">{pkg.credits}</span>
                    </div>
                    <p className="text-gray-400 text-sm">credits</p>
                  </div>

                  {/* EUR price */}
                  <div className="text-center mb-5">
                    <span className="text-2xl font-bold text-white">€{pkg.priceEur}</span>
                    <span className="text-gray-400 text-sm ml-1">EUR</span>
                  </div>

                  <ul className="space-y-2 mb-6">
                    {(featureMap[pkg.id] ?? []).map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleBuy(pkg.id)}
                    disabled={purchasingId === pkg.id || createCheckout.isPending}
                    className={cn(
                      "w-full font-semibold",
                      pkg.popular
                        ? "bg-[#F59E0B] hover:bg-[#D97706] text-black"
                        : "bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                    )}
                  >
                    {purchasingId === pkg.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Opening Checkout…
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Buy for €{pkg.priceEur}
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">{t("credits.history")}</h2>

          {txLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            </div>
          ) : !transactions || transactions.length === 0 ? (
            <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-8 text-center">
              <Coins className="w-10 h-10 text-purple-700 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl overflow-hidden">
              {transactions.map((tx: any, idx: number) => (
                <div
                  key={tx.id}
                  className={cn(
                    "flex items-center justify-between px-4 py-3",
                    idx < transactions.length - 1 && "border-b border-purple-900/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#0D0B1A] rounded-full flex items-center justify-center">
                      <TransactionIcon type={tx.type} />
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{tx.description || tx.type}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      "text-sm font-semibold",
                      tx.amount > 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount} credits
                    </div>
                    {tx.balanceAfter !== undefined && (
                      <div className="text-xs text-gray-500">Balance: {tx.balanceAfter}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
