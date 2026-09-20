# 资料准确性复核清单

审计时点：2026-09-21。只读一致性与证据缺口检查；未联网、未逐条重读原文，也不证明未标记资料必然正确。

规则命中次数不是错误人数；一条资料可触发多项。`error` 是结构/逻辑问题，`review` 是待查线索，`gap` 是证据记录缺口，`info` 是引用提示。

| 检查层 | 命中条数 |
| --- | ---: |
| error | 0 |
| review | 30 |
| gap | 819 |
| info | 14 |

现有 461 个来源编号，对应 433 个去片段网址。不同网址仍可能转载同一原文，不能据此计算“独立证据数”。

完整队列见 [accuracy-report.json](../reports/accuracy-report.json)。下列每条规则最多列三个例子。

## 旧日期字段混有说明文字 · 5

- [李干杰](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=li-ganjie)：since: 2025-04（公开报道确认）；需拆分日期与观察口径，不自动截取
- [李干杰](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=li-ganjie)：since: 2023年已公开任职；需拆分日期与观察口径，不自动截取
- [石泰峰](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=shi-taifeng)：since: 2025-04（公开报道确认）；需拆分日期与观察口径，不自动截取

## 已记录的来源冲突 · 3

- [胡国梁](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=jining-fb909af73d7a)：单位归属/同名待核：自然资源领导目录列此职务，2026-04-23法院会议报道另称“市市场监督管理局党组成员、副局长胡国梁”。尚未核准为同一人、何时转任或报道沿用旧称，不能据此确认调任。
- [殷宪龙](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=jining-judicial-7f04ccc310a5)：党组成员一职尚无免任证据，但因同条职务网页未同步更新，暂不列现任。
- [刘光](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=jining-liangshan-5ffaa3e278)：同一官网目录标题为“党组副书记、副局长”，任职简历写“2024年4月任…党组副书记、局长”；行政职务原文冲突，待核。

## 未核实线索 · 5

- [王庆明](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=jining-qufu-1c9748ed94)：最近具名证据为2026-07-29；记录该时点职务，不将报道日期当作任职起点。 原始网页抓取失败；此前仅搜索结果/工具缓存可读，待复核。
- [储艳丽](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=jining-qufu-72f4457490)：最近具名证据为2026-07-29；记录该时点职务，不将报道日期当作任职起点。 原始网页抓取失败；此前仅搜索结果/工具缓存可读，待复核。
- [翟绪军](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=jining-qufu-789f2a1c7d)：最近具名证据为2026-07-29；记录该时点职务，不将报道日期当作任职起点。 原始网页抓取失败；此前仅搜索结果/工具缓存可读，待复核。

## 同名身份待核 · 22

- [王建](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=jining-20e1081ee134)：候选 ID：jining-20e1081ee134、jining-weishan-e68c49b0c2；不得仅按姓名合并
- [房崇炬](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=jining-judicial-0d3cb56f853f)：候选 ID：jining-judicial-0d3cb56f853f、jining-judicial-0d3cb56f853f-5ea5d4；不得仅按姓名合并
- [屈庆东](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=jining-judicial-0d8d6a6d79c2)：候选 ID：jining-jiaxiang-0d8d6a6d79、jining-judicial-0d8d6a6d79c2、jining-judicial-0d8d6a6d79c2-3b446c；不得仅按姓名合并

## 早期职务未标注证据类别 · 171

- [蔡奇](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=cai-qi)：中共中央政治局常务委员会委员
- [蔡奇](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=cai-qi)：中共中央书记处书记
- [蔡奇](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=cai-qi)：中共中央办公厅主任

## 现任职务缺少独立证据日期 · 106

- [蔡奇](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=cai-qi)：中共中央政治局常务委员会委员
- [蔡奇](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=cai-qi)：中共中央书记处书记
- [蔡奇](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id=cai-qi)：中共中央办公厅主任

## 来源尚无短摘录 · 214

- `audit-cefac-20250701`：缺少便于逐字复查的公开短摘录；有链接不等于已证明
- `audit-cfc-li-20231120`：缺少便于逐字复查的公开短摘录；有链接不等于已证明
- `audit-cfc-li-20240521`：缺少便于逐字复查的公开短摘录；有链接不等于已证明

## 来源类型尚未标注 · 323

- `audit-cefac-20250701`：旧来源待分类；并非自动降为不可靠
- `audit-cfc-li-20231120`：旧来源待分类；并非自动降为不可靠
- `audit-cfc-li-20240521`：旧来源待分类；并非自动降为不可靠

## 多个来源编号指向同一网页 · 14

- `eco-nda-rank`：https://www.nda.gov.cn/sjj/jgsz/gjsjj/1212/20241212111533730775955_pc.html；可以分段引用，只计一个网页来源
- `eco-sasac-rank`：https://ysp.net.sasac.gov.cn/n2588020/index.html；可以分段引用，只计一个网页来源
- `liu-jinguo-current`：https://www.xinhuanet.com/politics/leaders/20260828/98513d6ad8464aa880d0e0a44e0d4eaa/c.html；可以分段引用，只计一个网页来源

## 如何处理

优先复核结构错误、冲突与同名候选，再补现任证据日期。无日期名册保持待核；查不到离任公告不能补造结束时间。来源打不开只记录可用性，不删除历史事实。

先比较精确岗位、人物身份和事件时间，找到原始任免/简历，再记录更正原因与旧值；网页快照和结构检查均不能替代这一过程。

输入数据 SHA-256：`fceed983ba9d72a2c1da8c24809876afdf45cf2c1bd1c8fadde8cc5584df375c`；证据摘录 SHA-256：`4b7dbba0f32d28aaf0b0bc84bc2812a817a1834eacd44d6818a23cacdf081e76`。
