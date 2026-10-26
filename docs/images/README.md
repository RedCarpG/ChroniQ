# README 截图 / README screenshots

[返回主 README](../../README.md) · [English README](../../README.en.md)

这些截图来自当前版本的本地生产构建，由真实 Chromium 浏览器渲染，不是设计稿或生成式图片。

These screenshots were rendered from the current local production build in Chromium, rather than mockups or generated artwork.

## 场景 / Scenes

| 文件 / File | 页面 / Page | 演示时刻 / Displayed time | 主题 / Theme |
| --- | --- | --- | --- |
| `calendar.jpg` | 日历 / Calendar | 2026-10-26 20:00 | Light |
| `sky.jpg` | 天象 / Sky | 2026-08-12 22:00 | Dark |
| `moon.jpg` | 观月 / Moon | 2026-10-26 20:00 | Dark |
| `solar.jpg` | 太阳系 / Solar system | 2026-10-26 20:00 | Dark |
| `bazi.jpg` | 八字 / Bazi | 2026-10-26 20:00 | Dark |
| `ziwei.jpg` | 紫微斗数 / Ziwei Doushu | 2026-10-26 20:00 | Dark |
| `star.jpg` | 西洋星盘 / Western astrology | 2026-10-26 20:00 | Dark |

- 观测地为北京，表中时刻均为 `Asia/Shanghai`。天象页选用夏夜，展示银河和西方星座。
- 排盘页面使用演示出生输入 `1990-05-15 22:30`、北京、男，不使用用户命盘；真太阳时未开启，其他计算采用默认设置。
- 桌面视口为 `1440 × 1000`，设备像素比为 1，显示大小为 100%，界面语言为中文、术语为简体；关闭音效，启用减少动态效果。
- 截图前等待页面与字体载入、移走鼠标并关闭菜单；使用 JPEG 保存。截图是固定状态，不表示应用此刻的实时日期或天象。

The observing location is Beijing; all times above use `Asia/Shanghai`. The Sky screenshot uses a summer night to show the Milky Way and Western constellations. Chart pages use a demonstration birth input of `1990-05-15 22:30`, Beijing, male, with apparent solar time disabled and other calculation settings at their defaults. No user charts are used.

Captures use a `1440 × 1000` viewport at device pixel ratio 1, 100% interface scale, Chinese text with simplified terminology, sound disabled and reduced motion enabled. Pages and fonts finish loading before capture, menus are closed and the pointer is moved away. JPEGs represent fixed states, not the live date or sky.

## 更新方式 / Updating

1. 在仓库根目录运行 `npm ci`、`npm run build`，再用 `npm run preview` 启动生产预览。
2. 使用独立浏览器配置或自动化浏览器，以演示数据配置页面，避免带入真实用户信息或旧版站点缓存。
3. 按上表设置场景，等待字体、星图画布和月球贴图完成加载，截取整个视口。
4. 检查文字、图表和裁切，替换对应文件；同步更新本说明和 README 中的描述。

Build from the repository root with `npm ci` and `npm run build`, then serve the production preview with `npm run preview`. Use an isolated browser profile or automated browser with the demonstration data, reproduce the scenes above, wait for fonts/canvases/textures, and capture the full viewport. Review legibility and cropping before replacing images and updating their descriptions.
