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
        selectedMessageIds.clear();

        loadedMessages = [];

        searchElement.value = "";

        folderTitleElement.textContent =
            folder.name || "Письма";

        messageListElement.replaceChildren();

        loadMoreButton.hidden = true;

        previewFrom.textContent = "Загрузка письма...";
        previewSubject.textContent = "";
        previewDate.textContent = "";

        renderMessagePreviewText("Выбери письмо из списка.");

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

function getFilteredMessages() {
    const search = searchElement.value
        .trim()
        .toLowerCase();

    return loadedMessages.filter(message => {
        const text = [
            message.author,
            message.subject
        ]
            .join(" ")
            .toLowerCase();

        return text.includes(search);
    });
}

function updateSelectionUI() {
    const visibleMessages = getFilteredMessages();
    const selectedCount = selectedMessageIds.size;
    const allVisibleSelected = visibleMessages.length > 0 &&
        visibleMessages.every(message => selectedMessageIds.has(message.id));

    selectedCountElement.textContent = `Выбрано: ${selectedCount}`;
    selectAllMessagesButton.textContent = allVisibleSelected
        ? "Снять выбор"
        : "Выбрать все";
    selectAllMessagesButton.disabled = visibleMessages.length === 0;
    clearSelectedMessagesButton.hidden = selectedCount === 0;
}

function toggleSelectVisibleMessages() {
    const visibleMessages = getFilteredMessages();

    if (!visibleMessages.length) {
        return;
    }

    const allVisibleSelected = visibleMessages.every(
        message => selectedMessageIds.has(message.id)
    );

    for (const message of visibleMessages) {
        if (allVisibleSelected) {
            selectedMessageIds.delete(message.id);
        } else {
            selectedMessageIds.add(message.id);
        }
    }

    renderMessages();
}

function clearSelectedMessages() {
    selectedMessageIds.clear();
    renderMessages();
}

function renderMessages() {
    const filteredMessages = getFilteredMessages();

    messageListElement.replaceChildren();

    if (!filteredMessages.length) {
        messageListElement.textContent = "Письма не найдены";
        updateSelectionUI();
        return;
    }

    for (const message of filteredMessages) {
        const row = createElement("div", "message-row");

        if (selectedMessageIds.has(message.id)) {
            row.classList.add("selected");
        }

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "message-select-checkbox";
        checkbox.checked = selectedMessageIds.has(message.id);
        checkbox.setAttribute(
            "aria-label",
            `Выбрать письмо: ${message.subject || "Без темы"}`
        );
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                selectedMessageIds.add(message.id);
                row.classList.add("selected");
            } else {
                selectedMessageIds.delete(message.id);
                row.classList.remove("selected");
            }

            updateSelectionUI();
        });

        const button = createElement("button", "message-item");
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
        button.addEventListener("click", () => loadMessage(message));

        row.append(checkbox, button);
        messageListElement.append(row);
    }

    updateSelectionUI();
}


// =====================================
// ПОЛУЧЕНИЕ ТЕКСТА И HTML ПИСЬМА
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

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizeContentId(value) {
    let id = String(value || "").trim();

    if (id.toLowerCase().startsWith("cid:")) {
        id = id.slice(4);
    }

    try {
        id = decodeURIComponent(id);
    } catch (error) {
        // Оставляем исходное значение, если оно содержит некорректное URL-кодирование.
    }

    return id
        .replace(/^<|>$/g, "")
        .replace(/^['"]|['"]$/g, "")
        .trim()
        .toLowerCase();
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.subarray(offset, offset + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}

async function getInlineImageMap(messageId) {
    const imageMap = new Map();
    const attachments = await messenger.messages.listAttachments(messageId);

    for (const attachment of attachments) {
        const contentType = (attachment.contentType || "")
            .split(";")[0]
            .trim()
            .toLowerCase();

        // Берём только встроенные растровые изображения с Content-ID.
        if (
            !attachment.contentId ||
            !contentType.startsWith("image/") ||
            contentType === "image/svg+xml" ||
            (attachment.size && attachment.size > 10 * 1024 * 1024)
        ) {
            continue;
        }

        try {
            const file = await messenger.messages.getAttachmentFile(
                messageId,
                attachment.partName
            );

            const mimeType = (file.type || contentType).toLowerCase();

            if (!mimeType.startsWith("image/") || mimeType === "image/svg+xml") {
                continue;
            }

            const base64 = arrayBufferToBase64(await file.arrayBuffer());
            const dataUrl = `data:${mimeType};base64,${base64}`;

            imageMap.set(
                normalizeContentId(attachment.contentId),
                dataUrl
            );
        } catch (error) {
            console.warn(
                "MailGPT: не удалось загрузить встроенное изображение:",
                attachment.name,
                error
            );
        }
    }

    return imageMap;
}

function sanitizeEmailHtml(html, imageMap) {
    const parsed = new DOMParser().parseFromString(html, "text/html");

    // Удаляем активное содержимое и элементы, способные загружать произвольные ресурсы.
    parsed.querySelectorAll(
        "script, iframe, frame, frameset, object, embed, form, input, button, " +
        "textarea, select, option, link, base, meta, video, audio, source"
    ).forEach(element => element.remove());

    // Сохраняем CSS письма, но запрещаем CSS-импорты и фоновые URL-запросы.
    parsed.querySelectorAll("style").forEach(style => {
        style.textContent = style.textContent
            .replace(/@import\b[^;]*;?/gi, "")
            .replace(/url\s*\([^)]*\)/gi, "none")
            .replace(/expression\s*\([^)]*\)/gi, "none");
    });

    parsed.querySelectorAll("*").forEach(element => {
        for (const attribute of [...element.attributes]) {
            const name = attribute.name.toLowerCase();
            const value = attribute.value.trim();

            if (
                name.startsWith("on") ||
                ["srcdoc", "srcset", "formaction", "action", "poster", "background", "xlink:href"].includes(name)
            ) {
                element.removeAttribute(attribute.name);
                continue;
            }

            if (name === "style") {
                const safeStyle = value
                    .replace(/url\s*\([^)]*\)/gi, "none")
                    .replace(/expression\s*\([^)]*\)/gi, "none")
                    .replace(/-moz-binding\s*:[^;]+;?/gi, "");

                element.setAttribute("style", safeStyle);
                continue;
            }

            if (name === "href") {
                if (!/^(https?:|mailto:|#)/i.test(value)) {
                    element.removeAttribute(attribute.name);
                }
                continue;
            }

            if (name === "src") {
                if (element.tagName.toLowerCase() !== "img") {
                    element.removeAttribute(attribute.name);
                    continue;
                }

                if (/^cid:/i.test(value)) {
                    const dataUrl = imageMap.get(normalizeContentId(value));

                    if (dataUrl) {
                        element.setAttribute("src", dataUrl);
                    } else {
                        element.removeAttribute("src");
                        element.setAttribute("alt", element.getAttribute("alt") || "Встроенное изображение недоступно");
                    }
                } else if (/^https?:\/\//i.test(value)) {
                    // Внешние HTTP(S)-картинки отображаются, но referrer не передаётся.
                    element.setAttribute("referrerpolicy", "no-referrer");
                    element.setAttribute("loading", "lazy");
                } else if (!/^data:image\/(png|jpeg|gif|webp|bmp);/i.test(value)) {
                    element.removeAttribute("src");
                }
            }
        }
    });

    const headStyles = [...parsed.head.querySelectorAll("style")]
        .map(style => style.outerHTML)
        .join("\n");

    return `${headStyles}\n${parsed.body?.innerHTML || ""}`;
}

function renderMessagePreview(html) {
    const securityPolicy =
        "default-src 'none'; img-src data: http: https:; " +
        "style-src 'unsafe-inline'; font-src data:; " +
        "connect-src 'none'; object-src 'none'; frame-src 'none'; " +
        "form-action 'none'; base-uri 'none'";

    messageBody.srcdoc = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${securityPolicy}">
    <meta name="referrer" content="no-referrer">
    <style>
        html, body { margin: 0; padding: 12px; font: 14px/1.5 Arial, sans-serif; color: #222; overflow-wrap: anywhere; }
        img { max-width: 100% !important; height: auto !important; }
        table { max-width: 100%; }
        pre { white-space: pre-wrap; overflow-wrap: anywhere; }
    </style>
</head>
<body>${html}</body>
</html>`;
}

function renderMessagePreviewText(text) {
    renderMessagePreview(`<pre>${escapeHtml(text)}</pre>`);
}

async function getMessageContent(messageId) {
    const parts = await messenger.messages.listInlineTextParts(messageId);

    const plainParts = parts.filter(part =>
        part.contentType
            .toLowerCase()
            .startsWith("text/plain")
    );

    const htmlPart = parts.find(part =>
        part.contentType
            .toLowerCase()
            .startsWith("text/html")
    );

    const plainText = plainParts
        .map(part => part.content.trim())
        .filter(Boolean)
        .join("\n\n");

    const htmlSource = htmlPart?.content || null;
    const text = plainText || (htmlSource ? htmlToText(htmlSource) : "");

    if (!htmlSource && !text) {
        const fallback = "Текстовое содержимое письма отсутствует.";
        return {
            text: fallback,
            html: `<p>${escapeHtml(fallback)}</p>`
        };
    }

    // Для письма только в plain text создаём безопасное HTML-представление.
    if (!htmlSource) {
        return {
            text,
            html: `<pre>${escapeHtml(text)}</pre>`
        };
    }

    const imageMap = await getInlineImageMap(messageId);

    return {
        text: text || htmlToText(htmlSource),
        html: sanitizeEmailHtml(htmlSource, imageMap)
    };
}


// Получаем только текст письма для отправки ИИ.
// Встроенные изображения не скачиваем, так как они не нужны для текстового анализа.
async function getMessageText(messageId) {
    const parts = await messenger.messages.listInlineTextParts(messageId);

    const plainParts = parts.filter(part =>
        (part.contentType || "")
            .toLowerCase()
            .startsWith("text/plain")
    );

    if (plainParts.length) {
        return plainParts
            .map(part => part.content.trim())
            .filter(Boolean)
            .join("\n\n");
    }

    const htmlParts = parts.filter(part =>
        (part.contentType || "")
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

        renderMessagePreviewText("Загружаю содержимое письма...");

        setStatus("Читаю письмо...");

        // Получаем отдельно текст для GPT и HTML для предпросмотра.
        const content = await getMessageContent(message.id);

        if (currentMessageId !== message.id) {
            return;
        }

        currentMessageBody = content.text;
        renderMessagePreview(content.html);

        setStatus("Письмо загружено");

    } catch (error) {
        console.error("MailGPT message body:", error);

        renderMessagePreviewText(
            "Ошибка чтения письма: " + error.message
        );

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
