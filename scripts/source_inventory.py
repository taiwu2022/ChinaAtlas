"""Regenerate a metadata inventory. Never fetch pages or change source records."""

import argparse
import collections
import datetime as dt
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
FAMILY_BASES = (
    'people.com.cn', '12371.cn', '12371.gov.cn', 'jining.gov.cn',
    'jndq.gov.cn', 'sdcourt.gov.cn', 'dzwww.com', 'iqilu.com',
    'ifeng.com', 'chinatax.gov.cn', 'sasac.gov.cn', 'mofcom.gov.cn',
    'miit.gov.cn',
)
MEDIA_BASES = (
    'people.com.cn', 'xinhuanet.com', 'news.cn', 'dzwww.com', 'iqilu.com',
    'thepaper.cn', 'ifeng.com', 'cnr.cn', 'dailyqd.com', 'qingdaonews.com',
    'qlwb.com.cn', 'nfnews.com', 'rmzxw.com.cn', 'jfdaily.com', 'sohu.com',
    'rznews.cn', 'sznews.com', 'jinantimes.com.cn', 'whnews.cn',
)


def under(host, base):
    return host == base or host.endswith('.' + base)


def url_without_fragment(url):
    """Remove only #fragment; keep query, case, scheme, slash and trailing ?."""
    return url.partition('#')[0]


def site_group(host):
    """Maintenance grouping only, not a publisher/authority certification."""
    if any(under(host, base) for base in ('xinhuanet.com', 'news.cn')):
        return 'xinhua-news'
    for base in FAMILY_BASES:
        if under(host, base):
            return base
    parts = host.split('.')
    size = 3 if host.endswith(('.gov.cn', '.edu.cn', '.com.cn', '.org.cn', '.net.cn')) else 2
    return '.'.join(parts[-size:])


def category_tags(source, host):
    """Heuristics are search aids and must not become verified source types."""
    title = source.get('title_zh') or source.get('title') or ''
    tags = []
    if any(under(host, base) for base in ('wikipedia.org', 'baike.baidu.com')):
        tags.append('encyclopedia')
    if host in ('chinadatalab.ucsd.edu', 'www.isss.pku.edu.cn', 'isss.pku.edu.cn'):
        tags.append('academic_method_or_catalog')
    if any(part in host.split('.') for part in ('zzb', 'jnswzzb', 'jszzb')) or ('组织部' in title and '学' not in title):
        tags.append('organization_department')
    if any(part in host for part in ('renda', 'npc.gov', 'bjrd.gov', 'hnrd.gov', 'qhrd.gov', 'xmrd.gov')):
        tags.append('npc')
    if any(word in title for word in ('任免', '任命', '免职', '选举', '当选', '辞去', '辞职', '任前公示')):
        tags.append('appointment_or_election')
    if any(under(host, base) for base in ('court.gov.cn', 'sdcourt.gov.cn', 'spp.gov.cn', 'jnsjcy.jining.gov.cn')):
        tags.append('judiciary')
    if any(word in title for word in ('领导信息', '领导介绍', '领导简介', '领导班子', '机构职能', '组织机构', '领导目录', '领导栏目', '公开目录', '领导专页')):
        tags.append('government_directory')
    if any(under(host, base) for base in MEDIA_BASES):
        tags.append('news_media')
    if any(word in title for word in ('会议', '调研', '召开', '活动', '座谈', '走访', '开学', '出席', '推进会', '工作报告', '讲话')):
        tags.append('named_public_activity')
    if host.endswith('.edu.cn') and not tags:
        tags.append('academic_institution_news')
    if any(word in title for word in ('章程', '宪法', '条例', '规定', '改革方案', '办法', '制度')):
        tags.append('institutional_rules')
    return tags or ['other_public_reference']


def aggregate(rows, key):
    groups = collections.defaultdict(list)
    for row in rows:
        groups[row[key]].append(row)
    result = []
    for name, members in sorted(groups.items(), key=lambda item: (-len(item[1]), item[0])):
        unique = {}
        for row in sorted(members, key=lambda item: (item['canonical_url'], item['source_id'])):
            unique.setdefault(row['canonical_url'], row)
        result.append({
            'name': name,
            'source_count': len(members),
            'unique_url_count': len(unique),
            'source_ids': sorted(row['source_id'] for row in members),
            'hosts': sorted({row['host'] for row in members}),
            'groups': sorted({row['group'] for row in members}),
            'representative_links': [
                {'source_id': row['source_id'], 'title': row['title'], 'url': row['url']}
                for row in list(unique.values())[:2]
            ],
        })
    return result


def inventory(data, raw, dataset, as_of):
    dt.date.fromisoformat(as_of)
    sources = data.get('sources')
    if not isinstance(sources, list):
        raise ValueError('Input must contain a sources array')
    rows, seen_ids = [], set()
    url_ids = collections.defaultdict(list)
    for source in sources:
        source_id, url = source.get('id'), source.get('url')
        if not isinstance(source_id, str) or not source_id or source_id in seen_ids:
            raise ValueError(f'Missing or duplicate source ID: {source_id!r}')
        if not isinstance(url, str):
            raise ValueError(f'Source URL must be text: {source_id}')
        parsed = urlsplit(url)
        host = (parsed.hostname or '').lower()
        if parsed.scheme.lower() not in ('http', 'https') or not host or parsed.username or parsed.password:
            raise ValueError(f'Source must use a public HTTP(S) URL without credentials: {source_id}')
        seen_ids.add(source_id)
        canonical = url_without_fragment(url)
        url_ids[canonical].append(source_id)
        rows.append({
            'source_id': source_id,
            'title': source.get('title_zh') or source.get('title') or source_id,
            'url': url,
            'canonical_url': canonical,
            'host': host,
            'group': site_group(host),
            'type': source.get('source_type') or 'unclassified',
            'category_tags': category_tags(source, host),
            'classification_status': 'metadata_heuristic_not_verified',
            'published_at': source.get('published_at'),
            'accessed_at': source.get('accessed_at'),
            'has_local_evidence': source.get('has_local_evidence') is True,
        })
    rows.sort(key=lambda row: row['source_id'])
    for row in rows:
        row['same_url_source_ids'] = sorted(url_ids[row['canonical_url']])
    return {
        'schema_version': 1,
        'inventory_date': as_of,
        'dataset': dataset,
        'dataset_sha256': hashlib.sha256(raw).hexdigest(),
        'source_count': len(rows),
        'unique_url_count': len(url_ids),
        'unique_host_count': len({row['host'] for row in rows}),
        'site_group_count': len({row['group'] for row in rows}),
        'has_local_evidence_count': sum(row['has_local_evidence'] for row in rows),
        'notes': [
            'Read-only metadata inventory; no pages fetched and no facts independently reverified.',
            'Unique URLs remove only fragments. Query strings, HTTP/HTTPS, case and trailing slashes remain distinct.',
            'Different URLs or hosts can reproduce one original source; counts do not measure independent evidence.',
            'group and category_tags are maintenance heuristics, not statements of authority, ownership or verified content.',
            'type copies source_type; unclassified means source_type was absent or empty.',
            '12371.cn and 12371.gov.cn remain separate. Academic links do not imply database ingestion.',
        ],
        'host_stats': aggregate(rows, 'host'),
        'group_stats': aggregate(rows, 'group'),
        'type_counts': dict(sorted(collections.Counter(row['type'] for row in rows).items())),
        'tag_counts': dict(sorted(collections.Counter(tag for row in rows for tag in row['category_tags']).items())),
        'duplicate_url_groups': [
            {'canonical_url': url, 'source_ids': sorted(ids)}
            for url, ids in sorted(url_ids.items()) if len(ids) > 1
        ],
        'sources': rows,
    }


def markdown_text(value):
    return str(value).replace('\\', '\\\\').replace('|', '\\|').replace('[', '\\[').replace(']', '\\]').replace('\n', ' ').replace('\r', ' ')


def markdown(report):
    lines = [
        '# 来源盘点清单', '',
        '<!-- Generated by scripts/source_inventory.py; do not edit this report manually. -->', '',
        f"盘点日期：{report['inventory_date']}。来自 `data/atlas.json` 当前快照；本报告没有重新访问网页。", '',
        f"**{report['source_count']} 条来源 ID · {report['unique_url_count']} 个唯一 URL · {report['unique_host_count']} 个 host · {report['site_group_count']} 个维护分组。**", '',
        '完整逐条清单见 [source-inventory.json](../reports/source-inventory.json)；检索与取证说明见 [来源维护指南](SOURCE_SEARCH_METHODS.md)，人工入口配置见 [source-catalog.json](../data/source-catalog.json)。', '',
        '唯一 URL 只删除 `#fragment`，保留 query 参数、HTTP/HTTPS、大小写和末尾斜杠。不同 URL 或域名仍可能是同源转载，不能当作独立验证次数。', '',
        '`type` 保留原记录的 `source_type`，缺少时写为 `unclassified`。`group` 和 `category_tags` 只是域名、标题等元数据的维护分类，不代表官方身份、网站所有权、内容权威性或事实已核实。域名属于大学也不代表已导入学术数据库。', '',
        '## 重新生成', '',
        '在仓库根目录运行：', '',
        '```sh', 'python3 scripts/source_inventory.py', '```', '',
        '脚本只读来源数据，写本 Markdown 和 JSON 报告，不联网、不修改人物或来源、不创建调度任务。日期可用 `--as-of YYYY-MM-DD` 指定。', '',
        '## 按 host 统计', '',
        '代表链接仅用于快速打开该 host 已有来源，按 URL 排序选取最多两条，不表示“最权威”或“最新”。', '',
        '| Host | 来源 ID | 唯一 URL | 维护分组 | 代表链接 |',
        '| --- | ---: | ---: | --- | --- |',
    ]
    for group in report['host_stats']:
        links = []
        for example in group['representative_links']:
            title = example['title']
            if len(title) > 48:
                title = title[:47] + '…'
            safe_url = example['url'].replace('<', '%3C').replace('>', '%3E').replace('|', '%7C')
            links.append(f'[{markdown_text(title)}](<{safe_url}>)')
        lines.append('| ' + ' | '.join([
            markdown_text(group['name']), str(group['source_count']),
            str(group['unique_url_count']), ', '.join(map(markdown_text, group['groups'])),
            '<br>'.join(links),
        ]) + ' |')
    lines.extend([
        '', '## 统计口径与变化', '',
        f"输入快照 SHA-256：`{report['dataset_sha256']}`。", '',
        f"本次有 {len(report['duplicate_url_groups'])} 组 URL 被多个 source ID 引用；旧 ID 为维持现有人物引用而保留，详见 JSON 的 `duplicate_url_groups`。", '',
        '新增来源后重跑即可更新；单次抓取失败、目录删除或来源减少均不能自动解释为官员离任。清单只盘点本库已经引用的资料，不代表整个网站已被采集。', '',
    ])
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=ROOT / 'data/atlas.json')
    parser.add_argument('--json-output', type=Path, default=ROOT / 'reports/source-inventory.json')
    parser.add_argument('--markdown-output', type=Path, default=ROOT / 'docs/SOURCE_INVENTORY.md')
    parser.add_argument('--as-of', default=dt.date.today().isoformat())
    args = parser.parse_args()
    paths = [args.input.resolve(), args.json_output.resolve(), args.markdown_output.resolve()]
    if len(set(paths)) != 3:
        parser.error('Input and output paths must be distinct')
    raw = args.input.read_bytes()
    try:
        dataset = str(args.input.resolve().relative_to(ROOT))
    except ValueError:
        dataset = args.input.name  # Never publish a private absolute machine path.
    report = inventory(json.loads(raw), raw, dataset, args.as_of)
    outputs = (
        (args.json_output, json.dumps(report, ensure_ascii=False, indent=2) + '\n'),
        (args.markdown_output, markdown(report)),
    )
    for path, content in outputs:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')
    print(f"Inventory: {report['source_count']} sources; {report['unique_url_count']} URLs; "
          f"{report['unique_host_count']} hosts; {report['site_group_count']} groups.")


if __name__ == '__main__':
    main()
