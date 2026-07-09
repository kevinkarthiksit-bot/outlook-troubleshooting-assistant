/**
 * Shared UI helpers for org KB and troubleshooting hub pages.
 */
const HubUi = {
  CATEGORY_ACCENTS: {
    email: "#0078d4",
    copilot: "#8764b8",
    "email-security": "#c239b3",
    "shared-mailboxes": "#008272",
    "archive-storage": "#797775",
    "mobile-owa": "#00b7c3",
    "new-outlook": "#4f6bed",
    calendar: "#107c10",
    search: "#ca5010",
    authentication: "#d13438",
    "connectivity-sync": "#0078d4",
    "send-receive": "#038387",
    "performance-stability": "#5c2d91"
  },

  CARD_DISPLAY_LIMIT: 6,

  getVisibleResults(results, options = {}) {
    const limit = options.limit ?? this.CARD_DISPLAY_LIMIT;
    if (results.length <= limit) {
      return { visible: results, limited: false, hiddenCount: 0 };
    }
    return {
      visible: results.slice(0, limit),
      limited: true,
      hiddenCount: results.length - limit
    };
  },

  categorySlug(category) {
    return (category || "other")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "other";
  },

  getCategoryAccent(category) {
    const slug = this.categorySlug(category);
    return this.CATEGORY_ACCENTS[slug] || "#607d8b";
  },

  applyCategory(el, category) {
    if (!el || !category) return;
    const slug = this.categorySlug(category);
    el.dataset.cat = slug;
    el.style.setProperty("--cat-accent", this.getCategoryAccent(category));
  },

  renderSessionBadges(container, details) {
    if (!container) return;
    const ims = (details?.chatIms || "").trim() || "N/A";
    const platform = details?.platform || "N/A";
    const environment = details?.environment || "N/A";
    container.className = "session-summary session-badges";
    container.innerHTML =
      '<span class="session-badge"><span class="session-badge-label">IMS</span>' +
      this.escape(ims) +
      "</span>" +
      '<span class="session-badge"><span class="session-badge-label">Platform</span>' +
      this.escape(platform) +
      "</span>" +
      '<span class="session-badge"><span class="session-badge-label">Environment</span>' +
      this.escape(environment) +
      "</span>";
  },

  updateResultCount(container, options) {
    if (!container) return;
    const displayed = options.displayed ?? options.count ?? 0;
    const total = options.total ?? displayed;
    const query = (options.query || "").trim();
    const noun = options.noun || "results";
    const singular = options.singular || noun.replace(/s$/, "");

    let text;
    if (query) {
      text =
        displayed === 1
          ? '1 ' + singular + ' for <strong>"' + this.escape(query) + '"</strong>'
          : displayed + " " + noun + ' for <strong>"' + this.escape(query) + '"</strong>';
    } else if (options.limited && total > displayed) {
      text =
        "Showing <strong>" +
        displayed +
        "</strong> of <strong>" +
        total +
        "</strong> " +
        (total === 1 ? singular : noun);
    } else if (total && displayed === total) {
      text = "Showing all <strong>" + displayed + "</strong> " + (displayed === 1 ? singular : noun);
    } else {
      text =
        "Showing <strong>" +
        displayed +
        "</strong> of <strong>" +
        total +
        "</strong> " +
        (total === 1 ? singular : noun);
    }

    container.innerHTML = text;
    container.hidden = false;
  },

  buildSymptomTagsHtml(symptoms, max, escapeFn) {
    const esc = escapeFn || ((s) => s);
    const list = (symptoms || []).filter(Boolean).slice(0, max || 3);
    if (!list.length) return "";
    return (
      '<div class="symptom-tags">' +
      list
        .map((s) => '<span class="symptom-tag">' + esc(s) + "</span>")
        .join("") +
      "</div>"
    );
  },

  escape(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  },

  renderShowAllButton(parent, options = {}) {
    if (!parent) return;
    let btn = parent.querySelector(".show-all-btn");
    if (!options.limited || !options.hiddenCount) {
      if (btn) btn.hidden = true;
      return;
    }
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-secondary show-all-btn";
      const grid = parent.querySelector(".result-grid");
      if (grid?.nextSibling) {
        parent.insertBefore(btn, grid.nextSibling);
      } else {
        parent.appendChild(btn);
      }
    }
    btn.hidden = false;
    btn.textContent = "Show all (" + options.hiddenCount + " more)";
    btn.onclick = options.onShowAll;
  }
};

if (typeof window !== "undefined") {
  window.HubUi = HubUi;
}
