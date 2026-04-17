#!/usr/bin/env python3
# -*- coding: utf-8 -*-
W, H = 80, 40
ROOT = "atmospheres"


def write(name, lines):
    path = f"{ROOT}/{name}.txt"
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(path, len(lines))


# --- 无名之地：留白、极少点、淡斜线 ---
def gen_unnamed():
    lines = []
    dots = {(3, 8), (71, 12), (22, 25), (55, 31), (40, 5), (66, 22), (12, 33), (48, 18)}
    for y in range(H):
        row = [" "] * W
        for (x, yy) in dots:
            if yy == y:
                row[x] = "."
        x = y * 2 + 5
        if 0 <= x < W:
            row[x] = "'" if row[x] == " " else ","
        lines.append("".join(row))
    return lines


# --- 巨大落地窗：窗格、夕阳、地板长影、床与家具剪影 ---
def gen_window():
    lines = []
    for y in range(H):
        row = [" "] * W
        # floor zone
        if y >= 28:
            for x in range(W):
                row[x] = "." if (x + y) % 5 == 0 else " "
        # sunset gradient upper
        if y < 12:
            band = int((12 - y) / 3)
            ch = "#" if band > 2 else "*" if band > 0 else "."
            for x in range(45, 78):
                row[x] = ch
        # window frame center-right
        wx0, wx1, wy0, wy1 = 38, 76, 6, 28
        if wy0 <= y <= wy1:
            for x in (wx0, wx1):
                if 0 <= x < W:
                    row[x] = "|"
            if y in (wy0, wy1):
                for x in range(wx0, wx1 + 1):
                    row[x] = "-" if x < W else row[x]
        # mullions
        if wy0 < y < wy1:
            for x in range(wx0 + 8, wx1, 9):
                if 0 <= x < W:
                    row[x] = "|"
        # sun disk
        if 8 <= y <= 11:
            cx, r = 58, 3
            for x in range(cx - r, cx + r + 1):
                if 0 <= x < W and abs(x - cx) + abs(y - 9) <= r + 1:
                    row[x] = "O"
        # bed silhouette left
        if 26 <= y <= 28:
            for x in range(6, 28):
                row[x] = "="
        if 24 <= y <= 25:
            for x in range(8, 26):
                row[x] = "#"
        # dresser corner
        if 18 <= y <= 24:
            for x in range(28, 34):
                row[x] = "#"
        # fridge block
        if 16 <= y <= 26:
            for x in range(4, 10):
                row[x] = "#"
        # shadow grid on floor (simplified)
        if 28 <= y <= 32:
            for x in range(20, 70, 4):
                if x < W:
                    row[x] = "+" if row[x] == " " else row[x]
        # curtain hint right of bed
        if 10 <= y <= 26:
            for x in range(30, 36):
                if row[x] == " ":
                    row[x] = ":"
        lines.append("".join(row))
    return ["".join(r)[:W] for r in lines]


# --- 盛夏大逃亡：按层叠加，树海不盖住摩天轮与列车 ---
def gen_summer():
    sea_y = 21
    cx, cy, r = 52, 21, 7
    lines = []
    for y in range(H):
        row = [" "] * W

        if y <= 4:
            for x in range(W):
                row[x] = "*" if (x // 6 + y) % 2 == 0 else "~"

        if 5 <= y <= 13:
            for x in range(W):
                if (x - cx) ** 2 + (y - cy) ** 2 <= (r + 3) ** 2:
                    continue
                if y == 6 and 64 <= x <= 72:
                    continue
                if y == 11 and 2 <= x <= 24:
                    continue
                wave = (x // 4 + y * 2) % 7
                row[x] = "^" if wave < 5 else "w"

        if y == 6:
            for x, ch in [(66, "("), (67, "-"), (68, "-"), (69, "-"), (70, ")")]:
                if 0 <= x < W:
                    row[x] = ch
        if y == 7 and 68 < W:
            row[68] = "|"

        if y == 11:
            for x in range(2, 23):
                row[x] = "="
            if 23 < W:
                row[23] = ">"

        if y == sea_y:
            row = ["~"] * W

        if y < sea_y:
            for x in range(W):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    row[x] = "O"

        if 22 <= y <= 25:
            for x in range(W):
                if (x - cx) ** 2 // 2 + (y - 23) ** 2 <= 28:
                    row[x] = "o"

        if y >= 26:
            edge = 52 - (y - 26) * 2
            edge = max(8, min(edge, W))
            for x in range(edge):
                row[x] = "#" if (x + y) % 2 else "="

        if y in (23, 24):
            for x in range(30, 33):
                if x < W:
                    row[x] = "#"
            for x in range(35, 38):
                if x < W:
                    row[x] = "#"
            for x in range(39, 47):
                if x < W:
                    row[x] = "#"

        lines.append("".join(row)[:W])
    return lines


# --- 雨落狂流之暗：竖雨线、车头、背影、奥丁剪影、闪电 ---
def gen_rain():
    lines = []
    for y in range(H):
        row = [" "] * W
        # rain
        for x in range(0, W, 2):
            if (x + y * 2) % 3 == 0:
                row[x] = "|"
            elif (x + y) % 5 == 0:
                row[x] = "/"
        # road floor dark
        if y >= 26:
            for x in range(W):
                if row[x] == " ":
                    row[x] = "."
        # car front lower
        if 28 <= y <= 34:
            for x in range(18, 62):
                row[x] = "#"
        if 30 <= y <= 32:
            for x in range(24, 32):
                row[x] = "o"
            for x in range(48, 56):
                row[x] = "o"
        # headlights beams
        if 26 <= y <= 29:
            for x in range(26, 40):
                row[x] = "." if row[x] in "|/" else row[x]
            for x in range(40, 54):
                row[x] = "." if row[x] in "|/" else row[x]
        # man with sword silhouette
        if 22 <= y <= 28:
            for x in range(36, 40):
                row[x] = "#"
        if 20 <= y <= 26:
            row[38] = "|"
        # odin horse block mid
        if 10 <= y <= 20:
            for x in range(50, 68):
                if row[x] in " |/":
                    row[x] = "#"
        # golden eye
        if y == 14:
            row[58] = "*"
        # lightning top
        if y <= 5:
            zig = [10, 11, 12, 13, 14, 15, 16, 17]
            if y < len(zig) and zig[y] < W:
                row[zig[y]] = "/"
        lines.append("".join(row)[:W])
    return lines


def main():
    write("无名之地", gen_unnamed())
    write("巨大落地窗", gen_window())
    write("盛夏大逃亡", gen_summer())
    write("雨落狂流之暗", gen_rain())


if __name__ == "__main__":
    main()
