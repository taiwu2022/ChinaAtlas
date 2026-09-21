"""Atomic personnel history, public boundaries and reproducible read-only auditing."""
import copy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from status_events import STATUS_EVENT_CODES, status_event_issues, validate_status_events
from data_merge import merge_packet
from export_public import sanitize, validate
from accuracy_report import analyze

AS_OF = '2026-09-21'


def event(**changes):
    return dict({'id': 'event-a', 'person_id': 'person-a', 'category': 'party_discipline',
                 'code': 'expelled_party', 'label': '开除党籍', 'announced_at': '2026-09-10',
                 'effective_at': None, 'description': '官方公告明确作出该项处分。',
                 'org_ids': ['office'], 'source_ids': ['event-source'], 'evidence_status': 'verified',
                 'reviewed_at': AS_OF}, **changes)


def fixture():
    return {'verified_at': AS_OF, 'people': [
        {'id': 'person-a', 'name': '甲', 'roles': [], 'bio': [], 'personal_note': 'PRIVATE'},
        {'id': 'person-b', 'name': '甲', 'roles': [], 'bio': []}],
        'institutions': [{'id': 'office'}],
        'sources': [{'id': 'event-source', 'url': 'https://example.org/event', 'source_type': 'official_notice',
                     'published_at': '2026-09-10'}],
        'relations': [], 'locations': [], 'career_posts': [], 'career_links': [], 'guides': [],
        'status_events': [event()]}


class StatusEventTests(unittest.TestCase):
    def setUp(self):
        self.data = fixture()

    def errors(self):
        return [i for i in status_event_issues(self.data, AS_OF) if i['level'] == 'error']

    def test_old_snapshots_without_collection_are_supported(self):
        self.data.pop('status_events')
        validate_status_events(self.data)
        self.assertEqual(sanitize(self.data)['status_events'], [])

    def test_taxonomy_accepts_each_code_only_in_its_defined_category(self):
        for category, codes in STATUS_EVENT_CODES.items():
            for code in codes:
                with self.subTest(category=category, code=code):
                    self.data['status_events'] = [event(category=category, code=code)]
                    self.assertEqual(self.errors(), [])
        self.data['status_events'] = [event(category='judicial', code='expelled_party')]
        self.assertEqual(self.errors()[0]['code'], 'invalid_status_event_type')

    def test_each_action_retains_separate_id_and_no_role_side_effects(self):
        self.data['status_events'] = []
        original = copy.deepcopy(self.data)
        packet = {'status_events': [event(), event(id='military', category='military_status', code='expelled_military'),
                                   event(id='referral', category='judicial', code='referred_for_prosecution')]}
        packet_before = copy.deepcopy(packet)
        with patch('sqlite3.connect', side_effect=AssertionError('No real or test DB may be opened by merger')):
            merge_packet(self.data, packet)
        self.assertEqual(self.data['people'], original['people'])
        self.assertEqual(self.data['career_posts'], original['career_posts'])
        self.assertEqual(self.data['career_links'], original['career_links'])
        self.assertEqual(packet, packet_before)
        self.assertEqual(len(self.data['status_events']), 3)

    def test_identity_org_source_and_correction_references_must_exist(self):
        for field, value in [('person_id', 'missing'), ('org_ids', ['missing']),
                             ('source_ids', ['missing']), ('supersedes_event_ids', ['missing'])]:
            with self.subTest(field=field):
                self.data['status_events'] = [event(**{field: value})]
                self.assertTrue(any(i['code'] == 'broken_reference' for i in self.errors()))

    def test_no_source_is_hard_error_even_for_unverified_lead(self):
        for status in ('verified', 'unverified', 'conflicting'):
            self.data['status_events'] = [event(source_ids=[], evidence_status=status)]
            self.assertTrue(any(i['code'] == 'missing_source' for i in self.errors()))
            with self.assertRaises(ValueError):sanitize(self.data)

    def test_uncertainty_is_preserved_as_review_without_becoming_office_status(self):
        for status, code in [('unverified', 'unverified_lead'), ('conflicting', 'explicit_conflict')]:
            self.data['status_events'] = [event(evidence_status=status)]
            self.assertEqual(self.errors(), [])
            self.assertEqual(status_event_issues(self.data, AS_OF)[0]['code'], code)
            self.assertEqual(sanitize(self.data)['status_events'][0]['evidence_status'], status)

    def test_date_precision_preserves_month_and_year_without_inventing_effective_day(self):
        for announced in ('2026', '2026-09', '2026-09-21'):
            self.data['status_events'] = [event(announced_at=announced, effective_at='2025')]
            self.assertEqual(self.errors(), [])
            self.assertEqual(sanitize(self.data)['status_events'][0]['announced_at'], announced)
        self.assertIsNone(sanitize(fixture())['status_events'][0]['effective_at'])

    def test_announcement_and_effective_order_is_not_a_tenure(self):
        for effective in ('2020-01-01', '2026-09-20'):
            self.data['status_events'] = [event(effective_at=effective)]
            self.assertEqual(self.errors(), [])

    def test_prior_action_with_undisclosed_date_does_not_borrow_announcement_or_review(self):
        row = event(category='military_status', code='expelled_military', announced_at=AS_OF,
                    effective_at=None, date_note='此前已被开除军籍，原文未披露具体日期。')
        self.data['status_events'] = [row]
        result = sanitize(self.data)
        self.assertIsNone(result['status_events'][0]['effective_at'])
        self.assertEqual(result['status_events'][0]['announced_at'], AS_OF)
        self.data['status_events'][0].pop('announced_at')
        self.assertTrue(any(i['code'] == 'invalid_date' for i in self.errors()))

    def test_review_requires_complete_calendar_date_and_cannot_precede_announcement(self):
        for value in (None, '', '2026', '2026-09', '2026-02-30'):
            self.data['status_events'] = [event(reviewed_at=value)]
            self.assertTrue(any(i['code'] == 'invalid_date' for i in self.errors()))
        self.data['status_events'] = [event(reviewed_at='2026-09-01')]
        self.assertTrue(any(i['code'] == 'status_event_date_order' for i in self.errors()))

    def test_future_review_is_error_but_future_effective_is_review_and_does_not_apply(self):
        self.data['status_events'] = [event(reviewed_at='2026-09-22', effective_at='2026-10-01')]
        issues = status_event_issues(self.data, AS_OF)
        self.assertEqual({i['level'] for i in issues if i['code'] == 'future_evidence'}, {'error', 'review'})
        self.assertEqual(self.data['people'][0]['roles'], [])

    def test_duplicate_ids_are_rejected(self):
        self.data['status_events'].append(event(code='party_warning'))
        self.assertTrue(any(i['code'] == 'duplicate_id' for i in self.errors()))

    def test_malformed_fields_reject_cleanly_including_list_valued_enums(self):
        for field, value in [('id', ''), ('person_id', []), ('category', []), ('code', []),
                             ('evidence_status', []), ('org_ids', 'office'), ('source_ids', [None]),
                             ('announced_at', '2026-13'), ('description', ''), ('reviewed_at', 20260921)]:
            with self.subTest(field=field):
                self.data['status_events'] = [event(**{field: value})]
                with self.assertRaises(ValueError):validate_status_events(self.data)

    def test_explicit_correction_preserves_old_event_and_requires_reviewed_basis(self):
        revised = event(id='event-correction', announced_at='2026-09-20',
                        supersedes_event_ids=['event-a'], procedure_note='原机构更正公告明确撤销此前此项处分。')
        self.data['status_events'].append(revised)
        self.assertEqual(self.errors(), [])
        self.assertEqual(len(sanitize(self.data)['status_events']), 2)
        for field, value in [('procedure_note', ''), ('evidence_status', 'unverified'), ('person_id', 'person-b')]:
            with self.subTest(field=field):
                self.data['status_events'][-1] = {**revised, field: value}
                self.assertTrue(any(i['code'] == 'invalid_status_supersession' for i in self.errors()))

    def test_self_cycle_and_backward_correction_dates_are_rejected(self):
        self.data['status_events'] = [event(supersedes_event_ids=['event-a'], procedure_note='更正依据')]
        self.assertTrue(any(i['code'] == 'invalid_status_supersession' for i in self.errors()))
        self.data['status_events'] = [event(supersedes_event_ids=['event-b'], procedure_note='更正依据'),
                                     event(id='event-b', supersedes_event_ids=['event-a'], procedure_note='更正依据')]
        self.assertTrue(any('循环' in i['message'] for i in self.errors()))
        self.data['status_events'] = [event(), event(id='event-b', announced_at='2026-09-01',
            supersedes_event_ids=['event-a'], procedure_note='更正依据')]
        self.assertTrue(any('早于' in i['message'] for i in self.errors()))

    def test_public_export_keeps_event_only_sources_and_strips_private_fields(self):
        self.data['status_events'][0].update(raw_path='/Users/private/archive', personal_note='EVENT_PRIVATE',
                                            internal={'token': 'TOKEN_PRIVATE'})
        before = copy.deepcopy(self.data)
        result = sanitize(self.data)
        self.assertEqual(result['sources'][0]['id'], 'event-source')
        self.assertEqual(result['status_events'][0], event())
        self.assertEqual(self.data, before)
        validate(result)

    def test_new_status_packet_is_atomic_on_failed_validation_including_source_additions(self):
        before = copy.deepcopy(self.data)
        with self.assertRaises(ValueError):
            merge_packet(self.data, {'sources': [{'id': 'new', 'url': 'https://example.org/new'}],
                                     'status_events': [event(id='bad', source_ids=['missing'])]})
        self.assertEqual(self.data, before)

    def test_new_source_in_same_packet_is_available_to_event(self):
        merge_packet(self.data, {'sources': [{'id': 'new', 'url': 'https://example.org/new'}],
                                'status_events': [event(id='new-event', source_ids=['new'])]})
        self.assertEqual(self.data['status_events'][-1]['source_ids'], ['new'])

    def test_reviewed_updates_allow_event_correction_with_strict_stale_and_atomic_guards(self):
        update = {'id': 'review', 'collection': 'status_events', 'record_id': 'event-a',
                  'before': {'effective_at': None}, 'set': {'effective_at': '2026-09-01'},
                  'source_ids': ['event-source'], 'reviewed_at': AS_OF, 'reason': '公告明确生效日'}
        merge_packet(self.data, {'reviewed_updates': [update]})
        self.assertEqual(self.data['status_events'][0]['effective_at'], '2026-09-01')
        before = copy.deepcopy(self.data)
        with self.assertRaisesRegex(ValueError, 'Stale'):merge_packet(self.data, {'reviewed_updates': [update]})
        self.assertEqual(self.data, before)
        update.update(before={'source_ids': ['event-source']}, set={'source_ids': []})
        with self.assertRaises(ValueError):merge_packet(self.data, {'reviewed_updates': [update]})
        self.assertEqual(self.data, before)

    def test_accuracy_is_reproducible_read_only_and_reports_event_errors(self):
        self.data['status_events'] = [event(source_ids=[], reviewed_at='2026-10-01')]
        before = copy.deepcopy(self.data)
        evidence = {'event-source': {'evidence_excerpt': '测试原文。'}}
        one = analyze(self.data, evidence, AS_OF)
        self.assertEqual(one, analyze(self.data, evidence, AS_OF))
        self.assertEqual(self.data, before)
        self.assertEqual(one['counts']['status_events'], 1)
        errors = [i for i in one['issues'] if i['entity_type'] == 'status_events' and i['level'] == 'error']
        self.assertEqual({i['code'] for i in errors}, {'missing_source', 'future_evidence'})


if __name__ == '__main__':unittest.main()
