import { TelegramBot, Keyboard, ParserError, Image } from "keygram";

const bot = new TelegramBot(process.argv[1]);

const clicked = async (ctx, initial = true, fox = 1) => {
    const url = `https://randomfox.ca/images/${fox}.jpg`;
    const next = Math.ceil(Math.random() * 124)
    const keyboard = Keyboard().Callback("🦊 Новая лисичка", clicked, false, next)
    const text = "Ваша лисичка, сэр! <b>№" + fox + "</b>";
    
    if (initial) ctx.reply({ text, ...Image(url), keyboard })
    else ctx.edit({ text, ...Image(url), keyboard })
}

bot.on('/start', clicked);

bot.setParser('HTML')
bot.dontThrow(ParserError) // Ничего не делать при ошибке разметки
bot.startPolling(console.log);
