// Villarante's Kakanin - Products (Single Source of Truth)
const PRODUCTS = [
    {
        id: "bibingka",
        name: "Bibingka",
        description: "Traditional baked rice cake with salted egg and cheese topping",
        price: 45.00,
        category: "baked",
        image: "images/bibingka.jpg",
        units: "pc",
        size: "[Size not provided]",
        allergens: ["dairy", "eggs"],
        dailyCapacity: 50,
        shelfLife: "[Shelf life not provided]",
        storageNotes: "[Storage instructions not provided]"
    },
    {
        id: "puto",
        name: "Puto",
        description: "Soft, fluffy steamed rice muffins—perfect for breakfast or merienda",
        price: 25.00,
        category: "steamed",
        image: "images/puto.jpg",
        units: "pc",
        size: "[Size not provided]",
        allergens: [],
        dailyCapacity: 100,
        shelfLife: "[Shelf life not provided]",
        storageNotes: "[Storage instructions not provided]"
    },
    {
        id: "suman",
        name: "Suman",
        description: "Glutinous rice rolls wrapped in banana leaves, served with latik",
        price: 30.00,
        category: "steamed",
        image: "images/suman.jpg",
        units: "pc",
        size: "[Size not provided]",
        allergens: [],
        dailyCapacity: 80,
        shelfLife: "[Shelf life not provided]",
        storageNotes: "[Storage instructions not provided]"
    },
    {
        id: "kutsinta",
        name: "Kutsinta",
        description: "Brown rice cake with grated coconut, sweet and chewy",
        price: 35.00,
        category: "steamed",
        image: "images/kutsinta.jpg",
        units: "pc",
        size: "[Size not provided]",
        allergens: [],
        dailyCapacity: 80,
        shelfLife: "[Shelf life not provided]",
        storageNotes: "[Storage instructions not provided]"
    },
    {
        id: "palitaw",
        name: "Palitaw",
        description: "Flat sweet rice cakes coated with sesame and sugar",
        price: 20.00,
        category: "boiled",
        image: "images/palitaw.jpg",
        units: "pc",
        size: "[Size not provided]",
        allergens: ["sesame"],
        dailyCapacity: 60,
        shelfLife: "[Shelf life not provided]",
        storageNotes: "[Storage instructions not provided]"
    },
    {
        id: "biko",
        name: "Biko",
        description: "Sweet sticky rice topped with caramelized coconut",
        price: 40.00,
        category: "sticky",
        image: "images/biko.jpg",
        units: "pc",
        size: "[Size not provided]",
        allergens: [],
        dailyCapacity: 60,
        shelfLife: "[Shelf life not provided]",
        storageNotes: "[Storage instructions not provided]"
    }
];

if (typeof window !== "undefined") {
    window.PRODUCTS = PRODUCTS;
}