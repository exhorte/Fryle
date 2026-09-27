// Identité et politique commerciale de Fryle.
//
// ⚠ Les engagements ci-dessous (retours, garantie, assistance) sont affichés aux clients :
//   adaptez-les à vos conditions réelles avant la mise en ligne. La livraison, elle, est
//   calculée à partir de la configuration serveur (SHIPPING_*), jamais écrite en dur.

export const siteConfig = {
  name: "Fryle",
  tagline: "iPhone, Mac, Apple Watch et audio, livrés chez vous.",
  description:
    "Fryle, votre boutique d'appareils électroniques : iPhone, MacBook, Apple Watch, AirPods, casques et accessoires.",
  returnDays: 30,
  warrantyLabel: "Garantie 1 an",
  warrantyDetail: "Sur tous les appareils",
  /** Adresse d'assistance affichée dans le pied de page (NEXT_PUBLIC_SUPPORT_EMAIL). Masquée si absente. */
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || null,
} as const;
