// Ate My's Kakanin - Product catalog and shared package prices
// TODO: Confirm whether these package prices apply to every kakanin.
const PACKAGES = [
    { id: "aluminum-tray", name: "Aluminum Tray", pieces: 30, price: 280 },
    { id: "medium-bilao", name: "Medium Bilao", pieces: 50, price: 380 },
    { id: "large-bilao", name: "Large Bilao", pieces: 100, price: 580 }
];

const PRODUCTS = [
    // TODO: Add product photos when the owner provides photos for items without matching assets.
    {
        id: "puto-cheese",
        name: "Puto Cheese",
        description: "Soft, fluffy steamed rice cakes topped with creamy cheese.",
        allergens: "May contain milk, wheat, and eggs.",
        image: "images/puto.jpg"
    },
    {
        id: "pichi-pichi",
        name: "Pichi-Pichi",
        description: "Soft, chewy cassava delicacy coated with grated coconut.",
        allergens: "Commonly contains coconut or coconut products."
    },
    {
        id: "kutsinta",
        name: "Kutsinta",
        description: "Soft, chewy, slightly sweet rice cake, best with grated coconut.",
        allergens: "Commonly contains coconut or coconut products.",
        image: "images/kutsinta.jpg"
    },
    {
        id: "palitaw",
        name: "Palitaw",
        description: "Chewy glutinous rice cakes with grated coconut, sugar, and toasted sesame seeds.",
        allergens: "Commonly contains coconut or coconut products; contains sesame.",
        image: "images/palitaw.jpg"
    },
    {
        id: "sapin-sapin",
        name: "Sapin-Sapin",
        description: "Colorful layered rice cake with glutinous rice flour and coconut milk.",
        allergens: "Commonly contains coconut or coconut products."
    },
    {
        id: "tikoy",
        name: "Tikoy",
        description: "Soft, sticky, sweet glutinous rice cake. Slices can be pan-fried.",
        allergens: "Mainly glutinous rice flour and sugar."
    },
    {
        id: "biko",
        name: "Biko",
        description: "Glutinous rice, coconut milk, and brown sugar with a caramelized coconut topping.",
        allergens: "Commonly contains coconut or coconut products.",
        image: "images/biko.jpg"
    },
    {
        id: "suman",
        name: "Suman",
        description: "Glutinous rice and coconut milk wrapped in banana leaves.",
        allergens: "Commonly contains coconut or coconut products.",
        image: "images/suman.jpg"
    },
    {
        id: "maja-blanca",
        name: "Maja Blanca",
        description: "Creamy coconut pudding made with coconut milk and cornstarch.",
        allergens: "May contain milk and corn."
    },
    {
        id: "cassava-flan",
        name: "Cassava Flan",
        description: "Grated cassava with creamy custard flan.",
        allergens: "Typically contains cassava, eggs, and milk."
    },
    {
        id: "bibingka",
        name: "Bibingka (Seasonal)",
        description: "Available during the Christmas season and popular after Simbang Gabi. Please order in advance.",
        allergens: "TODO: Confirm Bibingka ingredients and allergen information.",
        image: "images/bibingka.jpg",
        seasonal: true
    }
];

if (typeof window !== "undefined") {
    window.PACKAGES = PACKAGES;
    window.PRODUCTS = PRODUCTS;
}
