# 人物状态事件

`status_events` 保存**带来源、日期与核验状态的原子历史动作**，不保存自动推断的“最新总状态”。一个公告涉及开除党籍、开除军籍、取消军衔和移送审查起诉时，分别记录四条。处分、任免和司法程序并不互相替代；调查和移送不表示定罪。

旧快照缺少此集合等同空数组。事件不会自动改写人物职务、个人等级、任期、网络或 SQLite 任免账本；岗位更正仍须独立核对精确机构、标题与日期。缺少离任原因不得从其他事件补造原因。

## 字段

| 字段 | 约束和含义 |
| --- | --- |
| `id`, `person_id` | 稳定事件 ID 与已存在人物 ID；姓名不是身份键。 |
| `category`, `code` | 下表中的合法组合，每条只记录一个动作。 |
| `label`, `description` | 非空的公开标签与简短事实描述；保留原文法律/程序措辞，同类代码不代表完全相同的法律决定。 |
| `announced_at` | 必需，公告时间；支持 YYYY、YYYY-MM、YYYY-MM-DD，不能用抓取日期代替。 |
| `effective_at` | 原文明确的生效/决定时间，可空；可早于或晚于公告日，不是任期结束日期。 |
| `date_note` | 日期精度、公告与决定日期差异的说明，可空。 |
| `source_ids` | 必需、非空、全部已存在。待核线索同样不能无源入库。 |
| `org_ids` | 涉及的确切机构 ID 数组，可缺省为空；不因此自动生成领导或任职关系。 |
| `evidence_status` | `verified` / `unverified` / `conflicting`；后两者只是线索或已记录冲突。 |
| `decision_authority` | 决定机关的原文表述，可空；不得从调查机关推断决定机关。 |
| `procedure_note` | 具体程序、核准/追认/审判阶段、原文限定；可空，但显式更正必须填写依据。 |
| `reviewed_at` | 必需，完整 YYYY-MM-DD，表示核对资料的日期，不刷新职务有效性。 |
| `supersedes_event_ids` | 可选，只用于有明确原文支持的撤销或更正，不用于普通后续发展；旧事件保留。 |

例如 9 月 21 日公告说“此前已开除军籍”，记录 `announced_at=YYYY-09-21`、`effective_at=null` 并在 `date_note` 保留“此前，具体日期未披露”。不能把公告日期回填为处分日期。

`supersedes_event_ids` 必须指向同一人物的其他已存在事件，当前更正须为 `verified` 并有 `procedure_note`，更正公告不能明确早于原公告。自指、循环、未知 ID 均拒绝。留党察看后的恢复党员权利是新动作，不撤销曾经受处分的事实；不起诉或无罪也不自动删除此前调查历史。

## 受控词表

代码是本库的阅读分类，不是法律条文穷举。标签和程序说明必须忠实于具体原文；尤其不能把组织处理免职、政务处分撤职和一般职务免除混成一条。

| category | code | 阅读含义 / 界限 |
| --- | --- | --- |
| `office_change` | `appointed` | 明确任命、选举或决定任职；方式保留在 label/procedure_note。 |
| `office_change` | `office_removed` | 精确职务被免除；不推断处分或原因。 |
| `office_change` | `resigned` | 明确辞职及相应接受/批准事实。 |
| `office_change` | `retired` | 明示退休，不能根据年龄推断。 |
| `office_change` | `term_ended` | 明示任期届满，不按日期计算自动生成。 |
| `office_change` | `transferred` | 明示调任；不自动终止其他兼任职务。 |
| `office_change` | `deceased` | 明示逝世的公共历史记录；此分类仅为阅读归类，不是处分。 |
| `party_discipline` | `party_warning` | 党内警告。 |
| `party_discipline` | `serious_party_warning` | 党内严重警告。 |
| `party_discipline` | `party_posts_removed` | 撤销党内职务，不等同行政免职。 |
| `party_discipline` | `party_probation` | 留党察看，期限与程序照原文记录。 |
| `party_discipline` | `expelled_party` | 开除党籍。 |
| `party_discipline` | `party_rights_restored` | 恢复党员权利，不等同重新入党，不删除留党察看历史。 |
| `administrative_discipline` | `administrative_warning` | 政务/行政处分警告，具体适用制度保留原文。 |
| `administrative_discipline` | `demerit` | 记过。 |
| `administrative_discipline` | `major_demerit` | 记大过。 |
| `administrative_discipline` | `demoted` | 降级处分。 |
| `administrative_discipline` | `administrative_removed` | 撤职处分。 |
| `administrative_discipline` | `dismissed_public_office` | 开除公职，不等同开除党籍。 |
| `organization_action` | `suspended` | 停职检查，不当作确定免职。 |
| `organization_action` | `duties_adjusted` | 调整职务。 |
| `organization_action` | `ordered_resignation` | 责令辞职。 |
| `organization_action` | `organizational_removed` | 组织处理中的免职。 |
| `organization_action` | `organizational_demoted` | 组织处理中的降职，不等同降级处分。 |
| `military_status` | `expelled_military` | 开除军籍。 |
| `military_status` | `rank_revoked` | 原文明示取消/剥夺军衔；标签保留原词及决定机关。 |
| `military_status` | `retired_from_service` | 退出现役，不等同开除军籍。 |
| `investigation` | `investigation_opened` | 宣布开展调查；注明纪律审查、监察调查或司法调查，不推断罪名成立。 |
| `investigation` | `investigation_closed` | 明示调查终结，不等同撤案、无责任或定罪。 |
| `judicial` | `referred_for_prosecution` | 移送检察机关审查起诉，不等于已起诉。 |
| `judicial` | `prosecution_filed` | 已提起公诉，不等于有罪判决。 |
| `judicial` | `convicted` | 有罪判决；审级、生效状态和刑罚保留原文。 |
| `judicial` | `acquitted` | 无罪判决，审级和效力照原文。 |
| `judicial` | `case_dismissed` | 明示撤案、撤诉或不起诉等终止程序；标签/程序说明须区别，不等同无罪判决。 |
| `judicial` | `sentence_changed` | 明示刑罚变更，减刑、改判等区别保留原文。 |
| `qualification` | `qualification_terminated` | 人大代表/政协委员等资格终止或撤销，具体资格和动作保留原文。 |
| `qualification` | `qualification_suspended` | 明示暂停具体资格或相关权利，不从调查推断。 |
| `qualification` | `qualification_restored` | 明示恢复具体资格/权利。 |

## 校验与发布边界

`scripts/status_events.py` 与维护应用 `status_events.py` 共享合同。严格 merge 支持新增及 `reviewed_updates` 更正；事件包先合并来源，再校验。失败时整包不改变调用者数据，陈旧 before 值仍拒绝。只修改内存，不写 SQLite。

公开 exporter 使用字段白名单，过滤私有笔记、文件路径和嵌套内部资料；仅事件引用的来源也进入来源闭包。区域导出保存选中人物的全部历史事件，包括已更正事件及其来源、关联机关和跨地区位置。事件本身不会把外地人物归为当地任职。

只读 accuracy audit 使用显式 `--as-of`。无源、未知引用、重复 ID、非法分类、非法日期和更正链为 `error`；未来核对日也为 `error`。待核/冲突以及未来公告或生效日为 `review`，因为预告与发生需要区分。年月精度与审计日重叠时不当作确定未来；来源失效不自动撤销历史事实。
