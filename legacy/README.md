# 旧版：Web-JavaScript-Calendar（2021–2022）

这里保存的是本项目重写成「星曆 ChroniQ」（曾名「时契」）之前的实现，只作参考，不再维护。原版的最后一次提交是 [`6b2dac9`](https://github.com/RedCarpG/ChroniQ/tree/6b2dac9)（2022 年 1 月 11 日，合并 PR #1 `dev_calendar`）。

## 当时的样子

一个深色主题的单月日历：顶部切换年份和月份，下面是从周日开始的 6×7 日期格。每格显示公历日期和农历日，逢初一显示月名，逢节气、节日用彩色字标出（如小寒、腊八节、除夕、春节）。今天用黑底白字高亮。

| 桌面端 | 点击日期后 | 手机端 |
|---|---|---|
| ![桌面端](screenshots/desktop.png) | ![点击日期](screenshots/desktop-day-clicked.png) | ![手机端](screenshots/mobile.png) |

点击某一天，会在那一行下面展开一个详情区域，用小三角指向被点的日期，但详情里还没有内容（见下文「未完成的部分」）。

> 截图条件：用 `6b2dac9` 的原始代码（包括当时的 `lunar.js`），系统时间固定为 2022-01-11，即最后一次提交的日期。原样式用的 Segoe UI 是 Windows 字体，截图环境里没有，所以字体和当年在 Windows 上看到的略有不同。

## 技术栈

- **后端**：Node.js + Express 4，用 EJS 渲染唯一的页面 `views/index.ejs`；端口写死为 8080（`config.js`）
- **前端**：原生 JavaScript，`public/javascripts/calendar.js` 里的 `Calendar` 类负责绘制和切换月份
- **日期**：moment.js 2.18.1（从 CDN 引入）
- **农历**：6tail 的 `lunar.js`，以单文件形式放进仓库，并手动打了一个时区补丁
- **样式**：SCSS（`public/scss/`），用 `node-sass` 编译到 `public/stylesheets/`

## 目录

```
app.js / bin/www          Express 入口
config.js                 端口、MySQL 和 session 配置（实际都没用上）
routes/                   首页和 404/错误页
views/                    index.ejs、error.ejs
public/javascripts/
  calendar.js             日历主逻辑
  lunar.js                农历库（现已换成上游 1.7.7，见下文）
  bazi.js                 八字数据表：天干地支、十神简称、刑冲合会（未接入页面）
  common.js               createElement 工具函数
public/scss/              样式源文件
index.html                更早期的静态页面，引用的文件已不存在
```

## 未完成的部分和已知问题

重写前我们对这份代码做过一次检查，主要发现：

1. **八字功能没接上**：`bazi.js` 已经写了数据表，但页面没有引入它，`#bazi` 容器是空的。
2. **点击日期的详情面板是空的**：`calendar.js` 里的图例选择器少写了 `.`（`querySelector('chosen-year')`），`activeDate.getFullYear` 也没加括号调用，而且 moment 对象本来就没有这个方法。
3. **手机端宽度溢出**：日历宽度固定，手机上周六那一列会被裁掉（见手机端截图）。
4. **lunar.js 的时区补丁有 bug**：`setMinutes(hour)` 把小时当成了分钟，`date` 是没有声明的全局变量。
5. **依赖臃肿**：`package.json` 把间接依赖也全列了进来；`bcrypt` 只被 require、没有实际使用；`config.js` 里写死了 MySQL 账号密码。
6. 根目录的 `index.html` 已经失效。

这些问题在新版里随着重写都不存在了：农历改用同一作者的新一代库 [tyme4ts](https://github.com/6tail/tyme4ts)，八字排盘也已经完整实现。

## 重写后对这个目录做的改动

- 整个旧版从仓库根目录移到了 `legacy/`，用的是 `git mv`，历史记录都在。
- `public/javascripts/lunar.js` 换成了上游 [lunar-javascript](https://github.com/6tail/lunar-javascript) 1.7.7（MIT，协议见 `LICENSE.lunar-javascript`），去掉了有问题的手动补丁，旧代码用到的接口都还能用。
- 新增了本说明和 `screenshots/`。

## 运行旧版

```bash
cd legacy
npm install
npm start        # http://localhost:8080
```

`package.json` 里锁的依赖比较老，`bcrypt` 需要本地编译环境；如果只是想看界面，可以直接用任意静态服务器打开 `views/index.ejs`（它里面没有模板标签）。
