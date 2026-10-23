import unittest
from scan_secrets import findings


class ScannerTests(unittest.TestCase):
    def test_database_credentials_are_redacted(self):
        sample = b'MONGODB_URI=mongodb+srv://owner:' + b'credentialValue82' + b'@cluster.invalid/db'
        result = findings("catalog-service/.env.example", sample)
        self.assertEqual(result[0]["kind"], "credentialed-database-uri")
        self.assertNotIn("credentialValue82", str(result))

    def test_placeholders_and_generated_keys_are_not_secrets(self):
        self.assertEqual(findings("users-service/.env.example", b'DATABASE_URL=postgresql://users:REEMPLAZAR@localhost/db'), [])
        self.assertEqual(findings("src/key.ts", b'generateKeyPairSync("rsa")'), [])

    def test_private_keys_and_literal_passwords_are_found_in_production(self):
        self.assertTrue(findings("src/key.ts", b'-----BEGIN ' + b'PRIVATE KEY-----'))
        self.assertTrue(findings("src/settings.ts", b'password: "' + b'actualSecretValue93' + b'"'))

    def test_test_fixture_exception_does_not_apply_to_production(self):
        value = b'password: "' + b'constantFakeValue93' + b'"'
        self.assertEqual(findings("users-service/tests/fixtures.ts", value), [])
        self.assertTrue(findings("users-service/src/fixtures.ts", value))

    def test_only_complete_bruno_variable_is_a_placeholder(self):
        self.assertEqual(findings("api/bruno/generate.mjs", b'password: "{{userPassword}}"'), [])
        self.assertTrue(findings("src/settings.ts", b'password: "' + b'prefix{{userPassword}}' + b'"'))
        self.assertTrue(findings("src/settings.ts", b'password: "' + b'{{literal secret}}' + b'"'))


if __name__ == "__main__":
    unittest.main()
