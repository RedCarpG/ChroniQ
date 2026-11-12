# src/lib 里的第三方数据 / Third-party data in src/lib

`src/lib/` 的代码以 MIT 发布（见同目录的 [LICENSE](LICENSE)）。下面这些文件全部或部分来自第三方数据，**遵守原数据的许可，不是 MIT**，或者在 MIT 之外还要保留原作者的署名。

The code in `src/lib/` is MIT (see [LICENSE](LICENSE)). The files below are wholly or partly derived from third-party data. They **stay under the original data's license rather than MIT**, or require the original attribution in addition to MIT.

## 不是 MIT 的文件 / Files that are not MIT

| 文件 / File | 来源 / Source | 许可 / License |
|---|---|---|
| `xingguan.ts` | [d3-celestial](https://github.com/ofrohn/d3-celestial) 的 `constellations.lines.cn.json`、`constellations.cn.json`，源自 [Stellarium](https://github.com/Stellarium/stellarium/tree/master/skycultures/chinese) 的 chinese sky culture | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)（相同方式共享 / share-alike） |
| `messierData.ts` | 天体数据来自 [d3-celestial](https://github.com/ofrohn/d3-celestial) 的 `data/messier.json`（BSD-3-Clause，© 2015 Olaf Frohn）；位置角来自 [OpenNGC](https://github.com/mattiaverga/OpenNGC)（Mattia Verga） | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)（因含 OpenNGC 数据 / because of the OpenNGC data） |

## MIT，但要保留原作者署名 / MIT, with the upstream notice kept

| 文件 / File | 来源 / Source | 原许可 / Upstream license |
|---|---|---|
| `brightStars.ts`、`faintStars.ts`（由 `scripts/gen-stars.ts` 生成） | [d3-celestial](https://github.com/ofrohn/d3-celestial) 的 `stars.6.json`；星表数据来自 XHIP（Anderson & Francis 2012） | BSD-3-Clause，© 2015 Olaf Frohn |
| `constellations.ts`（由 `scripts/gen-constellations.ts` 生成） | [d3-celestial](https://github.com/ofrohn/d3-celestial) 的 `constellations.lines.json`、`constellations.json` | BSD-3-Clause，© 2015 Olaf Frohn |
| `eclipticStars.ts` | 由 `brightStars.ts`、`constellations.ts` 计算得到 / computed from them | 同上 / as above |
| `tradChars.ts`、`hantFixes.ts`（由 `scripts/gen-trad.ts` 生成） | [OpenCC](https://github.com/BYVoid/OpenCC) 的简繁转换（cn → t）结果 | Apache-2.0，© BYVoid |

BSD-3-Clause 要求再分发时保留版权声明、条款和免责声明；全文见 [d3-celestial 的 LICENSE](https://github.com/ofrohn/d3-celestial/blob/master/LICENSE)。Apache-2.0 全文见 [OpenCC 的 LICENSE](https://github.com/BYVoid/OpenCC/blob/master/LICENSE)。

BSD-3-Clause requires keeping the copyright notice, conditions and disclaimer when redistributing; Apache-2.0 requires keeping its notice. Full texts are linked above.

## 事实数据，没有额外许可 / Factual data, no extra license

| 文件 / File | 来源 / Source |
|---|---|
| `moonFeatures.ts` | 月面地名、位置和大小来自 [IAU Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/)；探测任务资料来自 NASA 和 CNSA 的公开记录。说明文字为本项目自撰 / descriptions written for this project |
| `worldCities.ts` | 城市中心坐标（取到 0.01°）和 IANA 时区，本项目自行整理 / compiled for this project |
| `regionHolidays.ts` | 各国节日规则，本项目自行整理 / compiled for this project |

## 运行时依赖 / Runtime libraries

计算用到的库（[tyme4ts](https://github.com/6tail/tyme4ts)、[iztro](https://github.com/SylarLong/iztro)、[astronomy-engine](https://github.com/cosinekitty/astronomy) 等）不在本目录，各自以 MIT 发布，作为依赖安装。

The libraries used for the calculations (tyme4ts, iztro, astronomy-engine and others) are not in this directory; each is MIT and installed as a dependency.
