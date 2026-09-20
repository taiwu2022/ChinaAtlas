"""Evidence-audit boundaries, using synthetic records and isolated CLI output."""
import copy
import datetime as dt
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import accuracy_report as audit


AS_OF = '2026-09-21'


def fixture():
    data = {
        'people': [{'id': 'person-a', 'name': '测试甲', 'roles': [{
            'title': '某局局长', 'org_id': 'office', 'status': 'current',
            'since': '2025-01', 'until': None, 'source_ids': ['source-a'],
            'verification_status': 'verified_current', 'as_of_date': AS_OF,
        }]}],
        'institutions': [{'id': 'office'}],
        'sources': [{'id': 'source-a', 'url': 'https://example.org/news?id=1',
                     'source_type': 'official_news', 'published_at': AS_OF}],
        'locations': [{'id': 'city'}],
        'career_posts': [],
        'profile_facts': [],
    }
    evidence = {'source-a': {'evidence_excerpt': '原文明确该人在报道时担任某局局长。'}}
    return data, evidence


class AccuracyTests(unittest.TestCase):
    def setUp(self):
        self.data, self.evidence = fixture()
        self.role = self.data['people'][0]['roles'][0]

    def report(self, **kwargs):
        return audit.analyze(self.data, self.evidence, kwargs.pop('as_of', AS_OF), **kwargs)

    def issues(self, code, report=None):
        report = self.report() if report is None else report
        return [issue for issue in report['issues'] if issue['code'] == code]

    def test_clean_fixture_has_no_errors_or_gaps(self):
        self.assertEqual(self.report()['totals'], {'error': 0, 'review': 0, 'gap': 0, 'info': 0})

    def test_overlapping_year_and_month_precision_is_not_reversed(self):
        self.role.update(status='former', verification_status='historical_only')
        for start, end in [('2026', '2026-01-01'), ('2026-02', '2026-02-01'),
                           ('2026-02-28', '2026-02'), ('2026-12-31', '2026')]:
            with self.subTest(start=start, end=end):
                self.role.update(since=start, until=end)
                self.assertEqual(self.issues('reversed_period'), [])

    def test_definitely_reversed_period_is_error(self):
        self.role.update(status='former', verification_status='historical_only',
                         since='2026-03', until='2026-02')
        issues = self.issues('reversed_period')
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]['level'], 'error')

    def test_invalid_calendar_date_is_error_but_leap_day_is_valid(self):
        for value, invalid in [('2025-02-29', True), ('2024-02-29', False),
                               ('2026-13', True), ('2026-00', True)]:
            with self.subTest(value=value):
                self.role['since'] = value
                issues = self.issues('invalid_date')
                self.assertEqual(bool(issues), invalid)
                self.assertTrue(all(issue['level'] == 'error' for issue in issues))

    def test_retrieval_and_publication_dates_do_not_fill_role_evidence_date(self):
        self.role.pop('as_of_date')
        self.role['checked_at'] = AS_OF
        self.data['people'][0]['checked_at'] = AS_OF
        self.data['sources'][0].update(accessed_at=AS_OF, published_at=AS_OF)
        self.evidence['source-a']['accessed_at'] = AS_OF
        issues = self.issues('missing_current_date')
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]['level'], 'gap')

    def test_explicit_role_evidence_date_is_accepted(self):
        for field in ['as_of_date', 'latest_confirmed_at', 'current_evidence_date']:
            with self.subTest(field=field):
                self.role.pop('as_of_date', None)
                self.role.pop('latest_confirmed_at', None)
                self.role.pop('current_evidence_date', None)
                self.role[field] = AS_OF
                self.assertEqual(self.issues('missing_current_date'), [])

    def test_staleness_starts_after_180_days_and_does_not_imply_departure(self):
        today = dt.date.fromisoformat(AS_OF)
        for age, expected in [(180, False), (181, True)]:
            with self.subTest(age=age):
                self.role['as_of_date'] = (today - dt.timedelta(days=age)).isoformat()
                before = copy.deepcopy(self.data)
                report = self.report()
                issues = self.issues('stale_current', report)
                self.assertEqual(bool(issues), expected)
                self.assertTrue(all(issue['level'] == 'review' for issue in issues))
                self.assertEqual(report['totals']['error'], 0)
                self.assertEqual(self.data, before)
                self.assertEqual(self.role['status'], 'current')
                self.assertIsNone(self.role['until'])

    def test_staleness_respects_month_precision(self):
        self.role['as_of_date'] = '2026-03'
        self.assertEqual(self.issues('stale_current'), [])
        self.role['as_of_date'] = '2026-02'
        self.assertEqual(self.issues('stale_current')[0]['level'], 'review')

    def test_stale_evidence_is_not_refreshed_by_checked_at(self):
        self.role.update(as_of_date='2026-01-01', checked_at=AS_OF)
        self.assertEqual(self.issues('stale_current')[0]['level'], 'review')

    def test_future_evidence_is_review_not_a_proven_false_statement(self):
        self.role['as_of_date'] = '2026-10-01'
        self.assertEqual(self.issues('future_evidence')[0]['level'], 'review')
        self.role['as_of_date'] = '2026-09'
        self.assertEqual(self.issues('future_evidence'), [])

    def test_duplicate_url_is_information_and_keeps_query_distinctions(self):
        for sid, url in [('fragment', 'https://EXAMPLE.org/news?id=1#paragraph'),
                         ('different-query', 'https://example.org/news?id=2'),
                         ('different-scheme', 'http://example.org/news?id=1')]:
            self.data['sources'].append({'id': sid, 'url': url, 'source_type': 'official_news'})
            self.evidence[sid] = {'evidence_excerpt': '支持对应事实的原文摘录。'}
        report = self.report()
        issues = self.issues('duplicate_url', report)
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]['level'], 'info')
        self.assertEqual(set(issues[0]['source_ids']), {'source-a', 'fragment'})
        self.assertEqual(report['unique_source_urls'], 3)
        self.assertEqual(report['totals']['error'], 0)

    def test_missing_or_blank_source_excerpt_is_gap(self):
        for entry in [None, {}, {'evidence_excerpt': ''}, {'evidence_excerpt': '  \n'}]:
            with self.subTest(entry=entry):
                self.evidence = {} if entry is None else {'source-a': entry}
                report = self.report()
                self.assertEqual(self.issues('missing_excerpt', report)[0]['level'], 'gap')
                self.assertEqual(report['totals']['error'], 0)

    def test_broken_source_or_institution_reference_is_error(self):
        for field, value in [('source_ids', ['missing']), ('org_id', 'missing')]:
            with self.subTest(field=field):
                before = self.role[field]
                self.role[field] = value
                self.assertEqual(self.issues('broken_reference')[0]['level'], 'error')
                self.role[field] = before

    def test_duplicate_stable_id_is_error_even_when_records_match(self):
        self.data['sources'].append(copy.deepcopy(self.data['sources'][0]))
        self.assertEqual(self.issues('duplicate_id')[0]['level'], 'error')

    def test_uncertain_role_must_not_be_current(self):
        for status in ['unverified', 'conflicting', 'directory_only', 'historical_only', 'verified_former']:
            with self.subTest(status=status):
                self.role['verification_status'] = status
                self.assertEqual(self.issues('current_uncertain')[0]['level'], 'error')

    def test_legacy_current_without_evidence_status_is_gap(self):
        self.role.pop('verification_status')
        report = self.report()
        self.assertEqual(self.issues('missing_role_status', report)[0]['level'], 'gap')
        self.assertEqual(report['totals']['error'], 0)

    def test_historical_unverified_lead_remains_review_not_error(self):
        self.role.update(status='historical', verification_status='unverified', as_of_date=None)
        report = self.report()
        self.assertEqual(self.issues('unverified_lead', report)[0]['level'], 'review')
        self.assertEqual(report['totals']['error'], 0)

    def test_closed_current_is_error(self):
        self.role['until'] = '2026-09-01'
        self.assertEqual(self.issues('current_closed')[0]['level'], 'error')

    def test_conflicting_background_facts_are_review_not_error(self):
        for index, value in enumerate(['1975', '1975-06']):
            self.data['profile_facts'].append({
                'id': f'birth-{index}', 'person_id': 'person-a', 'field': 'birth_date',
                'value': value, 'evidence_status': 'verified', 'reviewed_at': AS_OF,
                'evidence_excerpt': '该人物公开简历所载出生时间。', 'source_ids': ['source-a'],
            })
        report = self.report()
        self.assertEqual(self.issues('fact_conflict', report)[0]['level'], 'review')
        self.assertEqual(report['totals']['error'], 0)

    def test_marked_background_conflict_is_only_review(self):
        self.data['profile_facts'].append({
            'id': 'background', 'person_id': 'person-a', 'field': 'education',
            'value': '不同公开资料的学历描述待复核', 'evidence_status': 'conflicting',
            'source_ids': ['source-a'],
        })
        report = self.report()
        self.assertEqual(self.issues('explicit_conflict', report)[0]['level'], 'review')
        self.assertEqual(report['totals']['error'], 0)

    def test_known_identity_candidates_remain_separate_and_review_only(self):
        self.data['people'].append({'id': 'person-b', 'name': '测试甲', 'roles': []})
        self.data['people'][0]['possible_identity_ids'] = ['person-b']
        before = copy.deepcopy(self.data)
        report = self.report()
        self.assertEqual(self.issues('identity_candidates', report)[0]['level'], 'review')
        self.assertEqual(report['totals']['error'], 0)
        self.assertEqual(self.data, before)

    def test_career_reference_and_reversed_period_are_errors(self):
        self.data['career_posts'].append({
            'id': 'post', 'person_id': 'missing-person', 'organization_id': 'office',
            'start': '2026-03', 'end': '2026-02', 'source_ids': ['source-a'],
        })
        report = self.report()
        self.assertEqual(self.issues('broken_reference', report)[0]['level'], 'error')
        self.assertEqual(self.issues('reversed_period', report)[0]['level'], 'error')

    def test_uncertain_career_post_must_not_be_current(self):
        self.data['career_posts'].append({
            'id': 'post', 'person_id': 'person-a', 'organization_id': 'office',
            'start': None, 'end': None, 'is_current': True,
            'verification_status': 'unverified', 'source_ids': ['source-a'],
        })
        issues = self.issues('current_uncertain')
        self.assertTrue(any(i['entity_type'] == 'career_posts' and i['level'] == 'error' for i in issues),
                        'A career row drives the network and must not promote an unverified lead to current.')

    def test_reproducible_report_does_not_mutate_inputs(self):
        before = copy.deepcopy((self.data, self.evidence))
        first, second = self.report(), self.report()
        self.assertEqual(first, second)
        self.assertEqual(first['as_of_date'], AS_OF)
        self.assertEqual(len(first['input_sha256']), 64)
        self.assertEqual((self.data, self.evidence), before)
        self.evidence['source-a']['evidence_excerpt'] += '新增来源说明。'
        changed = self.report()
        self.assertNotEqual(first['evidence_sha256'], changed['evidence_sha256'])
        self.assertEqual(first['input_sha256'], changed['input_sha256'])


class AccuracyCLITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='atlas-accuracy-test-')
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        data, evidence = fixture()
        self.data_path = self.directory / 'atlas.json'
        self.evidence_path = self.directory / 'evidence.json'
        self.output_path = self.directory / 'report.json'
        self.markdown_path = self.directory / 'report.md'
        self.data_path.write_text(json.dumps(data, ensure_ascii=False))
        self.evidence_path.write_text(json.dumps(evidence, ensure_ascii=False))
        self.before = (self.data_path.read_bytes(), self.evidence_path.read_bytes())

    def command(self, *extra):
        return [sys.executable, str(ROOT / 'scripts/accuracy_report.py'),
                '--data', str(self.data_path), '--evidence', str(self.evidence_path),
                '--output', str(self.output_path), '--markdown', str(self.markdown_path), *extra]

    def run_command(self, *extra):
        return subprocess.run(self.command(*extra), capture_output=True, text=True,
                              cwd=self.directory, timeout=15)

    def assert_inputs_unchanged(self):
        self.assertEqual((self.data_path.read_bytes(), self.evidence_path.read_bytes()), self.before)

    def test_cli_requires_explicit_as_of_and_writes_nothing_without_it(self):
        result = self.run_command()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('--as-of', result.stderr)
        self.assertFalse(self.output_path.exists())
        self.assertFalse(self.markdown_path.exists())
        self.assert_inputs_unchanged()

    def test_cli_outputs_are_reproducible_and_inputs_are_read_only(self):
        result = self.run_command('--as-of', AS_OF)
        self.assertEqual(result.returncode, 0, result.stderr)
        first = (self.output_path.read_bytes(), self.markdown_path.read_bytes())
        result = self.run_command('--as-of', AS_OF)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.output_path.read_bytes(), self.markdown_path.read_bytes()), first)
        self.assert_inputs_unchanged()

    def test_cli_rejects_nonpositive_stale_interval(self):
        result = self.run_command('--as-of', AS_OF, '--stale-days', '0')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.output_path.exists())
        self.assert_inputs_unchanged()

    def test_cli_must_not_overwrite_input_when_output_aliases_input(self):
        for option, path in [('--output', self.data_path), ('--markdown', self.evidence_path)]:
            with self.subTest(option=option):
                # Both inputs are synthetic and isolated. A failed guard cannot touch production data.
                self.data_path.write_bytes(self.before[0])
                self.evidence_path.write_bytes(self.before[1])
                result = self.run_command('--as-of', AS_OF, option, str(path))
                self.assert_inputs_unchanged()
                self.assertNotEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()
