# 开发指南

[← 返回首页](../README.md) · 产品与技术 Spec：[中文](SPEC.zh-CN.md) / [English](SPEC.en.md)

## 技术栈

- [Vite](https://vite.dev) + [React 19](https://react.dev) + TypeScript
- 历法和命理计算：[tyme4ts](https://github.com/6tail/tyme4ts)（MIT）
- 紫微斗数排盘：[iztro](https://github.com/SylarLong/iztro)（MIT）
- 紫微星曜亮度表（《全书》口径）与格局条目参考：[Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu)（MIT）
- 星盘星体位置：[astronomy-engine](https://github.com/cosinekitty/astronomy)（MIT）

所有计算都在浏览器里完成，没有后端；`dist/` 是纯静态文件。

## 本地开发

```bash
npm ci
npm run dev       # 本地开发
npm run build     # 类型检查并构建到 dist/
npm run preview   # 预览构建结果
npm test          # 单元测试（vitest）
npm run gen:trad  # 重新生成繁體对照表（约 1 分钟）
```

`dist/` 是纯静态文件。推送到 `main` 后，`.github/workflows/pages.yml` 会自动测试、构建并部署到 GitHub Pages；PR 只跑测试和构建，不部署。

## 目录

```
src/
  App.tsx                页面框架、页面菜单、命盘抽屉
  components/            各页面与通用组件（CalendarView、BaziView、ZiweiView、StarChartView、天象……）
  lib/calendar.ts        月历网格和每日黄历数据
  lib/bazi.ts            八字排盘、大运、流年
  lib/shensha.ts         神煞规则表
  lib/relations.ts       刑冲合会
  lib/ziwei.ts           紫微斗数（基于 iztro）
  lib/ziweiBrightness.ts 紫微星曜庙旺表（《全书》口径）
  lib/ziweiPatterns.ts   紫微格局
  lib/astrology.ts       星盘计算（基于 astronomy-engine）
  lib/sky.ts             此刻天空
  lib/regionHolidays.ts  其他国家的节假日规则表
  lib/solarTime.ts       真太阳时与城市经度
  lib/place.ts           出生地（各页共用）
  lib/timeZone.ts        时区换算（Intl）
  i18n/                  英文界面词典
  pwa.ts                 注册 Service Worker、安装提示、离线状态
scripts/
  pwa.ts                 构建时生成 sw.js 与预缓存清单
docs/                    功能详解、流派说明、开发指南
legacy/                  旧版 Express + EJS 实现（仅作参考）
```

## 英文界面

界面文字在源码里用中文写，并用 `t('…')` 包起来；英文翻译放在 `src/i18n/en/` 下按页面分开的词典里，以中文原文为键。带数字或名称的句子用占位符，如 `t('{n} 颗亮星', { n })`。`npm test` 会检查每个 `t('…')` 都有英文、占位符一致，同一个键在不同词典里的译法相同。

## 命理页：简洁与详细

八字、紫微、星盘都有「简洁 / 详细」两种看法，面向两种人，新增或改动命理页时从这两种看法出发：

- **简洁是一幕展示。** 切到这一页时，主体（八字的罗盘、星盘的星盘图）直接占满第一屏，几条要紧的信息摆在四周（竖排或四角的小字），起盘时一层层亮起，背后是薄雾和出生那一刻的星空。要好看、有沉浸感，新手读起来不吃力；进阶的内容（岁运、行运、推运、合盘、宫位表）不放在这里。
- **详细是完整的盘。** 没有这一幕，表格和所有区块齐全，给熟悉的人读盘；不播起盘。
- **这一幕上方不放东西。** 出生信息在左侧「命盘」抽屉里改，页面上只在「简洁 / 详细」旁边写一行小字（`BirthChip`），流派设置是旁边的下拉面板（`SchoolsMenu`）。
- **检查：** 1440×900 的屏幕上，「简洁」这一幕不用滚动就完整可见；手机上依次排成一列，没有横向滚动；英文界面下四角的字不压到盘上。

天书风格下，八字的这一幕在 `BaziHero`，星盘的在 `StarHero`；起盘用 `useCasting` 和 `CastLine`，样式在 `src/tianshu.css`。

## 繁體专有名词

干支、神煞、十神、节气、宜忌等专有名词默认以繁體显示，说明文字保持简体。转换用的是一份按字对照的表 `src/lib/tradChars.ts`，由 [OpenCC](https://github.com/nk2028/opencc-js) 在开发时生成，网页运行时不加载 OpenCC。命理用字和 OpenCC 默认结果不同的地方（如「沖」不作「衝」，地支「丑」不作「醜」，「天干」不作「天幹」），在 `src/lib/tradOverrides.ts` 中单独指定。

界面里新增专有名词时，用 `term('…')` 包起来（切换到英文界面时，经过 `term()` 的专有名词仍保持中文），然后运行 `npm run gen:trad` 重新生成对照表；`npm test` 会检查每个名词的转换结果是否和 OpenCC 一致。

## 后台行运计算与离线更新

日历的年度行运计算由 `src/lib/chartWestern.worker.ts` 执行，主线程通过 `westernClient.ts` 请求结果。离开日历或更换命盘会取消无用请求；没有剩余请求时终止 Worker。完成结果最多缓存 24 个年度，八字与日历年度缓存也有容量上限。

出生时间不接受夏令时跳变时不存在的本地时间；回拨时重复的时间采用较早的一次，并在表单中提示。

PWA 的新版本会等待旧版受控页面全部关闭后激活。当前页面始终使用与其 Service Worker 配套的 HTML 和资源，保留旧缓存供懒加载页面使用。验证更新时应打开旧版页面、部署新版、检查旧版懒加载与离线导航，再关闭所有旧页面并重新打开应用。

日历是首屏；八字、紫微、星盘及天文页面的界面按需加载。PWA 仍会在后台预缓存这些页面，保证离线可用。首屏拆分减少的是立即解析和执行的 JavaScript，不减少整套离线资源的总下载量。

天象页面的投影与标签排布在 `skyGeometry.ts`，静态地景在 `skyDecorations.ts`，银河描画数据在 `skyScene.ts`。`useSkyBackdrop.ts` 分别缓存星云、暗星和深空星场的坐标，避免画质或缩放变化触发所有图层重算。太阳系与天象共享 `bodyColours.ts`，不再互相导入页面组件。
