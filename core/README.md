# chroniq-core

ChroniQ（星曆）的计算部分，单独打成一个包，给别的程序用（比如聊天机器人、桌面助手、自动化脚本）：

- 某一天的**黄历**：农历、干支、节气、节日、月相、建除、值神、星宿、宜忌、吉神凶煞
- **八字**排盘和旺衰简析，**紫微**排盘和格局，**星盘**（西洋占星：本命、行运、推运、合盘），**七政四余**（出生时的真实星空归入二十八宿）
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
  buildBazi, baziReading, baziText, fortuneText, birthNotes,
  buildZiwei, findPatterns, ziweiText, buildHoroscope, ziweiHoroscopeText, DEFAULT_ZIWEI_SCHOOLS,
  buildStarChart, transits, starChartText, DEFAULT_STAR_SETTINGS, findCity, lunarToSolar,
  buildQizheng, qizhengText, qizhengLimits, qizhengTransit, DEFAULT_QIZHENG_SCHOOLS,
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

// 七政四余（和星盘一样要出生地；用当地钟表时间，不用真太阳时）
const qizheng = buildQizheng({ ...input, place }, DEFAULT_QIZHENG_SCHOOLS)
qizhengText(qizheng, DEFAULT_QIZHENG_SCHOOLS) // 命宫和命度、七政四余各在哪一宿几度、哪一次哪一宫、逆行，十二宫，四象分布，流派
qizhengText(qizheng, DEFAULT_QIZHENG_SCHOOLS, new Date()) // 再加上洞微大限（标出当前的）和此刻天上的七政四余落在本命盘哪一宫（流年）
qizhengLimits(qizheng) // 十二个大限：哪一宫、起止的年数和日期、宫内的星

// 接下来 30 天的天象（地点要有经纬度和时区）
for (const e of upcomingSkyEvents(new Date(), 30, DEFAULT_PLACE)) console.log(skyEventText(e, DEFAULT_PLACE.timeZone))
// 11/18 05:51 · 狮子座流星雨 · 东南方 高 70° · 理想条件下每小时约 15 颗；月光干扰小。
```

结构化的数据也都导出了（`buildDayDetail`、`BaziChart`、`ZiweiChart`、`computeSkyEvents`、`computeTonight`、`QizhengChart` 等），见 `dist/types/core/index.d.ts`。
八字、紫微、七政四余的流派选项（`SCHOOLS`、`ZIWEI_SCHOOLS`、`QIZHENG_SCHOOLS`）和网页「设置」里的一样，不传时用默认值。

预测和出生时间的检查也有文字版：

```ts
fortuneText(bazi, { year: 2026 })                  // 当年的大运（交运日期）、流年、太岁、与原局的刑冲合会，和十二个流月
fortuneText(bazi, { year: 2026, month: 11, day: 10 }) // 某一天：大运、流年、流月、流日
ziweiHoroscopeText(ziwei, buildHoroscope(input, DEFAULT_ZIWEI_SCHOOLS, { year: 2026, month: 6, day: 1, hour: 0 }), 2026)
// 大限、流年……各自的命宫在本命哪一宫、十二宫对照、四化落宫、流耀
birthNotes({ ...input, place, trueSolar: true })   // [{ kind: 'dst', text: '出生时北京实行夏令时（UTC+9）……' }, …]
// 夏令时跳过的时刻（抛出 RangeError）或重复的时刻、交节附近、真太阳时换了柱、时辰交界、晚子时；时辰不详时（第三个参数 false）三柱能说什么
buildBazi({ ...input, place, trueSolar: true, jie: 'local' })
// 年柱、月柱和起运默认按出生的实际时刻对照交节（DEFAULT_JIE 'instant'，0.4.0 起，网页也这样排）。
// 'local' 把排盘用的时间直接和北京时间的交节时刻比，等于直接查北京时间的万年历（0.4.0 以前的默认）：
// 海外出生、夏令时出生或用真太阳时、又离交节只差几小时的，两种会落在交节两边，起运也略有不同（JIE_SCHOOL）
```

## Claude Code skill：命理排盘与解读

`core/skill/mingli-chart-reading/` 是一个 Claude Code skill，和这个包一起发布、用同一个版本号。装上以后，用户报出生信息或问运势时，Claude 用 skill 里的脚本排盘，再照盘解读，不自己排。它能排八字（时辰不详时排三柱，加流年、流月、流日）、紫微（加大限、流年）、星盘（本命、行运、推运、合盘）、七政四余、黄历和天象，并回答「今年适合换工作吗」这类问题。解读的要求、流派分歧和英文术语都写在 skill 里。

- **脚本**：`scripts/chart.ts` 加上它用到的这个包和三个库，打成一个 `scripts/chart.mjs`（约 1.3 MB）。装上就能用 node 运行，不需要 npm install，不联网，也不写文件。参数用 `node chart.mjs --help` 查看，输出就是上面那些文字函数写的纯文本。
- **安装**：从 Release 下载 `mingli-chart-reading-<版本>.zip`，解压到 `~/.claude/skills/`，得到 `~/.claude/skills/mingli-chart-reading/`。
- **构建**：`npm run build:skill` 构建到 `core/skill/dist/mingli-chart-reading/`：SKILL.md 和 references 原样复制，脚本打包。`core/__tests__/skill.test.ts` 会测试脚本的参数和输出，也会构建一份，用 node 实际运行。

## 开发

在 ChroniQ 仓库根目录：

- `npm run build:core`：打包到 `core/dist`（一个 ES 模块加类型声明）
- `npm run pack:core`：打包并生成 `core/chroniq-core-<版本>.tgz`
- `npm run check:core`：在打好的包上，按 Node 项目（`NodeNext`）的方式检查类型能不能用（`core/consumer/`）
- `npm run build:skill`：构建 Claude Code skill 到 `core/skill/dist`
- 测试和网页的一起跑（`npm test`），`core/__tests__` 是在 Node 里跑的，保证离开浏览器也能用

发布新版：改 `core/package.json` 的 `version`，合进 `main` 后打标签 `core-v<版本>` 并推送，GitHub Actions 会打包并建好 Release，附上包的 tgz 和 skill 的 zip。

## 许可

MIT，见 [LICENSE](LICENSE)。chroniq-core 打包的是 `core/` 和 `src/lib/` 的代码，这两个目录都以 MIT 发布；ChroniQ 仓库的其余部分（界面、样式、AI 解读、文档、素材）保留所有权利，见仓库根目录的 [LICENSE](../LICENSE)。打包进来的第三方库和数据遵守各自的许可，见 [src/lib/DATA_SOURCES.md](../src/lib/DATA_SOURCES.md)。
