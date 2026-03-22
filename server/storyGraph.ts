import { getBookGenerationRule } from "../shared/bookGenerationRules";

export type StoryPage = {
  pageNumber: number;
  branchPath: string;
  isBranchPage: boolean;
  isEnding?: boolean;
  content: string;
  sfxTags: string[];
  choiceA: string | null;
  choiceB: string | null;
  nextPageA: number | null;
  nextPageB: number | null;
};

export type StoryGenerationTargets = {
  readablePathLength: number;
  branchCount: number;
  branchImageCount: number;
  graphPageCount: number;
};

type FallbackTheme = {
  key: string;
  choiceText: Partial<Record<"en" | "tr" | "de" | "fr" | "es", string>>;
  sceneCue: string;
  consequenceCue: string;
  endingCue: string;
  sfxTags: string[];
};

type PlannedNode = {
  id: number;
  branchPath: string;
  depth: number;
  isBranchPage: boolean;
  isEnding: boolean;
  nextA: number | null;
  nextB: number | null;
  content: string;
  sfxTags: string[];
  choiceA: string | null;
  choiceB: string | null;
};

type ActivePath = {
  label: string;
  nodes: number[];
};

const FALLBACK_THEME_BANKS: Record<string, Array<[FallbackTheme, FallbackTheme]>> = {
  fairy_tale: [
    [
      {
        key: "star-trail",
        choiceText: {
          en: "Follow the glowing star trail",
          tr: "Parlayan yıldız izini takip et",
          de: "Folge der leuchtenden Sternspur",
          fr: "Suis la piste des etoiles brillantes",
          es: "Sigue la senda de estrellas brillantes",
        },
        sceneCue: "a glowing trail of stars curling through the sky",
        consequenceCue: "the glowing star trail keeps guiding the journey with bright momentum",
        endingCue: "the star trail opens into a radiant and triumphant moonlit arrival",
        sfxTags: ["chime", "wind", "star"],
      },
      {
        key: "pink-cloud",
        choiceText: {
          en: "Drift along the rosy cloud path",
          tr: "Pembe bulut yolundan ilerle",
          de: "Treibe den rosigen Wolkenpfad entlang",
          fr: "Glisse sur le chemin des nuages roses",
          es: "Avanza por el camino de nubes rosadas",
        },
        sceneCue: "a bridge of soft rosy clouds floating beside the moon",
        consequenceCue: "the rosy clouds wrap the scene in gentle, dreamy calm",
        endingCue: "the cloud path settles into a warm and peaceful moonlit refuge",
        sfxTags: ["wind", "magic", "soft"],
      },
    ],
    [
      {
        key: "moon-gate",
        choiceText: {
          en: "Enter the shining moon gate",
          tr: "Parlayan ay kapısından gir",
          de: "Betritt das leuchtende Mondtor",
          fr: "Entre par la porte lumineuse de la lune",
          es: "Entra por la puerta brillante de la luna",
        },
        sceneCue: "a shining gate opening in the moonlight",
        consequenceCue: "the moon gate reveals a sparkling new realm and a clearer route forward",
        endingCue: "the moon gate leads to a joyful discovery waiting just beyond the glow",
        sfxTags: ["door", "magic", "chime"],
      },
      {
        key: "lantern-garden",
        choiceText: {
          en: "Explore the lantern garden",
          tr: "Fener bahçesini keşfet",
          de: "Erkunde den Laternen-Garten",
          fr: "Explore le jardin des lanternes",
          es: "Explora el jardin de faroles",
        },
        sceneCue: "a hidden garden of floating lantern lights",
        consequenceCue: "the lantern garden fills the path with wonder, colour, and playful clues",
        endingCue: "the lantern garden glows into a tender and magical farewell",
        sfxTags: ["lantern", "magic", "birds"],
      },
    ],
    [
      {
        key: "comet-song",
        choiceText: {
          en: "Chase the singing comet",
          tr: "Şarkı söyleyen kuyruklu yıldızı izle",
          de: "Folge dem singenden Kometen",
          fr: "Suis la comete chantante",
          es: "Sigue al cometa cantor",
        },
        sceneCue: "a singing comet leaving a silver melody in the sky",
        consequenceCue: "the comet song pulls the story into a faster, brighter burst of adventure",
        endingCue: "the comet song crescendos into a bright and celebratory ending",
        sfxTags: ["whoosh", "chime", "magic"],
      },
      {
        key: "silver-harbor",
        choiceText: {
          en: "Land at the silver harbor",
          tr: "Gümüş ay limanına in",
          de: "Lande im silbernen Hafen",
          fr: "Pose-toi au port d'argent",
          es: "Aterriza en el puerto de plata",
        },
        sceneCue: "a quiet silver harbor glowing beside the moon",
        consequenceCue: "the silver harbor slows the story into a calmer and more reflective route",
        endingCue: "the silver harbor welcomes the heroes into a serene and satisfying ending",
        sfxTags: ["water", "wind", "soft"],
      },
    ],
  ],
  comic: [
    [
      {
        key: "charge",
        choiceText: { en: "Charge straight in", tr: "Doğrudan saldırıya geç", de: "Greif direkt an", fr: "Fonce droit devant", es: "Carga de frente" },
        sceneCue: "a bold, explosive opening move",
        consequenceCue: "the action surges forward with direct impact and visual punch",
        endingCue: "the bold move ends in a loud and satisfying victory beat",
        sfxTags: ["impact", "whoosh", "hero"],
      },
      {
        key: "shadow-route",
        choiceText: { en: "Slip through the shadows", tr: "Gölgelerden sız", de: "Schlupfe durch die Schatten", fr: "Glisse par les ombres", es: "Deslízate por las sombras" },
        sceneCue: "a stealthy route through darker cover",
        consequenceCue: "the scene shifts into stealth, tension, and clever positioning",
        endingCue: "the hidden route resolves with a smart and stylish payoff",
        sfxTags: ["footstep", "suspense", "wind"],
      },
    ],
    [
      {
        key: "skyline-swing",
        choiceText: { en: "Swing across the skyline", tr: "Şehir çizgisinin üstünden atıl", de: "Schwinge uber die Skyline", fr: "Elance-toi au-dessus de la skyline", es: "Balanceate sobre el horizonte" },
        sceneCue: "a fast skyline dash above the city lights",
        consequenceCue: "the chase climbs into open air with velocity, risk, and spectacle",
        endingCue: "the skyline route ends in a cinematic hero landing",
        sfxTags: ["whoosh", "hero", "wind"],
      },
      {
        key: "tech-hack",
        choiceText: { en: "Hack the control grid", tr: "Kontrol sistemini hackle", de: "Hacke das Kontrollsystem", fr: "Pirate le systeme de controle", es: "Hackea la red de control" },
        sceneCue: "a covert tech route through glowing control panels",
        consequenceCue: "the scene pivots into clever gadgets, alarms, and tactical timing",
        endingCue: "the hack route resolves with a clean and clever reversal",
        sfxTags: ["computer", "beep", "suspense"],
      },
    ],
    [
      {
        key: "rescue-crowd",
        choiceText: { en: "Protect the civilians first", tr: "Önce sivilleri koru", de: "Schutze zuerst die Zivilisten", fr: "Protege d'abord les civils", es: "Protege primero a los civiles" },
        sceneCue: "a crowded danger zone where quick rescue matters most",
        consequenceCue: "the action gains urgency, heart, and visible collateral stakes",
        endingCue: "the rescue route finishes on an uplifting public victory beat",
        sfxTags: ["crowd", "hero", "impact"],
      },
      {
        key: "disable-core",
        choiceText: { en: "Disable the enemy core", tr: "Düşman çekirdeğini devre dışı bırak", de: "Schalte den feindlichen Kern aus", fr: "Desactive le noyau ennemi", es: "Desactiva el nucleo enemigo" },
        sceneCue: "a dangerous strike toward the enemy power core",
        consequenceCue: "the conflict sharpens into direct stakes, countdown pressure, and heavy impact",
        endingCue: "the core-strike route ends with a sharp final shutdown",
        sfxTags: ["impact", "alarm", "machine"],
      },
    ],
  ],
  crime_mystery: [
    [
      {
        key: "witness-alley",
        choiceText: { en: "Follow the witness into the alley", tr: "Tanığı ara sokağa kadar takip et", de: "Folge dem Zeugen in die Gasse", fr: "Suis le temoin dans la ruelle", es: "Sigue al testigo hasta el callejon" },
        sceneCue: "a narrow alley where a nervous witness slips into shadow",
        consequenceCue: "the investigation tightens with pressure, secrecy, and a living lead",
        endingCue: "the witness route ends with a sharp revelation finally spoken aloud",
        sfxTags: ["footstep", "suspense", "city"],
      },
      {
        key: "study-ledger",
        choiceText: { en: "Search the hidden ledger", tr: "Gizli kayıt defterini ara", de: "Suche nach dem versteckten Hauptbuch", fr: "Cherche le registre cache", es: "Busca el libro de cuentas oculto" },
        sceneCue: "a quiet study full of paper clues and locked drawers",
        consequenceCue: "the case deepens through documents, patterns, and patient deduction",
        endingCue: "the ledger route closes with proof that finally fits together",
        sfxTags: ["paper", "door", "mystery"],
      },
    ],
    [
      {
        key: "rooftop-tail",
        choiceText: { en: "Tail the suspect across the rooftops", tr: "Şüpheliyi çatılarda izle", de: "Verfolge den Verdachtigen uber die Dacher", fr: "Suis le suspect sur les toits", es: "Sigue al sospechoso por los tejados" },
        sceneCue: "a rooftop pursuit above the sleeping city",
        consequenceCue: "the mystery turns kinetic, exposing risk and urgency in the open",
        endingCue: "the rooftop route resolves with a dangerous truth cornered in the night",
        sfxTags: ["wind", "footstep", "suspense"],
      },
      {
        key: "archive-room",
        choiceText: { en: "Break into the archive room", tr: "Arşiv odasına gir", de: "Dringe in den Archivraum ein", fr: "Entre dans la salle d'archives", es: "Entra en la sala de archivos" },
        sceneCue: "an archive room stacked with silent, incriminating records",
        consequenceCue: "the tension becomes quieter and sharper as hidden evidence surfaces",
        endingCue: "the archive route ends with the case turning on one buried record",
        sfxTags: ["door", "paper", "suspense"],
      },
    ],
    [
      {
        key: "interrogate-now",
        choiceText: { en: "Interrogate the prime suspect now", tr: "Baş şüpheliyi hemen sorgula", de: "Verhore den Hauptverdachtigen sofort", fr: "Interroge tout de suite le principal suspect", es: "Interroga ahora al principal sospechoso" },
        sceneCue: "a tense interrogation room with little time left",
        consequenceCue: "the pressure shifts onto dialogue, cracks in alibis, and emotional tells",
        endingCue: "the interrogation route ends when the lie finally breaks",
        sfxTags: ["heartbeat", "human", "suspense"],
      },
      {
        key: "set-trap",
        choiceText: { en: "Set a trap at the handoff", tr: "Teslimat noktasında tuzak kur", de: "Stelle beim Ubergabeort eine Falle", fr: "Tends un piege au point d'echange", es: "Tiende una trampa en la entrega" },
        sceneCue: "a planned sting at a risky handoff point",
        consequenceCue: "the investigation turns strategic, controlled, and dangerously precise",
        endingCue: "the trap route closes with the culprit caught in motion",
        sfxTags: ["radio", "footstep", "city"],
      },
    ],
  ],
  fantasy_scifi: [
    [
      {
        key: "nebula-gate",
        choiceText: { en: "Enter the nebula gate", tr: "Bulutsu kapısına gir", de: "Betritt das Nebeltor", fr: "Entre dans la porte nebuleuse", es: "Entra en la puerta de la nebulosa" },
        sceneCue: "a shimmering nebula gate bending light and space",
        consequenceCue: "the adventure shifts into the unknown with cosmic scale and unstable wonder",
        endingCue: "the nebula route resolves in a vast and awe-filled arrival",
        sfxTags: ["space", "magic", "whoosh"],
      },
      {
        key: "crystal-corridor",
        choiceText: { en: "Cross the crystal corridor", tr: "Kristal koridordan geç", de: "Uberquere den Kristallkorridor", fr: "Traverse le couloir de cristal", es: "Cruza el corredor de cristal" },
        sceneCue: "a corridor of glowing crystal structures humming with power",
        consequenceCue: "the path becomes more precise, luminous, and technologically uncanny",
        endingCue: "the crystal route ends in a clear and elegant breakthrough",
        sfxTags: ["chime", "space", "magic"],
      },
    ],
    [
      {
        key: "mech-deck",
        choiceText: { en: "Board the mech command deck", tr: "Mekanik komuta güvertesine çık", de: "Gehe auf die Mech-Kommandobruecke", fr: "Monte sur le pont du mecha", es: "Sube a la cubierta del meca" },
        sceneCue: "a mechanical command deck pulsing with urgent signals",
        consequenceCue: "the story accelerates through systems, alarms, and high-stakes control",
        endingCue: "the mech route resolves in a hard-won command decision",
        sfxTags: ["machine", "alarm", "beep"],
      },
      {
        key: "starlight-ruins",
        choiceText: { en: "Explore the starlight ruins", tr: "Yıldız ışıklı harabeleri keşfet", de: "Erkunde die Sternenruinen", fr: "Explore les ruines de lumiere stellaire", es: "Explora las ruinas de luz estelar" },
        sceneCue: "ancient ruins lit by strange starlight patterns",
        consequenceCue: "the journey turns archaeological and mystical, revealing older truths",
        endingCue: "the ruins route closes with a forgotten power understood at last",
        sfxTags: ["wind", "magic", "mystery"],
      },
    ],
    [
      {
        key: "quantum-beacon",
        choiceText: { en: "Activate the quantum beacon", tr: "Kuantum işaretçisini etkinleştir", de: "Aktiviere den Quanten-Sender", fr: "Active la balise quantique", es: "Activa la baliza cuantica" },
        sceneCue: "a quantum beacon preparing to flare across the void",
        consequenceCue: "the route becomes brighter, riskier, and more immediate as systems awaken",
        endingCue: "the beacon route ends with a signal that changes everything",
        sfxTags: ["beep", "space", "whoosh"],
      },
      {
        key: "ancient-observatory",
        choiceText: { en: "Climb to the ancient observatory", tr: "Kadim gözlemevine tırman", de: "Steige zur alten Sternwarte hinauf", fr: "Monte jusqu'a l'ancien observatoire", es: "Sube al antiguo observatorio" },
        sceneCue: "an ancient observatory aligned with impossible constellations",
        consequenceCue: "the path slows into discovery, pattern-reading, and cosmic meaning",
        endingCue: "the observatory route resolves in a contemplative and powerful reveal",
        sfxTags: ["wind", "space", "chime"],
      },
    ],
  ],
  romance: [
    [
      {
        key: "moonlit-garden",
        choiceText: { en: "Meet beneath the moonlit garden lights", tr: "Ay ışıklı bahçede buluş", de: "Triff dich unter den Lichtern des Mondgartens", fr: "Retrouve-le sous les lumieres du jardin", es: "Encuentrate bajo las luces del jardin" },
        sceneCue: "a moonlit garden filled with quiet lights and private emotion",
        consequenceCue: "the story grows more intimate, gentle, and openly vulnerable",
        endingCue: "the garden route resolves in a tender emotional confession",
        sfxTags: ["soft", "night", "music"],
      },
      {
        key: "lakeside-letter",
        choiceText: { en: "Read the lakeside letter first", tr: "Göl kenarındaki mektubu önce oku", de: "Lies zuerst den Brief am See", fr: "Lis d'abord la lettre au bord du lac", es: "Lee primero la carta junto al lago" },
        sceneCue: "a quiet lakeside where a heartfelt letter waits unopened",
        consequenceCue: "the romance becomes reflective, honest, and shaped by memory",
        endingCue: "the letter route ends with clarity that softens both hearts",
        sfxTags: ["water", "paper", "soft"],
      },
    ],
    [
      {
        key: "dance-floor",
        choiceText: { en: "Step onto the dance floor", tr: "Dans pistine adım at", de: "Betritt die Tanzflache", fr: "Entre sur la piste de danse", es: "Sal a la pista de baile" },
        sceneCue: "a glowing dance floor where tension turns into movement",
        consequenceCue: "the scene grows warmer, bolder, and more rhythmically alive",
        endingCue: "the dance route closes with a joyful and mutual leap of faith",
        sfxTags: ["music", "crowd", "soft"],
      },
      {
        key: "cafe-window",
        choiceText: { en: "Talk by the quiet cafe window", tr: "Sessiz kafe penceresinde konuş", de: "Sprich am ruhigen Cafe-Fenster", fr: "Parle pres de la fenetre du cafe", es: "Habla junto a la ventana del cafe" },
        sceneCue: "a quiet cafe window framing a more careful conversation",
        consequenceCue: "the romance deepens through patience, honesty, and smaller gestures",
        endingCue: "the cafe route ends with a soft but decisive mutual understanding",
        sfxTags: ["cafe", "soft", "music"],
      },
    ],
    [
      {
        key: "train-platform",
        choiceText: { en: "Run to the station platform", tr: "İstasyon peronuna koş", de: "Lauf zum Bahnsteig", fr: "Cours jusqu'au quai", es: "Corre al anden" },
        sceneCue: "a station platform where timing matters as much as courage",
        consequenceCue: "the emotion sharpens into urgency, momentum, and one last chance",
        endingCue: "the platform route resolves with a breathless emotional reunion",
        sfxTags: ["train", "footstep", "heartbeat"],
      },
      {
        key: "stay-and-speak",
        choiceText: { en: "Stay and speak honestly", tr: "Kal ve dürüstçe konuş", de: "Bleib und sprich ehrlich", fr: "Reste et parle avec sincerite", es: "Quedate y habla con honestidad" },
        sceneCue: "a still moment where honesty matters more than spectacle",
        consequenceCue: "the route becomes quieter but emotionally stronger with every word",
        endingCue: "the honest route ends with trust restored in full view",
        sfxTags: ["soft", "heartbeat", "quiet"],
      },
    ],
  ],
  horror_thriller: [
    [
      {
        key: "basement-stairs",
        choiceText: { en: "Descend the basement stairs", tr: "Bodrum merdivenlerinden in", de: "Steige die Kellertreppe hinab", fr: "Descends l'escalier du sous-sol", es: "Baja por las escaleras del sotano" },
        sceneCue: "a basement stairwell dropping into damp, hidden danger",
        consequenceCue: "the tension thickens into claustrophobia, dread, and unseen movement",
        endingCue: "the basement route resolves in a brutal reveal from below",
        sfxTags: ["door", "heartbeat", "horror"],
      },
      {
        key: "attic-corridor",
        choiceText: { en: "Cross the attic corridor", tr: "Tavan arası koridorundan geç", de: "Geh durch den Dachbodenflur", fr: "Traverse le couloir du grenier", es: "Cruza el corredor del atico" },
        sceneCue: "a narrow attic corridor creaking above the house",
        consequenceCue: "the fear becomes sharper, quieter, and more anticipatory",
        endingCue: "the attic route closes with a chilling answer waiting overhead",
        sfxTags: ["creak", "wind", "horror"],
      },
    ],
    [
      {
        key: "static-radio",
        choiceText: { en: "Follow the static on the radio", tr: "Radyodaki paraziti takip et", de: "Folge dem Rauschen im Radio", fr: "Suis les parasites de la radio", es: "Sigue la estatica de la radio" },
        sceneCue: "a radio signal crackling with something almost human",
        consequenceCue: "the route leans into dread, coded warnings, and invasive presence",
        endingCue: "the radio route ends when the voice finally comes through clearly",
        sfxTags: ["radio", "horror", "static"],
      },
      {
        key: "sealed-chapel",
        choiceText: { en: "Force open the sealed chapel", tr: "Mühürlenmiş şapeli zorla aç", de: "Brich die versiegelte Kapelle auf", fr: "Force l'ouverture de la chapelle scellee", es: "Abre por la fuerza la capilla sellada" },
        sceneCue: "a sealed chapel hiding ritual traces behind old doors",
        consequenceCue: "the story turns sacramental, oppressive, and thick with forbidden signs",
        endingCue: "the chapel route resolves with a terrifying sacred truth exposed",
        sfxTags: ["door", "horror", "wind"],
      },
    ],
    [
      {
        key: "run-to-light",
        choiceText: { en: "Run toward the distant light", tr: "Uzaktaki ışığa doğru koş", de: "Lauf auf das ferne Licht zu", fr: "Cours vers la lumiere lointaine", es: "Corre hacia la luz lejana" },
        sceneCue: "a desperate run toward a light that might be safety or bait",
        consequenceCue: "the route becomes frantic, exposed, and charged with survival instinct",
        endingCue: "the light route ends in a brutal answer to whether hope was real",
        sfxTags: ["footstep", "wind", "heartbeat"],
      },
      {
        key: "hide-in-silence",
        choiceText: { en: "Hide and listen in silence", tr: "Saklan ve sessizce dinle", de: "Versteck dich und horche in der Stille", fr: "Cache-toi et ecoute en silence", es: "Escondete y escucha en silencio" },
        sceneCue: "a frozen hiding place where every tiny sound matters",
        consequenceCue: "the fear turns inward, slower, and more psychologically sharp",
        endingCue: "the silence route resolves in a close and deeply unsettling reveal",
        sfxTags: ["quiet", "heartbeat", "horror"],
      },
    ],
  ],
  default: [
    [
      {
        key: "direct-route",
        choiceText: { en: "Take the direct route", tr: "Doğrudan git", de: "Nimm den direkten Weg", fr: "Prends la voie directe", es: "Toma la ruta directa" },
        sceneCue: "a direct route with immediate pressure",
        consequenceCue: "the direct route forces fast, visible consequences",
        endingCue: "the direct route resolves with a decisive ending",
        sfxTags: ["footstep", "wind", "impact"],
      },
      {
        key: "careful-route",
        choiceText: { en: "Take the careful route", tr: "Dikkatli yolu izle", de: "Nimm den vorsichtigen Weg", fr: "Prends la voie prudente", es: "Toma la ruta prudente" },
        sceneCue: "a careful route with quieter clues and slower tension",
        consequenceCue: "the careful route reveals subtler consequences and hidden details",
        endingCue: "the careful route resolves with a measured and thoughtful ending",
        sfxTags: ["wind", "door", "ambience"],
      },
    ],
  ],
};

export function computeStoryGenerationTargets(category: string, length: string): StoryGenerationTargets {
  const rule = getBookGenerationRule(category, length);
  return {
    readablePathLength: rule.readablePathLength,
    branchCount: rule.branchCount,
    branchImageCount: rule.branchImageCount,
    graphPageCount: rule.graphPageCount,
  };
}

export function enumerateReadablePathLengths(pages: StoryPage[]): number[] {
  const byPage = new Map<number, StoryPage>(pages.map((page) => [page.pageNumber, page]));
  const incoming = new Set<number>();
  for (const page of pages) {
    if (page.nextPageA) incoming.add(page.nextPageA);
    if (page.nextPageB) incoming.add(page.nextPageB);
  }

  const roots = pages
    .filter((page) => !incoming.has(page.pageNumber))
    .map((page) => page.pageNumber);

  const lengths: number[] = [];
  const visit = (pageNumber: number, depth: number, activePath: Set<number>) => {
    if (activePath.has(pageNumber)) return;
    const page = byPage.get(pageNumber);
    if (!page) return;

    activePath.add(pageNumber);
    const nextA = page.nextPageA;
    const nextB = page.isBranchPage ? page.nextPageB : null;
    const hasChildren = !!nextA || !!nextB;
    if (!hasChildren) {
      lengths.push(depth);
      activePath.delete(pageNumber);
      return;
    }

    if (nextA) visit(nextA, depth + 1, activePath);
    if (nextB) visit(nextB, depth + 1, activePath);
    activePath.delete(pageNumber);
  };

  for (const root of roots) {
    visit(root, 1, new Set<number>());
  }

  return lengths;
}

function detectCyclePages(pages: StoryPage[]): number[] {
  const byPage = new Map<number, StoryPage>(pages.map((page) => [page.pageNumber, page]));
  const state = new Map<number, "visiting" | "visited">();
  const stack: number[] = [];
  const cycleNodes = new Set<number>();

  const visit = (pageNumber: number) => {
    const currentState = state.get(pageNumber);
    if (currentState === "visiting") {
      const cycleStart = stack.indexOf(pageNumber);
      for (const node of stack.slice(cycleStart >= 0 ? cycleStart : 0)) {
        cycleNodes.add(node);
      }
      cycleNodes.add(pageNumber);
      return;
    }
    if (currentState === "visited") return;

    state.set(pageNumber, "visiting");
    stack.push(pageNumber);

    const page = byPage.get(pageNumber);
    const nextPages = page
      ? [page.nextPageA, page.isBranchPage ? page.nextPageB : null].filter(
          (value): value is number => value !== null
        )
      : [];

    for (const nextPageNumber of nextPages) {
      visit(nextPageNumber);
    }

    stack.pop();
    state.set(pageNumber, "visited");
  };

  for (const page of pages) {
    visit(page.pageNumber);
  }

  return Array.from(cycleNodes).sort((left, right) => left - right);
}

export function validateStoryShape(pages: StoryPage[], readablePathLength: number): string[] {
  const errors: string[] = [];
  if (pages.length <= readablePathLength) {
    errors.push("Graph must contain more pages than a single readable path.");
  }

  const cyclePages = detectCyclePages(pages);
  if (cyclePages.length > 0) {
    errors.push(`Story graph contains a cycle involving pages: ${cyclePages.join(", ")}.`);
  }

  const pathLengths = enumerateReadablePathLengths(pages);
  if (pathLengths.length === 0) {
    errors.push("Story graph has no complete readable path.");
  }
  for (const pathLength of pathLengths) {
    if (pathLength !== readablePathLength) {
      errors.push(
        `Readable path length mismatch: expected ${readablePathLength}, got ${pathLength}.`
      );
    }
  }

  for (const page of pages) {
    if (page.isBranchPage) {
      if (!page.choiceA || !page.choiceB) {
        errors.push(`Page ${page.pageNumber} is a branch page without two explicit choices.`);
      }
      if (!page.nextPageA || !page.nextPageB || page.nextPageA === page.nextPageB) {
        errors.push(`Page ${page.pageNumber} must branch to two different target pages.`);
      }
    } else if (!page.isEnding && !page.nextPageA) {
      errors.push(`Page ${page.pageNumber} is missing its linear continuation target.`);
    }
  }

  return errors;
}

function normaliseLanguageCode(language?: string): string {
  return (language ?? "en").trim().toLowerCase().split(/[-_]/)[0] || "en";
}

function getFallbackThemeBank(category?: string): Array<[FallbackTheme, FallbackTheme]> {
  if (category && FALLBACK_THEME_BANKS[category]) return FALLBACK_THEME_BANKS[category];
  return FALLBACK_THEME_BANKS.default;
}

function getRouteThemes(branchPath: string, category?: string): FallbackTheme[] {
  if (branchPath === "root") return [];
  const bank = getFallbackThemeBank(category);
  const segments = branchPath.split("-").filter(Boolean);
  return segments.map((segment, index) => {
    const pair = bank[index % bank.length];
    return segment === "B" ? pair[1] : pair[0];
  });
}

function getNextThemePair(branchPath: string, category?: string): [FallbackTheme, FallbackTheme] {
  const bank = getFallbackThemeBank(category);
  const level = branchPath === "root" ? 0 : branchPath.split("-").filter(Boolean).length;
  return bank[level % bank.length];
}

function localiseThemeChoice(theme: FallbackTheme, language?: string): string {
  const lang = normaliseLanguageCode(language) as "en" | "tr" | "de" | "fr" | "es";
  return theme.choiceText[lang] ?? theme.choiceText.en ?? theme.key;
}

function inferPremiseTags(text: string, category?: string): string[] {
  const lowered = text.toLowerCase();
  const tags = new Set<string>();
  if (/\b(moon|ay|luna|mond)\b/.test(lowered)) tags.add("night");
  if (/\b(star|stars|yildiz|etoile|stern)\b/.test(lowered)) tags.add("star");
  if (/\b(rocket|roket|spaceship|uzay gemisi|ship)\b/.test(lowered)) tags.add("rocket");
  if (/\b(cloud|clouds|bulut|nuage|wolke)\b/.test(lowered)) tags.add("wind");
  if (/\b(map|harita|karte|carte)\b/.test(lowered)) tags.add("mystery");
  if (/\b(door|gate|kapi|porte|tor)\b/.test(lowered)) tags.add("door");
  if (/\b(magic|sihir|magie|magia)\b/.test(lowered)) tags.add("magic");
  if (/\b(forest|orman|woods|jungle)\b/.test(lowered)) tags.add("forest");
  if (/\b(detective|dedektif|crime|suclu|murder|cinayet|evidence|kanit)\b/.test(lowered)) tags.add("mystery");
  if (/\b(love|ask|romance|sevgi|kalp|mektup)\b/.test(lowered)) tags.add("soft");
  if (/\b(horror|ghost|hayalet|korku|karanlik|lanet)\b/.test(lowered)) tags.add("horror");
  if (/\b(robot|machine|makine|android|quantum|kuantum|crystal|kristal)\b/.test(lowered)) tags.add("machine");
  if (tags.size === 0) {
    if (category === "fairy_tale") tags.add("magic");
    else if (category === "comic") tags.add("impact");
    else if (category === "crime_mystery") tags.add("mystery");
    else if (category === "fantasy_scifi") tags.add("space");
    else if (category === "romance") tags.add("soft");
    else if (category === "horror_thriller") tags.add("horror");
    else tags.add("ambience");
  }
  return Array.from(tags);
}

function buildFallbackSfxTags(input: {
  title: string;
  description: string;
  branchPath: string;
  category?: string;
  isBranchPage: boolean;
}): string[] {
  const routeThemes = getRouteThemes(input.branchPath, input.category);
  const nextPair = getNextThemePair(input.branchPath, input.category);
  const tags = [
    ...(input.isBranchPage ? [...nextPair[0].sfxTags, ...nextPair[1].sfxTags] : []),
    ...routeThemes.flatMap((theme) => theme.sfxTags),
    ...inferPremiseTags(`${input.title} ${input.description}`, input.category),
  ];
  return Array.from(new Set(tags.filter(Boolean))).slice(0, 4);
}

function buildRouteSummary(branchPath: string, category?: string): string {
  const themes = getRouteThemes(branchPath, category);
  if (themes.length === 0) return "";
  return themes.map((theme) => theme.consequenceCue).join(", then ");
}

function buildThemeChoiceLabels(branchPath: string, category?: string, language?: string): {
  choiceA: string;
  choiceB: string;
} {
  const [themeA, themeB] = getNextThemePair(branchPath, category);
  return {
    choiceA: localiseThemeChoice(themeA, language),
    choiceB: localiseThemeChoice(themeB, language),
  };
}

function branchDepths(readablePathLength: number, branchCount: number, category?: string): number[] {
  if (branchCount <= 0) return [];
  const branchStart = category === "fairy_tale" ? 3 : 4;
  const start = Math.min(Math.max(2, branchStart), Math.max(2, readablePathLength - 3));
  const end = Math.max(start, readablePathLength - 2);
  if (branchCount === 1) return [Math.floor((start + end) / 2)];

  const spacing = Math.max(1, Math.floor((end - start) / (branchCount - 1)));

  return Array.from({ length: branchCount }, (_, index) => {
    return Math.max(start, Math.min(readablePathLength - 2, start + index * spacing));
  });
}

function buildFallbackOutline(input: {
  title: string;
  description: string;
  branchPath: string;
  depth: number;
  readablePathLength: number;
  isBranchPage: boolean;
  isEnding: boolean;
  category?: string;
}): string {
  const premise = input.description.trim() || `the adventure in "${input.title}"`;
  const branchLabel = input.branchPath === "root" ? "main path" : `branch ${input.branchPath}`;
  const routeSummary = buildRouteSummary(input.branchPath, input.category);
  const routeThemes = getRouteThemes(input.branchPath, input.category);
  const routeSceneSummary = routeThemes.map((theme) => theme.sceneCue).join(", then ");
  const nextPair = getNextThemePair(input.branchPath, input.category);

  if (input.depth === 1) {
    return `Open "${input.title}" by introducing the main characters, the setting, and the central problem drawn from ${premise}. Establish a clear beginning and foreshadow that the adventure could later split toward ${nextPair[0].sceneCue} or ${nextPair[1].sceneCue}.`;
  }

  if (input.isBranchPage) {
    return `Create a concrete decision on the ${branchLabel}. The current route has already led through ${routeSceneSummary || "a specific chain of events"} and must not reset. One route should now lead toward ${nextPair[0].sceneCue}; the other should lead toward ${nextPair[1].sceneCue}. The very next scene after each choice must show an immediate, visibly different consequence tied directly to ${premise}.`;
  }

  if (input.isEnding) {
    return `Deliver a satisfying ending on the ${branchLabel}. Resolve the central problem from ${premise} with a distinct emotional payoff shaped by ${routeSummary || "the chosen route"}. Echo ${routeThemes[routeThemes.length - 1]?.endingCue || "the final chosen motif"} so the ending feels specific to this branch.`;
  }

  if (input.branchPath === "root") {
    return `Advance the main route on page-depth ${input.depth}. Build directly on the previous action, keep the narrative specific to ${premise}, and prepare the reader for a meaningful choice ahead.`;
  }

  return `Continue the ${branchLabel} consequence on page-depth ${input.depth}. This branch has already committed to ${routeSceneSummary || "a distinct route"} and must keep moving forward without repeating the opening. Show a concrete new development shaped by ${routeSummary || "the chosen route"} that could not happen on the unchosen route, while staying faithful to ${premise}.`;
}

export function buildFallbackStoryGraph(input: {
  title: string;
  description: string;
  readablePathLength: number;
  branchCount: number;
  category?: string;
  language?: string;
}): StoryPage[] {
  let nextId = 1;
  const nodes = new Map<number, PlannedNode>();
  const rootPathNodes: number[] = [];

  for (let depth = 1; depth <= input.readablePathLength; depth += 1) {
    const id = nextId++;
    rootPathNodes.push(id);
    nodes.set(id, {
      id,
      branchPath: "root",
      depth,
      isBranchPage: false,
      isEnding: depth === input.readablePathLength,
      nextA: depth < input.readablePathLength ? id + 1 : null,
      nextB: null,
      content: buildFallbackOutline({
        title: input.title,
        description: input.description,
        branchPath: "root",
        depth,
        readablePathLength: input.readablePathLength,
        isBranchPage: false,
        isEnding: depth === input.readablePathLength,
        category: input.category,
      }),
      sfxTags: buildFallbackSfxTags({
        title: input.title,
        description: input.description,
        branchPath: "root",
        category: input.category,
        isBranchPage: false,
      }),
      choiceA: null,
      choiceB: null,
    });
  }

  const activePaths: ActivePath[] = [{ label: "root", nodes: rootPathNodes }];
  const depths = branchDepths(input.readablePathLength, input.branchCount, input.category);

  for (let branchIndex = 0; branchIndex < input.branchCount; branchIndex += 1) {
    const targetDepth = depths[branchIndex];
    const candidatePaths = activePaths.filter((path) => {
      const nodeId = path.nodes[targetDepth - 1];
      const node = nodeId ? nodes.get(nodeId) : null;
      return !!node && !node.isBranchPage && !node.isEnding;
    });
    if (candidatePaths.length === 0) break;

    candidatePaths.sort((left, right) => {
      const leftBranches = left.label === "root" ? 0 : left.label.split("-").length;
      const rightBranches = right.label === "root" ? 0 : right.label.split("-").length;
      if (leftBranches !== rightBranches) return leftBranches - rightBranches;
      return left.label.localeCompare(right.label);
    });

    const path = candidatePaths[branchIndex % candidatePaths.length];
    const branchNodeId = path.nodes[targetDepth - 1];
    const branchNode = nodes.get(branchNodeId);
    if (!branchNode) continue;

    const branchBase = path.label === "root" ? "" : `${path.label}-`;
    const aLabel = `${branchBase}A`.replace(/^-/, "");
    const bLabel = `${branchBase}B`.replace(/^-/, "");
    const existingSuffix = path.nodes.slice(targetDepth);
    const branchBNodes: number[] = [];
    const branchChoices = buildThemeChoiceLabels(path.label, input.category, input.language);

    branchNode.isBranchPage = true;
    branchNode.choiceA = branchChoices.choiceA;
    branchNode.choiceB = branchChoices.choiceB;
    branchNode.sfxTags = buildFallbackSfxTags({
      title: input.title,
      description: input.description,
      branchPath: path.label,
      category: input.category,
      isBranchPage: true,
    });

    for (let offset = 0; offset < existingSuffix.length; offset += 1) {
      const existingId = existingSuffix[offset];
      const existingNode = nodes.get(existingId);
      if (existingNode) {
        existingNode.branchPath = aLabel;
        existingNode.content = buildFallbackOutline({
          title: input.title,
          description: input.description,
          branchPath: aLabel,
          depth: existingNode.depth,
          readablePathLength: input.readablePathLength,
          isBranchPage: existingNode.isBranchPage,
          isEnding: existingNode.isEnding,
          category: input.category,
        });
        existingNode.sfxTags = buildFallbackSfxTags({
          title: input.title,
          description: input.description,
          branchPath: aLabel,
          category: input.category,
          isBranchPage: existingNode.isBranchPage,
        });
        if (existingNode.isBranchPage) {
          const nestedChoices = buildThemeChoiceLabels(aLabel, input.category, input.language);
          existingNode.choiceA = nestedChoices.choiceA;
          existingNode.choiceB = nestedChoices.choiceB;
        }
      }

      const clonedId = nextId++;
      const clonedDepth = targetDepth + offset + 1;
      branchBNodes.push(clonedId);
      nodes.set(clonedId, {
        id: clonedId,
        branchPath: bLabel,
        depth: clonedDepth,
        isBranchPage: false,
        isEnding: clonedDepth === input.readablePathLength,
        nextA: null,
        nextB: null,
        content: buildFallbackOutline({
          title: input.title,
          description: input.description,
          branchPath: bLabel,
          depth: clonedDepth,
          readablePathLength: input.readablePathLength,
          isBranchPage: false,
          isEnding: clonedDepth === input.readablePathLength,
          category: input.category,
        }),
        sfxTags: buildFallbackSfxTags({
          title: input.title,
          description: input.description,
          branchPath: bLabel,
          category: input.category,
          isBranchPage: false,
        }),
        choiceA: null,
        choiceB: null,
      });
    }

    branchNode.nextA = existingSuffix[0] ?? null;
    branchNode.nextB = branchBNodes[0] ?? null;
    branchNode.content = buildFallbackOutline({
      title: input.title,
      description: input.description,
      branchPath: path.label,
      depth: targetDepth,
      readablePathLength: input.readablePathLength,
      isBranchPage: true,
      isEnding: false,
      category: input.category,
    });

    for (let index = 0; index < existingSuffix.length; index += 1) {
      const currentId = branchBNodes[index];
      const nextNodeId = branchBNodes[index + 1] ?? null;
      const node = nodes.get(currentId);
      if (!node) continue;
      node.nextA = node.isEnding ? null : nextNodeId;
    }

    path.nodes = path.nodes.slice(0, targetDepth).concat(existingSuffix);
    path.label = aLabel;
    activePaths.push({
      label: bLabel,
      nodes: path.nodes.slice(0, targetDepth).concat(branchBNodes),
    });
  }

  const planned = Array.from(nodes.values()).sort((left, right) => left.id - right.id);
  const renumber = new Map<number, number>();
  planned.forEach((node, index) => {
    renumber.set(node.id, index + 1);
  });

  return planned.map((node) => ({
    pageNumber: renumber.get(node.id) ?? node.id,
    branchPath: node.branchPath,
    isBranchPage: node.isBranchPage,
    isEnding: node.isEnding,
    content: node.content,
    sfxTags: node.sfxTags,
    choiceA: node.choiceA,
    choiceB: node.choiceB,
    nextPageA: node.nextA ? (renumber.get(node.nextA) ?? null) : null,
    nextPageB: node.nextB ? (renumber.get(node.nextB) ?? null) : null,
  }));
}


