
function htmlToText(html) {
    const doc = new DOMParser().parseFromString(
        html,
        'text/html'
    );

    doc.querySelectorAll('script, style').forEach(element => {
        element.remove();
    });

    return (
        doc.body?.innerText ??
        doc.body?.textContent ??
        ''
    )
        .replace(/\u00a0/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

async function getMessageBody(messageId) {
    // Получаем текстовые части письма
    const parts = await messenger.messages.listInlineTextParts(
        messageId
    );

    // Сначала ищем обычный текст
    const plainParts = parts.filter(part =>
        part.contentType.toLowerCase().startsWith('text/plain')
    );

    if (plainParts.length) {
        return plainParts
            .map(part => part.content.trim())
            .filter(Boolean)
            .join('\n\n');
    }

    // Если обычного текста нет, используем HTML
    const htmlParts = parts.filter(part =>
        part.contentType.toLowerCase().startsWith('text/html')
    );

    if (htmlParts.length) {
        return htmlParts
            .map(part => htmlToText(part.content))
            .filter(Boolean)
            .join('\n\n');
    }

    return '';
}

async function init() {
    const status = document.getElementById('status');
    const bodyElement = document.getElementById('body');
    const bodyInfo = document.getElementById('bodyInfo');

    try {
        // Получаем активную вкладку
        const tabs = await messenger.tabs.query({
            active: true,
            currentWindow: true
        });

        if (!tabs.length) {
            throw new Error('Активная вкладка не найдена');
        }

        // Получаем открытое письмо
        const message = await messenger.messageDisplay
            .getDisplayedMessage(tabs[0].id);

        if (!message) {
            throw new Error('Откройте одно письмо');
        }

        // Выводим заголовки
        document.getElementById('from').textContent =
            message.author;

        document.getElementById('subject').textContent =
            message.subject;

        // Проверяем поддержку API
        if (!messenger.messages.listInlineTextParts) {
            throw new Error(
                'Ваш Thunderbird не поддерживает listInlineTextParts'
            );
        }

        // Получаем полное текстовое содержимое
        status.textContent = 'Читаю тело письма...';

        const body = await getMessageBody(message.id);

        if (!body) {
            status.textContent = 'Письмо получено, тело не найдено';
            bodyElement.value = '';
            return;
        }

        // Показываем содержимое
        bodyElement.value = body;

        bodyInfo.textContent =
            `Получено символов: ${body.length}`;

        status.textContent = 'Письмо полностью получено';

    } catch (error) {
        status.textContent = 'Ошибка: ' + error.message;
        console.error('MailGPT:', error);
    }
}

init();
