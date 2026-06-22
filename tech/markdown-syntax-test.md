# Markdown 语法渲染测试

本文用于检查技术博客页的 Markdown 渲染效果。逐项对照下方各区块。

## 二级标题

### 三级标题

#### 四级标题

##### 五级标题

###### 六级标题

###无空格标题（md-unfussy 应自动补空格）

---

## 段落与换行

这是普通段落。同一段落内连续书写，中间只有一个换行时不会断行。

这是新段落（上一行留有空行）。

行末两空格硬换行测试：  
下一行应紧接上一行显示。

HTML 换行：<br>下一行通过 br 换行。

---

## 强调

*斜体* 与 _另一种斜体_

**粗体** 与 __另一种粗体__

***粗斜体*** 与 ___另一种粗斜体___

~~删除线~~

---

## 链接与图片

行内链接：[GitHub](https://github.com)

自动链接：<https://example.com>

参考式链接：[参考链接][ref-link]

[ref-link]: https://example.com/ref "参考链接标题"

图片（1×1 透明 PNG data URI）：

![占位图](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==)

---

## 引用

> 单层引用。技术博客宜保持克制排版。
>
> 引用内可含 **粗体** 与 `行内代码`。

> 外层引用
>
> > 嵌套引用
> >
> > 继续嵌套内容

---

## 无序列表

- 破折号项一
- 破折号项二

* 星号项一
* 星号项二

+ 加号项一
+ 加号项二

嵌套无序：

- 父项
  - 子项 A
  - 子项 B
    - 孙项

---

## 有序列表

1. 第一项
2. 第二项
3. 第三项

嵌套有序：

1. 步骤一
   1. 子步骤 1.1
   2. 子步骤 1.2
2. 步骤二

---

## 任务列表（GFM）

- [x] 已完成任务
- [ ] 未完成任务
- [x] 另一项已完成
- [ ] 待办：写下一篇技术博文

---

## 行内代码

使用 `const x = 1` 与 `npm install marked` 展示行内代码。反引号内可含 `**不会**` 被解析为粗体。

---

## 围栏代码块

无语言标注：

```
plain text block
no syntax highlighting
```

JavaScript：

```js
function greet(name) {
  return `Hello, ${name}!`;
}

console.log(greet("world"));
```

Shell：

```bash
python3 -m http.server 8000
curl -I http://localhost:8000/tech.html
```

---

## 表格（GFM）

| 左对齐 | 居中 | 右对齐 |
|:-------|:----:|-------:|
| A      | B    | 100    |
| 较长单元格内容 | 中 | 42     |
| `code` | *斜体* | **粗** |

---

## 分隔线

上方已用 `---`。下方用星号：

***

---

## 转义

不应渲染为标题：\# 不是标题

不应渲染为列表：\- 不是列表项

不应渲染为强调：\*不是斜体\*

---

## HTML 片段

marked 默认允许部分内联 HTML：

<kbd>Ctrl</kbd> + <kbd>S</kbd> 保存；<mark>高亮</mark> 与 <sub>下标</sub>/<sup>上标</sup>。

---

## 混合示例

> **提示**：写技术文时常用结构：
>
> 1. 问题背景
> 2. 方案对比
> 3. 代码示例
>
> ```js
> // 最小可运行示例
> export default function main() {}
> ```

若以上区块显示正常，即可开始正式写作。
