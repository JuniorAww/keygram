import { TelegramBot, Panel, Text, Pagination } from "../";

const bot = new TelegramBot(process.argv[2]);

const data = [1, 2, 3, 4, 5, 6, 7].map(x => ({ number: Math.random() }))

const exampleText = (ctx, data, page) => `Your personal numbers PikiWedia\nYou're on page ${page+1}/${ctx.maxPage}!`
const exampleData = (ctx, page) => data
const exampleKeys = (_, numbers, page) => 
    Panel().Add(numbers.map(({ number }) => [ Text("Float " + number.toFixed(4)) ]))

const close = ctx => ctx.delete()
const closeKeys = ctx => Panel().Callback("Close panel", close)

const pages = new Pagination("numbers").Text(exampleText)
                                       .Data(exampleData)
                                       .Keys(exampleKeys)
                                       .AfterKeys(closeKeys)
                                       .PageSize(3)

bot.on('/start', ctx => ctx.open(pages));

bot.startPolling()
