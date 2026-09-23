"""Guarded source corrections, using only isolated in-memory data; no build or SQLite."""
import copy
import unittest
from unittest import mock

import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from data_merge import merge_packet


def fixture():
    return {
        'people': [
            {'id': 'person-a', 'name': '测试甲', 'source_ids': ['source-old'],
             'roles': [
                 {'org_id': 'office-old', 'title': '副局长', 'status': 'historical',
                  'verification_status': 'conflicting', 'source_ids': ['source-old']},
                 {'org_id': 'party-office', 'title': '党组成员', 'status': 'historical',
                  'source_ids': ['source-old']}],
             'bio': [{'years': '2010', 'role': '旧经历'}],
             'personal_note': '用户笔记不可丢失', 'tags': ['保留']},
            {'id': 'person-b', 'name': '测试甲', 'source_ids': ['source-old'], 'roles': []},
        ],
        'sources': [{'id': 'source-old', 'url': 'https://example.org/old', 'title': '旧来源'}],
        'institutions': [{'id': 'office-old', 'name': '旧机构', 'parent_id': None},
                         {'id': 'party-office', 'name': '党内机构', 'parent_id': None}],
        'career_posts': [{'id': 'career-a', 'person_id': 'person-a', 'organization_id': 'office-old',
                          'title': '副局长', 'source_ids': ['source-old'], 'end': None}],
        'profile_facts': [{'id': 'fact-a', 'person_id': 'person-a', 'field': 'education',
                           'value': '原表述', 'source_ids': ['source-old']}],
        'relations': [],
        'private_extra': {'notes': ['另一份笔记'], 'revision': 8},
    }


def correction(collection='people', record_id='person-a', before=None, changes=None, uid='review-1'):
    return {'id': uid, 'collection': collection, 'record_id': record_id,
            'before': {'identity_note': None} if before is None else before,
            'set': {'identity_note': '公开调任公告已复核'} if changes is None else changes,
            'source_ids': ['source-old'], 'reviewed_at': '2026-09-21',
            'reason': '对照具名任免原文更正，保留旧资料及其来源。'}


class ReviewedUpdateTests(unittest.TestCase):
    def setUp(self):
        self.data = fixture()

    def apply(self, update, **additions):
        packet = {**additions, 'reviewed_updates': [update]}
        original = copy.deepcopy(packet)
        merge_packet(self.data, packet)
        self.assertEqual(packet, original, 'Source packets must remain unchanged.')

    def reject(self, packet, message=None):
        before = copy.deepcopy(self.data)
        original = copy.deepcopy(packet)
        with self.assertRaisesRegex(ValueError, message or '.'):
            merge_packet(self.data, packet)
        self.assertEqual(self.data, before, 'A rejected correction must leave additions and earlier updates unapplied.')
        self.assertEqual(packet, original)

    def test_selected_field_preserves_identity_homonym_roles_and_private_data(self):
        before = copy.deepcopy(self.data)
        with mock.patch('sqlite3.connect', side_effect=AssertionError('SQLite must never be opened')):
            self.apply(correction())
        self.assertEqual([p['id'] for p in self.data['people']], ['person-a', 'person-b'])
        self.assertEqual(self.data['people'][1], before['people'][1])
        self.assertEqual(self.data['private_extra'], before['private_extra'])
        for key, value in before['people'][0].items():
            self.assertEqual(self.data['people'][0][key], value)
        self.assertEqual(self.data['people'][0]['identity_note'], '公开调任公告已复核')
        self.assertNotIn('reviewed_updates', self.data)
        self.assertNotIn('reviewed_at', self.data['people'][0])

    def test_reviewed_role_replacement_preserves_unrelated_party_role(self):
        roles = copy.deepcopy(self.data['people'][0]['roles'])
        revised = copy.deepcopy(roles)
        revised[0].update(status='former', verification_status='verified_former', until='2026-04')
        self.apply(correction(before={'roles': roles}, changes={'roles': revised}))
        self.assertEqual(self.data['people'][0]['roles'][0], revised[0])
        self.assertEqual(self.data['people'][0]['roles'][1], roles[1])
        self.assertEqual(self.data['people'][0]['personal_note'], '用户笔记不可丢失')

    def test_stale_selected_field_rejects_entire_packet(self):
        update = correction(before={'name': '别人'}, changes={'name': '更正名'})
        self.reject({'sources': [{'id': 'source-new', 'url': 'https://example.org/new'}],
                     'people': [{'id': 'person-c', 'name': '新增人', 'roles': []}],
                     'reviewed_updates': [update]}, 'Stale')

    def test_stale_later_update_rolls_back_earlier_correction(self):
        self.reject({'reviewed_updates': [correction(), correction(
            before={'name': '不匹配'}, changes={'name': '新名'}, uid='review-2')]}, 'Stale')

    def test_reapplication_is_strictly_stale(self):
        update = correction()
        self.apply(update)
        self.reject({'reviewed_updates': [update]}, 'Stale')

    def test_sequential_preconditions_see_prior_update(self):
        first = correction()
        second = correction(before={'identity_note': first['set']['identity_note']},
                            changes={'identity_note': '二次复核'}, uid='review-2')
        merge_packet(self.data, {'reviewed_updates': [first, second]})
        self.assertEqual(self.data['people'][0]['identity_note'], '二次复核')

    def test_sources_added_in_same_packet_are_available_and_order_is_preserved(self):
        update = correction()
        update['source_ids'] = ['source-second', 'source-first']
        packet = {'reviewed_updates': [update], 'sources': [
            {'id': 'source-first', 'url': 'https://example.org/first'},
            {'id': 'source-second', 'url': 'https://example.org/second'}]}
        original = copy.deepcopy(packet)
        merge_packet(self.data, packet)
        self.assertEqual([s['id'] for s in self.data['sources']], ['source-old', 'source-first', 'source-second'])
        self.assertEqual(packet, original)
        self.assertEqual(packet['reviewed_updates'][0]['source_ids'], ['source-second', 'source-first'])

    def test_selected_source_list_order_is_not_sorted_or_silently_appended(self):
        update = correction(before={'source_ids': ['source-old']},
                            changes={'source_ids': ['source-new', 'source-old']})
        update['source_ids'] = ['source-new']
        self.apply(update, sources=[{'id': 'source-new', 'url': 'https://example.org/new'}])
        self.assertEqual(self.data['people'][0]['source_ids'], ['source-new', 'source-old'])
        self.assertEqual(self.data['people'][0]['roles'][0]['source_ids'], ['source-old'])

    def test_all_additions_including_role_additions_precede_corrections(self):
        new_role = {'org_id': 'party-office', 'title': '委员', 'source_ids': ['source-old']}
        revised = self.data['people'][0]['roles'] + [new_role]
        update = correction(before={'roles': revised}, changes={'roles': revised,})
        self.apply(update, role_additions=[{'person_id': 'person-a', 'role': new_role}])
        self.assertEqual(self.data['people'][0]['roles'], revised)

    def test_new_records_can_be_reviewed_after_addition(self):
        update = correction('profile_facts', 'new-fact', {'value': '草稿'}, {'value': '核对后表述'})
        self.apply(update, profile_facts=[{'id': 'new-fact', 'person_id': 'person-a', 'value': '草稿'}])
        self.assertEqual(self.data['profile_facts'][-1]['value'], '核对后表述')

    def test_unknown_or_empty_supporting_sources_are_rejected(self):
        for sources in ([], ['missing'], 'source-old', None, [''], [1], ['source-old', 'missing']):
            with self.subTest(sources=sources):
                update = correction(); update['source_ids'] = sources
                self.reject({'reviewed_updates': [update]}, 'supporting source')

    def test_only_supported_collections_and_existing_unique_records(self):
        for collection in ('events', 'roles', 'sqlite', '', None):
            with self.subTest(collection=collection):
                self.reject({'reviewed_updates': [correction(collection=collection)]}, 'collection')
        self.reject({'reviewed_updates': [correction(record_id='missing')]}, 'existing record')
        self.data['people'].append(copy.deepcopy(self.data['people'][0]))
        self.reject({'reviewed_updates': [correction()]}, 'existing record')

    def test_updates_cover_each_allowed_collection_without_replacing_other_fields(self):
        cases = [
            ('people', 'person-a', {'name': '测试甲'}, {'name': '更正名'}),
            ('career_posts', 'career-a', {'organization_id': 'office-old'}, {'organization_id': 'party-office'}),
            ('institutions', 'office-old', {'name': '旧机构'}, {'name': '校正机构名'}),
            ('sources', 'source-old', {'title': '旧来源'}, {'title': '正确标题'}),
            ('profile_facts', 'fact-a', {'value': '原表述'}, {'value': '原文表述'}),
        ]
        for collection, record_id, before, changes in cases:
            with self.subTest(collection=collection):
                self.data = fixture()
                old = copy.deepcopy(next(r for r in self.data[collection] if r['id'] == record_id))
                self.apply(correction(collection, record_id, before, changes))
                revised = next(r for r in self.data[collection] if r['id'] == record_id)
                self.assertEqual(revised, {**old, **changes})

    def test_id_cannot_be_changed_or_selected_even_when_unchanged(self):
        for replacement in ('person-b', 'person-a', None):
            with self.subTest(replacement=replacement):
                self.reject({'reviewed_updates': [correction(before={'id': 'person-a'},
                            changes={'id': replacement})]}, 'cannot change id')

    def test_missing_field_none_convention_and_explicit_null(self):
        self.apply(correction())
        self.apply(correction(before={'identity_note': '公开调任公告已复核'},
                              changes={'identity_note': None}, uid='review-clear'))
        self.assertIn('identity_note', self.data['people'][0])
        self.assertIsNone(self.data['people'][0]['identity_note'])
        self.apply(correction(uid='review-after-null'))
        self.assertEqual(self.data['people'][0]['identity_note'], '公开调任公告已复核')

    def test_before_and_set_require_identical_nonempty_keys(self):
        for before, changes in (({}, {}), ({'name': '测试甲'}, {}),
                                ({'name': '测试甲'}, {'identity_note': '新值'}), ([], [])):
            with self.subTest(before=before, changes=changes):
                self.reject({'reviewed_updates': [correction(before=before, changes=changes)]}, 'same nonempty keys')

    def test_reason_and_full_valid_review_date_are_required(self):
        for field, values in [('reason', ['', '  ', None]),
                              ('reviewed_at', ['2026', '2026-09', '20260921', '2026-02-30', None])]:
            for value in values:
                with self.subTest(field=field, value=value):
                    update = correction(); update[field] = value
                    self.reject({'reviewed_updates': [update]})
        update = correction(); update['reviewed_at'] = '2024-02-29'
        self.apply(update)

    def test_missing_extra_fields_and_duplicate_correction_ids_are_rejected(self):
        for malformed in (None, {}, {**correction(), 'unhandled': True}):
            with self.subTest(malformed=malformed):
                self.reject({'reviewed_updates': [malformed]}, 'requires exactly')
        self.reject({'reviewed_updates': [correction(), correction()]}, 'Duplicate')
        for value in (None, {}, 'review'):
            self.reject({'reviewed_updates': value}, 'must be a list')

    def test_nested_type_and_list_order_changes_trigger_stale_protection(self):
        self.data['people'][0]['flags'] = {'confirmed': True}
        self.reject({'reviewed_updates': [correction(before={'flags': {'confirmed': 1}},
                    changes={'flags': {'confirmed': False}})]}, 'Stale')
        roles = copy.deepcopy(self.data['people'][0]['roles'])
        self.reject({'reviewed_updates': [correction(before={'roles': list(reversed(roles))},
                    changes={'roles': roles})]}, 'Stale')

    def test_correction_preconditions_are_not_silently_alias_normalized(self):
        self.data['career_posts'][0]['organization_id'] = 'shanghai-party'
        self.apply(correction('career_posts', 'career-a', {'organization_id': 'shanghai-party'},
                              {'organization_id': 'shanghai_party_committee'}))
        self.assertEqual(self.data['career_posts'][0]['organization_id'], 'shanghai_party_committee')

    def test_additions_keep_legacy_alias_behavior(self):
        packet = {'institutions': [{'id': 'shanghai-party', 'name': '上海市委', 'parent_id': None}]}
        original = copy.deepcopy(packet)
        merge_packet(self.data, packet)
        self.assertEqual(self.data['institutions'][-1]['id'], 'shanghai_party_committee')
        self.assertEqual(packet, original)

    def test_correction_values_do_not_alias_packet_values(self):
        update = correction(before={'tags': ['保留']}, changes={'tags': ['保留', '新增']})
        merge_packet(self.data, {'reviewed_updates': [update]})
        update['set']['tags'].append('后续外部修改')
        self.assertEqual(self.data['people'][0]['tags'], ['保留', '新增'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
