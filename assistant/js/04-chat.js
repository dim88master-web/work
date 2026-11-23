// =====================================
// MAILGPT CHAT
// =====================================

const promptInput = document.getElementById("prompt");
const sendButton = document.getElementById("send");
const summaryButton = document.getElementById("summary");
const replyButton = document.getElementById("draftReply");
const chatLog = document.getElementById("chat");

chatLog.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding: 16px;
`;

promptInput.parentElement.parentElement.insertBefore(
    chatLog,
    promptInput.parentElement
);

// Добавление сообщения в историю чата
function addChatMessage(text, role) {
    chatLog.querySelector(".welcome")?.remove();

    const message = document.createElement("div");
    message.textContent = text;

    message.style.cssText = `
        padding: 10px;
        border-radius: 8px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        background: ${role === "user" ? "#dceeff" : "#eeeeee"};
        color: #222;
        align-self: ${role === "user" ? "flex-end" : "flex-start"};
        max-width: 85%;
    `;

    chatLog.appendChild(message);
    chatLog.scrollTop = chatLog.scrollHeight;
}

// Возвращает отмеченные письма.
// Если флажки не отмечены, используется письмо, открытое в предпросмотре.
function getMessagesForChat() {
    if (selectedMessageIds.size > 0) {
        return loadedMessages.filter(message =>
            selectedMessageIds.has(message.id)
        );
    }

    return currentMessage ? [currentMessage] : [];
}

// Отправка сообщения вместе с контекстом одного или нескольких писем.
async function sendChatMessage(customPrompt = null, displayText = null) {
    const input = (customPrompt ?? promptInput.value).trim();

    if (!input || sendButton.disabled) {
        return;
    }

    const contextMessages = getMessagesForChat();

    // Если письмо выбрано в предпросмотре, но ещё не загрузилось, ждём.
    if (
        selectedMessageIds.size === 0 &&
        currentMessage &&
        currentMessageBody === null
    ) {
        addChatMessage(
            "Подожди, письмо ещё загружается.",
            "assistant"
        );
        return;
    }

    if (selectedMessageIds.size > 0 && contextMessages.length === 0) {
        addChatMessage(
            "Не удалось найти выбранные письма. Обнови список и выбери их снова.",
            "assistant"
        );
        return;
    }

    addChatMessage(displayText ?? input, "user");

    promptInput.value = "";
    sendButton.disabled = true;
    summaryButton.disabled = true;
    replyButton.disabled = true;
    sendButton.textContent = "Отправка...";

    try {
        let requestInput = input;

        if (contextMessages.length > 0) {
            const emailContexts = [];

            for (let index = 0; index < contextMessages.length; index++) {
                const message = contextMessages[index];
                let body;

                if (
                    message.id === currentMessageId &&
                    currentMessageBody !== null
                ) {
                    body = currentMessageBody;
                } else {
                    body = await getMessageText(message.id);
                }

                emailContexts.push(`
Письмо ${index + 1} из ${contextMessages.length}
Тема: ${message.subject || "(Без темы)"}
Отправитель: ${message.author || "Неизвестен"}
Дата: ${formatDate(message.date) || "Не указана"}
Содержание:
---
${body || "Текст отсутствует"}
---
`);
            }

            requestInput = `
Контекст выбранных писем.
Всего писем: ${contextMessages.length}

${emailContexts.join("\n")}
Вопрос пользователя:
${input}
`;
        }

        const response = await messenger.runtime.sendMessage({
            type: "MAILGPT_CHAT",
            input: requestInput
        });

        if (!response?.ok) {
            throw new Error(response?.error || "Неизвестная ошибка");
        }

        addChatMessage(response.text, "assistant");

    } catch (error) {
        addChatMessage(
            "Ошибка: " + error.message,
            "assistant"
        );

    } finally {
        sendButton.disabled = false;
        summaryButton.disabled = false;
        replyButton.disabled = false;
        sendButton.textContent = "Отправить";
        promptInput.focus();
    }
}

// Кнопка «Пересказ»
summaryButton.addEventListener("click", () => {
    const messages = getMessagesForChat();

    if (!messages.length) {
        addChatMessage("Сначала выбери письмо или отметь несколько флажками.", "assistant");
        return;
    }

    const prompt = messages.length === 1
        ? "Сделай краткий пересказ этого письма на русском языке. Выдели главную мысль, важные факты, даты и необходимые действия. Не добавляй информацию, которой нет в письме."
        : "Сделай отдельный краткий пересказ каждого выбранного письма на русском языке. Для каждого выдели главную мысль, важные факты, даты и необходимые действия. В конце кратко перечисли общие темы или связи между письмами, если они есть. Не добавляй информацию, которой нет в письмах.";

    sendChatMessage(
        prompt,
        messages.length === 1
            ? "Пересказ письма"
            : `Пересказ выбранных писем (${messages.length})`
    );
});

// Кнопка «Готовый ответ»
replyButton.addEventListener("click", () => {
    const messages = getMessagesForChat();

    if (!messages.length) {
        addChatMessage("Сначала выбери письмо или отметь несколько флажками.", "assistant");
        return;
    }

    const prompt = messages.length === 1
        ? "Составь готовый ответ на это письмо. Используй язык оригинального письма, вежливый и естественный деловой стиль. Учитывай контекст и отвечай непосредственно на вопросы отправителя. Не выдумывай факты и обещания. Верни только готовый текст ответа без пояснений."
        : "Составь отдельный готовый ответ на каждое выбранное письмо. Перед каждым ответом укажи тему исходного письма, чтобы ответы не перепутались. Используй язык соответствующего письма, вежливый и естественный деловой стиль. Не объединяй разные письма в один ответ, не выдумывай факты и обещания. Верни только готовые тексты ответов без дополнительных пояснений.";

    sendChatMessage(
        prompt,
        messages.length === 1
            ? "Подготовить готовый ответ"
            : `Подготовить ответы на письма (${messages.length})`
    );
});

// Кнопка отправки
sendButton.addEventListener("click", () => sendChatMessage());

// Enter отправляет сообщение, Shift + Enter переносит строку.
promptInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
});
