/* =========================================================================
   Paper — Docs Page Script
   - Mode toggle (User Manual ↔ Contribute), persisted in localStorage
   - Sidebar collapse / expand
   - Sidebar search filter (active mode + cross-mode hint)
   - Reading progress bar
   - Dark / light theme toggle (data-theme on <html>)
   - Smooth scroll to anchors
   - Mobile hamburger drawer + body-scroll lock
   - Active section highlight via IntersectionObserver
   - URL fragment sync (debounced) and deep-link mode auto-switch
   - Optional copy buttons for code blocks
   ========================================================================= */

(function () {
  /* -------------------------------------------------------------------- */
  /* Early theme application — runs synchronously to avoid FOUC          */
  /* -------------------------------------------------------------------- */
  try {
    // Default to light. Honour user's saved preference if they've toggled before;
    // otherwise ignore OS prefers-color-scheme so first-time visitors always
    // land on the light theme.
    var saved = localStorage.getItem("paper-theme");
    var theme = saved === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (_) { /* localStorage may be unavailable */ }
})();

document.addEventListener("DOMContentLoaded", function () {

  /* ===== Constants & helpers ========================================= */
  var MODE_KEY = "docs.mode";
  var THEME_KEY = "paper-theme";
  var MODES = ["user-manual", "contribute"];
  var DEFAULT_MODE = "user-manual";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ===== Theme toggle ================================================ */
  (function themeToggle() {
    var btn  = $("#themeToggle");
    var sun  = $("#iconSun");
    var moon = $("#iconMoon");

    function apply(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
      if (sun && moon) {
        sun.style.display  = theme === "dark"  ? "block" : "none";
        moon.style.display = theme === "light" ? "block" : "none";
      }
      if (btn) btn.setAttribute("aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }

    apply(document.documentElement.getAttribute("data-theme") || "light");

    if (btn) {
      btn.addEventListener("click", function () {
        var current = document.documentElement.getAttribute("data-theme") || "light";
        apply(current === "dark" ? "light" : "dark");
      });
    }
  })();

  /* ===== Reading progress bar ======================================= */
  (function progressBar() {
    var fill = $("#readProgress");
    if (!fill) return;
    var update = function () {
      var total = document.documentElement.scrollHeight - window.innerHeight;
      var pct   = total > 0 ? (window.scrollY / total) * 100 : 0;
      fill.style.width = pct.toFixed(2) + "%";
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  })();

  /* ===== Back-to-top button ========================================= */
  (function backTop() {
    var btn = $("#backTop");
    if (!btn) return;
    window.addEventListener("scroll", function () {
      btn.classList.toggle("visible", window.scrollY > 480);
    }, { passive: true });
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  })();

  /* ===== Mode toggle ================================================ */
  var modeTabs    = $$(".mode-tab");
  var modePanels  = $$(".docs-mode-panel");
  var sidebarNavs = $$(".sidebar-nav");
  var currentMode = readInitialMode();

  function readInitialMode() {
    // 1. URL hash takes precedence
    var hash = (location.hash || "").replace(/^#/, "");
    if (hash) {
      var fromHash = modeFromSectionId(hash);
      if (fromHash) return fromHash;
    }
    // 2. localStorage
    try {
      var stored = localStorage.getItem(MODE_KEY);
      if (stored && MODES.indexOf(stored) !== -1) return stored;
    } catch (_) {}
    return DEFAULT_MODE;
  }

  function modeFromSectionId(id) {
    if (!id) return null;
    if (id.indexOf("um-") === 0) return "user-manual";
    if (id.indexOf("cg-") === 0) return "contribute";
    return null;
  }

  function applyMode(mode, opts) {
    opts = opts || {};
    if (MODES.indexOf(mode) === -1) mode = DEFAULT_MODE;
    currentMode = mode;

    // Tabs
    modeTabs.forEach(function (tab) {
      var on = tab.dataset.mode === mode;
      tab.classList.toggle("active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.setAttribute("tabindex", on ? "0" : "-1");
    });

    // Panels
    modePanels.forEach(function (panel) {
      var on = panel.dataset.mode === mode;
      if (on) panel.removeAttribute("hidden");
      else    panel.setAttribute("hidden", "");
    });

    // Sidebars
    sidebarNavs.forEach(function (nav) {
      var on = nav.dataset.mode === mode;
      if (on) nav.removeAttribute("hidden");
      else    nav.setAttribute("hidden", "");
    });

    // Persist
    try { localStorage.setItem(MODE_KEY, mode); } catch (_) {}

    // Re-run search filter & active-section observer for the newly visible nav
    runSearchFilter();
    refreshObservedSections();

    if (opts.scrollTop) {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    }
  }

  modeTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      applyMode(tab.dataset.mode, { scrollTop: true });
    });
    // Keyboard arrow nav between tabs
    tab.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      var idx  = modeTabs.indexOf(tab);
      var next = (e.key === "ArrowRight" ? idx + 1 : idx - 1 + modeTabs.length) % modeTabs.length;
      modeTabs[next].focus();
      applyMode(modeTabs[next].dataset.mode, { scrollTop: false });
    });
  });

  /* ===== Sidebar group collapse ===================================== */
  $$(".sidebar-group-label").forEach(function (label) {
    function toggle() {
      var group = label.closest(".sidebar-group");
      if (!group) return;
      var open  = group.classList.toggle("open");
      label.setAttribute("aria-expanded", open ? "true" : "false");
      var items = group.querySelector(".sidebar-items");
      if (items) items.classList.toggle("hidden", !open);
    }
    label.addEventListener("click", function (e) {
      // Allow clicks on the inner anchor to navigate normally if it has a real href
      var anchor = e.target.closest(".sidebar-group-anchor");
      if (anchor && anchor.getAttribute("href") && anchor.getAttribute("href") !== "#") {
        // Anchor click navigates; don't toggle. Smooth-scroll handler below picks it up.
        return;
      }
      toggle();
    });
    label.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });

  /* ===== Sidebar search ============================================= */
  var searchInput  = $("#sidebarSearch");
  var crossHint    = $("#sidebarCrossHint");
  var crossHintTxt = $("#sidebarCrossHintText");
  var emptyMsg     = $("#sidebarEmpty");

  function countMatchesIn(navEl, q) {
    if (!navEl) return 0;
    var n = 0;
    $$(".sidebar-link", navEl).forEach(function (link) {
      var text = (link.textContent || "").toLowerCase();
      if (text.indexOf(q) !== -1) n++;
    });
    return n;
  }

  function applyFilterTo(navEl, q) {
    if (!navEl) return 0;
    var matches = 0;

    $$(".sidebar-link", navEl).forEach(function (link) {
      var hit = !q || (link.textContent || "").toLowerCase().indexOf(q) !== -1;
      link.classList.toggle("is-search-hidden", !hit);
      if (hit) matches++;
    });

    $$(".sidebar-group", navEl).forEach(function (group) {
      var items = group.querySelector(".sidebar-items");
      if (!items) return;
      var anyVisible = $$(".sidebar-link", items).some(function (l) {
        return !l.classList.contains("is-search-hidden");
      });
      group.classList.toggle("is-search-hidden", !!q && !anyVisible);
      if (q && anyVisible) {
        group.classList.add("open");
        items.classList.remove("hidden");
        var lbl = group.querySelector(".sidebar-group-label");
        if (lbl) lbl.setAttribute("aria-expanded", "true");
      }
    });

    return matches;
  }

  function runSearchFilter() {
    if (!searchInput) return;
    var q = (searchInput.value || "").toLowerCase().trim();

    var activeNav = sidebarNavs.find(function (n) { return n.dataset.mode === currentMode; });
    var otherNav  = sidebarNavs.find(function (n) { return n.dataset.mode !== currentMode; });

    var activeMatches = applyFilterTo(activeNav, q);
    // Always keep the inactive nav clean (no leftover hidden state) but don't show it
    applyFilterTo(otherNav, "");

    var otherMatches = q ? countMatchesIn(otherNav, q) : 0;

    // Cross-mode hint
    if (crossHint && crossHintTxt) {
      if (q && activeMatches === 0 && otherMatches > 0) {
        var otherLabel = currentMode === "user-manual" ? "Contribute" : "User Manual";
        crossHintTxt.textContent = otherMatches + " match" + (otherMatches === 1 ? "" : "es") +
                                   " in " + otherLabel;
        crossHint.hidden = false;
      } else {
        crossHint.hidden = true;
      }
    }

    // Empty state — nothing anywhere
    if (emptyMsg) {
      emptyMsg.hidden = !(q && activeMatches === 0 && otherMatches === 0);
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", debounce(runSearchFilter, 60));
    // Esc clears
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (searchInput.value) {
          searchInput.value = "";
          runSearchFilter();
        } else {
          searchInput.blur();
        }
      }
    });
  }

  if (crossHint) {
    crossHint.addEventListener("click", function () {
      var other = currentMode === "user-manual" ? "contribute" : "user-manual";
      applyMode(other, { scrollTop: false });
      // Re-run filter so matches show in newly active sidebar
      if (searchInput) {
        // Move focus back to the search input for continuity
        runSearchFilter();
        searchInput.focus();
      }
    });
  }

  // "/" shortcut to focus search
  document.addEventListener("keydown", function (e) {
    if (e.key !== "/") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var ae = document.activeElement;
    if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return;
    if (!searchInput) return;
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  });

  /* ===== Mobile sidebar drawer ====================================== */
  var hamburger    = $("#navHamburger");
  var docsSidebar  = $("#docsSidebar");
  var sidebarOverlay = $("#sidebarOverlay");

  function openSidebar() {
    if (!docsSidebar) return;
    docsSidebar.classList.add("open");
    if (sidebarOverlay) sidebarOverlay.classList.add("open");
    document.body.classList.add("no-scroll");
    if (hamburger) hamburger.setAttribute("aria-expanded", "true");
  }
  function closeSidebar() {
    if (!docsSidebar) return;
    docsSidebar.classList.remove("open");
    if (sidebarOverlay) sidebarOverlay.classList.remove("open");
    document.body.classList.remove("no-scroll");
    if (hamburger) hamburger.setAttribute("aria-expanded", "false");
  }

  if (hamburger) {
    hamburger.addEventListener("click", function () {
      if (docsSidebar.classList.contains("open")) closeSidebar(); else openSidebar();
    });
  }
  if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);
  // Esc closes mobile drawer
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && docsSidebar && docsSidebar.classList.contains("open")) {
      closeSidebar();
    }
  });
  // Auto-close drawer when crossing back to desktop width
  window.addEventListener("resize", debounce(function () {
    if (window.innerWidth >= 768) closeSidebar();
  }, 100));

  /* ===== Smooth scroll to anchors =================================== */
  function smoothScrollTo(id) {
    var target = document.getElementById(id);
    if (!target) return false;
    var navH = parseInt(getComputedStyle(document.documentElement)
                .getPropertyValue("--nav-h"), 10) || 60;
    var rect = target.getBoundingClientRect();
    var top  = rect.top + window.scrollY - navH - 16;
    window.scrollTo({ top: top, behavior: prefersReducedMotion ? "auto" : "smooth" });
    return true;
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || href === "#" || href.length < 2) return;

    var id = href.slice(1);
    var targetMode = modeFromSectionId(id);

    // If link points to a section in the other mode, switch first
    if (targetMode && targetMode !== currentMode) {
      e.preventDefault();
      applyMode(targetMode, { scrollTop: false });
      // Allow DOM to update visibility, then scroll
      requestAnimationFrame(function () {
        smoothScrollTo(id);
        if (window.innerWidth < 768) closeSidebar();
        history.replaceState(null, "", "#" + id);
      });
      return;
    }

    // Same mode: smooth scroll + close mobile drawer
    if (document.getElementById(id)) {
      e.preventDefault();
      smoothScrollTo(id);
      if (window.innerWidth < 768) closeSidebar();
      history.replaceState(null, "", "#" + id);
    }
  });

  /* ===== Active section highlight via IntersectionObserver =========== */
  var activeIO = null;
  var observedSections = [];

  function clearActiveLinks() {
    $$(".sidebar-link.active").forEach(function (l) { l.classList.remove("active"); });
  }

  function setActiveLink(id) {
    if (!id) return;
    var changed = false;
    $$(".sidebar-link").forEach(function (link) {
      var match = link.getAttribute("href") === "#" + id;
      if (match && !link.classList.contains("active")) {
        clearActiveLinks();
        link.classList.add("active");
        changed = true;
      }
    });
    return changed;
  }

  var updateUrl = debounce(function (id) {
    if (!id) return;
    if (("#" + id) === location.hash) return;
    history.replaceState(null, "", "#" + id);
  }, 200);

  function refreshObservedSections() {
    if (activeIO) {
      observedSections.forEach(function (s) { activeIO.unobserve(s); });
    }
    var activePanel = modePanels.find(function (p) { return p.dataset.mode === currentMode; });
    if (!activePanel) return;
    observedSections = $$("section[id]", activePanel);

    if (!activeIO) {
      activeIO = new IntersectionObserver(function (entries) {
        // Pick the topmost intersecting section
        var topId = null;
        var topY  = Infinity;
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var y = entry.target.getBoundingClientRect().top;
            if (y < topY) { topY = y; topId = entry.target.id; }
          }
        });
        if (topId) {
          setActiveLink(topId);
          updateUrl(topId);
        }
      }, { rootMargin: "-72px 0px -72% 0px", threshold: 0 });
    }

    observedSections.forEach(function (s) { activeIO.observe(s); });
  }

  /* ===== Copy buttons (optional) ==================================== */
  $$(".copy-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var block = btn.closest(".code-block");
      var pre   = block ? block.querySelector("pre") : null;
      var text  = btn.dataset.copy || (pre ? pre.innerText : "") || "";
      if (!text || !navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(function () {
        btn.classList.add("copied");
        var prev = btn.innerHTML;
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Copied';
        setTimeout(function () {
          btn.classList.remove("copied");
          btn.innerHTML = prev;
        }, 1800);
      }).catch(function () { /* clipboard blocked */ });
    });
  });

  /* ===== Init ======================================================== */
  applyMode(currentMode, { scrollTop: false });
  runSearchFilter();
  refreshObservedSections();

  // If we landed with a hash, scroll to it once layout settles.
  if (location.hash && location.hash.length > 1) {
    var id = location.hash.slice(1);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (document.getElementById(id)) {
          smoothScrollTo(id);
          setActiveLink(id);
        }
      });
    });
  }

  // React to back/forward navigation that changes the hash
  window.addEventListener("hashchange", function () {
    var id = (location.hash || "").replace(/^#/, "");
    if (!id) return;
    var m = modeFromSectionId(id);
    if (m && m !== currentMode) applyMode(m, { scrollTop: false });
    if (document.getElementById(id)) {
      smoothScrollTo(id);
      setActiveLink(id);
    }
  });

  /* ── Home page (index.html) — reveal animations ──────────── */
  var reveals = document.querySelectorAll(".reveal");
  if (reveals.length && "IntersectionObserver" in window) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          revealIO.unobserve(e.target);
        }
      });
    }, { threshold: 0.08 });
    reveals.forEach(function (el) { revealIO.observe(el); });
  }

  /* ── Home page — role tabs ───────────────────────────────── */
  var roleTabs = document.querySelectorAll(".role-tab");
  roleTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var role = tab.dataset.role;
      roleTabs.forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      document.querySelectorAll(".role-panel").forEach(function (p) {
        p.classList.remove("active");
      });
      var panel = document.getElementById("role-" + role);
      if (panel) panel.classList.add("active");
    });
  });
});
