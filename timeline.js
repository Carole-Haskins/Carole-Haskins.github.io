/*
 * <career-timeline>
 *
 * Draws the page's dated entries as a vertical timeline, with the newest year at the top. Each
 * period is a bar whose height matches how long it lasted, and a label beside it gives its title,
 * role, dates and length. Every label is always visible, so a reader never has to find a thin bar
 * with the mouse. Pointing at a bar or its label highlights both, and clicking either one scrolls
 * to the period's full entry on the page and briefly highlights it.
 *
 * The element builds its periods from the page. Every element with a data-timeline attribute
 * becomes one period:
 *
 *   <li data-timeline="work">
 *     <h3>Head of Preparatory</h3>
 *     <p class="entry-role">Reddford House Preparatory</p>
 *     <p><time datetime="2021-01">January 2021</time> to <time datetime="2026-02">February 2026</time></p>
 *   </li>
 *
 *   - The first h3 gives the title, and an element with the class entry-role gives the role.
 *   - A data-timeline-title attribute gives the title in place of the h3.
 *   - The first <time> gives the start and the second gives the end. A period with a single
 *     <time> runs to the present.
 *   - A datetime is a year (2016) or a month (2025-05). A year counts in full, so a start of 2016
 *     means January 2016 and an end of 2018 means December 2018.
 *   - data-timeline="study" draws the period as an outlined bar. Any other value draws it solid.
 *
 * Periods that overlap are drawn in their own column, side by side, so two roles held at the same
 * time both stay visible. Labels that would collide move down until they clear the label above,
 * and a connecting line joins each label to its bar.
 *
 * Colours and fonts come from the page's custom properties (--paper, --ink, --accent and the
 * rest). Custom properties pass into the shadow root, so the timeline follows the page's light
 * and dark themes.
 */

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

// Layout sizes, in rem. Narrow screens wrap each label onto more lines, so a year there takes
// more height, which keeps every label level with its bar.
const YEAR_HEIGHT = 1.2;
const NARROW_YEAR_HEIGHT = 2;
const NARROW_WIDTH = 32;
const AXIS_WIDTH = 3;
const LANE_WIDTH = 1;
const LANE_GAP = 0.4;
const LEADER_SPACE = 2.5;
const LABEL_GAP = 0.6;
const MIN_BAR_HEIGHT = 0.6;

const STYLES = `
    :host {
        --tl-paper: var(--paper, #ffffff);
        --tl-ink: var(--ink, #222222);
        --tl-strong: var(--strong, #111111);
        --tl-muted: var(--muted, #555555);
        --tl-line: var(--line, #bbbbbb);
        --tl-accent: var(--accent, #40798c);
        --tl-accent-soft: var(--accent-soft, rgb(64 121 140 / 0.15));
        --tl-display: var(--display, system-ui, sans-serif);
        --tl-text: var(--text, Georgia, serif);
        --tl-mono: var(--mono, ui-monospace, monospace);

        display: block;
        color: var(--tl-ink);
        font-family: var(--tl-text);
    }

    :host([hidden]) { display: none; }

    * { box-sizing: border-box; }

    .chart {
        position: relative;
    }

    .axis-line {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 1px;
        background: var(--tl-line);
    }

    .tick {
        position: absolute;
        height: 1px;
        width: 0.35rem;
        background: var(--tl-line);
    }

    .tick.major { width: 0.7rem; }

    .year {
        position: absolute;
        transform: translateY(-50%);
        font-family: var(--tl-mono);
        font-size: 0.75rem;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        color: var(--tl-muted);
    }

    .leaders {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
    }

    .leaders path {
        fill: none;
        stroke: var(--tl-line);
        stroke-width: 1;
        transition: stroke 0.15s ease;
    }

    .leaders path.is-active {
        stroke: var(--tl-accent);
        stroke-width: 2;
    }

    .bar {
        position: absolute;
        border-radius: 3px;
        background: var(--tl-accent);
        cursor: pointer;
        transition: filter 0.15s ease, box-shadow 0.15s ease;
    }

    .bar.study {
        background: var(--tl-accent-soft);
        box-shadow: inset 0 0 0 1px var(--tl-accent);
    }

    .bar.is-active {
        box-shadow: 0 0 0 3px var(--tl-accent-soft);
        filter: brightness(0.85);
    }

    .bar.study.is-active {
        box-shadow: inset 0 0 0 2px var(--tl-accent), 0 0 0 3px var(--tl-accent-soft);
        filter: none;
    }

    .label {
        position: absolute;
        display: grid;
        gap: 0.1rem;
        max-width: 34rem;
        margin: 0;
        padding: 0.35rem 0.6rem;
        border: 0;
        border-radius: 0.4rem;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        -webkit-tap-highlight-color: transparent;
        transition: background 0.15s ease;
    }

    .label.is-active { background: var(--tl-accent-soft); }

    .label:focus { outline: none; }

    .label:focus-visible {
        outline: 2px solid var(--tl-accent);
        outline-offset: 1px;
    }

    .label-title {
        font-family: var(--tl-display);
        font-weight: 500;
        font-size: 1.05rem;
        line-height: 1.25;
        color: var(--tl-strong);
    }

    .label-role {
        font-size: 0.95rem;
        line-height: 1.35;
    }

    .label-role:empty { display: none; }

    .label-dates {
        font-family: var(--tl-mono);
        font-size: 0.75rem;
        line-height: 1.5;
        color: var(--tl-muted);
    }

    .hint {
        margin: 1rem 0 0;
        font-family: var(--tl-mono);
        font-size: 0.75rem;
        letter-spacing: 0.04em;
        color: var(--tl-muted);
    }

    .hint-touch { display: none; }

    @media (hover: none) {
        .hint-hover { display: none; }
        .hint-touch { display: inline; }
    }

    @media (prefers-reduced-motion: reduce) {
        .leaders path, .bar, .label { transition: none; }
    }
`;

// ========================================================================================== \\
//                                          Element                                           \\
// ========================================================================================== \\

class CareerTimeline extends HTMLElement {

    #periods = [];
    #bars = [];
    #labels = [];
    #leaders = [];
    #axis = null;
    #laneCount = 1;
    #chart = null;
    #svg = null;
    #ticks = [];
    #yearHeight = YEAR_HEIGHT;
    #resizeObserver = null;

    connectedCallback() {
        if (this.shadowRoot) {
            return;
        }
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => this.#build(), { once: true });
        } else {
            this.#build();
        }
    }

    disconnectedCallback() {
        this.#resizeObserver?.disconnect();
    }

    #build() {
        if (this.shadowRoot) {
            return;
        }

        const now = readMonthPosition(new Date());
        this.#periods = readPeriods(document, now);
        if (this.#periods.length === 0) {
            this.hidden = true;
            return;
        }

        const currentMonth = Math.floor(now);
        this.#axis = computeAxis(this.#periods, now);
        const lanes = assignLanes(this.#periods);
        this.#laneCount = Math.max(...lanes) + 1;

        const root = this.attachShadow({ mode: "open" });
        const style = document.createElement("style");
        style.textContent = STYLES;

        this.#chart = createElement("div", "chart");

        const axisLine = createElement("span", "axis-line");
        axisLine.setAttribute("aria-hidden", "true");
        axisLine.style.left = `${AXIS_WIDTH}rem`;
        this.#chart.append(axisLine);

        // A tick for every year, and a label beside every fifth one.
        for (let year = this.#axis.start / 12; year * 12 <= this.#axis.end; year++) {
            const major = year % 5 === 0;

            const tick = createElement("span", major ? "tick major" : "tick");
            tick.setAttribute("aria-hidden", "true");
            tick.style.left = `${AXIS_WIDTH}rem`;
            this.#chart.append(tick);
            this.#ticks.push({ element: tick, month: year * 12 });

            if (major) {
                const label = createElement("span", "year", String(year));
                label.setAttribute("aria-hidden", "true");
                label.style.left = "0";
                this.#chart.append(label);
                this.#ticks.push({ element: label, month: year * 12 });
            }
        }

        this.#svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.#svg.classList.add("leaders");
        this.#svg.setAttribute("aria-hidden", "true");
        this.#chart.append(this.#svg);

        const list = createElement("ol", "periods");
        list.setAttribute("aria-label", "Career timeline");
        list.style.cssText = "margin: 0; padding: 0; list-style: none;";

        this.#periods.forEach((period, index) => {
            const left = AXIS_WIDTH + 0.6 + lanes[index] * (LANE_WIDTH + LANE_GAP);

            const bar = createElement("span", `bar ${period.kind}`);
            bar.setAttribute("aria-hidden", "true");
            bar.style.left = `${left}rem`;
            bar.style.width = `${LANE_WIDTH}rem`;
            this.#bindHighlight(bar, index);
            this.#chart.append(bar);

            const item = document.createElement("li");
            const label = createElement("button", "label");
            label.type = "button";
            label.setAttribute("aria-label", `${describePeriod(period, currentMonth)}. Go to the full entry.`);
            label.append(
                createElement("span", "label-title", period.title),
                createElement("span", "label-role", period.role),
                createElement("span", "label-dates", `${formatRange(period)} · ${formatLength(period, currentMonth)}`),
            );
            this.#bindHighlight(label, index);
            item.append(label);
            list.append(item);

            const leader = document.createElementNS("http://www.w3.org/2000/svg", "path");
            this.#svg.append(leader);

            this.#bars.push(bar);
            this.#labels.push(label);
            this.#leaders.push(leader);
        });

        this.#chart.append(list);

        const hint = createElement("p", "hint");
        hint.append(
            createElement("span", "hint-hover", "Click a role to read its full entry."),
            createElement("span", "hint-touch", "Tap a role to read its full entry."),
        );

        root.append(style, this.#chart, hint);

        // Label heights change with the width and once the web fonts arrive.
        this.#resizeObserver = new ResizeObserver(() => this.#layout());
        this.#resizeObserver.observe(this);
        document.fonts?.ready.then(() => this.#layout());
        this.#layout();
    }

    #bindHighlight(element, index) {
        element.addEventListener("pointerenter", () => this.#setActive(index, true));
        element.addEventListener("pointerleave", () => this.#setActive(index, false));
        element.addEventListener("focus", () => this.#setActive(index, true));
        element.addEventListener("blur", () => this.#setActive(index, false));
        element.addEventListener("click", () => revealEntry(this.#periods[index].entry));
    }

    #setActive(index, active) {
        this.#bars[index].classList.toggle("is-active", active);
        this.#labels[index].classList.toggle("is-active", active);
        this.#leaders[index].classList.toggle("is-active", active);
    }

    /**
     * Places each label beside its bar, moving it down where it would overlap the label above,
     * then draws the line from the bar to the label. The chart grows if the last label runs past
     * the bottom of the axis.
     */
    #layout() {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const narrow = this.clientWidth < NARROW_WIDTH * rem;
        this.#yearHeight = narrow ? NARROW_YEAR_HEIGHT : YEAR_HEIGHT;
        this.#placeScale();

        const leaderSpace = narrow ? LEADER_SPACE * 0.6 : LEADER_SPACE;
        const lanesRight = AXIS_WIDTH + 0.6 + this.#laneCount * (LANE_WIDTH + LANE_GAP) - LANE_GAP;
        const labelLeft = (lanesRight + leaderSpace) * rem;
        const axisHeight = (this.#axis.span / 12) * this.#yearHeight * rem;

        const order = this.#periods
            .map((period, index) => index)
            .sort((a, b) => this.#periods[b].endPosition - this.#periods[a].endPosition);

        let nextFree = 0;
        let bottom = axisHeight;
        for (const index of order) {
            const bar = this.#bars[index];
            const label = this.#labels[index];

            const barTop = bar.offsetTop;
            const barHeight = bar.offsetHeight;
            const anchorY = barTop + Math.min(barHeight / 2, 0.75 * rem);

            label.style.left = `${labelLeft}px`;
            const labelHeight = label.offsetHeight;
            const wantedTop = anchorY - 0.9 * rem;
            const labelTop = Math.max(wantedTop, nextFree);
            label.style.top = `${labelTop}px`;
            nextFree = labelTop + labelHeight + LABEL_GAP * rem;
            bottom = Math.max(bottom, labelTop + labelHeight);

            const startX = bar.offsetLeft + bar.offsetWidth;
            const labelY = labelTop + 0.9 * rem;
            const bendX = lanesRight * rem + leaderSpace * rem * 0.5;
            this.#leaders[index].setAttribute(
                "d",
                `M ${startX} ${anchorY} H ${bendX} V ${labelY} H ${labelLeft}`,
            );
        }

        this.#chart.style.height = `${bottom}px`;
    }

    // Positions the ticks, year labels and bars for the current height of a year.
    #placeScale() {
        for (const { element, month } of this.#ticks) {
            element.style.top = `${this.#toRem(month)}rem`;
        }
        this.#periods.forEach((period, index) => {
            const top = this.#toRem(period.endPosition);
            const height = Math.max(MIN_BAR_HEIGHT, this.#toRem(period.start.index) - top);
            this.#bars[index].style.top = `${top}rem`;
            this.#bars[index].style.height = `${height}rem`;
        });
    }

    // Converts a month on the axis to its distance from the top, in rem. The newest month is at
    // the top.
    #toRem(month) {
        return ((this.#axis.end - month) / 12) * this.#yearHeight;
    }
}

// ========================================================================================== \\
//                                      Helper Functions                                      \\
// ========================================================================================== \\

/**
 * Reads every element marked with data-timeline into a period, earliest start first. An element
 * whose dates are missing or run backwards is left out.
 */
function readPeriods(scope, now) {
    return [...scope.querySelectorAll("[data-timeline]")]
        .map((entry) => readPeriod(entry, now))
        .filter((period) => period !== null)
        .sort((a, b) => a.start.index - b.start.index);
}

function readPeriod(entry, now) {
    const times = entry.querySelectorAll("time[datetime]");
    const start = parseMonth(times[0]?.getAttribute("datetime"), "start");
    if (start === null) {
        return null;
    }

    let end = null;
    if (times.length > 1) {
        end = parseMonth(times[1].getAttribute("datetime"), "end");
        if (end === null || end.index < start.index) {
            return null;
        }
    }

    return {
        entry,
        kind: entry.dataset.timeline === "study" ? "study" : "work",
        title: entry.dataset.timelineTitle ?? readText(entry.querySelector("h3")),
        role: readText(entry.querySelector(".entry-role")),
        start,
        end,
        endPosition: end ? end.index + 1 : now,
    };
}

/**
 * Parses a datetime of the form YYYY or YYYY-MM into a month index, counted as year * 12 plus
 * the month, where January is 0. A bare year resolves to January at the start of a period and to
 * December at its end.
 * <pre>
 * "2025-05", "start"  ->  { index: 24304, hasMonth: true }
 * "2018",    "end"    ->  { index: 24227, hasMonth: false }
 * "May 2025"          ->  null
 * </pre>
 */
function parseMonth(value, edge) {
    const match = /^(\d{4})(?:-(\d{2}))?$/.exec(value ?? "");
    if (match === null) {
        return null;
    }

    const hasMonth = match[2] !== undefined;
    const month = hasMonth ? Number(match[2]) - 1 : (edge === "end" ? 11 : 0);
    if (month < 0 || month > 11) {
        return null;
    }

    return { index: Number(match[1]) * 12 + month, hasMonth };
}

/**
 * Returns today's position on the month scale, with the day as a fraction of its month.
 */
function readMonthPosition(date) {
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return date.getFullYear() * 12 + date.getMonth() + (date.getDate() - 1) / daysInMonth;
}

/**
 * Computes the axis in months, from January of the earliest year to the close of the year that
 * contains today or the latest period end, whichever is later.
 */
function computeAxis(periods, now) {
    const first = Math.min(...periods.map((period) => period.start.index));
    const last = Math.max(now, ...periods.map((period) => period.endPosition));
    const start = Math.floor(first / 12) * 12;
    const end = Math.ceil(last / 12) * 12;
    return { start, end, span: end - start };
}

/**
 * Places each period in a column, taking the first column whose last period has already ended
 * and opening a new column otherwise. Two roles held at the same time end up side by side.
 */
function assignLanes(periods) {
    const laneEnds = [];
    return periods.map((period) => {
        const free = laneEnds.findIndex((laneEnd) => laneEnd <= period.start.index);
        const lane = free === -1 ? laneEnds.length : free;
        laneEnds[lane] = period.endPosition;
        return lane;
    });
}

/**
 * Scrolls a period's full entry into view and highlights it briefly.
 */
function revealEntry(entry) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    entry.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    entry.classList.remove("is-revealed");
    void entry.offsetWidth;
    entry.classList.add("is-revealed");
}

/**
 * Formats a period's dates as a reader would write them.
 * <pre>
 * 2026-06 to 2026-09  ->  "June to September 2026"
 * 1991 to 1991        ->  "1991"
 * 2016 to 2025        ->  "2016 to 2025"
 * </pre>
 */
function formatRange(period) {
    const startText = formatMonth(period.start);
    if (period.end === null) {
        return `${startText} to present`;
    }

    const startYear = Math.floor(period.start.index / 12);
    const endYear = Math.floor(period.end.index / 12);
    if (startYear === endYear) {
        if (!period.start.hasMonth && !period.end.hasMonth) {
            return String(startYear);
        }
        if (period.start.hasMonth && period.end.hasMonth) {
            return `${MONTHS[period.start.index % 12]} to ${formatMonth(period.end)}`;
        }
    }

    return `${startText} to ${formatMonth(period.end)}`;
}

function formatMonth({ index, hasMonth }) {
    const year = Math.floor(index / 12);
    return hasMonth ? `${MONTHS[index % 12]} ${year}` : String(year);
}

/**
 * Formats how long a period lasted, counting its first and last months in full.
 * <pre>
 * June to September 2026  ->  "4 months"
 * 2016 to 2025            ->  "10 years"
 * </pre>
 */
function formatLength(period, currentMonth) {
    const lastMonth = period.end ? period.end.index : currentMonth;
    const months = Math.max(1, lastMonth - period.start.index + 1);
    const years = Math.floor(months / 12);
    const remainder = months % 12;

    const parts = [];
    if (years > 0) {
        parts.push(`${years} ${years === 1 ? "year" : "years"}`);
    }
    if (remainder > 0) {
        parts.push(`${remainder} ${remainder === 1 ? "month" : "months"}`);
    }
    return parts.join(" and ");
}

function describePeriod(period, currentMonth) {
    return [period.title, period.role, formatRange(period), formatLength(period, currentMonth)]
        .filter((part) => part !== "")
        .join(", ");
}

function readText(element) {
    return element ? element.textContent.replace(/\s+/g, " ").trim() : "";
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}

if (!customElements.get("career-timeline")) {
    customElements.define("career-timeline", CareerTimeline);
}
