import { KeyboardInterface, SerializedBtn } from './keyboard'
import { INSTANCES, BOT_IDS } from './store'
import { OptionsError, ParserError, NamelessCallback, CallbackOverride, FileNotFound } from './errors'
import { createHash } from "crypto";
import { readFile } from "node:fs/promises";

export interface BotOptions {
    token: string;
    signCallbacks: boolean | undefined;
    signLength: number | undefined;
}

export interface MessageOpts {
    text?: string | undefined;
    caption?: string | undefined;
    keyboard?: SerializedBtn[][] | KeyboardInterface;
    file?: File;
    spoiler?: boolean;
    [key: string]: any;
}

export interface File {
    photo?: string;
    audio?: string;
}

export function Image(path: string): MessageOpts {
    return {
        file: {
            photo: path
        }
    }
}

class BotInstance {
    token!: string;
    apiUrl!: string;

    protected initBot(token: string) {
        this.token = token;
        this.apiUrl = `https://api.telegram.org/bot${token}`;
        const botId = parseInt(token.split(':')[0]);
        INSTANCES[botId] = this as any;
        BOT_IDS.unshift(botId);
    }
}

function applyMixins(derivedCtor: any, baseCtors: any[]) {
    baseCtors.forEach(baseCtor => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
            if (name !== "constructor") {
                Object.defineProperty(
                    derivedCtor.prototype,
                    name,
                    Object.getOwnPropertyDescriptor(baseCtor.prototype, name) || Object.create(null)
                );
            }
        });
    });
}

class CallbackManager {
    callbacks!: Record<string, Function>;
    allow_override = false;
    mode = 0;
    
    /*
     * Регистрация функции для колбека
     * @param {Function[]} ...fs Регистрируемые именные функции
     */
    register(...fs: Function[]) {
        for (const func of fs) {
            if (this.mode !== 1 && func.name === "anon")
                throw new NamelessCallback("В режиме NamedCallbacks запрещены безымянные функции");

            if (!this.allow_override && this.callbacks[func.name])
                throw new CallbackOverride("В режиме allow_override = false запрещено переназначать callbacks");
            
            this.callbacks[func.name] = func;
        }
    }
    
    hasCallback(func: Function) {
        return this.callbacks[func.name] !== undefined;
    }

    protected async handleCallback(ctx: any, name: string, args: any[]) {
        const fixedArgs: any[] = [];

        for (const arg of args) {
            if (arg === 'false') fixedArgs.push(false);
            else if (arg === 'true') fixedArgs.push(true);
            else if (arg === 'undefined') fixedArgs.push(undefined);
            else if (arg === 'NaN') fixedArgs.push(NaN);
            else if (arg === 'null') fixedArgs.push(null);
            else if (arg === 'Infinity') fixedArgs.push(Infinity);
            else if (!isNaN(Number(arg))) fixedArgs.push(Number(arg));
            else fixedArgs.push(arg);
        }

        this.callbacks[name](ctx, ...fixedArgs);
    }
}

class MessageSender {
    parseMode: string | null = null;
    
    /*
     * Отправка сообщения
     * @param {number} chatId ID чата
     * @param {string} text Текст для отправки
     * @param {MessageOpts} [options] Параметры сообщения
     * @throws {ParserError} При некорректных тегах разметки
     */
    async sendMessage(chatId: number, text: string, options?: MessageOpts | KeyboardInterface) {
        console.log(text, options)
        
        if (options && "file" in options && options.file) {
            const body: any = { chat_id: chatId, caption: text };
            
            this.includeOptions(body, options);
            
            if (this.parseMode) body.parse_mode = this.parseMode;
            
            const { file } = options;
            
            console.log(body);
            
            let res;
            
            const type = Object.keys(options.file)[0];
            const data: string = (options.file as any)[type];
            const method = "send" + type[0].toUpperCase() + type.slice(1);
            
            if (!data.startsWith(".") && !data.startsWith("/")) {
                body.photo = data;
                
                res = await fetch(`${(this as any).apiUrl}/${method}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
            }
            else {
                const blob = await this.loadBlob(data);
                if (!blob) return null;
                const form = new FormData();
                Object.keys(body).forEach(k => {
                    if (typeof body[k] === 'string') form.append(k, body[k]);
                    else form.append(k, JSON.stringify(body[k]))
                });
                form.append(type, blob, "photo.jpg");
                res = await fetch(`${(this as any).apiUrl}/${method}`, {
                    method: "POST",
                    body: form,
                });
            }
            
            return res ? res.json() : null;
        }
        else {
            const body: any = { chat_id: chatId, text };
            
            if (options) this.includeOptions(body, options);
            
            if (this.parseMode) body.parse_mode = this.parseMode;
            
            const res = await fetch(`${(this as any).apiUrl}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            
            const parsed = await res.json();
            
            if (parsed.ok === false) {
                if (parsed.description.slice(13, 33) === "can't parse entities") {
                    const err = new ParserError(parsed.description.slice(35));
                    if ((this as any).shouldThrow(err)) throw err;
                }
            }
            
            return parsed;
        }
    }
    
    protected async loadBlob(path: string) {
        let fileBuffer;

        try {
            fileBuffer = await readFile(path);
        } catch (e: any) {
            if (e.code === "ENOENT") {
                const error = new FileNotFound("File not found: " + path);
                if ((this as any).shouldThrow(error)) throw error;
                else return null;
            }
            else throw e;
        }

        return new Blob([ fileBuffer ]);
    }
    
    /*
     * Парсинг и включение аргументов
     */
    protected includeOptions(body: any, options: MessageOpts | KeyboardInterface) {
        if ("Build" in options) {
            body.reply_markup = (this as any).getKeyboardMarkup(options.Build());
        }
        else if ("keyboard" in options) {
            body.reply_markup = (this as any).getKeyboardMarkup(options.keyboard);
        }
    }

    /*
     * Редактирование сообщения
     * @param {number} chatId
     * @param {number} messageId
     * @param {MessageOpts} options
     */
    async editMessage(chatId: number, messageId: number, options: MessageOpts) {
        if (options.file) {
            const type = Object.keys(options.file)[0];
            const data: string = (options.file as any)[type]; // either document ID, URL or local path
            
            if (data.startsWith(".") || data.startsWith("/")) {
                const body: any = {
                    chat_id: chatId,
                    message_id: messageId,
                    media: {
                        type,
                        caption: options.text || undefined,
                        media: "attach://document",
                    }
                }
                
                this.includeOptions(body, options);
                
                if (options.spoiler === true) body.media.has_spoiler = true;
                if (this.parseMode) body.media.parse_mode = this.parseMode;
                
                const blob = await this.loadBlob(data); // path
                if (!blob) return null;
                const form = new FormData();
                
                Object.keys(body).forEach(k => {
                    if (typeof body[k] === 'string') form.append(k, body[k]);
                    else form.append(k, JSON.stringify(body[k]))
                });
                
                form.append("document", blob, "photo.jpg");
                
                const res = await fetch(`${(this as any).apiUrl}/editMessageMedia`, {
                    method: "POST",
                    body: form,
                });
                
                const parsed = await res.json();
            
                return parsed;
            }
            else {
                const body: any = {
                    chat_id: chatId,
                    message_id: messageId,
                    media: {
                        type,
                        caption: options.text || undefined,
                        media: data,
                    }
                }
                
                this.includeOptions(body, options);
                
                if (options.spoiler === true) body.media.has_spoiler = true;
                if (this.parseMode) body.media.parse_mode = this.parseMode;
                
                const res = await fetch(`${(this as any).apiUrl}/editMessageMedia`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                
                const parsed = await res.json();
                
                return parsed;
            }
        }
        else if ("text" in options && options.text) {
            const body: any = { chat_id: chatId, message_id: messageId, text: options.text }
            
            this.includeOptions(body, options); // keyboard, image, etc
            
            const res = await fetch(`${(this as any).apiUrl}/editMessageText`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            
            const parsed = await res.json();
            
            return parsed;
        }
        else if ("caption" in options && options.caption) {
            const body: any = { chat_id: chatId, message_id: messageId, caption: options.text }
            
            this.includeOptions(body, options);
            
            const res = await fetch(`${(this as any).apiUrl}/editMessageCaption`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            
            const parsed = await res.json();
            
            return parsed;
        }
    }
    
    protected async identifyEdit(ctx: any, argument: string | MessageOpts) {
        if (!ctx.message?.chat?.id) throw new Error("Can't edit outside callback context")
        const chat_id = ctx.message?.chat?.id;
        console.log('Context', ctx)
        if (typeof argument === 'string') {
            if (!ctx.message.text) {
                return this.editMessage(chat_id, ctx.message.message_id, {
                    caption: argument
                })
            }
            else {
                return this.editMessage(chat_id, ctx.message.message_id, {
                    text: argument
                })
            }
        }
        else {
            if (!ctx.message.text) {
                console.log('PHOTO!')
                return this.editMessage(chat_id, ctx.message.message_id, {
                    ...argument,
                    caption: argument.text || argument.caption // TODO special message opts - to exclude caption
                })
            }
            else {
                return this.editMessage(chat_id, ctx.message.message_id, {
                    ...argument,
                    text: argument.text || argument.caption
                })
            }
        }
    }

    protected async answerCallbackQuery(id: string, text: string) {
        await fetch(`${(this as any).apiUrl}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: id, text }),
        });
    }
    
    protected async reply(ctx: any, text: string, options?: MessageOpts) {
        const chat_id = ctx.message?.chat?.id || ctx.from.id;
        return this.sendMessage(chat_id, text, options);
    }
}

class ParseModeManager {
    /*
     * Парсер сообщений
     * @param {string} name Название парсера (HTML, MarkdownV2, Markdown или null)
     */ 
    setParser(name: string | null) {
        (this as any).parseMode = name;
    }
}

class ErrorManager {
    exception: (new (...args: any[]) => Error)[] = [];
    
    /*
     * Не вызывать исключение
     * @param {Error[]} errors Список исключений
     */
    dontThrow(...errors: (new (...args: any[]) => Error)[]) {
        errors.forEach(e => this.exception.push(e));
    }

    shouldThrow(err: Error) {
        return !this.exception.some(ex => err instanceof ex);
    }
}

class KeyboardManager {
    protected serializeKeyboard(keyboard: SerializedBtn[][] | KeyboardInterface) {
        return Array.isArray(keyboard) ? keyboard.map(row => row.map(btn => ({ text: btn.text, callback_data: btn.data || ' ' })))
                                       : keyboard.Build().map(row => row.map(btn => ({ text: btn.text, callback_data: btn.data || ' ' })));
    }

    protected getKeyboardMarkup(keyboard: SerializedBtn[][] | KeyboardInterface) {
        return { inline_keyboard: this.serializeKeyboard(keyboard) };
    }
}

class CallbackSigner {
    signCallbacks = true;
    signLength = 4;
    token!: string;

    sig(data: string) {
        return tinySig(data + this.token, this.signLength);
    }

    requireSig() {
        return this.signCallbacks;
    }
}

class HandlerManager {
    textHandlers!: any[];
    
    on(match: string | RegExp, func: Function) {
        const regex = typeof match === 'string' ? new RegExp(match) : match;
        
        this.textHandlers.push({
            regex,
            func
        })
    }
}

function tinySig(text: string, signLength: number): string {
    const hash = createHash("sha256").update(text, "utf8").digest();
    return hash.toString("base64").substring(0, signLength);
}

class Polling extends CallbackManager {
    protected async startPolling(onUpdate: (msg: any) => void) { // eslint-disable-line no-unused-vars
        let offset = 0;
        while (true) {
            const res = await fetch(`${(this as any).apiUrl}/getUpdates?offset=${offset}&timeout=30`);
            const data = await res.json();
            if (!data.result?.length) continue;

            for (const update of data.result) {
                if (update.callback_query) {
                    const { id, data } = update.callback_query;
                    
                    if (!data) continue;
                    const args = data.split(' ');

                    if ((this as any).signCallbacks) {
                        
                        const sigIndex = data.indexOf(' ');
                        if ((this as any).sig(data.slice(sigIndex + 1)) !== data.slice(0, sigIndex)) {
                            console.warn("Wrong signature");
                        }
                        else this.handleCallback((this as any).Context(update), args[1], args.slice(2));
                    } else {
                        
                        this.handleCallback((this as any).Context(update), args[0], args.slice(1));
                    }
                    (this as any).answerCallbackQuery(id, ' ');
                } else if (update.message?.text?.length) {
                    for (const { regex, func } of (this as any).textHandlers) {
                        console.log(regex, update.message.text);
                        if (regex.test(update.message.text)) {
                            func((this as any).Context(update));
                            break;
                        }
                    }
                }
                
                if(onUpdate !== undefined) onUpdate(update);
                
                offset = update.update_id + 1;
            }
        }
    }
    
    private Context(update: any) {
        const ctx: any = update.callback_query || update.message;
        if (!ctx) throw new Error("Sorry, unsupported context!" + update);
        return {
            ...update.callback_query,
            reply: (argument: string | MessageOpts, options?: MessageOpts) =>
                (this as any).reply(ctx, typeof argument === 'string' ? argument : argument.text, options || argument),
            edit: (argument: string | MessageOpts) =>
                (this as any).identifyEdit(ctx, argument),
        };
    }
}

class TelegramBotBase {}

interface TelegramBotBase
    extends BotInstance,
        CallbackManager,
        KeyboardManager,
        MessageSender,
        ParseModeManager,
        ErrorManager,
        HandlerManager,
        CallbackSigner,
        Polling {}

applyMixins(TelegramBotBase, [
    BotInstance,
    CallbackManager,
    KeyboardManager,
    MessageSender,
    ParseModeManager,
    ErrorManager,
    HandlerManager,
    CallbackSigner,
    Polling,
]);


export class TelegramBot extends TelegramBotBase {
    callbacks: Record<string, Function> = {};
    textHandlers: any[] = [];
    allow_override = false;
    mode = 0;
    parseMode: string | null = null;
    exception: (new (...args: any[]) => Error)[] = [];
    signCallbacks = true;
    signLength = 4;

    constructor(options: BotOptions | string) {
        super();

        let token: string;

        if (typeof options === "string") token = options;
        else {
            token = options.token;
            if (options.signCallbacks !== undefined) this.signCallbacks = options.signCallbacks;
            if (options.signLength !== undefined) this.signLength = options.signLength;
        }

        if (!token) throw new OptionsError("Не указан токен");

        (this as any).initBot(token);
    }
}

