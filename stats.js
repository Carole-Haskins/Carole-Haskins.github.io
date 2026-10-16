/*
 * Counts each headline number up from zero the first time it scrolls into view.
 *
 * Every element with a data-count attribute takes part. The page already contains the final
 * number, so a reader without JavaScript, a printed copy and a screen reader all get the right
 * figure. A reader who has asked the system for reduced motion sees the final number straight
 * away.
 */

const DURATION_MS = 1200;

const counters = [...document.querySelectorAll("[data-count]")];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (counters.length > 0 && !reduceMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                observer.unobserve(entry.target);
                runCount(entry.target);
            }
        }
    }, { threshold: 0.6 });

    for (const counter of counters) {
        counter.textContent = "0";
        observer.observe(counter);
    }
}

// ========================================================================================== \\
//                                      Helper Functions                                      \\
// ========================================================================================== \\

/**
 * Animates one counter from zero to its target, slowing as it nears the end.
 */
function runCount(element) {
    const target = Number(element.dataset.count);
    const startTime = performance.now();

    const step = (now) => {
        const progress = Math.min(1, (now - startTime) / DURATION_MS);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = String(Math.round(target * eased));
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    };

    requestAnimationFrame(step);
}

// A printed copy always shows the final numbers, even mid-animation.
window.addEventListener("beforeprint", () => {
    for (const counter of counters) {
        counter.textContent = counter.dataset.count;
    }
});
