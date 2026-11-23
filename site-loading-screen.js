(() => {
  const loader = document.querySelector(".loading-screen");
  if (!loader) return;

  const firstLaunchKey = "red-room-loader-first-launch";
  const isFirstWebsiteLaunch = localStorage.getItem(firstLaunchKey) !== "yes";
  if (isFirstWebsiteLaunch) localStorage.setItem(firstLaunchKey, "yes");
  let firstLaunchDelayPending = isFirstWebsiteLaunch;
  const photos = [...loader.querySelectorAll(".loader-photo")];
  const fill = loader.querySelector("#loader-progress-fill");
  const progress = loader.querySelector('[role="progressbar"]');
  const percent = loader.querySelector("#loader-percent");
  const status = loader.querySelector("#loader-status-text");
  const headline = loader.querySelector("#loader-headline");
  const detail = loader.querySelector("#loader-detail");
  const stages = [
    { progress: 32, status: "Setting the mood", headline: "Make the night your own.", detail: "Browse the Red Room companion directory." },
    { progress: 58, status: "Bringing the gallery into focus", headline: "A little closer to the night.", detail: "Explore the portraits and choose who to enquire about." },
    { progress: 82, status: "Almost ready", headline: "You’re about to enter Red Room.", detail: "A few more moments, then the evening is yours." },
    { progress: 96, status: "Welcome to Red Room", headline: "The room is ready.", detail: "Take your time and make yourself at home." }
  ];
  const changeSpeeds = [900, 800, 650];
  const initialToken = loader.hidden ? null : Symbol("initial");
  const activeTokens = new Set(initialToken ? [initialToken] : []);
  let startedAt = Date.now();
  let activePhoto = 0;
  let stageIndex = 0;
  let dismissTimer = 0;
  let finishTimer = 0;
  let stageTimer = 0;

  const animateText = (element, text) => {
    element.classList.remove("is-changing");
    element.textContent = text;
    requestAnimationFrame(() => element.classList.add("is-changing"));
    window.setTimeout(() => element.classList.remove("is-changing"), 500);
  };

  const updateStage = () => {
    if (!activeTokens.size || stageIndex >= stages.length) return;
    const nextPhoto = (activePhoto + 1) % photos.length;
    photos[activePhoto].classList.remove("is-active", "is-pop");
    photos[nextPhoto].classList.add("is-active");
    photos[nextPhoto].classList.remove("is-pop");
    requestAnimationFrame(() => photos[nextPhoto].classList.add("is-pop"));
    activePhoto = nextPhoto;

    const stage = stages[stageIndex];
    fill.style.width = `${stage.progress}%`;
    progress.setAttribute("aria-valuenow", String(stage.progress));
    percent.textContent = `${String(stage.progress).padStart(2, "0")}%`;
    status.textContent = stage.status;
    animateText(headline, stage.headline);
    animateText(detail, stage.detail);
    stageIndex += 1;
    if (stageIndex < stages.length) {
      stageTimer = window.setTimeout(updateStage, changeSpeeds[Math.min(stageIndex - 1, changeSpeeds.length - 1)]);
    }
  };

  const reset = () => {
    window.clearTimeout(dismissTimer);
    window.clearTimeout(finishTimer);
    window.clearTimeout(stageTimer);
    loader.hidden = false;
    loader.classList.remove("is-hidden");
    loader.removeAttribute("aria-hidden");
    photos.forEach((photo) => photo.classList.remove("is-active", "is-pop"));
    photos[0].classList.add("is-active");
    fill.style.width = "10%";
    progress.setAttribute("aria-valuenow", "8");
    percent.textContent = "08%";
    status.textContent = "Preparing the room";
    headline.textContent = "You’re about to enter Red Room.";
    detail.textContent = "A little moment while we set the scene.";
    activePhoto = 0;
    stageIndex = 0;
    startedAt = Date.now();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      stageTimer = window.setTimeout(updateStage, changeSpeeds[0]);
    }
  };

  const dismiss = () => {
    if (activeTokens.size) return;
    const minimumDuration = firstLaunchDelayPending
      ? (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 500 : 2500)
      : 0;
    firstLaunchDelayPending = false;
    dismissTimer = window.setTimeout(() => {
      if (activeTokens.size) return;
      fill.style.width = "100%";
      progress.setAttribute("aria-valuenow", "100");
      percent.textContent = "100%";
      loader.classList.add("is-hidden");
      loader.setAttribute("aria-hidden", "true");
      finishTimer = window.setTimeout(() => {
        if (!activeTokens.size) loader.hidden = true;
      }, 700);
    }, Math.max(0, minimumDuration - (Date.now() - startedAt)));
  };

  function show() {
    const wasHidden = !activeTokens.size;
    const token = Symbol("loading");
    activeTokens.add(token);
    if (wasHidden) reset();
    return token;
  }

  function hide(token) {
    activeTokens.delete(token);
    dismiss();
  }

  function finishInitial() {
    if (initialToken) activeTokens.delete(initialToken);
    dismiss();
  }

  if (initialToken && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    stageTimer = window.setTimeout(updateStage, changeSpeeds[0]);
  }

  window.RedRoomLoading = { show, hide, finishInitial };

  window.setTimeout(() => {
    if (loader.hidden || loader.classList.contains("is-hidden")) return;
    finishInitial();
  }, 8000);
})();
