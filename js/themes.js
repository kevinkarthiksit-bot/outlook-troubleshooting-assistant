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

  _eventsBound: false,

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
    if (this._eventsBound) return;
    this._eventsBound = true;

    document.addEventListener("click", (e) => {
      const themeBtn = e.target.closest(".theme-picker-menu [data-theme-btn]");
      if (themeBtn) {
        e.stopPropagation();
        this.apply(themeBtn.dataset.themeBtn);
        this.closeAllMenus();
        return;
      }

      const toggle = e.target.closest(".theme-picker-toggle");
      if (toggle) {
        e.stopPropagation();
        const menu = toggle.closest(".theme-picker")?.querySelector(".theme-picker-menu");
        if (!menu) return;
        const willOpen = menu.hidden;
        this.closeAllMenus();
        menu.hidden = !willOpen;
        toggle.setAttribute("aria-expanded", String(willOpen));
        return;
      }

      if (!e.target.closest(".theme-picker")) {
        this.closeAllMenus();
      }
    });

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
