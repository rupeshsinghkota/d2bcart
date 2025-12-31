// require('dotenv').config({ path: '.env.local' });

async function testShiprocket() {
    const email = "shiiivamsinghh@gmail.com";
    const password = "0@2gNvqXHFdn@YH5i3*ko4k2%^TZ4oT@";

    console.log('Testing Shiprocket API...');
    console.log(`Email: ${email}`);

    // 1. Login
    console.log('\n1. Logging in...');
    const loginRes = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const loginData = await loginRes.json();
    if (!loginData.token) {
        console.error('Login Failed:', loginData);
        return;
    }
    console.log('Login Successful!');
    const token = loginData.token;

    // 2. Try List Pickups (GET)
    console.log('\n2. Testing GET /settings/company/pickup (List Pickups)...');
    const listRes = await fetch('https://apiv2.shiprocket.in/v1/external/settings/company/pickup', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const listData = await listRes.json();
    console.log('List Pickups Status:', listRes.status);
    // console.log('List Pickups Data:', JSON.stringify(listData, null, 2));

    // 3. Try Add Pickup (POST) - Variant 1: addpickup
    console.log('\n3. Testing POST /settings/company/addpickup...');
    const pickupPayload = {
        pickup_location: "TEST_LOC_" + Date.now(),
        name: "Test User",
        email: "test@example.com",
        phone: "9876543210",
        address: "Test Address",
        city: "Delhi",
        state: "Delhi",
        country: "India",
        pin_code: "110001"
    };

    const addRes1 = await fetch('https://apiv2.shiprocket.in/v1/external/settings/company/addpickup', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(pickupPayload)
    });
    const addData1 = await addRes1.json();
    console.log('addpickup Status:', addRes1.status);
    console.log('addpickup Response:', JSON.stringify(addData1));

    // 4. Try Add Pickup (POST) - Variant 2: add-pickup (if 1 failed)
    if (addRes1.status === 404) {
        console.log('\n4. Testing POST /settings/company/add-pickup (Variant 2)...');
        const addRes2 = await fetch('https://apiv2.shiprocket.in/v1/external/settings/company/add-pickup', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pickupPayload)
        });
        const addData2 = await addRes2.json();
        console.log('add-pickup Status:', addRes2.status);
        console.log('add-pickup Response:', JSON.stringify(addData2));
    }
}

testShiprocket();
