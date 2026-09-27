import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MAX_QUANTITY_PER_PRODUCT } from "@/lib/limits";

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
  /** Ajoute (ou cumule) une quantité, plafonnée à MAX_QUANTITY_PER_PRODUCT. */
  addItem: (item: CartItem) => void;
  /** Retire une unité ; la ligne disparaît à zéro. */
  removeItem: (id: string) => void;
  /** Supprime toute la ligne. */
  removeLine: (id: string) => void;
  clearCart: () => void;
}

const clamp = (quantity: number) => Math.max(0, Math.min(quantity, MAX_QUANTITY_PER_PRODUCT));

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
              items: state.items.map((i) => (i.id === item.id ? { ...i, quantity: clamp(i.quantity + item.quantity) } : i)),
            };
          }
          return { items: [...state.items, { ...item, quantity: clamp(item.quantity) }] };
        }),

      removeItem: (id) =>
        set((state) => ({
          items: state.items
            .map((item) => (item.id === id ? { ...item, quantity: item.quantity - 1 } : item))
            .filter((item) => item.quantity > 0),
        })),

      removeLine: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),

      // Une commande terminée : nouveau panier, nouvel identifiant.
      clearCart: () => set({ items: [], cartId: crypto.randomUUID() }),
    }),
    {
      name: "cart",
      // v3 : nouveau catalogue Fryle (les produits des versions précédentes n'existent plus).
      version: 3,
      migrate: () => ({ items: [], cartId: crypto.randomUUID() }),
    },
  ),
);

/** État d'affichage du tiroir panier (non persisté). */
export const useCartDrawer = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
