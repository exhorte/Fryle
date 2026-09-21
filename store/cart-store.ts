import { create } from "zustand";
import { persist } from "zustand/middleware";

// Panier côté navigateur, à des fins d'affichage uniquement.
// Le serveur ne reçoit que { productId, quantity } : prix, total et stock sont relus en base.
export interface CartItem {
  id: string; // identifiant du produit en base
  name: string;
  price: number; // centimes, affichage seulement
  currency: string;
  imageUrl: string | null;
  quantity: number;
}

interface CartStore {
  // Identifie ce panier auprès du serveur : évite plusieurs sessions Stripe pour un même panier.
  cartId: string;
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      cartId: crypto.randomUUID(),
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === item.id);

          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i,
              ),
            };
          }

          return { items: [...state.items, item] };
        }),

      removeItem: (id) =>
        set((state) => ({
          items: state.items
            .map((item) => (item.id === id ? { ...item, quantity: item.quantity - 1 } : item))
            .filter((item) => item.quantity > 0),
        })),

      // Une commande terminée : nouveau panier, nouvel identifiant.
      clearCart: () => set({ items: [], cartId: crypto.randomUUID() }),
    }),
    {
      name: "cart",
      // v2 : les produits viennent désormais de la base (anciens ids Stripe « prod_… » invalides).
      version: 2,
      migrate: () => ({ items: [], cartId: crypto.randomUUID() }),
    },
  ),
);
