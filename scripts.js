const AUTO_SCROLL_SPEED = 34;
const TOUCH_RESUME_DELAY = 6000;

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

const pauseCarousel = (carousel) => {
  carousel.classList.add("is-user-paused");
};

const resumeCarousel = (carousel) => {
  carousel.classList.remove("is-user-paused");
};

const getTrack = (carousel) => carousel.querySelector(".photo-track");

const getLoopWidth = (carousel) => {
  const track = getTrack(carousel);

  if (!track) {
    return 0;
  }

  return track.scrollWidth / 2;
};

const normalizeCarouselPosition = (carousel) => {
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

const centerNearestPhoto = (carousel) => {
  const track = getTrack(carousel);
  const photos = track ? [...track.querySelectorAll("img")] : [];

  if (photos.length === 0) {
    return;
  }

  const carouselCenter = carousel.scrollLeft + carousel.clientWidth / 2;
  const nearestPhoto = photos.reduce((nearest, photo) => {
    const photoCenter = photo.offsetLeft + photo.offsetWidth / 2;
    const nearestDistance = Math.abs(nearest.offsetLeft + nearest.offsetWidth / 2 - carouselCenter);
    const photoDistance = Math.abs(photoCenter - carouselCenter);

    return photoDistance < nearestDistance ? photo : nearest;
  }, photos[0]);

  carousel.scrollTo({
    left: nearestPhoto.offsetLeft - (carousel.clientWidth - nearestPhoto.offsetWidth) / 2,
    behavior: "smooth",
  });
};

const scheduleCarouselResume = (carousel) => {
  window.clearTimeout(Number(carousel.dataset.resumeTimer));

  const timer = window.setTimeout(() => {
    centerNearestPhoto(carousel);
    resumeCarousel(carousel);
    delete carousel.dataset.resumeTimer;
  }, TOUCH_RESUME_DELAY);

  carousel.dataset.resumeTimer = String(timer);
};

const enhanceCarousel = (track) => {
  const carousel = track.closest(".photo-carousel");

  if (!carousel || carousel.dataset.enhanced === "true") {
    return;
  }

  carousel.dataset.enhanced = "true";

  carousel.addEventListener("pointerenter", () => pauseCarousel(carousel));
  carousel.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") {
      centerNearestPhoto(carousel);
      resumeCarousel(carousel);
    }
  });
  carousel.addEventListener("pointerdown", () => pauseCarousel(carousel));
  carousel.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "mouse") {
      scheduleCarouselResume(carousel);
    }
  });
  carousel.addEventListener("touchstart", () => pauseCarousel(carousel), { passive: true });
  carousel.addEventListener("touchend", () => scheduleCarouselResume(carousel), { passive: true });
  carousel.addEventListener(
    "scroll",
    () => {
      normalizeCarouselPosition(carousel);

      if (carousel.classList.contains("is-user-paused")) {
        scheduleCarouselResume(carousel);
      }
    },
    { passive: true }
  );
};

const startAutoScroll = (track) => {
  const carousel = track.closest(".photo-carousel");

  if (!carousel || carousel.dataset.autoScroll === "true") {
    return;
  }

  let lastFrame = null;
  carousel.dataset.autoScroll = "true";

  const tick = (timestamp) => {
    if (lastFrame === null) {
      lastFrame = timestamp;
    }

    const elapsed = timestamp - lastFrame;
    lastFrame = timestamp;

    if (!carousel.classList.contains("is-user-paused")) {
      carousel.scrollLeft += (AUTO_SCROLL_SPEED * elapsed) / 1000;
      normalizeCarouselPosition(carousel);
    }

    window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);
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
  startAutoScroll(track);
};

const loadPhotoCarousels = async () => {
  const tracks = [...document.querySelectorAll("[data-photo-category]")];

  if (tracks.length === 0) {
    return;
  }

  tracks.forEach((track) => {
    enhanceCarousel(track);
    startAutoScroll(track);
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

document.addEventListener("DOMContentLoaded", loadPhotoCarousels);
