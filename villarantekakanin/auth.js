document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("[data-auth-form]");
    const message = document.getElementById("auth-message");
    const submitButton = form?.querySelector('button[type="submit"]');
    const authStatus = document.querySelector("[data-auth-status]");

    function safeReturnPath(value) {
        if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "";
        try {
            const url = new URL(value, location.origin);
            return url.origin === location.origin ? `${url.pathname}${url.search}${url.hash}` : "";
        } catch {
            return "";
        }
    }

    const returnPath = safeReturnPath(new URLSearchParams(location.search).get("returnTo")) ||
        (location.pathname.startsWith("/admin/login") ? "/admin/" : "");
    if (returnPath) {
        document.querySelectorAll(".form-container a[href]").forEach(link => {
            const url = new URL(link.href, location.href);
            if (url.origin === location.origin && ["/login/", "/signup/"].includes(url.pathname)) {
                url.searchParams.set("returnTo", returnPath);
                link.href = url.pathname + url.search + url.hash;
            }
        });
    }

    async function updateLandingAuth() {
        const guestLinks = document.querySelector("[data-auth-guest]");
        const signedIn = document.querySelector("[data-auth-user]");
        if (!guestLinks || !signedIn) return;

        try {
            const response = await fetch("/api/auth/session", {
                credentials: "same-origin",
                headers: { Accept: "application/json" }
            });
            if (!response.ok) throw new Error("Could not check sign-in status.");

            const { user } = await response.json();
            if (authStatus) authStatus.hidden = true;
            guestLinks.hidden = Boolean(user);
            signedIn.hidden = !user;

            if (user) {
                signedIn.querySelector("[data-auth-name]").textContent = user.name;
            }
        } catch (error) {
            console.error("Unable to load sign-in status:", error);
            if (authStatus) {
                authStatus.textContent = "Sign-in status is unavailable. Please refresh.";
                authStatus.hidden = false;
            }
        }
    }

    const accountMenuToggle = document.querySelector("[data-account-menu-toggle]");
    const accountMenu = document.getElementById("account-menu");
    accountMenuToggle?.addEventListener("click", () => {
        if (!accountMenu) return;
        const expanded = accountMenuToggle.getAttribute("aria-expanded") === "true";
        accountMenuToggle.setAttribute("aria-expanded", String(!expanded));
        accountMenu.hidden = expanded;
    });

    document.addEventListener("click", event => {
        if (!accountMenu ||
            accountMenu.hidden ||
            accountMenu.contains(event.target) ||
            accountMenuToggle?.contains(event.target)) return;
        accountMenu.hidden = true;
        accountMenuToggle?.setAttribute("aria-expanded", "false");
    });

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape" || !accountMenu || accountMenu.hidden) return;
        accountMenu.hidden = true;
        accountMenuToggle?.setAttribute("aria-expanded", "false");
        accountMenuToggle?.focus();
    });

    const logoutButton = document.querySelector("[data-auth-logout]");
    logoutButton?.addEventListener("click", async () => {
        logoutButton.disabled = true;
        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin",
                headers: { Accept: "application/json" }
            });
            if (!response.ok) throw new Error("Could not log out.");
            window.location.assign("/");
        } catch (error) {
            console.error("Unable to log out:", error);
            if (authStatus) {
                authStatus.textContent = "Could not log out. Please try again.";
                authStatus.hidden = false;
            }
            logoutButton.disabled = false;
        }
    });

    const deleteAccountButton = document.querySelector("[data-auth-delete]");
    const deleteAccountDialog = document.querySelector("[data-account-delete-dialog]");
    const deleteAccountForm = document.querySelector("[data-account-delete-form]");
    const deleteAccountMessage = document.getElementById("account-delete-message");

    deleteAccountButton?.addEventListener("click", () => {
        deleteAccountForm.reset();
        deleteAccountMessage.textContent = "";
        deleteAccountMessage.classList.remove("error");
        deleteAccountDialog.showModal();
    });

    deleteAccountDialog?.querySelector("[data-account-delete-cancel]")?.addEventListener("click", () => {
        deleteAccountDialog.close();
    });

    deleteAccountForm?.addEventListener("submit", async event => {
        event.preventDefault();
        deleteAccountMessage.textContent = "";
        const submitButton = deleteAccountForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        try {
            const response = await fetch("/api/auth/account", {
                method: "DELETE",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify({
                    password: new FormData(deleteAccountForm).get("password")
                })
            });
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || "Could not delete the account.");
            }
            window.location.reload();
        } catch (error) {
            deleteAccountMessage.textContent = error.message || "Could not connect. Please try again.";
            deleteAccountMessage.classList.add("error");
            submitButton.disabled = false;
        }
    });

    if (form) {
        form.addEventListener("submit", async event => {
            event.preventDefault();
            message.textContent = "";
            message.classList.remove("error");

            const formData = new FormData(form);
            const payload = Object.fromEntries(formData.entries());
            if (form.dataset.authForm === "signup") {
                payload.accountPrivacy = formData.get("accountPrivacy") === "on";
            }
            if (form.dataset.authForm === "signup" && payload.password !== payload.confirmPassword) {
                message.textContent = "The passwords do not match.";
                message.classList.add("error");
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = form.dataset.authForm === "signup" ? "Creating account..." : "Signing in...";

            try {
                const response = await fetch(`/api/auth/${form.dataset.authForm}`, {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json"
                    },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "Authentication failed.");

                window.location.assign(returnPath || "/index.html");
            } catch (error) {
                message.textContent = error.message || "Could not connect. Please try again.";
                message.classList.add("error");
                submitButton.disabled = false;
                submitButton.textContent = form.dataset.authForm === "signup" ? "Create account" : "Login";
            }
        });
    }

    updateLandingAuth();
});
