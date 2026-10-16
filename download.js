/*
 * Shows the "Download as PDF" button and opens the browser's print dialog when it is clicked.
 * Every modern browser offers "Save as PDF" in that dialog, and the page's print styles lay the CV
 * out on A4. The button starts hidden, so a reader without JavaScript never sees a button that
 * does nothing.
 */

for (const button of document.querySelectorAll("[data-download]")) {
    button.hidden = false;
    button.addEventListener("click", () => window.print());
}
