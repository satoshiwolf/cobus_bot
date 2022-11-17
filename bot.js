const { REST, Routes, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, transcriptEmbed } = require("discord.js");
const Discord = require("discord.js");
const client = new Discord.Client({ 
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent,
    Discord.GatewayIntentBits.GuildMessageReactions,
    Discord.GatewayIntentBits.GuildEmojisAndStickers,
  ],
  partials: [
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

/*########################################*/
//Server bot
/*########################################*/

const express = require("express");
const app = express();
const bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post(`/${process.env.ROUTE}`,(req, res) => {
  res.end();
  client.emit("postRequest", req.body);
});

app.listen(process.env.PORT, process.env.HOST, () => {
    console.log(`Server running on http://${process.env.HOST}:${process.env.PORT}/`)
});

/*########################################*/
//End Server bot
/*########################################*/

const commands = [
  {
    name: "ping",
    description: "Replies with Pong!",
  },
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

function getGuild() {
  return client.guilds.cache.get(process.env.GUILD_ID);
};

function getChannel(category, channelName) {
  return guild.channels.cache.find(channel =>
    channel.type === category &&
    channel.name === channelName
  );
};

function createChannel(name, type, parent) {
  return guild.channels.create({
    name: name,
    type: type,
    parent: parent,
  });
};

function setButton(buttonName, param1, param2) {
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
          .setCustomId("reopen_ticket")
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
    case "transcript":
      return new EmbedBuilder()
      .setColor(0xfdfd96)
      .setDescription(`Transcripción guardada en ${param1}`)
  };
}

function createTicket(name, type, parent, message){
  createChannel(name, type, parent)
  .then(async ticketChannel => {
    let post = String();
    for (const key in message) {
      post += `${key}: ${message[key]} \n`;
    };
    ticketChannel.send({
      content: `${post}`,
      components: [setButton("close")],
    });
  });
};

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  };
})();

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  guild = getGuild();
  ticketsCategory = getChannel(ChannelType.GuildCategory, process.env.TICKETS_CATEGORY);
  if(typeof ticketsCategory === "undefined"){
    createChannel(process.env.TICKETS_CATEGORY, ChannelType.GuildCategory)
    .then(async channel => {
      ticketsCategory = channel;
    });
  };
});

client.on("postRequest", async message => {
  let channelNames = guild.channels.cache.filter(channel =>
    channel.type == ChannelType.GuildText &&
    channel.name.startsWith(process.env.TICKETS_PREFIX) &&
    /[0-9]+$/.test(channel.name)
  );
  channelNames = channelNames.map(channel => channel.name);
  channelNames.sort();
  if(channelNames.length <= 0) {
    channelNames.push(`${process.env.TICKETS_PREFIX}-0000`);
  }
  var numIndex = channelNames.at(-1).lastIndexOf("-");
  let ticketNum = channelNames.at(-1).substr(numIndex+1);
  let ticketName = process.env.TICKETS_PREFIX;
  ticketNum = parseInt(ticketNum) + 1;
  ticketNum = ticketNum.toString().padStart(4, "0");
  ticketName = `${ticketName}-${ticketNum}`;
  switch (typeof getChannel(ChannelType.GuildCategory, process.env.TICKETS_CATEGORY)) {
    case "undefined":
      createChannel(process.env.TICKETS_CATEGORY, ChannelType.GuildCategory)
      .then(async channel => {
        ticketsCategory = channel;
        createTicket(ticketName, ChannelType.GuildText, ticketsCategory.id, message);
        console.log(ticketMessage);
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
        interaction.update({
          embeds: [setEmbed("confirm_ticket_lock")],
          components: [setButton("confirm_lock")],
        });
        break;
      case "confirm_close_ticket":
        interaction.update({
          embeds: [setEmbed("ticket_lock", interaction.member.user.toString())],
          components: [setButton("confirm_close")],
        });
        break;
      case "reopen_ticket":
        interaction.update({
          embeds: [],
          components: [setButton("close")],
        });
        break;
      case "delete_ticket":
        deleteSeconds = 5;
        if(tempTickets.includes(interaction.channelId)) {
          interaction.reply({ content: "> El ticket ya está siendo cerrado", ephemeral: true })
          return;
        };
        tempTickets.push(interaction.channelId);
        try{
          interaction.reply({content: `> El canal será borrado en ${deleteSeconds} segundos...`, ephemeral: true })
          setTimeout(async function() {
              interaction.channel.delete();
              const ticketIndex = tempTickets.indexOf(interaction.channelId);
              if (ticketIndex > -1) {
                tempTickets.splice(ticketIndex, 1);
              };
          }, deleteSeconds*1000);
        } catch (error) {
          console.error(error);
          return;
        };
        break;
      case "transcript_ticket":
        const attachment = await discordTranscripts.createTranscript(interaction.channel, {filename: `${interaction.channel.name}.html`});
        logChannel = getChannel(ChannelType.GuildText, process.env.TICKETS_LOG_CHANNEL);
        switch (typeof logChannel) {
          case "undefined":
            createChannel(process.env.TICKETS_LOG_CHANNEL, ChannelType.GuildText, ticketsCategory.id).then(async channel => {
              channel.send({ files: [attachment] });
              interaction.reply({
                embeds: [setEmbed("transcript", channel.toString())],
              });
            });
            break;
          default:
            logChannel.send({ files: [attachment] });
            interaction.reply({
              embeds: [setEmbed("transcript", logChannel.toString())],
            });
            break;
        };
        break;
    };
  };
});

client.login(process.env.TOKEN);
