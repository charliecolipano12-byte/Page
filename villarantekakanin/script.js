document.addEventListener("DOMContentLoaded", function() {
    const config = window.CONFIG || {};
    const business = config.business || {};
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-menu");

    function closeMenu() {
        if (!hamburger || !navMenu) return;
        hamburger.setAttribute("aria-expanded", "false");
        navMenu.classList.remove("is-open");
        document.body.style.overflow = "";
    }

    if (hamburger && navMenu) {
        hamburger.addEventListener("click", function() {
            const expanded = hamburger.getAttribute("aria-expanded") === "true";
            hamburger.setAttribute("aria-expanded", String(!expanded));
            navMenu.classList.toggle("is-open", !expanded);
            document.body.style.overflow = expanded ? "" : "hidden";
        });
        navMenu.querySelectorAll(".nav-link").forEach(link => {
            link.addEventListener("click", closeMenu);
        });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape") closeMenu();
        });
    }

    const header = document.querySelector(".site-header");
    if (header) {
        window.addEventListener("scroll", () => {
            header.classList.toggle("scrolled", window.pageYOffset > 50);
        }, { passive: true });
    }

    const animatedElements = document.querySelectorAll(".fade-in, .slide-up");
    if (animatedElements.length && "IntersectionObserver" in window) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
        animatedElements.forEach(element => observer.observe(element));
    } else {
        animatedElements.forEach(element => element.classList.add("visible"));
    }

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener("click", event => {
            const targetId = anchor.getAttribute("href");
            if (!targetId || targetId === "#") return;
            const target = document.querySelector(targetId);
            if (!target) return;
            event.preventDefault();
            const headerHeight = header ? header.offsetHeight : 0;
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
            window.scrollTo({ top: targetPosition, behavior: "smooth" });
        });
    });

    function formatAddress(address) {
        return [address.street, address.city, address.province, address.postalCode, address.country]
            .filter(Boolean)
            .join(", ");
    }

    function formatTime(value) {
        const [hour, minute] = value.split(":").map(Number);
        return new Date(Date.UTC(2000, 0, 1, hour, minute)).toLocaleTimeString("en-US", {
            timeZone: "UTC",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function formatHours(hours) {
        const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        return weekdays.map(day => {
            const range = hours[day];
            if (!range) return `${day}: closed`;
            const placeholder = range.placeholder ? " (placeholder)" : "";
            return `${day}: ${formatTime(range.open)}–${formatTime(range.close)}${placeholder}`;
        }).join("; ");
    }

    const address = formatAddress(business.address || {});
    document.querySelectorAll("[data-business-name]").forEach(element => {
        element.textContent = business.name || "Business name not provided";
    });
    document.querySelectorAll("[data-business-tagline]").forEach(element => {
        element.textContent = business.tagline || "";
    });
    document.querySelectorAll("[data-business-address]").forEach(element => {
        element.textContent = address;
    });
    document.querySelectorAll("[data-business-phone]").forEach(element => {
        const phone = business.phone || "[Phone number not provided]";
        element.textContent = phone;
        if (element instanceof HTMLAnchorElement) {
            const digits = phone.replace(/[^\d+]/g, "");
            if (/^\+?\d{7,15}$/.test(digits) && !phone.includes("[")) {
                element.href = `tel:${digits}`;
            } else {
                element.removeAttribute("href");
            }
        }
    });
    document.querySelectorAll("[data-business-email]").forEach(element => {
        const email = business.email || "[Email address not provided]";
        element.textContent = email;
        if (element instanceof HTMLAnchorElement) {
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.includes("[")) {
                element.href = `mailto:${email}`;
            } else {
                element.removeAttribute("href");
            }
        }
    });
    document.querySelectorAll("[data-business-hours]").forEach(element => {
        element.textContent = typeof business.hours === "string" ? business.hours : formatHours(business.hours || {});
    });
    document.querySelectorAll("[data-business-summary]").forEach(element => {
        const summary = [
            `Address: ${address}`,
            `Phone: ${business.phone || "[Phone number not provided]"}`,
            `Email: ${business.email || "[Email address not provided]"}`,
            `Pickup: ${typeof business.hours === "string" ? business.hours : formatHours(business.hours || {})}`,
            `Facebook / Messenger: ${business.facebookName || ""}`
        ];
        element.textContent = summary.join(" | ");
    });
    document.querySelectorAll("[data-social]").forEach(link => {
        const url = business.social && business.social[link.dataset.social];
        if (typeof url === "string" && /^https?:\/\//i.test(url)) {
            link.href = url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
        } else {
            link.hidden = true;
        }
    });
    document.querySelectorAll("[data-current-year]").forEach(element => {
        element.textContent = String(new Date().getFullYear());
    });
});
