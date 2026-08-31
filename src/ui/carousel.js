export function nextSlideIndex(current, count, direction = 1) {
  return (current + direction + count) % count;
}

export function initCarousel(root) {
  const slides = [...root.querySelectorAll("[data-slide]")];
  const dots = root.querySelector(".hero-dots");
  let active = 0;

  function show(index) {
    active = index;
    slides.forEach((slide, slideIndex) => {
      const selected = slideIndex === active;
      slide.classList.toggle("is-active", selected);
      slide.setAttribute("aria-hidden", String(!selected));
    });
    [...dots.children].forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === active);
      dot.setAttribute("aria-current", dotIndex === active ? "true" : "false");
    });
  }

  slides.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Показать баннер ${index + 1}`);
    dot.addEventListener("click", () => show(index));
    dots.append(dot);
  });
  root.querySelector("[aria-label='Следующий баннер']").addEventListener("click", () => show(nextSlideIndex(active, slides.length)));
  root.querySelector("[aria-label='Предыдущий баннер']").addEventListener("click", () => show(nextSlideIndex(active, slides.length, -1)));
  show(0);
}
