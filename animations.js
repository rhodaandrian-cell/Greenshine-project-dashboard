// animations.js
(() => {
  const Animations = (window.Animations = window.Animations || {});

  // Returns true only if at least one element matches the selector on this page.
  // Used to skip GSAP calls (and their "target not found" warnings) on pages
  // that don't contain the element being animated.
  function exists(selector) {
    try {
      return document.querySelector(selector) !== null;
    } catch {
      return false;
    }
  }

  Animations.animateIntro = () => {
    if (!window.gsap) return;

    if (exists(".topbar")) {
      gsap.fromTo(
        ".topbar",
        { y: -14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }
      );
    }

    if (exists(".meta-card")) {
      gsap.fromTo(
        ".meta-card",
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, stagger: 0.06, delay: 0.05, ease: "power2.out" }
      );
    }

    if (exists(".kpi")) {
      gsap.fromTo(
        ".kpi",
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, stagger: 0.06, delay: 0.1, ease: "power2.out" }
      );
    }

    if (exists(".card")) {
      gsap.fromTo(
        ".card",
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, stagger: 0.05, delay: 0.12, ease: "power2.out" }
      );
    }
  };

  Animations.pulseKpis = () => {
    if (!window.gsap || !exists(".kpi")) return;

    gsap.fromTo(
      ".kpi",
      { scale: 0.992 },
      { scale: 1, duration: 0.25, ease: "power2.out", stagger: 0.02 }
    );
  };

  Animations.toastIn = (el) => {
    if (!window.gsap || !el) return;

    gsap.fromTo(
      el,
      { x: 18, opacity: 0, scale: 0.98 },
      { x: 0, opacity: 1, scale: 1, duration: 0.35, ease: "power2.out" }
    );
  };

  Animations.toastOut = (el, onDone) => {
    if (!el || !window.gsap) {
      onDone?.();
      return;
    }

    gsap.to(el, {
      x: 18,
      opacity: 0,
      scale: 0.98,
      duration: 0.25,
      ease: "power2.in",
      onComplete: onDone
    });
  };

  Animations.modalIn = (el) => {
    if (!el || !window.gsap) return;

    const card = el.querySelector(".modal-card") || el;

    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power2.out" });
    gsap.fromTo(
      card,
      { y: 18, opacity: 0, scale: 0.985 },
      { y: 0, opacity: 1, scale: 1, duration: 0.28, ease: "power2.out" }
    );
  };

  Animations.modalOut = (el, onDone) => {
    if (!el || !window.gsap) {
      onDone?.();
      return;
    }

    const card = el.querySelector(".modal-card") || el;

    gsap.to(card, {
      y: 18,
      opacity: 0,
      scale: 0.985,
      duration: 0.2,
      ease: "power2.in"
    });

    gsap.to(el, {
      opacity: 0,
      duration: 0.18,
      ease: "power2.in",
      onComplete: onDone
    });
  };

  Animations.tableRefresh = (selector) => {
    if (!window.gsap) return;

    const targets = typeof selector === "string"
      ? document.querySelectorAll(selector)
      : selector;

    // Skip silently if nothing matches — avoids GSAP "target not found".
    if (!targets || !targets.length) return;

    gsap.fromTo(
      targets,
      { opacity: 0.65, y: 4 },
      { opacity: 1, y: 0, duration: 0.22, stagger: 0.015, ease: "power2.out" }
    );
  };

  Animations.highlightRow = (el) => {
    if (!window.gsap || !el) return;

    gsap.fromTo(
      el,
      { boxShadow: "0 0 0 rgba(29,185,84,0)" },
      {
        boxShadow: "0 0 0 999px rgba(29,185,84,0.06) inset",
        duration: 0.2,
        yoyo: true,
        repeat: 1,
        ease: "power2.out"
      }
    );
  };
})();