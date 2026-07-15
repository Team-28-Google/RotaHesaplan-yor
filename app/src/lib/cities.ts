import AsyncStorage from "@react-native-async-storage/async-storage";

// Çok şehir desteği (3.0c) — servisteki _DISTRICTS/_CITY_COORDS ile uyumlu.
// key: DB'deki ASCII kanonik ad · label: ekranda görünen Türkçe ad.

export interface CityInfo {
  key: string;
  label: string;
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  /** 🎲 üretim semtleri — servisteki _DISTRICTS adlarıyla birebir aynı */
  districts: string[];
}

export const CITIES: CityInfo[] = [
  {
    key: "Istanbul", label: "İstanbul",
    region: { latitude: 41.02, longitude: 28.99, latitudeDelta: 0.32, longitudeDelta: 0.32 },
    districts: ["Kadıköy · Moda", "Balat", "Karaköy · Galata", "Üsküdar", "Ortaköy", "Sultanahmet", "Bebek · Arnavutköy"],
  },
  {
    key: "Ankara", label: "Ankara",
    region: { latitude: 39.92, longitude: 32.85, latitudeDelta: 0.18, longitudeDelta: 0.18 },
    districts: ["Kızılay · Tunalı", "Ulus · Hamamönü", "Çankaya · Seğmenler"],
  },
  {
    key: "Gaziantep", label: "Gaziantep",
    region: { latitude: 37.066, longitude: 37.383, latitudeDelta: 0.12, longitudeDelta: 0.12 },
    districts: ["Kale · Çarşı", "Bey Mahallesi", "100. Yıl"],
  },
  {
    key: "Izmir", label: "İzmir",
    region: { latitude: 38.425, longitude: 27.13, latitudeDelta: 0.14, longitudeDelta: 0.14 },
    districts: ["Alsancak · Kordon", "Konak · Kemeraltı", "Karataş"],
  },
  {
    key: "Bursa", label: "Bursa",
    region: { latitude: 40.186, longitude: 29.065, latitudeDelta: 0.14, longitudeDelta: 0.14 },
    districts: ["Hanlar Bölgesi", "Yeşil · Irgandı", "Kültürpark"],
  },
  {
    key: "Mugla", label: "Muğla",
    // İl geniş (Bodrum→Fethiye ~150 km) — bölge tüm sahili kapsar
    region: { latitude: 36.9, longitude: 28.2, latitudeDelta: 1.3, longitudeDelta: 2.0 },
    districts: ["Bodrum", "Marmaris", "Datça", "Fethiye", "Akyaka"],
  },
];

// Tüm-Türkiye: 81 ilin merkezleri — seçicideki İL ARAMA bunları listeler (çevrimdışı,
// API'siz). key'ler servisteki norm_city/_TR_PROVINCES kanoniğiyle birebir aynı.
export const PROVINCES: { key: string; label: string; lat: number; lng: number }[] = [
  { key: "Adana", label: "Adana", lat: 37.0, lng: 35.32 },
  { key: "Adiyaman", label: "Adıyaman", lat: 37.76, lng: 38.28 },
  { key: "Afyonkarahisar", label: "Afyonkarahisar", lat: 38.76, lng: 30.54 },
  { key: "Agri", label: "Ağrı", lat: 39.72, lng: 43.05 },
  { key: "Amasya", label: "Amasya", lat: 40.65, lng: 35.83 },
  { key: "Ankara", label: "Ankara", lat: 39.93, lng: 32.86 },
  { key: "Antalya", label: "Antalya", lat: 36.89, lng: 30.71 },
  { key: "Artvin", label: "Artvin", lat: 41.18, lng: 41.82 },
  { key: "Aydin", label: "Aydın", lat: 37.84, lng: 27.84 },
  { key: "Balikesir", label: "Balıkesir", lat: 39.65, lng: 27.89 },
  { key: "Bilecik", label: "Bilecik", lat: 40.15, lng: 29.98 },
  { key: "Bingol", label: "Bingöl", lat: 38.88, lng: 40.5 },
  { key: "Bitlis", label: "Bitlis", lat: 38.4, lng: 42.11 },
  { key: "Bolu", label: "Bolu", lat: 40.74, lng: 31.61 },
  { key: "Burdur", label: "Burdur", lat: 37.72, lng: 30.29 },
  { key: "Bursa", label: "Bursa", lat: 40.19, lng: 29.06 },
  { key: "Canakkale", label: "Çanakkale", lat: 40.15, lng: 26.41 },
  { key: "Cankiri", label: "Çankırı", lat: 40.6, lng: 33.62 },
  { key: "Corum", label: "Çorum", lat: 40.55, lng: 34.95 },
  { key: "Denizli", label: "Denizli", lat: 37.77, lng: 29.09 },
  { key: "Diyarbakir", label: "Diyarbakır", lat: 37.91, lng: 40.24 },
  { key: "Edirne", label: "Edirne", lat: 41.68, lng: 26.56 },
  { key: "Elazig", label: "Elazığ", lat: 38.68, lng: 39.22 },
  { key: "Erzincan", label: "Erzincan", lat: 39.75, lng: 39.49 },
  { key: "Erzurum", label: "Erzurum", lat: 39.9, lng: 41.27 },
  { key: "Eskisehir", label: "Eskişehir", lat: 39.78, lng: 30.52 },
  { key: "Gaziantep", label: "Gaziantep", lat: 37.07, lng: 37.38 },
  { key: "Giresun", label: "Giresun", lat: 40.91, lng: 38.39 },
  { key: "Gumushane", label: "Gümüşhane", lat: 40.46, lng: 39.48 },
  { key: "Hakkari", label: "Hakkari", lat: 37.58, lng: 43.74 },
  { key: "Hatay", label: "Hatay", lat: 36.2, lng: 36.16 },
  { key: "Isparta", label: "Isparta", lat: 37.76, lng: 30.55 },
  { key: "Mersin", label: "Mersin", lat: 36.8, lng: 34.63 },
  { key: "Istanbul", label: "İstanbul", lat: 41.01, lng: 28.98 },
  { key: "Izmir", label: "İzmir", lat: 38.42, lng: 27.13 },
  { key: "Kars", label: "Kars", lat: 40.6, lng: 43.1 },
  { key: "Kastamonu", label: "Kastamonu", lat: 41.38, lng: 33.78 },
  { key: "Kayseri", label: "Kayseri", lat: 38.72, lng: 35.49 },
  { key: "Kirklareli", label: "Kırklareli", lat: 41.74, lng: 27.23 },
  { key: "Kirsehir", label: "Kırşehir", lat: 39.15, lng: 34.16 },
  { key: "Kocaeli", label: "Kocaeli", lat: 40.77, lng: 29.92 },
  { key: "Konya", label: "Konya", lat: 37.87, lng: 32.48 },
  { key: "Kutahya", label: "Kütahya", lat: 39.42, lng: 29.98 },
  { key: "Malatya", label: "Malatya", lat: 38.35, lng: 38.31 },
  { key: "Manisa", label: "Manisa", lat: 38.61, lng: 27.43 },
  { key: "Kahramanmaras", label: "Kahramanmaraş", lat: 37.58, lng: 36.93 },
  { key: "Mardin", label: "Mardin", lat: 37.31, lng: 40.74 },
  { key: "Mugla", label: "Muğla", lat: 37.22, lng: 28.36 },
  { key: "Mus", label: "Muş", lat: 38.73, lng: 41.49 },
  { key: "Nevsehir", label: "Nevşehir", lat: 38.62, lng: 34.71 },
  { key: "Nigde", label: "Niğde", lat: 37.97, lng: 34.68 },
  { key: "Ordu", label: "Ordu", lat: 40.98, lng: 37.88 },
  { key: "Rize", label: "Rize", lat: 41.02, lng: 40.52 },
  { key: "Sakarya", label: "Sakarya", lat: 40.77, lng: 30.4 },
  { key: "Samsun", label: "Samsun", lat: 41.29, lng: 36.33 },
  { key: "Siirt", label: "Siirt", lat: 37.93, lng: 41.94 },
  { key: "Sinop", label: "Sinop", lat: 42.03, lng: 35.15 },
  { key: "Sivas", label: "Sivas", lat: 39.75, lng: 37.02 },
  { key: "Tekirdag", label: "Tekirdağ", lat: 40.98, lng: 27.51 },
  { key: "Tokat", label: "Tokat", lat: 40.31, lng: 36.55 },
  { key: "Trabzon", label: "Trabzon", lat: 41.0, lng: 39.72 },
  { key: "Tunceli", label: "Tunceli", lat: 39.11, lng: 39.55 },
  { key: "Sanliurfa", label: "Şanlıurfa", lat: 37.16, lng: 38.79 },
  { key: "Usak", label: "Uşak", lat: 38.68, lng: 29.41 },
  { key: "Van", label: "Van", lat: 38.49, lng: 43.38 },
  { key: "Yozgat", label: "Yozgat", lat: 39.82, lng: 34.81 },
  { key: "Zonguldak", label: "Zonguldak", lat: 41.45, lng: 31.79 },
  { key: "Aksaray", label: "Aksaray", lat: 38.37, lng: 34.03 },
  { key: "Bayburt", label: "Bayburt", lat: 40.26, lng: 40.22 },
  { key: "Karaman", label: "Karaman", lat: 37.18, lng: 33.22 },
  { key: "Kirikkale", label: "Kırıkkale", lat: 39.85, lng: 33.51 },
  { key: "Batman", label: "Batman", lat: 37.88, lng: 41.13 },
  { key: "Sirnak", label: "Şırnak", lat: 37.52, lng: 42.46 },
  { key: "Bartin", label: "Bartın", lat: 41.64, lng: 32.34 },
  { key: "Ardahan", label: "Ardahan", lat: 41.11, lng: 42.7 },
  { key: "Igdir", label: "Iğdır", lat: 39.92, lng: 44.04 },
  { key: "Yalova", label: "Yalova", lat: 40.65, lng: 29.27 },
  { key: "Karabuk", label: "Karabük", lat: 41.2, lng: 32.62 },
  { key: "Kilis", label: "Kilis", lat: 36.72, lng: 37.12 },
  { key: "Osmaniye", label: "Osmaniye", lat: 37.07, lng: 36.25 },
  { key: "Duzce", label: "Düzce", lat: 40.84, lng: 31.16 },
];

// Türkçe-duyarsız arama (ı/i, ş/s...): "canak" → Çanakkale
const fold = (s: string) =>
  s.toLocaleLowerCase("tr").replace(/[çğıöşü]/g, (c) => ({ "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u" }[c] ?? c));

// Ülke yazınca o ülkenin büyük şehirlerini ANINDA göster (TR listesi gibi, API'siz).
// key = ülke etiketi (görünür); aliases = eşleşecek yazımlar; cities = büyük şehirler.
// Şehir koordinatları seçimde /city-latlng (Geocoding) ile çözülür — burada yalnız ad.
// tr/en iki-dilli: ekranda aktif dile göre gösterilir. Şehir bir string ise iki dilde
// aynı; [tr, en] tuple ise farklı yazımlar (Marsilya/Marseille). key = canonKey(gösterilen)
// — rotalar zaten dile göre ayrık havuzda (0024), her dil kendi adını kullanabilir.
type City = string | [string, string];
interface CountryCities { tr: string; en: string; aliases: string[]; cities: City[] }
const cityDisplay = (c: City, lang: string) => (Array.isArray(c) ? (lang === "en" ? c[1] : c[0]) : c);

const COUNTRIES: CountryCities[] = [
  { tr: "Almanya", en: "Germany", aliases: ["almanya", "germany", "deutschland"], cities: ["Berlin", ["Münih", "Munich"], "Hamburg", ["Köln", "Cologne"], "Frankfurt"] },
  { tr: "Fransa", en: "France", aliases: ["fransa", "france"], cities: ["Paris", ["Marsilya", "Marseille"], "Lyon", "Nice", "Bordeaux"] },
  { tr: "İtalya", en: "Italy", aliases: ["italya", "italy", "italia"], cities: [["Roma", "Rome"], ["Milano", "Milan"], ["Venedik", "Venice"], ["Floransa", "Florence"], ["Napoli", "Naples"]] },
  { tr: "İspanya", en: "Spain", aliases: ["ispanya", "spain", "espana"], cities: ["Madrid", ["Barselona", "Barcelona"], ["Sevilla", "Seville"], ["Valensiya", "Valencia"], "Malaga"] },
  { tr: "Birleşik Krallık", en: "United Kingdom", aliases: ["ingiltere", "birlesik krallik", "uk", "england", "britain"], cities: [["Londra", "London"], "Manchester", "Edinburgh", "Liverpool", "Birmingham"] },
  { tr: "Hollanda", en: "Netherlands", aliases: ["hollanda", "netherlands", "holland"], cities: ["Amsterdam", "Rotterdam", ["Lahey", "The Hague"], "Utrecht", "Eindhoven"] },
  { tr: "Amerika", en: "United States", aliases: ["amerika", "abd", "usa", "america", "united states"], cities: ["New York", "Los Angeles", "Chicago", "Miami", "San Francisco"] },
  { tr: "Japonya", en: "Japan", aliases: ["japonya", "japan"], cities: ["Tokyo", "Osaka", "Kyoto", "Yokohama", "Sapporo"] },
  { tr: "Yunanistan", en: "Greece", aliases: ["yunanistan", "greece"], cities: [["Atina", "Athens"], ["Selanik", "Thessaloniki"], ["Rodos", "Rhodes"], "Heraklion", "Patras"] },
  { tr: "Avusturya", en: "Austria", aliases: ["avusturya", "austria"], cities: [["Viyana", "Vienna"], "Salzburg", "Graz", "Innsbruck"] },
  { tr: "Çekya", en: "Czechia", aliases: ["cekya", "cek cumhuriyeti", "czech", "czechia"], cities: [["Prag", "Prague"], "Brno", "Ostrava"] },
  { tr: "Portekiz", en: "Portugal", aliases: ["portekiz", "portugal"], cities: [["Lizbon", "Lisbon"], "Porto", "Faro"] },
  { tr: "Rusya", en: "Russia", aliases: ["rusya", "russia"], cities: [["Moskova", "Moscow"], "St. Petersburg", "Kazan", ["Soçi", "Sochi"]] },
  { tr: "İsviçre", en: "Switzerland", aliases: ["isvicre", "switzerland"], cities: [["Zürih", "Zurich"], ["Cenevre", "Geneva"], "Bern", ["Lozan", "Lausanne"]] },
  { tr: "Belçika", en: "Belgium", aliases: ["belcika", "belgium"], cities: [["Brüksel", "Brussels"], ["Anvers", "Antwerp"], "Bruges", ["Gent", "Ghent"]] },
  { tr: "İsveç", en: "Sweden", aliases: ["isvec", "sweden"], cities: ["Stockholm", ["Göteborg", "Gothenburg"], "Malmö"] },
  { tr: "Norveç", en: "Norway", aliases: ["norvec", "norway"], cities: ["Oslo", "Bergen", "Trondheim"] },
  { tr: "Danimarka", en: "Denmark", aliases: ["danimarka", "denmark"], cities: [["Kopenhag", "Copenhagen"], "Aarhus", "Odense"] },
  { tr: "Polonya", en: "Poland", aliases: ["polonya", "poland"], cities: [["Varşova", "Warsaw"], ["Krakov", "Krakow"], "Gdansk", "Wroclaw"] },
  { tr: "Macaristan", en: "Hungary", aliases: ["macaristan", "hungary"], cities: [["Budapeşte", "Budapest"], "Debrecen"] },
  { tr: "İrlanda", en: "Ireland", aliases: ["irlanda", "ireland"], cities: ["Dublin", "Cork", "Galway"] },
  { tr: "Hırvatistan", en: "Croatia", aliases: ["hirvatistan", "croatia"], cities: ["Zagreb", "Dubrovnik", "Split", "Zadar"] },
  { tr: "Bulgaristan", en: "Bulgaria", aliases: ["bulgaristan", "bulgaria"], cities: [["Sofya", "Sofia"], ["Filibe", "Plovdiv"], "Varna", ["Burgaz", "Burgas"]] },
  { tr: "Gürcistan", en: "Georgia", aliases: ["gurcistan", "georgia"], cities: [["Tiflis", "Tbilisi"], ["Batum", "Batumi"], "Kutaisi"] },
  { tr: "Azerbaycan", en: "Azerbaijan", aliases: ["azerbaycan", "azerbaijan"], cities: [["Bakü", "Baku"], ["Gence", "Ganja"]] },
  { tr: "Birleşik Arap Emirlikleri", en: "United Arab Emirates", aliases: ["bae", "dubai ulke", "emirlikler", "uae"], cities: ["Dubai", ["Abu Dabi", "Abu Dhabi"], ["Şarja", "Sharjah"]] },
  { tr: "Mısır", en: "Egypt", aliases: ["misir", "egypt"], cities: [["Kahire", "Cairo"], ["İskenderiye", "Alexandria"], ["Luksor", "Luxor"], ["Hurgada", "Hurghada"]] },
  { tr: "Fas", en: "Morocco", aliases: ["fas", "morocco"], cities: [["Kazablanka", "Casablanca"], ["Marakeş", "Marrakesh"], "Rabat", ["Fes", "Fez"]] },
  { tr: "Çin", en: "China", aliases: ["cin", "china"], cities: [["Pekin", "Beijing"], ["Şanghay", "Shanghai"], "Guangzhou", ["Şenzhen", "Shenzhen"]] },
  { tr: "Hindistan", en: "India", aliases: ["hindistan", "india"], cities: ["Delhi", "Mumbai", "Bangalore", "Jaipur"] },
  { tr: "Brezilya", en: "Brazil", aliases: ["brezilya", "brazil"], cities: ["Rio de Janeiro", "São Paulo", "Brasília", "Salvador"] },
  { tr: "Kanada", en: "Canada", aliases: ["kanada", "canada"], cities: ["Toronto", "Vancouver", "Montreal", "Ottawa"] },
  { tr: "Meksika", en: "Mexico", aliases: ["meksika", "mexico"], cities: ["Mexico City", "Cancún", "Guadalajara"] },
  { tr: "Slovakya", en: "Slovakia", aliases: ["slovakya", "slovakia", "slovensko"], cities: ["Bratislava", "Košice", "Žilina"] },
  { tr: "Slovenya", en: "Slovenia", aliases: ["slovenya", "slovenia"], cities: ["Ljubljana", "Maribor", "Bled"] },
  { tr: "Sırbistan", en: "Serbia", aliases: ["sirbistan", "serbia"], cities: [["Belgrad", "Belgrade"], "Novi Sad", "Niš"] },
  { tr: "Romanya", en: "Romania", aliases: ["romanya", "romania"], cities: [["Bükreş", "Bucharest"], ["Kluj", "Cluj"], ["Braşov", "Brasov"], "Timişoara"] },
  { tr: "Ukrayna", en: "Ukraine", aliases: ["ukrayna", "ukraine"], cities: [["Kiev", "Kyiv"], "Lviv", "Odesa", ["Harkiv", "Kharkiv"]] },
  { tr: "Finlandiya", en: "Finland", aliases: ["finlandiya", "finland"], cities: ["Helsinki", "Tampere", "Turku"] },
  { tr: "İzlanda", en: "Iceland", aliases: ["izlanda", "iceland"], cities: ["Reykjavik", "Akureyri"] },
  { tr: "Estonya", en: "Estonia", aliases: ["estonya", "estonia"], cities: ["Tallinn", "Tartu"] },
  { tr: "Litvanya", en: "Lithuania", aliases: ["litvanya", "lithuania"], cities: ["Vilnius", "Kaunas"] },
  { tr: "Letonya", en: "Latvia", aliases: ["letonya", "latvia"], cities: ["Riga", "Jurmala"] },
  { tr: "Malta", en: "Malta", aliases: ["malta"], cities: ["Valletta", "Sliema"] },
  { tr: "Kıbrıs", en: "Cyprus", aliases: ["kibris", "cyprus"], cities: [["Lefkoşa", "Nicosia"], ["Girne", "Kyrenia"], ["Larnaka", "Larnaca"], ["Limasol", "Limassol"]] },
  { tr: "Lüksemburg", en: "Luxembourg", aliases: ["luksemburg", "luxembourg"], cities: [["Lüksemburg", "Luxembourg"]] },
  { tr: "Tayland", en: "Thailand", aliases: ["tayland", "thailand"], cities: ["Bangkok", "Phuket", "Chiang Mai", "Pattaya"] },
  { tr: "Vietnam", en: "Vietnam", aliases: ["vietnam"], cities: ["Hanoi", "Ho Chi Minh", "Da Nang", "Hoi An"] },
  { tr: "Endonezya", en: "Indonesia", aliases: ["endonezya", "indonesia"], cities: [["Cakarta", "Jakarta"], "Bali", "Bandung", "Surabaya"] },
  { tr: "Malezya", en: "Malaysia", aliases: ["malezya", "malaysia"], cities: ["Kuala Lumpur", "Penang", "Johor Bahru"] },
  { tr: "Singapur", en: "Singapore", aliases: ["singapur", "singapore"], cities: [["Singapur", "Singapore"]] },
  { tr: "Filipinler", en: "Philippines", aliases: ["filipinler", "philippines"], cities: ["Manila", "Cebu", "Davao"] },
  { tr: "Güney Kore", en: "South Korea", aliases: ["guney kore", "kore", "south korea", "korea"], cities: [["Seul", "Seoul"], "Busan", "Incheon", "Jeju"] },
  { tr: "Tayvan", en: "Taiwan", aliases: ["tayvan", "taiwan"], cities: ["Taipei", "Kaohsiung", "Taichung"] },
  { tr: "Güney Afrika", en: "South Africa", aliases: ["guney afrika", "south africa"], cities: ["Cape Town", "Johannesburg", "Durban", "Pretoria"] },
  { tr: "Tunus", en: "Tunisia", aliases: ["tunus", "tunisia"], cities: [["Tunus", "Tunis"], ["Sus", "Sousse"], "Hammamet"] },
  { tr: "Ürdün", en: "Jordan", aliases: ["urdun", "jordan"], cities: ["Amman", "Petra", ["Akabe", "Aqaba"]] },
  { tr: "Lübnan", en: "Lebanon", aliases: ["lubnan", "lebanon"], cities: [["Beyrut", "Beirut"], ["Trablus", "Tripoli"], "Byblos"] },
  { tr: "İsrail", en: "Israel", aliases: ["israil", "israel"], cities: [["Kudüs", "Jerusalem"], "Tel Aviv", ["Hayfa", "Haifa"]] },
  { tr: "Katar", en: "Qatar", aliases: ["katar", "qatar"], cities: ["Doha", "Al Wakrah"] },
  { tr: "Suudi Arabistan", en: "Saudi Arabia", aliases: ["suudi arabistan", "suudi", "saudi arabia", "saudi"], cities: [["Riyad", "Riyadh"], ["Cidde", "Jeddah"], ["Mekke", "Mecca"], ["Medine", "Medina"]] },
  { tr: "Kuveyt", en: "Kuwait", aliases: ["kuveyt", "kuwait"], cities: [["Kuveyt", "Kuwait City"]] },
  { tr: "İran", en: "Iran", aliases: ["iran"], cities: [["Tahran", "Tehran"], ["İsfahan", "Isfahan"], ["Şiraz", "Shiraz"], ["Meşhed", "Mashhad"]] },
  { tr: "Pakistan", en: "Pakistan", aliases: ["pakistan"], cities: [["İslamabad", "Islamabad"], ["Lahor", "Lahore"], ["Karaçi", "Karachi"]] },
  { tr: "Sri Lanka", en: "Sri Lanka", aliases: ["sri lanka", "srilanka"], cities: [["Kolombo", "Colombo"], "Kandy", "Galle"] },
  { tr: "Nepal", en: "Nepal", aliases: ["nepal"], cities: [["Katmandu", "Kathmandu"], "Pokhara"] },
  { tr: "Arjantin", en: "Argentina", aliases: ["arjantin", "argentina"], cities: ["Buenos Aires", "Córdoba", "Mendoza"] },
  { tr: "Şili", en: "Chile", aliases: ["sili", "chile"], cities: ["Santiago", "Valparaíso"] },
  { tr: "Kolombiya", en: "Colombia", aliases: ["kolombiya", "colombia"], cities: ["Bogotá", "Medellín", "Cartagena"] },
  { tr: "Peru", en: "Peru", aliases: ["peru"], cities: ["Lima", "Cusco", "Arequipa"] },
  { tr: "Küba", en: "Cuba", aliases: ["kuba", "cuba"], cities: ["Havana", "Varadero"] },
  { tr: "Avustralya", en: "Australia", aliases: ["avustralya", "australia"], cities: ["Sydney", "Melbourne", "Brisbane", "Perth"] },
  { tr: "Yeni Zelanda", en: "New Zealand", aliases: ["yeni zelanda", "new zealand"], cities: ["Auckland", "Wellington", "Queenstown"] },
];

/** Sorgu bir ülke adına (ön-ek) uyuyorsa o ülkenin büyük şehirlerini AKTİF DİLDE döndürür
 *  (anında, API'siz). Uymuyorsa null → çağıran normal şehir aramasına devam eder. */
export function citiesOfCountry(q: string, lang: "tr" | "en" = "tr"): { name: string; country: string }[] | null {
  const f = fold(q.trim());
  if (f.length < 3) return null;
  const hit = COUNTRIES.find((c) => c.aliases.some((a) => a.startsWith(f) || f === a));
  if (!hit) return null;
  const country = lang === "en" ? hit.en : hit.tr;
  return hit.cities.map((c) => ({ name: cityDisplay(c, lang), country }));
}

/** Servisin norm_city kanoniğiyle aynı anahtar: Türkçe karakterler ASCII'ye
 *  (Münih→Munih) — DB city kolonu ve filtreler her iki uçta aynı kalır. */
export const canonKey = (s: string) =>
  s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) =>
    ({ "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u",
       "Ç": "C", "Ğ": "G", "İ": "I", "Ö": "O", "Ş": "S", "Ü": "U" }[c] ?? c));

export function searchProvinces(q: string, limit = 8): typeof PROVINCES {
  const f = fold(q.trim());
  if (!f) return [];
  return PROVINCES.filter((p) => fold(p.label).includes(f)).slice(0, limit);
}

// Tüm-Türkiye: "Konumumdan bul" ile gelen iller sabit listede yoktur — burada
// kalıcı kayda alınır (harita bölgesi = algılanan konum çevresi). AI o ilde üretir.
const DYN_KEY = "sana_city_dyn_v1";
let DYN: Record<string, CityInfo> = {};
AsyncStorage.getItem(DYN_KEY).then((s) => {
  if (s) DYN = { ...JSON.parse(s), ...DYN };
}).catch(() => { /* yoksay */ });

export async function registerCity(key: string, label: string, lat: number, lng: number): Promise<void> {
  if (CITIES.some((c) => c.key === key)) return;
  DYN[key] = {
    key, label,
    region: { latitude: lat, longitude: lng, latitudeDelta: 0.18, longitudeDelta: 0.18 },
    districts: [],
  };
  try { await AsyncStorage.setItem(DYN_KEY, JSON.stringify(DYN)); } catch { /* yoksay */ }
}

export function dynCities(): CityInfo[] {
  return Object.values(DYN);
}

/** Kullanıcının eklediği şehri listeden kaldırır (6 pilot silinemez). */
export async function unregisterCity(key: string): Promise<void> {
  if (CITIES.some((c) => c.key === key)) return;
  delete DYN[key];
  try { await AsyncStorage.setItem(DYN_KEY, JSON.stringify(DYN)); } catch { /* yoksay */ }
}

export function cityInfo(key: string): CityInfo {
  return CITIES.find((c) => c.key === key) ?? DYN[key] ?? CITIES[0];
}

const KEY = "sana_city_v1";

export async function getActiveCity(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(KEY)) ?? "Istanbul";
  } catch {
    return "Istanbul";
  }
}

/** Kullanıcı hiç şehir seçti mi? null = hiç seçmedi (ilk açılışta seçici otomatik açılır). */
export async function getChosenCity(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function setActiveCity(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, key);
  } catch { /* yoksay */ }
}
