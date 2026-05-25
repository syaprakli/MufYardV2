import { useState, useMemo, useEffect, useRef } from "react";
import { TagSelector, type TagType } from "./TagSelector";
import { Button } from "../ui/Button";
import { Star, MapPin, Search, Plus, Home, Utensils, X, ArrowLeft, Trash2, MessageSquare } from "lucide-react";

export type PlaceType = "hotel" | "yurt" | "facility" | "food" | string;

export type MapPlace = {
  id: string;
  authorId: string;
  author: string;
  authorEmail?: string;
  date: string;
  city: string;
  name: string;
  type: PlaceType;
  rating: number;
  description: string;
  tags?: TagType[];
  fitsPerDiem?: boolean;
  price?: string;
};

export type MapReview = {
  id: string;
  placeId: string;
  authorId: string;
  author: string;
  rating: number;
  content: string;
  date: string;
};

const CITIES = [
  { name: "Adana", x: 53, y: 72 },
  { name: "Adıyaman", x: 70, y: 68 },
  { name: "Afyonkarahisar", x: 30, y: 52 },
  { name: "Ağrı", x: 91, y: 34 },
  { name: "Aksaray", x: 47, y: 59 },
  { name: "Amasya", x: 59, y: 30 },
  { name: "Ankara", x: 44, y: 41 },
  { name: "Antalya", x: 29, y: 76 },
  { name: "Ardahan", x: 89, y: 15 },
  { name: "Artvin", x: 84, y: 16 },
  { name: "Aydın", x: 12, y: 62 },
  { name: "Balıkesir", x: 14, y: 36 },
  { name: "Bartın", x: 43, y: 18 },
  { name: "Batman", x: 81, y: 60 },
  { name: "Bayburt", x: 74, y: 31 },
  { name: "Bilecik", x: 26, y: 37 },
  { name: "Bingöl", x: 78, y: 45 },
  { name: "Bitlis", x: 86, y: 51 },
  { name: "Bolu", x: 36, y: 32 },
  { name: "Burdur", x: 25, y: 69 },
  { name: "Bursa", x: 21, y: 35 },
  { name: "Çanakkale", x: 6, y: 32 },
  { name: "Çankırı", x: 47, y: 33 },
  { name: "Çorum", x: 53, y: 32 },
  { name: "Denizli", x: 19, y: 61 },
  { name: "Diyarbakır", x: 78, y: 58 },
  { name: "Düzce", x: 33, y: 28 },
  { name: "Edirne", x: 7, y: 14 },
  { name: "Elazığ", x: 71, y: 51 },
  { name: "Erzincan", x: 70, y: 38 },
  { name: "Erzurum", x: 81, y: 34 },
  { name: "Eskişehir", x: 30, y: 44 },
  { name: "Gaziantep", x: 64, y: 74 },
  { name: "Giresun", x: 68, y: 26 },
  { name: "Gümüşhane", x: 72, y: 29 },
  { name: "Hakkari", x: 95, y: 64 },
  { name: "Hatay", x: 55, y: 83 },
  { name: "Iğdır", x: 96, y: 31 },
  { name: "Isparta", x: 29, y: 63 },
  { name: "İstanbul", x: 20, y: 22 },
  { name: "İzmir", x: 7, y: 52 },
  { name: "Kahramanmaraş", x: 60, y: 67 },
  { name: "Karabük", x: 41, y: 24 },
  { name: "Karaman", x: 44, y: 72 },
  { name: "Kars", x: 91, y: 22 },
  { name: "Kastamonu", x: 46, y: 20 },
  { name: "Kayseri", x: 54, y: 54 },
  { name: "Kırıkkale", x: 47, y: 44 },
  { name: "Kırklareli", x: 10, y: 11 },
  { name: "Kırşehir", x: 49, y: 50 },
  { name: "Kilis", x: 64, y: 79 },
  { name: "Kocaeli", x: 24, y: 26 },
  { name: "Konya", x: 39, y: 62 },
  { name: "Kütahya", x: 24, y: 47 },
  { name: "Malatya", x: 66, y: 56 },
  { name: "Manisa", x: 10, y: 47 },
  { name: "Mardin", x: 80, y: 67 },
  { name: "Mersin", x: 48, y: 77 },
  { name: "Muğla", x: 13, y: 74 },
  { name: "Muş", x: 83, y: 46 },
  { name: "Nevşehir", x: 50, y: 56 },
  { name: "Niğde", x: 50, y: 64 },
  { name: "Ordu", x: 64, y: 25 },
  { name: "Osmaniye", x: 57, y: 73 },
  { name: "Rize", x: 79, y: 20 },
  { name: "Sakarya", x: 27, y: 28 },
  { name: "Samsun", x: 57, y: 21 },
  { name: "Siirt", x: 86, y: 58 },
  { name: "Sinop", x: 51, y: 15 },
  { name: "Sivas", x: 62, y: 43 },
  { name: "Şanlıurfa", x: 72, y: 73 },
  { name: "Şırnak", x: 90, y: 62 },
  { name: "Tekirdağ", x: 12, y: 21 },
  { name: "Tokat", x: 60, y: 34 },
  { name: "Trabzon", x: 74, y: 22 },
  { name: "Tunceli", x: 73, y: 47 },
  { name: "Uşak", x: 22, y: 54 },
  { name: "Van", x: 93, y: 49 },
  { name: "Yalova", x: 21, y: 28 },
  { name: "Yozgat", x: 53, y: 44 },
  { name: "Zonguldak", x: 37, y: 23 }
].sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));

const normalizeCityName = (name: string) => {
  return name
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
};

export function TurkeyMap({
  places,
  reviews = [],
  onAddPlace,
  onDeletePlace,
  onAddReview,
  onDeleteReview,
  submitting,
  currentUser,
}: {
  places: MapPlace[];
  reviews?: MapReview[];
  onAddPlace: (place: Omit<MapPlace, "id" | "author" | "date" | "authorId">) => Promise<void>;
  onDeletePlace?: (placeId: string) => Promise<void>;
  onAddReview?: (review: { placeId: string; rating: number; content: string }) => Promise<void>;
  onDeleteReview?: (reviewId: string) => Promise<void>;
  submitting: boolean;
  currentUser?: { uid?: string; role?: string };
}) {
  const [selectedCity, setSelectedCity] = useState<string>("Ankara");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const drawerRef = useRef<HTMLDivElement>(null);
  const [hasHover, setHasHover] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(hover: hover)");
      setHasHover(mediaQuery.matches);
      const handler = (e: MediaQueryListEvent) => setHasHover(e.matches);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, []);

  useEffect(() => {
    if (window.innerWidth < 1024 && drawerRef.current) {
      drawerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedCity]);

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    const target = e.target as SVGElement;
    const gElement = target.closest("g");
    if (gElement && gElement.id) {
      const cityId = gElement.id.toLowerCase();
      const foundCity = CITIES.find((c) => normalizeCityName(c.name) === cityId);
      if (foundCity) {
        if (hoveredCity !== foundCity.name) setHoveredCity(foundCity.name);
        return;
      }
    }
    if (hoveredCity) setHoveredCity(null);
  };

  // Search suggestion and selection logic
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const queryNormalized = normalizeCityName(searchQuery.trim());
    return CITIES.filter((c) => normalizeCityName(c.name).includes(queryNormalized)).slice(0, 5);
  }, [searchQuery]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    
    const queryNormalized = normalizeCityName(searchQuery.trim());
    const matchedCity = CITIES.find(
      (c) => normalizeCityName(c.name) === queryNormalized
    );
    
    if (matchedCity) {
      setSelectedCity(matchedCity.name);
      setIsAddingPlace(false);
      setSelectedPlaceId(null);
      setSearchQuery("");
    } else {
      const partialMatch = CITIES.find(
        (c) => normalizeCityName(c.name).includes(queryNormalized)
      );
      if (partialMatch) {
        setSelectedCity(partialMatch.name);
        setIsAddingPlace(false);
        setSelectedPlaceId(null);
        setSearchQuery("");
      }
    }
  };

  // Place Form State
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<PlaceType>("hotel");
  const [customType, setCustomType] = useState("");
  const [newFitsPerDiem, setNewFitsPerDiem] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [newDescription, setNewDescription] = useState("");
  const [newTags, setNewTags] = useState<TagType[]>([]);

  // Review Form State
  const [newReviewContent, setNewReviewContent] = useState("");
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const [placePage, setPlacePage] = useState(1);

  useEffect(() => {
    setReviewPage(1);
  }, [selectedPlaceId]);

  useEffect(() => {
    setPlacePage(1);
  }, [selectedCity]);


  // Fetch the SVG Turkey map
  useEffect(() => {
    fetch("/turkey.svg")
      .then((res) => res.text())
      .then((text) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const svgElement = doc.querySelector("svg");
        if (svgElement) {
          setSvgContent(svgElement.innerHTML);
        }
      })
      .catch((err) => console.error("Error loading SVG map:", err));
  }, []);

  // Filtered places for selected city
  const selectedCityPlaces = useMemo(() => {
    return places.filter((p) => p.city.toLowerCase() === selectedCity.toLowerCase());
  }, [places, selectedCity]);

  // Selected Place details
  const selectedPlace = useMemo(() => {
    if (!selectedPlaceId) return null;
    return places.find((p) => p.id === selectedPlaceId);
  }, [places, selectedPlaceId]);

  // Reviews for the selected place
  const selectedPlaceReviews = useMemo(() => {
    if (!selectedPlaceId) return [];
    return reviews.filter((r) => r.placeId === selectedPlaceId);
  }, [reviews, selectedPlaceId]);

  // Compute average rating and count for each place
  const getPlaceRatingStats = (placeId: string, initialRating: number) => {
    const pReviews = reviews.filter((r) => r.placeId === placeId);
    if (pReviews.length === 0) {
      return { avg: initialRating, count: 0 };
    }
    const sum = pReviews.reduce((acc, curr) => acc + curr.rating, 0);
    return {
      avg: Math.round((sum / pReviews.length) * 10) / 10,
      count: pReviews.length,
    };
  };

  // Check authorization for deleting a place
  const canDeletePlace = (place: MapPlace) => {
    if (!currentUser) return false;
    const isOwner = currentUser.uid === place.authorId;
    const isAdmin = currentUser.role?.toLowerCase() === "admin" || currentUser.role?.toLowerCase() === "moderator";
    return isOwner || isAdmin;
  };

  // Check authorization for deleting a review
  const canDeleteReview = (review: MapReview) => {
    if (!currentUser) return false;
    const isOwner = currentUser.uid === review.authorId;
    const isAdmin = currentUser.role?.toLowerCase() === "admin" || currentUser.role?.toLowerCase() === "moderator";
    return isOwner || isAdmin;
  };

  const handlePlaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newDescription.trim()) return;
    
    const finalType = newType === "other" ? (customType.trim() || "Diğer") : newType;

    try {
      await onAddPlace({
        city: selectedCity,
        name: newName,
        type: finalType,
        rating: newRating,
        description: newDescription,
        tags: newTags,
        fitsPerDiem: newFitsPerDiem,
        price: newPrice.trim(),
      });
      setNewName("");
      setCustomType("");
      setNewFitsPerDiem(false);
      setNewPrice("");
      setNewDescription("");
      setNewTags([]);
      setIsAddingPlace(false);
    } catch (err) {
      // Ignored
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewContent.trim() || !selectedPlaceId || !onAddReview) return;
    setSubmittingReview(true);
    try {
      await onAddReview({
        placeId: selectedPlaceId,
        rating: newReviewRating,
        content: newReviewContent,
      });
      setNewReviewContent("");
      setNewReviewRating(5);
    } catch (err) {
      // Ignored
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeletePlace = async (placeId: string) => {
    if (!onDeletePlace) return;
    if (confirm("Bu mekanı ve ilgili tüm yorumları silmek istediğinize emin misiniz?")) {
      try {
        await onDeletePlace(placeId);
        setSelectedPlaceId(null);
      } catch (err) {
        // Ignored
      }
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!onDeleteReview) return;
    if (confirm("Bu yorumu silmek istediğinize emin misiniz?")) {
      try {
        await onDeleteReview(reviewId);
      } catch (err) {
        // Ignored
      }
    }
  };

  const getPlaceIcon = (type: PlaceType) => {
    switch (type) {
      case "hotel":
      case "yurt":
      case "facility":
        return <Home size={14} className="text-violet-500" />;
      case "food":
        return <Utensils size={14} className="text-emerald-500" />;
    }
  };

  const getTypeName = (type: PlaceType) => {
    switch (type) {
      case "hotel":
        return "Otel";
      case "yurt":
        return "GSB Yurdu";
      case "facility":
        return "Misafirhane/Tesis";
      case "food":
        return "Yemek / Restoran";
    }
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    const gElement = target.closest("g");
    if (gElement && gElement.id) {
      const cityId = gElement.id.toLowerCase();
      const foundCity = CITIES.find((c) => normalizeCityName(c.name) === cityId);
      if (foundCity) {
        setSelectedCity(foundCity.name);
        setIsAddingPlace(false);
        setSelectedPlaceId(null);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 w-full min-h-[500px]">
      {/* Sol Panel: Harita Alanı */}
      <div className="flex flex-col gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-xl text-white">
        {/* Header inside Map Box */}
        <div className="flex items-center justify-between z-10 flex-wrap gap-3">
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-400">Denetim Sosyal Haritası</h4>
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Konaklama, Yurt ve Lezzet Haritası (Müfettiş Önerileri)</p>
            <p className="text-[9px] text-violet-400 font-bold mt-1 lg:hidden">↔ Haritayı parmağınızla sağa/sola kaydırabilirsiniz</p>
          </div>
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative w-48">
            <input
              type="text"
              placeholder="İl ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-8 text-[11px] bg-slate-950/80 border border-slate-800 rounded-xl outline-none focus:ring-1 focus:ring-violet-500 text-slate-300 font-bold"
            />
            <button type="submit" className="absolute left-2.5 top-2.5 text-slate-500 hover:text-violet-400 transition-colors" title="Ara">
              <Search size={12} />
            </button>
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2.5 top-2 text-slate-500 hover:text-white">
                <X size={12} />
              </button>
            )}
            {searchSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-9 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50">
                {searchSuggestions.map((city) => (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() => {
                      setSelectedCity(city.name);
                      setIsAddingPlace(false);
                      setSelectedPlaceId(null);
                      setSearchQuery("");
                    }}
                    className="w-full text-left px-3 py-1.5 text-[10px] text-slate-300 hover:bg-violet-900/40 hover:text-white transition-colors font-bold border-b border-slate-900/60 last:border-0"
                  >
                    {city.name}
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Turkey Map Stylized Canvas Area */}
        <div className="w-full h-[325px] lg:h-auto lg:flex-1 bg-slate-950/45 rounded-2xl border border-slate-850/40 overflow-x-auto overflow-y-hidden">
          {/* Actual Turkey Map SVG Outline */}
          <div className="min-w-[650px] w-full aspect-[2/1] p-2 flex items-center justify-center relative lg:min-w-0">
            {svgContent ? (
              <svg
                viewBox="0 0 1005 490"
                className="w-full h-full cursor-pointer select-none"
                onClick={handleSvgClick}
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={() => setHoveredCity(null)}
              >
                <style>{`
                  path {
                    transition: fill 0.25s, stroke 0.25s;
                  }
                  path:hover {
                    fill: #8b5cf6 !important;
                    fill-opacity: 0.55 !important;
                    stroke: #ffffff !important;
                    stroke-width: 2px !important;
                  }
                  #${normalizeCityName(selectedCity)} path {
                    fill: #6366f1 !important;
                    fill-opacity: 0.7 !important;
                    stroke: #ffffff !important;
                    stroke-width: 2.2px !important;
                  }
                `}</style>
                <g
                  className="turkey"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              </svg>
            ) : (
              <div className="text-xs text-slate-400 font-bold flex items-center gap-2">
                <Plus className="animate-spin" size={14} /> Harita Yükleniyor...
              </div>
            )}
          </div>


        </div>

        {/* Selected City HUD */}
        <div className="flex items-center justify-between border-t border-slate-800/60 pt-4 z-10">
          <span className="text-xs font-black uppercase tracking-widest text-violet-400 flex items-center gap-1">
            <MapPin size={12} /> {selectedCity} Bölgesi
          </span>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            {CITIES.length} İl Aktif
          </span>
        </div>
      </div>

      {/* Sağ Panel: Öneriler Çekmecesi & Ekleme & Yorumlama Formu */}
      <div ref={drawerRef} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 flex flex-col shadow-xl h-[600px] overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* VIEW 1: Yeni Mekan Önerisi Ekleme */}
        {isAddingPlace ? (
          <form onSubmit={handlePlaceSubmit} className="flex-1 flex flex-col h-full overflow-hidden animate-in fade-in slide-in-from-right-3 duration-250">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest">
                Yeni Mekan Ekle ({selectedCity})
              </span>
              <button
                type="button"
                onClick={() => setIsAddingPlace(false)}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Mekan Adı</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Örn: Ankara Hakimevi"
                className="w-full h-9 px-3 rounded-xl border border-slate-105 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-xs font-semibold outline-none focus:ring-1 focus:ring-violet-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Mekan Türü</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as PlaceType)}
                className="w-full h-9 px-3 rounded-xl border border-slate-105 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-xs font-semibold outline-none focus:ring-1 focus:ring-violet-500 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <option value="hotel">Otel / Konaklama</option>
                <option value="yurt">GSB Yurdu</option>
                <option value="facility">Misafirhane / Kamu Tesisi</option>
                <option value="food">Restoran / Yemek</option>
                <option value="other">Diğer (Kendiniz yazın)</option>
              </select>
              {newType === "other" && (
                <input
                  type="text"
                  required
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="Mekan türünü yazın..."
                  className="w-full h-9 px-3 mt-1.5 rounded-xl border border-slate-105 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-xs font-semibold outline-none focus:ring-1 focus:ring-violet-500 text-slate-800 dark:text-slate-100"
                />
              )}
              {(newType === "hotel" || newType === "facility" || newType === "yurt") && (
                <label className="flex items-center gap-2 mt-2 p-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={newFitsPerDiem}
                    onChange={(e) => setNewFitsPerDiem(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    Harcıraha Uygun (Gündelikle kalınabilir)
                  </span>
                </label>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Konaklama Fiyatı / Ücret (Opsiyonel)</label>
              <input
                type="text"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Örn: 450 TL"
                className="w-full h-9 px-3 rounded-xl border border-slate-105 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-xs font-semibold outline-none focus:ring-1 focus:ring-violet-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Puanlama</label>
              <div className="flex items-center gap-1.5 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewRating(star)}
                    className="p-1 hover:scale-110 active:scale-95 transition-transform"
                  >
                    <Star
                      size={18}
                      className={star <= newRating ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-700"}
                    />
                  </button>
                ))}
              </div>
            </div>


            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Etiketler</label>
              <TagSelector value={newTags} onChange={setNewTags} />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Açıklama & Tavsiyeler</label>
              <textarea
                required
                rows={3}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Örn: Odaları geniş ve konforlu, kahvaltısı tavsiye edilir..."
                className="w-full rounded-xl border border-slate-105 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 px-3 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-violet-500 text-slate-700 dark:text-slate-200 resize-none leading-relaxed"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-10 rounded-xl font-bold text-xs shadow-md"
            >
              {submitting ? "Gönderiliyor..." : "Öneriyi Kaydet"}
            </Button>
          </form>
        ) : selectedPlace ? (
          /* VIEW 2: Google Maps Tarzı Mekan Detayı, Yorumları ve Yorum Ekleme */
          <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-250">
            {/* Detail Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <button
                onClick={() => setSelectedPlaceId(null)}
                className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-white uppercase tracking-wider"
              >
                <ArrowLeft size={12} /> Mekan Listesi
              </button>
              
              {canDeletePlace(selectedPlace) && (
                <button
                  onClick={() => handleDeletePlace(selectedPlace.id)}
                  className="p-1.5 bg-red-50 dark:bg-red-950/30 text-red-650 hover:bg-red-100 rounded-lg transition-colors"
                  title="Mekanı Sil"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            {/* Place Summary */}
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/50 shadow-sm shrink-0 mt-0.5">
                  {getPlaceIcon(selectedPlace.type)}
                </div>
                <div>
                  <h6 className="text-xs font-black text-slate-850 dark:text-slate-100 leading-tight">
                    {selectedPlace.name}
                  </h6>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                    {getTypeName(selectedPlace.type)}
                  </span>
                </div>
              </div>

              {/* Rating Summary HUD */}
              {(() => {
                const stats = getPlaceRatingStats(selectedPlace.id, selectedPlace.rating);
                return (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star
                          key={idx}
                          size={12}
                          className={
                            idx < Math.round(stats.avg)
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-200 dark:text-slate-700"
                          }
                        />
                      ))}
                    </div>
                    <span className="text-xs text-amber-500 dark:text-amber-400 font-extrabold">{stats.avg} / 5</span>
                    <span className="text-[10px] text-slate-450 font-medium">({stats.count || 0} Yorum)</span>
                  </div>
                );
              })()}

              <div className="flex flex-wrap gap-1 mt-1">
                {selectedPlace.fitsPerDiem && (
                  <div className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">
                    Harcıraha Uygun
                  </div>
                )}
                {selectedPlace.price && (
                  <div className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">
                    Fiyat: {selectedPlace.price}
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/20 p-3 rounded-2xl border border-slate-100/50 dark:border-slate-800/40 italic leading-relaxed font-semibold">
                "{selectedPlace.description}"
              </p>

              <div className="text-[8px] text-slate-400 font-semibold flex items-center justify-between">
                <span>Ekleyen: {selectedPlace.author}</span>
                <span>{new Date(selectedPlace.date).toLocaleDateString("tr-TR")}</span>
              </div>
            </div>

            {/* Reviews Section */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <h6 className="text-[10px] font-black text-slate-450 uppercase tracking-wider flex items-center gap-1">
                <MessageSquare size={11} /> Müfettiş Değerlendirmeleri ({selectedPlaceReviews.length})
              </h6>

              {selectedPlaceReviews.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-[10px] font-bold">
                  Henüz yorum yapılmamış. İlk değerlendirmeyi siz yazın!
                </div>
              ) : (
                <div className="h-[270px] flex flex-col pr-1">
                  {(() => {
                    const REVIEWS_PER_PAGE = 3;
                    const totalPages = Math.max(1, Math.ceil(selectedPlaceReviews.length / REVIEWS_PER_PAGE));
                    const currentReviews = selectedPlaceReviews.slice((reviewPage - 1) * REVIEWS_PER_PAGE, reviewPage * REVIEWS_PER_PAGE);

                    return (
                      <>
                        <div className="flex-1 space-y-3">
                          {currentReviews.map((review) => (
                            <div
                              key={review.id}
                              className="p-3 bg-slate-50/40 dark:bg-slate-950/15 rounded-xl border border-slate-100 dark:border-slate-800/50 text-[11px] relative group"
                            >
                              <div className="flex items-start justify-between gap-1 mb-1.5">
                                <div className="font-extrabold text-slate-700 dark:text-slate-250 truncate max-w-[150px]">
                                  {review.author}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <div className="flex items-center">
                                    {Array.from({ length: 5 }).map((_, idx) => (
                                      <Star
                                        key={idx}
                                        size={8}
                                        className={
                                          idx < review.rating
                                            ? "fill-amber-400 text-amber-400"
                                            : "text-slate-200 dark:text-slate-700"
                                        }
                                      />
                                    ))}
                                  </div>
                                  
                                  {canDeleteReview(review) && (
                                    <button
                                      onClick={() => handleDeleteReview(review.id)}
                                      className="text-red-500 hover:text-red-700 ml-1 p-0.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded"
                                      title="Yorumu Sil"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                                {review.content}
                              </p>
                              <div className="text-[7px] text-slate-400 font-bold text-right mt-2 pt-2 border-t border-slate-100/50 dark:border-slate-800/50">
                                {new Date(review.date).toLocaleDateString("tr-TR")}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {totalPages > 1 && (
                          <div className="flex items-center justify-center gap-2 pt-2 pb-1 mt-auto">
                            <button
                              type="button"
                              disabled={reviewPage === 1}
                              onClick={() => setReviewPage(p => p - 1)}
                              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-[10px] font-bold disabled:opacity-30 transition-colors"
                            >
                              Önceki
                            </button>
                            <span className="text-[10px] text-slate-500 font-bold">{reviewPage} / {totalPages}</span>
                            <button
                              type="button"
                              disabled={reviewPage === totalPages}
                              onClick={() => setReviewPage(p => p + 1)}
                              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-[10px] font-bold disabled:opacity-30 transition-colors"
                            >
                              Sonraki
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Write a Review Form */}
            <form onSubmit={handleReviewSubmit} className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest">
                Değerlendirme Yaz
              </span>

              <div className="flex items-center gap-1">
                <span className="text-[9px] font-bold text-slate-450 mr-1 uppercase">Puanınız:</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewReviewRating(star)}
                    className="p-0.5 hover:scale-110 active:scale-95 transition-transform"
                  >
                    <Star
                      size={14}
                      className={star <= newReviewRating ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-slate-700"}
                    />
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <textarea
                  required
                  rows={2}
                  value={newReviewContent}
                  onChange={(e) => setNewReviewContent(e.target.value)}
                  placeholder="Deneyiminizi ve tavsiyelerinizi yazın..."
                  className="w-full rounded-xl border border-slate-105 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-violet-500 text-slate-700 dark:text-slate-200 resize-none leading-relaxed"
                />
              </div>

              <Button
                type="submit"
                disabled={submittingReview}
                className="w-full h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider shadow-sm"
              >
                {submittingReview ? "Gönderiliyor..." : "Değerlendirmeyi Gönder"}
              </Button>
            </form>
          </div>
        ) : (
          /* VIEW 3: Seçili İl Mekan Listesi */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Kayıtlı Öneriler
              </span>
              <Button
                size="sm"
                onClick={() => setIsAddingPlace(true)}
                className="h-8 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5"
              >
                <Plus size={11} /> Yeni Öneri Ekle
              </Button>
            </div>

            {selectedCityPlaces.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 space-y-2">
                <MapPin size={24} className="mx-auto text-slate-300 dark:text-slate-700 animate-bounce" />
                <p className="text-xs font-bold uppercase tracking-wider">Öneri Bulunmuyor</p>
                <p className="text-[10px] font-semibold opacity-75 max-w-[200px] mx-auto leading-relaxed">
                  Bu ile henüz konaklama veya yemek önerisi eklenmemiş. İlk öneriyi siz ekleyin!
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {(() => {
                  const PLACES_PER_PAGE = 3;
                  const totalPages = Math.max(1, Math.ceil(selectedCityPlaces.length / PLACES_PER_PAGE));
                  const currentPlaces = selectedCityPlaces.slice((placePage - 1) * PLACES_PER_PAGE, placePage * PLACES_PER_PAGE);

                  return (
                    <>
                      <div className="space-y-3 flex-1 overflow-y-auto pr-1 pb-2">
                        {currentPlaces.map((place) => {
                          const ratingStats = getPlaceRatingStats(place.id, place.rating);
                          return (
                            <div
                              key={place.id}
                              onClick={() => setSelectedPlaceId(place.id)}
                              className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col gap-2 relative group hover:border-violet-300 dark:hover:border-violet-850/60 hover:bg-slate-100/30 dark:hover:bg-slate-950/40 cursor-pointer transition-all duration-200 shrink-0"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm shrink-0">
                                    {getPlaceIcon(place.type)}
                                  </div>
                                  <div>
                                    <h6 className="text-[11px] font-black text-slate-800 dark:text-slate-200 line-clamp-1">
                                      {place.name}
                                    </h6>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                                      {getTypeName(place.type)}
                                    </span>
                                  </div>
                                </div>

                                {/* Stars */}
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <span className="text-[9px] font-extrabold text-amber-500 mr-1">{ratingStats.avg}</span>
                                  <Star
                                    size={10}
                                    className="fill-amber-400 text-amber-400"
                                  />
                                  {ratingStats.count > 0 && (
                                    <span className="text-[8px] text-slate-400 font-semibold">({ratingStats.count})</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {place.fitsPerDiem && (
                                  <div className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider w-fit">
                                    Harcıraha Uygun
                                  </div>
                                )}
                                {place.price && (
                                  <div className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider w-fit">
                                    Fiyat: {place.price}
                                  </div>
                                )}
                              </div>

                              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold italic line-clamp-2">
                                "{place.description}"
                              </p>

                              <div className="flex items-center justify-between text-[8px] text-slate-400 font-bold border-t border-slate-100 dark:border-slate-800 pt-2 mt-0.5">
                                <span className="truncate max-w-[120px]">Öneren: {place.author.split("@")[0]}</span>
                                <span>{new Date(place.date).toLocaleDateString("tr-TR")}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-3 pb-1 mt-auto shrink-0 border-t border-slate-100 dark:border-slate-800/80">
                          <button
                            type="button"
                            disabled={placePage === 1}
                            onClick={() => setPlacePage(p => p - 1)}
                            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider disabled:opacity-30 transition-colors"
                          >
                            Önceki
                          </button>
                          <span className="text-[10px] text-slate-500 font-bold">{placePage} / {totalPages}</span>
                          <button
                            type="button"
                            disabled={placePage === totalPages}
                            onClick={() => setPlacePage(p => p + 1)}
                            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider disabled:opacity-30 transition-colors"
                          >
                            Sonraki
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hover Tooltip */}
      {hoveredCity && hasHover && (
        <div
          style={{ left: mousePos.x + 15, top: mousePos.y + 15 }}
          className="fixed bg-slate-900/95 border border-slate-700 text-white text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-xl pointer-events-none z-[100] animate-in fade-in duration-150"
        >
          {hoveredCity}
        </div>
      )}
    </div>
  );
}
