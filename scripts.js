const AUTO_ADVANCE_DELAY = 1800;
const AUTO_RESUME_DELAY = 450;
const TOUCH_RESUME_DELAY = 900;
const WHEEL_RESUME_DELAY = 450;
const CONTROL_RESUME_DELAY = 650;
const ADVANCE_SETTLE_DELAY = 560;
const WHEEL_JUMP_THRESHOLD = 36;
const WHEEL_JUMP_COOLDOWN = 360;
const TOUCH_JUMP_THRESHOLD = 42;

const shufflePhotos = (photos) => {
  const shuffled = [...photos];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
};

const buildPhoto = (photo, altText, isDuplicate) => {
  const image = document.createElement("img");
  image.src = photo.thumb;
  image.alt = isDuplicate ? "" : altText;
  image.decoding = "async";
  image.loading = "lazy";
  image.draggable = false;

  if (isDuplicate) {
    image.setAttribute("aria-hidden", "true");
  }

  return image;
};

const appendTextElement = (parent, tagName, text, className) => {
  if (!text) {
    return null;
  }

  const element = document.createElement(tagName);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  parent.appendChild(element);

  return element;
};

const pauseCarousel = (carousel) => {
  carousel.classList.add("is-user-paused");
};

const resumeCarousel = (carousel) => {
  if (carousel.dataset.isHovering === "true") {
    return;
  }

  const manualPauseUntil = Number(carousel.dataset.manualPauseUntil || 0);

  if (manualPauseUntil > Date.now()) {
    scheduleCarouselResume(carousel, manualPauseUntil - Date.now());
    return;
  }

  window.clearTimeout(Number(carousel.dataset.resumeTimer));
  delete carousel.dataset.manualPauseUntil;
  delete carousel.dataset.resumeTimer;
  carousel.classList.remove("is-user-paused");
};

const getTrack = (carousel) => carousel.querySelector(".photo-track");

const getPhotos = (carousel) => {
  const track = getTrack(carousel);

  return track ? [...track.querySelectorAll("img")] : [];
};

const getLoopWidth = (carousel) => {
  const track = getTrack(carousel);

  if (!track) {
    return 0;
  }

  return track.scrollWidth / 2;
};

const normalizeCarouselPosition = (carousel) => {
  if (carousel.dataset.isAdvancing === "true" || carousel.dataset.isSettling === "true") {
    return;
  }

  const loopWidth = getLoopWidth(carousel);

  if (!loopWidth) {
    return;
  }

  if (carousel.scrollLeft >= loopWidth) {
    carousel.scrollLeft -= loopWidth;
  }

  if (carousel.scrollLeft < 0) {
    carousel.scrollLeft += loopWidth;
  }
};

// The carousel renders the photo list twice. This keeps the visual loop seamless
// while this function maps the current viewport back to the first copy.
const getNearestPhotoIndex = (carousel) => {
  const photos = getPhotos(carousel);

  if (photos.length === 0) {
    return -1;
  }

  const carouselCenter = carousel.scrollLeft + carousel.clientWidth / 2;
  return photos.reduce((nearestIndex, photo, index) => {
    const nearest = photos[nearestIndex];
    const photoCenter = photo.offsetLeft + photo.offsetWidth / 2;
    const nearestDistance = Math.abs(nearest.offsetLeft + nearest.offsetWidth / 2 - carouselCenter);
    const photoDistance = Math.abs(photoCenter - carouselCenter);

    return photoDistance < nearestDistance ? index : nearestIndex;
  }, 0);
};

const scrollToPhoto = (carousel, photo, behavior = "smooth") => {
  carousel.scrollTo({
    left: photo.offsetLeft - (carousel.clientWidth - photo.offsetWidth) / 2,
    behavior,
  });
};

const centerNearestPhoto = (carousel, behavior = "smooth") => {
  const photos = getPhotos(carousel);
  const nearestIndex = getNearestPhotoIndex(carousel);

  if (nearestIndex < 0) {
    return;
  }

  scrollToPhoto(carousel, photos[nearestIndex], behavior);
};

const settleNearestPhoto = (carousel, behavior = "smooth") => {
  carousel.dataset.isSettling = "true";
  centerNearestPhoto(carousel, behavior);

  window.setTimeout(() => {
    delete carousel.dataset.isSettling;
    normalizeCarouselPosition(carousel);
  }, 240);
};

const scheduleAutoAdvance = (carousel, delay = AUTO_ADVANCE_DELAY) => {
  window.clearTimeout(Number(carousel.dataset.autoTimer));

  const timer = window.setTimeout(() => {
    if (!carousel.classList.contains("is-user-paused") && carousel.dataset.isHovering !== "true") {
      scrollToAdjacentPhoto(carousel, 1, false);
    }

    scheduleAutoAdvance(carousel);
  }, delay);

  carousel.dataset.autoTimer = String(timer);
};

const scheduleCarouselResume = (carousel, delay = TOUCH_RESUME_DELAY) => {
  window.clearTimeout(Number(carousel.dataset.resumeTimer));
  carousel.dataset.manualPauseUntil = String(Date.now() + delay);

  const timer = window.setTimeout(() => {
    settleNearestPhoto(carousel, "auto");

    if (carousel.dataset.isHovering === "true") {
      delete carousel.dataset.manualPauseUntil;
      delete carousel.dataset.resumeTimer;
      return;
    }

    delete carousel.dataset.manualPauseUntil;
    resumeCarousel(carousel);
    scheduleAutoAdvance(carousel, AUTO_RESUME_DELAY);
    delete carousel.dataset.resumeTimer;
  }, delay);

  carousel.dataset.resumeTimer = String(timer);
};

const scheduleCarouselSettle = (carousel, delay = TOUCH_RESUME_DELAY) => {
  window.clearTimeout(Number(carousel.dataset.settleTimer));

  const timer = window.setTimeout(() => {
    settleNearestPhoto(carousel);
    scheduleCarouselResume(carousel, delay);
    delete carousel.dataset.settleTimer;
  }, 140);

  carousel.dataset.settleTimer = String(timer);
};

const getAdjacentPhoto = (carousel, direction) => {
  const photos = getPhotos(carousel);
  const realPhotoCount = Math.floor(photos.length / 2);

  if (photos.length === 0 || realPhotoCount === 0) {
    return null;
  }

  normalizeCarouselPosition(carousel);

  const currentIndex = getNearestPhotoIndex(carousel);

  if (currentIndex < 0) {
    return null;
  }

  const logicalIndex = currentIndex % realPhotoCount;

  // When moving past either edge, target the duplicated half first, then normalize.
  if (direction > 0) {
    return photos[logicalIndex + 1] || photos[realPhotoCount];
  }

  if (logicalIndex === 0) {
    carousel.scrollLeft += getLoopWidth(carousel);
    return photos[realPhotoCount - 1];
  }

  return photos[logicalIndex - 1];
};

const scrollToAdjacentPhoto = (carousel, direction, userInitiated = true) => {
  if (carousel.dataset.isAdvancing === "true") {
    return;
  }

  const target = getAdjacentPhoto(carousel, direction);

  if (!target) {
    return;
  }

  window.clearTimeout(Number(carousel.dataset.autoTimer));
  carousel.dataset.isAdvancing = "true";
  scrollToPhoto(carousel, target, "auto");

  window.setTimeout(() => {
    delete carousel.dataset.isAdvancing;
    normalizeCarouselPosition(carousel);
    centerNearestPhoto(carousel, "auto");

    if (!carousel.classList.contains("is-user-paused") && carousel.dataset.isHovering !== "true") {
      scheduleAutoAdvance(carousel);
    }
  }, ADVANCE_SETTLE_DELAY);

  if (userInitiated) {
    pauseCarousel(carousel);
    scheduleCarouselResume(carousel, CONTROL_RESUME_DELAY);
  }
};

const getCarouselShell = (carousel) => {
  if (carousel.parentElement?.classList.contains("carousel-shell")) {
    return carousel.parentElement;
  }

  const shell = document.createElement("div");
  shell.className = "carousel-shell";

  carousel.parentElement.insertBefore(shell, carousel);
  shell.appendChild(carousel);

  return shell;
};

const buildCarouselControls = (carousel) => {
  if (carousel.dataset.controls === "true") {
    return;
  }

  carousel.dataset.controls = "true";
  carousel.querySelectorAll(".carousel-control").forEach((control) => control.remove());

  const shell = getCarouselShell(carousel);

  const previous = document.createElement("button");
  previous.className = "carousel-control carousel-control-previous";
  previous.type = "button";
  previous.setAttribute("aria-label", "Photo précédente");
  previous.innerHTML = "<span aria-hidden=\"true\"></span>";

  const next = document.createElement("button");
  next.className = "carousel-control carousel-control-next";
  next.type = "button";
  next.setAttribute("aria-label", "Photo suivante");
  next.innerHTML = "<span aria-hidden=\"true\"></span>";

  previous.addEventListener("click", () => scrollToAdjacentPhoto(carousel, -1));
  next.addEventListener("click", () => scrollToAdjacentPhoto(carousel, 1));

  shell.append(previous, next);
};

const enhanceCarousel = (track) => {
  const carousel = track.closest(".photo-carousel");

  if (!carousel || carousel.dataset.enhanced === "true") {
    return;
  }

  carousel.dataset.enhanced = "true";

  buildCarouselControls(carousel);

  carousel.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") {
      carousel.dataset.isHovering = "true";
      pauseCarousel(carousel);
      window.clearTimeout(Number(carousel.dataset.autoTimer));
    }
  });
  carousel.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") {
      delete carousel.dataset.isHovering;
      centerNearestPhoto(carousel);
      scheduleCarouselResume(carousel, TOUCH_RESUME_DELAY);
    }
  });
  carousel.addEventListener("pointerdown", () => {
    window.clearTimeout(Number(carousel.dataset.resumeTimer));
    window.clearTimeout(Number(carousel.dataset.autoTimer));
    pauseCarousel(carousel);
  });
  carousel.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "mouse") {
      scheduleCarouselResume(carousel);
    }
  });
  carousel.addEventListener("pointercancel", () => scheduleCarouselResume(carousel));
  carousel.addEventListener("lostpointercapture", () => scheduleCarouselResume(carousel));
  carousel.addEventListener(
    "touchstart",
    (event) => {
      window.clearTimeout(Number(carousel.dataset.autoTimer));
      carousel.dataset.touchStartX = String(event.touches[0]?.clientX || 0);
      pauseCarousel(carousel);
    },
    { passive: true }
  );
  carousel.addEventListener(
    "touchend",
    (event) => {
      const startX = Number(carousel.dataset.touchStartX || 0);
      const endX = event.changedTouches[0]?.clientX || startX;
      const deltaX = endX - startX;

      delete carousel.dataset.touchStartX;

      if (Math.abs(deltaX) >= TOUCH_JUMP_THRESHOLD) {
        scrollToAdjacentPhoto(carousel, deltaX < 0 ? 1 : -1);
        return;
      }

      scheduleCarouselResume(carousel);
    },
    { passive: true }
  );
  carousel.addEventListener(
    "wheel",
    (event) => {
      const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

      if (Math.abs(horizontalDelta) < 1) {
        return;
      }

      event.preventDefault();
      pauseCarousel(carousel);
      window.clearTimeout(Number(carousel.dataset.autoTimer));

      const now = Date.now();
      const lastJump = Number(carousel.dataset.lastWheelJump || 0);
      const wheelIntent = Number(carousel.dataset.wheelIntent || 0) + horizontalDelta;

      carousel.dataset.wheelIntent = String(wheelIntent);

      if (Math.abs(wheelIntent) < WHEEL_JUMP_THRESHOLD || now - lastJump < WHEEL_JUMP_COOLDOWN) {
        scheduleCarouselResume(carousel, WHEEL_RESUME_DELAY);
        return;
      }

      carousel.dataset.lastWheelJump = String(now);
      carousel.dataset.wheelIntent = "0";
      scrollToAdjacentPhoto(carousel, wheelIntent > 0 ? 1 : -1);
    },
    { passive: false }
  );
  carousel.addEventListener(
    "scroll",
    () => {
      normalizeCarouselPosition(carousel);

      if (carousel.dataset.isSettling === "true" || carousel.dataset.isAdvancing === "true") {
        return;
      }

      if (carousel.classList.contains("is-user-paused")) {
        scheduleCarouselSettle(carousel);
      }
    },
    { passive: true }
  );
};

const startAutoAdvance = (track) => {
  const carousel = track.closest(".photo-carousel");

  if (!carousel || carousel.dataset.autoScroll === "true") {
    return;
  }

  carousel.dataset.autoScroll = "true";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  scheduleAutoAdvance(carousel);
};

const renderCarousel = (track, photos) => {
  if (!track || photos.length === 0) {
    return;
  }

  const altText = track.dataset.photoAlt || "Photo";
  const selectedPhotos = shufflePhotos(photos);
  const fragment = document.createDocumentFragment();

  selectedPhotos.forEach((photo) => {
    fragment.appendChild(buildPhoto(photo, altText, false));
  });

  selectedPhotos.forEach((photo) => {
    fragment.appendChild(buildPhoto(photo, altText, true));
  });

  track.replaceChildren(fragment);
  enhanceCarousel(track);
  startAutoAdvance(track);
};

const buildStageDetail = (label, value) => {
  if (!value) {
    return null;
  }

  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.textContent = label;
  description.textContent = Array.isArray(value) ? value.join(" / ") : value;
  wrapper.append(term, description);

  return wrapper;
};

const getSessionStatusClass = (status) => {
  const normalizedStatus = (status || "").toLowerCase();

  if (normalizedStatus.includes("disponible")) {
    return "status-badge status-badge--available";
  }

  if (normalizedStatus.includes("pass")) {
    return "status-badge status-badge--past";
  }

  return "status-badge";
};

const getSessionStatusPriority = (status) => {
  const normalizedStatus = (status || "").toLowerCase();

  if (normalizedStatus.includes("disponible")) {
    return 0;
  }

  if (normalizedStatus.includes("pass")) {
    return 1;
  }

  return 2;
};

const getSessionStartTimestamp = (session) => {
  const timestamp = Date.parse(session.startDate || "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const sortWorkshopSessions = (sessions) =>
  [...sessions].sort((firstSession, secondSession) => {
    const statusDifference =
      getSessionStatusPriority(firstSession.status) - getSessionStatusPriority(secondSession.status);

    if (statusDifference !== 0) {
      return statusDifference;
    }

    return getSessionStartTimestamp(secondSession) - getSessionStartTimestamp(firstSession);
  });

const buildStageCard = (session) => {
  const article = document.createElement("article");
  article.className = "stage-card";

  const header = document.createElement("div");
  header.className = "stage-card-header";
  appendTextElement(header, "p", session.status || "Stage disponible", getSessionStatusClass(session.status));
  appendTextElement(header, "h3", session.title);

  article.appendChild(header);
  appendTextElement(article, "p", session.cardSummary || session.subtitle);

  const details = document.createElement("dl");
  details.className = "stage-details";

  [
    ["Date", session.date],
    ["Durée", session.duration],
    ["Lieu", session.location],
    ["Intervenant", session.instructor],
    ["Public", session.public],
    ["Places", session.capacity],
    ["Tarif", session.pricingSummary],
    ["Acompte", session.depositSummary],
  ].forEach(([label, value]) => {
    const detail = buildStageDetail(label, value);

    if (detail) {
      details.appendChild(detail);
    }
  });

  article.appendChild(details);

  const cta = document.createElement("a");
  cta.className = "button button-primary";
  cta.href = "#contact";
  cta.textContent = "Contacter Marie pour réserver";
  article.appendChild(cta);

  return article;
};

const loadWorkshopSessions = async () => {
  const grid = document.querySelector("[data-workshop-sessions]");

  if (!grid) {
    return;
  }

  try {
    const response = await fetch("data/workshop-sessions.json");

    if (!response.ok) {
      throw new Error(`Sessions indisponibles (${response.status})`);
    }

    const sessions = await response.json();
    const displaySessions = sortWorkshopSessions(
      sessions.filter((session) => session.status !== "masqué")
    ).slice(0, 2);

    if (displaySessions.length === 0) {
      return;
    }

    grid.replaceChildren(...displaySessions.map(buildStageCard));
  } catch {
    // Le HTML statique reste affiché si les données ne sont pas accessibles.
  }
};

const loadPhotoCarousels = async () => {
  const tracks = [...document.querySelectorAll("[data-photo-category]")];

  if (tracks.length === 0) {
    return;
  }

  tracks.forEach((track) => {
    enhanceCarousel(track);
    startAutoAdvance(track);
  });

  try {
    const response = await fetch("assets/photos/photos-manifest.json");

    if (!response.ok) {
      throw new Error(`Manifest photo indisponible (${response.status})`);
    }

    const photos = await response.json();

    tracks.forEach((track) => {
      const category = track.dataset.photoCategory;
      const categoryPhotos = photos.filter((photo) => photo.category === category && photo.thumb);
      renderCarousel(track, categoryPhotos);
    });
  } catch {
    // Le HTML contient déjà une galerie de secours pour la prévisualisation locale file://.
  }
};

document.addEventListener("DOMContentLoaded", () => {
  loadPhotoCarousels();
  loadWorkshopSessions();
});
