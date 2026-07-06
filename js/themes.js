/**
 * Theme management - subtle picker with dropdown menu.
 */
const Themes = {
  themes: [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
    { id: "high-contrast", label: "High contrast" },
    { id: "corporate", label: "Corporate" }
  ],

  apply(theme) {
    const t = this.themes.some((item) => item.id === theme) ? theme : "light";
    document.documentElement.setAttribute("data-theme", t);
    Storage.setTheme(t);
    document.querySelectorAll("[data-theme-btn]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.themeBtn === t);
    });
  },

  init() {
    this.apply(Storage.getTheme());
    this.bindPickers();
  },

  bindPickers() {
    document.querySelectorAll(".theme-picker").forEach((picker) => {
      const toggle = picker.querySelector(".theme-picker-toggle");
      const menu = picker.querySelector(".theme-picker-menu");
      if (!toggle || !menu) return;

      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = !menu.hidden;
        this.closeAllMenus();
        menu.hidden = isOpen;
        toggle.setAttribute("aria-expanded", String(!isOpen));
      });

      menu.querySelectorAll("[data-theme-btn]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.apply(btn.dataset.themeBtn);
          menu.hidden = true;
          toggle.setAttribute("aria-expanded", "false");
        });
      });
    });

    document.addEventListener("click", () => this.closeAllMenus());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeAllMenus();
    });
  },

  closeAllMenus() {
    document.querySelectorAll(".theme-picker-menu").forEach((menu) => {
      menu.hidden = true;
    });
    document.querySelectorAll(".theme-picker-toggle").forEach((toggle) => {
      toggle.setAttribute("aria-expanded", "false");
    });
  }
};

if (typeof window !== "undefined") {
  window.Themes = Themes;
}
