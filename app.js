"use strict";

const DIFFICULTIES = {
  easy: { label: "Easy", minimum: 100, maximum: 999 },
  medium: { label: "Medium", minimum: 1000, maximum: 9999 },
  hard: { label: "Hard", minimum: 100000, maximum: 9999999 },
};

const MIN_NUMBERS = 8;
const MAX_NUMBERS = 10;

const screens = {
  welcome: document.querySelector("#welcome-screen"),
  game: document.querySelector("#game-screen"),
  results: document.querySelector("#results-screen"),
};
const elements = {
  start: document.querySelector("#start-button"),
  form: document.querySelector("#answer-form"),
  answer: document.querySelector("#answer-input"),
  submit: document.querySelector("#submit-button"),
  feedback: document.querySelector("#answer-feedback"),
  addends: document.querySelector("#addends"),
  questionCount: document.querySelector("#question-count"),
  roundLabel: document.querySelector("#round-label"),
  difficultyPill: document.querySelector("#difficulty-pill"),
  timer: document.querySelector("#timer-value"),
  timerCard: document.querySelector("#timer-card"),
  timerBar: document.querySelector("#timer-bar"),
  score: document.querySelector("#score-value"),
  streak: document.querySelector("#streak-value"),
  completed: document.querySelector("#progress-completed"),
  quit: document.querySelector("#quit-button"),
  resultsTitle: document.querySelector("#results-title"),
  resultsKicker: document.querySelector("#results-kicker"),
  resultsSubtitle: document.querySelector("#results-subtitle"),
  finalScore: document.querySelector("#final-score"),
  correct: document.querySelector("#result-correct"),
  incorrect: document.querySelector("#result-incorrect"),
  accuracy: document.querySelector("#result-accuracy"),
  longestStreak: document.querySelector("#result-streak"),
  reviewCount: document.querySelector("#review-count"),
  reviewList: document.querySelector("#review-list"),
  playAgain: document.querySelector("#play-again-button"),
  changeDifficulty: document.querySelector("#change-difficulty-button"),
};

let round = null;
let intervalId = null;
let feedbackTimeoutId = null;
let inputLocked = false;

function randomInteger(minimum, maximum) {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function selectedOption(name) {
  const selected = document.querySelector(`input[name="${name}"]:checked`);
  if (!selected) {
    throw new Error(`No ${name} option is selected.`);
  }
  return selected.value;
}

function showScreen(name) {
  for (const [screenName, element] of Object.entries(screens)) {
    const visible = screenName === name;
    element.hidden = !visible;
    element.classList.toggle("is-visible", visible);
  }
}

function updateSelectedStyles() {
  document.querySelectorAll(".choice-card, .time-option").forEach((label) => {
    const radio = label.querySelector("input");
    label.classList.toggle("selected", radio.checked);
  });
}

function makeQuestion() {
  const { minimum, maximum } = DIFFICULTIES[round.difficulty];
  const count = randomInteger(MIN_NUMBERS, MAX_NUMBERS);
  const numbers = Array.from({ length: count }, () => randomInteger(minimum, maximum));
  return { numbers, total: numbers.reduce((sum, value) => sum + value, 0) };
}

function renderQuestion() {
  if (!round || round.ended) return;
  round.question = makeQuestion();
  round.questionIndex += 1;
  const rows = round.question.numbers.map((value, index) => {
    const row = document.createElement("div");
    row.className = "addend";
    const operator = document.createElement("span");
    operator.className = "operator";
    operator.setAttribute("aria-hidden", "true");
    operator.textContent = index === 0 ? "" : "+";
    const number = document.createElement("span");
    number.className = "addend-number";
    number.textContent = value.toLocaleString("en-US");
    row.append(operator, number);
    return row;
  });
  elements.addends.replaceChildren(...rows);
  elements.questionCount.textContent = `Question ${round.questionIndex}`;
  elements.answer.value = "";
  elements.answer.disabled = false;
  elements.submit.disabled = false;
  elements.feedback.textContent = "";
  elements.feedback.classList.remove("is-wrong");
  inputLocked = false;
  elements.answer.focus({ preventScroll: true });
}

function beginRound() {
  const difficulty = selectedOption("difficulty");
  const duration = Number(selectedOption("duration"));
  if (!DIFFICULTIES[difficulty] || ![30, 60, 120].includes(duration)) {
    throw new Error("The selected game settings are invalid.");
  }

  clearInterval(intervalId);
  clearTimeout(feedbackTimeoutId);
  round = {
    difficulty,
    duration,
    deadline: performance.now() + duration * 1000,
    questionIndex: 0,
    question: null,
    score: 0,
    correct: 0,
    incorrect: 0,
    streak: 0,
    longestStreak: 0,
    answers: [],
    ended: false,
  };
  inputLocked = false;
  elements.roundLabel.textContent = `${DIFFICULTIES[difficulty].label.toUpperCase()} ROUND`;
  elements.difficultyPill.textContent = DIFFICULTIES[difficulty].label.toUpperCase();
  elements.score.textContent = "0";
  elements.streak.textContent = "0";
  elements.timerCard.classList.remove("is-low");
  elements.timerBar.style.width = "100%";
  elements.completed.textContent = "0";
  showScreen("game");
  renderQuestion();
  intervalId = setInterval(updateTimer, 100);
  updateTimer();
}

function updateTimer() {
  if (!round || round.ended) return;
  const millisecondsLeft = Math.max(0, round.deadline - performance.now());
  const secondsLeft = Math.ceil(millisecondsLeft / 1000);
  elements.timer.innerHTML = `${secondsLeft}<span class="stat-unit">s</span>`;
  elements.timerBar.style.width = `${(millisecondsLeft / (round.duration * 1000)) * 100}%`;
  elements.timerCard.classList.toggle("is-low", secondsLeft <= 10);
  if (millisecondsLeft <= 0) {
    finishRound("time");
  }
}

function handleAnswer(event) {
  event.preventDefault();
  if (!round || round.ended || inputLocked) return;

  updateTimer();
  if (round.ended) return;

  const rawAnswer = elements.answer.value.trim();
  if (!/^\d+$/.test(rawAnswer)) {
    elements.feedback.textContent = rawAnswer ? "Enter a whole number using digits only." : "Type your answer before submitting.";
    elements.feedback.classList.add("is-wrong");
    elements.answer.focus();
    return;
  }

  const submittedAnswer = Number(rawAnswer);
  const expectedAnswer = round.question.total;
  const isCorrect = submittedAnswer === expectedAnswer;
  let points = 0;
  if (isCorrect) {
    round.correct += 1;
    round.streak += 1;
    round.longestStreak = Math.max(round.longestStreak, round.streak);
    points = 10 + (round.streak > 1 ? 5 : 0);
    round.score += points;
    elements.feedback.textContent = round.streak > 1
      ? `Correct! +${points} points — streak bonus!`
      : `Correct! +${points} points`;
    elements.feedback.classList.remove("is-wrong");
  } else {
    round.incorrect += 1;
    round.streak = 0;
    elements.feedback.textContent = `Not quite — the answer is ${expectedAnswer.toLocaleString("en-US")}.`;
    elements.feedback.classList.add("is-wrong");
  }

  round.answers.push({
    numbers: round.question.numbers,
    submittedAnswer,
    expectedAnswer,
    isCorrect,
    points,
  });
  elements.score.textContent = String(round.score);
  elements.streak.textContent = String(round.streak);
  elements.completed.textContent = String(round.answers.length);
  inputLocked = true;
  elements.answer.disabled = true;
  elements.submit.disabled = true;

  feedbackTimeoutId = setTimeout(() => {
    if (!round || round.ended) return;
    renderQuestion();
  }, 650);
}

function finishRound(reason) {
  if (!round || round.ended) return;
  round.ended = true;
  clearInterval(intervalId);
  clearTimeout(feedbackTimeoutId);
  elements.answer.disabled = true;
  elements.submit.disabled = true;

  const answered = round.answers.length;
  const accuracy = answered === 0 ? 0 : Math.round((round.correct / answered) * 100);
  elements.resultsKicker.textContent = reason === "time" ? "TIME'S UP" : "ROUND ENDED";
  elements.resultsTitle.textContent = reason === "time"
    ? (round.correct > 0 ? "Time's up!" : "Round over!")
    : "Round ended";
  elements.resultsSubtitle.textContent = reason === "time"
    ? "Every round makes you a little sharper. Ready for another?"
    : `You answered ${answered} question${answered === 1 ? "" : "s"}.`;
  elements.finalScore.textContent = String(round.score);
  elements.correct.textContent = String(round.correct);
  elements.incorrect.textContent = String(round.incorrect);
  elements.accuracy.textContent = `${accuracy}%`;
  elements.longestStreak.textContent = String(round.longestStreak);
  elements.reviewCount.textContent = `(${answered} answered)`;
  elements.reviewList.replaceChildren();

  for (const answer of round.answers) {
    const item = document.createElement("div");
    item.className = `review-item ${answer.isCorrect ? "correct" : "incorrect"}`;
    const problem = document.createElement("span");
    problem.className = "review-problem";
    problem.textContent = answer.numbers.map((value) => value.toLocaleString("en-US")).join(" + ");
    const result = document.createElement("span");
    result.className = "review-result";
    result.textContent = answer.isCorrect
      ? `+${answer.points}`
      : `→ ${answer.expectedAnswer.toLocaleString("en-US")}`;
    item.append(problem, result);
    elements.reviewList.append(item);
  }
  showScreen("results");
}

document.querySelectorAll('input[name="difficulty"], input[name="duration"]').forEach((radio) => {
  radio.addEventListener("change", updateSelectedStyles);
});
elements.start.addEventListener("click", beginRound);
elements.form.addEventListener("submit", handleAnswer);
elements.quit.addEventListener("click", () => {
  if (!round || round.ended) return;
  finishRound("quit");
});
elements.playAgain.addEventListener("click", beginRound);
elements.changeDifficulty.addEventListener("click", () => {
  clearInterval(intervalId);
  clearTimeout(feedbackTimeoutId);
  if (round) round.ended = true;
  showScreen("welcome");
  elements.start.focus();
});
