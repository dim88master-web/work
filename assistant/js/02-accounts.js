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
