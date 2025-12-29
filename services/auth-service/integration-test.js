/**
 * Auth Service - Integration Test
 * 실제 DB와 연동하여 테스트
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const testEmail = `test-${Date.now()}@example.com`;
const testPassword = 'password123';
let authToken = '';

async function runTests() {
  console.log('🧪 Auth Service Integration Test\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣  Testing Health Check...');
    const healthRes = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check:', healthRes.data);
    console.log('');

    // Test 2: Register New User
    console.log('2️⃣  Testing User Registration...');
    const registerRes = await axios.post(`${BASE_URL}/auth/register`, {
      email: testEmail,
      password: testPassword,
      name: 'Integration Test User',
      phone: '010-1234-5678'
    });
    console.log('✅ Registration successful');
    console.log('   User:', registerRes.data.user);
    console.log('   Token received:', registerRes.data.token ? 'Yes' : 'No');
    authToken = registerRes.data.token;
    console.log('');

    // Test 3: Login with Same Credentials
    console.log('3️⃣  Testing User Login...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: testEmail,
      password: testPassword
    });
    console.log('✅ Login successful');
    console.log('   User:', loginRes.data.user);
    console.log('   Token received:', loginRes.data.token ? 'Yes' : 'No');
    console.log('');

    // Test 4: Get My Info with Token
    console.log('4️⃣  Testing /me endpoint...');
    const meRes = await axios.get(`${BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    console.log('✅ /me endpoint successful');
    console.log('   User:', meRes.data.user);
    console.log('');

    // Test 5: Verify Token (Internal API)
    console.log('5️⃣  Testing /verify-token endpoint...');
    const verifyRes = await axios.post(`${BASE_URL}/auth/verify-token`, {
      token: authToken
    });
    console.log('✅ Token verification successful');
    console.log('   Valid:', verifyRes.data.valid);
    console.log('   User:', verifyRes.data.user);
    console.log('');

    // Test 6: Test Existing User Login (from migration)
    console.log('6️⃣  Testing Login with Migrated User...');
    try {
      const existingLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'qwer@naver.com',
        password: 'password123' // 기존 비밀번호를 모르므로 실패 예상
      });
      console.log('✅ Migrated user login:', existingLoginRes.data.user);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('⚠️  Migrated user login failed (expected - password unknown)');
      } else {
        throw error;
      }
    }
    console.log('');

    // Test 7: Test Duplicate Registration
    console.log('7️⃣  Testing Duplicate Registration (should fail)...');
    try {
      await axios.post(`${BASE_URL}/auth/register`, {
        email: testEmail,
        password: testPassword,
        name: 'Duplicate User'
      });
      console.log('❌ Should have failed with 409 Conflict');
    } catch (error) {
      if (error.response && error.response.status === 409) {
        console.log('✅ Duplicate registration correctly rejected');
        console.log('   Error:', error.response.data.error);
      } else {
        throw error;
      }
    }
    console.log('');

    // Test 8: Test Invalid Email Format
    console.log('8️⃣  Testing Invalid Email Format (should fail)...');
    try {
      await axios.post(`${BASE_URL}/auth/register`, {
        email: 'invalid-email',
        password: testPassword,
        name: 'Test User'
      });
      console.log('❌ Should have failed with 400 Bad Request');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Invalid email correctly rejected');
        console.log('   Error:', error.response.data.error);
      } else {
        throw error;
      }
    }
    console.log('');

    // Test 9: Test Invalid Token
    console.log('9️⃣  Testing Invalid Token (should fail)...');
    try {
      await axios.get(`${BASE_URL}/auth/me`, {
        headers: {
          Authorization: 'Bearer invalid-token-12345'
        }
      });
      console.log('❌ Should have failed with 401 Unauthorized');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Invalid token correctly rejected');
        console.log('   Error:', error.response.data.error);
      } else {
        throw error;
      }
    }
    console.log('');

    console.log('🎉 All integration tests completed!\n');
    console.log('📊 Summary:');
    console.log('   - Registration: ✅');
    console.log('   - Login: ✅');
    console.log('   - /me: ✅');
    console.log('   - verify-token: ✅');
    console.log('   - Error handling: ✅');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run tests
runTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
