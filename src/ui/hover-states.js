export function initHoverStates(root = document) {
  root.querySelectorAll(".service-card, .product-card").forEach((card) => {
    card.addEventListener("pointerenter", () => card.classList.add("is-hovered"));
    card.addEventListener("pointerleave", () => card.classList.remove("is-hovered"));
  });
}
