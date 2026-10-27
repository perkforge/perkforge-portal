"""Regression checks for publication triggers, release gating and job permissions."""
from pathlib import Path
import unittest
import yaml


class ImageWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = yaml.load(Path('.github/workflows/image.yml').read_text(), Loader=yaml.BaseLoader)
        cls.jobs = cls.workflow['jobs']

    def test_only_main_branch_pushes_are_subscribed(self):
        events = self.workflow['on']
        self.assertEqual(set(events), {'push', 'pull_request', 'workflow_dispatch'})
        self.assertEqual(events['push'], {'branches': ['main']})

    def test_release_and_publication_require_main_push_and_new_release(self):
        main_push = "github.event_name == 'push' && github.ref == 'refs/heads/main'"
        self.assertEqual(self.jobs['release']['if'], main_push)
        self.assertEqual(self.jobs['publish']['if'], main_push + " && needs.release.outputs.release_created == 'true'")
        self.assertEqual(self.jobs['publish']['needs'], ['check-image', 'release'])
        self.assertEqual(self.jobs['release']['outputs']['release_created'], '${{ steps.release.outputs.release_created }}')
        self.assertEqual(self.jobs['publish']['env']['RELEASE_TAG'], '${{ needs.release.outputs.tag_name }}')

    def test_checks_cannot_publish_or_write_repository(self):
        self.assertEqual(self.workflow['permissions'], {'contents': 'read'})
        self.assertEqual(self.jobs['check-image']['permissions'], {'contents': 'read'})
        self.assertEqual(self.jobs['publish']['permissions'], {'contents': 'read', 'packages': 'write'})
        build = next(s for s in self.jobs['check-image']['steps'] if s.get('uses', '').startswith('docker/build-push-action@'))
        self.assertEqual(build['with']['push'], 'false')
        self.assertFalse(any(s.get('uses', '').startswith('docker/login-action@') for s in self.jobs['check-image']['steps']))


if __name__ == '__main__':
    unittest.main()
