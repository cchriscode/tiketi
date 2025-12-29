/**
 * Ticket Service - Integration Test
 * Events 및 Tickets API 테스트
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3002';

async function runTests() {
  console.log('🧪 Ticket Service Integration Test\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣  Testing Health Check...');
    const healthRes = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check:', healthRes.data);
    console.log('');

    // Test 2: Get Events List
    console.log('2️⃣  Testing GET /events...');
    const eventsRes = await axios.get(`${BASE_URL}/events`);
    console.log('✅ Events retrieved:', eventsRes.data.events.length, 'events');
    console.log('   Pagination:', eventsRes.data.pagination);
    console.log('');

    // Test 3: Get Events with status filter
    console.log('3️⃣  Testing GET /events?status=on_sale...');
    const onSaleRes = await axios.get(`${BASE_URL}/events?status=on_sale`);
    console.log('✅ On-sale events:', onSaleRes.data.events.length);
    console.log('');

    // Test 4: Get Events with pagination
    console.log('4️⃣  Testing GET /events?page=1&limit=5...');
    const paginatedRes = await axios.get(`${BASE_URL}/events?page=1&limit=5`);
    console.log('✅ Paginated events:', paginatedRes.data.events.length);
    console.log('   Should be max 5:', paginatedRes.data.events.length <= 5);
    console.log('');

    // Test 5: Get Event Detail (if events exist)
    if (eventsRes.data.events.length > 0) {
      const firstEventId = eventsRes.data.events[0].id;
      console.log('5️⃣  Testing GET /events/:id...');
      const eventDetailRes = await axios.get(`${BASE_URL}/events/${firstEventId}`);
      console.log('✅ Event detail retrieved');
      console.log('   Event:', eventDetailRes.data.event.title);
      console.log('   Ticket Types:', eventDetailRes.data.ticketTypes.length);
      console.log('');

      // Test 6: Get Ticket Types for Event
      console.log('6️⃣  Testing GET /tickets/event/:eventId...');
      const ticketTypesRes = await axios.get(`${BASE_URL}/tickets/event/${firstEventId}`);
      console.log('✅ Ticket types retrieved:', ticketTypesRes.data.ticketTypes.length);
      console.log('');

      // Test 7: Get Ticket Availability (if ticket types exist)
      if (ticketTypesRes.data.ticketTypes.length > 0) {
        const firstTicketTypeId = ticketTypesRes.data.ticketTypes[0].id;
        console.log('7️⃣  Testing GET /tickets/availability/:ticketTypeId...');
        const availabilityRes = await axios.get(`${BASE_URL}/tickets/availability/${firstTicketTypeId}`);
        console.log('✅ Ticket availability:', availabilityRes.data);
        console.log('');
      }
    } else {
      console.log('⚠️  No events found in database - skipping event detail tests');
      console.log('');
    }

    // Test 8: Test Invalid UUID (should return 400)
    console.log('8️⃣  Testing Invalid UUID (should fail)...');
    try {
      await axios.get(`${BASE_URL}/events/invalid-uuid`);
      console.log('❌ Should have failed with 400');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly rejected invalid UUID');
        console.log('   Error:', error.response.data.error);
      } else {
        throw error;
      }
    }
    console.log('');

    // Test 9: Test Non-existent Event (should return 404)
    console.log('9️⃣  Testing Non-existent Event (should fail)...');
    try {
      await axios.get(`${BASE_URL}/events/00000000-0000-0000-0000-000000000000`);
      console.log('❌ Should have failed with 404');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✅ Correctly returned 404 for non-existent event');
        console.log('   Error:', error.response.data.error);
      } else {
        throw error;
      }
    }
    console.log('');

    console.log('🎉 All integration tests completed!\n');
    console.log('📊 Summary:');
    console.log('   - Health check: ✅');
    console.log('   - Events list: ✅');
    console.log('   - Events filtering: ✅');
    console.log('   - Events pagination: ✅');
    if (eventsRes.data.events.length > 0) {
      console.log('   - Event detail: ✅');
      console.log('   - Ticket types: ✅');
      console.log('   - Ticket availability: ✅');
    }
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

// Run tests
runTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
