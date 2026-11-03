# chroniq-core

ChroniQ（星曆）的计算部分，单独打成一个包，给别的程序用（比如聊天机器人、桌面助手、自动化脚本）：

- 某一天的**黄历**：农历、干支、节气、节日、月相、建除、值神、星宿、宜忌、吉神凶煞
- **八字**排盘和旺衰简析，**紫微**排盘和格局，**星盘**（西洋占星：本命、行运、推运、合盘）
- 一段时间内的**天象**：日月食、流星雨、冲日、大距、行星相合、超级月亮
- 以上全部都能写成**一段中文纯文字**，直接交给 AI 读，或者念出来

代码就是网页里用的那一份（`src/lib`），两边算出来的永远一样。只依赖 `tyme4ts`、`iztro`、`astronomy-engine`，不需要浏览器，Node 20 以上可用。

## 安装

从 GitHub Release 装打好的包（版本号换成要用的那个）：

```sh
npm install https://github.com/RedCarpG/ChroniQ/releases/download/core-v0.1.0/chroniq-core-0.1.0.tgz
```

## 用法

```ts
import {
  almanacText,
  buildBazi, baziReading, baziText,
  buildZiwei, findPatterns, ziweiText, DEFAULT_ZIWEI_SCHOOLS,
  buildStarChart, transits, starChartText, DEFAULT_STAR_SETTINGS, findCity, lunarToSolar,
  upcomingSkyEvents, skyEventText, DEFAULT_PLACE,
} from 'chroniq-core'

// 今天的黄历
almanacText(2026, 11, 3)
// 2026年11月3日 星期二 · 农历九月廿五 · 丙午年戊戌月辛巳日（属马）
// 节气：霜降第12天
// ……
// 宜：订盟、纳采、会亲友、交易……
// 忌：嫁娶、开市、入宅、祈福、安葬

// 八字（gender：1 男，0 女；可加 place 和 trueSolar: true 按真太阳时排）
const input = { year: 1990, month: 5, day: 17, hour: 10, minute: 30, gender: 1 as const }
const bazi = buildBazi(input)
baziText(bazi, baziReading(bazi, 2026)) // 四柱、藏干十神、纳音、神煞、大运、旺衰……

// 紫微
const ziwei = buildZiwei(input, DEFAULT_ZIWEI_SCHOOLS)
ziweiText(ziwei, findPatterns(ziwei)) // 十二宫的星曜、亮度、四化、宫干飞化、大限、格局

// 星盘（地点用城市名找，或者自己给经纬度和时区）；农历生日先换成公历
const place = findCity('北京')!
const star = buildStarChart(input, place, DEFAULT_STAR_SETTINGS)
starChartText(star, DEFAULT_STAR_SETTINGS) // 行星星座度数和宫位、上升天顶、宫头、元素、相位
starChartText(star, DEFAULT_STAR_SETTINGS, transits(star, new Date(), DEFAULT_STAR_SETTINGS)) // 加上此刻的行运
lunarToSolar(1990, 4, 23) // { year: 1990, month: 5, day: 17 }

// 接下来 30 天的天象（地点要有经纬度和时区）
for (const e of upcomingSkyEvents(new Date(), 30, DEFAULT_PLACE)) console.log(skyEventText(e, DEFAULT_PLACE.timeZone))
// 11/18 05:51 · 狮子座流星雨 · 东南方 高 70° · 理想条件下每小时约 15 颗；月光干扰小。
```

结构化的数据也都导出了（`buildDayDetail`、`BaziChart`、`ZiweiChart`、`computeSkyEvents`、`computeTonight` 等），见 `dist/types/core/index.d.ts`。
八字、紫微的流派选项（`SCHOOLS`、`ZIWEI_SCHOOLS`）和网页「设置」里的一样，不传时用默认值。

## 开发

在 ChroniQ 仓库根目录：

- `npm run build:core`：打包到 `core/dist`（一个 ES 模块加类型声明）
- `npm run pack:core`：打包并生成 `core/chroniq-core-<版本>.tgz`
- `npm run check:core`：在打好的包上，按 Node 项目（`NodeNext`）的方式检查类型能不能用（`core/consumer/`）
- 测试和网页的一起跑（`npm test`），`core/__tests__` 是在 Node 里跑的，保证离开浏览器也能用

发布新版：改 `core/package.json` 的 `version`，合进 `main` 后打标签 `core-v<版本>` 并推送，GitHub Actions 会打包并建好 Release。

## 许可

和 ChroniQ 仓库一样，目前没有对外的开源许可（`UNLICENSED`），供作者自己的项目使用。
