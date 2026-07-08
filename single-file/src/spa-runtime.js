/**
 * SPA runtime for single-file Outlook Assistant build.
 */
const SPA = {
  _query: new URLSearchParams(),

  routes: {},

  routeFromPage(url) {
    if (!url) return "login";
    return String(url).replace(/\.html.*$/, "").replace(/^\//, "");
  },

  register(route, config) {
    this.routes[route] = config;
  },

  getQuery() {
    return this._query;
  },

  navigate(route, params) {
    if (typeof route === "string" && route.includes(".html")) {
      return this.navigateFromHref(route);
    }
    let qs = "";
    if (params instanceof URLSearchParams) {
      qs = params.toString();
    } else if (params && typeof params === "object") {
      qs = new URLSearchParams(params).toString();
    }
    location.hash = "#" + route + (qs ? "?" + qs : "");
  },

  navigateFromHref(href) {
    const clean = String(href).replace(/^\.\//, "");
    const [file, qs] = clean.split("?");
    const route = file.replace(/\.html$/i, "");
    location.hash = "#" + route + (qs ? "?" + qs : "");
  },

  parseHash() {
    let h = (location.hash || "").slice(1) || "case";
    if (h.startsWith("/")) h = h.slice(1);
    const [route, qs] = h.split("?");
    this._query = new URLSearchParams(qs || "");
    return route || "login";
  },

  installLinkInterceptor() {
    document.addEventListener(
      "click",
      (e) => {
        const a = e.target.closest("a[href]");
        if (!a) return;
        const href = a.getAttribute("href") || "";
        // Bare "#" clears the SPA hash and drops users onto case setup.
        if (href === "#" || href === "") {
          e.preventDefault();
          return;
        }
        if (a.target === "_blank" || /^https?:\/\//i.test(href) || href.startsWith("mailto:")) {
          return;
        }
        if (/\.html(\?|$)/i.test(href)) {
          e.preventDefault();
          this.navigateFromHref(href);
        }
      },
      true
    );
  },

  getTemplateHtml(tplEl) {
    if (!tplEl) return "";
    if (tplEl.tagName === "TEMPLATE") {
      return tplEl.innerHTML;
    }
    return tplEl.textContent || tplEl.innerHTML || "";
  },

  async render() {
    const route = this.parseHash();
    const cfg = this.routes[route];
    if (!cfg) {
      location.hash = "#case";
      return;
    }

    document.title = (cfg.title || "Outlook Assistant") + " - Outlook Troubleshooting Assistant";
    document.body.className = cfg.bodyClass || "";

    const tpl = document.getElementById(cfg.tpl);
    const mount = document.getElementById("spa-mount");
    if (!tpl || !mount) {
      console.error("SPA: missing template or mount for route", route);
      return;
    }

    mount.innerHTML = this.getTemplateHtml(tpl);

    if (typeof cfg.init === "function") {
      await cfg.init();
    }
  },

  start() {
    this.installLinkInterceptor();
    window.addEventListener("hashchange", () => this.render());
    if (!location.hash || location.hash === "#") {
      location.hash = "#case";
    }
    this.render();
  }
};

if (typeof window !== "undefined") {
  window.SPA = SPA;
}
