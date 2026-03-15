import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Camera, Save, User, BookOpen, Star, ShoppingBag, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const { data: profile, isLoading: profileLoading, refetch } = trpc.profile.get.useQuery(undefined, {
    enabled: !!user,
  });

  // Form state — initialised from profile once loaded
  const [authorName, setAuthorName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<{ base64Data: string; mimeType: string } | null>(null);
  const [formInitialised, setFormInitialised] = useState(false);

  // Sync form once profile loads
  if (profile && !formInitialised) {
    setAuthorName(profile.authorName ?? "");
    setBio(profile.bio ?? "");
    setFormInitialised(true);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully");
      setFormInitialised(false); // Reset to re-sync with fresh profile data
      refetch();
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error("That author name is already taken. Please choose another.");
      } else {
        toast.error(err.message || "Failed to update profile");
      }
    },
  });

  const uploadAvatarMutation = trpc.profile.uploadAvatar.useMutation({
    onSuccess: (data) => {
      setAvatarPreview(data.avatarUrl);
      setPendingAvatar(null);
      toast.success("Avatar updated");
      setFormInitialised(false); // Reset to re-sync with fresh profile data
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to upload avatar");
    },
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Only JPG, PNG, or WebP images are allowed");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Avatar must be smaller than 2 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      // Extract base64 portion
      const base64Data = dataUrl.split(",")[1];
      setAvatarPreview(dataUrl);
      setPendingAvatar({ base64Data, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSave = async () => {
    // Upload avatar first if pending
    if (pendingAvatar) {
      await uploadAvatarMutation.mutateAsync(pendingAvatar);
    }

    // Update profile fields
    const trimmedName = authorName.trim();
    const trimmedBio = bio.trim();

    const hasNameChange = trimmedName !== (profile?.authorName ?? "");
    const hasBioChange = trimmedBio !== (profile?.bio ?? "");

    if (hasNameChange || hasBioChange) {
      await updateMutation.mutateAsync({
        ...(hasNameChange ? { authorName: trimmedName } : {}),
        ...(hasBioChange ? { bio: trimmedBio || null } : {}),
      });
    } else if (!pendingAvatar) {
      toast.info("No changes to save");
    }
  };

  const isSaving = updateMutation.isPending || uploadAvatarMutation.isPending;

  if (authLoading || profileLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertCircle className="w-10 h-10 text-amber-400" />
          <p className="text-gray-300">Profile not found. Please complete onboarding first.</p>
          <Button onClick={() => navigate("/onboarding")} className="bg-purple-600 hover:bg-purple-700">
            Complete Onboarding
          </Button>
        </div>
      </AppLayout>
    );
  }

  const displayAvatar = avatarPreview ?? profile.avatarUrl;
  const initials = (profile.authorName ?? user.name ?? "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Author Profile</h1>
          <p className="text-gray-400 mt-1">Manage your public author identity and personal information.</p>
        </div>

        <div className="grid gap-6">
          {/* Avatar + name card */}
          <Card className="bg-[#1A1033] border-purple-900/40">
            <CardHeader>
              <CardTitle className="text-white text-lg">Identity</CardTitle>
              <CardDescription className="text-gray-400">
                Your author name and avatar are visible to all readers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar upload */}
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <Avatar className="w-24 h-24 ring-2 ring-purple-600/50">
                    <AvatarImage src={displayAvatar ?? undefined} alt={profile.authorName} />
                    <AvatarFallback className="bg-purple-900 text-white text-2xl font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label="Change avatar"
                  >
                    <Camera className="w-6 h-6 text-white" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{profile.authorName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 text-xs text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
                  >
                    Change avatar
                  </button>
                  <p className="text-xs text-gray-500 mt-0.5">JPG, PNG or WebP · max 2 MB</p>
                  {pendingAvatar && (
                    <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> New avatar ready — save to apply
                    </p>
                  )}
                </div>
              </div>

              <Separator className="bg-purple-900/30" />

              {/* Author name */}
              <div className="space-y-2">
                <Label htmlFor="authorName" className="text-gray-300">
                  Author Name
                </Label>
                <Input
                  id="authorName"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  maxLength={30}
                  placeholder="Your public author name"
                  className="bg-[#0D0B1A] border-purple-900/50 text-white placeholder:text-gray-600 focus:border-purple-500"
                />
                <p className="text-xs text-gray-500">
                  3–30 characters. Letters, numbers, spaces, dots, hyphens, underscores only.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Bio card */}
          <Card className="bg-[#1A1033] border-purple-900/40">
            <CardHeader>
              <CardTitle className="text-white text-lg">Bio</CardTitle>
              <CardDescription className="text-gray-400">
                Tell readers a little about yourself. Shown on your public author profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="bio" className="text-gray-300">
                About you
              </Label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={5}
                placeholder="I write adventure stories set in magical worlds…"
                className="w-full rounded-md border border-purple-900/50 bg-[#0D0B1A] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 text-right">{bio.length}/500</p>
            </CardContent>
          </Card>

          {/* Stats card (read-only) */}
          <Card className="bg-[#1A1033] border-purple-900/40">
            <CardHeader>
              <CardTitle className="text-white text-lg">Author Stats</CardTitle>
              <CardDescription className="text-gray-400">Your activity on Gamebook AI.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatTile icon={<BookOpen className="w-4 h-4 text-purple-400" />} label="Books" value={profile.cachedTotalBooks} />
                <StatTile icon={<ShoppingBag className="w-4 h-4 text-amber-400" />} label="Sales" value={profile.cachedTotalSales} />
                <StatTile icon={<Star className="w-4 h-4 text-yellow-400" />} label="Avg Rating" value={profile.cachedAverageRating > 0 ? profile.cachedAverageRating.toFixed(1) : "—"} />
                <StatTile icon={<CheckCircle className="w-4 h-4 text-green-400" />} label="Completions" value={profile.cachedTotalCompletions} />
              </div>
            </CardContent>
          </Card>

          {/* Account info card */}
          <Card className="bg-[#1A1033] border-purple-900/40">
            <CardHeader>
              <CardTitle className="text-white text-lg">Account</CardTitle>
              <CardDescription className="text-gray-400">Your login credentials (read-only).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Display name</p>
                  <p className="text-sm text-white">{user.name || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm text-white">{user.email}</p>
                </div>
              </div>
              {user.role === "admin" && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-900/50 border border-purple-700/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span className="text-xs text-purple-300 font-medium">Admin</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-purple-600 hover:bg-purple-700 text-white min-w-[140px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg bg-[#0D0B1A] border border-purple-900/30 px-3 py-4">
      {icon}
      <span className="text-lg font-bold text-white">{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

export default ProfilePage;
