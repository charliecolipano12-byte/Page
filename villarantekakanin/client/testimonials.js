// Landing page testimonials / photos (owner-supplied only).
// Add entries to TESTIMONIALS to show the section. Keep the array empty to hide it.
// Do not invent testimonials or photos. Each entry may include:
// { quote: "Real customer words", name: "First name or initials", photo: "images/your-photo.jpg" }
(function () {
    var testimonials = Array.isArray(window.TESTIMONIALS) ? window.TESTIMONIALS : [];
    var section = document.getElementById("testimonials");
    if (section && testimonials.length) {
        section.hidden = false;
        section.innerHTML =
            '<div class="container">' +
            '<h2 id="testimonials-title" class="section-title">Customer Photos and Feedback</h2>' +
            '<div class="testimonials-grid"></div>' +
            '</div>';
        var grid = section.querySelector(".testimonials-grid");
        testimonials.forEach(function (entry) {
            if (!entry) return;
            var card = document.createElement("article");
            card.className = "testimonial-card";
            if (entry.photo) {
                var img = document.createElement("img");
                img.className = "testimonial-photo";
                img.src = entry.photo;
                img.alt = entry.name ? "Photo shared by " + entry.name : "Customer photo";
                img.loading = "lazy";
                card.appendChild(img);
            }
            if (entry.quote) {
                var quote = document.createElement("p");
                quote.className = "testimonial-text";
                quote.textContent = entry.quote;
                card.appendChild(quote);
            }
            if (entry.name) {
                var name = document.createElement("p");
                name.className = "testimonial-author";
                name.textContent = entry.name;
                card.appendChild(name);
            }
            if (card.childNodes.length) grid.appendChild(card);
        });
    }

    // Freshness and Storage: open on desktop (> 600px), closed on small screens.
    var freshness = document.getElementById("freshness-details");
    if (freshness && window.matchMedia) {
        freshness.open = window.matchMedia("(min-width: 601px)").matches;
    }
})();
