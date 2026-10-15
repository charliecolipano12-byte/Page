// Villarante's Kakanin - JavaScript Features

// ==========================================================================
// SHARED: Hamburger Menu, Sticky Header, Scroll Animations
// ==========================================================================
document.addEventListener('DOMContentLoaded', function() {
    // Hamburger Menu Toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            const isExpanded = this.getAttribute('aria-expanded') === 'true';
            this.setAttribute('aria-expanded', !isExpanded);
            navMenu.classList.toggle('is-open');
            document.body.style.overflow = isExpanded ? '' : 'hidden';
        });
        
        // Close menu when clicking a link
        navMenu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.setAttribute('aria-expanded', 'false');
                navMenu.classList.remove('is-open');
                document.body.style.overflow = '';
            });
        });
        
        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navMenu.classList.contains('is-open')) {
                hamburger.setAttribute('aria-expanded', 'false');
                navMenu.classList.remove('is-open');
                document.body.style.overflow = '';
            }
        });
    }

    // Sticky Header Shadow on Scroll
    const header = document.querySelector('.site-header');
    if (header) {
        let lastScroll = 0;
        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;
            if (currentScroll > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
            lastScroll = currentScroll;
        }, { passive: true });
    }

    // Scroll Animations (Intersection Observer)
    const animatedElements = document.querySelectorAll('.fade-in, .slide-up');
    if (animatedElements.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });
        
        animatedElements.forEach(el => observer.observe(el));
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                const headerHeight = document.querySelector('.site-header')?.offsetHeight || 0;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
                window.scrollTo({ top: targetPosition, behavior: 'smooth' });
            }
        });
    });

    // ==========================================================================
    // HOME PAGE: Add to Cart Buttons
    // ==========================================================================
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', function() {
            const product = this.dataset.product;
            const price = this.dataset.price;
            
            // Visual feedback
            const originalText = this.textContent;
            this.textContent = 'Added! \u2713';
            this.style.backgroundColor = '#28a745';
            
            // Show notification
            showCartNotification(`${product} added to order (\u20b1${price})`);
            
            setTimeout(() => {
                this.textContent = originalText;
                this.style.backgroundColor = '';
            }, 2000);
        });
    });

    function showCartNotification(message) {
        let notification = document.querySelector('.cart-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'cart-notification';
            document.body.appendChild(notification);
        }
        notification.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // ==========================================================================
    // FEATURE 1: Menu Filtering (for menu.html)
    // ==========================================================================
    const menuGrid = document.getElementById('menu-grid');
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    if (menuGrid && filterButtons.length > 0) {
        const menuItems = [
            { id: 1, name: 'Bibingka', description: 'Traditional baked rice cake with salted egg and cheese', price: '\u20b145.00', category: 'cakes', image: 'images/bibingka.jpg' },
            { id: 2, name: 'Puto', description: 'Steamed rice muffins, soft and fluffy', price: '\u20b125.00', category: 'steamed', image: 'images/puto.jpg' },
            { id: 3, name: 'Suman', description: 'Glutinous rice roll wrapped in banana leaves', price: '\u20b130.00', category: 'steamed', image: 'images/suman.jpg' },
            { id: 4, name: 'Kutsinta', description: 'Brown rice cake with grated coconut topping', price: '\u20b135.00', category: 'cakes', image: 'images/kutsinta.jpg' },
            { id: 5, name: 'Palitaw', description: 'Flat sweet rice cakes coated with sesame and sugar', price: '\u20b120.00', category: 'fried', image: 'images/palitaw.jpg' },
            { id: 6, name: 'Biko', description: 'Sweet sticky rice topped with caramelized coconut', price: '\u20b140.00', category: 'cakes', image: 'images/biko.jpg' }
        ];

        function renderMenu(category) {
            menuGrid.innerHTML = '';
            const filteredItems = category === 'all' ? menuItems : menuItems.filter(item => item.category === category);
            
            filteredItems.forEach(item => {
                const menuItem = document.createElement('div');
                menuItem.className = 'menu-item';
                menuItem.innerHTML = `
                    <img src="${item.image}" alt="${item.name}" loading="lazy">
                    <div class="menu-item-content">
                        <h3>${item.name}</h3>
                        <p>${item.description}</p>
                        <div class="price">${item.price}</div>
                    </div>
                `;
                menuGrid.appendChild(menuItem);
            });
        }

        function setActiveButton(button) {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        }

        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                setActiveButton(this);
                const category = this.getAttribute('data-category');
                renderMenu(category);
            });
        });

        renderMenu('all');
    }

    // ==========================================================================
    // FEATURE 2: Form Validation and Submission
    // ==========================================================================
    // Password visibility toggle
    document.querySelectorAll('.password-toggle').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input');
            const eyeOpen = this.querySelector('.eye-open');
            const eyeClosed = this.querySelector('.eye-closed');
            
            if (input.type === 'password') {
                input.type = 'text';
                if (eyeOpen) eyeOpen.style.display = 'none';
                if (eyeClosed) eyeClosed.style.display = 'block';
            } else {
                input.type = 'password';
                if (eyeOpen) eyeOpen.style.display = 'block';
                if (eyeClosed) eyeClosed.style.display = 'none';
            }
        });
    });

    // Password strength meter (signup only)
    const signupPassword = document.getElementById('signupPassword');
    const strengthBar = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    const passwordStrength = document.getElementById('passwordStrength');

    if (signupPassword && strengthBar && strengthText && passwordStrength) {
        signupPassword.addEventListener('input', function() {
            const password = this.value;
            passwordStrength.style.display = password.length > 0 ? 'block' : 'none';
            
            if (password.length === 0) return;
            
            let strength = 0;
            let feedback = '';
            
            if (password.length >= 8) strength++;
            if (password.length >= 12) strength++;
            if (/[A-Z]/.test(password)) strength++;
            if (/[a-z]/.test(password)) strength++;
            if (/[0-9]/.test(password)) strength++;
            if (/[^A-Za-z0-9]/.test(password)) strength++;
            
            strengthBar.className = 'strength-fill';
            
            if (strength <= 2) {
                strengthBar.classList.add('weak');
                feedback = 'Weak - Add more characters, uppercase, numbers, or symbols';
            } else if (strength <= 4) {
                strengthBar.classList.add('fair');
                feedback = 'Fair - Could be stronger with more variety';
            } else {
                strengthBar.classList.add('strong');
                feedback = 'Strong password';
            }
            
            strengthText.textContent = feedback;
        });
    }

    // Pre-order form validation (contact.html)
    const preorderForm = document.getElementById('preorderForm');
    const preorderFormMessage = document.getElementById('formMessage');

    if (preorderForm) {
        preorderForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            let isValid = true;
            const inputs = preorderForm.querySelectorAll('input[required], select[required]');
            
            inputs.forEach(input => {
                if (!input.value.trim()) {
                    isValid = false;
                    input.style.borderColor = '#dc3545';
                } else {
                    input.style.borderColor = '#ccc';
                }
            });
            
            const email = preorderForm.querySelector('#email');
            const phone = preorderForm.querySelector('#phone');
            
            if (email && email.value.trim() && !validateEmail(email.value.trim())) {
                isValid = false;
                email.style.borderColor = '#dc3545';
            }
            
            if (phone && phone.value.trim() && !validatePhone(phone.value.trim())) {
                isValid = false;
                phone.style.borderColor = '#dc3545';
            }
            
            if (isValid) {
                preorderFormMessage.textContent = 'Thank you! Your pre-order has been received. We will contact you shortly.';
                preorderFormMessage.className = 'form-message success';
                preorderFormMessage.style.display = 'block';
                preorderForm.reset();
                inputs.forEach(input => input.style.borderColor = '#ccc');
                if (email) email.style.borderColor = '#ccc';
                if (phone) phone.style.borderColor = '#ccc';
            } else {
                preorderFormMessage.textContent = 'Please fill in all required fields correctly.';
                preorderFormMessage.className = 'form-message error';
                preorderFormMessage.style.display = 'block';
            }
        });
    }

    // Login form validation (login.html)
    const loginForm = document.getElementById('loginForm');
    const loginFormMessage = document.getElementById('loginFormMessage');
    
    if (loginForm) {
        loginForm.querySelectorAll('input[required]').forEach(input => {
            input.addEventListener('blur', () => validateField(input));
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) validateField(input);
            });
        });

        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            let isValid = true;
            const inputs = loginForm.querySelectorAll('input[required]');
            
            inputs.forEach(input => {
                if (!validateField(input)) isValid = false;
            });
            
            const email = loginForm.querySelector('#loginEmail');
            if (email && email.value.trim() && !validateEmail(email.value.trim())) {
                setError(email);
                isValid = false;
            }
            
            if (isValid) {
                loginFormMessage.textContent = 'Login successful! Redirecting to dashboard...';
                loginFormMessage.className = 'form-message success';
                loginFormMessage.style.display = 'block';
                loginForm.reset();
                inputs.forEach(input => input.classList.remove('error', 'success'));
                if (email) email.classList.remove('error', 'success');
            } else {
                loginFormMessage.textContent = 'Please fill in all required fields correctly.';
                loginFormMessage.className = 'form-message error';
                loginFormMessage.style.display = 'block';
            }
        });
    }

    // Signup form validation (signup.html)
    const signupForm = document.getElementById('signupForm');
    const signupFormMessage = document.getElementById('signupFormMessage');
    
    if (signupForm) {
        signupForm.querySelectorAll('input[required]').forEach(input => {
            input.addEventListener('blur', () => validateField(input));
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) validateField(input);
            });
        });

        const confirmPassword = signupForm.querySelector('#signupConfirmPassword');
        const password = signupForm.querySelector('#signupPassword');
        if (confirmPassword && password) {
            confirmPassword.addEventListener('input', function() {
                if (password.value && this.value) {
                    if (password.value !== this.value) {
                        setError(this);
                    } else {
                        setSuccess(this);
                    }
                }
            });
        }

        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            let isValid = true;
            const inputs = signupForm.querySelectorAll('input[required]');
            
            inputs.forEach(input => {
                if (!validateField(input)) isValid = false;
            });
            
            const email = signupForm.querySelector('#signupEmail');
            if (email && email.value.trim() && !validateEmail(email.value.trim())) {
                setError(email);
                isValid = false;
            }
            
            const phone = signupForm.querySelector('#signupPhone');
            if (phone && phone.value.trim() && !validatePhone(phone.value.trim())) {
                setError(phone);
                isValid = false;
            }
            
            const pwd = signupForm.querySelector('#signupPassword');
            const confirmPwd = signupForm.querySelector('#signupConfirmPassword');
            if (pwd && confirmPwd && pwd.value && confirmPwd.value && pwd.value !== confirmPwd.value) {
                setError(confirmPwd);
                isValid = false;
            }
            
            if (isValid) {
                signupFormMessage.textContent = 'Account created successfully! Please login to continue.';
                signupFormMessage.className = 'form-message success';
                signupFormMessage.style.display = 'block';
                signupForm.reset();
                inputs.forEach(input => input.classList.remove('error', 'success'));
                if (email) email.classList.remove('error', 'success');
                if (phone) phone.classList.remove('error', 'success');
                if (pwd) pwd.classList.remove('error', 'success');
                if (confirmPwd) confirmPwd.classList.remove('error', 'success');
                
                const strengthDiv = document.getElementById('passwordStrength');
                if (strengthDiv) strengthDiv.style.display = 'none';
            } else {
                signupFormMessage.textContent = 'Please fill in all required fields correctly.';
                signupFormMessage.className = 'form-message error';
                signupFormMessage.style.display = 'block';
            }
        });
    }

    // Field validation helpers
    function validateField(input) {
        if (!input.value.trim()) {
            setError(input);
            return false;
        }
        
        if (input.type === 'email' && !validateEmail(input.value.trim())) {
            setError(input);
            return false;
        }
        
        if (input.type === 'tel' && !validatePhone(input.value.trim())) {
            setError(input);
            return false;
        }
        
        if (input.type === 'password' && input.hasAttribute('minlength')) {
            const minLength = parseInt(input.getAttribute('minlength'));
            if (input.value.length < minLength) {
                setError(input);
                return false;
            }
        }
        
        setSuccess(input);
        return true;
    }
    
    function setError(input) {
        input.classList.remove('success');
        input.classList.add('error');
    }
    
    function setSuccess(input) {
        input.classList.remove('error');
        input.classList.add('success');
    }
    
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    function validatePhone(phone) {
        const digitsOnly = phone.replace(/\D/g, '');
        return digitsOnly.length >= 10 && digitsOnly.length <= 12;
    }
});