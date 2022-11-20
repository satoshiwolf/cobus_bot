const {
    REST, 
    Routes, 
    ChannelType, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    PermissionsBitField, 
    PermissionFlagsBits, 
    transcriptEmbed } = require("discord.js");
const Discord = require("discord.js");
const client = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent,
        Discord.GatewayIntentBits.GuildMessageReactions,
        Discord.GatewayIntentBits.GuildEmojisAndStickers,
    ], partials: [
        Discord.Partials.Message,
        Discord.Partials.Channel,
        Discord.Partials.Reaction,
        Discord.Partials.GuildMember,
        Discord.Partials.User,
    ], 
});
const discordTranscripts = require("discord-html-transcripts");
require("events").EventEmitter.defaultMaxListeners = 0;
const dotenv = require("dotenv");
dotenv.config({path: `${__dirname}/.env`});
const { 
    TOKEN, 
    CLIENT_ID, 
    HOST, 
    PORT,
    ROUTE, 
    GUILD_ID, 
    TICKETS_CATEGORY, 
    TICKETS_PREFIX, 
    TICKETS_LOG_CHANNEL,
    MONGO_DATABASE,
    MONGO_HOST,
    MONGO_PORT,
    MONGO_COLLECTION } = process.env;

/*########################################*/
//MongoDB
/*########################################*/
const { Schema, model, mongoose } = require('mongoose');
mongoose_url = `mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`

mongoose.connect(mongoose_url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(db =>
    console.log('Conexión a MongoDB exitosa!'
)).catch(err =>
    console.error(`Ocurrió un error al conectarse con MongoDB:${err}`
));

let mongoSchema;
let mongoModel;

/*########################################*/
//End MongoDB
/*########################################*/

/*########################################*/
//Server bot
/*########################################*/

const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const { request } = require("https");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post(`/${ROUTE}`,(req, res) => {
    res.end();
    client.emit("postRequest", req.body);
});

app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}/`)
});

/*########################################*/
//End Server bot
/*########################################*/

/*########################################*/
//Commands bot
/*########################################*/

const commands = [{
    name: "ping",
    description: "Replies with Pong!",
}];

/*########################################*/
//End Commands bot
/*########################################*/

/*########################################*/
//Functions bot
/*########################################*/

const rest = new REST({ version: "10" }).setToken(TOKEN);

function isImage(url) {
    let req = request(url, (res) => {
        return res.headers['content-type'].startsWith('image/');
    });
    req.end();
    return req;
};

function isUrl(url) {
    try { return Boolean(new URL(url)); }
    catch (e) { return false; };
};

function isNumber(str) {
    if (typeof str != "string") return false;
    return !isNaN(str) && !isNaN(parseFloat(str));
};

function getGuild() {
    return client.guilds.cache.get(GUILD_ID);
};

function getChannel(category, channelName) {
    return guild.channels.cache.find(channel =>
        channel.type === category &&
        channel.name === channelName
    );
};

async function getFirstMessage(channel) {
    fetchMessage = await channel.messages.fetch({ after: 1, limit: 1 });
    firstMessage = fetchMessage.first();
    return firstMessage;
};

function createChannel(name, type, parent) {
    return guild.channels.create({
        name: name,
        type: type,
        parent: parent,
    });
};

function changePermissions(channel, role, permission) {
    channel.permissionOverwrites.edit(role, permission);
}

function setButton(buttonName) {
    switch (buttonName) {
        case "close":
            return new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("close_ticket")
                        .setEmoji("🔒")
                        .setLabel("Cerrar ticket")
                        .setStyle(ButtonStyle.Primary),
                );

        case "confirm_lock":
            return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                .setCustomId("confirm_close_ticket")
                .setLabel("Cerrar")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
          .setCustomId("cancel_close")
          .setLabel("Cancelar")
          .setStyle(ButtonStyle.Secondary),
      );

        case "confirm_close":
            return new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("transcript_ticket")
                        .setEmoji("📝")
                        .setLabel("Transcribir")
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId("reopen_ticket")
                        .setEmoji("🔓")
                        .setLabel("Reabrir")
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId("delete_ticket")
                        .setEmoji("🛑")
                        .setLabel("Borrar ticket")
                        .setStyle(ButtonStyle.Primary),
                );
    };
};

function setEmbed(embedName, param1, param2) {
    switch (embedName) {
        case "confirm_ticket_lock":
            return new EmbedBuilder()
                .setColor(0xFF6961)
                .setDescription("Estas seguro de que quieres cerrar el ticket?");

        case "ticket_lock":
            return new EmbedBuilder()
                .setColor(0xfdfd96)
                .setDescription(`Ticket cerrado por ${param1}`)
                .setTimestamp();

        case "ticket_unlock":
            return new EmbedBuilder()
                .setColor(0x1EC45B)
                .setDescription(`Ticket reabierto por ${param1}`)
                .setTimestamp();

        case "transcript":
            return new EmbedBuilder()
                .setColor(0xfdfd96)
                .setDescription(`Transcripción guardada en ${param1}`);

        case "post":
            let post = new EmbedBuilder()
                .setColor(0x5865F2);
            for (const key in param1) { post.addFields({name: key, value: param1[key]}); };
            if(param2){ post.setImage(param2); };
            post.setTimestamp();
            return post;
    };
};

function createTicket(name, type, parent, message){
    createChannel(name, type, parent).then(async (ticketChannel) => {
        insertMongo(ticketChannel.id, message);
        let img = String();
        Object.keys(message).forEach( key => {
            if(message[key] === "") {message[key] = "-"; return;};
            if(isUrl(message[key]) && isImage(message[key])) {img = message[key]; delete message[key];};
        });
        ticketChannel.send({
            embeds: [setEmbed("post", message, img)],
            components: [setButton("close")],
        });
    });
};

function closeTicket(channel, message, author){
    message.edit({
        components: [setButton("confirm_close")],
    });
    channel.send({
        embeds: [setEmbed("ticket_lock", author.toString())],
    });
    channel.setName(`🔒-${channel.name}`)
        .catch(console.error);
};

function reopenTicket(channel, interaction, author){
    channel.setName(channel.name.replace("🔒-", ""))
        .catch(console.error);
    interaction.update({
        components: [setButton("close")],
    });
    channel.send({
        embeds: [setEmbed("ticket_unlock", author.toString())],
    });
};

function deleteTicket(seconds, channel, interaction){
    if(tempTickets.includes(channel.id)) {
        interaction.reply({ content: "> El ticket ya está siendo borrado", ephemeral: true })
        return;
    };
    tempTickets.push(channel.id);
    try{
        interaction.reply({content: `> El ticket será borrado en ${seconds} segundos...`, ephemeral: true })
        setTimeout(async function() {
            channel.delete();
            const ticketIndex = tempTickets.indexOf(channel.id);
            if (ticketIndex > -1) {
              tempTickets.splice(ticketIndex, 1);
            };
        }, seconds*1000);
    } catch (error) {
        console.error(error);
        return;
    };
};

async function transcriptTicket(channel, interaction) {
    interaction.update({});
    const attachment = await discordTranscripts.createTranscript(channel, {filename: `${channel.name}.html`});
    let logChannel = getChannel(ChannelType.GuildText, TICKETS_LOG_CHANNEL);
    switch (typeof logChannel) {
        case "undefined":
            createChannel(TICKETS_LOG_CHANNEL, ChannelType.GuildText, ticketsCategory.id).then(async logChannel => {
                logChannel.send({ files: [attachment] });
                channel.send({
                    embeds: [setEmbed("transcript", logChannel.toString())],
                });
            });
            break;
        default:
            logChannel.send({ files: [attachment] });
            channel.send({
                embeds: [setEmbed("transcript", logChannel.toString())],
            });
            break;
    };
};

function insertMongo(id, data){
    let mongoData = Object.assign({}, data);
    mongoData = Object.assign({id: id}, mongoData);
    Object.assign(mongoData, {closing_user: ""});
    Object.assign(mongoData, {estado: true});
    Object.assign(mongoData, {reabierto: false});
    if(typeof mongoSchema === "undefined") {
        for(const key in mongoData) {
            mongoSchema = Object.assign({}, mongoSchema, {[key]: typeof mongoData[key]});
        };
        mongoSchema = new Schema( mongoSchema, { timestamps: true });
        mongoModel = model(MONGO_COLLECTION, mongoSchema);
    };
    let fields = new mongoModel(mongoData);
    fields.save(function (err) {
        if (err) return console.error(err);
        console.log("Guardado con éxito");
    });
};

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  };
})();

/*########################################*/
//End Functions bot
/*########################################*/

/*########################################*/
//Events bot
/*########################################*/

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
    guild = getGuild();
    ticketsCategory = getChannel(ChannelType.GuildCategory, TICKETS_CATEGORY);
    if(typeof ticketsCategory === "undefined"){
        let channel = createChannel(TICKETS_CATEGORY, ChannelType.GuildCategory);
        changePermissions(channel, guild.roles.everyone, {ViewChannel: false});
        ticketsCategory = channel;
    };
});
  
client.on("postRequest", async message => {
    let channelNames = guild.channels.cache.filter(channel =>
        channel.type == ChannelType.GuildText &&
        channel.name.includes(TICKETS_PREFIX) &&
        /[0-9]+$/.test(channel.name)
    ).map(channel => channel.name);
    channelNames.sort();
    if(channelNames.length <= 0) {
        channelNames.push(`${TICKETS_PREFIX}-0000`);
    }
    var numIndex = channelNames.at(-1).lastIndexOf("-");
    let ticketNum = channelNames.at(-1).substr(numIndex+1);
    let ticketName = TICKETS_PREFIX;
    ticketNum = parseInt(ticketNum) + 1;
    ticketNum = ticketNum.toString().padStart(4, "0");
    ticketName = `${ticketName}-${ticketNum}`;
    switch (typeof getChannel(ChannelType.GuildCategory, TICKETS_CATEGORY)) {
        case "undefined":
            createChannel(TICKETS_CATEGORY, ChannelType.GuildCategory)
            .then(async channel => {
                changePermissions(channel, guild.roles.everyone, {ViewChannel: false});
                ticketsCategory = channel;
                createTicket(ticketName, ChannelType.GuildText, ticketsCategory.id, message);
            });
            break;
        default:
            createTicket(ticketName, ChannelType.GuildText, ticketsCategory.id, message);
            break;
    };
});
  
let tempTickets = [];
  
client.on("interactionCreate", async interaction => {
    if (interaction.commandName === "ping") {
        await interaction.reply("Pong!");
    };
    
    if(typeof interaction.customId !== "undefined") {
        switch (interaction.customId) {
            case "close_ticket":
                interaction.update({});
                interaction.channel.send({
                    embeds: [setEmbed("confirm_ticket_lock")],
                    components: [setButton("confirm_lock")],
                });
                break;
  
            case "confirm_close_ticket":
                interaction.message.delete();
                firstMessage = await getFirstMessage(interaction.channel);
                buttonId = firstMessage.components[0].components[0].customId;
                if(buttonId == "close_ticket") {
                    closeTicket(interaction.channel, firstMessage, interaction.user);
                } else {
                    interaction.reply({ content: "> El ticket ya ha sido cerrado", ephemeral: true })
                };
                break;
  
            case "cancel_close":
                interaction.message.delete();
                break;
  
            case "reopen_ticket":
                reopenTicket(interaction.channel, interaction, interaction.user);
                break;
  
            case "delete_ticket":
                deleteTicket(5, interaction.channel, interaction);
                break;
  
            case "transcript_ticket":
                transcriptTicket(interaction.channel, interaction);
                break;
      };
    };
  });

/*########################################*/
//End Events bot
/*########################################*/

client.login(TOKEN);
