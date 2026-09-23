"""Sourced, atomic personnel history; validation never changes offices or careers."""
import calendar
import collections
import datetime as dt
import re

STATUS_EVENT_CODES = {
    'office_change': {'appointed', 'office_removed', 'resigned', 'retired', 'term_ended', 'transferred', 'deceased'},
    'party_discipline': {'party_warning', 'serious_party_warning', 'party_posts_removed', 'party_probation', 'expelled_party', 'party_rights_restored'},
    'administrative_discipline': {'administrative_warning', 'demerit', 'major_demerit', 'demoted', 'administrative_removed', 'dismissed_public_office'},
    'organization_action': {'suspended', 'duties_adjusted', 'organizational_removed', 'ordered_resignation', 'organizational_demoted'},
    'military_status': {'expelled_military', 'rank_revoked', 'retired_from_service'},
    'investigation': {'investigation_opened', 'investigation_closed'},
    'judicial': {'referred_for_prosecution', 'prosecution_filed', 'convicted', 'acquitted', 'case_dismissed', 'sentence_changed'},
    'qualification': {'qualification_terminated', 'qualification_suspended', 'qualification_restored'},
}
STATUS_EVENT_FIELDS = ('id person_id category code label announced_at effective_at date_note description '
                       'org_ids source_ids evidence_status decision_authority procedure_note reviewed_at supersedes_event_ids')
EVIDENCE_STATES = {'verified', 'unverified', 'conflicting'}


def date_bounds(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}(?:-\d{2})?(?:-\d{2})?', value):
        raise ValueError('Invalid date')
    bits = list(map(int, value.split('-')))
    year, month = bits[0], bits[1] if len(bits) > 1 else 1
    low = dt.date(year, month, bits[2] if len(bits) > 2 else 1)
    high = low if len(bits) == 3 else dt.date(year, month, calendar.monthrange(year, month)[1]) if len(bits) == 2 else dt.date(year, 12, 31)
    return low, high


def status_event_issues(data, as_of=None):
    """Return integrity errors and research signals with explicit optional audit date.

    Missing old collections are valid. Announcement and effect are independent:
    retrospective decisions and prospective effect are not inverted tenures.
    """
    today = dt.date.fromisoformat(as_of) if as_of else None
    issues = []
    rows = data.get('status_events', [])

    def emit(level, code, row, message):
        issues.append({'level': level, 'code': code, 'entity_type': 'status_events',
                       'entity_id': str(row.get('id', '(missing)')), 'person_id': row.get('person_id'),
                       'source_ids': row.get('source_ids') if isinstance(row.get('source_ids'), list) else [],
                       'message': message})

    if not isinstance(rows, list):
        emit('error', 'invalid_status_event', {}, 'status_events 必须为数组')
        return issues
    valid_rows = [r for r in rows if isinstance(r, dict)]
    for r in rows:
        if not isinstance(r, dict):emit('error', 'invalid_status_event', {}, '事件必须为对象')
    maps = {kind: {r['id'] for r in data.get(kind, [])} for kind in ('people', 'institutions', 'sources')}
    events = {r['id']: r for r in valid_rows if isinstance(r.get('id'), str)}
    counts = collections.Counter(r['id'] for r in valid_rows if isinstance(r.get('id'), str))
    for key, count in counts.items():
        if count > 1:emit('error', 'duplicate_id', events[key], '人物状态事件 ID 重复')
    graph = {}
    for row in valid_rows:
        for field in ('id', 'person_id', 'category', 'code', 'label', 'description'):
            if not isinstance(row.get(field), str) or not row[field].strip():
                emit('error', 'invalid_status_event', row, field + ' 需非空文字')
        for field in ('id', 'person_id'):
            if isinstance(row.get(field), str) and row[field] != row[field].strip():
                emit('error', 'invalid_status_event', row, field + ' 不得包含首尾空白')
        category, code = row.get('category'), row.get('code')
        if not isinstance(category, str) or not isinstance(code, str) or code not in STATUS_EVENT_CODES.get(category, set()):
            emit('error', 'invalid_status_event_type', row, 'category/code 不是已定义组合')
        status = row.get('evidence_status')
        if not isinstance(status, str) or status not in EVIDENCE_STATES:
            emit('error', 'unknown_status', row, '未知事件证据状态')
        elif status != 'verified':
            emit('review', 'explicit_conflict' if status == 'conflicting' else 'unverified_lead', row,
                 '事件保留为待核/冲突线索，不作已确认状态展示')
        pid = row.get('person_id')
        if isinstance(pid, str) and pid not in maps['people']:
            emit('error', 'broken_reference', row, 'person_id: ' + pid)
        refs = {}
        for field, target in (('source_ids', 'sources'), ('org_ids', 'institutions'), ('supersedes_event_ids', None)):
            values = row.get(field, [])
            if not isinstance(values, list) or any(not isinstance(v, str) or not v.strip() or v != v.strip() for v in values):
                emit('error', 'invalid_status_event', row, field + ' 需稳定 ID 数组')
                values = []
            refs[field] = values
            if field == 'source_ids' and not values:
                emit('error', 'missing_source', row, '人物状态事件不得无源入库')
            if len(values) != len(set(values)):
                emit('error', 'invalid_status_event', row, field + ' 含重复 ID')
            for value in values:
                if value not in (maps[target] if target else events):
                    emit('error', 'broken_reference', row, field + ': ' + value)
        dates = {}
        for field in ('announced_at', 'effective_at', 'reviewed_at'):
            value = row.get(field)
            if field == 'effective_at' and value in (None, ''):continue
            try:
                if field == 'reviewed_at' and (not isinstance(value, str) or len(value) != 10):
                    raise ValueError('Full review date required')
                dates[field] = date_bounds(value)
            except (ValueError, TypeError):
                emit('error', 'invalid_date', row, field + ' 日期缺失、精度或日历无效')
                continue
            if today and dates[field][0] > today:
                emit('error' if field == 'reviewed_at' else 'review', 'future_evidence', row,
                     field + ': ' + value + ('；核对日不能晚于审计日' if field == 'reviewed_at' else '；需区分预告与已发生事实'))
        if 'announced_at' in dates and 'reviewed_at' in dates and dates['announced_at'][0] > dates['reviewed_at'][1]:
            emit('error', 'status_event_date_order', row, '核对日早于公告日；不能用检索日替代事实日期')
        for field in ('date_note', 'decision_authority', 'procedure_note'):
            if row.get(field) is not None and not isinstance(row[field], str):
                emit('error', 'invalid_status_event', row, field + ' 需文字或 null')
        supersedes = refs['supersedes_event_ids']
        if supersedes and (status != 'verified' or not isinstance(row.get('procedure_note'), str) or not row['procedure_note'].strip()):
            emit('error', 'invalid_status_supersession', row, '更正/撤销须已核实，procedure_note 必须说明明确原文依据')
        for old_id in supersedes:
            old = events.get(old_id)
            if old and (old_id == row.get('id') or old.get('person_id') != pid):
                emit('error', 'invalid_status_supersession', row, '只能更正同一人物的其他旧事件')
            if old:
                try:
                    if date_bounds(old.get('announced_at'))[0] > dates['announced_at'][1]:
                        emit('error', 'invalid_status_supersession', row, '更正公告早于被更正的公告')
                except (ValueError, TypeError, KeyError):pass
        if isinstance(row.get('id'), str):graph[row['id']] = supersedes
    # Iterative reachability avoids recursion limits and catches even same-day cycles.
    for key in graph:
        seen, pending = set(), list(graph[key])
        while pending:
            other = pending.pop()
            if other == key:
                emit('error', 'invalid_status_supersession', events[key], '更正事件形成循环')
                break
            if other not in seen:
                seen.add(other);pending.extend(graph.get(other, []))
    return issues


def validate_status_events(data, as_of=None):
    errors = [i for i in status_event_issues(data, as_of) if i['level'] == 'error']
    if errors:
        raise ValueError('Invalid status event ' + errors[0]['entity_id'] + ': ' + errors[0]['code'] + ': ' + errors[0]['message'])
