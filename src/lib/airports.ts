export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  country_ar?: string;
}

export const AIRPORTS: Airport[] = [
  // Indonesia
  { iata: "CGK", name: "Soekarno-Hatta International Airport", city: "Jakarta", country: "Indonesia", country_ar: "إندونيسيا" },
  { iata: "SUB", name: "Juanda International Airport", city: "Surabaya", country: "Indonesia", country_ar: "إندونيسيا" },
  { iata: "DPS", name: "I Gusti Ngurah Rai International Airport", city: "Denpasar (Bali)", country: "Indonesia", country_ar: "إندونيسيا" },
  { iata: "KNO", name: "Kualanamu International Airport", city: "Medan", country: "Indonesia", country_ar: "إندونيسيا" },
  { iata: "YIA", name: "Yogyakarta International Airport", city: "Yogyakarta", country: "Indonesia", country_ar: "إندونيسيا" },
  { iata: "UPG", name: "Sultan Hasanuddin International Airport", city: "Makassar", country: "Indonesia", country_ar: "إندونيسيا" },
  { iata: "PDG", name: "Minangkabau International Airport", city: "Padang", country: "Indonesia", country_ar: "إندونيسيا" },
  { iata: "PLM", name: "Sultan Mahmud Badaruddin II", city: "Palembang", country: "Indonesia", country_ar: "إندونيسيا" },
  { iata: "SOC", name: "Adi Soemarmo International Airport", city: "Solo / Surakarta", country: "Indonesia", country_ar: "إندونيسيا" },
  { iata: "SRG", name: "Jenderal Ahmad Yani International", city: "Semarang", country: "Indonesia", country_ar: "إندونيسيا" },
  { iata: "BTH", name: "Hang Nadim International Airport", city: "Batam", country: "Indonesia", country_ar: "إندونيسيا" },
  { iata: "BPN", name: "Sultan Aji Muhammad Sulaiman Sepinggan", city: "Balikpapan", country: "Indonesia", country_ar: "إندونيسيا" },
  { iata: "BDJ", name: "Syamsudin Noor International Airport", city: "Banjarmasin", country: "Indonesia", country_ar: "إندونيسيا" },

  // Malaysia & Southeast Asia
  { iata: "KUL", name: "Kuala Lumpur International Airport", city: "Kuala Lumpur", country: "Malaysia", country_ar: "ماليزيا" },
  { iata: "PEN", name: "Penang International Airport", city: "Penang", country: "Malaysia", country_ar: "ماليزيا" },
  { iata: "BKI", name: "Kota Kinabalu International Airport", city: "Sabah", country: "Malaysia", country_ar: "ماليزيا" },
  { iata: "BKK", name: "Suvarnabhumi Airport", city: "Bangkok", country: "Thailand", country_ar: "تايلاند" },
  { iata: "DMK", name: "Don Mueang International Airport", city: "Bangkok", country: "Thailand", country_ar: "تايلاند" },
  { iata: "HKT", name: "Phuket International Airport", city: "Phuket", country: "Thailand", country_ar: "تايلاند" },
  { iata: "MNL", name: "Ninoy Aquino International Airport", city: "Manila", country: "Philippines", country_ar: "الفلبين" },
  { iata: "CEB", name: "Mactan-Cebu International Airport", city: "Cebu", country: "Philippines", country_ar: "الفلبين" },
  { iata: "SIN", name: "Singapore Changi Airport", city: "Singapore", country: "Singapore", country_ar: "سنغافورة" },

  // South Asia
  { iata: "ISB", name: "Islamabad International Airport", city: "Islamabad", country: "Pakistan", country_ar: "باكستان" },
  { iata: "LHE", name: "Allama Iqbal International Airport", city: "Lahore", country: "Pakistan", country_ar: "باكستان" },
  { iata: "KHI", name: "Jinnah International Airport", city: "Karachi", country: "Pakistan", country_ar: "باكستان" },
  { iata: "PEW", name: "Bacha Khan International Airport", city: "Peshawar", country: "Pakistan", country_ar: "باكستان" },
  { iata: "DEL", name: "Indira Gandhi International Airport", city: "New Delhi", country: "India", country_ar: "الهند" },
  { iata: "BOM", name: "Chhatrapati Shivaji Maharaj International", city: "Mumbai", country: "India", country_ar: "الهند" },
  { iata: "CCJ", name: "Calicut International Airport", city: "Kozhikode", country: "India", country_ar: "الهند" },
  { iata: "COK", name: "Cochin International Airport", city: "Kochi", country: "India", country_ar: "الهند" },
  { iata: "HYD", name: "Rajiv Gandhi International Airport", city: "Hyderabad", country: "India", country_ar: "الهند" },
  { iata: "DAC", name: "Hazrat Shahjalal International Airport", city: "Dhaka", country: "Bangladesh", country_ar: "بنغلاديش" },
  { iata: "CGP", name: "Shah Amanat International Airport", city: "Chittagong", country: "Bangladesh", country_ar: "بنغلاديش" },

  // Middle East & Africa
  { iata: "CAI", name: "Cairo International Airport", city: "Cairo", country: "Egypt", country_ar: "مصر" },
  { iata: "HBE", name: "Borg El Arab Airport", city: "Alexandria", country: "Egypt", country_ar: "مصر" },
  { iata: "ATZ", name: "Assiut Airport", city: "Assiut", country: "Egypt", country_ar: "مصر" },
  { iata: "ABV", name: "Nnamdi Azikiwe International Airport", city: "Abuja", country: "Nigeria", country_ar: "نيجيريا" },
  { iata: "LOS", name: "Murtala Muhammed International Airport", city: "Lagos", country: "Nigeria", country_ar: "نيجيريا" },
  { iata: "KAN", name: "Mallam Aminu Kano International Airport", city: "Kano", country: "Nigeria", country_ar: "نيجيريا" },
  { iata: "KRT", name: "Khartoum International Airport", city: "Khartoum", country: "Sudan", country_ar: "السودان" },
  { iata: "PZU", name: "Port Sudan New International Airport", city: "Port Sudan", country: "Sudan", country_ar: "السودان" },
  { iata: "AMM", name: "Queen Alia International Airport", city: "Amman", country: "Jordan", country_ar: "الأردن" },
  { iata: "ADE", name: "Aden International Airport", city: "Aden", country: "Yemen", country_ar: "اليمن" },
  { iata: "CMN", name: "Mohammed V International Airport", city: "Casablanca", country: "Morocco", country_ar: "المغرب" },
  { iata: "TUN", name: "Tunis-Carthage International Airport", city: "Tunis", country: "Tunisia", country_ar: "تونس" },
  { iata: "ALG", name: "Houari Boumediene Airport", city: "Algiers", country: "Algeria", country_ar: "الجزائر" },
  { iata: "IST", name: "Istanbul Airport", city: "Istanbul", country: "Turkey", country_ar: "تركيا" },
  { iata: "SAW", name: "Sabiha Gokcen International Airport", city: "Istanbul", country: "Turkey", country_ar: "تركيا" },

  // Europe & Americas
  { iata: "LHR", name: "Heathrow Airport", city: "London", country: "United Kingdom", country_ar: "المملكة المتحدة" },
  { iata: "CDG", name: "Charles de Gaulle Airport", city: "Paris", country: "France", country_ar: "فرنسا" },
  { iata: "FRA", name: "Frankfurt Airport", city: "Frankfurt", country: "Germany", country_ar: "ألمانيا" },
  { iata: "JFK", name: "John F. Kennedy International Airport", city: "New York", country: "United States", country_ar: "الولايات المتحدة" },
];

export function formatAirportLabel(airport: Airport, lang: "ar" | "en" = "en"): string {
  const countryName = lang === "ar" && airport.country_ar ? airport.country_ar : airport.country;
  return `${airport.iata} - ${airport.city}, ${countryName} (${airport.name})`;
}
