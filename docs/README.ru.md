# <p align="center">Keygram WIP</p>
<p align="center"><strong>Экспериментальная библиотека для интерактивных панелей</strong></p>
<p align="center">
  <img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram">
  <img src="https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
</p>

<b>Language: [[EN]](https://github.com/JuniorAww/keygram/blob/main/README.md) [[RU]](https://github.com/JuniorAww/keygram/blob/main/docs/README.ru.md)</b>
## Вступление

В отличие от других библиотек под Telegram Bot API, Keygram предлагает обертки для ```callbacks```
для упрощенного создания интерактивных панелей. Кроме этого, планируется добавить готовые классы
для страничных панелей, кешированных медиа и другое

> Проверено на экосистемах <b>[Bun](https://bun.com/)</b> и <b>[Node](https://nodejs.org/en)</b>, JavaScript и TypeScript

### Особенности

- <b>Функции "вставляются" в кнопки</b>
</br>При создании клавиатуры с коллбеками, они сохраняются в <b>глобальное хранилище</b> и затем исполняются при каждой обработке callback_data
- <b>Встроенная безопасность</b>
</br>Callback-кнопки по умолчанию имеют <i>сигнатуры</i>, которые усложняют подделку аргументов
</br>Функцию можно отключить: ```new TelegramBot({ token, signCallbacks: false })```
- <b>Редактирование текста</b>
</br>Для редактирования и текста, и подписей файлов можно использовать единый метод ```ctx.edit()``` — никаких
bot.editMessageText и bot.editMessageCaption!

### Пример клавиатуры
```js
import { TelegramBot, Keyboard } from "keygram"

const bot = new TelegramBot("ВАШ_ТОКЕН")

/* Пример: функция описана предварительньно */
const clicked = (ctx, amount = 0) => {
    const keyboard = Keyboard().Callback("✨ Кнопка нажата " + amount + " раз", clicked, amount + 1)
    ctx.reply(`Вы нажали кнопку!`, keyboard)
}

const mainMenu = Keyboard().Callback("✨ Нажми меня!", clicked)
                           .Text("Кнопка-пустышка") // Не нужно указывать callback_data

bot.on('/start', ctx => ctx.reply("Приветствуем!", mainMenu))

bot.startPolling(console.log) // Логируем все запросы от Telegram
```

### Больше примеров:
- [Редактируемая панель с изображением](https://github.com/JuniorAww/keygram/blob/main/examples/edit.js)
- [Пример выше (счетчик)](https://github.com/JuniorAww/keygram/blob/main/examples/counter.js)

## В планах

- Стойкие колбеки (```PersistentCallback```) - сохранение функций в файл
- Классы Pagination и CachedImage
- Лучшие практики
