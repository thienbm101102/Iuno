const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Collection, 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  PermissionsBitField 
} = require('discord.js');

const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
import { fileURLToPath } from 'url';
//import dns from 'dns';
//dns.setServers(['8.8.8.8']); // Google DNS
// Render cần 1 web server để không kill app
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("OK"); // chỉ trả về chữ "OK" để cron-job.org ping
  console.log("✅ Ping received from cron-job.org");
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`🌐 Web server is running on port ${process.env.PORT || 3000}`);
});

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = await import(`./commands/${file}`);
  client.commands.set(command.default.data.name, command.default);
}

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (command) await command.execute(interaction, client);
  } else if (interaction.isButton()) {
    const [action, messageId] = interaction.customId.split('_');
    const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return await interaction.reply({ content: '❌ Bạn không có quyền duyệt.', ephemeral: true });
    }

    await interaction.deferUpdate(); // tránh lỗi interaction

    const targetMsg = await interaction.channel.messages.fetch(messageId).catch(() => null);
    if (!targetMsg) return;

    const originalContent = targetMsg.embeds[0]?.description || 'Không rõ nội dung';
    const senderId = targetMsg.embeds[0]?.footer?.text?.split(':')[1]?.trim();

    // ✅ Disable 2 nút sau khi bấm để tránh bị lặp
  const disabledRow = {
    type: 1,
    components: targetMsg.components[0].components.map(btn => ({
      ...btn.data,
      disabled: true
    }))
  };
  await targetMsg.edit({ components: [disabledRow] });

    if (action === 'accept') {
      const publicChannel = await client.channels.fetch(config.publicChannel).catch(() => null);
      if (!publicChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('<a:AbbyPeak:1393909356625657876> **Confession Ẩn Danh**')
        .setDescription(originalContent)
        .setColor('Blue')
        .setFooter({ text: 'Gửi bởi một ai đó trong máy chủ' })
        .setTimestamp();

      const sent = await publicChannel.send({ embeds: [embed] });
      const emojis = ['<a:AbbyPray:1393909359154696233>', '<a:AbbyShocked:1393909368138895411>', '<a:AbbyAngry:1393908721624551434>', '<a:AbbyExplain:1393909308554739732>', '<a:AbbyWOW:1393909383884439602>'];
      for (const emoji of emojis) await sent.react(emoji);
      
       } else if (action === 'reject') {
    // ❌ Không gửi DM cho ai hết, chỉ disable nút
  
    /*  if (senderId) {
        const user = await client.users.fetch(senderId).catch(() => null);
        if (user) user.send('<a:AbbyOK:1393909348077670462> Confession của bạn đã được duyệt và đăng thành công!').catch(() => null);
      } */     
    }
  }
});

client.once('ready', () => {
  console.log(`✅ Bot đã hoạt động với tên ${client.user.tag}`);
  client.user.setPresence({
        activities: [
            { name: 'Iuno đến đâyyyy', type: 3 } // 0	Playing	Chơi game // 1	Streaming	Đang stream // 2	Listening	Đang nghe // 3	Watching	Đang xem // 5	Competing	Đang thi đấu
        ],
        status: 'idle' // 'online', 'idle', 'dnd', 'invisible'
    });
});

import { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection } from '@discordjs/voice';
import googleTTS from 'google-tts-api';
import { createWriteStream } from 'fs';
import https from 'https';
import ffmpeg from 'ffmpeg-static';

client.on('voiceStateUpdate', async (oldState, newState) => {
  // Nếu người dùng mới vào voice
  if (!oldState.channelId && newState.channelId && newState.member && !newState.member.user.bot) {
    console.log(`🟢 ${newState.member.user.username} vừa vào voice: ${newState.channel.name}`);
    const member = newState.member;
    const channel = newState.channel;

    // Tạo text TTS
    //const text = `Chào mừng ${member.displayName} đến với kênh ${channel.name}`;
    const name = member.displayName || member.nickname || member.user?.username || 'bạn';
    const greetings = [
`Chuẩn bị tâm lý nhé, ${member.displayName} tới rồi!`,
`Hey ${member.displayName}, mình chờ bạn nãy giờ đó!`,
`🛬 Hạ cánh an toàn! ${member.displayName} đã tiến vào ${channel.name}!`,
`🎯 Đội hình đã đủ – ${member.displayName} là mảnh ghép cuối cùng còn thiếu đó.`,
`⚔️ Anh em mình cứ thế thôi ${member.displayName} nhỉ, hẹ hẹ hẹ.`,
`Người chơi hệ chất lượng ${member.displayName} đã nhập hội!`,
`${member.displayName} vừa respawn! Không biết lần này gánh hay feed nữa đây?`,
`🎮 ${member.displayName} đã log in. Kẻ thù hãy run sợ dần đi!`,
`🎤 ${member.displayName} vào rồi! Còn chờ gì mà không on the mic`,
` Ô kìa ${member.displayName} đã tới rồi`,
` Mỹ nhân, đừng cản ${member.displayName} tu tiên @@!`,
` Đang tiến vào ${channel.name} chính là ${member.displayName}, cùng nhiệt liệt chào đón nào`
  //`${name} わっはっはっは`,
  //`${name} にゃんにゃん～！`,
  //`${name} やめてください`,
  //`${name} だめだよ`,
  //`${name} おにいちゃん、だいすき`,
  //`${name} おにいちゃん、何が好き？`,
  //`${name} いっしょにゲームしよう`,
  //`${name} おまえはもう死んでいる。`,
  //`${name} バカバカ`,
];

// 🎯 Chọn 1 câu ngẫu nhiên:
const text = greetings[Math.floor(Math.random() * greetings.length)];

    const url = googleTTS.getAudioUrl(text, {
      lang: 'vi',
      slow: false,
      host: 'https://translate.google.com',
    });

    // Tạo kết nối voice
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 5_000);
    } catch {
      if (connection && !connection.destroyed) {
    connection.destroy();
}
      return;
    }

    const resource = createAudioResource(url);
    const player = createAudioPlayer();

    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Idle, () => {
      ///connection.destroy();///
    });
  }

  // ✅ 2. Nếu có người rời voice → kiểm tra còn ai không
  if (oldState.channelId && !newState.channelId && oldState.channel) {
    const channel = oldState.channel;
    const remainingMembers = channel.members.filter(m => !m.user.bot);

    if (remainingMembers.size === 0) {
      const botConnection = getVoiceConnection(channel.guild.id);
      if (botConnection) {
        botConnection.destroy();
        console.log(`👋 Bot đã rời khỏi kênh voice vì không còn người.`);
      }
    }
  }
});


client.login(process.env.TOKEN);
