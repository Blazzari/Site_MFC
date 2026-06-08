const CAROUSEL_PHOTO_LIMIT = 24;
const SECONDS_PER_PHOTO = 12;

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

  if (isDuplicate) {
    image.setAttribute("aria-hidden", "true");
  }

  return image;
};

const renderCarousel = (track, photos) => {
  if (!track || photos.length === 0) {
    return;
  }

  const altText = track.dataset.photoAlt || "Photo";
  const selectedPhotos = shufflePhotos(photos).slice(0, CAROUSEL_PHOTO_LIMIT);
  const fragment = document.createDocumentFragment();

  selectedPhotos.forEach((photo) => {
    fragment.appendChild(buildPhoto(photo, altText, false));
  });

  selectedPhotos.forEach((photo) => {
    fragment.appendChild(buildPhoto(photo, altText, true));
  });

  track.replaceChildren(fragment);
  track.style.animationDuration = `${selectedPhotos.length * SECONDS_PER_PHOTO}s`;
};

const loadPhotoCarousels = async () => {
  const tracks = [...document.querySelectorAll("[data-photo-category]")];

  if (tracks.length === 0) {
    return;
  }

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
