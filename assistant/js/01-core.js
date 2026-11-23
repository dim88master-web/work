// Элементы интерфейса
const accountsElement = document.getElementById("accounts");
const messageListElement = document.getElementById("messageList");
const folderTitleElement = document.getElementById("folderTitle");
const statusElement = document.getElementById("status");
const searchElement = document.getElementById("search");
const loadMoreButton = document.getElementById("loadMore");
const selectAllMessagesButton = document.getElementById("selectAllMessages");
const clearSelectedMessagesButton = document.getElementById("clearSelectedMessages");
const selectedCountElement = document.getElementById("selectedCount");

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

// ID писем, выбранных флажками в центральном списке
const selectedMessageIds = new Set();


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
