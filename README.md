# China Atlas

[打开网页](https://taiwu2022.github.io/ChinaAtlas/) · 中文为主，保留英文术语与人名。

一个可以随手翻阅的中国政治生态资料库：制度结构、人物履历、地方任职、职业经历交集和任免历史。首批重点覆盖中央、经济金融部门，以及山东、济宁、济南、青岛。

## 手机使用

直接打开上面的网页即可使用，不需要启动电脑，也不需要 API key。

- 底部切换总览、人物、地方、关系、任免和阅读。
- 人物页支持搜索和折叠筛选；详情可逐层返回，人物链接可以分享。
- 已为 17 位主要人物加入官方来源照片，只在打开个人档案时加载。照片旁可查看原网页；没有照片或图片暂时不可用时保持文字档案。
- iPhone 可在 Safari 的分享菜单中选“添加到主屏幕”；其他浏览器可使用对应的桌面快捷方式选项。页面需要联网读取最新发布的资料。
- 我的笔记仅保存在**当前浏览器**。换设备时导出笔记 JSON，再在另一台设备导入。不同内容会合并保留；清除浏览器数据会清除笔记。桌面快捷方式和普通浏览器可能有独立存储，首次切换请检查笔记。

网页是已经核对资料的发布快照，不会自动把新闻标题变成人物任职。每条资料保留原文和日期；同地经历、同机构任期交集与公开活动分开显示，不推断私人关系。

## 开发与维护

Python 3.10+ 构建，无 npm 依赖；Node 18+ 用于回归测试。

```sh
python3 scripts/build.py
python3 -m http.server 8080 --directory site
python3 -m unittest discover -s tests -p 'test_*.py'
node tests/portable.cjs
node tests/navigation.cjs
node tests/frontend.cjs
node tests/portraits.cjs
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
