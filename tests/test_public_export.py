"""Public-data boundary checks. Set ATLAS_PROJECT_ROOT when running outside the repository."""
import contextlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(os.environ.get('ATLAS_PROJECT_ROOT', Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(ROOT / 'scripts'))
import export_public


class PublicExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = json.loads((ROOT / 'data/atlas.json').read_text())

    def fixture(self):
        return copy.deepcopy(self.base)

    def assert_rejected(self, data):
        with self.assertRaises((AssertionError, ValueError, TypeError)):
            export_public.validate(data)

    def test_actual_public_data_validates(self):
        export_public.validate(self.fixture())

    def test_sanitize_removes_private_top_and_child_fields(self):
        data = self.fixture()
        data['personal_notes'] = 'TOP_SENTINEL'
        person = data['people'][0]
        person['personal_note'] = 'PERSON_SENTINEL'
        person['roles'][0]['personal_note'] = 'ROLE_SENTINEL'
        person['bio'][0]['source_path'] = 'BIO_SENTINEL'
        data['sources'][0]['evidence_file'] = 'SOURCE_SENTINEL'
        data['documents'] = [{'source_path': 'DOCUMENT_SENTINEL'}]
        data['guides'].append({'id': 'private-course', 'body': 'COURSE_SENTINEL',
                               'course_refs': [{'document_id': 'private'}], 'source_ids': []})
        result = export_public.sanitize(data)
        self.assertNotIn('SENTINEL', json.dumps(result))
        self.assertEqual(len(result['people']), len(self.base['people']))
        self.assertEqual(len(result['career_posts']), len(self.base['career_posts']))
        self.assertEqual(result['documents'], [])

    def test_sanitize_rejects_nested_object_in_allowed_field(self):
        for collection, field in [('people', 'focus'), ('sources', 'note'),
                                  ('career_posts', 'date_note')]:
            with self.subTest(collection=collection, field=field):
                data = self.fixture()
                data[collection][0][field] = [{'personal_note': 'NESTED_SENTINEL'}]
                with self.assertRaises((AssertionError, ValueError, TypeError)):
                    export_public.sanitize(data)
                self.assert_rejected(data)

    def test_public_date_notes_are_retained(self):
        data = self.fixture()
        data['people'][0]['roles'][0]['date_note'] = 'Public effective-date qualification'
        result = export_public.sanitize(data)
        self.assertEqual(result['people'][0]['roles'][0]['date_note'],
                         'Public effective-date qualification')

    def test_validate_rejects_unknown_root_fields(self):
        data = self.fixture()
        data['personal_notes'] = 'ROOT_SENTINEL'
        self.assert_rejected(data)

    def test_validate_rejects_unknown_role_and_bio_fields(self):
        for child in ['roles', 'bio']:
            with self.subTest(child=child):
                data = self.fixture()
                data['people'][0][child][0]['personal_note'] = 'CHILD_SENTINEL'
                self.assert_rejected(data)

    def test_validate_requires_boolean_evidence_flag(self):
        for value in [{'personal_note': 'EVIDENCE_SENTINEL'}, 'true', 1, []]:
            with self.subTest(value_type=type(value).__name__):
                data = self.fixture()
                data['sources'][0]['has_local_evidence'] = value
                self.assert_rejected(data)
        for value in [True, False]:
            data = self.fixture()
            data['sources'][0]['has_local_evidence'] = value
            export_public.validate(data)

    def test_source_closure_remains_required(self):
        data = self.fixture()
        data['people'][0]['source_ids'].append('missing-source-sentinel')
        self.assert_rejected(data)

    def test_empty_course_payload_stays_empty(self):
        self.assertEqual(self.base.get('documents'), [])
        self.assertTrue(all(not g.get('course_refs') for g in self.base['guides']))
        self.assertTrue(all(g['id'] in export_public.PUBLIC_GUIDES for g in self.base['guides']))

    def test_background_facts_preserve_provenance_but_strip_local_paths(self):
        data = self.fixture()
        fact = data['profile_facts'][0]
        fact['raw_path'] = '/Users/private/SENTINEL.html'
        fact['personal_note'] = 'PRIVATE_SENTINEL'
        result = export_public.sanitize(data)
        public = next(f for f in result['profile_facts'] if f['id'] == fact['id'])
        self.assertEqual(public['source_ids'], fact['source_ids'])
        self.assertEqual(public['evidence_excerpt'], fact['evidence_excerpt'])
        self.assertNotIn('SENTINEL', json.dumps(result))

    def test_background_fact_requires_identity_and_sources(self):
        for field, value in [('person_id', 'missing-person'), ('source_ids', []), ('evidence_status', 'probably')]:
            with self.subTest(field=field):
                data = self.fixture()
                data['profile_facts'][0][field] = value
                self.assert_rejected(data)

    def test_background_fact_duplicate_is_rejected(self):
        data = self.fixture()
        data['profile_facts'].append(copy.deepcopy(data['profile_facts'][0]))
        self.assert_rejected(data)

    def test_build_removes_stale_artifacts(self):
        spec = importlib.util.spec_from_file_location('atlas_test_build', ROOT / 'scripts/build.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix='atlas-public-test-') as directory:
            temp = Path(directory)
            shutil.copytree(ROOT / 'web', temp / 'web')
            shutil.copytree(ROOT / 'data', temp / 'data')
            (temp / 'site').mkdir()
            stale = temp / 'site/private-note-export.json'
            stale.write_text('{"private_sentinel": true}')
            module.ROOT = temp
            with patch.object(module.subprocess, 'check_output', return_value='test-revision\n'):
                with contextlib.redirect_stdout(io.StringIO()):
                    module.build()
            self.assertFalse(stale.exists())
            self.assertTrue((temp / 'site/index.html').is_file())
            self.assertEqual((temp / 'site/data/atlas.json').read_bytes(),
                             (temp / 'data/atlas.json').read_bytes())
            self.assertEqual(json.loads((temp / 'site/site-config.js').read_text()
                                         .removeprefix('window.ATLAS_CONFIG=').rstrip(';\n'))['mode'], 'public')


if __name__ == '__main__':
    unittest.main()
