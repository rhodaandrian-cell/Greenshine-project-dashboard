// animations.js
(() => {
  const Animations = (window.Animations = window.Animations || {});

  Animations.animateIntro = () => {
    if (!window.gsap) return;

    gsap.fromTo(
      ".topbar",
      { y: -14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }
    );

    gsap.fromTo(
      ".meta-card",
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, stagger: 0.06, delay: 0.05, ease: "power2.out" }
    );

    gsap.fromTo(
      ".kpi",
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, stagger: 0.06, delay: 0.1, ease: "power2.out" }
    );

    gsap.fromTo(
      ".card",
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.35, stagger: 0.05, delay: 0.12, ease: "power2.out" }
    );
  };

  Animations.pulseKpis = () => {
    if (!window.gsap) return;

    gsap.fromTo(
      ".kpi",
      { scale: 0.992 },
      { scale: 1, duration: 0.25, ease: "power2.out", stagger: 0.02 }
    );
  };

  Animations.toastIn = (el) => {
    if (!window.gsap || !el) return;
    gsap.fromTo(el, { x: 18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: "power2.out" });
  };

  Animations.toastOut = (el, onDone) => {
    if (!el) return onDone?.();
    if (!window.gsap) {
      onDone?.();
      return;
    }
    gsap.to(el, { x: 18, opacity: 0, duration: 0.25, ease: "power2.in", onComplete: onDone });
  };
})();