document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("form").forEach(form => {
        const fields = form.querySelectorAll('input[type="password"]');
        const submit = form.querySelector('button[type="submit"]');
        if (!fields.length || !submit) return;
        const label = document.createElement("label");
        label.style.cssText = "display:flex;gap:.5rem;align-items:center;margin:0 0 1rem;font-size:.9rem;cursor:pointer";
        const box = document.createElement("input");
        box.type = "checkbox";
        label.append(box, document.createTextNode("Show password"));
        box.addEventListener("change", () => fields.forEach(f => { f.type = box.checked ? "text" : "password"; }));
        submit.parentNode.insertBefore(label, submit);
    });
});
