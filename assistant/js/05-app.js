// Поиск среди уже загруженных писем
searchElement.addEventListener("input", renderMessages);

// Выбор всех писем, отображаемых сейчас с учётом поиска
selectAllMessagesButton.addEventListener(
    "click",
    toggleSelectVisibleMessages
);

// Снятие всех выбранных флажков
clearSelectedMessagesButton.addEventListener(
    "click",
    clearSelectedMessages
);

// Загрузка следующей страницы
loadMoreButton.addEventListener(
    "click",
    loadMoreMessages
);

// Запуск приложения
document.addEventListener("DOMContentLoaded", loadAccounts);
