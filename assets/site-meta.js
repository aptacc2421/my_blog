/**
 * 全站标题与博客开通日（改日期只动 blogSince 一处即可）
 */
(function (g) {
  "use strict";

  var blogSince = "2026-04-17";

  function blogSinceLine() {
    var p = blogSince.split("-");
    if (p.length < 3) return "";
    return (
      "博客自 " +
      parseInt(p[0], 10) +
      " 年 " +
      parseInt(p[1], 10) +
      " 月 " +
      parseInt(p[2], 10) +
      " 日起"
    );
  }

  g.SITE_META = {
    /** 默认浏览器标签：比单字「生活」多一点信息 */
    brand: "生活 · 手记与片段",
    /** 用在「栏目 — …」里偏短的一侧 */
    brandShort: "生活",
    blogSince: blogSince,
    blogSinceLine: blogSinceLine,
  };

  function fillBlogSinceNodes() {
    var line = blogSinceLine();
    var nodes = document.querySelectorAll("[data-blog-since]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = line;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fillBlogSinceNodes);
  } else {
    fillBlogSinceNodes();
  }
})(typeof window !== "undefined" ? window : globalThis);
