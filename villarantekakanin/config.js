// Villarante's Kakanin - Configuration
// Centralized business info, site settings, and placeholder configs

const CONFIG = {
    business: {
        name: "Villarante's Kakanin",
        tagline: "Authentic Filipino rice delicacies made with generations-old recipes and the finest local ingredients.",
        address: {
            street: "[Street address not provided]",
            city: "[City not provided]",
            province: "[Province not provided]",
            postalCode: "[Postal code not provided]",
            country: "Philippines"
        },
        phone: "[Phone number not provided]",
        email: "[Email address not provided]",
        hours: {
            monday: { open: "06:00", close: "19:00", placeholder: true },
            tuesday: { open: "06:00", close: "19:00", placeholder: true },
            wednesday: { open: "06:00", close: "19:00", placeholder: true },
            thursday: { open: "06:00", close: "19:00", placeholder: true },
            friday: { open: "06:00", close: "19:00", placeholder: true },
            saturday: { open: "06:00", close: "17:00", placeholder: true },
            sunday: { open: "07:00", close: "15:00", placeholder: false }
        },
        social: {
            facebook: "[Facebook URL not provided]",
            instagram: "[Instagram URL not provided]",
            twitter: "[Twitter URL not provided]"
        },
        gcash: {
            name: "[GCash account name - not provided]",
            number: "[GCash mobile number - not provided]",
            qrImage: ""
        }
    },
    order: {
        leadTimeDays: 1,
        pickupOnly: true,
        deliveryFee: 50,
        slotDurationMinutes: 60,
        closedDays: [],
        openingHours: {
            monday: { open: "06:00", close: "19:00", placeholder: true },
            tuesday: { open: "06:00", close: "19:00", placeholder: true },
            wednesday: { open: "06:00", close: "19:00", placeholder: true },
            thursday: { open: "06:00", close: "19:00", placeholder: true },
            friday: { open: "06:00", close: "19:00", placeholder: true },
            saturday: { open: "06:00", close: "17:00", placeholder: true },
            sunday: { open: "07:00", close: "15:00", placeholder: false }
        }
    },
    // Firebase config - PLACEHOLDER VALUES. Replace with your actual Firebase project config.
    firebase: {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID",
        measurementId: "YOUR_MEASUREMENT_ID"
    },
    admin: {
        uid: "SET_ADMIN_UID_AFTER_CREATING_FIREBASE_USER"
    }
};

if (typeof window !== "undefined") {
    window.CONFIG = CONFIG;
}