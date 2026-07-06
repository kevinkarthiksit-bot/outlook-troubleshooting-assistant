/**
 * Route registration and bootstrap for single-file build.
 */
SPA.register("login", {
  tpl: "tpl-login",
  bodyClass: "login-page",
  title: "Login",
  async init() {
    ThemePicker.mount("#themePickerMount");
    Login.init();
  }
});

SPA.register("case", {
  tpl: "tpl-case",
  bodyClass: "login-page",
  title: "Case Setup",
  async init() {
    ThemePicker.mount("#themePickerMount");
    CaseSetup.init();
  }
});

SPA.register("index", {
  tpl: "tpl-index",
  bodyClass: "",
  title: "Org KB",
  async init() {
    await App.init();
  }
});

SPA.register("guide", {
  tpl: "tpl-guide",
  bodyClass: "",
  title: "KB Guide",
  async init() {
    await Guide.init();
  }
});

SPA.register("troubleshooting", {
  tpl: "tpl-troubleshooting",
  bodyClass: "",
  title: "Troubleshooting Guides",
  async init() {
    await TroubleshootingApp.init();
  }
});

SPA.register("troubleshooting-guide", {
  tpl: "tpl-troubleshooting-guide",
  bodyClass: "",
  title: "Troubleshooting Guide",
  async init() {
    await TroubleshootingGuide.init();
  }
});

SPA.register("admin-login", {
  tpl: "tpl-admin-login",
  bodyClass: "login-page",
  title: "Admin Login",
  async init() {
    ThemePicker.mount("#themePickerMount");
    AdminLogin.init();
  }
});

SPA.register("admin", {
  tpl: "tpl-admin",
  bodyClass: "",
  title: "Admin",
  async init() {
    if (!window.XLSX) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
        s.onload = resolve;
        s.onerror = () => reject(new Error("SheetJS CDN unavailable"));
        document.head.appendChild(s);
      }).catch((err) => console.warn("Admin Excel upload unavailable:", err));
    }
    await Admin.init();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  Themes.init();
  SPA.start();
});
