# <p align="center">Keygram WIP</p>

<p align="center"><strong>Experimental library for interactive panels</strong></p>
<p align="center">
  <img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram">
  <img src="https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
</p>

<b>Language: [[EN]](https://github.com/JuniorAww/keygram/blob/main/README.md) [[RU]](https://github.com/JuniorAww/keygram/blob/main/docs/README.ru.md)</b>

## Introduction

Unlike other libraries for the Telegram Bot API, Keygram provides **wrappers for `callbacks`** to simplify the creation of interactive panels.
Additionaly, future plans include ready-to-use classes for page panels, cached media, and more.

> Tested in <b>[Bun](https://bun.com/)</b> and <b>[Node](https://nodejs.org/en)</b> ecosystems, JavaScript and TypeScript

### Features

* <b>Functions “embedded” into buttons</b>
</br>When creating a keyboard with callbacks, they are stored in a <b>global store</b> and executed whenever the callback_data is processed.

* <b>Built-in security</b>
</br>By default, callback buttons have <i>signatures</i> that make it harder to forge arguments.
  This feature can be disabled: `new TelegramBot({ token, signCallbacks: false })`

* <b>Text editing</b>
</br>You can use a single method `ctx.edit()` to edit both text and file captions — no more separate `bot.editMessageText` or `bot.editMessageCaption` calls!

### Keyboard Example

```js
import { TelegramBot, Keyboard } from "keygram"

const bot = new TelegramBot("YOUR_TOKEN")

/* Example: function is pre-defined */
const clicked = (ctx, amount = 0) => {
    const keyboard = Keyboard().Callback("✨ Button clicked " + amount + " times", clicked, amount + 1)
    ctx.reply(`You clicked the button!`, keyboard)
}

const mainMenu = Keyboard().Callback("✨ Click me!", clicked)
                           .Text("Dummy button") // No callback_data needed

bot.on('/start', ctx => ctx.reply("Welcome!", mainMenu))

bot.startPolling(console.log) // Log all requests from Telegram
```

### More examples:

* [Editable panel with an image](https://github.com/JuniorAww/keygram/blob/main/examples/edit.js)
* [Counter example (above)](https://github.com/JuniorAww/keygram/blob/main/examples/counter.js)

## Planned Features

* Persistent callbacks (`PersistentCallback`) to save functions to a file
* Pagination and CachedImage classes
* Best practices
