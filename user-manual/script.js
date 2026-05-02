/* ── Dark mode ─────────────────────────────────────────────── */
(function () {
  const saved = localStorage.getItem("paper-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
})();

document.addEventListener("DOMContentLoaded", () => {

  /* ── Theme toggle ─────────────────────────────────────────── */
  const toggle = document.getElementById("themeToggle");
  const sun    = document.getElementById("iconSun");
  const moon   = document.getElementById("iconMoon");

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("paper-theme", theme);
    if (sun && moon) {
      sun.style.display  = theme === "dark"  ? "block" : "none";
      moon.style.display = theme === "light" ? "block" : "none";
    }
  }

  applyTheme(document.documentElement.getAttribute("data-theme") || "light");

  if (toggle) {
    toggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }

  /* ── Reading progress bar ─────────────────────────────────── */
  const fill = document.getElementById("readProgress");
  if (fill) {
    window.addEventListener("scroll", () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      fill.style.width = total > 0 ? (window.scrollY / total * 100) + "%" : "0%";
    }, { passive: true });
  }

  /* ── Back to top ──────────────────────────────────────────── */
  const backTop = document.getElementById("backTop");
  if (backTop) {
    window.addEventListener("scroll", () => {
      backTop.classList.toggle("visible", window.scrollY > 400);
    }, { passive: true });
    backTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* ── Scroll reveal ────────────────────────────────────────── */
  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } });
    }, { threshold: 0.08 });
    reveals.forEach(el => io.observe(el));
  }

  /* ── Role tabs (marketing page) ───────────────────────────── */
  const roleTabs = document.querySelectorAll(".role-tab");
  roleTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const role = tab.dataset.role;
      roleTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".role-panel").forEach(p => p.classList.remove("active"));
      const panel = document.getElementById("role-" + role);
      if (panel) panel.classList.add("active");
    });
  });

  /* ── Copy buttons ─────────────────────────────────────────── */
  document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy || btn.closest(".code-block")?.querySelector("pre")?.innerText || "";
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        btn.classList.add("copied");
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied`;
        setTimeout(() => {
          btn.classList.remove("copied");
          btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
        }, 2000);
      } catch (_) { /* clipboard blocked */ }
    });
  });

  /* ── Sidebar collapsible groups ───────────────────────────── */
  document.querySelectorAll(".sidebar-group-label").forEach(label => {
    label.addEventListener("click", () => {
      const group = label.closest(".sidebar-group");
      group.classList.toggle("open");
      const items = group.querySelector(".sidebar-items");
      if (items) items.classList.toggle("hidden", !group.classList.contains("open"));
    });
  });

  /* ── Sidebar active link on scroll (docs page) ────────────── */
  const sidebar = document.getElementById("sidebarNav");
  if (sidebar) {
    const sections = document.querySelectorAll(".docs-content section[id]");
    const links = document.querySelectorAll(".sidebar-link");

    const activeIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          links.forEach(link => {
            const active = link.getAttribute("href") === "#" + id;
            link.classList.toggle("active", active);
          });
        }
      });
    }, { rootMargin: "-60px 0px -70% 0px", threshold: 0 });

    sections.forEach(s => activeIO.observe(s));

    links.forEach(link => {
      link.addEventListener("click", e => {
        const href = link.getAttribute("href");
        if (href && href.startsWith("#")) {
          e.preventDefault();
          const target = document.querySelector(href);
          if (target) target.scrollIntoView({ behavior: "smooth" });
          if (window.innerWidth < 768) closeSidebar();
        }
      });
    });
  }

  /* ── Sidebar search filter ────────────────────────────────── */
  const searchInput = document.getElementById("sidebarSearch");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase().trim();
      document.querySelectorAll(".sidebar-link").forEach(link => {
        const match = link.textContent.toLowerCase().includes(q);
        link.style.display = match ? "" : "none";
      });
      document.querySelectorAll(".sidebar-group").forEach(group => {
        const items = group.querySelector(".sidebar-items");
        if (!items) return;
        const anyVisible = [...items.querySelectorAll(".sidebar-link")].some(l => l.style.display !== "none");
        group.style.display = anyVisible || !q ? "" : "none";
        if (q && anyVisible) {
          group.classList.add("open");
          items.classList.remove("hidden");
        }
      });
    });

    document.addEventListener("keydown", e => {
      if (e.key === "/" && document.activeElement !== searchInput &&
          !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchInput.focus();
      }
      if (e.key === "Escape" && document.activeElement === searchInput) searchInput.blur();
    });
  }

  /* ── Mobile sidebar toggle ────────────────────────────────── */
  const hamburger = document.getElementById("navHamburger");
  const docsSidebar = document.getElementById("docsSidebar");
  const overlay = document.getElementById("sidebarOverlay");

  function openSidebar() {
    docsSidebar?.classList.add("open");
    overlay?.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeSidebar() {
    docsSidebar?.classList.remove("open");
    overlay?.classList.remove("open");
    document.body.style.overflow = "";
  }

  hamburger?.addEventListener("click", () => {
    if (docsSidebar?.classList.contains("open")) closeSidebar(); else openSidebar();
  });
  overlay?.addEventListener("click", closeSidebar);

  /* ── Highlight active nav link (marketing page) ────────────── */
  const sections2 = document.querySelectorAll("section[id]");
  if (sections2.length && !sidebar) {
    const navAnchors = document.querySelectorAll(".nav-links a");
    const marketIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navAnchors.forEach(a => a.classList.remove("active"));
          const match = [...navAnchors].find(a => a.getAttribute("href") === "#" + entry.target.id);
          if (match) match.classList.add("active");
        }
      });
    }, { threshold: 0.4 });
    sections2.forEach(s => marketIO.observe(s));
  }

});
