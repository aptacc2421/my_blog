/**
 * 「这里有一个人住过」：极低对比度 + 位置轻微随机，作彩蛋用。
 */
(function () {
  "use strict";

  function placeDustEaster() {
    var el = document.querySelector(".dust-footnote");
    if (!el) return;

    el.style.position = "fixed";
    el.style.zIndex = "1";
    el.style.pointerEvents = "none";
    el.style.color = "var(--text-dust)";
    el.style.letterSpacing = "0.1em";
    el.style.whiteSpace = "nowrap";
    el.style.maxWidth = "none";

    var size = 0.38 + Math.random() * 0.1;
    el.style.fontSize = "calc(var(--write-size) * " + size.toFixed(2) + ")";
    el.style.opacity = String(0.1 + Math.random() * 0.1);

    var bottom = 0.25 + Math.random() * 1.15;
    el.style.bottom = bottom + "rem";

    var narrow = window.matchMedia("(max-width: 36rem)").matches;
    var rot = (Math.random() - 0.5) * 2;

    if (narrow) {
      el.style.left = "0.75rem";
      el.style.right = "0.75rem";
      el.style.textAlign = "center";
      el.style.transform = "rotate(" + rot + "deg)";
      return;
    }

    var r = Math.random();
    if (r < 0.33) {
      el.style.left = (4 + Math.random() * 34) + "%";
      el.style.right = "auto";
      el.style.textAlign = "left";
      el.style.transform = "rotate(" + rot + "deg)";
    } else if (r < 0.66) {
      el.style.right = (4 + Math.random() * 34) + "%";
      el.style.left = "auto";
      el.style.textAlign = "right";
      el.style.transform = "rotate(" + rot + "deg)";
    } else {
      var off = (Math.random() - 0.5) * 14;
      el.style.left = "calc(50% + " + off.toFixed(1) + "%)";
      el.style.right = "auto";
      el.style.textAlign = "center";
      el.style.transform = "translateX(-50%) rotate(" + rot + "deg)";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", placeDustEaster);
  } else {
    placeDustEaster();
  }
})();
