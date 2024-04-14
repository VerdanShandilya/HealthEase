document.addEventListener("DOMContentLoaded", () => {
  const messagesContainer = document.getElementById("messages");
  const userInput = document.getElementById("input_symp");
  const addMessage = (text, sender) => {
    const messageElem = document.createElement("div");
    messageElem.classList.add("message");
    messageElem.classList.add(sender);
    messageElem.textContent = text;
    messagesContainer.appendChild(messageElem);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };
  const fetchMessageFromChatGpt = async (message) => {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      addMessage(data.reply, "server");
    } catch (error) {
      console.error("Error:", error.message);
      addMessage("Something went wrong", "server");
    }
  };
  userInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      const message = userInput.value.trim();
      if (message !== "") {
        addMessage(message, "user");
        userInput.value = "";
        fetchMessageFromChatGpt(message);
      }
    }
  });
});
