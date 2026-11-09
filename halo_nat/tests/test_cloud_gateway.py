import unittest

from cloud_gateway import _endpoint, _parse_geometry, build_payload


class FtmCloudUplinkTests(unittest.TestCase):
    def test_ranges_only_without_geometry(self):
        sample = build_payload({
            "ranges": {"HaloFront": 1.2, "HaloRearL": 2.3, "HaloRearR": 3.4},
        })
        self.assertIsNotNone(sample)
        self.assertEqual(sample["front_m"], 1.2)
        self.assertEqual(sample["rear_left_m"], 2.3)
        self.assertEqual(sample["rear_right_m"], 3.4)
        self.assertNotIn("x_m", sample)
        self.assertNotIn("reliable", sample)
        self.assertIn("sample_id", sample)
        self.assertIn("measured_at", sample)

    def test_partial_ranges_are_not_fake_positions(self):
        sample = build_payload({
            "ranges": {"HaloFront": 1.0, "HaloRearL": None, "HaloRearR": 3.0}
        }, positions=[(0, 1), (-1, 0), (1, 0)])
        self.assertEqual(sample["front_m"], 1.0)
        self.assertIsNone(sample["rear_left_m"])
        self.assertNotIn("x_m", sample)

    def test_missing_or_invalid_ranges_skipped(self):
        self.assertIsNone(build_payload({"ranges": None}))
        self.assertIsNone(build_payload({"ranges": {"HaloFront": float("nan")}}))
        self.assertIsNone(build_payload({"ranges": {"HaloFront": -22}}))

    def test_optional_position_uses_geometry(self):
        sample = build_payload({
            "ranges": {"HaloFront": 1.0, "HaloRearL": 1.0, "HaloRearR": 1.0},
        }, positions=[(0, 1), (-1, 0), (1, 0)])
        self.assertIsNotNone(sample)
        self.assertIn("x_m", sample)
        self.assertIn("y_m", sample)
        self.assertIn("residual_m", sample)
        self.assertIn("spread_m", sample)

    def test_bad_geometry_rejected_without_leak(self):
        with self.assertRaises(ValueError):
            _parse_geometry("[[0,0]]")
        with self.assertRaises(ValueError):
            _parse_geometry('[[0,0],["oops",0],[1,0]]')

    def test_endpoint_rejects_http_and_url_credentials(self):
        self.assertEqual(_endpoint("https://my-project.supabase.co/rest/v1"),
                         "https://my-project.supabase.co/functions/v1/ingest-ftm")
        with self.assertRaises(ValueError):
            _endpoint("http://my-project.supabase.co")
        with self.assertRaises(ValueError):
            _endpoint("https://user:password@my-project.supabase.co")


if __name__ == "__main__":
    unittest.main()
