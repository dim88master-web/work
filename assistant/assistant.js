
// =====================================
// MAILGPT - ПОЧТОВЫЙ ИНТЕРФЕЙС
// =====================================

// Элементы интерфейса
const accountsElement = document.getElementById("accounts");
const messageListElement = document.getElementById("messageList");
const folderTitleElement = document.getElementById("folderTitle");
const statusElement = document.getElementById("status");
const searchElement = document.getElementById("search");
const loadMoreButton = document.getElementById("loadMore");

const previewFrom = document.getElementById("previewFrom");
const previewSubject = document.getElementById("previewSubject");
const previewDate = document.getElementById("previewDate");
const messageBody = document.getElementById("messageBody");

// Состояние приложения
let currentFolder = null;
let currentPageId = null;
let currentMessageId = null;
let currentMessage = null;
let currentMessageBody = null;

let loadedMessages = [];
let selectedFolderButton = null;


// =====================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =====================================

function setStatus(text) {
    statusElement.textContent = text;
}

function createElement(tag, className, text = "") {
    const element = document.createElement(tag);

    element.className = className;
    element.textContent = text;

    return element;
}

function formatDate(date) {
    if (!date) {
        return "";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return "";
    }

    return parsedDate.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}


// =====================================
// ПОЛУЧЕНИЕ ПОЧТОВЫХ АККАУНТОВ
// =====================================

async function loadAccounts() {
    try {
        setStatus("Загружаю почтовые аккаунты...");

        accountsElement.replaceChildren();

        // Получаем аккаунты со всеми вложенными папками
        const accounts = await messenger.accounts.list(true);

        if (!accounts.length) {
            accountsElement.textContent =
                "Почтовые аккаунты не найдены";

            setStatus("Аккаунты не найдены");

            return;
        }

        for (const account of accounts) {
            renderAccount(account);
        }

        setStatus(`Подключено аккаунтов: ${accounts.length}`);

    } catch (error) {
        console.error("MailGPT accounts:", error);

        accountsElement.textContent =
            "Не удалось загрузить аккаунты";

        setStatus("Ошибка загрузки аккаунтов: " + error.message);
    }
}


// =====================================
// ОТОБРАЖЕНИЕ АККАУНТОВ
// =====================================

function renderAccount(account) {
    const accountContainer = document.createElement("div");

    const accountTitle = createElement(
        "div",
        "account-name",
        account.name || account.type || "Почтовый аккаунт"
    );

    accountContainer.append(accountTitle);

    // Получаем корневые папки аккаунта
    const folders =
        account.rootFolder?.subFolders ||
        account.folders ||
        [];

    if (!folders.length && account.rootFolder) {
        renderFolder(account.rootFolder, accountContainer, 0);
    } else {
        folders.forEach(folder => {
            renderFolder(folder, accountContainer, 0);
        });
    }

    accountsElement.append(accountContainer);
}


// =====================================
// ОТОБРАЖЕНИЕ ДЕРЕВА ПАПОК
// =====================================

function renderFolder(folder, container, depth) {
    const folderContainer = document.createElement("div");

    const folderButton = createElement(
        "button",
        "folder-button"
    );

    folderButton.type = "button";

    // Название папки
    const name = document.createElement("span");

    name.textContent = folder.name || folder.path || "Папка";

    // Количество непрочитанных писем
    const count = document.createElement("span");

    count.className = "folder-count";

    if (folder.unreadMessageCount > 0) {
        count.textContent = folder.unreadMessageCount;
    }

    folderButton.append(name, count);

    folderButton.style.paddingLeft =
        `${8 + depth * 14}px`;

    folderButton.title = folder.path || "";

    // Выбираем папку
    folderButton.addEventListener("click", () => {
        if (selectedFolderButton) {
            selectedFolderButton.classList.remove("active");
        }

        folderButton.classList.add("active");

        selectedFolderButton = folderButton;

        loadFolder(folder);
    });

    folderContainer.append(folderButton);

    // Рекурсивно добавляем вложенные папки
    if (folder.subFolders?.length) {
        folder.subFolders.forEach(subFolder => {
            renderFolder(
                subFolder,
                folderContainer,
                depth + 1
            );
        });
    }

    container.append(folderContainer);
}


// =====================================
// ЗАГРУЗКА ПИСЕМ
// =====================================

async function loadFolder(folder) {
    try {
        currentFolder = folder;
        currentPageId = null;
        currentMessageId = null;
        currentMessage = null;
        currentMessageBody = null;

        loadedMessages = [];

        searchElement.value = "";

        folderTitleElement.textContent =
            folder.name || "Письма";

        messageListElement.replaceChildren();

        loadMoreButton.hidden = true;

        previewFrom.textContent = "Загрузка письма...";
        previewSubject.textContent = "";
        previewDate.textContent = "";

        messageBody.textContent =
            "Выбери письмо из списка.";

        setStatus("Загружаю письма...");

        // Получаем первую страницу писем папки
        const page = await messenger.messages.list(folder.id);

        loadedMessages = page.messages || [];

        currentPageId = page.id;

        renderMessages();

        loadMoreButton.hidden = !currentPageId;

        setStatus(
            `Загружено писем: ${loadedMessages.length}`
        );

        if (!loadedMessages.length) {
            messageListElement.textContent =
                "В этой папке нет писем";
        }

    } catch (error) {
        console.error("MailGPT messages:", error);

        messageListElement.textContent =
            "Не удалось загрузить письма";

        setStatus("Ошибка загрузки писем: " + error.message);
    }
}


// =====================================
// ОТОБРАЖЕНИЕ СПИСКА ПИСЕМ
// =====================================

function renderMessages() {
    const search = searchElement.value
        .trim()
        .toLowerCase();

    const filteredMessages = loadedMessages.filter(message => {
        const text = [
            message.author,
            message.subject
        ]
            .join(" ")
            .toLowerCase();

        return text.includes(search);
    });

    messageListElement.replaceChildren();

    if (!filteredMessages.length) {
        messageListElement.textContent =
            "Письма не найдены";

        return;
    }

    for (const message of filteredMessages) {
        const button = createElement(
            "button",
            "message-item"
        );

        button.type = "button";

        if (!message.read) {
            button.classList.add("unread");
        }

        if (message.id === currentMessageId) {
            button.classList.add("active");
        }

        const author = createElement(
            "div",
            "message-author",
            message.author || "Неизвестный отправитель"
        );

        const subject = createElement(
            "div",
            "message-subject",
            message.subject || "(Без темы)"
        );

        const date = createElement(
            "div",
            "message-date",
            formatDate(message.date)
        );

        button.append(author, subject, date);

        button.addEventListener("click", () => {
            loadMessage(message);
        });

        messageListElement.append(button);
    }
}


// =====================================
// ПОЛУЧЕНИЕ ТЕКСТА ПИСЬМА
// =====================================

function htmlToText(html) {
    const documentHTML = new DOMParser().parseFromString(
        html,
        "text/html"
    );

    documentHTML
        .querySelectorAll("script, style")
        .forEach(element => element.remove());

    return (
        documentHTML.body?.innerText ||
        documentHTML.body?.textContent ||
        ""
    )
        .replace(/\u00a0/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

async function getMessageBody(messageId) {
    const parts = await messenger.messages.listInlineTextParts(
        messageId
    );

    // В первую очередь используем обычный текст
    const plainParts = parts.filter(part =>
        part.contentType
            .toLowerCase()
            .startsWith("text/plain")
    );

    if (plainParts.length) {
        return plainParts
            .map(part => part.content.trim())
            .filter(Boolean)
            .join("\n\n");
    }

    // Если обычного текста нет, используем HTML
    const htmlParts = parts.filter(part =>
        part.contentType
            .toLowerCase()
            .startsWith("text/html")
    );

    if (htmlParts.length) {
        return htmlParts
            .map(part => htmlToText(part.content))
            .filter(Boolean)
            .join("\n\n");
    }

    return "Текстовое содержимое письма отсутствует.";
}


// =====================================
// ОТКРЫТИЕ ВЫБРАННОГО ПИСЬМА
// =====================================

async function loadMessage(message) {
    try {
        currentMessageId = message.id;
        currentMessage = message;
        currentMessageBody = null;

        // Обновляем выделение в списке
        renderMessages();

        // Показываем информацию о письме
        previewFrom.textContent =
            message.author || "Неизвестный отправитель";

        previewSubject.textContent =
            message.subject || "(Без темы)";

        previewDate.textContent =
            formatDate(message.date);

        messageBody.textContent =
            "Загружаю содержимое письма...";

        setStatus("Читаю письмо...");

        // Получаем текст письма
        const body = await getMessageBody(message.id);

        if (currentMessageId !== message.id) {
            return;
        }

        currentMessageBody = body;
        messageBody.textContent = body;

        setStatus("Письмо загружено");

    } catch (error) {
        console.error("MailGPT message body:", error);

        messageBody.textContent =
            "Ошибка чтения письма: " + error.message;

        setStatus("Ошибка чтения письма");
    }
}


// =====================================
// ЗАГРУЗКА СЛЕДУЮЩЕЙ СТРАНИЦЫ
// =====================================

async function loadMoreMessages() {
    if (!currentPageId) {
        return;
    }

    try {
        loadMoreButton.disabled = true;

        setStatus("Загружаю следующие письма...");

        const page = await messenger.messages.continueList(
            currentPageId
        );

        loadedMessages.push(...page.messages);

        currentPageId = page.id;

        renderMessages();

        loadMoreButton.hidden = !currentPageId;

        setStatus(
            `Загружено писем: ${loadedMessages.length}`
        );

    } catch (error) {
        console.error("MailGPT pagination:", error);

        setStatus("Ошибка загрузки: " + error.message);

    } finally {
        loadMoreButton.disabled = false;
    }
}


// =====================================
// СОБЫТИЯ И ЗАПУСК
// =====================================

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

// Добавление сообщения
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

// Отправка сообщения

async function sendChatMessage(customPrompt = null, displayText = null) {
    const input = (customPrompt ?? promptInput.value).trim();

    if (!input || sendButton.disabled) {
        return;
    }

    // Проверяем, загрузилось ли выбранное письмо
    if (currentMessage && currentMessageBody === null) {
        addChatMessage(
            "Подожди, письмо ещё загружается.",
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

    // Формируем запрос с контекстом письма
    let requestInput = input;

    if (currentMessage) {
        requestInput = `
    Контекст выбранного письма:

    Тема: ${currentMessage.subject || "(Без темы)"}

    Отправитель: ${currentMessage.author || "Неизвестен"}

    Текст письма:
    ---
    ${currentMessageBody || "Текст отсутствует"}
    ---

    Вопрос пользователя:
    ${input}
    `;
        }

        try {
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
    if (!currentMessage) {
        addChatMessage("Сначала выбери письмо.", "assistant");
        return;
    }

    sendChatMessage(
        "Сделай краткий пересказ этого письма на русском языке. Выдели главную мысль, важные факты, даты и необходимые действия. Не добавляй информацию, которой нет в письме.",
        "Пересказ письма"
    );
});

// Кнопка «Готовый ответ»
replyButton.addEventListener("click", () => {
    if (!currentMessage) {
        addChatMessage("Сначала выбери письмо.", "assistant");
        return;
    }

    sendChatMessage(
        "Составь готовый ответ на это письмо. Используй язык оригинального письма, вежливый и естественный деловой стиль. Учитывай контекст и отвечай непосредственно на вопросы отправителя. Не выдумывай факты и обещания. Верни только готовый текст ответа без пояснений.",
        "Подготовить готовый ответ"
    );
});


// Кнопка отправки
sendButton.addEventListener("click", sendChatMessage);

// Ctrl + Enter для отправки
promptInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
});

// Поиск среди уже загруженных писем
searchElement.addEventListener("input", renderMessages);

// Загрузка следующей страницы
loadMoreButton.addEventListener(
    "click",
    loadMoreMessages
);

// Запуск приложения
document.addEventListener("DOMContentLoaded", loadAccounts);

