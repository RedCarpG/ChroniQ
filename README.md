<img src="public/favicon.svg" width="56" alt="" align="left" />

# 星曆 ChroniQ

[中文](README.md) · [English](README.en.md)

万年历、真实星空与多种排盘工具，放在同一个网页里。无需注册，计算在浏览器本地完成，可安装为离线应用。

**[在线使用 →](https://redcarpg.github.io/ChroniQ/)** · [中文 Spec](docs/SPEC.zh-CN.md) · [English Spec](docs/SPEC.en.md)

## 能做什么

| 页面 | 主要功能 |
| --- | --- |
| 日历 | 月 / 周 / 年视图，农历、节气、月相、干支、宜忌，中法节假日及已保存命盘的重要日期 |
| 天象 | 按时间和地点绘制天空，西方星座、中国星官与二十八宿，天体轨迹、升落时刻及历史轨迹 |
| 观月 | 月球球面、月相、天平动及当地月出月落 |
| 太阳系 | 行星轨道与位置、距离、光行时及顺逆行，支持时间播放 |
| 八字 | 四柱、十神、神煞、大运流年与细分岁运，可选真太阳时及流派规则 |
| 紫微斗数 | 十二宫、星曜、四化飞星及多级运限，支持流派切换 |
| 西洋星盘 | 本命、行运、推运、合盘与组合盘，可选宫位制等计算设置 |

还支持保存命盘、分享链接、图片导出与打印；提供中英文界面、繁简专有名词、深浅主题、显示大小及音效设置。

<table>
  <tr>
    <td width="50%"><img src="docs/images/calendar.jpg" alt="日历页面" /><br /><b>日历</b></td>
    <td width="50%"><img src="docs/images/sky.jpg" alt="天象页面" /><br /><b>天象</b></td>
  </tr>
  <tr>
    <td><img src="docs/images/bazi.jpg" alt="八字排盘页面" /><br /><b>八字</b></td>
    <td><img src="docs/images/ziwei.jpg" alt="紫微斗数页面" /><br /><b>紫微斗数</b></td>
  </tr>
  <tr>
    <td><img src="docs/images/star.jpg" alt="西洋星盘页面" /><br /><b>星盘</b></td>
    <td>截图用于展示主要页面；具体功能与交互以当前版本及 Spec 为准。</td>
  </tr>
</table>

## 本地开发

推荐使用 Node.js 22（与 CI 一致）及 npm。在仓库根目录执行：

```bash
npm ci
npm run dev
```

```bash
npm test           # Vitest 测试
npm run typecheck  # TypeScript 检查
npm run build      # 类型检查并生成 dist/
npm run preview    # 预览生产构建
```

项目使用 React 19、TypeScript 和 Vite，没有后端或数据库，无需配置 API 密钥。开发服务器不注册 Service Worker；离线与版本更新需用生产构建验证。`legacy/` 是旧版参考实现。

## 隐私与离线

出生信息、命盘和偏好保存在当前浏览器的本地存储中，不提供账号或云端同步。分享链接的 `#` 片段包含出生数据和可选地点，接收者可以读取这些内容；链接本身不是加密存储。

生产版本通过 Service Worker 缓存应用资源，首次联网加载并完成缓存后可离线使用。部分字体切片和高分辨率月球贴图按需缓存，未缓存时使用备用字体或较低分辨率资源。新版本等待旧版页面全部关闭后激活。

## 文档

- **Spec：[中文](docs/SPEC.zh-CN.md) / [English](docs/SPEC.en.md)**：产品范围、数据契约、技术约束与验收标准。
- [功能详解](docs/features.md)：各页面的使用方式。
- [流派说明](docs/schools.md)：不同取法、实现与出处。
- [开发指南](docs/development.md)：目录结构、翻译、生成脚本和离线开发。

推送到 `main` 后，GitHub Actions 会测试、构建并部署到 GitHub Pages；PR 执行测试和构建，不部署。

## 致谢

历法与八字：[tyme4ts](https://github.com/6tail/tyme4ts) · 紫微斗数：[iztro](https://github.com/SylarLong/iztro) · 星体位置：[astronomy-engine](https://github.com/cosinekitty/astronomy) · 星表：[d3-celestial](https://github.com/ofrohn/d3-celestial)

字体：[Noto Serif SC](https://fonts.google.com/noto/specimen/Noto+Serif+SC) / [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond)（SIL Open Font License）。月球贴图来源见 [资源说明](src/assets/moon/README.md)。

> 命理内容仅供文化参考。
