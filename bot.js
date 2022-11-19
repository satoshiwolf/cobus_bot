const { REST, Routes, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField, PermissionFlagsBits, transcriptEmbed } = require("discord.js");
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
const { request } = require("https");

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

async function getFirstMessage(channel){
  fetchMessage = await channel.messages.fetch({ after: 1, limit: 1 });
  firstMessage = fetchMessage.first();
  return firstMessage;
}

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
      .setColor(0xFF6961);
      for (const key in param1) { post.addFields({name: key, value: param1[key]}); };
      if(param2){ post.setImage(param2); };
      post.setTimestamp();
      return post;
  };
}

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

function createTicket(name, type, parent, message){
  createChannel(name, type, parent)
  .then(async ticketChannel => {
    let img = String();
    Object.keys(message).forEach(
      key => {
        if(message[key] === "") {message[key] = "-"; return;};
        if(isUrl(message[key]) && isImage(message[key])) {img = message[key]; delete message[key];};
      }
    );
    ticketChannel.send({
      embeds: [setEmbed("post", message, img)],
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
      changePermissions(channel, guild.roles.everyone, {ViewChannel: false});
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
        changePermissions(channel, guild.roles.everyone, {ViewChannel: false});
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
        if(buttonId == "close_ticket"){
          firstMessage.edit({
            components: [setButton("confirm_close")],
          });
          interaction.channel.send({
            embeds: [setEmbed("ticket_lock", interaction.member.user.toString())],
          });
        } else {
          interaction.reply({ content: "> El ticket ya ha sido cerrado", ephemeral: true })
        };
        break;

      case "cancel_close":
        interaction.message.delete();
        break;

      case "reopen_ticket":
        interaction.update({
          components: [setButton("close")],
        });
        interaction.channel.send({
          embeds: [setEmbed("ticket_unlock", interaction.member.user.toString())],
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
        interaction.update({});
        const attachment = await discordTranscripts.createTranscript(interaction.channel, {filename: `${interaction.channel.name}.html`});
        logChannel = getChannel(ChannelType.GuildText, process.env.TICKETS_LOG_CHANNEL);
        switch (typeof logChannel) {
          case "undefined":
            createChannel(process.env.TICKETS_LOG_CHANNEL, ChannelType.GuildText, ticketsCategory.id).then(async channel => {
              channel.send({ files: [attachment] });
              interaction.channel.send({
                embeds: [setEmbed("transcript", channel.toString())],
              });
            });
            break;
          default:
            logChannel.send({ files: [attachment] });
            interaction.channel.send({
              embeds: [setEmbed("transcript", logChannel.toString())],
            });
            break;
        };
        break;
    };
  };
});

client.login(process.env.TOKEN);
