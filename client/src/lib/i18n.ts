
export type Language = {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
};

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱" },
  { code: "pl", name: "Polish", nativeName: "Polski", flag: "🇵🇱" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  { code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "sv", name: "Swedish", nativeName: "Svenska", flag: "🇸🇪" },
  { code: "da", name: "Danish", nativeName: "Dansk", flag: "🇩🇰" },
  { code: "no", name: "Norwegian", nativeName: "Norsk", flag: "🇳🇴" },
];

export type TranslationKey =
  | "nav.create" | "nav.library" | "nav.store" | "nav.leaderboard"
  | "nav.signIn" | "nav.signOut" | "nav.credits"
  // Hero slider default slides
  | "home.hero.slide1.headline" | "home.hero.slide1.subtext" | "home.hero.slide1.cta"
  | "home.hero.slide2.headline" | "home.hero.slide2.subtext" | "home.hero.slide2.cta"
  | "home.hero.slide3.headline" | "home.hero.slide3.subtext" | "home.hero.slide3.cta"
  | "home.hero.cta.create" | "home.hero.cta.store"
  // Featured section
  | "home.featured.title" | "home.featured.subtitle" | "home.featured.viewAll"
  | "home.featured.empty" | "home.featured.beFirst"
  // How It Works
  | "home.howItWorks.title" | "home.howItWorks.subtitle"
  | "home.step1.title" | "home.step1.desc"
  | "home.step2.title" | "home.step2.desc"
  | "home.step3.title" | "home.step3.desc"
  // Stats
  | "home.stats.books" | "home.stats.readers" | "home.stats.authors" | "home.stats.choices"
  // Create page
  | "create.title" | "create.subtitle"
  | "create.bookTitle" | "create.bookType" | "create.bookLanguage"
  | "create.bookLength" | "create.storyDesc" | "create.characters"
  | "create.addCharacter" | "create.safetyFlags" | "create.safetyDesc"
  | "create.creditCost" | "create.baseCost" | "create.photoExtra"
  | "create.total" | "create.balance" | "create.generate"
  | "create.thin" | "create.normal" | "create.thick"
  | "create.thin.pages" | "create.normal.pages" | "create.thick.pages"
  | "create.photoAdded" | "create.addPhoto" | "create.removeChar"
  // Library
  | "library.title" | "library.empty" | "library.search"
  | "library.generating" | "library.ready" | "library.failed"
  | "library.read" | "library.publish" | "library.publishedBadge"
  // Store
  | "store.title" | "store.subtitle" | "store.search" | "store.buy"
  | "store.owned" | "store.price" | "store.reviews"
  // Leaderboard
  | "leaderboard.title" | "leaderboard.bestSellers" | "leaderboard.newArrivals"
  | "leaderboard.mostPopular" | "leaderboard.rank" | "leaderboard.author"
  | "leaderboard.sales" | "leaderboard.rating"
  // Reader
  | "reader.choice" | "reader.choiceA" | "reader.choiceB"
  | "reader.theEnd" | "reader.restart" | "reader.backToLibrary"
  // Credits
  | "credits.title" | "credits.balance" | "credits.buyMore"
  | "credits.history" | "credits.package.starter" | "credits.package.explorer"
  | "credits.package.creator"
  // Onboarding
  | "onboarding.title" | "onboarding.subtitle" | "onboarding.authorName"
  | "onboarding.authorNameHint" | "onboarding.continue" | "onboarding.checking"
  | "onboarding.taken" | "onboarding.available"
  // Common
  | "common.backToHome" | "common.loading" | "common.error" | "common.save"
  | "common.cancel" | "common.delete" | "common.confirm" | "common.search"
  // Footer
  | "footer.platform" | "footer.legal" | "footer.language" | "footer.contact"
  | "footer.impressum" | "footer.legalNotice" | "footer.privacyPolicy"
  | "footer.cookiePolicy" | "footer.cookieSettings" | "footer.credits"
  | "footer.tagline" | "footer.copyright"
  // Legal page titles
  | "legal.impressum" | "legal.legalNotice" | "legal.privacyPolicy"
  | "legal.cookiePolicy" | "legal.cookieSettings"
  // Legal page content — Impressum
  | "legal.impressum.infoTitle" | "legal.impressum.company" | "legal.impressum.address"
  | "legal.impressum.representedBy" | "legal.impressum.contact" | "legal.impressum.email"
  | "legal.impressum.responsible" | "legal.impressum.disputeTitle" | "legal.impressum.disputeText"
  // Legal page content — Legal Notice
  | "legal.notice.title" | "legal.notice.intro"
  | "legal.notice.s1.title" | "legal.notice.s1.text"
  | "legal.notice.s2.title" | "legal.notice.s2.text"
  | "legal.notice.s3.title" | "legal.notice.s3.text"
  | "legal.notice.s4.title" | "legal.notice.s4.text"
  | "legal.notice.s5.title" | "legal.notice.s5.text"
  | "legal.notice.s6.title" | "legal.notice.s6.text"
  | "legal.notice.s7.title" | "legal.notice.s7.text"
  // Legal page content — Privacy Policy
  | "legal.privacy.lastUpdated" | "legal.privacy.lastUpdatedDate"
  | "legal.privacy.s1.title" | "legal.privacy.s1.text"
  | "legal.privacy.s2.title" | "legal.privacy.s2.text"
  | "legal.privacy.s3.title" | "legal.privacy.s3.text"
  | "legal.privacy.s4.title" | "legal.privacy.s4.text"
  | "legal.privacy.s5.title" | "legal.privacy.s5.text"
  | "legal.privacy.s6.title" | "legal.privacy.s6.text"
  // Legal page content — Cookie Policy
  | "legal.cookie.whatTitle" | "legal.cookie.whatText"
  | "legal.cookie.typesTitle"
  | "legal.cookie.necessary" | "legal.cookie.necessaryText"
  | "legal.cookie.analytics" | "legal.cookie.analyticsText"
  | "legal.cookie.preference" | "legal.cookie.preferenceText"
  | "legal.cookie.manageTitle" | "legal.cookie.manageText" | "legal.cookie.manageLink"
  // Cookie Settings page
  | "cookieSettings.title" | "cookieSettings.necessary" | "cookieSettings.necessaryDesc"
  | "cookieSettings.analytics" | "cookieSettings.analyticsDesc"
  | "cookieSettings.marketing" | "cookieSettings.marketingDesc"
  | "cookieSettings.save" | "cookieSettings.saved" | "cookieSettings.failed"
  // Categories
  | "category.fairy_tale" | "category.comic" | "category.crime_mystery"
  | "category.fantasy_scifi" | "category.romance" | "category.horror_thriller"
  // Admin
  | "admin.title" | "admin.members" | "admin.books" | "admin.campaigns"
  | "admin.banners" | "admin.reviews" | "admin.rewards"
  // Create — extra strings
  | "create.buyCredits" | "create.generating" | "create.photoCostNote"
  | "create.signInToCreate" | "create.signIn"
  // Library — extra strings
  | "library.pending" | "library.completed" | "library.refresh"
  | "library.retryGeneration" | "library.maxRetries" | "library.pages"
  | "library.createBook" | "library.createFirst" | "library.signInTitle"
  | "library.signInDesc" | "library.signIn"
  | "library.publishTitle" | "library.publishDesc" | "library.priceLabel"
  | "library.youEarn" | "library.platformFee" | "library.publishBtn"
  | "library.cat.all" | "library.cat.fairy_tale" | "library.cat.comic"
  | "library.cat.crime_mystery" | "library.cat.fantasy_scifi"
  | "library.cat.romance" | "library.cat.horror_thriller"
  // Store — extra strings
  | "store.allCategories" | "store.comicBook" | "store.crimeMysteryCat"
  | "store.fantasySciCat" | "store.romanceCat" | "store.horrorCat"
  | "store.sortNewest" | "store.sortPopular" | "store.sortPriceLow"
  | "store.sortPriceHigh" | "store.sortRating" | "store.categoryFilter"
  | "store.sortBy" | "store.read" | "store.unknownAuthor"
  | "store.empty" | "store.createBook" | "store.prevPage" | "store.nextPage"
  | "store.insufficientCredits" | "store.addedToLibrary" | "store.purchaseFailed"
  // Reader — extra strings
  | "reader.cover" | "reader.pageOf" | "reader.noCoverImage"
  | "reader.beginReading" | "reader.swipeHint" | "reader.endOfSection"
  | "reader.adventureComplete" | "reader.reachedEnd" | "reader.completedBadge"
  | "reader.chooseAB" | "reader.signInTitle" | "reader.signIn"
  | "reader.bookNotFound" | "reader.bookNotFoundDesc" | "reader.backToLibraryBtn"
  | "reader.fullscreenOn" | "reader.fullscreenOff"
  | "reader.musicOn" | "reader.musicOff" | "reader.mute" | "reader.unmute"
  | "reader.storyMap" | "reader.by"
  | "reader.characters" | "reader.noCharacters"
  | "reader.makeChoiceToContinue"
  | "reader.prev" | "reader.next";

type Translations = Record<TranslationKey, string>;

const en: Translations = {
  "nav.create": "Create",
  "nav.library": "Library",
  "nav.store": "Store",
  "nav.leaderboard": "Leaderboard",
  "nav.signIn": "Sign In",
  "nav.signOut": "Sign Out",
  "nav.credits": "Credits",
  // Hero slider default slides
  "home.hero.slide1.headline": "Ready to be a hero of your own adventure?",
  "home.hero.slide1.subtext": "Create AI-powered interactive gamebooks",
  "home.hero.slide1.cta": "Create",
  "home.hero.slide2.headline": "Discover thousands of interactive stories",
  "home.hero.slide2.subtext": "Browse the gamebook marketplace",
  "home.hero.slide2.cta": "Store",
  "home.hero.slide3.headline": "Publish & Earn Credits",
  "home.hero.slide3.subtext": "Share your stories and climb the leaderboard",
  "home.hero.slide3.cta": "Leaderboard",
  "home.hero.cta.create": "Create",
  "home.hero.cta.store": "Store",
  // Featured
  "home.featured.title": "Featured Gamebooks",
  "home.featured.subtitle": "Discover the most popular interactive stories",
  "home.featured.viewAll": "View All",
  "home.featured.empty": "No books in the store yet. Be the first author!",
  "home.featured.beFirst": "Create",
  // How It Works
  "home.howItWorks.title": "How It Works",
  "home.howItWorks.subtitle": "Create, read, and share interactive gamebooks powered by AI in three simple steps",
  "home.step1.title": "Create with AI",
  "home.step1.desc": "Choose your genre, set your preferences, and let AI generate a complete interactive adventure with branching storylines.",
  "home.step2.title": "Read & Choose",
  "home.step2.desc": "Immerse yourself in a two-page spread reader with sound effects. Make choices that shape your unique story path.",
  "home.step3.title": "Publish & Earn",
  "home.step3.desc": "Share your creations in the Store. Earn credits from every sale and climb the bestseller leaderboard.",
  // Stats
  "home.stats.books": "Books Created",
  "home.stats.readers": "Active Readers",
  "home.stats.authors": "Authors",
  "home.stats.choices": "Choices Made",
  // Create
  "create.title": "Create Your Gamebook",
  "create.subtitle": "Fill in the details and let AI craft your interactive adventure",
  "create.bookTitle": "Book Title",
  "create.bookType": "Book Type",
  "create.bookLanguage": "Book Language",
  "create.bookLength": "Book Length",
  "create.storyDesc": "Story Description",
  "create.characters": "Characters",
  "create.addCharacter": "+ Add Character",
  "create.safetyFlags": "Safety Flags",
  "create.safetyDesc": "No hate speech, explicit content, extreme gore, or self-harm depiction",
  "create.creditCost": "Credit Cost",
  "create.baseCost": "Base Cost",
  "create.photoExtra": "Character Photos",
  "create.total": "Total",
  "create.balance": "Your Balance",
  "create.generate": "Generate Book",
  "create.thin": "Thin",
  "create.normal": "Normal",
  "create.thick": "Thick",
  "create.thin.pages": "~10 pages",
  "create.normal.pages": "~80 pages",
  "create.thick.pages": "~120 pages",
  "create.photoAdded": "Photo Added",
  "create.addPhoto": "Add Photo",
  "create.removeChar": "Remove",
  // Library
  "library.title": "My Library",
  "library.empty": "Your library is empty. Create your first book!",
  "library.search": "Search books...",
  "library.generating": "Generating...",
  "library.ready": "Ready",
  "library.failed": "Failed",
  "library.read": "Read",
  "library.publish": "Publish to Store",
  "library.publishedBadge": "Published",
  // Store
  "store.title": "Bookstore",
  "store.subtitle": "Discover and purchase interactive gamebooks",
  "store.search": "Search books...",
  "store.buy": "Buy",
  "store.owned": "Owned",
  "store.price": "credits",
  "store.reviews": "reviews",
  // Leaderboard
  "leaderboard.title": "Leaderboard",
  "leaderboard.bestSellers": "Best Sellers",
  "leaderboard.newArrivals": "New Arrivals",
  "leaderboard.mostPopular": "Most Popular",
  "leaderboard.rank": "Rank",
  "leaderboard.author": "Author",
  "leaderboard.sales": "Sales",
  "leaderboard.rating": "Rating",
  // Reader
  "reader.choice": "Make your choice:",
  "reader.choiceA": "Choice A",
  "reader.choiceB": "Choice B",
  "reader.theEnd": "The End",
  "reader.restart": "Restart",
  "reader.backToLibrary": "Back to Library",
  // Credits
  "credits.title": "Credits",
  "credits.balance": "Your Balance",
  "credits.buyMore": "Buy More Credits",
  "credits.history": "Transaction History",
  "credits.package.starter": "Starter",
  "credits.package.explorer": "Explorer",
  "credits.package.creator": "Creator",
  // Onboarding
  "onboarding.title": "Welcome to Gamebook AI!",
  "onboarding.subtitle": "Choose your author name to get started",
  "onboarding.authorName": "Author Name",
  "onboarding.authorNameHint": "3-30 characters, letters, numbers, spaces, dots, underscores, hyphens",
  "onboarding.continue": "Continue",
  "onboarding.checking": "Checking...",
  "onboarding.taken": "Name already taken",
  "onboarding.available": "Name available!",
  // Common
  "common.backToHome": "Back to Home",
  "common.loading": "Loading...",
  "common.error": "An error occurred",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.confirm": "Confirm",
  "common.search": "Search",
  // Footer
  "footer.platform": "PLATFORM",
  "footer.legal": "LEGAL",
  "footer.language": "LANGUAGE",
  "footer.contact": "Contact: tolgar@sasmaz.digital",
  "footer.impressum": "Impressum",
  "footer.legalNotice": "Legal Notice",
  "footer.privacyPolicy": "Privacy Policy",
  "footer.cookiePolicy": "Cookie Policy",
  "footer.cookieSettings": "Cookie Settings",
  "footer.credits": "Credits",
  "footer.tagline": "Create interactive adventure books with AI. Make choices, shape stories, share with the world.",
  "footer.copyright": "© 2026 GAMEBOOKS by SASMAZ DIGITAL SERVICES. All rights reserved.",
  // Legal titles
  "legal.impressum": "Impressum",
  "legal.legalNotice": "Legal Notice",
  "legal.privacyPolicy": "Privacy Policy",
  "legal.cookiePolicy": "Cookie Policy",
  "legal.cookieSettings": "Cookie Settings",
  // Impressum content
  "legal.impressum.infoTitle": "Information according to § 5 TMG",
  "legal.impressum.company": "SASMAZ DIGITAL SERVICES",
  "legal.impressum.address": "München, 81543 Deutschland",
  "legal.impressum.representedBy": "Represented by",
  "legal.impressum.contact": "Contact",
  "legal.impressum.email": "Email: tolgar@sasmaz.digital",
  "legal.impressum.responsible": "Responsible for content according to § 55 Abs. 2 RStV",
  "legal.impressum.disputeTitle": "Dispute Resolution",
  "legal.impressum.disputeText": "The European Commission provides a platform for online dispute resolution (OS): https://ec.europa.eu/consumers/odr. We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.",
  // Legal Notice content
  "legal.notice.title": "Terms of Service",
  "legal.notice.intro": "By accessing and using GAMEBOOKS (\"the Platform\"), operated by SASMAZ DIGITAL SERVICES, you agree to comply with these terms.",
  "legal.notice.s1.title": "1. Service Description",
  "legal.notice.s1.text": "GAMEBOOKS is an AI-powered interactive gamebook creation and marketplace platform. Users can create, read, and trade interactive story books using a credit-based system.",
  "legal.notice.s2.title": "2. User Accounts",
  "legal.notice.s2.text": "Users must provide accurate information during registration. Each user is responsible for maintaining the security of their account credentials.",
  "legal.notice.s3.title": "3. Credits System",
  "legal.notice.s3.text": "Credits are a virtual currency used within the platform. Credits can be purchased with real currency and used to generate books or purchase books from other users. Credits have no cash value and cannot be exchanged for real currency.",
  "legal.notice.s4.title": "4. Content Policy",
  "legal.notice.s4.text": "Users agree not to generate content that contains hate speech, explicit sexual content, extreme violence, or content promoting self-harm. The platform reserves the right to remove any content that violates these guidelines.",
  "legal.notice.s5.title": "5. Intellectual Property",
  "legal.notice.s5.text": "Users retain ownership of the stories they create. By publishing to the Store, users grant the platform a non-exclusive license to display and distribute the content.",
  "legal.notice.s6.title": "6. Revenue Sharing",
  "legal.notice.s6.text": "When a book is sold in the Store, the author receives 30% of the sale price in credits, and the platform retains 70% as a service fee.",
  "legal.notice.s7.title": "7. Limitation of Liability",
  "legal.notice.s7.text": "SASMAZ DIGITAL SERVICES provides the platform as-is without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages.",
  // Privacy Policy content
  "legal.privacy.lastUpdated": "Last updated:",
  "legal.privacy.lastUpdatedDate": "February 2026",
  "legal.privacy.s1.title": "1. Data Controller",
  "legal.privacy.s1.text": "SASMAZ DIGITAL SERVICES, represented by TOLGAR SASMAZ\nMünchen, 81543 Deutschland\nEmail: tolgar@sasmaz.digital",
  "legal.privacy.s2.title": "2. Data We Collect",
  "legal.privacy.s2.text": "We collect: email address, author display name, usage data (books created, purchases, ratings), and technical data (IP address, browser type, device information).",
  "legal.privacy.s3.title": "3. Purpose of Processing",
  "legal.privacy.s3.text": "We process your data to: provide our services, manage your account, process transactions, improve our platform, and communicate with you about your account.",
  "legal.privacy.s4.title": "4. Legal Basis",
  "legal.privacy.s4.text": "We process data based on: contract performance (Art. 6(1)(b) GDPR), legitimate interests (Art. 6(1)(f) GDPR), and consent (Art. 6(1)(a) GDPR).",
  "legal.privacy.s5.title": "5. Data Retention",
  "legal.privacy.s5.text": "We retain your data for as long as your account is active. Upon account deletion, personal data is removed within 30 days, except where retention is required by law.",
  "legal.privacy.s6.title": "6. Your Rights",
  "legal.privacy.s6.text": "Under GDPR, you have the right to: access, rectification, erasure, restriction of processing, data portability, and objection. Contact us at tolgar@sasmaz.digital to exercise these rights.",
  // Cookie Policy content
  "legal.cookie.whatTitle": "What Are Cookies",
  "legal.cookie.whatText": "Cookies are small text files stored on your device when you visit our website. They help us provide you with a better experience.",
  "legal.cookie.typesTitle": "Types of Cookies We Use",
  "legal.cookie.necessary": "Necessary Cookies:",
  "legal.cookie.necessaryText": "Required for the platform to function. These include authentication tokens and session management.",
  "legal.cookie.analytics": "Analytics Cookies:",
  "legal.cookie.analyticsText": "Help us understand how visitors interact with our platform. This data is anonymized.",
  "legal.cookie.preference": "Preference Cookies:",
  "legal.cookie.preferenceText": "Remember your settings such as language preference and theme.",
  "legal.cookie.manageTitle": "Managing Cookies",
  "legal.cookie.manageText": "You can manage your cookie preferences through our",
  "legal.cookie.manageLink": "Cookie Settings",
  // Cookie Settings page
  "cookieSettings.title": "Cookie Settings",
  "cookieSettings.necessary": "Necessary Cookies",
  "cookieSettings.necessaryDesc": "Required for the platform to function. Cannot be disabled.",
  "cookieSettings.analytics": "Analytics Cookies",
  "cookieSettings.analyticsDesc": "Help us understand how visitors use our platform.",
  "cookieSettings.marketing": "Marketing Cookies",
  "cookieSettings.marketingDesc": "Used to deliver relevant advertisements.",
  "cookieSettings.save": "Save Preferences",
  "cookieSettings.saved": "Cookie preferences saved!",
  "cookieSettings.failed": "Failed to save preferences",
  // Categories
  "category.fairy_tale": "Illustrated Fairy Tale",
  "category.comic": "Comic Book",
  "category.crime_mystery": "Crime / Mystery",
  "category.fantasy_scifi": "Fantasy / Sci-Fi",
  "category.romance": "Romance",
  "category.horror_thriller": "Horror / Thriller",
  // Admin
  "admin.title": "Admin Panel",
  "admin.members": "Members",
  "admin.books": "Books",
  "admin.campaigns": "Campaigns",
  "admin.banners": "Banners",
  "admin.reviews": "Reviews",
  "admin.rewards": "Monthly Rewards",
  // Create — extra
  "create.buyCredits": "Buy Credits",
  "create.generating": "Generating...",
  "create.photoCostNote": "Adding a character photo costs +4 credits each.",
  "create.signInToCreate": "Sign in to create your gamebook",
  "create.signIn": "Sign In",
  // Library — extra
  "library.pending": "Pending",
  "library.completed": "Completed",
  "library.refresh": "Refresh",
  "library.retryGeneration": "Retry Generation",
  "library.maxRetries": "Max retries reached. Contact support if this persists.",
  "library.pages": "pages",
  "library.createBook": "+ Create Book",
  "library.createFirst": "Create Your First Book",
  "library.signInTitle": "Sign in to view your library",
  "library.signInDesc": "Create and manage your gamebooks after signing in.",
  "library.signIn": "Sign In",
  "library.publishTitle": "Publish to Store",
  "library.publishDesc": "Set a price for your book in the marketplace.",
  "library.priceLabel": "Price (credits)",
  "library.youEarn": "You earn:",
  "library.platformFee": "Platform retains 70% as a service fee. Author receives 30% per sale.",
  "library.publishBtn": "Publish",
  "library.cat.all": "All",
  "library.cat.fairy_tale": "Fairy Tale",
  "library.cat.comic": "Comic",
  "library.cat.crime_mystery": "Crime / Mystery",
  "library.cat.fantasy_scifi": "Fantasy / Sci-Fi",
  "library.cat.romance": "Romance",
  "library.cat.horror_thriller": "Horror / Thriller",
  // Store — extra
  "store.allCategories": "All Categories",
  "store.comicBook": "Comic Book",
  "store.crimeMysteryCat": "Crime / Mystery",
  "store.fantasySciCat": "Fantasy / Sci-Fi",
  "store.romanceCat": "Romance",
  "store.horrorCat": "Horror / Thriller",
  "store.sortNewest": "Newest",
  "store.sortPopular": "Most Popular",
  "store.sortPriceLow": "Price: Low to High",
  "store.sortPriceHigh": "Price: High to Low",
  "store.sortRating": "Top Rated",
  "store.categoryFilter": "Category",
  "store.sortBy": "Sort by",
  "store.read": "Read",
  "store.unknownAuthor": "Unknown Author",
  "store.empty": "No books found. Be the first author!",
  "store.createBook": "Create a Book",
  "store.prevPage": "Previous",
  "store.nextPage": "Next",
  "store.insufficientCredits": "Insufficient credits. Please buy more.",
  "store.addedToLibrary": "\"{title}\" added to your library!",
  "store.purchaseFailed": "Purchase failed",
  // Reader — extra
  "reader.cover": "Cover",
  "reader.pageOf": "Page {n} of {total}",
  "reader.noCoverImage": "No cover image",
  "reader.beginReading": "Begin Reading",
  "reader.swipeHint": "Swipe, drag, or use \u2190 \u2192 keys to turn pages",
  "reader.endOfSection": "End of this section",
  "reader.adventureComplete": "Adventure Complete!",
  "reader.reachedEnd": "You've reached the end of this story.",
  "reader.completedBadge": "Completed",
  "reader.chooseAB": "\u2190 Choose A or B \u2192",
  "reader.signInTitle": "Sign in to read",
  "reader.signIn": "Sign In",
  "reader.bookNotFound": "Book not found",
  "reader.bookNotFoundDesc": "This book doesn't exist or you don't have access to it.",
  "reader.backToLibraryBtn": "Back to Library",
  "reader.fullscreenOn": "Fullscreen mode (F)",
  "reader.fullscreenOff": "Exit fullscreen (F)",
  "reader.musicOn": "Disable ambient music",
  "reader.musicOff": "Enable ambient music",
  "reader.mute": "Mute",
  "reader.unmute": "Unmute",
  "reader.storyMap": "Story Map",
  "reader.by": "by",
  "reader.characters": "Characters",
  "reader.noCharacters": "No character information available for this book.",
  "reader.makeChoiceToContinue": "Make your choice to continue the story.",
  "reader.prev": "Prev",
  "reader.next": "Next",
};

const de: Partial<Translations> = {
  "nav.create": "Erstellen",
  "nav.library": "Bibliothek",
  "nav.store": "Shop",
  "nav.leaderboard": "Bestenliste",
  "nav.signIn": "Anmelden",
  "nav.signOut": "Abmelden",
  // Hero slider
  "home.hero.slide1.headline": "Bereit, der Held deines eigenen Abenteuers zu sein?",
  "home.hero.slide1.subtext": "Erstelle KI-gestützte interaktive Gamebooks",
  "home.hero.slide1.cta": "Erstellen",
  "home.hero.slide2.headline": "Entdecke tausende interaktiver Geschichten",
  "home.hero.slide2.subtext": "Stöbere im Gamebook-Marktplatz",
  "home.hero.slide2.cta": "Shop",
  "home.hero.slide3.headline": "Veröffentlichen & Guthaben verdienen",
  "home.hero.slide3.subtext": "Teile deine Geschichten und erklimme die Bestenliste",
  "home.hero.slide3.cta": "Bestenliste",
  "home.hero.cta.create": "Erstellen",
  "home.hero.cta.store": "Shop",
  // Featured
  "home.featured.title": "Ausgewählte Gamebooks",
  "home.featured.subtitle": "Entdecke die beliebtesten interaktiven Geschichten",
  "home.featured.viewAll": "Alle anzeigen",
  "home.featured.empty": "Noch keine Bücher im Shop. Sei der erste Autor!",
  "home.featured.beFirst": "Erstellen",
  // How It Works
  "home.howItWorks.title": "So funktioniert es",
  "home.howItWorks.subtitle": "Erstelle, lies und teile interaktive Gamebooks mit KI in drei einfachen Schritten",
  "home.step1.title": "Mit KI erstellen",
  "home.step1.desc": "Wähle dein Genre, stelle deine Präferenzen ein und lass die KI ein vollständiges interaktives Abenteuer mit verzweigten Handlungssträngen generieren.",
  "home.step2.title": "Lesen & Wählen",
  "home.step2.desc": "Tauche ein in einen Doppelseiten-Reader mit Soundeffekten. Triff Entscheidungen, die deinen einzigartigen Geschichtspfad formen.",
  "home.step3.title": "Veröffentlichen & Verdienen",
  "home.step3.desc": "Teile deine Kreationen im Shop. Verdiene Guthaben bei jedem Verkauf und erklimme die Bestseller-Bestenliste.",
  // Stats
  "home.stats.books": "Erstellte Bücher",
  "home.stats.readers": "Aktive Leser",
  "home.stats.authors": "Autoren",
  "home.stats.choices": "Getroffene Entscheidungen",
  // Create
  "create.title": "Dein Gamebook erstellen",
  "create.subtitle": "Fülle die Details aus und lass KI dein interaktives Abenteuer gestalten",
  "create.generate": "Buch generieren",
  // Library
  "library.read": "Lesen",
  "library.publish": "Im Shop veröffentlichen",
  // Store
  "store.buy": "Kaufen",
  "store.owned": "Besessen",
  // Common
  "common.backToHome": "Zurück zur Startseite",
  "common.loading": "Lädt...",
  // Footer
  "footer.platform": "PLATTFORM",
  "footer.legal": "RECHTLICHES",
  "footer.language": "SPRACHE",
  "footer.contact": "Kontakt: tolgar@sasmaz.digital",
  "footer.impressum": "Impressum",
  "footer.legalNotice": "Rechtlicher Hinweis",
  "footer.privacyPolicy": "Datenschutz",
  "footer.cookiePolicy": "Cookie-Richtlinie",
  "footer.cookieSettings": "Cookie-Einstellungen",
  "footer.credits": "Guthaben",
  "footer.tagline": "Erstelle interaktive Abenteuerbücher mit KI. Triff Entscheidungen, forme Geschichten, teile sie mit der Welt.",
  "footer.copyright": "© 2026 GAMEBOOKS von SASMAZ DIGITAL SERVICES. Alle Rechte vorbehalten.",
  // Legal titles
  "legal.impressum": "Impressum",
  "legal.legalNotice": "Rechtlicher Hinweis",
  "legal.privacyPolicy": "Datenschutzerklärung",
  "legal.cookiePolicy": "Cookie-Richtlinie",
  "legal.cookieSettings": "Cookie-Einstellungen",
  // Impressum content (stays in German by law)
  "legal.impressum.infoTitle": "Angaben gemäß § 5 TMG",
  "legal.impressum.representedBy": "Vertreten durch",
  "legal.impressum.contact": "Kontakt",
  "legal.impressum.responsible": "Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV",
  "legal.impressum.disputeTitle": "Streitschlichtung",
  "legal.impressum.disputeText": "Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
  // Legal Notice
  "legal.notice.title": "Nutzungsbedingungen",
  "legal.notice.intro": "Durch den Zugriff auf und die Nutzung von GAMEBOOKS (die Plattform), betrieben von SASMAZ DIGITAL SERVICES, stimmen Sie diesen Bedingungen zu.",
  "legal.notice.s1.title": "1. Dienstbeschreibung",
  "legal.notice.s1.text": "GAMEBOOKS ist eine KI-gestützte interaktive Gamebook-Erstellungs- und Marktplatzplattform. Nutzer können interaktive Geschichtsbücher mit einem Guthabensystem erstellen, lesen und handeln.",
  "legal.notice.s2.title": "2. Benutzerkonten",
  "legal.notice.s2.text": "Nutzer müssen bei der Registrierung genaue Angaben machen. Jeder Nutzer ist für die Sicherheit seiner Zugangsdaten verantwortlich.",
  "legal.notice.s3.title": "3. Guthabensystem",
  "legal.notice.s3.text": "Guthaben ist eine virtuelle Währung innerhalb der Plattform. Guthaben kann mit echter Währung gekauft und zum Erstellen oder Kaufen von Büchern verwendet werden. Guthaben hat keinen Bargeldwert und kann nicht in echte Währung umgetauscht werden.",
  "legal.notice.s4.title": "4. Inhaltsrichtlinie",
  "legal.notice.s4.text": "Nutzer verpflichten sich, keine Inhalte zu erstellen, die Hassrede, explizite sexuelle Inhalte, extreme Gewalt oder selbstschädigendes Verhalten enthalten. Die Plattform behält sich das Recht vor, Inhalte zu entfernen, die gegen diese Richtlinien verstoßen.",
  "legal.notice.s5.title": "5. Geistiges Eigentum",
  "legal.notice.s5.text": "Nutzer behalten das Eigentum an den von ihnen erstellten Geschichten. Durch die Veröffentlichung im Shop gewähren Nutzer der Plattform eine nicht-exklusive Lizenz zur Anzeige und Verbreitung der Inhalte.",
  "legal.notice.s6.title": "6. Umsatzbeteiligung",
  "legal.notice.s6.text": "Wenn ein Buch im Shop verkauft wird, erhält der Autor 30 % des Verkaufspreises in Guthaben, und die Plattform behält 70 % als Servicegebühr.",
  "legal.notice.s7.title": "7. Haftungsbeschränkung",
  "legal.notice.s7.text": "SASMAZ DIGITAL SERVICES stellt die Plattform ohne jegliche Garantien bereit. Wir haften nicht für indirekte, zufällige oder Folgeschäden.",
  // Privacy Policy
  "legal.privacy.lastUpdated": "Zuletzt aktualisiert:",
  "legal.privacy.lastUpdatedDate": "Februar 2026",
  "legal.privacy.s1.title": "1. Verantwortlicher",
  "legal.privacy.s1.text": "SASMAZ DIGITAL SERVICES, vertreten durch TOLGAR SASMAZ\nMünchen, 81543 Deutschland\nE-Mail: tolgar@sasmaz.digital",
  "legal.privacy.s2.title": "2. Erhobene Daten",
  "legal.privacy.s2.text": "Wir erheben: E-Mail-Adresse, Autoren-Anzeigename, Nutzungsdaten (erstellte Bücher, Käufe, Bewertungen) und technische Daten (IP-Adresse, Browsertyp, Geräteinformationen).",
  "legal.privacy.s3.title": "3. Zweck der Verarbeitung",
  "legal.privacy.s3.text": "Wir verarbeiten Ihre Daten, um: unsere Dienste bereitzustellen, Ihr Konto zu verwalten, Transaktionen zu verarbeiten, unsere Plattform zu verbessern und mit Ihnen über Ihr Konto zu kommunizieren.",
  "legal.privacy.s4.title": "4. Rechtsgrundlage",
  "legal.privacy.s4.text": "Wir verarbeiten Daten auf Basis von: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO), berechtigten Interessen (Art. 6 Abs. 1 lit. f DSGVO) und Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).",
  "legal.privacy.s5.title": "5. Datenspeicherung",
  "legal.privacy.s5.text": "Wir speichern Ihre Daten, solange Ihr Konto aktiv ist. Bei Kontolöschung werden personenbezogene Daten innerhalb von 30 Tagen entfernt, sofern keine gesetzliche Aufbewahrungspflicht besteht.",
  "legal.privacy.s6.title": "6. Ihre Rechte",
  "legal.privacy.s6.text": "Gemäß DSGVO haben Sie das Recht auf: Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Kontaktieren Sie uns unter tolgar@sasmaz.digital, um diese Rechte auszuüben.",
  // Cookie Policy
  "legal.cookie.whatTitle": "Was sind Cookies?",
  "legal.cookie.whatText": "Cookies sind kleine Textdateien, die auf Ihrem Gerät gespeichert werden, wenn Sie unsere Website besuchen. Sie helfen uns, Ihnen ein besseres Erlebnis zu bieten.",
  "legal.cookie.typesTitle": "Arten von Cookies, die wir verwenden",
  "legal.cookie.necessary": "Notwendige Cookies:",
  "legal.cookie.necessaryText": "Erforderlich für das Funktionieren der Plattform. Dazu gehören Authentifizierungstoken und Sitzungsverwaltung.",
  "legal.cookie.analytics": "Analyse-Cookies:",
  "legal.cookie.analyticsText": "Helfen uns zu verstehen, wie Besucher mit unserer Plattform interagieren. Diese Daten sind anonymisiert.",
  "legal.cookie.preference": "Präferenz-Cookies:",
  "legal.cookie.preferenceText": "Speichern Ihre Einstellungen wie Sprachpräferenz und Theme.",
  "legal.cookie.manageTitle": "Cookies verwalten",
  "legal.cookie.manageText": "Sie können Ihre Cookie-Einstellungen über unsere",
  "legal.cookie.manageLink": "Cookie-Einstellungen",
  // Cookie Settings
  "cookieSettings.title": "Cookie-Einstellungen",
  "cookieSettings.necessary": "Notwendige Cookies",
  "cookieSettings.necessaryDesc": "Erforderlich für das Funktionieren der Plattform. Kann nicht deaktiviert werden.",
  "cookieSettings.analytics": "Analyse-Cookies",
  "cookieSettings.analyticsDesc": "Helfen uns zu verstehen, wie Besucher unsere Plattform nutzen.",
  "cookieSettings.marketing": "Marketing-Cookies",
  "cookieSettings.marketingDesc": "Werden verwendet, um relevante Werbung zu schalten.",
  "cookieSettings.save": "Einstellungen speichern",
  "cookieSettings.saved": "Cookie-Einstellungen gespeichert!",
  "cookieSettings.failed": "Einstellungen konnten nicht gespeichert werden",
  // Categories
  "category.fairy_tale": "Illustriertes M\u00e4rchen",
  "category.comic": "Comic",
  "category.crime_mystery": "Krimi / Mystery",
  "category.fantasy_scifi": "Fantasy / Sci-Fi",
  "category.romance": "Romantik",
  "category.horror_thriller": "Horror / Thriller",
  // Create — extra
  "create.buyCredits": "Guthaben kaufen",
  "create.generating": "Generiere...",
  "create.photoCostNote": "Das Hinzuf\u00fcgen eines Charakterfotos kostet jeweils +4 Guthaben.",
  "create.signInToCreate": "Anmelden, um dein Gamebook zu erstellen",
  "create.signIn": "Anmelden",
  // Library — extra
  "library.pending": "Ausstehend",
  "library.completed": "Abgeschlossen",
  "library.refresh": "Aktualisieren",
  "library.retryGeneration": "Erneut generieren",
  "library.maxRetries": "Maximale Versuche erreicht. Kontaktiere den Support.",
  "library.pages": "Seiten",
  "library.createBook": "+ Buch erstellen",
  "library.createFirst": "Dein erstes Buch erstellen",
  "library.signInTitle": "Anmelden, um deine Bibliothek zu sehen",
  "library.signInDesc": "Erstelle und verwalte deine Gamebooks nach der Anmeldung.",
  "library.signIn": "Anmelden",
  "library.publishTitle": "Im Shop ver\u00f6ffentlichen",
  "library.publishDesc": "Lege einen Preis f\u00fcr dein Buch im Marktplatz fest.",
  "library.priceLabel": "Preis (Guthaben)",
  "library.youEarn": "Du verdienst:",
  "library.platformFee": "Plattform beh\u00e4lt 70 % als Servicegebühr. Autor erh\u00e4lt 30 % pro Verkauf.",
  "library.publishBtn": "Ver\u00f6ffentlichen",
  "library.cat.all": "Alle",
  "library.cat.fairy_tale": "M\u00e4rchen",
  "library.cat.comic": "Comic",
  "library.cat.crime_mystery": "Krimi / Mystery",
  "library.cat.fantasy_scifi": "Fantasy / Sci-Fi",
  "library.cat.romance": "Romantik",
  "library.cat.horror_thriller": "Horror / Thriller",
  // Store — extra
  "store.allCategories": "Alle Kategorien",
  "store.comicBook": "Comic",
  "store.crimeMysteryCat": "Krimi / Mystery",
  "store.fantasySciCat": "Fantasy / Sci-Fi",
  "store.romanceCat": "Romantik",
  "store.horrorCat": "Horror / Thriller",
  "store.sortNewest": "Neueste",
  "store.sortPopular": "Beliebteste",
  "store.sortPriceLow": "Preis: Aufsteigend",
  "store.sortPriceHigh": "Preis: Absteigend",
  "store.sortRating": "Bestbewertet",
  "store.categoryFilter": "Kategorie",
  "store.sortBy": "Sortieren nach",
  "store.read": "Lesen",
  "store.unknownAuthor": "Unbekannter Autor",
  "store.empty": "Keine B\u00fccher gefunden. Sei der erste Autor!",
  "store.createBook": "Buch erstellen",
  "store.prevPage": "Zur\u00fcck",
  "store.nextPage": "Weiter",
  "store.insufficientCredits": "Nicht genug Guthaben. Bitte kaufe mehr.",
  "store.addedToLibrary": "\"{title}\" zu deiner Bibliothek hinzugefügt!",
  "store.purchaseFailed": "Kauf fehlgeschlagen",
  // Reader — extra
  "reader.cover": "Umschlag",
  "reader.noCoverImage": "Kein Titelbild",
  "reader.beginReading": "Lesen beginnen",
  "reader.swipeHint": "Wischen, ziehen oder \u2190 \u2192 Tasten zum Bl\u00e4ttern",
  "reader.endOfSection": "Ende dieses Abschnitts",
  "reader.adventureComplete": "Abenteuer abgeschlossen!",
  "reader.reachedEnd": "Du hast das Ende dieser Geschichte erreicht.",
  "reader.completedBadge": "Abgeschlossen",
  "reader.chooseAB": "\u2190 W\u00e4hle A oder B \u2192",
  "reader.signInTitle": "Anmelden zum Lesen",
  "reader.signIn": "Anmelden",
  "reader.bookNotFound": "Buch nicht gefunden",
  "reader.bookNotFoundDesc": "Dieses Buch existiert nicht oder du hast keinen Zugriff.",
  "reader.backToLibraryBtn": "Zur\u00fcck zur Bibliothek",
  "reader.fullscreenOn": "Vollbildmodus (F)",
  "reader.fullscreenOff": "Vollbild beenden (F)",
  "reader.musicOn": "Hintergrundmusik deaktivieren",
  "reader.musicOff": "Hintergrundmusik aktivieren",
  "reader.mute": "Stummschalten",
  "reader.unmute": "Ton einschalten",
  "reader.storyMap": "Geschichtskarte",
  "reader.by": "von",
  "reader.characters": "Charaktere",
  "reader.noCharacters": "Keine Charakterinformationen für dieses Buch verfügbar.",
  "reader.makeChoiceToContinue": "Triff deine Wahl, damit die Geschichte weitergeht.",
  "reader.prev": "Zurück",
  "reader.next": "Weiter",
};

const tr: Partial<Translations> = {
  "nav.create": "Oluştur",
  "nav.library": "Kütüphane",
  "nav.store": "Mağaza",
  "nav.leaderboard": "Sıralama",
  "nav.signIn": "Giriş Yap",
  "nav.signOut": "Çıkış Yap",
  // Hero slider
  "home.hero.slide1.headline": "Kendi maceranın kahramanı olmaya hazır mısın?",
  "home.hero.slide1.subtext": "Yapay zeka destekli interaktif gamebook'lar oluştur",
  "home.hero.slide1.cta": "Oluştur",
  "home.hero.slide2.headline": "Binlerce interaktif hikayeyi keşfet",
  "home.hero.slide2.subtext": "Gamebook pazaryerini keşfet",
  "home.hero.slide2.cta": "Mağaza",
  "home.hero.slide3.headline": "Yayınla ve Kredi Kazan",
  "home.hero.slide3.subtext": "Hikayelerini paylaş ve sıralamada yüksel",
  "home.hero.slide3.cta": "Sıralama",
  "home.hero.cta.create": "Oluştur",
  "home.hero.cta.store": "Mağaza",
  // Featured
  "home.featured.title": "Öne Çıkan Gamebook'lar",
  "home.featured.subtitle": "En popüler interaktif hikayeleri keşfet",
  "home.featured.viewAll": "Tümünü Gör",
  "home.featured.empty": "Mağazada henüz kitap yok. İlk yazar sen ol!",
  "home.featured.beFirst": "Oluştur",
  // How It Works
  "home.howItWorks.title": "Nasıl Çalışır?",
  "home.howItWorks.subtitle": "Yapay zeka destekli interaktif gamebook'ları üç basit adımda oluştur, oku ve paylaş",
  "home.step1.title": "Yapay Zeka ile Oluştur",
  "home.step1.desc": "Türünü seç, tercihlerini belirle ve yapay zekanın dallanan hikaye çizgileriyle eksiksiz bir interaktif macera oluşturmasına izin ver.",
  "home.step2.title": "Oku ve Seç",
  "home.step2.desc": "Ses efektleriyle çift sayfa okuyucuya dal. Benzersiz hikaye yolunu şekillendiren seçimler yap.",
  "home.step3.title": "Yayınla ve Kazan",
  "home.step3.desc": "Eserlerini Mağaza'da paylaş. Her satıştan kredi kazan ve en çok satanlar listesinde yüksel.",
  // Stats
  "home.stats.books": "Oluşturulan Kitap",
  "home.stats.readers": "Aktif Okuyucu",
  "home.stats.authors": "Yazar",
  "home.stats.choices": "Yapılan Seçim",
  // Create
  "create.title": "Gamebook'unuzu Oluşturun",
  "create.subtitle": "Detayları doldurun ve yapay zeka interaktif maceranızı oluştursun",
  "create.generate": "Kitap Oluştur",
  // Library
  "library.read": "Oku",
  "library.publish": "Mağazada Yayınla",
  // Store
  "store.buy": "Satın Al",
  "store.owned": "Sahip Olundu",
  // Common
  "common.backToHome": "Ana Sayfaya Dön",
  "common.loading": "Yükleniyor...",
  // Footer
  "footer.platform": "PLATFORM",
  "footer.legal": "HUKUKİ",
  "footer.language": "DİL",
  "footer.contact": "İletişim: tolgar@sasmaz.digital",
  "footer.impressum": "Künye",
  "footer.legalNotice": "Yasal Uyarı",
  "footer.privacyPolicy": "Gizlilik Politikası",
  "footer.cookiePolicy": "Çerez Politikası",
  "footer.cookieSettings": "Çerez Ayarları",
  "footer.credits": "Kredi",
  "footer.tagline": "Yapay zeka ile interaktif macera kitapları oluştur. Seçimler yap, hikayeler şekillendir, dünyayla paylaş.",
  "footer.copyright": "© 2026 GAMEBOOKS - SASMAZ DIGITAL SERVICES. Tüm hakları saklıdır.",
  // Legal titles
  "legal.impressum": "Künye",
  "legal.legalNotice": "Yasal Uyarı",
  "legal.privacyPolicy": "Gizlilik Politikası",
  "legal.cookiePolicy": "Çerez Politikası",
  "legal.cookieSettings": "Çerez Ayarları",
  // Impressum content
  "legal.impressum.infoTitle": "§ 5 TMG uyarınca bilgiler",
  "legal.impressum.representedBy": "Temsil eden",
  "legal.impressum.contact": "İletişim",
  "legal.impressum.responsible": "§ 55 Abs. 2 RStV uyarınca içerikten sorumlu",
  "legal.impressum.disputeTitle": "Uyuşmazlık Çözümü",
  "legal.impressum.disputeText": "Avrupa Komisyonu, çevrimiçi uyuşmazlık çözümü (OS) için bir platform sunmaktadır: https://ec.europa.eu/consumers/odr. Bir tüketici tahkim kurulu önünde uyuşmazlık çözüm süreçlerine katılmaya istekli veya yükümlü değiliz.",
  // Legal Notice
  "legal.notice.title": "Kullanım Koşulları",
  "legal.notice.intro": "SASMAZ DIGITAL SERVICES tarafından işletilen GAMEBOOKS'a (\"Platform\") erişerek ve kullanarak bu koşullara uymayı kabul edersiniz.",
  "legal.notice.s1.title": "1. Hizmet Açıklaması",
  "legal.notice.s1.text": "GAMEBOOKS, yapay zeka destekli interaktif gamebook oluşturma ve pazar yeri platformudur. Kullanıcılar kredi tabanlı bir sistemle interaktif hikaye kitapları oluşturabilir, okuyabilir ve takas edebilir.",
  "legal.notice.s2.title": "2. Kullanıcı Hesapları",
  "legal.notice.s2.text": "Kullanıcılar kayıt sırasında doğru bilgi sağlamalıdır. Her kullanıcı, hesap kimlik bilgilerinin güvenliğini korumaktan sorumludur.",
  "legal.notice.s3.title": "3. Kredi Sistemi",
  "legal.notice.s3.text": "Kredi, platform içinde kullanılan sanal bir para birimidir. Kredi gerçek para ile satın alınabilir ve kitap oluşturmak veya diğer kullanıcılardan kitap satın almak için kullanılabilir. Kredinin nakit değeri yoktur ve gerçek para ile değiştirilemez.",
  "legal.notice.s4.title": "4. İçerik Politikası",
  "legal.notice.s4.text": "Kullanıcılar, nefret söylemi, açık cinsel içerik, aşırı şiddet veya kendine zarar vermeyi teşvik eden içerik oluşturmamayı kabul eder. Platform, bu yönergeleri ihlal eden içerikleri kaldırma hakkını saklı tutar.",
  "legal.notice.s5.title": "5. Fikri Mülkiyet",
  "legal.notice.s5.text": "Kullanıcılar, oluşturdukları hikayelerin mülkiyetini elinde tutar. Mağaza'da yayınlayarak kullanıcılar, platforma içeriği görüntüleme ve dağıtma için münhasır olmayan bir lisans verir.",
  "legal.notice.s6.title": "6. Gelir Paylaşımı",
  "legal.notice.s6.text": "Mağaza'da bir kitap satıldığında, yazar satış fiyatının %30'unu kredi olarak alır ve platform %70'ini hizmet ücreti olarak tutar.",
  "legal.notice.s7.title": "7. Sorumluluk Sınırlaması",
  "legal.notice.s7.text": "SASMAZ DIGITAL SERVICES, platformu herhangi bir garanti olmaksızın \"olduğu gibi\" sunar. Dolaylı, tesadüfi veya sonuçsal zararlardan sorumlu değiliz.",
  // Privacy Policy
  "legal.privacy.lastUpdated": "Son güncelleme:",
  "legal.privacy.lastUpdatedDate": "Şubat 2026",
  "legal.privacy.s1.title": "1. Veri Sorumlusu",
  "legal.privacy.s1.text": "SASMAZ DIGITAL SERVICES, TOLGAR SASMAZ tarafından temsil edilmektedir\nMünchen, 81543 Almanya\nE-posta: tolgar@sasmaz.digital",
  "legal.privacy.s2.title": "2. Topladığımız Veriler",
  "legal.privacy.s2.text": "Şunları topluyoruz: e-posta adresi, yazar görünen adı, kullanım verileri (oluşturulan kitaplar, satın almalar, değerlendirmeler) ve teknik veriler (IP adresi, tarayıcı türü, cihaz bilgileri).",
  "legal.privacy.s3.title": "3. İşleme Amacı",
  "legal.privacy.s3.text": "Verilerinizi şu amaçlarla işliyoruz: hizmetlerimizi sunmak, hesabınızı yönetmek, işlemleri gerçekleştirmek, platformumuzu geliştirmek ve hesabınız hakkında sizinle iletişim kurmak.",
  "legal.privacy.s4.title": "4. Hukuki Dayanak",
  "legal.privacy.s4.text": "Verileri şu dayanakla işliyoruz: sözleşme ifası (GDPR Madde 6(1)(b)), meşru menfaatler (GDPR Madde 6(1)(f)) ve rıza (GDPR Madde 6(1)(a)).",
  "legal.privacy.s5.title": "5. Veri Saklama",
  "legal.privacy.s5.text": "Verilerinizi hesabınız aktif olduğu sürece saklarız. Hesap silinmesinde, yasal saklama zorunluluğu olmadıkça kişisel veriler 30 gün içinde kaldırılır.",
  "legal.privacy.s6.title": "6. Haklarınız",
  "legal.privacy.s6.text": "GDPR kapsamında şu haklara sahipsiniz: erişim, düzeltme, silme, işlemeyi kısıtlama, veri taşınabilirliği ve itiraz. Bu hakları kullanmak için tolgar@sasmaz.digital adresinden bizimle iletişime geçin.",
  // Cookie Policy
  "legal.cookie.whatTitle": "Çerezler Nedir?",
  "legal.cookie.whatText": "Çerezler, web sitemizi ziyaret ettiğinizde cihazınızda saklanan küçük metin dosyalarıdır. Daha iyi bir deneyim sunmamıza yardımcı olurlar.",
  "legal.cookie.typesTitle": "Kullandığımız Çerez Türleri",
  "legal.cookie.necessary": "Zorunlu Çerezler:",
  "legal.cookie.necessaryText": "Platformun çalışması için gereklidir. Kimlik doğrulama token'ları ve oturum yönetimini içerir.",
  "legal.cookie.analytics": "Analitik Çerezler:",
  "legal.cookie.analyticsText": "Ziyaretçilerin platformumuzla nasıl etkileşime girdiğini anlamamıza yardımcı olur. Bu veriler anonimleştirilmiştir.",
  "legal.cookie.preference": "Tercih Çerezleri:",
  "legal.cookie.preferenceText": "Dil tercihi ve tema gibi ayarlarınızı hatırlar.",
  "legal.cookie.manageTitle": "Çerezleri Yönetme",
  "legal.cookie.manageText": "Çerez tercihlerinizi",
  "legal.cookie.manageLink": "Çerez Ayarları",
  // Cookie Settings
  "cookieSettings.title": "Çerez Ayarları",
  "cookieSettings.necessary": "Zorunlu Çerezler",
  "cookieSettings.necessaryDesc": "Platformun çalışması için gereklidir. Devre dışı bırakılamaz.",
  "cookieSettings.analytics": "Analitik Çerezler",
  "cookieSettings.analyticsDesc": "Ziyaretçilerin platformumuzu nasıl kullandığını anlamamıza yardımcı olur.",
  "cookieSettings.marketing": "Pazarlama Çerezleri",
  "cookieSettings.marketingDesc": "İlgili reklamlar sunmak için kullanılır.",
  "cookieSettings.save": "Tercihleri Kaydet",
  "cookieSettings.saved": "Çerez tercihleri kaydedildi!",
  "cookieSettings.failed": "Tercihler kaydedilemedi",
  // Categories
  "category.fairy_tale": "Resimli Peri Masal\u0131",
  "category.comic": "\u00c7izgi Roman",
  "category.crime_mystery": "Su\u00e7 / Gizem",
  "category.fantasy_scifi": "Fantezi / Bilim Kurgu",
  "category.romance": "Romantik",
  "category.horror_thriller": "Korku / Gerilim",
  // Create — extra
  "create.buyCredits": "Kredi Sat\u0131n Al",
  "create.generating": "Olu\u015fturuluyor...",
  "create.photoCostNote": "Karakter foto\u011fu eklemek her biri i\u00e7in +4 kredi tutar.",
  "create.signInToCreate": "Gamebook olu\u015fturmak i\u00e7in giri\u015f yap",
  "create.signIn": "Giri\u015f Yap",
  // Library — extra
  "library.pending": "Beklemede",
  "library.completed": "Tamamland\u0131",
  "library.refresh": "Yenile",
  "library.retryGeneration": "Yeniden Olu\u015ftur",
  "library.maxRetries": "Maksimum deneme say\u0131s\u0131na ula\u015f\u0131ld\u0131. Destek ile ileti\u015fime ge\u00e7in.",
  "library.pages": "sayfa",
  "library.createBook": "+ Kitap Olu\u015ftur",
  "library.createFirst": "\u0130lk Kitab\u0131n\u0131 Olu\u015ftur",
  "library.signInTitle": "K\u00fct\u00fcphaneni g\u00f6rmek i\u00e7in giri\u015f yap",
  "library.signInDesc": "Giri\u015f yapt\u0131ktan sonra gamebook'lar\u0131n\u0131 olu\u015ftur ve y\u00f6net.",
  "library.signIn": "Giri\u015f Yap",
  "library.publishTitle": "Ma\u011fazada Yay\u0131nla",
  "library.publishDesc": "Kitab\u0131n i\u00e7in pazar yerinde bir fiyat belirle.",
  "library.priceLabel": "Fiyat (kredi)",
  "library.youEarn": "Kazan\u0131rs\u0131n:",
  "library.platformFee": "Platform hizmet bedeli olarak %70 al\u0131r. Yazar sat\u0131\u015f ba\u015f\u0131na %30 kazan\u0131r.",
  "library.publishBtn": "Yay\u0131nla",
  "library.cat.all": "T\u00fcm\u00fc",
  "library.cat.fairy_tale": "Peri Masal\u0131",
  "library.cat.comic": "\u00c7izgi Roman",
  "library.cat.crime_mystery": "Su\u00e7 / Gizem",
  "library.cat.fantasy_scifi": "Fantezi / Bilim Kurgu",
  "library.cat.romance": "Romantik",
  "library.cat.horror_thriller": "Korku / Gerilim",
  // Store — extra
  "store.allCategories": "T\u00fcm Kategoriler",
  "store.comicBook": "\u00c7izgi Roman",
  "store.crimeMysteryCat": "Su\u00e7 / Gizem",
  "store.fantasySciCat": "Fantezi / Bilim Kurgu",
  "store.romanceCat": "Romantik",
  "store.horrorCat": "Korku / Gerilim",
  "store.sortNewest": "En Yeni",
  "store.sortPopular": "En Pop\u00fcler",
  "store.sortPriceLow": "Fiyat: D\u00fc\u015f\u00fckten Y\u00fcksek\u011fe",
  "store.sortPriceHigh": "Fiyat: Y\u00fcksekten D\u00fc\u015f\u00fc\u011fe",
  "store.sortRating": "En \u0130yi Puan",
  "store.categoryFilter": "Kategori",
  "store.sortBy": "S\u0131rala",
  "store.read": "Oku",
  "store.unknownAuthor": "Bilinmeyen Yazar",
  "store.empty": "Kitap bulunamad\u0131. \u0130lk yazar sen ol!",
  "store.createBook": "Kitap Olu\u015ftur",
  "store.prevPage": "\u00d6nceki",
  "store.nextPage": "Sonraki",
  "store.insufficientCredits": "Yetersiz kredi. L\u00fctfen daha fazla sat\u0131n al.",
  // Reader — extra
  "reader.cover": "Kapak",
  "reader.noCoverImage": "Kapak g\u00f6rseli yok",
  "reader.beginReading": "Okumaya Ba\u015fla",
  "reader.swipeHint": "Kayd\u0131r, s\u00fcr\u00fckle veya \u2190 \u2192 tu\u015flar\u0131yla sayfalar\u0131 \u00e7evir",
  "reader.endOfSection": "Bu b\u00f6l\u00fcm\u00fcn sonu",
  "reader.adventureComplete": "Macera Tamamland\u0131!",
  "reader.reachedEnd": "Bu hikayenin sonuna ula\u015ft\u0131n.",
  "reader.completedBadge": "Tamamland\u0131",
  "reader.chooseAB": "\u2190 A veya B'yi Se\u00e7 \u2192",
  "reader.signInTitle": "Okumak i\u00e7in giri\u015f yap",
  "reader.signIn": "Giri\u015f Yap",
  "reader.bookNotFound": "Kitap bulunamad\u0131",
  "reader.bookNotFoundDesc": "Bu kitap mevcut de\u011fil veya eri\u015fim izniniz yok.",
  "reader.backToLibraryBtn": "K\u00fct\u00fcphaneye D\u00f6n",
  "reader.fullscreenOn": "Tam ekran modu (F)",
  "reader.fullscreenOff": "Tam ekrandan \u00e7\u0131k (F)",
  "reader.musicOn": "Ortam m\u00fcziklerini kapat",
  "reader.musicOff": "Ortam m\u00fcziklerini a\u00e7",
  "reader.mute": "Sesi kapat",
  "reader.unmute": "Sesi a\u00e7",
  "reader.storyMap": "Hikaye Haritas\u0131",
  "reader.by": "yazan",
  "reader.characters": "Karakterler",
  "reader.noCharacters": "Bu kitap için karakter bilgisi mevcut değil.",
  "reader.makeChoiceToContinue": "Hikayenin devam etmesi için seçiminizi yapın.",
  "reader.prev": "Önceki",
  "reader.next": "Sonraki",
};

const fr: Partial<Translations> = {
  "nav.create": "Créer",
  "nav.library": "Bibliothèque",
  "nav.store": "Boutique",
  "nav.leaderboard": "Classement",
  "nav.signIn": "Se connecter",
  "nav.signOut": "Se déconnecter",
  // Hero slider
  "home.hero.slide1.headline": "Prêt à être le héros de ta propre aventure ?",
  "home.hero.slide1.subtext": "Crée des gamebooks interactifs propulsés par l'IA",
  "home.hero.slide1.cta": "Créer",
  "home.hero.slide2.headline": "Découvre des milliers d'histoires interactives",
  "home.hero.slide2.subtext": "Parcours le marché des gamebooks",
  "home.hero.slide2.cta": "Boutique",
  "home.hero.slide3.headline": "Publie & Gagne des crédits",
  "home.hero.slide3.subtext": "Partage tes histoires et grimpe dans le classement",
  "home.hero.slide3.cta": "Classement",
  "home.hero.cta.create": "Créer",
  "home.hero.cta.store": "Boutique",
  // Featured
  "home.featured.title": "Gamebooks en vedette",
  "home.featured.subtitle": "Découvrez les histoires interactives les plus populaires",
  "home.featured.viewAll": "Tout voir",
  "home.featured.empty": "Pas encore de livres dans la boutique. Soyez le premier auteur !",
  "home.featured.beFirst": "Créer",
  // How It Works
  "home.howItWorks.title": "Comment ça marche",
  "home.howItWorks.subtitle": "Créez, lisez et partagez des gamebooks interactifs propulsés par l'IA en trois étapes simples",
  "home.step1.title": "Créer avec l'IA",
  "home.step1.desc": "Choisissez votre genre, définissez vos préférences et laissez l'IA générer une aventure interactive complète avec des intrigues ramifiées.",
  "home.step2.title": "Lire & Choisir",
  "home.step2.desc": "Plongez dans un lecteur double page avec effets sonores. Faites des choix qui façonnent votre chemin d'histoire unique.",
  "home.step3.title": "Publier & Gagner",
  "home.step3.desc": "Partagez vos créations dans la Boutique. Gagnez des crédits à chaque vente et grimpez dans le classement des meilleures ventes.",
  // Stats
  "home.stats.books": "Livres créés",
  "home.stats.readers": "Lecteurs actifs",
  "home.stats.authors": "Auteurs",
  "home.stats.choices": "Choix effectués",
  // Create
  "create.title": "Créez votre Gamebook",
  "create.generate": "Générer le livre",
  // Library
  "library.read": "Lire",
  "library.publish": "Publier dans la boutique",
  // Store
  "store.buy": "Acheter",
  "store.owned": "Possédé",
  // Common
  "common.backToHome": "Retour à l'accueil",
  "common.loading": "Chargement...",
  // Footer
  "footer.platform": "PLATEFORME",
  "footer.legal": "LÉGAL",
  "footer.language": "LANGUE",
  "footer.contact": "Contact : tolgar@sasmaz.digital",
  "footer.impressum": "Mentions légales",
  "footer.legalNotice": "Avis légal",
  "footer.privacyPolicy": "Politique de confidentialité",
  "footer.cookiePolicy": "Politique des cookies",
  "footer.cookieSettings": "Paramètres des cookies",
  "footer.credits": "Crédits",
  "footer.tagline": "Créez des livres d'aventure interactifs avec l'IA. Faites des choix, façonnez des histoires, partagez avec le monde.",
  "footer.copyright": "© 2026 GAMEBOOKS par SASMAZ DIGITAL SERVICES. Tous droits réservés.",
  // Legal titles
  "legal.impressum": "Mentions légales",
  "legal.legalNotice": "Avis légal",
  "legal.privacyPolicy": "Politique de confidentialité",
  "legal.cookiePolicy": "Politique des cookies",
  "legal.cookieSettings": "Paramètres des cookies",
  // Cookie Settings
  "cookieSettings.title": "Param\u00e8tres des cookies",
  "cookieSettings.necessary": "Cookies n\u00e9cessaires",
  "cookieSettings.necessaryDesc": "Requis pour le fonctionnement de la plateforme. Ne peut pas \u00eatre d\u00e9sactiv\u00e9.",
  "cookieSettings.analytics": "Cookies analytiques",
  "cookieSettings.analyticsDesc": "Nous aident \u00e0 comprendre comment les visiteurs utilisent notre plateforme.",
  "cookieSettings.marketing": "Cookies marketing",
  "cookieSettings.marketingDesc": "Utilis\u00e9s pour diffuser des publicit\u00e9s pertinentes.",
  "cookieSettings.save": "Enregistrer les pr\u00e9f\u00e9rences",
  "cookieSettings.saved": "Pr\u00e9f\u00e9rences de cookies enregistr\u00e9es !",
  "cookieSettings.failed": "Impossible d'enregistrer les pr\u00e9f\u00e9rences",
  // Categories
  "category.fairy_tale": "Conte de f\u00e9es illustr\u00e9",
  "category.comic": "Bande dessin\u00e9e",
  "category.crime_mystery": "Crime / Myst\u00e8re",
  "category.fantasy_scifi": "Fantasy / Sci-Fi",
  "category.romance": "Romance",
  "category.horror_thriller": "Horreur / Thriller",
  // Create \u2014 extra
  "create.buyCredits": "Acheter des cr\u00e9dits",
  "create.generating": "G\u00e9n\u00e9ration en cours...",
  "create.photoCostNote": "Ajouter une photo de personnage co\u00fbte +4 cr\u00e9dits chacune.",
  "create.signInToCreate": "Connectez-vous pour cr\u00e9er votre gamebook",
  "create.signIn": "Se connecter",
  // Library \u2014 extra
  "library.pending": "En attente",
  "library.completed": "Termin\u00e9",
  "library.refresh": "Actualiser",
  "library.retryGeneration": "R\u00e9essayer la g\u00e9n\u00e9ration",
  "library.maxRetries": "Nombre maximum de tentatives atteint. Contactez le support.",
  "library.pages": "pages",
  "library.createBook": "+ Cr\u00e9er un livre",
  "library.createFirst": "Cr\u00e9ez votre premier livre",
  "library.signInTitle": "Connectez-vous pour voir votre biblioth\u00e8que",
  "library.signInDesc": "Cr\u00e9ez et g\u00e9rez vos gamebooks apr\u00e8s vous \u00eatre connect\u00e9.",
  "library.signIn": "Se connecter",
  "library.publishTitle": "Publier dans la boutique",
  "library.publishDesc": "D\u00e9finissez un prix pour votre livre sur la place de march\u00e9.",
  "library.priceLabel": "Prix (cr\u00e9dits)",
  "library.youEarn": "Vous gagnez :",
  "library.platformFee": "La plateforme conserve 70 % en tant que frais de service. L'auteur re\u00e7oit 30 % par vente.",
  "library.publishBtn": "Publier",
  "library.cat.all": "Tous",
  "library.cat.fairy_tale": "Conte de f\u00e9es",
  "library.cat.comic": "Bande dessin\u00e9e",
  "library.cat.crime_mystery": "Crime / Myst\u00e8re",
  "library.cat.fantasy_scifi": "Fantasy / Sci-Fi",
  "library.cat.romance": "Romance",
  "library.cat.horror_thriller": "Horreur / Thriller",
  // Store \u2014 extra
  "store.allCategories": "Toutes les cat\u00e9gories",
  "store.comicBook": "Bande dessin\u00e9e",
  "store.crimeMysteryCat": "Crime / Myst\u00e8re",
  "store.fantasySciCat": "Fantasy / Sci-Fi",
  "store.romanceCat": "Romance",
  "store.horrorCat": "Horreur / Thriller",
  "store.sortNewest": "Plus r\u00e9cent",
  "store.sortPopular": "Plus populaire",
  "store.sortPriceLow": "Prix : croissant",
  "store.sortPriceHigh": "Prix : d\u00e9croissant",
  "store.sortRating": "Mieux not\u00e9",
  "store.categoryFilter": "Cat\u00e9gorie",
  "store.sortBy": "Trier par",
  "store.read": "Lire",
  "store.unknownAuthor": "Auteur inconnu",
  "store.empty": "Aucun livre trouv\u00e9. Soyez le premier auteur !",
  "store.createBook": "Cr\u00e9er un livre",
  "store.prevPage": "Pr\u00e9c\u00e9dent",
  "store.nextPage": "Suivant",
  "store.insufficientCredits": "Cr\u00e9dits insuffisants. Veuillez en acheter plus.",
  // Reader \u2014 extra
  "reader.cover": "Couverture",
  "reader.noCoverImage": "Pas d'image de couverture",
  "reader.beginReading": "Commencer la lecture",
  "reader.swipeHint": "Glissez, faites glisser ou utilisez \u2190 \u2192 pour tourner les pages",
  "reader.endOfSection": "Fin de cette section",
  "reader.adventureComplete": "Aventure termin\u00e9e !",
  "reader.reachedEnd": "Vous avez atteint la fin de cette histoire.",
  "reader.completedBadge": "Termin\u00e9",
  "reader.chooseAB": "\u2190 Choisissez A ou B \u2192",
  "reader.signInTitle": "Connectez-vous pour lire",
  "reader.signIn": "Se connecter",
  "reader.bookNotFound": "Livre introuvable",
  "reader.bookNotFoundDesc": "Ce livre n'existe pas ou vous n'y avez pas acc\u00e8s.",
  "reader.backToLibraryBtn": "Retour \u00e0 la biblioth\u00e8que",
  "reader.fullscreenOn": "Mode plein \u00e9cran (F)",
  "reader.fullscreenOff": "Quitter le plein \u00e9cran (F)",
  "reader.musicOn": "D\u00e9sactiver la musique d'ambiance",
  "reader.musicOff": "Activer la musique d'ambiance",
  "reader.mute": "Muet",
  "reader.unmute": "Son activ\u00e9",
  "reader.storyMap": "Carte de l'histoire",
  "reader.by": "par",
  "reader.characters": "Personnages",
  "reader.noCharacters": "Aucune information sur les personnages disponible pour ce livre.",
  "reader.makeChoiceToContinue": "Faites votre choix pour continuer l'histoire.",
  "reader.prev": "Précédent",
  "reader.next": "Suivant",
};

const es: Partial<Translations> = {
  "nav.create": "Crear",
  "nav.library": "Biblioteca",
  "nav.store": "Tienda",
  "nav.leaderboard": "Clasificación",
  "nav.signIn": "Iniciar sesión",
  "nav.signOut": "Cerrar sesión",
  "home.hero.cta.create": "Crear",
  "home.hero.cta.store": "Tienda",
  "home.hero.slide1.headline": "¿Listo para ser el héroe de tu propia aventura?",
  "home.hero.slide1.subtext": "Crea gamebooks interactivos con IA",
  "home.hero.slide1.cta": "Crear",
  "home.hero.slide2.headline": "Descubre miles de historias interactivas",
  "home.hero.slide2.subtext": "Explora el mercado de gamebooks",
  "home.hero.slide2.cta": "Tienda",
  "home.hero.slide3.headline": "Publica y gana créditos",
  "home.hero.slide3.subtext": "Comparte tus historias y sube en el ranking",
  "home.hero.slide3.cta": "Clasificación",
  "home.featured.title": "Gamebooks destacados",
  "home.featured.subtitle": "Descubre las historias interactivas más populares",
  "home.featured.viewAll": "Ver todo",
  "home.howItWorks.title": "Cómo funciona",
  "home.howItWorks.subtitle": "Crea, lee y comparte gamebooks interactivos con IA en tres sencillos pasos",
  "home.step1.title": "Crear con IA",
  "home.step1.desc": "Elige tu género, establece tus preferencias y deja que la IA genere una aventura interactiva completa.",
  "home.step2.title": "Leer y elegir",
  "home.step2.desc": "Sumérgete en un lector de doble página con efectos de sonido. Toma decisiones que moldean tu historia.",
  "home.step3.title": "Publicar y ganar",
  "home.step3.desc": "Comparte tus creaciones en la Tienda. Gana créditos con cada venta.",
  "home.stats.books": "Libros creados",
  "home.stats.readers": "Lectores activos",
  "home.stats.authors": "Autores",
  "home.stats.choices": "Elecciones realizadas",
  "create.title": "Crea tu Gamebook",
  "create.generate": "Generar libro",
  "library.read": "Leer",
  "store.buy": "Comprar",
  "common.backToHome": "Volver al inicio",
  "common.loading": "Cargando...",
  "footer.tagline": "Crea libros de aventura interactivos con IA. Toma decisiones, moldea historias, comparte con el mundo.",
  "footer.copyright": "© 2026 GAMEBOOKS por SASMAZ DIGITAL SERVICES. Todos los derechos reservados.",
  "cookieSettings.title": "Configuración de cookies",
  "cookieSettings.necessary": "Cookies necesarias",
  "cookieSettings.necessaryDesc": "Necesarias para el funcionamiento de la plataforma. No se pueden desactivar.",
  "cookieSettings.analytics": "Cookies analíticas",
  "cookieSettings.analyticsDesc": "Nos ayudan a entender cómo los visitantes usan nuestra plataforma.",
  "cookieSettings.marketing": "Cookies de marketing",
  "cookieSettings.marketingDesc": "Utilizadas para mostrar anuncios relevantes.",
  "cookieSettings.save": "Guardar preferencias",
  "cookieSettings.saved": "¡Preferencias de cookies guardadas!",
  "cookieSettings.failed": "No se pudieron guardar las preferencias",
  "category.fairy_tale": "Cuento ilustrado",
  "category.comic": "Cómic",
  "category.crime_mystery": "Crimen / Misterio",
  "category.fantasy_scifi": "Fantasía / Sci-Fi",
  "category.romance": "Romance",
  "category.horror_thriller": "Terror / Thriller",
};

const it: Partial<Translations> = {
  "nav.create": "Crea",
  "nav.library": "Biblioteca",
  "nav.store": "Negozio",
  "nav.leaderboard": "Classifica",
  "nav.signIn": "Accedi",
  "nav.signOut": "Esci",
  "home.hero.slide1.headline": "Pronto a essere l'eroe della tua avventura?",
  "home.hero.slide1.subtext": "Crea gamebook interattivi con l'IA",
  "home.hero.slide1.cta": "Crea",
  "home.hero.slide2.headline": "Scopri migliaia di storie interattive",
  "home.hero.slide2.subtext": "Sfoglia il mercato dei gamebook",
  "home.hero.slide2.cta": "Negozio",
  "home.hero.slide3.headline": "Pubblica e guadagna crediti",
  "home.hero.slide3.subtext": "Condividi le tue storie e scala la classifica",
  "home.hero.slide3.cta": "Classifica",
  "home.featured.title": "Gamebook in evidenza",
  "home.featured.subtitle": "Scopri le storie interattive più popolari",
  "home.featured.viewAll": "Vedi tutto",
  "home.howItWorks.title": "Come funziona",
  "home.step1.title": "Crea con l'IA",
  "home.step2.title": "Leggi e scegli",
  "home.step3.title": "Pubblica e guadagna",
  "home.stats.books": "Libri creati",
  "home.stats.readers": "Lettori attivi",
  "home.stats.authors": "Autori",
  "home.stats.choices": "Scelte effettuate",
  "create.title": "Crea il tuo Gamebook",
  "create.generate": "Genera libro",
  "library.read": "Leggi",
  "store.buy": "Acquista",
  "common.backToHome": "Torna alla home",
  "common.loading": "Caricamento...",
  "footer.tagline": "Crea libri d'avventura interattivi con l'IA. Fai scelte, plasma storie, condividi con il mondo.",
  "footer.copyright": "© 2026 GAMEBOOKS di SASMAZ DIGITAL SERVICES. Tutti i diritti riservati.",
  "cookieSettings.title": "Impostazioni cookie",
  "cookieSettings.save": "Salva preferenze",
  "cookieSettings.saved": "Preferenze cookie salvate!",
  "cookieSettings.failed": "Impossibile salvare le preferenze",
};

const pt: Partial<Translations> = {
  "nav.create": "Criar",
  "nav.library": "Biblioteca",
  "nav.store": "Loja",
  "nav.leaderboard": "Classificação",
  "nav.signIn": "Entrar",
  "nav.signOut": "Sair",
  "home.hero.slide1.headline": "Pronto para ser o herói da sua própria aventura?",
  "home.hero.slide1.subtext": "Crie gamebooks interativos com IA",
  "home.hero.slide1.cta": "Criar",
  "home.hero.slide2.headline": "Descubra milhares de histórias interativas",
  "home.hero.slide2.subtext": "Explore o mercado de gamebooks",
  "home.hero.slide2.cta": "Loja",
  "home.hero.slide3.headline": "Publique e ganhe créditos",
  "home.hero.slide3.subtext": "Compartilhe suas histórias e suba no ranking",
  "home.hero.slide3.cta": "Classificação",
  "home.featured.title": "Gamebooks em destaque",
  "home.featured.subtitle": "Descubra as histórias interativas mais populares",
  "home.featured.viewAll": "Ver tudo",
  "home.howItWorks.title": "Como funciona",
  "home.step1.title": "Criar com IA",
  "home.step2.title": "Ler e escolher",
  "home.step3.title": "Publicar e ganhar",
  "home.stats.books": "Livros criados",
  "home.stats.readers": "Leitores ativos",
  "home.stats.authors": "Autores",
  "home.stats.choices": "Escolhas feitas",
  "create.title": "Crie seu Gamebook",
  "create.generate": "Gerar livro",
  "library.read": "Ler",
  "store.buy": "Comprar",
  "common.backToHome": "Voltar ao início",
  "common.loading": "Carregando...",
  "footer.tagline": "Crie livros de aventura interativos com IA. Faça escolhas, molde histórias, compartilhe com o mundo.",
  "footer.copyright": "© 2026 GAMEBOOKS por SASMAZ DIGITAL SERVICES. Todos os direitos reservados.",
  "cookieSettings.title": "Configurações de cookies",
  "cookieSettings.save": "Salvar preferências",
  "cookieSettings.saved": "Preferências de cookies salvas!",
  "cookieSettings.failed": "Não foi possível salvar as preferências",
};

const allTranslations: Record<string, Partial<Translations>> = {
  en, de, tr, fr, es, it, pt,
};

export function t(key: TranslationKey, lang: string): string {
  const langTranslations = allTranslations[lang] || {};
  return (langTranslations[key] as string) || (en[key] as string) || key;
}

export function getStoredLanguage(): string {
  try {
    return localStorage.getItem("gamebook_lang") || "en";
  } catch {
    return "en";
  }
}

export function setStoredLanguage(lang: string): void {
  try {
    localStorage.setItem("gamebook_lang", lang);
  } catch {}
}
