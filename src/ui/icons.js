import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  CircleCheck,
  CircleDot,
  Coins,
  createIcons,
  Ellipsis,
  Gem,
  Heart,
  KeyRound,
  PackageOpen,
  Search,
  ShoppingBag,
  UserRound,
  X,
  Zap,
} from "lucide";

const icons = {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  CircleCheck,
  CircleDot,
  Coins,
  Ellipsis,
  Gem,
  Heart,
  KeyRound,
  PackageOpen,
  Search,
  ShoppingBag,
  UserRound,
  X,
  Zap,
};

export function renderIcons(root) {
  createIcons({
    icons,
    attrs: {
      "aria-hidden": "true",
      "stroke-width": 1.8,
    },
    ...(root ? { root } : {}),
  });
}
