// configuration
const CONFIG = {
  apiUrl: "__BOT_API_URL__",
  containerSelector: "main" // mdbook usually renders content inside a <main> tag
};

// API functions
async function sendCommentToApi(text, pageUrl) {
  const response = await fetch(CONFIG.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, pageUrl }),
  });

  if (!response.ok) throw new Error("Failed to send comment");
  return await response.json();
}

// DOM creation functions
function createContainer() {
  const container = document.createElement("div");
  container.className = "custom-comment-box";
  return container;
}

function createHeading() {
  const heading = document.createElement("h3");
  heading.innerText = "Leave Private Anonymous Feedback";
  return heading;
}

function createTextArea() {
  const textArea = document.createElement("textarea");
  textArea.placeholder = "Spotted an error? Have a suggestion? Let me know...";
  textArea.rows = 4;
  return textArea;
}

function createSubmitButton() {
  const button = document.createElement("button");
  button.innerText = "Send Feedback";
  button.type = "button";
  return button;
}

function createStatusMessage() {
  const statusMsg = document.createElement("span");
  statusMsg.className = "comment-status";
  return statusMsg;
}

// UI update functions 
function setUiLoading(button, textArea) {
  button.disabled = true;
  textArea.disabled = true;
  button.innerText = "Sending...";
}

function setUiSuccess(button, textArea, statusMsg) {
  textArea.value = "";
  textArea.disabled = false;
  button.innerText = "Send Feedback";
  button.disabled = false;
  
  statusMsg.innerText = "Feedback sent successfully!";
  statusMsg.style.color = "green";
  setTimeout(() => (statusMsg.innerText = ""), 3000);
}

function setUiError(button, textArea, statusMsg) {
  textArea.disabled = false;
  button.innerText = "Send Feedback";
  button.disabled = false;

  statusMsg.innerText = "Failed to send feedback. Please try again.";
  statusMsg.style.color = "red";
}

// event handlers
async function handleCommentSubmit(textArea, button, statusMsg) {
  const text = textArea.value.trim();
  if (!text) return;

  setUiLoading(button, textArea);

  try {
    await sendCommentToApi(text, window.location.href);
    setUiSuccess(button, textArea, statusMsg);
  } catch (error) {
    console.error(error);
    setUiError(button, textArea, statusMsg);
  }
}

// mounting functions
function buildCommentUI() {
  const container = createContainer();
  const heading = createHeading();
  const textArea = createTextArea();
  const button = createSubmitButton();
  const statusMsg = createStatusMessage();

  button.addEventListener("click", () => handleCommentSubmit(textArea, button, statusMsg));

  container.appendChild(heading);
  container.appendChild(textArea);
  container.appendChild(button);
  container.appendChild(statusMsg);

  return container;
}

function injectCommentBox() {
  const mainContent = document.querySelector(CONFIG.containerSelector);
  
  if (mainContent) {
    const commentUI = buildCommentUI();
    mainContent.appendChild(commentUI);
  }
}

function init() {
  injectCommentBox();
}

// Wait for mdbook to finish loading the DOM
document.addEventListener("DOMContentLoaded", init);
