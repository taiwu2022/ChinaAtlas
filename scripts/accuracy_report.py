"""Read-only evidence audit. A clean report is not a certification of factual truth."""
import argparse
import calendar
import collections
import datetime as dt
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
ROLE_STATES = {'verified_current', 'verified_former', 'historical_only', 'directory_only', 'unverified', 'conflicting'}
FACT_FIELDS = {'birth_date', 'native_place', 'education', 'work_started', 'party_joined', 'career_background'}
RULES = {
    'duplicate_id': '重复稳定 ID', 'broken_reference': '引用对象不存在',
    'invalid_date': '日期格式或日历日期无效', 'unstructured_date': '旧日期字段混有说明文字', 'reversed_period': '起止日期倒置',
    'current_closed': '现任记录同时有结束时间', 'current_uncertain': '现任标记与证据类别矛盾',
    'future_evidence': '证据时点在审计日之后', 'birth_after_career': '出生时间晚于任职时间',
    'unknown_status': '未识别的证据状态', 'explicit_conflict': '已记录的来源冲突',
    'unverified_lead': '未核实线索', 'identity_candidates': '同名身份待核',
    'stale_current': '现任证据超过复查间隔', 'missing_role_status': '早期职务未标注证据类别',
    'missing_current_date': '现任职务缺少独立证据日期', 'missing_source': '事实缺少来源',
    'missing_excerpt': '来源尚无短摘录', 'missing_source_type': '来源类型尚未标注',
    'duplicate_url': '多个来源编号指向同一网页', 'fact_conflict': '同字段存在不同已核实值',
    'fact_missing_review': '已核实背景事实缺少核对日期或摘录', 'unknown_fact_field': '背景字段尚未定义',
}


def bounds(value):
    """Preserve year/month/day precision. None means genuinely unknown."""
    if value in (None, ''):
        return None
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}(?:-\d{2})?(?:-\d{2})?', value):
        raise ValueError('invalid date')
    parts = list(map(int, value.split('-')))
    year, month = parts[0], parts[1] if len(parts) > 1 else 1
    low = dt.date(year, month, parts[2] if len(parts) > 2 else 1)
    high = low if len(parts) == 3 else dt.date(year, month, calendar.monthrange(year, month)[1]) if len(parts) == 2 else dt.date(year, 12, 31)
    return low, high


def canonical_url(url):
    # Do not strip query strings, merge HTTP with HTTPS, or treat a mirror as independent.
    u = urlsplit(url)
    return urlunsplit((u.scheme.lower(), u.netloc.lower(), u.path or '/', u.query, ''))


def analyze(data, evidence, as_of, stale_days=180):
    today = dt.date.fromisoformat(as_of)
    issues = []
    maps = {}

    def emit(level, code, kind, key, message, person_id=None, source_ids=None):
        issues.append({'level': level, 'code': code, 'entity_type': kind, 'entity_id': key,
                       'person_id': person_id, 'message': message, 'source_ids': source_ids or []})

    for kind in ['people', 'institutions', 'sources', 'career_posts', 'locations', 'profile_facts']:
        rows = data.get(kind, [])
        counts = collections.Counter(r['id'] for r in rows)
        maps[kind] = {r['id']: r for r in rows}
        for key, count in counts.items():
            if count > 1:
                emit('error', 'duplicate_id', kind, key, f'{count} 条记录使用同一 ID')

    def references(row, kind, key, pid=None):
        for field, target in [('source_ids', 'sources'), ('person_id', 'people'), ('org_id', 'institutions'),
                              ('organization_id', 'institutions'), ('location_ids', 'locations')]:
            values = row.get(field, [])
            if isinstance(values, str):
                values = [values]
            for value in values:
                if value not in maps[target]:
                    emit('error', 'broken_reference', kind, key, f'{field}: {value}', pid)
        if not row.get('source_ids'):
            emit('gap', 'missing_source', kind, key, '需补充支持本条事实的原文', pid)

    def date(value, kind, key, field, pid=None, no_future=False):
        if kind == 'roles' and field in ('since', 'until') and isinstance(value, str) and re.search('[\u4e00-\u9fff（]', value):
            emit('gap', 'unstructured_date', kind, key, f'{field}: {value}；需拆分日期与观察口径，不自动截取', pid)
            return None
        try:
            result = bounds(value)
        except (ValueError, TypeError):
            emit('error', 'invalid_date', kind, key, f'{field}: {value}', pid)
            return None
        # A partially known month/year overlapping today is not a future date.
        if result and no_future and result[0] > today:
            emit('review', 'future_evidence', kind, key, f'{field}: {value}，需区分预告与已发生事实', pid)
        return result

    def period(row, kind, key, start_key, end_key, current, pid):
        start = date(row.get(start_key), kind, key, start_key, pid)
        end = date(row.get(end_key), kind, key, end_key, pid)
        if start and end and start[0] > end[1]:
            emit('error', 'reversed_period', kind, key, '日期精度已纳入比较，起始仍晚于结束', pid)
        if current and row.get(end_key):
            emit('error', 'current_closed', kind, key, '请复查状态或结束日期；不自动修改', pid)
        return start, end

    identity_sets = set()
    for person in data.get('people', []):
        pid = person['id']
        birth = date(str(person['birth_year']) if person.get('birth_year') else None, 'people', pid, 'birth_year', pid)
        candidates = person.get('possible_identity_ids', [])
        if candidates:
            group = tuple(sorted({pid, *candidates}))
            if group not in identity_sets:
                identity_sets.add(group)
                emit('review', 'identity_candidates', 'people', pid, '候选 ID：' + '、'.join(group) + '；不得仅按姓名合并', pid)
            for other in candidates:
                if other not in maps['people']:
                    emit('error', 'broken_reference', 'people', pid, 'possible_identity_ids: ' + other, pid)
        for index, role in enumerate(person.get('roles', [])):
            key = f'{pid}/roles/{index}'
            references(role, 'roles', key, pid)
            current = role.get('status') == 'current'
            start, _ = period(role, 'roles', key, 'since', 'until', current, pid)
            if birth and start and birth[0] > start[1]:
                emit('error', 'birth_after_career', 'roles', key, '出生年份晚于这段任职', pid)
            status = role.get('verification_status')
            if not status:
                emit('gap', 'missing_role_status', 'roles', key, role.get('title', ''), pid)
            elif status not in ROLE_STATES:
                emit('error', 'unknown_status', 'roles', key, status, pid)
            if current and status and status != 'verified_current':
                emit('error', 'current_uncertain', 'roles', key, status, pid)
            if status in ('conflicting', 'unverified'):
                emit('review', 'explicit_conflict' if status == 'conflicting' else 'unverified_lead', 'roles', key,
                     role.get('note') or role.get('title', ''), pid, role.get('source_ids'))
            # Never substitute a retrieval date, a source publication, or a person's checked_at.
            observed = role.get('as_of_date') or role.get('latest_confirmed_at') or role.get('current_evidence_date')
            observed_bounds = date(observed, 'roles', key, 'evidence_date', pid, True)
            if current and not observed:
                emit('gap', 'missing_current_date', 'roles', key, role.get('title', ''), pid)
            if current and observed_bounds and (today - observed_bounds[1]).days > stale_days:
                emit('review', 'stale_current', 'roles', key,
                     f'{role.get("title", "")}；证据 {observed}，需复查，不代表已离任', pid, role.get('source_ids'))

    for post in data.get('career_posts', []):
        key, pid = post['id'], post.get('person_id')
        references(post, 'career_posts', key, pid)
        period(post, 'career_posts', key, 'start', 'end', post.get('is_current'), pid)
        status = post.get('verification_status')
        if post.get('is_current') and status and status != 'verified_current':
            emit('error', 'current_uncertain', 'career_posts', key, status, pid)

    url_groups = collections.defaultdict(list)
    for source in data.get('sources', []):
        sid = source['id']
        url_groups[canonical_url(source.get('url', ''))].append(sid)
        excerpt = evidence.get(sid, {}).get('evidence_excerpt')
        if not excerpt or not str(excerpt).strip():
            emit('gap', 'missing_excerpt', 'sources', sid, '缺少便于逐字复查的公开短摘录；有链接不等于已证明', source_ids=[sid])
        if not source.get('source_type'):
            emit('gap', 'missing_source_type', 'sources', sid, '旧来源待分类；并非自动降为不可靠', source_ids=[sid])
    for url, ids in sorted(url_groups.items()):
        if len(ids) > 1:
            emit('info', 'duplicate_url', 'sources', ids[0], url + '；可以分段引用，只计一个网页来源', source_ids=ids)

    values = collections.defaultdict(list)
    for fact in data.get('profile_facts', []):
        key, pid = fact['id'], fact.get('person_id')
        references(fact, 'profile_facts', key, pid)
        if fact.get('field') not in FACT_FIELDS:
            emit('error', 'unknown_fact_field', 'profile_facts', key, str(fact.get('field')), pid)
        if fact.get('evidence_status') not in ('verified', 'unverified', 'conflicting'):
            emit('error', 'unknown_status', 'profile_facts', key, str(fact.get('evidence_status')), pid)
        if fact.get('evidence_status') == 'verified':
            if not fact.get('reviewed_at') or not fact.get('evidence_excerpt'):
                emit('gap', 'fact_missing_review', 'profile_facts', key, '已核实需保留核对日和短摘录', pid)
            if fact.get('field') in ('birth_date', 'native_place', 'work_started', 'party_joined'):
                values[(pid, fact['field'])].append(fact)
        if fact.get('evidence_status') in ('unverified', 'conflicting'):
            emit('review', 'explicit_conflict' if fact['evidence_status'] == 'conflicting' else 'unverified_lead',
                 'profile_facts', key, fact.get('note') or fact.get('value', ''), pid, fact.get('source_ids'))
        for field in ('as_of_date', 'reviewed_at'):
            date(fact.get(field), 'profile_facts', key, field, pid, True)
    for (pid, field), facts in values.items():
        if len({f['value'] for f in facts}) > 1:
            emit('review', 'fact_conflict', 'people', pid, field + '：' + ' / '.join(f['value'] for f in facts) + '；可能是精度或表述差异，需对照原文', pid,
                 sorted({s for f in facts for s in f.get('source_ids', [])}))

    issues.sort(key=lambda i: (['error', 'review', 'gap', 'info'].index(i['level']), i['code'], i['entity_id']))
    return {
        'schema_version': 'china-atlas-accuracy-report-v1', 'as_of_date': as_of,
        'input_sha256': hashlib.sha256(json.dumps(data, ensure_ascii=False, sort_keys=True).encode()).hexdigest(),
        'evidence_sha256': hashlib.sha256(json.dumps(evidence, ensure_ascii=False, sort_keys=True).encode()).hexdigest(),
        'stale_after_days': stale_days,
        'scope': '只读一致性与证据缺口检查；未联网、未逐条重读原文，也不证明未标记资料必然正确。',
        'counts': {k: len(data.get(k, [])) for k in ['people', 'career_posts', 'sources', 'profile_facts']},
        'unique_source_urls': len(url_groups),
        'totals': {level: sum(i['level'] == level for i in issues) for level in ['error', 'review', 'gap', 'info']},
        'issues': issues,
    }


def markdown(report, data):
    people = {p['id']: p for p in data['people']}
    rows = ['# 资料准确性复核清单', '', f'审计时点：{report["as_of_date"]}。' + report['scope'], '',
            '规则命中次数不是错误人数；一条资料可触发多项。`error` 是结构/逻辑问题，`review` 是待查线索，`gap` 是证据记录缺口，`info` 是引用提示。', '',
            '| 检查层 | 命中条数 |', '| --- | ---: |']
    rows += [f'| {level} | {count} |' for level, count in report['totals'].items()]
    rows += ['', f'现有 {report["counts"]["sources"]} 个来源编号，对应 {report["unique_source_urls"]} 个去片段网址。不同网址仍可能转载同一原文，不能据此计算“独立证据数”。', '',
             '完整队列见 [accuracy-report.json](../reports/accuracy-report.json)。下列每条规则最多列三个例子。', '']
    for code, label in RULES.items():
        hits = [i for i in report['issues'] if i['code'] == code]
        if not hits:
            continue
        rows += [f'## {label} · {len(hits)}', '']
        for issue in hits[:3]:
            pid = issue.get('person_id')
            name = people.get(pid, {}).get('name', issue['entity_id'])
            link = f'[{name}](https://taiwu2022.github.io/ChinaAtlas/#people?view=person&id={pid})' if pid else f'`{issue["entity_id"]}`'
            rows.append(f'- {link}：{issue["message"]}')
        rows.append('')
    rows += ['## 如何处理', '', '优先复核结构错误、冲突与同名候选，再补现任证据日期。无日期名册保持待核；查不到离任公告不能补造结束时间。来源打不开只记录可用性，不删除历史事实。', '',
             '先比较精确岗位、人物身份和事件时间，找到原始任免/简历，再记录更正原因与旧值；网页快照和结构检查均不能替代这一过程。', '',
             f'输入数据 SHA-256：`{report["input_sha256"]}`；证据摘录 SHA-256：`{report["evidence_sha256"]}`。', '']
    return '\n'.join(rows)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, default=ROOT / 'data/atlas.json')
    parser.add_argument('--evidence', type=Path, default=ROOT / 'data/evidence.json')
    parser.add_argument('--as-of', required=True, help='YYYY-MM-DD; explicit research time point')
    parser.add_argument('--stale-days', type=int, default=180)
    parser.add_argument('--output', type=Path, default=ROOT / 'reports/accuracy-report.json')
    parser.add_argument('--markdown', type=Path, default=ROOT / 'docs/ACCURACY_REPORT.md')
    args = parser.parse_args()
    if args.stale_days < 1:
        parser.error('--stale-days must be positive')
    inputs = {args.data.resolve(), args.evidence.resolve()}
    outputs = [args.output.resolve(), args.markdown.resolve()]
    if any(path in inputs for path in outputs) or len(set(outputs)) != len(outputs):
        parser.error('Report outputs must be distinct and must not overwrite input data or evidence')
    data = json.loads(args.data.read_text())
    report = analyze(data, json.loads(args.evidence.read_text()), args.as_of, args.stale_days)
    for path, content in [(args.output, json.dumps(report, ensure_ascii=False, indent=2) + '\n'), (args.markdown, markdown(report, data))]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
    print(json.dumps({'as_of': args.as_of, **report['totals']}, ensure_ascii=False))
    raise SystemExit(1 if report['totals']['error'] else 0)
