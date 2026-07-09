/**
 * Live search suggestion dropdown for hub pages.
 */
const SearchSuggestions = {
  mount(inputEl, options = {}) {
    if (!inputEl) return null;

    let wrap = inputEl.parentElement;
    if (!wrap?.classList.contains("search-input-wrap")) {
      wrap = document.createElement("div");
      wrap.className = "search-input-wrap search-suggest-wrap";
      inputEl.parentNode.insertBefore(wrap, inputEl);
      wrap.appendChild(inputEl);
    }

    let listEl = wrap.querySelector(".search-suggestions");
    if (!listEl) {
      listEl = document.createElement("ul");
      listEl.className = "search-suggestions";
      listEl.setAttribute("role", "listbox");
      listEl.hidden = true;
      wrap.appendChild(listEl);
    }

    const state = {
      inputEl,
      listEl,
      items: [],
      activeIndex: -1,
      debounce: null,
      getSuggestions: options.getSuggestions,
      onSelect: options.onSelect,
      onSubmit: options.onSubmit
    };

    inputEl.setAttribute("role", "combobox");
    inputEl.setAttribute("aria-autocomplete", "list");
    inputEl.setAttribute("aria-expanded", "false");

    inputEl.addEventListener("input", () => {
      clearTimeout(state.debounce);
      state.debounce = setTimeout(() => this.refresh(state), 150);
    });

    inputEl.addEventListener("keydown", (e) => this.onKeyDown(state, e));

    document.addEventListener("click", (e) => {
      if (!wrap?.contains(e.target)) this.hide(state);
    });

    return state;
  },

  async refresh(state) {
    const q = state.inputEl.value.trim();
    if (q.length < 2) {
      this.hide(state);
      return;
    }
    const items = await state.getSuggestions(q);
    state.items = items || [];
    state.activeIndex = -1;
    this.render(state);
  },

  render(state) {
    const { listEl, items, inputEl } = state;
    if (!listEl) return;

    if (!items.length) {
      this.hide(state);
      return;
    }

    listEl.innerHTML = "";
    let lastGroup = null;
    items.forEach((item, index) => {
      const group = item.type === "kb" ? "kb" : "guide";
      if (group !== lastGroup) {
        const heading = document.createElement("li");
        heading.className = "search-suggestion-group";
        heading.setAttribute("role", "presentation");
        heading.textContent = group === "kb" ? "Org knowledge base" : "Troubleshooting guides";
        listEl.appendChild(heading);
        lastGroup = group;
      }

      const li = document.createElement("li");
      li.className = "search-suggestion-item";
      li.setAttribute("role", "option");
      li.dataset.index = String(index);
      const badge = item.badge || (item.type === "flow" ? "Flow" : item.type === "kb" ? "Org KB" : "Guide");
      const subtitle = item.subtitle || (item.symptoms?.[0] || item.category || "");
      li.innerHTML =
        '<span class="suggestion-badge suggestion-badge-' +
        this.badgeClass(item.type) +
        '">' +
        HubUi.escape(badge) +
        "</span>" +
        '<span class="suggestion-title">' +
        HubUi.escape(item.title) +
        "</span>" +
        (subtitle
          ? '<span class="suggestion-subtitle">' + HubUi.escape(subtitle) + "</span>"
          : "");
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.select(state, index);
      });
      listEl.appendChild(li);
    });

    listEl.hidden = false;
    inputEl.setAttribute("aria-expanded", "true");
  },

  badgeClass(type) {
    if (type === "kb") return "kb";
    if (type === "flow") return "flow";
    return "guide";
  },

  hide(state) {
    if (!state.listEl) return;
    state.listEl.hidden = true;
    state.listEl.innerHTML = "";
    state.items = [];
    state.activeIndex = -1;
    state.inputEl.setAttribute("aria-expanded", "false");
  },

  onKeyDown(state, e) {
    if (e.key === "ArrowDown") {
      if (!state.items.length) return;
      e.preventDefault();
      state.activeIndex = Math.min(state.activeIndex + 1, state.items.length - 1);
      this.highlight(state);
      return;
    }
    if (e.key === "ArrowUp") {
      if (!state.items.length) return;
      e.preventDefault();
      state.activeIndex = Math.max(state.activeIndex - 1, 0);
      this.highlight(state);
      return;
    }
    if (e.key === "Escape") {
      this.hide(state);
      return;
    }
    if (e.key === "Enter") {
      if (state.activeIndex >= 0 && state.items[state.activeIndex]) {
        e.preventDefault();
        e.stopPropagation();
        this.select(state, state.activeIndex);
        return;
      }
      if (state.onSubmit) {
        e.preventDefault();
        e.stopPropagation();
        this.hide(state);
        state.onSubmit(state.inputEl.value);
      }
    }
  },

  highlight(state) {
    const children = state.listEl?.querySelectorAll(".search-suggestion-item") || [];
    children.forEach((el, i) => {
      el.classList.toggle("active", i === state.activeIndex);
      if (i === state.activeIndex) el.scrollIntoView({ block: "nearest" });
    });
  },

  select(state, index) {
    const item = state.items[index];
    if (!item) return;
    state.inputEl.value = item.title || "";
    this.hide(state);
    if (state.onSelect) state.onSelect(item);
  }
};

if (typeof window !== "undefined") {
  window.SearchSuggestions = SearchSuggestions;
}
