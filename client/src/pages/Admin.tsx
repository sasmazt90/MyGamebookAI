import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Users,
  BookOpen,
  Coins,
  BarChart3,
  Shield,
  Loader2,
  Search,
  Trash2,
  Ban,
  CheckCircle,
  ChevronLeft,
  TrendingUp,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Plus,
  ChevronUp,
  ChevronDown,
  X,
  Upload,
  ExternalLink,
  Edit2,
  Save,
  Tag,
  Trophy,
  Percent,
  Minus,
  Flag,
  Star,
} from "lucide-react";
import { Link } from "wouter";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "members", label: "Members", icon: Users },
  { id: "books", label: "Books", icon: BookOpen },
  { id: "credits", label: "Credits", icon: Coins },
  { id: "campaigns", label: "Campaigns", icon: Tag },
  { id: "rewards", label: "Rewards", icon: Trophy },
  { id: "banners", label: "Banners", icon: ImageIcon },
  { id: "featured", label: "Featured", icon: Star },
  { id: "reports", label: "Reports", icon: Flag },
];

const BOOK_CATEGORIES = [
  { id: "fairy_tale", label: "Fairy Tale" },
  { id: "comic", label: "Comic" },
  { id: "crime_mystery", label: "Crime & Mystery" },
  { id: "fantasy_scifi", label: "Fantasy / Sci-Fi" },
  { id: "romance", label: "Romance" },
  { id: "horror_thriller", label: "Horror & Thriller" },
];

type CampaignFormState = {
  name: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  targetCategories: string[];
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

const EMPTY_CAMPAIGN: CampaignFormState = {
  name: "",
  discountType: "percent",
  discountValue: "",
  targetCategories: [],
  isActive: false,
  startsAt: "",
  endsAt: "",
};

type BannerFormState = {
  imageUrl: string;
  headline: string;
  subtext: string;
  ctaLabel: string;
  ctaLink: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};


const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const BANNER_UPLOAD_URL = API_BASE_URL
  ? `${API_BASE_URL.replace(/\/$/, "")}/api/banners/upload`
  : "/api/banners/upload";

const EMPTY_FORM: BannerFormState = {
  imageUrl: "",
  headline: "",
  subtext: "",
  ctaLabel: "Create",
  ctaLink: "/create",
  startsAt: "",
  endsAt: "",
  isActive: true,
};

export default function Admin() {
  const { user, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("overview");
  const [memberSearch, setMemberSearch] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [creditSearch, setCreditSearch] = useState("");
  const [creditUserId, setCreditUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");

  // Banner state
  const [bannerForm, setBannerForm] = useState<BannerFormState>(EMPTY_FORM);
  const [editingBannerId, setEditingBannerId] = useState<number | null>(null);
  const [showBannerForm, setShowBannerForm] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Featured state
  const [featuredSearch, setFeaturedSearch] = useState("");

  // Campaign state
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(EMPTY_CAMPAIGN);
  const [editingCampaignId, setEditingCampaignId] = useState<number | null>(null);
  const [showCampaignForm, setShowCampaignForm] = useState(false);

  // Always call hooks unconditionally (Rules of Hooks)
  const isAdmin = isAuthenticated && user?.role === "admin";
  const { data: members, isLoading: membersLoading } = trpc.admin.listMembers.useQuery(
    { search: memberSearch || undefined, limit: 50 },
    { enabled: isAdmin && activeTab === "members" }
  );
  const { data: adminBooks, isLoading: booksLoading } = trpc.admin.listBooks.useQuery(
    { search: bookSearch || undefined, limit: 50 },
    { enabled: isAdmin && activeTab === "books" }
  );
  const { data: allBanners, isLoading: bannersLoading, refetch: refetchBanners } = trpc.banners.listAll.useQuery(
    undefined,
    { enabled: isAdmin && activeTab === "banners" }
  );
  const { data: allCampaigns, isLoading: campaignsLoading, refetch: refetchCampaigns } = trpc.admin.listCampaigns.useQuery(
    undefined,
    { enabled: isAdmin && activeTab === "campaigns" }
  );
  const { data: allReports, isLoading: reportsLoading, refetch: refetchReports } = trpc.moderation.listReports.useQuery(
    { status: "pending" },
    { enabled: isAdmin && activeTab === "reports" }
  );
  const { data: featuredBooks, isLoading: featuredLoading, refetch: refetchFeatured } = trpc.admin.listFeatured.useQuery(
    undefined,
    { enabled: isAdmin && activeTab === "featured" }
  );
  const { data: searchResults, isLoading: searchLoading } = trpc.admin.searchBooksForFeatured.useQuery(
    { search: featuredSearch || undefined },
    { enabled: isAdmin && activeTab === "featured" }
  );

  const featureBook = trpc.admin.featureBook.useMutation({
    onSuccess: () => { toast.success("Book added to Featured Gamebooks"); refetchFeatured(); utils.admin.searchBooksForFeatured.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });
  const unfeatureBook = trpc.admin.unfeatureBook.useMutation({
    onSuccess: () => { toast.success("Book removed from Featured Gamebooks"); refetchFeatured(); utils.admin.searchBooksForFeatured.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });
  const reorderFeatured = trpc.admin.reorderFeatured.useMutation({
    onSuccess: () => refetchFeatured(),
    onError: (err: any) => toast.error(err.message),
  });

  const utils = trpc.useUtils();

  const adjustCredits = trpc.admin.adjustCredits.useMutation({
    onSuccess: () => {
      toast.success("Credits adjusted successfully");
      setCreditUserId("");
      setCreditAmount("");
      setCreditReason("");
    },
    onError: err => toast.error(err.message),
  });

  const suspendUser = trpc.admin.suspendUser.useMutation({
    onSuccess: () => {
      toast.success("User suspended");
      utils.admin.listMembers.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const unsuspendUser = trpc.admin.unsuspendUser.useMutation({
    onSuccess: () => {
      toast.success("User reinstated");
      utils.admin.listMembers.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const softDeleteUser = trpc.admin.softDeleteUser.useMutation({
    onSuccess: () => {
      toast.success("User soft-deleted");
      utils.admin.listMembers.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const unlockAccount = trpc.admin.unlockAccount.useMutation({
    onSuccess: () => {
      toast.success("Account unlocked");
      utils.admin.listMembers.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const delistBook = trpc.admin.delistBook.useMutation({
    onSuccess: () => {
      toast.success("Book delisted");
      utils.admin.listBooks.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteBook = trpc.admin.deleteBook.useMutation({
    onSuccess: () => {
      toast.success("Book permanently deleted");
      utils.admin.listBooks.invalidate();
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete book"),
  });

  const createBanner = trpc.banners.create.useMutation({
    onSuccess: () => {
      toast.success("Banner created");
      resetBannerForm();
      refetchBanners();
      utils.banners.list.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateBanner = trpc.banners.update.useMutation({
    onSuccess: () => {
      toast.success("Banner updated");
      resetBannerForm();
      refetchBanners();
      utils.banners.list.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteBanner = trpc.banners.delete.useMutation({
    onSuccess: () => {
      toast.success("Banner deleted");
      refetchBanners();
      utils.banners.list.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const reorderBanner = trpc.banners.reorder.useMutation({
    onSuccess: () => refetchBanners(),
    onError: (err: any) => toast.error(err.message),
  });

  const toggleBannerActive = trpc.banners.update.useMutation({
    onSuccess: () => {
      refetchBanners();
      utils.banners.list.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Campaign mutations
  const createCampaign = trpc.admin.createCampaign.useMutation({
    onSuccess: () => {
      toast.success("Campaign created");
      resetCampaignForm();
      refetchCampaigns();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateCampaign = trpc.admin.updateCampaign.useMutation({
    onSuccess: () => {
      toast.success("Campaign updated");
      resetCampaignForm();
      refetchCampaigns();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteCampaign = trpc.admin.deleteCampaign.useMutation({
    onSuccess: () => {
      toast.success("Campaign deleted");
      refetchCampaigns();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const runMonthlyRewards = trpc.admin.runMonthlyRewards.useMutation({
    onSuccess: (data: any) => toast.success(`Monthly rewards distributed to ${data.rewarded} authors!`),
    onError: (err: any) => toast.error(err.message),
  });

  const resolveReport = trpc.moderation.resolveReport.useMutation({
    onSuccess: () => { toast.success("Report resolved"); refetchReports(); },
    onError: (err: any) => toast.error(err.message),
  });

  function resetCampaignForm() {
    setCampaignForm(EMPTY_CAMPAIGN);
    setEditingCampaignId(null);
    setShowCampaignForm(false);
  }

  function startEditCampaign(campaign: any) {
    setCampaignForm({
      name: campaign.name ?? "",
      discountType: campaign.discountType ?? "percent",
      discountValue: String(campaign.discountValue ?? ""),
      targetCategories: Array.isArray(campaign.targetCategories) ? campaign.targetCategories : [],
      isActive: campaign.isActive ?? false,
      startsAt: campaign.startsAt ? new Date(campaign.startsAt).toISOString().slice(0, 16) : "",
      endsAt: campaign.endsAt ? new Date(campaign.endsAt).toISOString().slice(0, 16) : "",
    });
    setEditingCampaignId(campaign.id);
    setShowCampaignForm(true);
  }

  function handleSaveCampaign() {
    if (!campaignForm.name.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }
    const discountValue = parseFloat(campaignForm.discountValue);
    if (isNaN(discountValue) || discountValue <= 0) {
      toast.error("Please enter a valid discount value");
      return;
    }
    if (campaignForm.targetCategories.length === 0) {
      toast.error("Please select at least one category");
      return;
    }
    if (editingCampaignId !== null) {
      updateCampaign.mutate({
        id: editingCampaignId,
        isActive: campaignForm.isActive,
        discountValue,
      });
    } else {
      createCampaign.mutate({
        name: campaignForm.name,
        discountType: campaignForm.discountType,
        discountValue,
        targetCategories: campaignForm.targetCategories,
        isActive: campaignForm.isActive,
        startsAt: campaignForm.startsAt || undefined,
        endsAt: campaignForm.endsAt || undefined,
      });
    }
  }

  function resetBannerForm() {
    setBannerForm(EMPTY_FORM);
    setEditingBannerId(null);
    setShowBannerForm(false);
    setImagePreview("");
  }

  function startEditBanner(banner: any) {
    const translations = banner.translations as Record<string, any> | null;
    const en = translations?.en ?? {};
    setBannerForm({
      imageUrl: banner.imageUrl ?? "",
      headline: en.headline ?? "",
      subtext: en.subtext ?? "",
      ctaLabel: en.ctaLabel ?? "Create",
      ctaLink: banner.ctaLink ?? "/create",
      startsAt: banner.startsAt ? new Date(banner.startsAt).toISOString().slice(0, 16) : "",
      endsAt: banner.endsAt ? new Date(banner.endsAt).toISOString().slice(0, 16) : "",
      isActive: banner.isActive ?? true,
    });
    setImagePreview(banner.imageUrl ?? "");
    setEditingBannerId(banner.id);
    setShowBannerForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleImageUpload(file: File) {
    if (!file) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(BANNER_UPLOAD_URL, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }
      const { url } = await res.json();
      setBannerForm(prev => ({ ...prev, imageUrl: url }));
      setImagePreview(url);
      toast.success("Image uploaded successfully");
    } catch (err: any) {
      toast.error(err.message ?? "Image upload failed");
    } finally {
      setImageUploading(false);
    }
  }

  function handleSaveBanner() {
    if (!bannerForm.imageUrl) {
      toast.error("Please upload a banner image first");
      return;
    }
    if (!bannerForm.headline.trim()) {
      toast.error("Please enter a headline");
      return;
    }

    const translations = {
      en: {
        headline: bannerForm.headline,
        subtext: bannerForm.subtext,
        ctaLabel: bannerForm.ctaLabel || "Create",
      },
    };

    if (editingBannerId !== null) {
      updateBanner.mutate({
        id: editingBannerId,
        imageUrl: bannerForm.imageUrl,
        ctaLink: bannerForm.ctaLink,
        isActive: bannerForm.isActive,
        translations,
        startsAt: bannerForm.startsAt || undefined,
        endsAt: bannerForm.endsAt || undefined,
      });
    } else {
      const nextOrder = allBanners ? allBanners.length : 0;
      createBanner.mutate({
        imageUrl: bannerForm.imageUrl,
        ctaLink: bannerForm.ctaLink,
        isActive: bannerForm.isActive,
        orderIndex: nextOrder,
        translations,
        startsAt: bannerForm.startsAt || undefined,
        endsAt: bannerForm.endsAt || undefined,
      });
    }
  }

  function handleMoveUp(banner: any, index: number) {
    if (index === 0 || !allBanners) return;
    const prev = allBanners[index - 1];
    reorderBanner.mutate([
      { id: banner.id, orderIndex: prev.orderIndex },
      { id: prev.id, orderIndex: banner.orderIndex },
    ]);
  }

  function handleMoveDown(banner: any, index: number) {
    if (!allBanners || index === allBanners.length - 1) return;
    const next = allBanners[index + 1];
    reorderBanner.mutate([
      { id: banner.id, orderIndex: next.orderIndex },
      { id: next.id, orderIndex: banner.orderIndex },
    ]);
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">Access Denied</h2>
          <p className="text-gray-400">You need admin privileges to access this page.</p>
          <Link href="/" className="mt-4 inline-block">
            <Button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">Go Home</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const stats = { totalUsers: 0, totalBooks: 0, publishedBooks: 0, totalTransactions: 0 };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-2 w-fit">
            <ChevronLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-[#F59E0B]" />
            Admin Panel
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                  activeTab === tab.id
                    ? "bg-[#7C3AED] border-[#7C3AED] text-white"
                    : "bg-[#1A1033] border-purple-900/50 text-gray-400 hover:text-white"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-blue-400" },
                { label: "Total Books", value: stats?.totalBooks ?? 0, icon: BookOpen, color: "text-purple-400" },
                { label: "Published Books", value: stats?.publishedBooks ?? 0, icon: TrendingUp, color: "text-green-400" },
                { label: "Total Transactions", value: stats?.totalTransactions ?? 0, icon: Coins, color: "text-[#F59E0B]" },
              ].map(stat => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={cn("w-5 h-5", stat.color)} />
                      <span className="text-xs text-gray-400">{stat.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stat.value.toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === "members" && (
          <div>
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="bg-[#1A1033] border-purple-900/50 text-white pl-9"
                />
              </div>
            </div>

            {membersLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              </div>
            ) : (
              <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-purple-900/30">
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">User</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Author Name</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Credits</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Books</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                      <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members?.map((m: any) => (
                      <tr key={m.user.id} className="border-b border-purple-900/20 hover:bg-purple-900/10">
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{m.user.name || "—"}</p>
                          <p className="text-xs text-gray-500">{m.user.email || m.user.openId}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-300">{m.profile?.authorName || "—"}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-[#F59E0B] font-semibold">{m.wallet?.balance ?? 0}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-300">{m.bookCount ?? 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <Badge className={cn(
                              "text-xs w-fit",
                              m.user.status === "deleted" ? "bg-gray-500/20 text-gray-400 border-gray-500/30" :
                              m.user.status === "suspended" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                              "bg-green-500/20 text-green-400 border-green-500/30"
                            )}>
                              {m.user.status === "deleted" ? "Deleted" : m.user.status === "suspended" ? "Suspended" : "Active"}
                            </Badge>
                            {m.user.accountLocked && (
                              <Badge className="text-xs w-fit bg-orange-500/20 text-orange-400 border-orange-500/30">Locked</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {m.user.status !== "deleted" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => m.user.status === "suspended" ? unsuspendUser.mutate({ userId: m.user.id }) : suspendUser.mutate({ userId: m.user.id })}
                                  className={cn("text-xs h-7", m.user.status === "suspended" ? "text-green-400 hover:text-green-300" : "text-red-400 hover:text-red-300")}
                                  title={m.user.status === "suspended" ? "Reinstate" : "Suspend"}
                                >
                                  {m.user.status === "suspended" ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                </Button>
                                {m.user.accountLocked && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => unlockAccount.mutate({ userId: m.user.id })}
                                    className="text-xs h-7 text-orange-400 hover:text-orange-300"
                                    title="Unlock Account"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm(`Soft-delete user ${m.user.name || m.user.id}? Their books will remain as [Deleted Author].`)) {
                                      softDeleteUser.mutate({ userId: m.user.id });
                                    }
                                  }}
                                  className="text-xs h-7 text-gray-400 hover:text-red-400"
                                  title="Soft Delete User"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {m.user.status === "deleted" && (
                              <span className="text-xs text-gray-500">
                                {m.user.deletedAt ? new Date(m.user.deletedAt).toLocaleDateString() : "Deleted"}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Books Tab */}
        {activeTab === "books" && (
          <div>
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={bookSearch}
                  onChange={e => setBookSearch(e.target.value)}
                  placeholder="Search books..."
                  className="bg-[#1A1033] border-purple-900/50 text-white pl-9"
                />
              </div>
            </div>

            {booksLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              </div>
            ) : (
              <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-purple-900/30">
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Title</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Author</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Category</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                      <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminBooks?.map((b: any) => (
                      <tr key={b.book.id} className="border-b border-purple-900/20 hover:bg-purple-900/10">
                        <td className="px-4 py-3">
                          <p className="text-white font-medium line-clamp-1">{b.book.title}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-300">{b.authorName || "—"}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <Badge className="bg-[#7C3AED]/20 text-purple-300 border-purple-700/30 text-xs">
                            {b.book.category?.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <Badge className={cn("text-xs w-fit", b.book.isPublished ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-gray-500/20 text-gray-400 border-gray-500/30")}>
                              {b.book.isPublished ? "Published" : "Private"}
                            </Badge>
                            {b.book.isDelisted && (
                              <Badge className="text-xs w-fit bg-red-500/20 text-red-400 border-red-500/30">Delisted</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => delistBook.mutate({ bookId: b.book.id })}
                            className={cn("text-xs h-7", b.book.isDelisted ? "text-green-400 hover:text-green-300" : "text-red-400 hover:text-red-300")}
                          >
                            {b.book.isDelisted ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4 text-red-400" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Permanently delete book "${b.book.title}"? This cannot be undone.`)) {
                                deleteBook.mutate({ bookId: b.book.id });
                              }
                            }}
                            className="text-xs h-7 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                            disabled={deleteBook.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Credits Tab */}
        {activeTab === "credits" && (
          <div>
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={creditSearch}
                  onChange={e => setCreditSearch(e.target.value)}
                  placeholder="Search users by email or author name..."
                  className="bg-[#1A1033] border-purple-900/50 text-white pl-9"
                />
              </div>
            </div>

            {/* User search results */}
            {creditSearch && (
              <div className="mb-4 bg-[#1A1033] border border-purple-900/30 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-purple-900/20">
                  <h3 className="text-sm font-semibold text-white">Search Results</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {members?.filter((m: any) => {
                    const searchLower = creditSearch.toLowerCase();
                    return (
                      m.email?.toLowerCase().includes(searchLower) ||
                      m.authorName?.toLowerCase().includes(searchLower)
                    );
                  }).length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400">No users found</div>
                  ) : (
                    members?.filter((m: any) => {
                      const searchLower = creditSearch.toLowerCase();
                      return (
                        m.email?.toLowerCase().includes(searchLower) ||
                        m.authorName?.toLowerCase().includes(searchLower)
                      );
                    }).map((m: any) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setCreditUserId(m.id.toString());
                          setCreditSearch("");
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-purple-900/20 border-b border-purple-900/10 transition-colors"
                      >
                        <div className="text-sm text-white font-medium">{m.authorName || "—"}</div>
                        <div className="text-xs text-gray-400">{m.email || "—"}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="max-w-md">
              <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-6">
                <h2 className="text-lg font-bold text-white mb-4">Adjust User Credits</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">User ID</label>
                  <Input
                    value={creditUserId}
                    onChange={e => setCreditUserId(e.target.value)}
                    placeholder="Enter user ID..."
                    className="bg-[#0D0B1A] border-purple-900/50 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Amount (positive = add, negative = deduct)</label>
                  <Input
                    value={creditAmount}
                    onChange={e => setCreditAmount(e.target.value)}
                    placeholder="e.g. 100 or -50"
                    type="number"
                    className="bg-[#0D0B1A] border-purple-900/50 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Reason</label>
                  <Input
                    value={creditReason}
                    onChange={e => setCreditReason(e.target.value)}
                    placeholder="Reason for adjustment..."
                    className="bg-[#0D0B1A] border-purple-900/50 text-white"
                  />
                </div>
                <Button
                  onClick={() => {
                    if (!creditUserId || !creditAmount) {
                      toast.error("Please fill in all fields");
                      return;
                    }
                    adjustCredits.mutate({
                      userId: parseInt(creditUserId),
                      amount: parseInt(creditAmount),
                      reason: creditReason || "Admin adjustment",
                    });
                  }}
                  disabled={adjustCredits.isPending}
                  className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                >
                  {adjustCredits.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adjust Credits"}
                </Button>
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Campaigns Tab */}
        {activeTab === "campaigns" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Discount Campaigns</h2>
                <p className="text-sm text-gray-400 mt-0.5">Discounts apply to buyer price. Author always earns 30% of list price.</p>
              </div>
              {!showCampaignForm && (
                <Button
                  onClick={() => { resetCampaignForm(); setShowCampaignForm(true); }}
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Campaign
                </Button>
              )}
            </div>

            {/* Campaign Form */}
            {showCampaignForm && (
              <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    {editingCampaignId !== null ? "Edit Campaign" : "New Campaign"}
                  </h3>
                  <button onClick={resetCampaignForm} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1 block font-medium">Campaign Name *</label>
                  <Input
                    value={campaignForm.name}
                    onChange={e => setCampaignForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Summer Sale"
                    className="bg-[#0D0B1A] border-purple-900/50 text-white"
                    disabled={editingCampaignId !== null}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block font-medium">Discount Type *</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCampaignForm(p => ({ ...p, discountType: "percent" }))}
                        disabled={editingCampaignId !== null}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm border transition-colors",
                          campaignForm.discountType === "percent"
                            ? "bg-[#7C3AED] border-[#7C3AED] text-white"
                            : "bg-[#0D0B1A] border-purple-900/50 text-gray-400 hover:text-white"
                        )}
                      >
                        <Percent className="w-3.5 h-3.5 inline mr-1" />
                        Percent
                      </button>
                      <button
                        onClick={() => setCampaignForm(p => ({ ...p, discountType: "fixed" }))}
                        disabled={editingCampaignId !== null}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm border transition-colors",
                          campaignForm.discountType === "fixed"
                            ? "bg-[#7C3AED] border-[#7C3AED] text-white"
                            : "bg-[#0D0B1A] border-purple-900/50 text-gray-400 hover:text-white"
                        )}
                      >
                        <Minus className="w-3.5 h-3.5 inline mr-1" />
                        Fixed Credits
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block font-medium">
                      {campaignForm.discountType === "percent" ? "Discount % (max 70%)" : "Credits Off"} *
                    </label>
                    <Input
                      type="number"
                      value={campaignForm.discountValue}
                      onChange={e => setCampaignForm(p => ({ ...p, discountValue: e.target.value }))}
                      placeholder={campaignForm.discountType === "percent" ? "e.g. 20" : "e.g. 5"}
                      className="bg-[#0D0B1A] border-purple-900/50 text-white"
                    />
                    {campaignForm.discountType === "percent" && parseFloat(campaignForm.discountValue) > 70 && (
                      <p className="text-xs text-red-400 mt-1">Max 70% — platform earnings cannot go negative</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block font-medium">Target Categories * (select all that apply)</label>
                  <div className="flex flex-wrap gap-2">
                    {BOOK_CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        disabled={editingCampaignId !== null}
                        onClick={() => setCampaignForm(p => ({
                          ...p,
                          targetCategories: p.targetCategories.includes(cat.id)
                            ? p.targetCategories.filter(c => c !== cat.id)
                            : [...p.targetCategories, cat.id],
                        }))}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs border transition-colors",
                          campaignForm.targetCategories.includes(cat.id)
                            ? "bg-[#7C3AED] border-[#7C3AED] text-white"
                            : "bg-[#0D0B1A] border-purple-900/50 text-gray-400 hover:text-white"
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block font-medium">Starts At (optional)</label>
                    <Input
                      type="datetime-local"
                      value={campaignForm.startsAt}
                      onChange={e => setCampaignForm(p => ({ ...p, startsAt: e.target.value }))}
                      className="bg-[#0D0B1A] border-purple-900/50 text-white"
                      disabled={editingCampaignId !== null}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block font-medium">Ends At (optional)</label>
                    <Input
                      type="datetime-local"
                      value={campaignForm.endsAt}
                      onChange={e => setCampaignForm(p => ({ ...p, endsAt: e.target.value }))}
                      className="bg-[#0D0B1A] border-purple-900/50 text-white"
                      disabled={editingCampaignId !== null}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={campaignForm.isActive}
                    onCheckedChange={v => setCampaignForm(p => ({ ...p, isActive: v }))}
                  />
                  <span className="text-sm text-gray-300">Active (applies discounts immediately)</span>
                </div>

                <div className="bg-[#0D0B1A] border border-purple-900/30 rounded-lg p-3 text-xs text-gray-400">
                  <strong className="text-purple-300">Pricing rules:</strong> Author earns 30% of the <em>list price</em>.
                  Buyer pays the discounted price. Platform absorbs the discount.
                  Discounts &gt;70% are blocked to prevent negative platform earnings.
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveCampaign}
                    disabled={createCampaign.isPending || updateCampaign.isPending}
                    className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2"
                  >
                    {(createCampaign.isPending || updateCampaign.isPending) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {editingCampaignId !== null ? "Save Changes" : "Create Campaign"}
                  </Button>
                  <Button variant="outline" onClick={resetCampaignForm} className="border-purple-900/50 text-gray-400 hover:text-white">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Campaign List */}
            {campaignsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              </div>
            ) : !allCampaigns || allCampaigns.length === 0 ? (
              <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-12 text-center">
                <Tag className="w-12 h-12 text-purple-700 mx-auto mb-3" />
                <p className="text-white font-medium mb-1">No campaigns yet</p>
                <p className="text-sm text-gray-500">Create your first discount campaign above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allCampaigns.map((campaign: any) => (
                  <div
                    key={campaign.id}
                    className={cn(
                      "bg-[#1A1033] border rounded-xl p-4 flex items-center gap-4",
                      campaign.isActive ? "border-purple-500/40" : "border-purple-900/20 opacity-60"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold">{campaign.name}</p>
                        <Badge className={cn(
                          "text-xs",
                          campaign.isActive ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                        )}>
                          {campaign.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge className="bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30 text-xs">
                          {campaign.discountType === "percent" ? `${campaign.discountValue}% off` : `${campaign.discountValue} credits off`}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Categories: {(campaign.targetCategories as string[]).join(", ") || "none"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateCampaign.mutate({ id: campaign.id, isActive: !campaign.isActive })}
                        className={cn(
                          "p-1.5 rounded transition-colors",
                          campaign.isActive ? "text-green-400 hover:text-green-300" : "text-gray-500 hover:text-gray-300"
                        )}
                        title={campaign.isActive ? "Deactivate" : "Activate"}
                      >
                        {campaign.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => startEditCampaign(campaign)}
                        className="p-1.5 rounded text-purple-400 hover:text-purple-300 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this campaign?")) {
                            deleteCampaign.mutate({ id: campaign.id });
                          }
                        }}
                        className="p-1.5 rounded text-red-400 hover:text-red-300 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rewards Tab */}
        {activeTab === "rewards" && (
          <div className="max-w-lg space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Monthly Top-10 Author Reward</h2>
              <p className="text-sm text-gray-400 mt-1">
                Distributes +10 credits to the top 10 authors by purchase count this month.
                Idempotent — running twice in the same month will be rejected.
              </p>
            </div>
            <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#F59E0B]/20 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-6 h-6 text-[#F59E0B]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold mb-1">Run Monthly Rewards</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Each of the top 10 authors receives 10 credits and an in-app notification.
                    A unique constraint prevents double-awarding within the same month.
                  </p>
                  <Button
                    onClick={() => {
                      if (confirm("Distribute monthly rewards to top 10 authors? This cannot be undone for this month.")) {
                        runMonthlyRewards.mutate();
                      }
                    }}
                    disabled={runMonthlyRewards.isPending}
                    className="bg-[#F59E0B] hover:bg-[#D97706] text-black font-semibold gap-2"
                  >
                    {runMonthlyRewards.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trophy className="w-4 h-4" />
                    )}
                    Distribute Monthly Rewards
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Banners Tab */}
        {activeTab === "banners" && (
          <div className="space-y-6">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Hero Slider Banners</h2>
                <p className="text-sm text-gray-400 mt-0.5">Manage the homepage hero carousel slides</p>
              </div>
              {!showBannerForm && (
                <Button
                  onClick={() => { resetBannerForm(); setShowBannerForm(true); }}
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Banner
                </Button>
              )}
            </div>

            {/* Banner Form */}
            {showBannerForm && (
              <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-white">
                    {editingBannerId !== null ? "Edit Banner" : "New Banner"}
                  </h3>
                  <button
                    onClick={resetBannerForm}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block font-medium">Banner Image *</label>
                  <div
                    className={cn(
                      "relative border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors",
                      imagePreview ? "border-purple-700/50" : "border-purple-900/50 hover:border-purple-700/70"
                    )}
                    style={{ minHeight: "180px" }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Banner preview"
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <div className="flex items-center gap-2 text-white font-medium">
                            <Upload className="w-5 h-5" />
                            Change Image
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-48 gap-3">
                        {imageUploading ? (
                          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                        ) : (
                          <>
                            <div className="w-14 h-14 rounded-full bg-purple-900/40 flex items-center justify-center">
                              <ImageIcon className="w-7 h-7 text-purple-400" />
                            </div>
                            <div className="text-center">
                              <p className="text-white font-medium">Click to upload image</p>
                              <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP — max 10 MB</p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                      e.target.value = "";
                    }}
                  />
                  {/* Or paste URL */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500">or paste URL:</span>
                    <Input
                      value={bannerForm.imageUrl}
                      onChange={e => {
                        setBannerForm(prev => ({ ...prev, imageUrl: e.target.value }));
                        setImagePreview(e.target.value);
                      }}
                      placeholder="https://..."
                      className="bg-[#0D0B1A] border-purple-900/50 text-white text-xs h-8 flex-1"
                    />
                  </div>
                </div>

                {/* Headline */}
                <div>
                  <label className="text-sm text-gray-400 mb-1 block font-medium">Headline *</label>
                  <Input
                    value={bannerForm.headline}
                    onChange={e => setBannerForm(prev => ({ ...prev, headline: e.target.value }))}
                    placeholder="Ready to be a hero of your own adventure?"
                    className="bg-[#0D0B1A] border-purple-900/50 text-white"
                  />
                </div>

                {/* Subtext */}
                <div>
                  <label className="text-sm text-gray-400 mb-1 block font-medium">Subtitle</label>
                  <Input
                    value={bannerForm.subtext}
                    onChange={e => setBannerForm(prev => ({ ...prev, subtext: e.target.value }))}
                    placeholder="Create AI-powered interactive gamebooks"
                    className="bg-[#0D0B1A] border-purple-900/50 text-white"
                  />
                </div>

                {/* CTA Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block font-medium">CTA Button Label</label>
                    <Input
                      value={bannerForm.ctaLabel}
                      onChange={e => setBannerForm(prev => ({ ...prev, ctaLabel: e.target.value }))}
                      placeholder="Create"
                      className="bg-[#0D0B1A] border-purple-900/50 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block font-medium">CTA Link</label>
                    <Input
                      value={bannerForm.ctaLink}
                      onChange={e => setBannerForm(prev => ({ ...prev, ctaLink: e.target.value }))}
                      placeholder="/create"
                      className="bg-[#0D0B1A] border-purple-900/50 text-white"
                    />
                  </div>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block font-medium">Starts At (optional)</label>
                    <Input
                      type="datetime-local"
                      value={bannerForm.startsAt}
                      onChange={e => setBannerForm(prev => ({ ...prev, startsAt: e.target.value }))}
                      className="bg-[#0D0B1A] border-purple-900/50 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block font-medium">Ends At (optional)</label>
                    <Input
                      type="datetime-local"
                      value={bannerForm.endsAt}
                      onChange={e => setBannerForm(prev => ({ ...prev, endsAt: e.target.value }))}
                      className="bg-[#0D0B1A] border-purple-900/50 text-white"
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-3">
                  <Switch
                    checked={bannerForm.isActive}
                    onCheckedChange={v => setBannerForm(prev => ({ ...prev, isActive: v }))}
                  />
                  <span className="text-sm text-gray-300">Active (visible on homepage)</span>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleSaveBanner}
                    disabled={createBanner.isPending || updateBanner.isPending || imageUploading}
                    className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2"
                  >
                    {(createBanner.isPending || updateBanner.isPending) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {editingBannerId !== null ? "Save Changes" : "Create Banner"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={resetBannerForm}
                    className="border-purple-900/50 text-gray-400 hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Banner List */}
            {bannersLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              </div>
            ) : !allBanners || allBanners.length === 0 ? (
              <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-12 text-center">
                <ImageIcon className="w-12 h-12 text-purple-700 mx-auto mb-3" />
                <p className="text-white font-medium mb-1">No banners yet</p>
                <p className="text-sm text-gray-500">Add your first hero slider banner above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allBanners.map((banner: any, index: number) => {
                  const translations = banner.translations as Record<string, any> | null;
                  const en = translations?.en ?? {};
                  return (
                    <div
                      key={banner.id}
                      className={cn(
                        "bg-[#1A1033] border rounded-xl overflow-hidden transition-colors",
                        banner.isActive ? "border-purple-900/40" : "border-purple-900/20 opacity-60"
                      )}
                    >
                      <div className="flex items-stretch gap-0">
                        {/* Thumbnail */}
                        <div className="w-32 md:w-48 flex-shrink-0 relative">
                          {banner.imageUrl ? (
                            <img
                              src={banner.imageUrl}
                              alt={en.headline ?? "Banner"}
                              className="w-full h-full object-cover"
                              style={{ minHeight: "96px" }}
                            />
                          ) : (
                            <div className="w-full h-full min-h-[96px] bg-purple-900/30 flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-purple-700" />
                            </div>
                          )}
                          {/* Order badge */}
                          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold rounded px-1.5 py-0.5">
                            #{index + 1}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                          <div>
                            <div className="flex items-start gap-2 mb-1">
                              <p className="text-white font-semibold line-clamp-1 flex-1">
                                {en.headline || <span className="text-gray-500 italic">No headline</span>}
                              </p>
                              <Badge className={cn(
                                "text-xs flex-shrink-0",
                                banner.isActive
                                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                                  : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                              )}>
                                {banner.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            {en.subtext && (
                              <p className="text-sm text-gray-400 line-clamp-1">{en.subtext}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" />
                                {banner.ctaLink || "/create"}
                              </span>
                              {en.ctaLabel && (
                                <span className="bg-[#F59E0B]/20 text-[#F59E0B] px-2 py-0.5 rounded">
                                  {en.ctaLabel}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col items-center justify-center gap-1 px-3 border-l border-purple-900/30">
                          {/* Active toggle */}
                          <button
                            title={banner.isActive ? "Deactivate" : "Activate"}
                            onClick={() => toggleBannerActive.mutate({ id: banner.id, isActive: !banner.isActive })}
                            className={cn(
                              "p-1.5 rounded transition-colors",
                              banner.isActive ? "text-green-400 hover:text-green-300 hover:bg-green-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-gray-500/10"
                            )}
                          >
                            {banner.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          {/* Edit */}
                          <button
                            title="Edit"
                            onClick={() => startEditBanner(banner)}
                            className="p-1.5 rounded text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {/* Move up */}
                          <button
                            title="Move up"
                            onClick={() => handleMoveUp(banner, index)}
                            disabled={index === 0}
                            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-purple-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          {/* Move down */}
                          <button
                            title="Move down"
                            onClick={() => handleMoveDown(banner, index)}
                            disabled={!allBanners || index === allBanners.length - 1}
                            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-purple-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          {/* Delete */}
                          <button
                            title="Delete"
                            onClick={() => {
                              if (confirm("Delete this banner?")) {
                                deleteBanner.mutate({ id: banner.id });
                              }
                            }}
                            className="p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Featured Gamebooks Tab ──────────────────────────────────── */}
        {activeTab === "featured" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Featured Gamebooks</h2>
              <p className="text-sm text-gray-400 mt-0.5">Manage which books appear in the "Featured Gamebooks" section on the home page. Drag-free reordering via arrow buttons.</p>
            </div>

            {/* Current featured list */}
            <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                Currently Featured ({featuredBooks?.length ?? 0})
              </h3>
              {featuredLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                </div>
              ) : !featuredBooks || featuredBooks.length === 0 ? (
                <div className="text-center py-8">
                  <Star className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No featured books yet.</p>
                  <p className="text-gray-500 text-xs mt-1">Search and add books below. Until you add books, the home page will show the top 8 by sales.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {featuredBooks.map((row: any, idx: number) => (
                    <div key={row.book.id} className="flex items-center gap-3 bg-[#0D0B1A] rounded-lg px-4 py-3">
                      {/* Cover */}
                      <div className="w-10 h-14 rounded overflow-hidden flex-shrink-0 bg-purple-900/30">
                        {row.book.coverImageUrl ? (
                          <img src={row.book.coverImageUrl} alt={row.book.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-gray-600" />
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{row.book.title}</p>
                        <p className="text-xs text-gray-400">{row.authorName ?? "Unknown"} · {row.book.category?.replace(/_/g, " ")}</p>
                      </div>
                      {/* Position badge */}
                      <span className="text-xs text-gray-500 tabular-nums w-6 text-center">#{idx + 1}</span>
                      {/* Reorder */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          disabled={idx === 0 || reorderFeatured.isPending}
                          onClick={() => reorderFeatured.mutate({ bookId: row.book.id, direction: "up" })}
                          className="p-1 text-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                          title="Move up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={idx === (featuredBooks.length - 1) || reorderFeatured.isPending}
                          onClick={() => reorderFeatured.mutate({ bookId: row.book.id, direction: "down" })}
                          className="p-1 text-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                          title="Move down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {/* Remove */}
                      <button
                        onClick={() => unfeatureBook.mutate({ bookId: row.book.id })}
                        className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                        title="Remove from featured"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add books section */}
            <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-purple-400" />
                Add Books to Featured
              </h3>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search published books..."
                  value={featuredSearch}
                  onChange={e => setFeaturedSearch(e.target.value)}
                  className="pl-9 bg-[#0D0B1A] border-purple-900/40 text-white placeholder:text-gray-500"
                />
              </div>
              {searchLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                </div>
              ) : !searchResults || searchResults.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-6">
                  {featuredSearch ? "No matching published books found." : "All published books are already featured, or none exist yet."}
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {searchResults.map((row: any) => (
                    <div key={row.book.id} className="flex items-center gap-3 bg-[#0D0B1A] rounded-lg px-4 py-3">
                      <div className="w-8 h-11 rounded overflow-hidden flex-shrink-0 bg-purple-900/30">
                        {row.book.coverImageUrl ? (
                          <img src={row.book.coverImageUrl} alt={row.book.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="w-3 h-3 text-gray-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{row.book.title}</p>
                        <p className="text-xs text-gray-400">{row.authorName ?? "Unknown"} · {row.book.category?.replace(/_/g, " ")} · {row.book.purchaseCount ?? 0} sales</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => featureBook.mutate({ bookId: row.book.id })}
                        disabled={featureBook.isPending}
                        className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs px-3 h-7 gap-1 flex-shrink-0"
                      >
                        <Plus className="w-3 h-3" />
                        Feature
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Reports Tab ─────────────────────────────────────────────────── */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Book Reports</h2>
              <p className="text-sm text-gray-400 mt-0.5">Pending reader reports requiring review</p>
            </div>

            {reportsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              </div>
            ) : !allReports || allReports.length === 0 ? (
              <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-12 text-center">
                <Flag className="w-12 h-12 text-purple-700 mx-auto mb-3" />
                <p className="text-white font-medium mb-1">No pending reports</p>
                <p className="text-sm text-gray-500">All clear — no books have been reported.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allReports.map((row: any) => (
                  <div key={row.report.id} className="bg-[#1A1033] border border-red-900/30 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold truncate">{row.bookTitle ?? `Book #${row.report.bookId}`}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Reported by: {row.reporterName ?? `User #${row.report.reporterUserId}`}</p>
                        <p className="text-sm text-gray-300 mt-2 bg-[#0D0B1A] rounded-lg p-2">{row.report.reason}</p>
                        <p className="text-xs text-gray-600 mt-1">{new Date(row.report.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveReport.mutate({ reportId: row.report.id, delistBook: false })}
                          disabled={resolveReport.isPending}
                          className="border-green-700/50 text-green-400 hover:bg-green-900/20 text-xs"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" /> Dismiss
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delist "${row.bookTitle}" and resolve this report?`)) {
                              resolveReport.mutate({ reportId: row.report.id, delistBook: true });
                            }
                          }}
                          disabled={resolveReport.isPending || row.bookIsDelisted}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs"
                        >
                          <Ban className="w-3 h-3 mr-1" />
                          {row.bookIsDelisted ? "Already Delisted" : "Delist Book"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
