/* Make the big name span exactly the page width, with its baseline one page-margin above the images. */
import { $ } from "./utils.js";

let belowBaseline = null;

export function fitName() {
  const el = $("#bigname");
  const wrap = $("#nameWrap");
  if (!el || !wrap) return;
  const cs = getComputedStyle(el);
  const pad = parseFloat(cs.paddingLeft);
  const avail = el.clientWidth - pad - parseFloat(cs.paddingRight);
  el.style.fontSize = "100px";
  const w = wrap.getBoundingClientRect().width;
  const fs = w > 0 ? (100 * avail) / w : 100;
  el.style.fontSize = fs + "px";
  // Measure the space under the baseline (only possible before the letters are split by the reveal).
  if (!wrap.querySelector(".ln")) {
    const probe = document.createElement("span");
    probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    wrap.appendChild(probe);
    const below = el.getBoundingClientRect().bottom - parseFloat(cs.paddingBottom) - probe.getBoundingClientRect().bottom;
    wrap.removeChild(probe);
    if (fs > 0) belowBaseline = below / fs;
  }
  if (belowBaseline !== null) el.style.bottom = pad - belowBaseline * fs + "px";
}
