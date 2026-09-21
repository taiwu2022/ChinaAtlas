# China Atlas

[打开网页](https://taiwu2022.github.io/ChinaAtlas/) · 中文为主，保留英文术语与人名。

一个可以随手翻阅的中国政治生态资料库：制度结构、人物履历、地方任职、职业经历交集和任免历史。重点覆盖中央、经济金融部门和山东；济宁进一步深入市级部门、11个县市区、功能区与两院任免。

## 手机使用

直接打开上面的网页即可使用，不需要启动电脑，也不需要 API key。

- 底部切换总览、人物、地方、关系、任免和阅读。
- 总览直接展开中央工作机关及其人员；[国务院机关视图](https://taiwu2022.github.io/ChinaAtlas/#map?diagram=state)区分组成部门、直属机构、直属特设机构，并向下展示部委管理的国家局。
- 每页顶部都能搜索全库人物和机构，输入姓名、单位或“央行”等简称会出现候选；支持中英文与空格组合关键词。同名人物显示单位或出生年份，点击后打开具体档案。
- 人物页保留折叠筛选；详情突出职务、职责和经历，完整核对说明集中在“资料与来源”。重要处分、身份歧义和来源冲突仍直接标出。
- 关系网的中心人物和两人对照使用相同的全库候选搜索；详情可逐层返回，人物链接可以分享。
- 已为 17 位主要人物加入官方来源照片，只在打开个人档案时加载。照片旁可查看原网页；没有照片或图片暂时不可用时保持文字档案。
- iPhone 可在 Safari 的分享菜单中选“添加到主屏幕”；其他浏览器可使用对应的桌面快捷方式选项。页面需要联网读取最新发布的资料。
- 我的笔记仅保存在**当前浏览器**。换设备时导出笔记 JSON，再在另一台设备导入。不同内容会合并保留；清除浏览器数据会清除笔记。桌面快捷方式和普通浏览器可能有独立存储，首次切换请检查笔记。

网页是已经核对资料的发布快照，不会自动把新闻标题变成人物任职。每条资料保留原文和日期；同地经历、同机构任期交集与公开活动分开显示，不推断私人关系。

## 济宁资料扩充

截至 2026-09-21，济宁相关 **629 条人物身份记录、923 段任职记录、210 个关联来源**。同名待核记录暂时分开，所以记录数不等于独立自然人数，也不是现任官员总数。

- 地方页可切换本级／下辖地区，按领域和资料依据筛选；“全部记录”保留历史与待核资料。
- 近期具名履职、无日期名册、历史任免、来源冲突分别显示；未知任职日期保持空缺。
- 组织部公开信息、市政府部门目录、人大任免及法院检察院原文是主要依据；原文不可读的少量线索明确标为未核实。
- “已覆盖与待补充”记录缺口；人物详情可查看来源与同名身份候选。
- 大地区关系按当前人物展开，避免全库生成所有同地人名组合；已用 1,000 条合成档案验证存储规模。

最近一轮新增 16 条身份记录、36 段履历和 16 条任职／纪律司法事件，核对济宁纪委监委交接及组织、住建资料。详见 [状态标记与部门更新](docs/STATUS_REVIEW_2026-09-21.md)。此前的履历关系修正见 [网络复核记录](docs/NETWORK_REVIEW_2026-09-21.md)。

后续维护规则见 [数据模型](docs/DATA_MODEL.md)。

## 状态记录与部门浏览

- 人物档案保留任职变动、党纪、政务处分、组织处理、军籍、调查、司法和代表资格的独立时间线。公告日与决定／生效日分开，待追认和未知日期保留。没有记录不等于未受处分。
- 党籍、军籍、公职分别标记；免职不自动变成处分，调查和移送不等于起诉或定罪。完整维护规则见 [人物状态模型](docs/PERSONNEL_STATUS_MODEL.md)。
- 在“人物 → 按部门找人”选择领域、地区和具体单位，查看本单位现任／曾任／待核人员。地方页也有“按部门看人”入口；部门包含历史履历记录，主题分组不表示隶属关系。

## 来源与核验

- [信息来源与检索方法](docs/SOURCE_SEARCH_METHODS.md)：网站清单、查询式、原文取证步骤和以后补充网站的模板。
- [新增查询渠道核查](docs/SOURCE_CHANNEL_REVIEW_2026-09-21.md)：核对用户提供的 DeepSeek 建议，整理山东／济宁、中央任免、人物库和待评估商业数据；区分已读原文、搜索线索与供应商自述。
- [来源全量盘点](docs/SOURCE_INVENTORY.md)：516 个来源编号、483 个网址；不同链接仍可能同源转载。
- [中央工作机关核对](docs/WORKING_AGENCIES_2026-09-21.md)：国务院及中央工作机关展开方式、央行与外汇局的隶属关系和本轮范围。
- [准确性检查方法](docs/ACCURACY_METHOD.md)与[本次复核队列](docs/ACCURACY_REPORT.md)：一致性错误、待核线索和证据缺口分开；检查通过不等于事实全部正确。
- [常用入口配置](data/source-catalog.json)：以后可继续添加网站；当前未新增定时爬虫。

人物详情有逐条出处的“背景资料”，现有五个档案、33 条出生、教育及早期履历事实。任职时间轴展示结构化履历；关系网可搜索并对照两个人，直接查看每项交集的依据。制度页的“资料怎么核实与更新”可直接打开上述说明。

## 开发与维护

Python 3.10+ 构建，无 npm 依赖；Node 18+ 用于回归测试。

```sh
python3 scripts/audit_data.py
python3 scripts/accuracy_report.py --as-of 2026-09-21
python3 scripts/source_inventory.py --as-of 2026-09-21
python3 scripts/build.py
python3 -m http.server 8080 --directory site
python3 -m unittest discover -s tests -p 'test_*.py'
node tests/portable.cjs
node tests/navigation.cjs
node tests/frontend.cjs
node tests/portraits.cjs
node tests/personnel.cjs
node tests/search.cjs
node tests/profile-reading.cjs
```

- `web/`：共享前端，默认本地模式；构建时切换为静态公开模式。
- `data/atlas.json`：审核过的公开资料；`data/evidence.json`：简短核对摘录。
- `data/portraits.json`：按人物 ID 核对的官方照片链接、原文、姓名对应依据及核对日期。图片从原站加载，不将原图复制进仓库；公开可访问不代表开放许可。照片来源日期与现任职务分开理解。
- `scripts/export_public.py`：从本地维护数据库的 **merged view** 白名单导出；不上传 SQLite、私人笔记、本地路径、课程资料或完整网页存档。
- `site/`：每次重新生成的发布目录，不提交到源代码分支。

在维护版完成事实核对后导出，再运行测试和构建：

```sh
python3 scripts/export_public.py --source /path/to/local/ChinaAtlas
```

来源、日期精度、历史任职与身份 ID 必须保留。新公告须先人工/AI 对照原文核实，再维护本地数据库和公开快照。公开版“复制 AI 问题”只生成供 Codex 讨论的文字，不会发送个人笔记。

## 发布

源码在 `main` / `codex/*`，静态产物单独发布到 `gh-pages` 根目录。GitHub Pages 配置为分支发布，使用 `.nojekyll`；没有自定义 Actions workflow。发布产物中的 `build-info.json` 记录对应源码提交和数据版本。

首次手机版以 PR 供审阅，同一提交生成的网页已单独部署；**PR 未合并不影响访问网页**。后续修改应先审查、测试、提交，再用该提交构建并更新 `gh-pages`。不要把整个本地维护目录推送到 GitHub。

[GitHub Pages 分支发布说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [Apple 主屏幕入口说明](https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios)
