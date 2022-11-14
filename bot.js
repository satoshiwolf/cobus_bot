const { REST, Routes, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Discord = require('discord.js');
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
require('events').EventEmitter.defaultMaxListeners = 0;
const dotenv = require("dotenv");
dotenv.config({path: __dirname + "/.env"});

/*########################################*/
//Server bot
/*########################################*/

const express = require('express');
const app = express();
const bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post(`/${process.env.ROUTE}`,(req, res) => {
  res.end();
  client.emit('postRequest', req.body);
});

app.listen(process.env.PORT, process.env.HOST, () => {
    console.log(`Server running on http://${process.env.HOST}:${process.env.PORT}/`)
});

/*########################################*/
//End Server bot
/*########################################*/

const commands = [
  {
    name: 'ping',
    description: 'Replies with Pong!',
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
let postChannel = "";

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  postChannel = client.channels.cache.get(process.env.CHANNEL_ID);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }
});

client.on('messageCreate', async message => {
  if (message.channel.id === process.env.CHANNEL_ID && message.author.id === process.env.CLIENT_ID) {
    post = JSON.parse(message);
    channelName = post.channel;
    postChannel.lastMessage.delete();
    delete post.channel;
    message.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: postChannel.parentId,
    }).then(async (ticket_cobus) => {
      let ticket_status = false;
      let message = "";
      for (const key in post) {
        message += `${key}: ${post[key]} \n`;
      }
      const buttons_ticket = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('close_ticket')
          .setEmoji('🔒')
					.setLabel('Cerrar ticket')
					.setStyle(ButtonStyle.Primary),
			);

      ticket_cobus.send({
        content: `${message}`,
        components: [buttons_ticket]
      });

      client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;
        if (interaction.customId === 'close_ticket' && ticket_cobus.id === interaction.channel.id ) {
          //&& ticket_status === true
          if (ticket_status === true) {
            interaction.reply({ content: '> El ticket ya está cerrado', ephemeral: true })
          } else {
            ticket_status = true;
            try{
              interaction.reply({content: '> El canal sera borrado en 5 segundos...', ephemeral: true })
              setTimeout(async function() {
                  interaction.channel.delete()
              }, 5000)
            } catch (error) {
              console.error(error);
              return;
            }
          }
        }
      })
    })
  }
});

client.on('postRequest', async message => {
  let channelNames = client.channels.cache.filter(channel =>
    channel.type == 0 && channel.name.startsWith('cobus-ticket')
  );
  channelNames = channelNames.map(channel => channel.name);
  channelNames.sort();
  if(channelNames.length <= 0) {
    channelNames.push("cobus-ticket-0000");
  }
  let ticketNum = channelNames.at(-1).split('-');
  ticketNum[2] = parseInt(ticketNum[2]) + 1;
  ticketNum[2] = ticketNum[2].toString().padStart(4, '0');
  ticketNum = ticketNum.join('-');
  message.channel = ticketNum;
  postChannel.send(JSON.stringify(message));
});

client.login(process.env.TOKEN);
