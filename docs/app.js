"use strict";

const ROUND_SIZE = 5;
const MIN_GAP_MS = 14 * 24 * 60 * 60 * 1000;
const RECENT_LIMIT = 150; // don't repeat posts seen in the last N cards
const TITLE = "When Did Trump Say It: Iran Edition";

const posts = window.POSTS.map((p) => ({ ...p, time: Date.parse(p.d) }));
const $ = (id) => document.getElementById(id);
const cardsEl = $("cards");
const template = $("card-template");

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York",
});

let round = [];   // posts in the current round, in dealt order
let done = false;
let lastSquares = "";
let lastScore = "";
const recent = [];
const tally = { rounds: 0, pairs: 0 };

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pick ROUND_SIZE posts, each at least MIN_GAP_MS from every other.
function deal() {
  const fresh = posts.filter((p) => !recent.includes(p.u));
  for (const pool of [fresh, posts]) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const picked = [];
      for (const p of shuffle([...pool])) {
        if (picked.every((q) => Math.abs(q.time - p.time) >= MIN_GAP_MS)) picked.push(p);
        if (picked.length === ROUND_SIZE) return picked;
      }
    }
  }
  throw new Error("Not enough posts to deal a round");
}

function cardEls() {
  return [...cardsEl.children];
}

function updateMoveButtons() {
  const els = cardEls();
  els.forEach((el, i) => {
    el.querySelector(".up").disabled = i === 0;
    el.querySelector(".down").disabled = i === els.length - 1;
  });
}

function move(el, dir) {
  const sibling = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
  if (!sibling) return;
  if (dir < 0) cardsEl.insertBefore(el, sibling);
  else cardsEl.insertBefore(sibling, el);
  updateMoveButtons();
  el.querySelector(dir < 0 ? ".up" : ".down").focus();
  $("live").textContent = `Moved to position ${cardEls().indexOf(el) + 1} of ${ROUND_SIZE}`;
}

function renderCard(post) {
  const el = template.content.firstElementChild.cloneNode(true);
  el.post = post;
  const text = el.querySelector(".text");
  text.textContent = post.t;
  el.querySelector(".up").addEventListener("click", () => move(el, -1));
  el.querySelector(".down").addEventListener("click", () => move(el, 1));
  const more = el.querySelector(".more");
  more.addEventListener("click", () => {
    const expanded = text.classList.toggle("expanded");
    more.textContent = expanded ? "Show less" : "Show more";
  });
  return el;
}

function newRound() {
  round = deal();
  for (const p of round) {
    recent.push(p.u);
    if (recent.length > RECENT_LIMIT) recent.shift();
  }
  done = false;
  cardsEl.classList.remove("done");
  document.body.classList.remove("revealed");
  cardsEl.replaceChildren(...round.map(renderCard));
  // Only offer "Show more" on posts that are actually clipped.
  for (const el of cardEls()) {
    const text = el.querySelector(".text");
    el.querySelector(".more").hidden = text.scrollHeight <= text.clientHeight + 1;
  }
  updateMoveButtons();
  $("result").hidden = true;
  $("instructions").hidden = false;
  $("submit").hidden = false;
  for (const id of ["show-correct", "copy", "next"]) $(id).hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function submit() {
  done = true;
  cardsEl.classList.add("done");
  document.body.classList.add("revealed");
  const order = cardEls().map((el) => el.post);
  const correct = [...order].sort((a, b) => a.time - b.time);

  let pairs = 0;
  for (let i = 0; i < order.length; i++)
    for (let j = i + 1; j < order.length; j++)
      if (order[i].time < order[j].time) pairs++;
  const totalPairs = (ROUND_SIZE * (ROUND_SIZE - 1)) / 2;

  let rightSpots = 0;
  const squares = [];
  cardEls().forEach((el, i) => {
    const actual = correct.indexOf(el.post);
    const right = actual === i;
    el.userPos = i;
    if (right) rightSpots++;
    squares.push(right ? "🟩" : "🟥");
    el.classList.add(right ? "right" : "wrong");
    el.style.setProperty("--i", i);
    el.querySelector(".badge").textContent = right ? "✓" : actual + 1;
    el.querySelector(".label").textContent = right ? "Nailed it" : `Belongs #${actual + 1}`;
    const date = el.querySelector(".date");
    date.textContent = dateFmt.format(el.post.time);
    date.href = el.post.u;
    date.title = "Open the original post";
  });

  tally.rounds++;
  tally.pairs += pairs;
  lastSquares = squares.join("");
  lastScore = `${pairs}/${totalPairs}`;

  countUp($("score"), pairs, totalPairs);
  if (pairs === totalPairs) setTimeout(confetti, 900);
  $("score-detail").textContent =
    `${pairs} of ${totalPairs} pairs in the right order · ${rightSpots} of ${ROUND_SIZE} in the exact spot`;
  $("squares").textContent = lastSquares;
  $("tally").textContent = tally.rounds > 1
    ? `${tally.rounds} rounds played · ${tally.pairs}/${tally.rounds * totalPairs} pairs overall`
    : "";
  $("tally").hidden = tally.rounds < 2;

  $("result").hidden = false;
  $("instructions").hidden = true;
  $("submit").hidden = true;
  for (const id of ["show-correct", "copy", "next"]) $(id).hidden = false;
  $("show-correct").disabled = rightSpots === ROUND_SIZE;
  $("live").textContent = `${pairs} of ${totalPairs} pairs correct.`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function countUp(el, value, total) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let n = reduced ? value : 0;
  const show = () => (el.textContent = n === total ? "You did it! Yay?" : `${n}/${total}`);
  show();
  const timer = setInterval(() => {
    if (n >= value) return clearInterval(timer);
    n++;
    show();
  }, 70);
}

function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#d1342b", "#1d7f47", "#f2b705", "#2f6fdf", "#ff8a3d"];
  for (let i = 0; i < 90; i++) {
    const c = document.createElement("span");
    c.className = "confetti";
    c.style.left = `${Math.random() * 100}vw`;
    c.style.background = colors[i % colors.length];
    c.style.setProperty("--dx", `${(Math.random() - 0.5) * 240}px`);
    c.style.setProperty("--rot", `${(Math.random() - 0.5) * 1440}deg`);
    c.style.setProperty("--dur", `${1.6 + Math.random() * 1.6}s`);
    c.style.animationDelay = `${Math.random() * 0.4}s`;
    document.body.append(c);
    c.addEventListener("animationend", () => c.remove());
  }
}

// Re-sort into the correct order, animating each row from its old spot (FLIP).
function showCorrect() {
  const before = new Map(cardEls().map((el) => [el, el.getBoundingClientRect().top]));
  const sorted = cardEls().sort((a, b) => a.post.time - b.post.time);
  cardsEl.replaceChildren(...sorted);
  for (const el of sorted) {
    if (el.classList.contains("wrong")) el.querySelector(".label").textContent = `You had #${el.userPos + 1}`;
    const dy = before.get(el) - el.getBoundingClientRect().top;
    if (dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }],
      { duration: 600, easing: "cubic-bezier(0.3, 1.2, 0.5, 1)" });
  }
  $("show-correct").disabled = true;
}

async function copyResult() {
  const url = location.protocol.startsWith("http") ? `\n${location.href.split("#")[0]}` : "";
  const text = `${TITLE}\n${lastSquares} ${lastScore}${url}`;
  try {
    await navigator.clipboard.writeText(text);
    $("copy").textContent = "Copied!";
  } catch {
    $("copy").textContent = "Couldn't copy";
  }
  setTimeout(() => ($("copy").textContent = "Copy result"), 1500);
}

$("submit").addEventListener("click", submit);
$("next").addEventListener("click", newRound);
$("show-correct").addEventListener("click", showCorrect);
$("copy").addEventListener("click", copyResult);

// Drag and drop is an enhancement; the arrow buttons work without it.
if (window.Sortable) {
  Sortable.create(cardsEl, {
    handle: ".handle",
    animation: 150,
    onMove: () => !done,
    onEnd: updateMoveButtons,
  });
}

newRound();
