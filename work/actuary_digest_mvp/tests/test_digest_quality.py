import pathlib
import sys
import unittest


SRC = pathlib.Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))

import digest  # noqa: E402


class DigestQualityTests(unittest.TestCase):
    def test_title_similarity_ignores_publisher_suffix(self):
        title = "保险公司高管任职资格新规征求意见"
        self.assertTrue(digest.is_title_like(f"{title} - 东方财富", title))

    def test_ai_takeaway_matching_title_is_removed(self):
        title = "保险公司高管任职资格新规征求意见"
        cleaned = digest.sanitize_ai_enrichment({
            "key_takeaway": f"{title} - 东方财富",
            "summary_bullets": ["办法进一步细化任职条件并明确监管职责。"],
            "why_it_matters": "新规会影响保险公司的治理与高管准入。",
        }, title)
        self.assertEqual(cleaned["key_takeaway"], "")
        self.assertIn("细化任职条件", cleaned["ai_summary"])


if __name__ == "__main__":
    unittest.main()
