/* Image / video boxes. A missing file shows a quiet grey box with the file name instead of a broken icon. */
import { url } from "./utils.js";

const observer =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            const v = e.target;
            if (e.isIntersecting) {
              const p = v.play();
              if (p && p.catch) p.catch(() => {});
            } else v.pause();
          });
        },
        { threshold: 0.25 }
      )
    : null;

export function mediaBox(src, type, alt) {
  const box = document.createElement("div");
  box.className = "media";
  const name = String(src || "").split("/").pop();
  const missing = () => {
    box.classList.add("missing");
    box.dataset.name = name;
  };
  if (!src) {
    missing();
    return box;
  }
  if (type === "video") {
    const v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.addEventListener("error", () => {
      v.remove();
      missing();
    });
    v.src = url(src);
    box.appendChild(v);
    if (observer) observer.observe(v);
    else v.autoplay = true;
  } else {
    const i = document.createElement("img");
    i.alt = alt || "";
    i.loading = "lazy";
    i.decoding = "async";
    i.addEventListener("error", () => {
      i.remove();
      missing();
    });
    i.src = url(src);
    box.appendChild(i);
  }
  return box;
}

/** Add a media box (marked data-img so it gets the scroll "expand" effect) to a host element. */
export function placeMedia(host, src, type, alt) {
  const b = mediaBox(src, type, alt);
  b.setAttribute("data-img", "");
  host.appendChild(b);
  return b;
}
