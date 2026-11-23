const navigation = document.querySelector(".mobile-site-nav");

if (navigation) {
  const links = Array.from(navigation.querySelectorAll("a[href]"));
  const localTargets = links.flatMap((link) => {
    const url = new URL(link.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return [];
    const target = document.getElementById(url.hash.slice(1));
    return target ? [{ link, target }] : [];
  });

  const setCurrentLink = (activeLink) => {
    links.forEach((link) => {
      if (link === activeLink) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  };

  const initialLink = links.find((link) => {
    const url = new URL(link.href, location.href);
    return url.pathname === location.pathname && (!location.hash || url.hash === location.hash);
  });
  if (initialLink) setCurrentLink(initialLink);

  navigation.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    if (link && navigation.contains(link)) setCurrentLink(link);
  });

  if ("IntersectionObserver" in window && localTargets.length) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (visible) {
        const target = localTargets.find((item) => item.target === visible.target);
        if (target) setCurrentLink(target.link);
      }
    }, { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] });
    localTargets.forEach(({ target }) => observer.observe(target));
  }
}
