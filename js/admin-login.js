/**
 * Admin login page controller.
 */
const AdminLogin = {
  init() {
    if (AdminAuth.isAuthenticated()) {
      window.location.href = "admin.html";
      return;
    }

    document.getElementById("adminLoginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleLogin();
    });
  },

  showError(msg) {
    const el = document.getElementById("adminLoginError");
    el.textContent = msg;
    el.hidden = !msg;
  },

  handleLogin() {
    const username = document.getElementById("adminUsername").value.trim();
    const password = document.getElementById("adminPassword").value;

    if (!username || !password) {
      this.showError("Username and password are required.");
      return;
    }

    if (AdminAuth.login(username, password)) {
      this.showError("");
      window.location.href = "admin.html";
      return;
    }

    this.showError("Invalid username or password.");
  }
};

document.addEventListener("DOMContentLoaded", () => AdminLogin.init());
