export function initCatalogMenu() {
  const button = document.querySelector(".catalog-button");
  const menu = document.querySelector("#catalog-menu");
  const closeButton = menu.querySelector(".catalog-close");

  function setOpen(open) {
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("catalog-open", open);
  }

  button.addEventListener("click", () => setOpen(menu.hidden));
  closeButton.addEventListener("click", () => setOpen(false));
  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
  document.addEventListener("pointerdown", (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      setOpen(false);
      button.focus();
    }
  });
}
