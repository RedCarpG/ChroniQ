// English for text shared across the app: the top bar, settings, menus and
// buttons used on several pages.
export const COMMON: Record<string, string> = {
  // Settings
  设置: 'Settings',
  语言: 'Language',
  中文: '中文',
  English: 'English',
  颜色模式: 'Colour mode',
  跟随系统: 'System',
  音效: 'Sounds',
  开: 'On',
  关: 'Off',
  浅色: 'Light',
  深色: 'Dark',
  专有名词: 'Chinese terms',
  繁體: '繁體',
  简体: '简体',
  每周起始: 'Week starts on',
  周一: 'Monday',
  周日: 'Sunday',
  日历显示日干支: 'Day 干支 in calendar',
  日历显示月相: 'Moon phases in calendar',
  日历显示斗柄指月: 'Dipper in calendar',
  命盘背景: 'Chart backdrop',
  生辰星空: 'Sky at birth',
  普通星空: 'Plain stars',
  其他地区节日: 'Other holidays',
  不显示: 'Off',
  法国: 'France',
  显示: 'Display',
  // The top bar on the 天象 page, folded up and pulled down
  展开标题栏: 'Show the top bar',
  收起标题栏: 'Hide the top bar',
  // The footer, kept under the bottom edge
  展开页脚: 'Show the footer',
  收起页脚: 'Hide the footer',
  隐藏: 'Hide',
  紫微星曜配色: '紫微 star colours',
  按五行: 'By element',
  按吉凶: 'By fortune',
  显示大小: 'Display size',
  自动: 'Auto',
  标准: 'Standard',
  大: 'Large',
  特大: 'Extra large',

  // Top bar: page menu
  页面: 'Pages',
  历法: 'Calendar & sky',
  命理: 'Destiny charts',
  日历: 'Calendar',
  天象: 'Sky',
  八字排盘: '八字',
  紫微斗数: '紫微斗数',
  星盘: 'Astrology',
  '公历、农历、节气、干支': 'Gregorian and lunar dates, 节气, 干支',
  '此刻天空、星座与星官': 'The sky now, with its constellations and 星官',
  '行星的轨道、距离与顺逆行': 'The planets on their orbits: distances, retrograde motion',
  '四柱、十神、神煞、大运流年': 'Four Pillars: 四柱, 十神, 神煞, 大运 and 流年',
  '十二宫、四化飞星、运限': 'Purple Star: 十二宫, 四化 flying stars, 运限',
  '本命、行运推运、合盘、组合盘': 'Natal, transits and progressions, synastry, composite',

  // Top bar: share and export
  '星曆 ChroniQ 命盘': '星曆 ChroniQ chart',
  '链接已复制，打开即是这张命盘': 'Link copied: it opens this chart',
  '复制这个链接分享命盘：': 'Copy this link to share the chart:',
  分享命盘链接: 'Share a link to this chart',
  图片已保存: 'Image saved',
  '图片保存失败，请改用打印': 'Couldn’t save the image; try printing instead',
  导出命盘: 'Export chart',
  '导出命盘：保存为图片或打印': 'Export chart: save as an image or print',
  保存为图片: 'Save as image',
  打印: 'Print',

  // Saved charts drawer
  已保存的命盘: 'Saved charts',
  收起: 'Hide',
  命盘名称: 'Chart name',
  '已保存为「{name}」': 'Saved as “{name}”',
  '为当前命盘命名（可选）': 'Name this chart (optional)',
  更新: 'Update',
  保存: 'Save',
  '删除{name}': 'Delete {name}',
  '还没有保存的命盘。填好出生信息后，在上面命名并保存。':
    'No saved charts yet. Fill in the birth details, then name and save the chart above.',
  '命盘只保存在本机浏览器中，不会上传。': 'Charts are kept only in this browser and never uploaded.',
  命盘: 'Charts',
  '命盘{n}': 'Chart {n}',
  男: 'Male',
  女: 'Female',
  '（真太阳时）': ' (true solar time)',

  // Section tabs on the left edge
  页面导航: 'Page sections',
  回到顶端: 'Back to top',
  到达底端: 'Go to bottom',

  // Loading screen
  正在加载: 'Loading',

  // Footer and About panel
  '离线中 · 排盘与天象照常可用': 'Offline · charts and the sky still work',
  '历法数据由 {lib} 提供 · 仅供参考': 'Calendar data from {lib} · for reference only',
  '中国传统历法与命理排盘的网页工具，打开即用，不需要注册。':
    'A web tool for the traditional Chinese calendar and destiny charts. Just open it and go: no sign-up.',
  '：公历、农历、节气、干支，月 / 周 / 年视图': ': Gregorian and lunar dates, 节气 and 干支, in month, week and year views',
  '：此刻天空的星图，星座与星官，可拖动转动时间': ': a map of the sky right now, with its constellations and 星官; drag it to turn time',
  '：行星在轨道上的位置与运行': ': the planets moving on their orbits',
  '：四柱、十神、神煞、刑冲合会、{dayun}流年流月流日': ': 四柱, 十神, 神煞, 刑冲合会, and {dayun}, 流年, 流月 and 流日',
  '：十二宫命盘、{sanfang}、星曜解释、大限至流时': ': the 十二宫 chart, {sanfang}, star meanings, and 大限 down to 流时',
  '：西洋占星本命盘，行星、宫位与相位，行运、推运、合盘与组合盘':
    ': Western natal charts with planets, houses and aspects; transits, progressions, synastry and composite charts',
  '不同流派的取法可在「流派设置」中切换，并注明出处。命盘只保存在你自己的浏览器里，不会上传。结果仅供参考。':
    'Where schools differ, you can switch methods in the school settings, each with its source. Charts are kept only in your own browser and never uploaded. Results are for reference only.',
  '✓ 已作为应用安装，离线也能使用。': '✓ Installed as an app; it works offline too.',
  '安装到桌面 / 主屏幕': 'Install on desktop / home screen',
  '像应用一样打开，离线也能使用。': 'Opens like an app, and works offline.',
  '安装到主屏幕：在 Safari 中点「分享」→「添加到主屏幕」。打开过一次后，离线也能使用。':
    'To install, tap Share → Add to Home Screen in Safari. Once opened, it works offline too.',
  '打开过一次后，离线也能使用；支持的浏览器可从地址栏安装为应用。':
    'Once opened, it works offline; browsers that support it can install it as an app from the address bar.',
  'GitHub 源代码': 'Source on GitHub',
  流派说明: 'About the schools',
  反馈问题: 'Report a problem',
  '制作：{author} · 历法 {tyme} · 紫微 {iztro} · 星盘 {astronomy}':
    'Made by {author} · calendar {tyme} · 紫微 {iztro} · astrology {astronomy}',
  '该本地时间因夏令时跳变而不存在，请选择其他时间。': 'This local time does not exist due to a clock change. Please choose another time.',
  '该时间因夏令时回拨出现两次，采用较早的一次。': 'This time occurs twice after a clock change. The earlier occurrence is used.',
  '页面加载失败，请重试或刷新页面。': 'The page could not be loaded. Try again or reload the page.',
  '刷新页面': 'Reload page',
  '星盘日期计算失败，请重试。': 'Chart dates could not be calculated. Please try again.',
  '重试': 'Try again',
}
