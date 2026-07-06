/**
 * Login page controller.
 */
const Login = {
  init() {
    Themes.init();

    if (Session.isLoggedIn()) {
      if (Storage.isCaseSetupComplete()) {
        window.location.href = "index.html";
      } else {
        window.location.href = "case.html";
      }
      return;
    }

    const remembered = Storage.getRememberedEmployeeId();
    const input = document.getElementById("employeeId");
    const rememberCheckbox = document.getElementById("rememberMe");

    if (remembered) {
      input.value = remembered;
      rememberCheckbox.checked = true;
    }

    document.getElementById("loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleLogin();
    });
  },

  validateEmployeeId(id) {
    const trimmed = (id || "").trim();
    if (!trimmed) return "Employee ID is required.";
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
      return "Employee ID may only contain letters, numbers, dots, dashes, and underscores.";
    }
    if (trimmed.length > 50) return "Employee ID is too long.";
    return null;
  },

  showError(msg) {
    const el = document.getElementById("loginError");
    el.textContent = msg;
    el.hidden = !msg;
  },

  async handleLogin() {
    const input = document.getElementById("employeeId");
    const remember = document.getElementById("rememberMe").checked;
    const employeeId = input.value.trim();

    const error = this.validateEmployeeId(employeeId);
    if (error) {
      this.showError(error);
      return;
    }

    this.showError("");
    Session.login(employeeId, remember);
    Logger.init(employeeId);
    await Logger.logLogin(employeeId);

    window.location.href = "case.html";
  }
};

document.addEventListener("DOMContentLoaded", () => Login.init());
