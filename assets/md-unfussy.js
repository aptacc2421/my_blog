/**
 * 在交给 marked 之前做少量规范化，使「手写不严格」的文本更接近 CommonMark 预期。
 * 当前：ATX 标题若写成「###字」无空格，marked 不会识别为标题，会整段当正文。
 */
(function (g) {
  "use strict";

  function normalizeMarkdownForParse(md) {
    if (md == null || md === "") return md;
    var s = String(md);
    /* ###标题 → ### 标题（每行行首 1～6 个 # 后若紧跟非空白非#，则插入一个空格） */
    s = s.replace(/^(#{1,6})([^\s#])/gm, function (_, hashes, rest) {
      return hashes + " " + rest;
    });
    return s;
  }

  g.normalizeMarkdownForParse = normalizeMarkdownForParse;
})(typeof window !== "undefined" ? window : globalThis);
