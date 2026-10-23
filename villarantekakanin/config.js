// Ate My's Kakanin - business and ordering configuration.
const CONFIG = {
    business: {
        name: "Ate My's Kakanin",
        tagline: "Homemade kakanin grown with the trust and support of our suki.",
        address: {
            street: "P-2 Cawayan",
            city: "Calinan, Davao City",
            province: "",
            postalCode: "",
            country: ""
        },
        phone: "0951 886 4526",
        email: "rayvillarante119@gmail.com",
        facebookName: "Mylen Villarante",
        hours: "Open daily, Monday to Sunday. Pickup hours are arranged with the customer.",
        social: {},
        gcash: {
            name: "Mylen Villarante",
            number: "0946 435 1750",
            qrImage: ""
        }
    },
    order: {
        // TODO: Confirm whether delivery is offered around Calinan; currently display pickup only.
        pickupOnly: true,
        pickupAddress: "P-2 Cawayan, Calinan, Davao City (around the Calinan district)"
    },
    backend: {
        appsScriptUrl: "https://script.google.com/macros/s/AKfycbxwTrumGi_u16O4HAPiEyVdGbrkc73QtHlclOwlf3zqm-pdH9eOIkEc_Z19eWoQzboZ7g/exec"
    }
};

if (typeof window !== "undefined") {
    window.CONFIG = CONFIG;
}
