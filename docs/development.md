# 开发指南

[← 返回首页](../README.md)

## 技术栈

- [Vite](https://vite.dev) + [React 19](https://react.dev) + TypeScript
- 历法和命理计算：[tyme4ts](https://github.com/6tail/tyme4ts)（MIT）
- 紫微斗数排盘：[iztro](https://github.com/SylarLong/iztro)（MIT）
- 星盘星体位置：[astronomy-engine](https://github.com/cosinekitty/astronomy)（MIT）

所有计算都在浏览器里完成，没有后端；`dist/` 是纯静态文件。

## 本地开发

```bash
npm install
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
  lib/astrology.ts       星盘计算（基于 astronomy-engine）
  lib/sky.ts             此刻天空
  lib/regionHolidays.ts  其他国家的节假日规则表
  lib/solarTime.ts       真太阳时与城市经度
  lib/place.ts           出生地（各页共用）
  lib/timeZone.ts        时区换算（Intl）
  i18n/                  英文界面词典
  pwa.ts                 注册 Service Worker、安装提示、离线状态
scripts/
  pwa.ts                 构建时生成 sw.js（预缓存全部文件）
docs/                    功能详解、流派说明、开发指南
legacy/                  旧版 Express + EJS 实现（仅作参考）
```

## 英文界面

界面文字在源码里用中文写，并用 `t('…')` 包起来；英文翻译放在 `src/i18n/en/` 下按页面分开的词典里，以中文原文为键。带数字或名称的句子用占位符，如 `t('{n} 颗亮星', { n })`。`npm test` 会检查每个 `t('…')` 都有英文、占位符一致，同一个键在不同词典里的译法相同。

## 繁體专有名词

干支、神煞、十神、节气、宜忌等专有名词默认以繁體显示，说明文字保持简体。转换用的是一份按字对照的表 `src/lib/tradChars.ts`，由 [OpenCC](https://github.com/nk2028/opencc-js) 在开发时生成，网页运行时不加载 OpenCC。命理用字和 OpenCC 默认结果不同的地方（如「沖」不作「衝」，地支「丑」不作「醜」，「天干」不作「天幹」），在 `src/lib/tradOverrides.ts` 中单独指定。

界面里新增专有名词时，用 `term('…')` 包起来（切换到英文界面时，经过 `term()` 的专有名词仍保持中文），然后运行 `npm run gen:trad` 重新生成对照表；`npm test` 会检查每个名词的转换结果是否和 OpenCC 一致。
