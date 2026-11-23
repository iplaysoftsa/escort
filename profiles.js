const kznAreas = [
  "Pietermaritzburg", "Ballito", "Richards Bay", "Pinetown", "Amanzimtoti",
  "Westville", "La Lucia", "Newcastle", "Ladysmith", "Durban Central",
  "Howick", "Margate", "Hillcrest", "Kloof", "Empangeni", "Stanger",
  "Umdloti", "Port Shepstone", "Mount Edgecombe"
];

const sourceProfiles = [
  { name: "Thandi", image: "1000200860.jpg", area: "Umhlanga" },
  { name: "Naledi", image: "1000424206.webp", area: "Morningside" },
  { name: "Ayesha", area: "Ballito" },
  { name: "Zee", image: "1000439607.jpg", area: "Umhlanga" },
  { name: "Lerato", image: "14041639_002_b0e8.jpg", area: "Durban North" },
  { name: "Sino", image: "14520427_142_0b63.jpg", area: "Glenwood" },
  { name: "Zinhle", image: "181thuom-768x1025.jpeg" },
  { name: "Mia", image: "24678312_146_4298.jpg" },
  { name: "Nandi", image: "57292313_049_fd95.jpg" },
  { name: "Ayanda", image: "59862709_115_b7d1.jpg" },
  { name: "Thuli", image: "5rlw2qju.jpeg" },
  { name: "Nomsa" },
  { name: "Kiara", image: "97916886_325_b4a6.jpg" },
  { name: "Lindiwe", image: "G4eo8ezWYAAKKdf-768x1024.jpg" },
  { name: "Zodwa", image: "GZgcKwTWAAMNsvO.jpeg" },
  { name: "Amahle", image: "Happy-1.jpeg" },
  { name: "Tumi", image: "Happy-3-768x1025.jpeg" },
  { name: "Lulu", image: "j8gmaq51.jpeg" },
  { name: "Noxolo", image: "mane.webp" },
  { name: "Milly", image: "Milly-Shades-4-768x1216.jpeg" },
  { name: "Jade", image: "Ms.juicy-p-Hooot-14-768x1024.jpeg" },
  { name: "Sindi", image: "Ms.juicy-p-Hooot-5-768x1089.jpeg" },
  { name: "Palesa", image: "mvqhxpol.jpeg" },
  { name: "Zama", image: "photo_6050696497667884261_w-768x1024.jpg" },
  { name: "Lola", image: "Tatooed-lady-2-768x1024.jpg" }
];

export const defaultProfiles = sourceProfiles.map((profile, index) => {
  const image = profile.image ? `ximg/${profile.image}` : "";
  return {
    ...profile,
    area: profile.area || kznAreas[(index - 6) % kznAreas.length],
    rate: "From R500 /hr",
    bio: "",
    image,
    gallery: image ? [image] : [],
    status: "check",
    order: index
  };
});

export const profileImageUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return "";
  const image = value.trim();
  if (/^https:\/\/[^\s"'<>]+$/i.test(image)) return image;
  if (/^ximg\/[A-Za-z0-9._-]+$/.test(image)) return image;
  if (/^[A-Za-z0-9._-]+$/.test(image)) return `ximg/${image}`;
  return "";
};

export const profileThumbnailUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return "";
  const thumbnail = value.trim();
  if (
    thumbnail.length <= 50 * 1024
    && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(thumbnail)
  ) return thumbnail;
  return profileImageUrl(thumbnail);
};

export const profileRate = (profile) => {
  const amount = profile?.rateAmount;
  return Number.isSafeInteger(amount) && amount >= 100
    ? `R${new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(amount)} /hr`
    : String(profile?.rate || "Ask for rates");
};

export const profileId = (name) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const normalizeWhatsAppNumber = (value) => {
  const rawDigits = String(value ?? "").replace(/\D/g, "");
  const digits = rawDigits.startsWith("00") ? rawDigits.slice(2) : rawDigits;
  if (digits.length < 8 || digits.length > 15) return "";
  const normalized = digits.startsWith("0") ? `27${digits.slice(1)}` : digits;
  return normalized.length <= 15 ? normalized : "";
};

export const profileWhatsAppUrl = (profile) => {
  const number = normalizeWhatsAppNumber(profile?.whatsappNumber) || "27617250994";
  const name = String(profile?.name || "this companion").trim();
  const area = String(profile?.area || "").trim();
  const message = `Hi ${name}, I saw your Red Room profile${area ? ` in ${area}` : ""}. Are you available? Please share your current rate and booking details.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
};
