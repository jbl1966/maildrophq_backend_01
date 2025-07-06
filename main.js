
const domain = "1secmail.com";
let countdownInterval, pollingInterval, secondsLeft = 600;

function generateRandomName(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function setEmail(name) {
  const email = `${name}@${domain}`;
  document.getElementById("emailInput").value = email;
  startCountdown();
  startInboxPolling(name);
}

function copyEmail() {
  const email = document.getElementById("emailInput").value;
  navigator.clipboard.writeText(email);
  alert("Email copied to clipboard!");
}

function showCustomInput() {
  document.getElementById("customEmailBox").style.display = "block";
}

function useCustomEmail() {
  const customName = document.getElementById("customName").value.trim();
  const errorBox = document.getElementById("emailError");
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(customName)) {
    errorBox.innerText = "Invalid name. Use only a-z, 0-9, and underscores.";
    errorBox.style.display = "block";
    return;
  }
  errorBox.style.display = "none";
  clearInterval(pollingInterval);
  setEmail(customName.toLowerCase());
}

function startCountdown() {
  clearInterval(countdownInterval);
  secondsLeft = 600;
  countdownInterval = setInterval(() => {
    secondsLeft--;
    const min = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
    const sec = (secondsLeft % 60).toString().padStart(2, '0');
    document.getElementById("countdown").textContent = `${min}:${sec}`;
    if (secondsLeft <= 0) {
      clearInterval(countdownInterval);
      clearInterval(pollingInterval);
      document.getElementById("inbox").innerHTML = "This inbox has expired.";
    }
  }, 1000);
}

function startInboxPolling(username) {
  const inboxDiv = document.getElementById("inbox");
  function fetchInbox() {
    fetch(`https://api.1secmail.com/api/v1/?action=getMessages&login=${username}&domain=${domain}`)
      .then(res => res.json())
      .then(data => {
        inboxDiv.innerHTML = data.length === 0 ? "No new messages yet." :
          data.map(msg => `<div><b>${msg.from}</b>: ${msg.subject}</div>`).join('');
      }).catch(() => {
        inboxDiv.innerHTML = "Failed to load inbox.";
      });
  }
  fetchInbox();
  pollingInterval = setInterval(fetchInbox, 5000);
}

// Initial run
const randomName = generateRandomName();
setEmail(randomName);
