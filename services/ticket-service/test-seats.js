/**
 * Seats API Quick Test
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3002';

async function testSeats() {
  console.log('🧪 Testing Seats API\n');

  try {
    // Test 1: Get seat layouts
    console.log('1️⃣  Testing GET /seats/layouts...');
    const layoutsRes = await axios.get(`${BASE_URL}/seats/layouts`);
    console.log('✅ Seat layouts:', layoutsRes.data.layouts.length, 'layouts');
    console.log('');

    // Test 2: Try to get seats for a non-existent event (should fail gracefully)
    console.log('2️⃣  Testing GET /seats/events/:eventId (non-existent)...');
    try {
      await axios.get(`${BASE_URL}/seats/events/00000000-0000-0000-0000-000000000000`);
      console.log('❌ Should have returned 404');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✅ Correctly returned 404 for non-existent event');
        console.log('   Error:', error.response.data.error);
      } else {
        throw error;
      }
    }
    console.log('');

    // Test 3: Invalid UUID test
    console.log('3️⃣  Testing Invalid UUID...');
    try {
      await axios.get(`${BASE_URL}/seats/events/invalid-uuid`);
      console.log('❌ Should have returned 400');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly rejected invalid UUID');
        console.log('   Error:', error.response.data.error);
      } else {
        throw error;
      }
    }
    console.log('');

    console.log('🎉 Seats API tests completed!');
    console.log('');
    console.log('📊 Summary:');
    console.log('   - Seat layouts endpoint: ✅');
    console.log('   - Error handling: ✅');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   ⚠️  Cannot connect to Ticket Service');
      console.error('   Please start the service with: npm start');
    }
    process.exit(1);
  }
}

testSeats()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
